import {clean,headerKey} from './normalize.js';
export const ACCOMMODATIONS={time:'תוספת זמן',reading:'הקראה',typing:'הקלדה',enlarged:'הגדלה',small:'כיתה מצומצמת',adapted:'מבחן מותאם בעברית',spelling:'התעלמות משגיאות כתיב'};
// Approved by the user, 2026-11-16, against DOCX table and PDF p.1.
export const IMMIGRANT_RULES={
  A:{label:'א׳',time:25,questionnaire:'11284'},
  B:{label:'ב׳',time:25,questionnaire:'11284'},
  C:{label:'ג׳',time:25,questionnaire:'11264'}
};
const identification={ 'תז':'id','שםהתלמיד':'name','שכבה':'grade','כיתה':'classroom','מס':'metadata','מספר':'metadata','קבוצה':'metadata' };
export function classifyHeader(header) {
  const k=headerKey(header), h=clean(header);
  if(identification[k]) return {kind:identification[k],scope:'identity'};
  if(/אנגלית|מתמטיקה|שאלוןe/i.test(k)) return {kind:'excluded',scope:'other',reason:'התאמה למקצוע אחר אינה מקנה זכאות בעברית'};
  if(/רבימלל/.test(k)) return {kind:'excluded',scope:'other',reason:'התאמה המוגבלת לרבי מלל אינה חלה בעברית'};
  if(/דלימלל/.test(k)) return {kind:'review',scope:'unclear',reason:'דלי מלל: נדרש מיפוי מפורש ומאושר'};
  if(/^תוספתזמן/.test(k)) {
    const percent = h.match(/(\d+(?:\.\d+)?)\s*%/);
    return {kind:'time',scope:'general',percent:percent?Number(percent[1]):null};
  }
  const explicit={'הקראהבעברית':'reading','הקראתשאלוןבעברית':'reading','הקלדהבעברית':'typing','מבחןמותאםבעברית':'adapted','מבחןמותאםבלשון':'adapted'};
  if(explicit[k])return {kind:explicit[k],scope:'hebrew'};
  const general={'הקלדה':'typing','הקראתשאלון':'reading','הקראה':'reading','הגדלתשאלון':'enlarged','הגדלה':'enlarged','כיתהמצומצמת':'small','התעלמותמשגיאותכתיב':'spelling'};
  if(general[k])return {kind:general[k],scope:'general',needsApproval:['typing','reading'].includes(general[k])};
  return {kind:'unknown',scope:'unclear',reason:'כותרת לא מוכרת; אין זכאות אוטומטית'};
}
export function interpretCell(header,raw,grade) {
  const value=clean(raw), h=classifyHeader(header), source={type:'excel',column:String(header),value:String(raw ?? ''),scope:h.scope};
  const outcome=(status,reason,amount)=>({status,reason,kind:h.kind,amount:amount??(h.kind==='time'?h.percent:undefined),source});
  if(!value)return outcome('empty','');
  if(['id','name','grade','classroom','metadata'].includes(h.kind)) return outcome('metadata','');
  // Excluded columns never acquire an exception from their cell contents.
  if(h.kind==='excluded')return outcome('excluded',h.reason);
  if(/(?:^|[ (,:;])(?:לא|ללא|אין|מבוטל|בוטל|שלילה)(?:$|[ )\s,:;])/.test(value) || /^(?:0|לא|[-–])$/.test(value))return outcome('excluded','שלילה או ביטול בתוכן התא');
  if(/רבי\s*מלל/i.test(value)) return outcome('excluded','הערה בתא מגבילה לרבי מלל או ל־iTest רבי מלל');
  if(/אנגלית|מתמטיקה/.test(value) && !/עברית|לשון/.test(value))return outcome('excluded','תוכן התא מגביל למקצוע אחר');
  if(/דלי\s*מלל/.test(value))return outcome('review','הגבלה לדלי מלל דורשת מיפוי מאושר');
  if(h.kind==='small' && grade===10)return outcome('excluded','בשכבה י׳ אין זכאות לכיתה מצומצמת');
  if(h.kind==='unknown' || h.kind==='review')return outcome('review',h.reason);
  if(!/^[xh](?:\s|$|\()/i.test(value))return outcome('review','סימון שאינו X או H; יש לברר את משמעותו');
  const note=value.replace(/^[xh]/i,'').trim();
  if(note && !/^\(\s*(?:עברית|לשון)\s*\)$/.test(note)) return outcome('review','יש הערה בתא: נדרשת הכרעה לאחר קריאת התוכן המלא');
  if(h.needsApproval)return outcome('review','סימון כללי בהקלדה או בהקראה מחייב אישור ידני לעברית');
  if(h.kind==='spelling' && !/עברית|לשון/.test(value))return outcome('review','יש לאשר שהתעלמות משגיאות כתיב חלה בעברית');
  if(h.kind==='time' && !h.percent)return outcome('review','לא זוהה אחוז תוספת הזמן');
  return outcome('granted','זכאות מפורשת לעברית או התאמה כללית מאושרת',h.kind==='time'?h.percent:true);
}
export function effective(s) {
  const sources={}, exclusions=[];
  const add=(kind,value,source)=>{(sources[kind]??=[]).push({...source,amount:value});};
  for(const a of s.original.accommodations) add(a.kind,a.amount,a.source);
  for(const issue of s.issues??[])if(issue.resolution==='grant' && ACCOMMODATIONS[issue.kind])add(issue.kind,issue.kind==='time'?issue.amount:true,{...issue.source,type:'review',reason:issue.reason});
  const fixed=s.grade===10 && s.classroom===7;
  const differential=fixed || (s.manual?.differential ?? s.differential?.enabled ?? false);
  if(differential)for(const kind of ['time','reading','typing','enlarged','adapted','spelling'])add(kind,kind==='time'?'unspecified':true,{type:fixed?'class7':'differential',value:fixed?'כל תלמידי י׳7, לפי הוראת בית הספר':(s.differential?.line||'סימון ידני'),note:kind==='time'?'אחוז תוספת הזמן נלקח ממקור מאושר אחר או מוזן ידנית; המעמד אינו קובע אחוז':undefined});
  const immigrant=s.manual?.immigrant;
  if(immigrant && IMMIGRANT_RULES[immigrant])add('time',25,{type:'immigrant',value:`רמה ${IMMIGRANT_RULES[immigrant].label}`});
  for(const [kind,value] of Object.entries(s.manual?.accommodations||{})) {
    // Mandatory classroom-7/differential entitlements cannot be removed.
    if(value===false && differential && ['reading','typing','enlarged','adapted','spelling'].includes(kind))continue;
    sources[kind]=[];
    if(value!==false && value!==0)add(kind,kind==='time'?Number(value):true,{type:'manual',value:String(value),previous:s.original.accommodations.filter(a=>a.kind===kind).map(a=>a.source)});
    else if(differential && kind==='time')add(kind,'unspecified',{type:fixed?'class7':'differential',value:'זכאות מחייבת, אחוז טעון השלמה'});
  }
  if(s.grade===10 && sources.small?.length){exclusions.push('כיתה מצומצמת הוחרגה: אינה חלה בשכבה י׳');sources.small=[];}
  const a={};for(const k of Object.keys(ACCOMMODATIONS)){if(k==='time'){const numeric=(sources[k]||[]).map(x=>Number(x.amount)||0);a[k]=Math.max(0,...numeric)||((sources[k]||[]).length?'unspecified':0);}else a[k]=!!sources[k]?.length;}
  const questionnaire=immigrant && s.grade===11 ? ((immigrant==='B' && s.manual?.immigrantException)?'11264':IMMIGRANT_RULES[immigrant].questionnaire) : null;
  return {...a,computer:!!(a.reading||a.typing),differential,fixed,immigrant,questionnaire,sources,exclusions};
}
export function accommodationText(s,{supervisor=false}={}) {
 const e=effective(s);if(supervisor && e.differential)return 'תוספת זמן, הקראה, הקלדה';
 const parts=Object.entries(ACCOMMODATIONS).filter(([k])=>e[k]).map(([k,v])=>k==='time'?`${v} ${e.time==='unspecified'?'— אחוז טעון השלמה':e.time+'%'}`:v);
 if(e.questionnaire)parts.push(`שאלון ${e.questionnaire}`);
 return parts.join(', ')||'ללא התאמות';
}
export function sourceLabel(a){return ({excel:'אקסל',review:'אישור ידני של תא',manual:'תיקון ידני',differential:'רשימת חינוך מיוחד / סימון ידני',class7:'כלל י׳7',immigrant:'מעמד עולה'})[a.type]||a.type;}

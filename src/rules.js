import {clean,headerKey} from './normalize.js';
export const ACCOMMODATIONS={time:'תוספת זמן',reading:'הקראה',typing:'הקלדה',enlarged:'הגדלה',small:'כיתה מצומצמת',adapted:'מבחן מותאם בעברית',spelling:'התעלמות משגיאות כתיב'};
// Approved by the user, 2026-11-16, against DOCX table and PDF p.1.
export const IMMIGRANT_RULES={
  A:{label:'א׳',time:25,questionnaire:'11284'},
  B:{label:'ב׳',time:25,questionnaire:'11284'},
  C:{label:'ג׳',time:25,questionnaire:'11264'}
};
const identification={ 'תז':'id','שםהתלמיד':'name','שכבה':'grade','כיתה':'classroom','מס':'metadata','מספר':'metadata','קבוצה':'metadata' };
const otherSubjects='אנגלית|מתמטיקה|היסטוריה|ספרות|אזרחות|תנך|ביולוגיה|פיזיקה|כימיה|גאוגרפיה|גיאוגרפיה|ערבית|צרפתית|רוסית|ספרדית|מדעיהמחשב';
// Scope is checked separately from a positive marker. Hebrew must be explicit in a scoped list.
export function subjectScope(text){
 const k=headerKey(text),hasHebrew=/עברית|לשון/.test(k);
 if(/(?:אינם|אינן|אינה|אינו|לא)כולל(?:ים|ות|ת)?(?:את)?(?:עברית|לשון)/.test(k))return {excluded:true,reason:'הטקסט מציין במפורש שההתאמה אינה חלה בעברית/לשון'};
 if(/(?:לא|ללא|למעט|פרטל|חוץמ)(?:ב|ל|מ|את)?(?:עברית|לשון)|(?:עברית|לשון)(?:לאכלולה|אינהכלולה|אינוכלול|לאזכאי|לאמאושר|לאחל|לא$)/.test(k))return {excluded:true,reason:'הטקסט מציין במפורש שההתאמה אינה חלה בעברית/לשון'};
 const positive=k.replace(new RegExp(`(?:לא|ללא|למעט|פרטל|חוץמ)(?:ב|ל|מ|את)?(?:${otherSubjects})`,'g'),'');
 const groups=/רבימלל|דלימלל/.test(positive),other=new RegExp(otherSubjects).test(positive)||/שאלוןe/i.test(positive);
 const specificGroup=/(?:במקצוע|למקצוע|מקצועות|קבוצת|קבוצות)/.test(positive)&&!/(?:כלל|בכל|לכל|כל)ה?מקצוע(?:ות)?/.test(positive);
 if(!hasHebrew&&(groups||other||specificGroup))return {excluded:true,reason:groups?'התאמה לדלי מלל או לרבי מלל אינה חלה בעברית/לשון':'ההתאמה מוגבלת למקצועות או לקבוצה שאינם כוללים במפורש עברית/לשון'};
 return {excluded:false,hasHebrew};
}
export function classifyHeader(header) {
  const k=headerKey(header), h=clean(header);
  if(identification[k]) return {kind:identification[k],scope:'identity'};
  if(/מלווה/.test(k) && /שמע|שמיע/.test(k))return {kind:'excluded',scope:'other',reason:'מלווה ללקוי שמיעה אינו התאמה רלוונטית לבחינה בעברית/לשון'};
  const scope=subjectScope(header);
  if(scope.excluded)return {kind:'excluded',scope:'other',reason:scope.reason};
  if(/^תוספתזמן/.test(k)) {
    const percent = h.match(/(\d+(?:\.\d+)?)\s*%/);
    return {kind:'time',scope:'general',percent:percent?Number(percent[1]):null};
  }
  const explicit={'הקראהבעברית':'reading','הקראתשאלוןבעברית':'reading','הקלדהבעברית':'typing','מבחןמותאםבעברית':'adapted','מבחןמותאםבלשון':'adapted'};
  if(explicit[k])return {kind:explicit[k],scope:'hebrew'};
  const general={'הקלדה':'typing','הקראתשאלון':'reading','הקראה':'reading','הגדלתשאלון':'enlarged','הגדלה':'enlarged','כיתהמצומצמת':'small','התעלמותמשגיאותכתיב':'spelling','מבחןמותאם':'adapted'};
  // An explicitly Hebrew-inclusive subject suffix does not create a new accommodation kind.
  const suffix=new RegExp(`^(?:(?:ב|ל|ו)?(?:עברית|לשון|${otherSubjects}|רבימלל|דלימלל|מקצועות|בלבד|itest)|[,&+])+$`,'i');
  const base=general[k]?k:scope.hasHebrew?Object.keys(general).find(b=>k.startsWith(b)&&suffix.test(k.slice(b.length))):null;
  if(base)return {kind:general[base],scope:general[base]==='spelling'?'immigrant':scope.hasHebrew?'hebrew':'general'};
  return {kind:'unknown',scope:'unclear',reason:'כותרת לא מוכרת; אין זכאות אוטומטית'};
}
export function interpretCell(header,raw,grade) {
  const value=clean(raw), h=classifyHeader(header), source={type:'excel',column:String(header),value:String(raw ?? ''),scope:h.scope};
  const outcome=(status,reason,amount)=>({status,reason,kind:h.kind,amount:amount??(h.kind==='time'?h.percent:undefined),source});
  if(!value)return outcome('empty','');
  if(['id','name','grade','classroom','metadata'].includes(h.kind)) return outcome('metadata','');
  // Excluded columns never acquire an exception from their cell contents.
  if(h.kind==='excluded')return outcome('excluded',h.reason);
  if(/(?:לא|אינו|אינה)\s*זכאי|אין\s*זכאות|מבוטל|בוטל|נשלל|שלילה/.test(value)||/^(?:0|לא|ללא|אין|[-–])$/.test(value))return outcome('excluded','שלילה או ביטול בתוכן התא');
  const negatedKind={typing:/ללא\s*הקלדה|אין\s*הקלדה/,reading:/ללא\s*הקראה|אין\s*הקראה/,time:/ללא\s*תוספת\s*זמן|אין\s*תוספת\s*זמן/,small:/ללא\s*כיתה\s*מצומצמת/,enlarged:/ללא\s*הגדלה/,adapted:/ללא\s*מבחן\s*מותאם/,spelling:/ללא\s*התעלמות\s*משגיאות/};
  if(negatedKind[h.kind]?.test(value))return outcome('excluded','שלילה מפורשת של ההתאמה בתוכן התא');
  const cellScope=subjectScope(value);
  if(cellScope.excluded)return outcome('excluded',cellScope.reason);
  if(h.kind==='small' && grade===10)return outcome('excluded','בשכבה י׳ אין זכאות לכיתה מצומצמת');
  if(h.kind==='unknown' || h.kind==='review')return outcome('review',h.reason);
  if(!/^[xh](?:\s|$|\()/i.test(value))return outcome('review','סימון שאינו X או H; יש לברר את משמעותו');
  if(h.kind==='spelling')return outcome('conditional','התאמה לעולים בלבד; הסימון יופעל רק לאחר סימון התלמיד כעולה',true);
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
  if(differential)for(const kind of ['time','reading','typing','enlarged','adapted'])add(kind,kind==='time'?'unspecified':true,{type:fixed?'class7':'differential',value:fixed?'כל תלמידי י׳7, לפי הוראת בית הספר':(s.differential?.line||'סימון ידני'),note:kind==='time'?'אחוז תוספת הזמן נלקח ממקור מאושר אחר או מוזן ידנית; המעמד אינו קובע אחוז':undefined});
  const immigrant=IMMIGRANT_RULES[s.manual?.immigrant]?s.manual.immigrant:null;
  if(immigrant && IMMIGRANT_RULES[immigrant])add('time',25,{type:'immigrant',value:`רמה ${IMMIGRANT_RULES[immigrant].label}`});
  for(const [kind,value] of Object.entries(s.manual?.accommodations||{})) {
    // Mandatory classroom-7/differential entitlements cannot be removed.
    if(value===false && differential && ['reading','typing','enlarged','adapted'].includes(kind))continue;
    sources[kind]=[];
    if(value!==false && value!==0)add(kind,kind==='time'?Number(value):true,{type:'manual',value:String(value),previous:s.original.accommodations.filter(a=>a.kind===kind).map(a=>a.source)});
    else if(differential && kind==='time')add(kind,'unspecified',{type:fixed?'class7':'differential',value:'זכאות מחייבת, אחוז טעון השלמה'});
  }
  if(s.grade===10 && sources.small?.length){exclusions.push('כיתה מצומצמת הוחרגה: אינה חלה בשכבה י׳');sources.small=[];}
  if(!immigrant && sources.spelling?.length){exclusions.push('התעלמות משגיאות כתיב הוחרגה: התאמה זו מיועדת לעולים בלבד, והתלמיד אינו מסומן כעולה. מקור הסימון נשמר');sources.spelling=[];}
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

import {escapeHTML as h,sortedStudents,gradeLabel,classLabel} from './normalize.js';
import {effective,accommodationText} from './rules.js';
export function roomSubtitle(students){const t=students.filter(s=>effective(s).time).length;return t===students.length?'כיתת תוספת זמן':t===0?'ללא תוספת זמן':'חדר מעורב — עם תוספת זמן וללא תוספת זמן';}
export const PRINT_CSS=`
 @page{size:A4 portrait;margin:8mm}
 *{box-sizing:border-box}body{margin:0;font-family:Arial,"Noto Sans Hebrew",sans-serif;color:#111;direction:rtl;background:white}
 .sheet{width:194mm;min-height:279mm;break-after:page;page-break-after:always;padding:0 1mm}
 .sheet:last-child{break-after:auto;page-break-after:auto}
 header{height:15mm;padding:.5mm 0 .5mm;border-bottom:1.2pt solid #222;margin-bottom:2mm}
 h1{font-size:18pt;line-height:1.1;margin:0 0 .8mm}h2{font-size:10pt;line-height:1.1;margin:0;font-weight:normal}p{margin:1.5mm 0;font-size:10pt}
 table{width:100%;border-collapse:collapse;table-layout:fixed;font-size:10pt}
 th{background:#eee;font-weight:bold}th,td{border:0.5pt solid #777;padding:1.2mm 1mm;overflow-wrap:anywhere;vertical-align:middle;text-align:right;line-height:1.15}
 tr{break-inside:avoid;page-break-inside:avoid}.supervisor th{font-size:9pt;padding:.6mm .8mm}.supervisor tr{height:5.8mm}.supervisor td{font-size:8.8pt;line-height:1;padding:0 .8mm}.supervisor td.name{font-size:9pt;line-height:1}.supervisor td.mark{height:5.8mm}
 .parallel{display:flex;gap:6mm;direction:rtl}.parallel>div{width:calc(50% - 3mm)}.parallel th,.parallel td{font-size:11pt;padding:.8mm 1.2mm;line-height:1.12}.parallel tr{height:9.5mm}
 .room-count{float:left;font-size:11pt}
 @media screen{body{background:#dfe3e5;padding:8mm}.sheet{background:#fff;margin:0 auto 8mm;box-shadow:0 2px 16px #0002}}
`;
function supervisorAccommodations(s){
 const e=effective(s),time=e.time===33?'תוספת זמן 33%':'תוספת זמן';if(e.differential)return `${time}, הקראה, הקלדה`;
 const labels={reading:'הקראה',typing:'הקלדה',enlarged:'הגדלה',small:'מצומצמת',adapted:'מותאם',spelling:'כתיב'},parts=[];
 if(e.time)parts.push(time);
 for(const [k,label]of Object.entries(labels))if(e[k])parts.push(label);
 if(e.questionnaire)parts.push(`שאלון ${e.questionnaire}`);
 return parts.join(', ');
}
function reportPages(students,rooms,result){
 if(!result?.complete)throw new Error('הדפסה זמינה רק לאחר שיבוץ מלא ועדכני');
 const roomPages=[];
 for(const r of rooms){
  const keys=result.assignments[r.id]||[],members=sortedStudents(students.filter(s=>s.active&&keys.includes(s.key)));
  if(!members.length)continue;
  if(members.length>38&&!result.manualPlacements?.length)throw new Error(`בחדר ${r.name} יש יותר מ־38 תלמידים; אין אפשרות להבטיח עמוד אחד`);
  const pageCount=Math.ceil(members.length/38);
  for(let page=0;page<pageCount;page++){
  const pageMembers=members.slice(page*38,(page+1)*38);
  roomPages.push({room:r,members,pageMembers,page,pageCount,count:`${pageMembers.length} נבחנים${pageCount>1?` · חלק ${page+1} מתוך ${pageCount} · ${members.length} בחדר`:''}`});
  }
 }
 if(!roomPages.length)throw new Error('אין נבחנים משובצים');
 return roomPages;
}
export function reportHTML(type,students,rooms,result){
 const roomPages=reportPages(students,rooms,result).map(({room:r,members,pageMembers,page,count})=>{
  const title=`<header><span class="room-count">${h(count)}</span><h1>חדר ${h(r.name)}</h1>${type==='supervisor'?`<h2>${h(roomSubtitle(members))}</h2>`:''}</header>`;
  let body;
  if(type==='students'){
   const half=Math.ceil(pageMembers.length/2),columns=[pageMembers.slice(0,half),pageMembers.slice(half)];
   body='<div class="parallel">'+columns.map(col=>`<div><table><colgroup><col style="width:80%"><col style="width:20%"></colgroup><tbody>${col.map(s=>`<tr><td>${h(s.name)}</td><td>${h(classLabel(s))}</td></tr>`).join('')}</tbody></table></div>`).join('')+'</div>';
  }else{
   body=`<table class="supervisor"><colgroup><col style="width:5%"><col style="width:28%"><col style="width:7%"><col style="width:40%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr><th>מס׳</th><th>שם</th><th>כיתת אם</th><th>התאמות</th><th>נוכחות</th><th>הגשה</th></tr></thead><tbody>${pageMembers.map((s,i)=>`<tr><td>${page*38+i+1}</td><td class="name">${h(s.name)}</td><td>${h(classLabel(s))}</td><td>${h(supervisorAccommodations(s))}</td><td class="mark"></td><td class="mark"></td></tr>`).join('')}</tbody></table>`;
  }
  return `<section class="sheet">${title}${body}</section>`;
 });
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דוח ${type==='students'?'תלמידים':'משגיחים'} — כל הנבחנים</title><style>${PRINT_CSS}</style></head><body>${roomPages.join('')}</body></html>`;
}

// RTF is ASCII with signed UTF-16 escapes, so Hebrew survives Word and other editors.
const rtfText=value=>String(value??'').replace(/[\\{}\r\n\t]|[^\x20-\x7e]/g,c=>/[\\{}]/.test(c)?'\\'+c:/[\r\n\t]/.test(c)?' ':`\\u${c.charCodeAt(0)>32767?c.charCodeAt(0)-65536:c.charCodeAt(0)}?`);
function rtfRow(values,widths,{size=18,height=330,borders=true,bold=false,heading=false}={}){
 let edge=0;
 const cells=widths.map((width,i)=>{edge+=width;return '\\clvertalc'+(borders&&!(widths.length===5&&i===2)?'\\clbrdrt\\brdrs\\brdrw5\\clbrdrl\\brdrs\\brdrw5\\clbrdrb\\brdrs\\brdrw5\\clbrdrr\\brdrs\\brdrw5':'')+`\\cellx${edge}`;}).join('');
 return `\\trowd\\rtlrow\\trgaph45\\trleft0\\trrh${height}\\trkeep${heading?'\\trhdr':''}${cells}\n`+values.map(v=>`\\pard\\intbl\\rtlpar\\qr\\sa0\\sb0\\ltrch\\f0\\fs${size}\\rtlch\\af0\\afs${size}\\sl-${size*10}\\slmult0${bold?'\\b':'\\b0'} ${rtfText(v)}\\cell `).join('')+'\\row\n';
}
export function reportRTF(type,students,rooms,result){
 const pages=reportPages(students,rooms,result).map(({room,members,pageMembers,page,count})=>{
  let body=rtfRow([`חדר ${room.name}`,count],[7700,3300],{size:30,height:500,borders:false,bold:true});
  body+='\\pard\\rtlpar\\qr\\f0\\fs20\\sa100 '+(type==='supervisor'?rtfText(roomSubtitle(members)):'')+'\\par\n';
  if(type==='students'){
   const half=Math.ceil(pageMembers.length/2);
   for(let i=0;i<half;i++){const a=pageMembers[i],b=pageMembers[i+half];body+=rtfRow([a.name,classLabel(a),'',b?.name||'',b?classLabel(b):''],[4400,950,300,4400,950],{size:22,height:540});}
  }else{
   const widths=[550,3080,770,4400,1100,1100];
   body+=rtfRow(['מס׳','שם','כיתת אם','התאמות','נוכחות','הגשה'],widths,{bold:true,heading:true});
   for(const [i,s]of pageMembers.entries())body+=rtfRow([page*38+i+1,s.name,classLabel(s),supervisorAccommodations(s),'',''],widths);
  }
  return body+'\\pard\\intbl0\\rtlpar\\sa0\\sb0\\fs2\\sl20\\slmult0\\par\n';
 });
 return '{\\rtf1\\ansi\\ansicpg1255\\deff0\\uc1{\\fonttbl{\\f0\\fnil\\fcharset177 Arial;}}\\paperw11906\\paperh16838\\margl454\\margr454\\margt454\\margb454\\rtlsect\n'+pages.join('\\pard\\intbl0\\fs2\\sl20\\slmult0\\page\\par\n')+'}';
}
const csvCell=value=>{let v=String(value??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
export function assignmentCSV(students,rooms,result){
 if(!result?.complete)throw new Error('ייצוא זמין רק לאחר שיבוץ מלא ועדכני');
 const manual=result.manualPlacements||[],rows=[['ת.ז','שם התלמיד','שכבה','כיתת אם','חדר','התאמות',...(manual.length?['אופן השיבוץ','הערה להחלטה']:[])]];
 for(const s of sortedStudents(students.filter(s=>s.active))){const id=Object.keys(result.assignments).find(r=>result.assignments[r].includes(s.key));if(!id)throw new Error('תלמיד חסר בתוצאה');const decision=manual.find(m=>m.key===s.key);rows.push([s.id,s.name,gradeLabel(s.grade),classLabel(s),rooms.find(r=>r.id===id).name,accommodationText(s),...(manual.length?[decision?'ידני':'אוטומטי',decision?.note||'']:[])]);}
 return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
export function download(content,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}

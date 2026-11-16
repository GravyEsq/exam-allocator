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
 .column-label{font-size:10pt;font-weight:bold;margin:1mm 0 2mm}.room-count{float:left;font-size:11pt}.legend{font-size:10pt;margin:2mm 0}
 .key{font-size:8pt;line-height:1.2;margin-top:2mm}
 @media screen{body{background:#dfe3e5;padding:8mm}.sheet{background:#fff;margin:0 auto 8mm;box-shadow:0 2px 16px #0002}}
`;
function supervisorAccommodations(s){
 const e=effective(s);if(e.differential)return 'תוספת זמן, הקראה, הקלדה';
 const labels={reading:'הקראה',typing:'הקלדה',enlarged:'הגדלה',small:'מצומצמת',adapted:'מותאם',spelling:'כתיב'},parts=[];
 if(e.time)parts.push(`תוספת זמן ${e.time==='unspecified'?'טעונה השלמה':e.time+'%'}`);
 for(const [k,label]of Object.entries(labels))if(e[k])parts.push(label);
 if(e.questionnaire)parts.push(`שאלון ${e.questionnaire}`);
 return parts.join(', ')||'ללא התאמות';
}
export function reportHTML(type,grade,students,rooms,result){
 if(![10,11,12].includes(Number(grade)))throw new Error('יש לבחור שכבה אחת להדפסה');
 if(!result?.complete)throw new Error('הדפסה זמינה רק לאחר שיבוץ מלא ועדכני');
 const roomPages=[];
 for(const r of rooms){
  const keys=result.assignments[r.id]||[],allMembers=students.filter(s=>keys.includes(s.key)),members=sortedStudents(allMembers.filter(s=>s.grade===Number(grade)));
  if(!members.length)continue;
  if(members.length>38&&!result.manualPlacements?.length)throw new Error(`בחדר ${r.name} יש יותר מ־38 תלמידים; אין אפשרות להבטיח עמוד אחד`);
  const pageCount=Math.ceil(members.length/38);
  for(let page=0;page<pageCount;page++){
  const pageMembers=members.slice(page*38,(page+1)*38);
  const title=`<header><span class="room-count">${pageMembers.length} נבחנים · שכבה ${h(gradeLabel(Number(grade)))}${pageCount>1?` · חלק ${page+1} מתוך ${pageCount} · ${members.length} בחדר`:''}</span><h1>חדר ${h(r.name)}</h1><h2>בחינה בעברית / לשון${type==='supervisor'?` · ${h(roomSubtitle(allMembers))}${allMembers.length!==members.length?' · משותף לכמה שכבות':''}`:''}</h2></header>`;
  let body;
  if(type==='students'){
   const half=Math.ceil(pageMembers.length/2),columns=[pageMembers.slice(0,half),pageMembers.slice(half)];
   body='<p class="legend">סדר הקריאה: הטור הימני מלמעלה למטה, ואחריו הטור השמאלי.</p><div class="parallel">'+columns.map((col,i)=>`<div><div class="column-label">${i===0?'טור ראשון — ימין':'טור שני — שמאל'}</div><table><colgroup><col style="width:80%"><col style="width:20%"></colgroup><thead><tr><th>שם</th><th>כיתה</th></tr></thead><tbody>${col.map(s=>`<tr><td>${h(s.name)}</td><td>${h(classLabel(s))}</td></tr>`).join('')}</tbody></table></div>`).join('')+'</div>';
  }else{
   body=`<table class="supervisor"><colgroup><col style="width:5%"><col style="width:28%"><col style="width:7%"><col style="width:40%"><col style="width:10%"><col style="width:10%"></colgroup><thead><tr><th>מס׳</th><th>שם</th><th>כיתת אם</th><th>התאמות</th><th>נוכחות</th><th>הגשה</th></tr></thead><tbody>${pageMembers.map((s,i)=>`<tr><td>${page*38+i+1}</td><td class="name">${h(s.name)}</td><td>${h(classLabel(s))}</td><td>${h(supervisorAccommodations(s))}</td><td class="mark"></td><td class="mark"></td></tr>`).join('')}</tbody></table><p class="key">מקרא: מצומצמת = כיתה מצומצמת; מותאם = מבחן מותאם בעברית; כתיב = התעלמות משגיאות כתיב.</p>`;
  }
  roomPages.push(`<section class="sheet">${title}${body}</section>`);
  }
 }
 if(!roomPages.length)throw new Error('אין נבחנים משובצים בשכבה שנבחרה');
 return `<!doctype html><html lang="he" dir="rtl"><head><meta charset="utf-8"><title>דוח ${type==='students'?'תלמידים':'משגיחים'} — ${h(gradeLabel(Number(grade)))}</title><style>${PRINT_CSS}</style></head><body>${roomPages.join('')}</body></html>`;
}
const csvCell=value=>{let v=String(value??'');if(/^[=+@\-\t\r]/.test(v))v="'"+v;return '"'+v.replace(/"/g,'""')+'"';};
export function assignmentCSV(students,rooms,result){
 if(!result?.complete)throw new Error('ייצוא זמין רק לאחר שיבוץ מלא ועדכני');
 const manual=result.manualPlacements||[],rows=[['ת.ז','שם התלמיד','שכבה','כיתת אם','חדר','התאמות',...(manual.length?['אופן השיבוץ','הערה להחלטה']:[])]];
 for(const s of sortedStudents(students.filter(s=>s.active))){const id=Object.keys(result.assignments).find(r=>result.assignments[r].includes(s.key));if(!id)throw new Error('תלמיד חסר בתוצאה');const decision=manual.find(m=>m.key===s.key);rows.push([s.id,s.name,gradeLabel(s.grade),classLabel(s),rooms.find(r=>r.id===id).name,accommodationText(s),...(manual.length?[decision?'ידני':'אוטומטי',decision?.note||'']:[])]);}
 return '\uFEFF'+rows.map(r=>r.map(csvCell).join(',')).join('\r\n');
}
export function download(content,name,type='text/plain;charset=utf-8'){const url=URL.createObjectURL(new Blob([content],{type})),a=document.createElement('a');a.href=url;a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(url),3000);}

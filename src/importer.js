import {clean,gradeOf,normalizedId,validateStudent} from './normalize.js';
import {classifyHeader,interpretCell} from './rules.js';
export function findHeader(rows){return rows.findIndex(row=>['id','name','grade','classroom'].every(k=>row.some(h=>classifyHeader(h).kind===k)));}
export function sheetInfo(workbook,XLSX){return workbook.SheetNames.map(name=>{
 const rows=XLSX.utils.sheet_to_json(workbook.Sheets[name],{header:1,defval:'',raw:false}),header=findHeader(rows);
 return {name,header,rows:header>=0?rows.slice(header+1).filter(r=>r.some(v=>clean(v))).length:0};
});}
export function readWorkbook(data,XLSX){return XLSX.read(data,{type:'array',cellText:true,cellDates:false});}
export function parseRows(rows,sheet='גיליון'){
 const hrow=findHeader(rows); if(hrow<0)throw new Error(`בגיליון ${sheet} לא נמצאה שורת כותרות ובה ת.ז, שם התלמיד, שכבה וכיתה`);
 const headers=rows[hrow].map(h=>clean(h)),kinds=headers.map(h=>classifyHeader(h).kind);
 for(const key of ['id','name','grade','classroom'])if(kinds.filter(k=>k===key).length!==1)throw new Error(`בגיליון ${sheet} עמודת זיהוי כפולה: ${key}`);
 const students=[],unknown=headers.filter(h=>classifyHeader(h).kind==='unknown');
 for(let r=hrow+1;r<rows.length;r++){
  const row=rows[r];if(!row.some(v=>clean(v)))continue;
  const get=k=>clean(row[kinds.indexOf(k)]);
  const g=gradeOf(get('grade')), c=Number(get('classroom').replace(/^.*?([0-9]+)\s*$/,'$1'));
  const s={key:`${sheet}:${r+1}`,id:normalizedId(get('id')),name:get('name'),grade:g,classroom:c,active:true,manual:{accommodations:{}},differential:null,issues:[],original:{sheet,row:r+1,headers,cells:row.map(v=>String(v??'')),accommodations:[],excluded:[]}};
  for(let j=0;j<Math.max(headers.length,row.length);j++){
   const header=headers[j]||`עמודה ללא כותרת ${j+1}`,a=interpretCell(header,row[j],g);a.source={...a.source,sheet,row:r+1};
   if(a.status==='granted'||a.status==='conditional')s.original.accommodations.push(a);
   if(a.status==='excluded')s.original.excluded.push(a);
   if(a.status==='review')s.issues.push({...a,originalKind:a.kind,originalAmount:a.amount,key:`${s.key}:${j}`,resolution:null});
  }
  s.original.identity={id:s.id,name:s.name,grade:s.grade,classroom:s.classroom};s.validation=validateStudent(s);students.push(s);
 }
 return {students,unknown,headerRow:hrow+1};
}
export function importSheets(w,names,XLSX){
 const out={students:[],sheets:[]};
 for(const name of names){const r=parseRows(XLSX.utils.sheet_to_json(w.Sheets[name],{header:1,defval:'',raw:false}),name);out.students.push(...r.students);out.sheets.push({name,headerRow:r.headerRow,unknown:r.unknown});}
 return out;
}
// Re-evaluate a restored session from raw Excel cells. Retain explicit review decisions
// unless the current policy excludes that source; never discard manual overrides.
export function refreshImportedRules(students){
 let changed=false;
 for(const s of students){
  if(!Array.isArray(s.original?.headers)||!Array.isArray(s.original?.cells))continue;
  const before=JSON.stringify([s.original.accommodations,s.original.excluded,s.issues]),previous=new Map((s.issues||[]).map(i=>[i.key,i]));
  const accommodations=[],excluded=[],issues=[];
  for(let j=0;j<Math.max(s.original.headers.length,s.original.cells.length);j++){
   const header=s.original.headers[j]||`עמודה ללא כותרת ${j+1}`,a=interpretCell(header,s.original.cells[j],s.grade),key=`${s.key}:${j}`,old=previous.get(key);
   a.source={...a.source,sheet:s.original.sheet,row:s.original.row};
   if(a.status==='excluded')excluded.push(a);
   else if(a.status==='review')issues.push(old?.resolution?old:{...a,originalKind:a.kind,originalAmount:a.amount,key,resolution:null});
   else if(a.status==='granted'||a.status==='conditional'){
    if(old?.resolution)issues.push(old);else accommodations.push(a);
   }
  }
  s.original.accommodations=accommodations;s.original.excluded=excluded;s.issues=issues;
  if(before!==JSON.stringify([accommodations,excluded,issues]))changed=true;
 }
 return changed;
}
export function dataProblems(students){
 const errors=[],seen=new Map();
 for(const s of students.filter(s=>s.active)){
  for(const message of validateStudent(s))errors.push({student:s,message});
  if(seen.has(s.id))errors.push({student:s,message:`תעודת זהות כפולה עם ${seen.get(s.id).name} (${seen.get(s.id).original.sheet}, שורה ${seen.get(s.id).original.row})`});else seen.set(s.id,s);
  for(const i of s.issues)if(!i.resolution)errors.push({student:s,message:`נדרשת הכרעה: ${i.source.column} — ${i.source.value}`});
 }
 return errors;
}

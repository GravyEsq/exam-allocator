import {audit} from './allocator.js';

// Manual decisions may override allocation policy, but never the identity/counting of pupils.
function assertIntegrity(students,rooms,assignments){
 const known=new Set(students.map(s=>s.key)),roomIds=new Set(rooms.map(r=>r.id)),seen=new Set();
 for(const [id,keys]of Object.entries(assignments)){
  if(!roomIds.has(id))throw new Error('השיבוץ מפנה לחדר שהוסר; יש לחשב מחדש');
  if(!Array.isArray(keys))throw new Error('רשימת השיבוץ אינה תקינה');
  for(const key of keys){if(!known.has(key))throw new Error('השיבוץ כולל תלמיד שאינו ברשימת הנבחנים הפעילים; יש לחשב מחדש');if(seen.has(key))throw new Error('תלמיד מופיע ביותר מחדר אחד; יש לחשב מחדש');seen.add(key);}
 }
 return seen;
}
function review(result,allStudents,rooms,options){
 const students=allStudents.filter(s=>s.active),seen=assertIntegrity(students,rooms,result.assignments),previous=new Map((result.unassigned||[]).map(u=>[u.key,u.reason]));
 const unassigned=students.filter(s=>!seen.has(s.key)).map(s=>({key:s.key,reason:previous.get(s.key)||'לא שובץ; אפשר לבחור חדר ידנית או לחשב מחדש'}));
 const overrideWarnings=[];
 for(const [roomId,keys]of Object.entries(result.assignments))if(keys.length){
  const room=rooms.find(r=>r.id===roomId),messages=audit(students,rooms,{[roomId]:keys},options).errors;
  if(!room.enabled)messages.push(`החדר ${room.name} אינו מסומן כפתוח בהגדרות; הוא נבחר לשיבוץ ידני`);
  if(messages.length)overrideWarnings.push({roomId,messages:[...new Set(messages)]});
 }
 return {...result,complete:unassigned.length===0,unassigned,overrideWarnings,optimal:false,
  errors:unassigned.length?['טרם הושלם שיבוץ כל הנבחנים. החלטות ידניות עשויות לחרוג מכללי השיבוץ האוטומטי']:[],
  stats:{assigned:seen.size,unassigned:unassigned.length,atHome:students.filter(s=>Object.entries(result.assignments).some(([id,keys])=>{const room=rooms.find(r=>r.id===id);return keys.includes(s.key)&&room.grade===s.grade&&room.classroom===s.classroom;})).length}};
}
export function placeManually(result,students,rooms,key,roomId,options={},note=''){
 if(!result)throw new Error('יש ליצור שיבוץ אוטומטי לפני שיבוץ ידני');
 const active=students.filter(s=>s.active);assertIntegrity(active,rooms,result.assignments);
 const student=active.find(s=>s.key===key),room=rooms.find(r=>r.id===roomId),old=(result.manualPlacements||[]).find(m=>m.key===key);
 if(!student||!room)throw new Error('יש לבחור נבחן פעיל וחדר קיים');
 if(!old&&!(result.unassigned||[]).some(u=>u.key===key))throw new Error('התלמיד כבר משובץ; לא ייווצר שיבוץ כפול');
 const assignments=Object.fromEntries(Object.entries(result.assignments).map(([id,keys])=>[id,keys.filter(k=>k!==key)]));
 (assignments[roomId]??=[]).push(key);
 const record={key,roomId,note:String(note).trim(),originalReason:old?.originalReason||result.unassigned.find(u=>u.key===key)?.reason||'החלטה ידנית'};
 return review({...result,assignments,manualPlacements:[...(result.manualPlacements||[]).filter(m=>m.key!==key),record]},students,rooms,options);
}
export function undoManualPlacement(result,students,rooms,key,options={}){
 const record=result.manualPlacements?.find(m=>m.key===key);if(!record)throw new Error('לא נמצא שיבוץ ידני לתלמיד');
 const assignments=Object.fromEntries(Object.entries(result.assignments).map(([id,keys])=>[id,keys.filter(k=>k!==key)]));
 return review({...result,assignments,manualPlacements:result.manualPlacements.filter(m=>m.key!==key),unassigned:[...(result.unassigned||[]),{key,reason:record.originalReason}]},students,rooms,options);
}
export function reapplyManualPlacements(result,records,students,rooms,options={}){
 if(!records?.length)return result;
 const active=students.filter(s=>s.active),assignments=Object.fromEntries(Object.entries(result.assignments).map(([id,keys])=>[id,[...keys]])),manualPlacements=[],manualNotices=[];
 for(const record of records){
  const s=students.find(s=>s.key===record.key);
  if(!s||!s.active){manualPlacements.push({...record});continue;} // Keep the choice if the pupil is later restored.
  if(!rooms.some(r=>r.id===record.roomId)){manualNotices.push(`השיבוץ הידני של ${s.name} לא הוחל כי החדר הוסר. יש לבחור חדר מחדש`);continue;}
  for(const keys of Object.values(assignments)){const i=keys.indexOf(record.key);if(i!==-1)keys.splice(i,1);}
  (assignments[record.roomId]??=[]).push(record.key);manualPlacements.push({...record});
 }
 assertIntegrity(active,rooms,assignments);
 return review({...result,assignments,manualPlacements,manualNotices},students,rooms,options);
}

import {classLabel} from './normalize.js';
import {effective} from './rules.js';

export const classKey=s=>`${s.grade}:${s.classroom}`;
export const classFromKey=key=>{const [grade,classroom]=String(key).split(':').map(Number);return {grade,classroom};};
export const className=key=>classLabel(classFromKey(key));
export const pairParticipant=(s,d)=>d.type==='pair'&&d.classes.includes(classKey(s))&&!effective(s).computer&&!effective(s).small;
export const pairRoom=(r,d)=>r.type==='regular'&&!r.smallOnly&&d.classes.includes(classKey(r));
export const isolationParticipant=(s,d)=>d.type==='isolate'&&classKey(s)===d.classes[0]&&!effective(s).computer;
export function pairPlan(students,d){return d.classes.map(key=>{const total=students.filter(s=>s.active&&classKey(s)===key&&pairParticipant(s,d)).length;return {key,total,stay:Math.ceil(total/2),exchange:Math.floor(total/2)};});}
export function pairQuota(students,d,key,room){const plan=pairPlan(students,d).find(p=>p.key===key);return classKey(room)===key?plan.stay:plan.exchange;}
export function directiveLabel(d){return d.type==='pair'?`צימוד כיתות: ${d.classes.map(className).join(' + ')}`:`ללא ערבוב: ${className(d.classes[0])}`;}
export function validateDirectives(directives,students,{allowMixedGrades=false}={}){
 const errors=[],available=new Set(students.filter(s=>s.active).map(classKey)),used=new Set();
 if(!Array.isArray(directives))return ['רשימת הנחיות השיבוץ אינה תקינה'];
 for(const d of directives){
  if(!d||!['pair','isolate'].includes(d.type)||!Array.isArray(d.classes)||d.classes.length!==(d.type==='pair'?2:1)||d.classes.some(k=>typeof k!=='string')){errors.push('הנחיית שיבוץ אינה תקינה');continue;}
  const label=directiveLabel(d);
  for(const key of d.classes){
   if(!available.has(key))errors.push(`${label}: אין נבחנים פעילים ב־${className(key)} בהיקף השיבוץ שנבחר`);
   if(used.has(key))errors.push(`${className(key)} מופיעה ביותר מהנחיה אחת; יש להסיר את ההנחיה החופפת`);
   used.add(key);
   const c=classFromKey(key);if(c.classroom===7&&[10,11].includes(c.grade))errors.push(`${className(key)} כבר מוגדרת ככיתה סגורה ושלמה; אין להוסיף לה הנחיית צימוד או הפרדה`);
  }
  if(d.type==='pair'){
   if(!allowMixedGrades&&classFromKey(d.classes[0]).grade!==classFromKey(d.classes[1]).grade)errors.push(`${label}: לצימוד בין שכבות יש לבחור בשלב 1 במסגרת ״שיבוץ משותף״ ולכלול את שתי השכבות`);
   for(const key of d.classes)if(!students.some(s=>s.active&&classKey(s)===key&&pairParticipant(s,d)))errors.push(`${label}: ב־${className(key)} אין תלמידים ללא צורך במחשב או בכיתה מצומצמת שאפשר לצמד`);
  }
 }
 return [...new Set(errors)];
}
export function auditDirectives(members,room,directives,students){
 const errors=[];
 for(const d of directives){
  if(d.type==='isolate'){
   if(members.some(s=>isolationParticipant(s,d))&&members.some(s=>classKey(s)!==d.classes[0]))errors.push(`${room.name}: הופרה הנחיית ${directiveLabel(d)}; החריג לחדרי מחשבים חל רק על תלמידים הזקוקים למחשב`);
  }else{
   const paired=members.filter(s=>pairParticipant(s,d));if(!paired.length)continue;
   if(!pairRoom(room,d)||paired.length!==members.length)errors.push(`${room.name}: הופרה הנחיית ${directiveLabel(d)}; הצימוד משתמש רק בחדרי האם של שתי הכיתות וללא תלמידים מכיתות אחרות`);
   else for(const key of d.classes){const count=paired.filter(s=>classKey(s)===key).length,target=pairQuota(students,d,key,room);if(count>target)errors.push(`${room.name}: החלוקה לחצאים של ${className(key)} מאפשרת ${target} תלמידים בחדר זה, אך שובצו ${count}`);}
  }
 }
 return errors;
}

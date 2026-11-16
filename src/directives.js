import {classLabel} from './normalize.js';
import {effective} from './rules.js';

export const classKey=s=>`${s.grade}:${s.classroom}`;
export const classFromKey=key=>{const [grade,classroom]=String(key).split(':').map(Number);return {grade,classroom};};
export const className=key=>classLabel(classFromKey(key));
export const pairParticipant=(s,d)=>d.type==='pair'&&d.classes.includes(classKey(s))&&!effective(s).computer&&!effective(s).small;
export const pairRoom=(r,d)=>r.type==='regular'&&!r.smallOnly&&d.classes.includes(classKey(r));
export function directiveLabel(d){return d.type==='pair'?`צימוד חצי־חצי: ${d.classes.map(className).join(' + ')}`:`ללא ערבוב: ${className(d.classes[0])}`;}
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
export function auditDirectives(members,room,directives){
 const errors=[];
 for(const d of directives){
  if(d.type==='isolate'){
   if(members.some(s=>classKey(s)===d.classes[0])&&members.some(s=>classKey(s)!==d.classes[0]))errors.push(`${room.name}: הופרה הנחיית ${directiveLabel(d)}`);
  }else{
   const paired=members.filter(s=>pairParticipant(s,d));if(!paired.length)continue;
   const a=paired.filter(s=>classKey(s)===d.classes[0]).length,b=paired.length-a;
   if(!pairRoom(room,d)||paired.length!==members.length||!a||!b||Math.abs(a-b)>1)errors.push(`${room.name}: הופרה הנחיית ${directiveLabel(d)}; נדרשים חדרי האם של שתי הכיתות בלבד ופער של עד תלמיד אחד`);
  }
 }
 return errors;
}

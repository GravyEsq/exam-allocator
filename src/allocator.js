import {effective} from './rules.js';
import {classLabel,validateStudent} from './normalize.js';
import {validateRooms} from './rooms.js';
import {classKey,pairParticipant,pairRoom,pairPlan,pairQuota,isolationParticipant,validateDirectives,auditDirectives,directiveLabel} from './directives.js';

export function eligible(s,r,{allowMixedGrades=false,directives=[]}={}){
 const e=effective(s);
 if(e.fixed)return r.type==='fixed'&&r.grade===10&&r.classroom===7&&r.computer;
 if(s.grade===11&&s.classroom===7)return r.type==='closed'&&r.grade===11&&r.classroom===7&&(!e.computer||r.computer);
 if(r.type==='fixed'||r.type==='closed')return false;
 if(s.classroom===7)return false; // Other grade-7 policies require explicit school instructions.
 if(r.type==='computer'&&directives.some(d=>isolationParticipant(s,d)))return false;
 const pairing=directives.find(d=>pairParticipant(s,d));
 if(pairing)return pairRoom(r,pairing)&&(allowMixedGrades||r.grade===s.grade);
 return (r.type==='computer'||r.grade===s.grade) && (!e.computer||r.computer);
}
function groupStudents(students){
 const map=new Map();for(const s of students){const e=effective(s),k=[s.grade,s.classroom,e.computer,e.small,!!e.time].join(':');if(!map.has(k))map.set(k,{key:k,students:[],grade:s.grade,classroom:s.classroom,computer:e.computer,small:e.small,time:!!e.time});map.get(k).students.push(s);}return [...map.values()];
}
export function buildModel(students,rooms,glpk,{allowMixedGrades=false,partial=false,directives=[]}={}){
 const groups=groupStudents(students),G=glpk,lp={name:'exam',objective:{direction:G.GLP_MIN,name:'cost',vars:[]},subjectTo:[],bounds:[],binaries:[],generals:[]},variables=[];
 const term=(name,coef=1)=>({name,coef});
 const constraint=(name,vars,type,lb=0,ub=0)=>lp.subjectTo.push({name,vars,bnds:{type,lb,ub}});
 const objectives={coverage:[],computers:[],isolation:[],separation:[],layout:[]};
 const cost=(name,coef,priority='layout')=>{if(coef)objectives[priority].push(term(name,coef));};
 const binary=(name,coef=0,priority)=>{lp.binaries.push(name);cost(name,coef,priority);return name;};
 const moveCost=20;
 for(let g=0;g<groups.length;g++){
  const group=groups[g],vars=[];
  for(let r=0;r<rooms.length;r++)if(eligible(group.students[0],rooms[r],{allowMixedGrades,directives})&&(!directives.some(d=>pairParticipant(group.students[0],d))||(rooms[r].type==='regular'&&!rooms[r].smallOnly))){
   const name=`x${g}_${r}`;lp.generals.push(name);lp.bounds.push({name,type:G.GLP_DB,lb:0,ub:group.students.length});vars.push(term(name));variables.push({name,g,r});
   const home=rooms[r].type==='regular'&&rooms[r].grade===group.grade&&rooms[r].classroom===group.classroom;
   cost(name,home?0:moveCost);
  }
  if(partial){const name=`u${g}`;lp.generals.push(name);lp.bounds.push({name,type:G.GLP_DB,lb:0,ub:group.students.length});vars.push(term(name));cost(name,1,'coverage');}
  constraint(`all${g}`,vars,G.GLP_FX,group.students.length,group.students.length);
 }
 for(let r=0;r<rooms.length;r++){
  const room=rooms[r],v=variables.filter(v=>v.r===r),load=v.map(v=>term(v.name)),cap=room.smallOnly?Math.min(room.capacity,room.smallCapacity):room.capacity;
  const used=binary(`used${r}`,room.type==='computer'?1:0,'computers');
  constraint(`cap${r}`,[...load,term(used,-cap)],G.GLP_UP,0,0);
  constraint(`nonempty${r}`,[...load,term(used,-1)],G.GLP_LO,0,0);
  // User directives are hard constraints, including in the partial-solution model.
  const isolationFlags=[];
  for(let i=0;i<directives.length;i++){
   const d=directives[i],own=v.filter(x=>d.type==='pair'?pairParticipant(groups[x.g].students[0],d):isolationParticipant(groups[x.g].students[0],d));
   if(!own.length)continue;
   const z=binary(`directive${i}_${r}`,d.type==='isolate'?1:0,'isolation'),other=v.filter(x=>d.type==='pair'?!own.includes(x):classKey(groups[x.g])!==d.classes[0]);
   constraint(`directiveOwn${i}_${r}`,[...own.map(x=>term(x.name)),term(z,-cap)],G.GLP_UP,0,0);
   constraint(`directiveExclusive${i}_${r}`,[...other.map(x=>term(x.name)),term(z,cap)],G.GLP_UP,0,cap);
   if(d.type==='isolate')isolationFlags.push(z);
   else for(let c=0;c<d.classes.length;c++){
    const key=d.classes[c],quota=pairQuota(students,d,key,room);
    // Full coverage makes both halves exact; partial results can only leave seats unfilled.
    constraint(`pairHalf${i}_${r}_${c}`,own.filter(x=>classKey(groups[x.g])===key).map(x=>term(x.name)),G.GLP_UP,0,quota);
   }
  }
  if(room.type==='fixed'||room.type==='closed')constraint(`wholeClosedClass${r}`,[...load,term(used,-students.filter(s=>s.grade===room.grade&&s.classroom===room.classroom).length)],G.GLP_FX,0,0);
  const small=v.filter(v=>groups[v.g].small);
  if(small.length){
   const z=binary(`small${r}`);
   constraint(`needSmall${r}`,[...small.map(v=>term(v.name)),term(z,-cap)],G.GLP_UP,0,0);
   constraint(`smallCap${r}`,[...load,term(z,cap-Math.min(cap,room.smallCapacity))],G.GLP_UP,0,cap);
  }
  // In every regular room, ALL non-time students of a home class jointly count toward the four-person minimum.
  if(room.type==='regular')for(const home of new Set(v.filter(v=>!groups[v.g].time).map(v=>`${groups[v.g].grade}:${groups[v.g].classroom}`))){
   const subset=v.filter(v=>!groups[v.g].time&&`${groups[v.g].grade}:${groups[v.g].classroom}`===home).map(v=>term(v.name));const y=binary(`social${r}_${home.replace(':','_')}`);
   constraint(`socialMin${y}`,[...subset,term(y,-4)],G.GLP_LO,0,0);
   constraint(`socialMax${y}`,[...subset,term(y,-cap)],G.GLP_UP,0,0);
  }
  const time=v.filter(v=>groups[v.g].time).map(v=>term(v.name)),noTime=v.filter(v=>!groups[v.g].time).map(v=>term(v.name));
  const hasT=binary(`hasT${r}`),hasN=binary(`hasN${r}`),mixed=binary(`mixed${r}`,1,'separation');
  constraint(`linkT${r}`,[...time,term(hasT,-cap)],G.GLP_UP,0,0);constraint(`linkN${r}`,[...noTime,term(hasN,-cap)],G.GLP_UP,0,0);
  constraint(`mixedRoom${r}`,[term(hasT),term(hasN),term(mixed,-1),...isolationFlags.map(z=>term(z,-1))],G.GLP_UP,0,1);
  if(!allowMixedGrades){
   const flags=[];for(const grade of new Set(v.map(v=>groups[v.g].grade))){const z=binary(`grade${r}_${grade}`);flags.push(term(z));constraint(`gradeLink${r}_${grade}`,[...v.filter(v=>groups[v.g].grade===grade).map(v=>term(v.name)),term(z,-cap)],G.GLP_UP,0,0);}
   if(flags.length)constraint(`oneGrade${r}`,flags,G.GLP_UP,0,1);
  }
  // Balance and staying home are optimized only after fixing the best time separation.
  const slots=[];
  for(let k=1;k<=cap;k++){const name=`slot${r}_${k}`;slots.push(term(name,-1));lp.bounds.push({name,type:G.GLP_DB,lb:0,ub:1});cost(name,(2*k-1)*4);}
  constraint(`loadCost${r}`,[...load,...slots],G.GLP_FX,0,0);
 }
 lp.objective.vars=objectives.layout;
 return {lp,groups,variables,objectives};
}

// Solve priorities separately and lock each optimum before considering the next one.
// No number of home-class moves or load improvements can buy another mixed room.
async function solvePriorities(model,glpk,timeLimit){
 const deadline=performance.now()+timeLimit*1000,priorities=Object.entries(model.objectives).filter(([,vars])=>vars.length);
 if(!priorities.length)priorities.push(['feasibility',[]]);
 let best=null;
 for(let i=0;i<priorities.length;i++){
  const [name,vars]=priorities[i],remaining=(deadline-performance.now())/1000;
  if(remaining<=0&&best)return {solved:best,optimal:false,timedOut:true};
  model.lp.objective.vars=vars;
  const response=await glpk.solve(model.lp,{msglev:glpk.GLP_MSG_OFF,presol:true,tmlim:Math.max(.001,remaining),mipgap:0}),solved=response.result||response;
  if(![glpk.GLP_OPT,glpk.GLP_FEAS].includes(solved.status))return {solved:best||solved,optimal:false,timedOut:!!best||solved.status!==glpk.GLP_NOFEAS};
  best=solved;
  if(solved.status!==glpk.GLP_OPT)return {solved,optimal:false,timedOut:true};
  if(i<priorities.length-1){
   const value=Math.round(vars.reduce((sum,v)=>sum+v.coef*(solved.vars[v.name]||0),0));
   model.lp.subjectTo.push({name:`priority_${name}`,vars,bnds:{type:glpk.GLP_FX,lb:value,ub:value}});
  }
 }
 return {solved:best,optimal:true,timedOut:false};
}
export function audit(students,rooms,assignments,{allowMixedGrades=false,directives=[]}={}){
 const errors=[],seen=new Set(),map=new Map(rooms.map(r=>[r.id,r]));
 for(const [roomId,keys]of Object.entries(assignments)){
  const r=map.get(roomId);if(!r){errors.push('חדר לא מוכר');continue;}
  const members=keys.map(k=>students.find(s=>s.key===k));
  if(keys.length>r.capacity)errors.push(`חריגה מקיבולת ${r.name}`);
  if((r.type==='fixed'||r.type==='closed')&&keys.length>0&&keys.length!==students.filter(s=>s.grade===r.grade&&s.classroom===r.classroom).length)errors.push(`הכיתה הסגורה ${r.name} חייבת להיבחן כיחידה שלמה`);
  if(members.some(s=>s&&effective(s).small)&&keys.length>r.smallCapacity)errors.push(`כיתה מצומצמת חורגת מקיבולתה בחדר ${r.name}`);
  if(r.smallOnly&&keys.length>r.smallCapacity)errors.push(`חריגה מקיבולת חדר מצומצם ${r.name}`);
  if(!allowMixedGrades&&new Set(members.filter(Boolean).map(s=>s.grade)).size>1)errors.push(`ערבוב שכבות בחדר ${r.name}`);
  const social=new Map();for(const s of members){if(!s){errors.push('תלמיד לא מוכר');continue;}if(seen.has(s.key))errors.push(`תלמיד כפול: ${s.name}`);seen.add(s.key);if(!eligible(s,r,{allowMixedGrades,directives}))errors.push(`חדר לא מתאים: ${s.name}`);if(r.type==='regular'&&!effective(s).time){const key=classLabel(s);social.set(key,(social.get(key)||0)+1);}}
  for(const [key,count]of social)if(count<4)errors.push(`${r.name}: קבוצה של ${count} תלמידים ללא תוספת זמן מ־${key}`);
  errors.push(...auditDirectives(members.filter(Boolean),r,directives,students));
 }
 return {errors,missing:students.filter(s=>!seen.has(s.key))};
}
export async function allocate(allStudents,allRooms,glpk,options={}){
 const students=allStudents.filter(s=>s.active),rooms=allRooms.filter(r=>r.enabled),errors=validateRooms(allRooms);
 errors.push(...validateDirectives(options.directives??[],students,options));
 if(!students.length)errors.push('אין תלמידים פעילים לשיבוץ');
 for(const s of students){for(const problem of validateStudent(s))errors.push(`${s.name||s.key}: ${problem}`);if((s.issues||[]).some(i=>!i.resolution))errors.push(`${s.name}: יש תאים שממתינים להכרעה`);}
 if(students.some(s=>s.classroom===7&&![10,11].includes(s.grade)))errors.push('יש תלמידי כיתה 7 בשכבה שטרם הוגדרו לה כללים. י׳7 וי״א7 מוגדרות ככיתות סגורות; נדרשת הנחיה לשכבה הנוספת');
 const ids=new Set();for(const s of students){if(ids.has(s.id))errors.push('תעודת זהות כפולה; יש לתקן לפני השיבוץ');ids.add(s.id);}
 if(errors.length)return {complete:false,assignments:{},unassigned:students.map(s=>({key:s.key,reason:errors.join('; ')})),errors};
 const solve=async partial=>{
  const model=buildModel(students,rooms,glpk,{...options,partial});
  return {model,...await solvePriorities(model,glpk,options.timeLimit??20)};
 };
 let {model,solved,optimal,timedOut}=await solve(false),fullFeasible=[glpk.GLP_OPT,glpk.GLP_FEAS].includes(solved.status);
 if(!fullFeasible){const partial=await solve(true);({model,solved,optimal}=partial);timedOut||=partial.timedOut;}
 const assignments={},cursors=new Map();
 if([glpk.GLP_OPT,glpk.GLP_FEAS].includes(solved.status))for(const v of model.variables){
  const amount=Math.round(solved.vars[v.name]||0);if(!amount)continue;
  const start=cursors.get(v.g)||0,members=model.groups[v.g].students.slice(start,start+amount);cursors.set(v.g,start+amount);(assignments[rooms[v.r].id]??=[]).push(...members.map(s=>s.key));
 }
 const checked=audit(students,rooms,assignments,options);
 if(checked.errors.length)throw new Error(`בדיקת תקינות פנימית נכשלה: ${checked.errors.join('; ')}`);
 const unassigned=checked.missing.map(s=>({key:s.key,reason:diagnose(s,students,rooms,{...options,timedOut})}));
 return {assignments,complete:unassigned.length===0,unassigned,errors:unassigned.length?['לא נמצא שיבוץ מלא. התוצאה המוצגת היא הצעת שיבוץ חלקית בלבד',...(options.directives?.length?['הנחיות השיבוץ המיוחדות נשמרו גם בהצעה החלקית. יש לבדוק את מספר הנבחנים בכל כיתה ואת זמינות החדרים, או לערוך הנחיה ולחשב מחדש']:[])]:[],optimal,timedOut,stats:{assigned:students.length-unassigned.length,unassigned:unassigned.length,atHome:students.filter(s=>Object.entries(assignments).some(([id,keys])=>keys.includes(s.key)&&rooms.find(r=>r.id===id).grade===s.grade&&rooms.find(r=>r.id===id).classroom===s.classroom)).length}};
}
export function diagnose(s,students,rooms,{timedOut=false,directives=[],allowMixedGrades=false}={}){
 const e=effective(s),eligibleRooms=rooms.filter(r=>eligible(s,r,{allowMixedGrades,directives}));
 if(s.grade===11&&s.classroom===7){
  const count=students.filter(t=>t.grade===11&&t.classroom===7).length,room=rooms.find(r=>r.type==='closed'&&r.grade===11&&r.classroom===7);
  if(!room)return 'יש לפתוח את חדר י״א7: הכיתה נבחנת כקבוצה סגורה ואינה מתפצלת לחדרים אחרים';
  if(students.some(t=>t.grade===11&&t.classroom===7&&effective(t).computer)&&!room.computer)return 'י״א7 נבחנת יחד בכיתתה. יש תלמידים הזקוקים למחשב; יש לספק אמצעי מחשב והקראה בחדר י״א7 ולסמן שהציוד זמין';
  const needsSmall=students.some(t=>t.grade===11&&t.classroom===7&&effective(t).small),capacity=needsSmall||room.smallOnly?Math.min(room.capacity,room.smallCapacity):room.capacity;
  return `י״א7 חייבת להיבחן יחד: ${count} תלמידים, וקיבולת החדר לפי הדרישות היא ${capacity}${needsSmall?' בגלל זכאות לכיתה מצומצמת':''}. יש להתאים את הקיבולת והציוד לכל הכיתה; לא יועברו אליה תלמידים אחרים ולא יפוצלו תלמידיה`;
 }
 const pairing=directives.find(d=>pairParticipant(s,d));
 if(!eligibleRooms.length&&pairing)return `${directiveLabel(pairing)}: אין חדר אם פתוח שמתאים לצימוד. יש לפתוח את חדרי האם של שתי הכיתות; חדרים אחרים בשכבה אינם משמשים את הצימוד. אפשר גם לבחור חדר בשיבוץ ידני`;
 if(!eligibleRooms.length)return e.fixed?'יש לפתוח את חדר י׳7 ולוודא אמצעי מחשב והקראה לכיתה כולה':e.computer?'אין חדר מתאים למחשב; פתחו את 319 או מעבדה נוספת':'אין חדר רגיל מתאים לשכבה; הוסיפו חדר או הפעילו חדר קיים';
 if(e.computer&&!e.fixed){const needed=students.filter(t=>effective(t).computer&&!effective(t).fixed&&!(t.grade===11&&t.classroom===7)).length,available=rooms.filter(r=>r.computer&&r.type!=='fixed'&&r.type!=='closed').reduce((n,r)=>n+(r.smallOnly?Math.min(r.capacity,r.smallCapacity):r.capacity),0);if(needed>available)return `${needed} תלמידים זקוקים למחשב, אך בחדרי המחשב הפתוחים יש ${available} מקומות בלבד. חסרים לפחות ${needed-available} מקומות; פתחו מעבדה נוספת או הגדילו קיבולת בחדר מתאים`;
 }
 if(e.small&&eligibleRooms.every(r=>Math.min(r.capacity,r.smallCapacity)<1))return 'חסרה קיבולת מצומצמת בחדר מתאים';
 const directive=directives.find(d=>d.classes.includes(classKey(s)));
 if(directive){
  const timeout=timedOut?' זמן החיפוש הסתיים; אפשר גם להאריך אותו.':'';
  if(directive.type==='pair'&&pairParticipant(s,directive)){
   const counts=directive.classes.map(k=>students.filter(t=>classKey(t)===k&&pairParticipant(t,directive)).length),regular=eligibleRooms.filter(r=>r.type==='regular'&&!r.smallOnly);
   const halves=pairPlan(students,directive).map(p=>`${p.total}: ${p.stay} נשארים ו־${p.exchange} עוברים`).join('; ');
   return `${directiveLabel(directive)}: ${counts.join(' ועוד ')} נבחנים, ${regular.length} חדרי אם פתוחים. חלוקה לחצאים (${halves}). יש לוודא ששני חדרי האם פתוחים ושהקיבולות והקבוצות החברתיות מאפשרות את החצאים, או לבחור חדר ידנית.${timeout}`;
  }
  if(directive.type==='isolate'&&!e.computer)return `${directiveLabel(directive)} שומרת על תלמידי הכיתה שאינם זקוקים למחשב יחד ככל שהקיבולת מאפשרת, עם ובלי תוספת זמן וללא כיתות אחרות. יש לפתוח חדר רגיל מתאים או לבחור חדר ידנית. תלמידים הזקוקים למחשב יכולים לצאת לחדרי מחשבים משותפים.${timeout}`;
 }
 const group=students.filter(t=>t.grade===s.grade&&t.classroom===s.classroom&&!effective(t).time);
 if(!e.time&&group.length<4)return `בכיתת האם יש רק ${group.length} תלמידים ללא תוספת זמן; אי אפשר ליצור קבוצה של ארבעה בחדר רגיל. יש לעדכן את רשימת הנבחנים או להוסיף חדר מתאים מסוג אחר לאחר בדיקה`;
 if(e.fixed){const count=students.filter(t=>effective(t).fixed).length,capacity=Math.max(0,...eligibleRooms.map(r=>r.capacity));return `י׳7 חייבת להיבחן יחד: ${count} תלמידים, והקיבולת הזמינה בחדר הכיתה היא ${capacity}. יש להבטיח קיבולת וציוד לכל הכיתה; לא יפוצלו תלמידים לחדרים אחרים`;}
 if(e.small)return 'השילוב של קיבולת מצומצמת ושאר הדרישות אינו מאפשר שיבוץ בתוצאה זו; הוסיפו חדר מתאים, ובמקרה הצורך חדר מחשבים מצומצם';
 if(timedOut)return 'זמן החיפוש הסתיים בלי פתרון מלא; נסו חיפוש נוסף או האריכו את זמן החישוב. אין כאן הוכחה שאין פתרון';
 return 'אין מקום בתוצאה זו בכפוף לכלל החברתי, הקיבולות וההתאמות; הגדילו קיבולת או הוסיפו חדר מתאים לשכבה ובדקו מחדש';
}
export function reasonFor(s,r,directives=[]){
 const e=effective(s),parts=[];
 if(e.fixed)return 'י׳7 נבחנת בכיתתה כקבוצה סגורה, לפי הוראת בית הספר';
 if(s.grade===11&&s.classroom===7)parts.push('י״א7 נבחנת כקבוצה סגורה בחדרה, ללא תלמידים מכיתות אחרות');
 for(const d of directives.filter(d=>d.classes.includes(classKey(s))))parts.push(d.type==='isolate'?e.computer?'חריג ללא ערבוב: נדרש מחשב, ולכן אפשר להיבחן בחדר מחשבים משותף':'ללא ערבוב: תלמידי הכיתה עם ובלי תוספת זמן נבחנים יחד ככל שהקיבולת מאפשרת':pairParticipant(s,d)?`${directiveLabel(d)}; חצי מהכיתה נשארים וחצי עוברים לחדר האם השני`:'חריג לצימוד: השיבוץ נקבע לפי הצורך במחשב או בכיתה מצומצמת');
 if(e.computer)parts.push('נדרש מחשב בשל הקראה או הקלדה');
 if(e.small)parts.push(`נדרשת כיתה מצומצמת: עד ${r.smallCapacity} נבחנים בסך הכול`);
 if(r.grade===s.grade&&r.classroom===s.classroom)parts.push('נשאר/ה בכיתת האם');
 parts.push(e.time?'תוספת הזמן נלקחה בחשבון בהעדפת ההפרדה':'הכלל החברתי נבדק לפי כיתת האם');
 return parts.join(' · ');
}

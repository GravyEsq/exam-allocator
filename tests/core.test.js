import test from 'node:test';
import assert from 'node:assert/strict';
import {createRequire} from 'node:module';
import {clean,headerKey,gradeOf,validateStudent} from '../src/normalize.js';
import {parseRows,dataProblems,refreshImportedRules} from '../src/importer.js';
import {interpretCell,effective,accommodationText} from '../src/rules.js';
import {candidates,matchLines} from '../src/matching.js';
import {defaultRooms,ensureGrade11Class7Room} from '../src/rooms.js';
import {allocate,audit} from '../src/allocator.js';
import {reportHTML,assignmentCSV} from '../src/reports.js';
const require=createRequire(import.meta.url),glpk=require('../vendor/glpk-node.cjs')();
const make=(n,{grade=11,classroom=1,typing=false,reading=false,time=0,small=false}={})=>Array.from({length:n},(_,i)=>({key:`${grade}:${classroom}:${typing}:${small}:${time}:${i}`,id:String(800000000+(grade-10)*1000000+classroom*10000+i),name:`תלמיד פיקטיבי ${classroom} ${i}`,grade,classroom,active:true,manual:{accommodations:{}},issues:[],original:{sheet:'פיקטיבי',row:i+2,identity:{},accommodations:Object.entries({typing,reading,time,small}).filter(([,v])=>v).map(([kind,amount])=>({kind,amount,source:{type:'excel',column:kind,value:'X'}})),excluded:[]}}));
const pc=(id,capacity=38,smallCapacity=15)=>({id,name:id,type:'computer',enabled:true,computer:true,capacity,smallCapacity,grade:null,classroom:null});
const regular=(id,classroom=1,capacity=38)=>({id,name:id,type:'regular',enabled:true,computer:false,capacity,smallCapacity:Math.min(15,capacity),grade:11,classroom});
test('normalizes headers, Hebrew quotes, whitespace and niqqud without losing word boundaries',()=>{assert.equal(headerKey(' ת.ז\n'),'תז');assert.equal(headerKey('הקלדה – אנגלית'),'הקלדהאנגלית');assert.equal(gradeOf('י״א'),11);assert.equal(clean('שָׁלוֹם־דָּן'),'שלום-דן');});
test('finds headers after title rows and handles reordered/extra columns',()=>{const {students,headerRow}=parseRows([['כותרת'],[],['כיתה','שם התלמיד','חדש','שכבה','ת.ז','תוספת זמן - 25%'],[2,'פיקטיבי ישראלי','X','יא','001234567','X']]);assert.equal(headerRow,3);assert.equal(students[0].id,'001234567');assert.equal(effective(students[0]).time,25);assert.equal(students[0].issues.length,1);assert.equal(dataProblems(students).length,1);});
test('missing and duplicate identifying columns are rejected',()=>{assert.throws(()=>parseRows([['שם התלמיד'],['שם']]),/כותרות/);assert.throws(()=>parseRows([['ת.ז','ת.ז','שם התלמיד','שכבה','כיתה']]),/כפולה/);});
test('time alone and enlargement alone never grant computer eligibility',()=>{assert.equal(effective(make(1,{time:25})[0]).computer,false);const s=make(1)[0];s.original.accommodations.push({kind:'enlarged',amount:true,source:{type:'excel'}});assert.equal(effective(s).computer,false);});
test('English typing column never grants Hebrew typing even with Hebrew cell note',()=>{assert.equal(interpretCell('הקלדה - אנגלית','X (עברית)',11).status,'excluded');});
test('iTest verbose subjects cancels typing and does not grant a computer',()=>{const a=interpretCell('הקלדה','X (בitest רבי מלל)',11);assert.equal(a.status,'excluded');const s=make(1,{time:25})[0];assert.equal(effective(s).computer,false);});
test('English reading, mathematics, verbose and low text adaptations are excluded',()=>{for(const h of ['הקראה באנגלית','מבחן מותאם במתמטיקה','הקלדה - רבי מלל'])assert.equal(interpretCell(h,'X',11).status,'excluded');assert.equal(interpretCell('הקראת שאלון - דלי מלל','X',11).status,'excluded');});
test('generic X typing and reading grant eligibility under the updated policy',()=>{for(const h of ['הקלדה','הקראת שאלון'])assert.equal(interpretCell(h,'X',11).status,'granted');assert.equal(interpretCell('הקלדה בעברית','X',11).status,'granted');});
test('negative and limiting notes are not automatic eligibility',()=>{for(const value of ['H (לא)','X (אין)','H (ללא)'])assert.equal(interpretCell('הקלדה',value,11).status,'excluded');assert.equal(interpretCell('הקלדה בעברית','X (לא זכאי)',11).status,'excluded');assert.equal(interpretCell('תוספת זמן 25%','H',11).status,'granted');assert.equal(interpretCell('תוספת זמן 25%','X (באופן זמני עד אפריל)',11).status,'granted');assert.equal(interpretCell('הקלדה בעברית','X (במבחנים באנגלית בלבד)',11).status,'excluded');});
test('unknown positive columns require review and cannot grant eligibility',()=>{assert.equal(interpretCell('זכאות חדשה','X',11).status,'review');assert.equal(interpretCell('זכאות חדשה','',11).status,'empty');});
test('original 25 and 33 percent values are preserved separately in provenance',()=>{const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','תוספת זמן 25%','תוספת זמן 33%'],['001234567','שם פיקטיבי','יא',1,'X','X']]);assert.equal(effective(students[0]).time,33);assert.deepEqual(students[0].original.accommodations.map(a=>a.amount),[25,33]);});
test('grade 10 never gets a small class from either Excel or manual changes',()=>{assert.equal(interpretCell('כיתה מצומצמת','X',10).status,'excluded');const s=make(1,{grade:10,small:true})[0];s.manual.accommodations.small=true;assert.equal(effective(s).small,false);});
test('differential grants computer, never small automatically, and supervisor details stay exact',()=>{const s=make(1,{time:33})[0];s.differential={enabled:true,line:'שם לדוגמה'};const e=effective(s);assert.equal(e.computer,true);assert.equal(e.small,false);assert.equal(e.time,33);assert.equal(accommodationText(s,{supervisor:true}),'תוספת זמן, הקראה, הקלדה');});
test('differential with no approved time percentage does not invent one',()=>{const s=make(1)[0];s.manual.differential=true;assert.equal(effective(s).time,'unspecified');assert.match(accommodationText(s),/טעון השלמה/);});
test('grade 10 classroom 7 always has fixed entitlements and cannot be manually revoked',()=>{const s=make(1,{grade:10,classroom:7})[0];s.manual={differential:false,accommodations:{typing:false,reading:false,small:true}};assert.equal(effective(s).fixed,true);assert.equal(effective(s).computer,true);assert.equal(effective(s).small,false);});
test('immigrant removal removes its own source only and questionnaire only in grade 11',()=>{const s=make(1,{time:33,typing:true})[0];s.manual.immigrant='C';assert.equal(effective(s).questionnaire,'11264');assert.equal(effective(s).time,33);s.manual.immigrant=null;assert.equal(effective(s).time,33);assert.equal(effective(s).typing,true);for(const grade of [10,12]){s.grade=grade;s.manual.immigrant='A';assert.equal(effective(s).questionnaire,null);}});
test('same name in multiple records demands a decision; no auto assignment to everyone',()=>{const ss=make(2);ss.forEach(s=>s.name='דני ישראלי');const m=matchLines('דני ישראלי',ss)[0];assert.equal(m.status,'pending');assert.equal(m.selected,null);assert.equal(m.candidates.length,2);});
test('name order, punctuation, niqqud and missing middle names are supported without spelling guesses',()=>{const ss=make(1);ss[0].name='שרה־מרים כהן';assert.equal(candidates('כֹּהֵן שרה מרים',ss).length,1);assert.equal(candidates('כהן שרה',ss).length,1);assert.equal(candidates('כוהן שרה',ss).length,0);assert.equal(matchLines('כהן שרה',ss)[0].status,'pending');assert.equal(matchLines('שם משכבה אחרת',ss)[0].status,'notfound');});
test('classrooms 5 and 6 have base minus ten capacity',()=>{const r=defaultRooms([10]);assert.deepEqual(r.filter(r=>r.type==='regular').map(r=>r.capacity),[38,38,38,38,28,28]);});
test('40 computer students balance 20-20, and no third lab is opened',async()=>{const ss=make(40,{typing:true,time:25}),rooms=[pc('319'),pc('M-12'),pc('M-13')],r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);assert.deepEqual(Object.values(r.assignments).map(a=>a.length).sort((a,b)=>a-b),[20,20]);assert.equal(audit(ss,rooms,r.assignments).errors.length,0);});
test('one computer room suffices when all computer pupils fit',async()=>{const r=await allocate(make(20,{typing:true}),[pc('319'),pc('M-12')],glpk);assert.equal(r.complete,true);assert.equal(Object.keys(r.assignments).length,1);});
test('computer and small class requirements are jointly satisfied using total room population',async()=>{const ss=[...make(8,{typing:true,small:true,time:25}),...make(15,{classroom:2,typing:true,time:25})],rooms=[pc('319'),pc('M-12')],r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);for(const [id,keys]of Object.entries(r.assignments))if(keys.some(k=>ss.find(s=>s.key===k).original.accommodations.some(a=>a.kind==='small')))assert.ok(keys.length<=rooms.find(r=>r.id===id).smallCapacity);});
test('social minimum prevents silent allocation of 1-3 students in regular rooms',async()=>{const ss=make(3),rooms=[regular('A')],r=await allocate(ss,rooms,glpk);assert.equal(r.complete,false);assert.equal(r.unassigned.length,3);assert.equal(Object.values(r.assignments).flat().length,0);assert.match(r.unassigned[0].reason,/רק 3/);});
test('joint solver finds a solution when a home-first greedy allocation would block groups',async()=>{const ss=[...make(6),...make(4,{classroom:2})],rooms=[regular('A',1,5),regular('B',2,6)],r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);assert.equal(r.stats.assigned,10);assert.equal(audit(ss,rooms,r.assignments).errors.length,0);});
test('grade-10 classroom-7 stays complete and isolated, no others can enter',async()=>{const ss=[...make(5,{grade:10,classroom:7,time:25}),...make(4,{grade:10,classroom:1})],rooms=defaultRooms([10]),r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);assert.equal(r.assignments.g10c7.length,5);assert.ok(r.assignments.g10c7.every(k=>ss.find(s=>s.key===k).classroom===7));rooms.find(r=>r.id==='g10c7').capacity=4;rooms.find(r=>r.id==='g10c7').smallCapacity=4;const bad=await allocate(ss,rooms,glpk);assert.equal(bad.complete,false);assert.equal(bad.unassigned.filter(u=>ss.find(s=>s.key===u.key).classroom===7).length,5);});
test('all active students appear exactly once, excluded students do not appear',async()=>{const ss=[...make(12),...make(8,{classroom:2,time:25})];ss[0].active=false;const rooms=[regular('A',1),regular('B',2)],r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);const keys=Object.values(r.assignments).flat();assert.equal(keys.length,19);assert.equal(new Set(keys).size,19);assert.ok(!keys.includes(ss[0].key));});
test('separate-grade mode does not double book a shared computer room',async()=>{const ss=[...make(5,{grade:10,typing:true,time:25}),...make(5,{grade:11,typing:true,time:25})],rooms=[pc('319')];const separate=await allocate(ss,rooms,glpk,{allowMixedGrades:false});assert.equal(separate.complete,false);const joint=await allocate(ss,rooms,glpk,{allowMixedGrades:true});assert.equal(joint.complete,true);});
test('duplicate IDs and unsupported grade-7 policy block allocation',async()=>{const ss=make(4);ss[1].id=ss[0].id;assert.equal((await allocate(ss,[regular('A')],glpk)).complete,false);assert.equal((await allocate(make(4,{grade:12,classroom:7}),[{...regular('A',7),grade:12}],glpk)).complete,false);});
test('reports restrict each document to one grade, show only public student information, and escape HTML',()=>{const ss=make(8,{time:25});ss[0].name='<script>פיקטיבי</script>';const room=regular('A'),r={complete:true,assignments:{A:ss.map(s=>s.key)}};const students=reportHTML('students',11,ss,[room],r);assert.ok(!students.includes('25%'));assert.ok(students.includes('&lt;script&gt;'));assert.ok(!students.includes('תאריך'));assert.equal((students.match(/class="sheet"/g)||[]).length,1);assert.throws(()=>reportHTML('students',null,ss,[room],r));const csv=assignmentCSV(ss,[room],r);assert.ok(csv.startsWith('\uFEFF'));assert.ok(csv.includes(ss[0].id));});
test('independent audit detects missing, duplicates, capacity and social violations',()=>{const ss=make(5),rooms=[regular('A',1,4)];const r=audit(ss,rooms,{A:[ss[0].key,ss[0].key,...ss.slice(1).map(s=>s.key)]});assert.ok(r.errors.length>=2);assert.equal(audit(ss,rooms,{A:[ss[0].key]}).missing.length,4);});

test('apostrophes inside names are ignored rather than splitting a name',()=>{const ss=make(1);ss[0].name="ג׳ורג׳ כהן";assert.equal(candidates('כהן גורג',ss).length,1);});

test('X and H are equivalent markers across column rules, restrictions and grade rules',()=>{
 const headers=['תוספת זמן 25%','תוספת זמן 33%','הקלדה בעברית','הקראה בעברית','הקלדה','הקראת שאלון','הגדלת שאלון','כיתה מצומצמת','מבחן מותאם בעברית','התעלמות משגיאות כתיב','הקלדה - אנגלית','הקראת שאלון - דלי מלל','עמודה לא מוכרת'];
 for(const grade of [10,11])for(const header of headers)for(const note of ['',' (עברית)',' (בitest רבי מלל)',' (לא זכאי)',' (באופן זמני עד אפריל)',' (אנגלית בלבד)']){
  const x=interpretCell(header,'X'+note,grade),h=interpretCell(header,'H'+note,grade);
  for(const key of ['status','reason','kind','amount'])assert.deepEqual(h[key],x[key],`${header}: ${key}, ${note}, ${grade}`);
  assert.equal(h.source.value,'H'+note);
 }
 assert.equal(interpretCell('הקלדה בעברית','h',11).status,'granted');
 assert.equal(interpretCell('הקלדה בעברית','HH',11).status,'review');
});
test('H imports time and Hebrew typing while preserving the original Excel value',()=>{
 const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','תוספת זמן 33%','הקלדה בעברית'],['001234567','שם פיקטיבי','יא',1,'H',''],['001234568','שם בדיקה','יא',2,'','H']]);
 assert.equal(effective(students[0]).time,33);assert.equal(effective(students[0]).computer,false);assert.equal(effective(students[1]).typing,true);assert.equal(effective(students[1]).computer,true);assert.equal(students[0].original.accommodations[0].source.value,'H');assert.equal(dataProblems(students).length,0);
});
test('spelling adaptation activates only for an immigrant with an explicit source, preserving that source when status is removed',()=>{
 const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','התעלמות משגיאות כתיב'],['001234567','שם פיקטיבי','יא',1,'H']]);
 const s=students[0];assert.equal(dataProblems(students).length,0);assert.equal(effective(s).spelling,false);assert.match(effective(s).exclusions.join(' '),/לעולים בלבד/);
 assert.equal(s.original.accommodations[0].source.value,'H');
 for(const level of ['A','B','C']){s.manual.immigrant=level;assert.equal(effective(s).spelling,true);}
 s.manual.immigrant=null;assert.equal(effective(s).spelling,false);assert.equal(s.original.accommodations[0].source.value,'H');
 s.manual.immigrant='B';assert.equal(effective(s).spelling,true);
 const noSource=make(1)[0];noSource.manual.immigrant='B';assert.equal(effective(noSource).spelling,false);
});
test('non-immigrants cannot get spelling through a manual override, review, differential status or grade-10 class 7',()=>{
 for(const s of [make(1)[0],make(1,{grade:10,classroom:7})[0]]){
  s.manual.differential=true;s.manual.accommodations.spelling=true;
  s.issues.push({kind:'spelling',amount:true,resolution:'grant',source:{type:'excel',value:'X'}});
  assert.equal(effective(s).spelling,false);assert.equal(effective(s).computer,true);
  s.manual.immigrant='C';assert.equal(effective(s).spelling,true);
 }
 const s=make(1)[0];s.manual.differential=true;assert.equal(effective(s).spelling,false);
 s.manual.immigrant='C';assert.equal(effective(s).spelling,false);
});
test('hearing companion columns are excluded for X and H and do not need review or grant a computer',()=>{
 for(const header of ['מלווה ללקוי שמיעה','מלווה לתלמידי שמע','מלווה לתלמידים לקויי שמיעה'])for(const value of ['X','H','H (עברית)']){
  const a=interpretCell(header,value,11);assert.equal(a.status,'excluded');assert.match(a.reason,/אינו התאמה רלוונטית/);
  const {students,unknown}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה',header],['001234567','שם פיקטיבי','יא',1,value]]);
  assert.equal(unknown.length,0);assert.equal(dataProblems(students).length,0);assert.equal(effective(students[0]).computer,false);assert.equal(students[0].original.excluded.length,1);
 }
});
test('ordinary positive notes on known accommodations do not create review blockers',()=>{
 for(const value of ['X','H','X (על סמך אבחון קשב)','H (באופן זמני עד אפריל, ולאחר מכן ישקל מחדש.)','X (השמעה נוספת במבחנים עם קטעי שמיעה)','H (זכאי להקליד בשיעורים ובמבחנים בלפטופ.)','X (לא נדרש אבחון)','H (ללא אבחון)','X (לכל מקצוע)','H (בכל המקצועות)']){
  assert.equal(interpretCell('הקלדה',value,11).status,'granted',value);
  assert.equal(interpretCell('תוספת זמן 33%',value,11).amount,33);
 }
 const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','הקלדה','הקראת שאלון'],['001234567','שם פיקטיבי','יא',1,'H (זכאי להקליד בשיעורים ובמבחנים בלפטופ.)','X']]);
 assert.equal(dataProblems(students).length,0);assert.equal(effective(students[0]).typing,true);assert.equal(effective(students[0]).reading,true);assert.equal(effective(students[0]).computer,true);
});
test('scoped notes for other subjects or text groups are excluded unless Hebrew is explicitly included',()=>{
 for(const note of ['דלי מלל','בitest רבי מלל','במקצועות מתמטיקה ופיזיקה','אנגלית בלבד','מקצועות מדעיים','לרבי מלל ולא לעברית','לכל המקצועות למעט עברית','מקצועות שאינם כוללים עברית'])assert.equal(interpretCell('הקלדה',`H (${note})`,11).status,'excluded',note);
 for(const note of ['עברית ואנגלית','לרבי מלל ולעברית','דלי מלל ולשון','במקצועות עברית ואנגלית','לא באנגלית'])assert.equal(interpretCell('הקלדה',`X (${note})`,11).status,'granted',note);
 assert.equal(interpretCell('הקלדה - עברית ואנגלית','H',11).status,'granted');
 assert.equal(interpretCell('הקראת שאלון - רבי מלל ולשון','H',11).status,'granted');
});
test('low-text and verbose columns do not create pending issues or computer eligibility',()=>{
 const {students,unknown}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','הקראת שאלון - דלי מלל','הקלדה - רבי מלל'],['001234567','שם פיקטיבי','יא',1,'H','X']]);
 assert.equal(unknown.length,0);assert.equal(dataProblems(students).length,0);assert.equal(students[0].original.excluded.length,2);assert.equal(effective(students[0]).computer,false);
});
test('restoring old pending source decisions applies updated rules while preserving identity and manual overrides',()=>{
 const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','הקלדה','הקראת שאלון - דלי מלל'],['001234567','שם פיקטיבי','יא',1,'H (על סמך אבחון קשב)','X']]);
 const s=students[0];s.manual.accommodations.time=33;s.original.accommodations=[];s.original.excluded=[];s.issues=[{key:s.key+':4',kind:'typing',resolution:null,source:{column:'הקלדה',value:'H (על סמך אבחון קשב)'}},{key:s.key+':5',kind:'review',resolution:null,source:{column:'הקראת שאלון - דלי מלל',value:'X'}}];
 assert.equal(refreshImportedRules(students),true);assert.equal(dataProblems(students).length,0);assert.equal(effective(s).typing,true);assert.equal(effective(s).time,33);assert.equal(s.id,'001234567');assert.equal(s.original.excluded.length,1);assert.equal(refreshImportedRules(students),false);
});
test('explicit prior review decisions survive refresh, but cannot override an excluded subject source',()=>{
 const {students}=parseRows([['ת.ז','שם התלמיד','שכבה','כיתה','הקלדה','הקראת שאלון - דלי מלל'],['001234567','שם פיקטיבי','יא',1,'X','H']]);
 const s=students[0];s.original.accommodations=[];s.issues=[{key:s.key+':4',kind:'typing',resolution:'ignore',source:{column:'הקלדה',value:'X'}},{key:s.key+':5',kind:'reading',resolution:'grant',source:{column:'הקראת שאלון - דלי מלל',value:'H'}}];
 refreshImportedRules(students);assert.equal(effective(s).typing,false);assert.equal(effective(s).reading,false);assert.equal(s.issues.length,1);assert.equal(s.issues[0].resolution,'ignore');assert.equal(dataProblems(students).length,0);
});
test('grade-11 class 7 has a closed room of 38, stays together, excludes outsiders and grants no extra accommodations',async()=>{
 const ss=[...make(2,{classroom:7}),...make(4)],rooms=defaultRooms([11]),room=rooms.find(r=>r.id==='g11c7');
 assert.equal(room.type,'closed');assert.equal(room.capacity,38);
 assert.equal(effective(ss[0]).differential,false);assert.equal(effective(ss[0]).computer,false);assert.equal(effective(ss[0]).time,0);
 const r=await allocate(ss,rooms,glpk);assert.equal(r.complete,true);assert.equal(r.assignments.g11c7.length,2);assert.ok(r.assignments.g11c7.every(k=>ss.find(s=>s.key===k).classroom===7));assert.equal(audit(ss,rooms,r.assignments).errors.length,0);
});
test('grade-11 class 7 needs its computer accommodations inside its own room and never splits',async()=>{
 const ss=[...make(1,{classroom:7,typing:true,time:25}),...make(1,{classroom:7,time:33}),...make(4)],rooms=defaultRooms([11]);
 ss[1].id='899999998';
 const unavailable=await allocate(ss,rooms,glpk);assert.equal(unavailable.complete,false);assert.equal(unavailable.unassigned.filter(u=>ss.find(s=>s.key===u.key).classroom===7).length,2);assert.match(unavailable.unassigned[0].reason,/ציוד|מחשב/);
 rooms.find(r=>r.id==='g11c7').computer=true;
 const ready=await allocate(ss,rooms,glpk);assert.equal(ready.complete,true);assert.equal(ready.assignments.g11c7.length,2);assert.equal(Object.values(ready.assignments).flat().length,6);
});
test('grade-11 class 7 respects total capacity and any independently granted small-class requirement',async()=>{
 const rooms=defaultRooms([11]);const tooMany=await allocate(make(39,{classroom:7,time:25}),rooms,glpk);assert.equal(tooMany.complete,false);assert.equal(tooMany.unassigned.length,39);assert.ok(!tooMany.assignments.g11c7);
 const ss=[...make(1,{classroom:7,small:true,time:33}),...make(15,{classroom:7,time:25})];ss[0].id='899999997';
 const small=await allocate(ss,rooms,glpk);assert.equal(small.complete,false);assert.equal(small.unassigned.length,16);assert.match(small.unassigned[0].reason,/מצומצמת/);
 const ready=await allocate(ss.slice(0,15),rooms,glpk);assert.equal(ready.complete,true);assert.equal(ready.assignments.g11c7.length,15);
});
test('closed-class audit rejects a partial class or outsiders even when room capacity is sufficient',()=>{
 const ss=[...make(2,{classroom:7}),...make(4)],rooms=defaultRooms([11]);
 assert.ok(audit(ss,rooms,{g11c7:[ss[0].key]}).errors.some(x=>x.includes('יחידה שלמה')));
 assert.ok(audit(ss,rooms,{g11c7:[ss[0].key,ss[2].key]}).errors.some(x=>x.includes('לא מתאים')));
});
test('old room settings gain the grade-11 class-7 room while preserving existing edits',()=>{
 const rooms=defaultRooms([11]).filter(r=>r.id!=='g11c7');rooms[0].capacity=29;
 assert.equal(ensureGrade11Class7Room(rooms,[11]),true);assert.equal(rooms[0].capacity,29);assert.equal(rooms.find(r=>r.id==='g11c7').capacity,38);assert.equal(ensureGrade11Class7Room(rooms,[11]),false);
 const custom=[{id:'custom',name:'יא 7',grade:11,classroom:null,type:'regular',capacity:28,smallCapacity:14,computer:true,enabled:false}];
 assert.equal(ensureGrade11Class7Room(custom,[11]),true);assert.equal(custom.length,1);assert.equal(custom[0].type,'closed');assert.equal(custom[0].classroom,7);assert.equal(custom[0].capacity,28);assert.equal(custom[0].computer,true);assert.equal(custom[0].enabled,false);
});

import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir,writeFile,readFile} from 'node:fs/promises';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 await mkdir('qa',{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto('http://127.0.0.1:4173/exam-allocator/');await page.locator('#xlsx').waitFor();
 const fixture=await page.evaluate(async()=>{
  const {reportHTML,reportRTF}=await import('./src/reports.js'),{defaultRooms}=await import('./src/rooms.js');
  const students=Array.from({length:76},(_,i)=>{
   const grade=[10,11,12][i%3],variant=i%19,time=variant===0?0:variant===2||variant===4||i%2?33:25,kinds=variant>4?['reading','typing','enlarged','small','adapted','spelling']:[];
   return {key:`fictional-${i}`,id:String(960000000+i),name:`מיכל־אביגיל אלכסנדרה בן־דוד ישראלי פיקטיבי ${String(i+1).padStart(2,'0')}`,grade,classroom:i<38?2:6,active:true,manual:{immigrant:variant>4?'C':null,differential:variant===3||variant===4,accommodations:{}},issues:[],original:{sheet:'פיקטיבי',row:i+2,identity:{},excluded:[],accommodations:[...(time?[{kind:'time',amount:time,source:{type:'excel',value:'X'}}]:[]),...kinds.map(kind=>({kind,amount:true,source:{type:'excel',value:'H'}}))]}};
  });
  students[75].name='שם פיקטיבי עם {סוגריים} ו־\\קו לבדיקה 76';
  const rooms=defaultRooms([10,11,12]);for(const room of rooms)room.enabled=false;rooms.push({id:'a',name:'319',capacity:38,smallCapacity:15,type:'computer',computer:true,enabled:true},{id:'b',name:'M-12',capacity:38,smallCapacity:15,type:'computer',computer:true,enabled:true});
  const result={complete:true,assignments:{a:students.slice(0,38).map(s=>s.key),b:students.slice(38).map(s=>s.key)},unassigned:[],errors:[],manualPlacements:[{key:students[0].key,roomId:'a'}],stats:{assigned:76,unassigned:0,atHome:0}};
  return {students,rooms,result,html:Object.fromEntries(['students','supervisor'].map(kind=>[kind,reportHTML(kind,students,rooms,result)])),rtf:Object.fromEntries(['students','supervisor'].map(kind=>[kind,reportRTF(kind,students,rooms,result)]))};
 });
 await writeFile('qa/compact-report-names.json',JSON.stringify(fixture.students.map(s=>s.name)));
 await page.evaluate(({students,rooms,result})=>{localStorage.setItem('exam-allocator-session-v2',JSON.stringify({version:2,allocationPolicy:5,students,rooms,result,grades:[10,11,12],sheets:[{name:'פיקטיבי',headerRow:1,unknown:[]}],fileName:'פיקטיבי בלבד',mode:'joint',directives:[],matches:[],stale:false}));},fixture);
 await page.reload();await page.locator('#restore').click();await page.getByText('העבודה שוחזרה מהמחשב הזה',{exact:true}).waitFor();await page.locator('[data-step="6"]').click();
 for(const kind of ['students','supervisor']){
  const download=page.waitForEvent('download');await page.locator(`#rtf-${kind}`).click();const file=await download;assert.ok(file.suggestedFilename().endsWith('.rtf'));await file.saveAs(`qa/compact-${kind}.rtf`);assert.equal(await readFile(`qa/compact-${kind}.rtf`,'utf8'),fixture.rtf[kind]);
  await page.locator(`#print-${kind}`).click();await page.locator('#do-print:not([disabled])').waitFor();const frame=page.frameLocator('#print-frame');assert.equal(await frame.locator('.sheet').count(),2);assert.equal(await frame.locator('tbody tr').count(),76);const text=await frame.locator('body').innerText();
  for(const name of fixture.students.map(s=>s.name))assert.equal(text.split(name).length-1,1,name);
  assert.ok(!text.includes('סדר הקריאה'));assert.ok(!text.includes('טור ראשון'));assert.ok(!text.includes('מקרא:'));assert.ok(!text.includes('25%'));assert.ok(!text.includes('ללא התאמות'));
  if(kind==='students'){assert.equal(await frame.locator('th').count(),0);assert.equal(await frame.locator('h2').count(),0);assert.ok(!text.includes('33%'));}else {assert.equal(await frame.locator('thead th').count(),12);assert.ok(text.includes('33%'));const first=await frame.locator('tbody tr').filter({hasText:fixture.students[0].name}).locator('td').nth(3).innerText();assert.equal(first,'');}
  await page.locator('#close-dialog').click();const printed=await browser.newPage();await printed.setContent(fixture.html[kind]);await printed.emulateMedia({media:'print'});assert.ok((await printed.locator('.sheet').evaluateAll(nodes=>nodes.map(n=>n.getBoundingClientRect().height))).every(h=>h<1060));await printed.pdf({path:`qa/compact-${kind}.pdf`,format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});await printed.close();
 }
 await page.setViewportSize({width:820,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa/compact-export-tablet.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Compact reports browser QA passed: two full rooms, 76 long fictional names, compact student report, supervisor headers and 33%, empty accommodations, both RTF downloads, tablet and local processing');
}finally{await browser.close();}

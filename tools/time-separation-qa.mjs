import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
import {mkdir} from 'node:fs/promises';
import {effective} from '../src/rules.js';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 await mkdir('qa',{recursive:true});const page=await browser.newPage({viewport:{width:1280,height:1000}}),errors=[],external=[];
 page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>{if(!r.url().startsWith('http://127.0.0.1:4173/')&&!r.url().startsWith('blob:'))external.push(r.url());});
 await page.goto('http://127.0.0.1:4173/exam-allocator/');await page.locator('#xlsx').waitFor();
 const workbook=await page.evaluate(()=>{
  const w=XLSX.utils.book_new(),rows=[['ת.ז','שם התלמיד','שכבה','כיתה','הקלדה','הקראת שאלון','תוספת זמן 25%']];let id=950000000;
  const groups=[[1,14,'','',''],[2,30,'','','X'],[3,8,'','',''],[3,8,'','','X'],[3,4,'H','','X'],[4,4,'','X','X'],[4,12,'','',''],[4,12,'','','X'],[5,12,'','',''],[5,12,'','','X']];
  for(const [c,n,typing,reading,time]of groups)for(let i=0;i<n;i++)rows.push([String(id++),`תלמיד פיקטיבי כיתה ${c} בדיקת הפרדה ${id}`,'יא',c,typing,reading,time]);
  XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'פיקטיבי');return XLSX.write(w,{type:'base64',bookType:'xlsx'});
 });
 await page.locator('#xlsx').setInputFiles({name:'synthetic-time-separation.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});await page.locator('#import').click();
 await page.locator('[data-step="4"]').click();const lab=page.locator('tr').filter({has:page.locator('input[value="319"]')});await lab.locator('[data-prop="capacity"]').fill('8');await lab.locator('[data-prop="capacity"]').dispatchEvent('change');
 await page.locator('[data-step="5"]').click();await page.locator('#add-pair').click();await page.locator('#directive-a').selectOption('11:1');await page.locator('#directive-b').selectOption('11:2');await page.getByRole('button',{name:'שמירת ההנחיה',exact:true}).click();
 await page.locator('#add-isolate').click();await page.locator('#directive-a').selectOption('11:3');await page.getByRole('button',{name:'שמירת ההנחיה',exact:true}).click();
 async function solve(){await page.locator('#solve').click();await page.locator('#solve').waitFor({timeout:45000});await page.getByText('כל 116 הנבחנים שובצו ונבדקו',{exact:true}).waitFor();}
 async function snapshot(){await page.locator('#save').click();await page.locator('#save-session').click();return page.evaluate(()=>JSON.parse(localStorage.getItem('exam-allocator-session-v2')));}
 function check(saved){
  const assignments=saved.result.assignments,members=id=>(assignments[id]||[]).map(k=>saved.students.find(s=>s.key===k));assert.equal(saved.result.complete,true);
  assert.equal(Object.values(assignments).flat().length,116);assert.equal(new Set(Object.values(assignments).flat()).size,116);
  for(const id of ['g11c1','g11c2']){assert.equal(members(id).filter(s=>s.classroom===1).length,7);assert.equal(members(id).filter(s=>s.classroom===2).length,15);}
  assert.equal(members('g11c3').length,16);assert.ok(members('g11c3').every(s=>s.classroom===3));assert.equal(new Set(members('g11c3').map(s=>!!effective(s).time)).size,2);
  assert.equal(members('pc0').length,8);assert.ok(members('pc0').every(s=>effective(s).computer));assert.equal(new Set(members('pc0').map(s=>s.classroom)).size,2);
  for(const id of ['g11c4','g11c5','g11c6'])if(members(id).length)assert.equal(new Set(members(id).map(s=>!!effective(s).time)).size,1,id);
  assert.equal(['g11c4','g11c5','g11c6'].flatMap(members).length,48);
 }
 await solve();let saved=await snapshot();check(saved);assert.equal(saved.result.optimal,true);assert.equal(saved.allocationPolicy,5);await page.screenshot({path:'qa/time-separation-directives.png',fullPage:true});
 // Previously saved results must be recalculated even when their imported rules are unchanged.
 await page.evaluate(()=>{const key='exam-allocator-session-v2',s=JSON.parse(localStorage.getItem(key));s.allocationPolicy=4;localStorage.setItem(key,JSON.stringify(s));});await page.reload();await page.locator('#restore').click();await page.locator('[data-step="5"]').click();await page.getByText('השיבוץ אינו עדכני',{exact:true}).waitFor();await solve();saved=await snapshot();check(saved);assert.equal(saved.result.optimal,true);
 await page.locator('#edit-placements').click();const pupil=saved.students.find(s=>s.classroom===4&&!effective(s).time),original=Object.keys(saved.result.assignments).find(id=>saved.result.assignments[id].includes(pupil.key)),target=Object.keys(saved.result.assignments).find(id=>['g11c4','g11c5','g11c6'].includes(id)&&saved.result.assignments[id].every(k=>effective(saved.students.find(s=>s.key===k)).time));
 await page.locator('#roster-search').fill(pupil.id);await page.locator(`[data-roster-room="${pupil.key}"]`).selectOption(target);await page.locator('#finish-roster').click();await page.getByText('כל 116 הנבחנים משובצים — כולל שיבוץ ידני',{exact:true}).waitFor();await page.locator('[data-undo-manual]').click();saved=await snapshot();check(saved);assert.ok(saved.result.assignments[original].includes(pupil.key));
 await page.setViewportSize({width:820,height:1180});assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth>innerWidth),false);await page.screenshot({path:'qa/time-separation-tablet.png',fullPage:true});
 assert.deepEqual(errors,[]);assert.deepEqual(external,[]);console.log('Time separation browser QA passed: 116 unique pupils; paired halves; isolated mixed-time class; shared computer exceptions; pure-time remaining rooms; policy refresh; manual override/undo; tablet and local processing');
}finally{await browser.close();}

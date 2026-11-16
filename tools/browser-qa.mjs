import {createRequire} from 'node:module';
import fs from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
await fs.mkdir(new URL('../qa/',import.meta.url),{recursive:true});
const browser=await chromium.launch({channel:'msedge',headless:true});
const context=await browser.newContext({viewport:{width:1440,height:1000}}),page=await context.newPage();
try {
const errors=[],requests=[];page.on('pageerror',e=>errors.push(e.message));page.on('request',r=>requests.push(r.url()));
await page.goto('http://127.0.0.1:4173/exam-allocator/');
await page.getByRole('heading',{name:'מתחילים מהתלמידים'}).waitFor();
await page.screenshot({path:fileURLToPath(new URL('../qa/01-upload.png',import.meta.url)),fullPage:true});
await page.locator('#demo').click();await page.locator('[data-step="5"]').click();
await page.locator('#solve').click();await page.locator('#solve').waitFor({timeout:50000});
assert.ok(await page.getByText('כל 144 הנבחנים שובצו ונבדקו',{exact:true}).count());
assert.ok(await page.locator('.room-card').count()>0);
await page.screenshot({path:fileURLToPath(new URL('../qa/02-allocation.png',import.meta.url)),fullPage:true});
await page.locator('[data-step="6"]').click();await page.locator('#print-supervisor').click();
await page.locator('#do-print:not([disabled])').waitFor();assert.ok(await page.frameLocator('#print-frame').locator('.sheet').count()>0);await page.locator('#close-dialog').click();
await page.locator('[data-step="3"]').click();await page.locator('#search').fill('800000000');assert.equal(await page.locator('[data-edit]').count(),1);await page.locator('[data-edit]').click();await page.locator('[name="immigrant"]').selectOption('C');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();await page.getByText('הנתונים השתנו לאחר השיבוץ',{exact:true}).waitFor();await page.locator('[data-step="6"]').click();assert.equal(await page.locator('#csv').isDisabled(),true);
assert.equal(await page.evaluate(()=>localStorage.getItem('exam-allocator-session-v2')),null);
await page.locator('#save').click();assert.equal(await page.evaluate(()=>localStorage.getItem('exam-allocator-session-v2')),null);await page.locator('#save-session').click();assert.ok(await page.evaluate(()=>JSON.parse(localStorage.getItem('exam-allocator-session-v2')).students.length===144));await page.locator('#privacy').click();await page.locator('#delete-session').click();assert.equal(await page.evaluate(()=>localStorage.getItem('exam-allocator-session-v2')),null);await page.locator('#close-dialog').click();
await page.setViewportSize({width:820,height:1180});await page.locator('[data-step="3"]').click();await page.screenshot({path:fileURLToPath(new URL('../qa/03-tablet.png',import.meta.url)),fullPage:true});
await page.setViewportSize({width:1440,height:1000});
if(process.env.QA_SAMPLE_XLSX){await page.locator('[data-step="1"]').click();await page.locator('#xlsx').setInputFiles(process.env.QA_SAMPLE_XLSX);await page.locator('#import').waitFor();const sheets=await page.locator('[data-sheet]').count();assert.equal(sheets,2);await page.locator('#import').click();await page.getByRole('heading',{name:'הקובץ נקלט'}).waitFor();await page.locator('[data-step="3"]').click();assert.ok(await page.locator('[data-edit]').count()>0);console.log('Sample workbook inspected through real browser, 2 sheets detected');}
// Missing-grade rows must remain visible; explicit match decisions and bulk review must work.
const workbook=await page.evaluate(()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['כותרת פיקטיבית'],[],['כיתה','שכבה','ת.ז','שם התלמיד','התאמה לא מוכרת לבדיקה'],[1,'','000000001','אור ישראלי','X'],[1,'יא','000000002','אור ישראלי','X']]),'בדיקה פיקטיבית');return XLSX.write(w,{type:'base64',bookType:'xlsx'});});
await page.locator('[data-step="1"]').click();await page.locator('#xlsx').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});await page.locator('#import').click();await page.locator('#review-import').click();assert.equal(await page.locator('[data-edit]').count(),2);await page.locator('#search').fill('000000001');await page.locator('[data-edit]').click();await page.locator('[name="grade"]').selectOption('11');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();await page.locator('#search').fill('');await page.locator('#bulk-review').click();await page.locator('[data-bulk-kind="0"]').selectOption('typing');await page.locator('[data-bulk-grant="0"]').click();assert.ok(await page.getByText('אושרה התאמה',{exact:false}).count());await page.locator('#close-dialog').click();
await page.locator('[data-step="2"]').click();await page.locator('#txt').setInputFiles({name:'synthetic.txt',mimeType:'text/plain',buffer:Buffer.from('ישראלי אור\nשם לא קיים','utf8')});await page.getByText('נדרשת בחירה',{exact:true}).waitFor();assert.equal(await page.locator('[data-match] option').count(),3);await page.locator('[data-match]').selectOption({index:1});await page.locator('[data-confirm-match]').click();assert.ok(await page.getByText('שויך',{exact:true}).count());assert.ok(await page.getByText('שם לא קיים',{exact:true}).count());
// Synthetic maximal print fixture: two full rooms, long names, rich accommodations.
const fixture=await page.evaluate(async()=>{
 const {reportHTML}=await import('./src/reports.js');
 const students=Array.from({length:76},(_,i)=>({key:`fake${i}`,id:String(900000000+i),name:`מיכל־אביגיל אלכסנדרה בן־דוד ישראלי לדוגמה ${i+1}`,grade:11,classroom:i<38?2:6,active:true,manual:{immigrant:'C',accommodations:{}},issues:[],original:{accommodations:['time','reading','typing','enlarged','small','adapted','spelling'].map(kind=>({kind,amount:kind==='time'?33:true,source:{type:'excel',value:'X'}})),excluded:[]}}));
 students[0].differential={enabled:true};
 const rooms=[{id:'a',name:'319',capacity:38},{id:'b',name:'M-12',capacity:38}],result={complete:true,assignments:{a:students.slice(0,38).map(s=>s.key),b:students.slice(38).map(s=>s.key)}};
 return Object.fromEntries(['students','supervisor'].map(kind=>[kind,reportHTML(kind,11,students,rooms,result)]));
});
for(const [kind,html] of Object.entries(fixture)){
 const p=await context.newPage();await p.setContent(html);await p.emulateMedia({media:'print'});const widths=await p.locator('.sheet').evaluateAll(nodes=>nodes.map(n=>({w:n.getBoundingClientRect().width,h:n.getBoundingClientRect().height})));await p.pdf({path:fileURLToPath(new URL(`../qa/${kind}-38-long-names.pdf`,import.meta.url)),format:'A4',preferCSSPageSize:true,printBackground:true,displayHeaderFooter:false});console.log(kind,widths,await p.locator('tbody tr').first().evaluate(n=>({height:n.getBoundingClientRect().height,cells:[...n.children].map(c=>({w:c.getBoundingClientRect().width,h:c.getBoundingClientRect().height,font:getComputedStyle(c).fontSize,line:getComputedStyle(c).lineHeight,text:c.textContent.length}))})));await fs.writeFile(new URL('../qa/'+kind+'.html',import.meta.url),html);await p.close();
}
assert.deepEqual(errors,[]);assert.ok(requests.every(url=>url.startsWith('http://127.0.0.1:4173/')||url.startsWith('blob:')),'Unexpected network request');
console.log('Browser QA passed: allocation, printing, stale detection, sample import, no external requests',requests.length);
} finally { await browser.close(); }

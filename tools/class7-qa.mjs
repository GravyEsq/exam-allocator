import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/exam-allocator/');await page.locator('#xlsx').waitFor();
 const workbook=await page.evaluate(()=>{const w=XLSX.utils.book_new(),rows=[['ת.ז','שם התלמיד','שכבה','כיתה']];for(let i=0;i<6;i++)rows.push([String(900000000+i),`תלמיד פיקטיבי ${i<4?'רגיל':'שבע'} ${i}`,'יא',i<4?1:7]);XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'בדיקה פיקטיבית');return XLSX.write(w,{type:'base64',bookType:'xlsx'});});
 await page.locator('#xlsx').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});await page.locator('#import').click();await page.locator('[data-step="4"]').click();
 const closed=()=>page.locator('.room-table tbody tr').filter({hasText:'י״א7 · כיתה סגורה'});
 assert.equal(await closed().count(),1);assert.equal(await closed().locator('[data-prop="capacity"]').inputValue(),'38');
 async function solve(){await page.locator('[data-step="5"]').click();await page.locator('#solve').click();await page.locator('#solve').waitFor({timeout:45000});}
 await solve();await page.getByText('כל 6 הנבחנים שובצו ונבדקו',{exact:true}).waitFor();assert.equal(await page.locator('.room-card.closed li').count(),2);assert.ok(!(await page.locator('.room-card.closed').innerText()).includes('פיקטיבי רגיל'));
 await page.locator('#save').click();await page.locator('#save-session').click();
 await page.evaluate(()=>{const key='exam-allocator-session-v2',s=JSON.parse(localStorage.getItem(key));s.rooms=s.rooms.filter(r=>r.id!=='g11c7');s.rooms.find(r=>r.id==='g11c1').capacity=29;localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await page.locator('#restore').click();await page.locator('[data-step="4"]').click();assert.equal(await closed().count(),1);assert.equal(await page.locator('tr').filter({has:page.locator('input[value="י״א1"]')}).locator('[data-prop="capacity"]').inputValue(),'29');
 await solve();await page.getByText('כל 6 הנבחנים שובצו ונבדקו',{exact:true}).waitFor();
 await page.locator('[data-step="3"]').click();await page.locator('#search').fill('900000004');await page.locator('[data-edit]').click();await page.locator('[data-acc="typing"]').selectOption('yes');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();
 await solve();assert.equal(await page.locator('.room-card.closed').count(),0);assert.ok(await page.getByText('מי לא שובץ ומה אפשר לשנות',{exact:true}).count());
 await page.locator('[data-step="4"]').click();await closed().locator('[data-prop="computer"]').check();await solve();await page.getByText('כל 6 הנבחנים שובצו ונבדקו',{exact:true}).waitFor();assert.equal(await page.locator('.room-card.closed li').count(),2);
 assert.deepEqual(errors,[]);console.log('Class-7 browser QA passed: closed 38-seat room, no mixing, legacy settings preserved, computer provided in own room');
}finally{await browser.close();}

import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try{
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/exam-allocator/');await page.locator('#xlsx').waitFor();
 const workbook=await page.evaluate(()=>{const w=XLSX.utils.book_new(),rows=[['ת.ז','שם התלמיד','שכבה','כיתה','תוספת זמן 33%','הקלדה','הקראת שאלון','הקראת שאלון - דלי מלל','הקלדה - רבי מלל']];for(let i=0;i<4;i++)rows.push([String(900000000+i),'שם פיקטיבי '+i,'יא',1,'H (באופן זמני עד אפריל, ולאחר מכן ישקל מחדש.)','H (זכאי להקליד בשיעורים ובמבחנים בלפטופ.)','X','H','X']);XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet(rows),'בדיקה פיקטיבית');return XLSX.write(w,{type:'base64',bookType:'xlsx'});});
 await page.locator('#xlsx').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});await page.locator('#import').click();await page.locator('[data-step="3"]').click();
 assert.equal(await page.getByText('נתוני התלמידים מוכנים לשיבוץ',{exact:true}).count(),1);
 const row=page.locator('#student-list tbody tr').first();assert.match(await row.innerText(),/הקלדה/);assert.match(await row.innerText(),/הקראה/);assert.match(await row.innerText(),/33%/);
 await page.locator('[data-step="5"]').click();await page.locator('#solve').click();await page.locator('#solve').waitFor({timeout:45000});await page.getByText('כל 4 הנבחנים שובצו ונבדקו',{exact:true}).waitFor();
 await page.locator('#save').click();await page.locator('#save-session').click();
 // Only fictitious test state: emulate a saved session produced by the old parser.
 await page.evaluate(()=>{const key='exam-allocator-session-v2',s=JSON.parse(localStorage.getItem(key));for(const student of s.students){student.original.accommodations=student.original.accommodations.filter(a=>!['time','typing'].includes(a.kind));student.original.excluded=student.original.excluded.filter(a=>!a.source.column.includes('דלי'));student.issues=[{key:student.key+':4',kind:'time',amount:33,resolution:null,source:{column:'תוספת זמן 33%',value:student.original.cells[4]}},{key:student.key+':5',kind:'typing',resolution:null,source:{column:'הקלדה',value:student.original.cells[5]}},{key:student.key+':7',kind:'review',resolution:null,source:{column:'הקראת שאלון - דלי מלל',value:'H'}}];}s.students[0].manual.accommodations.enlarged=true;localStorage.setItem(key,JSON.stringify(s));});
 await page.reload();await page.locator('#restore').click();await page.locator('[data-step="3"]').click();assert.equal(await page.getByText('נתוני התלמידים מוכנים לשיבוץ',{exact:true}).count(),1);await page.getByText('הנתונים השתנו לאחר השיבוץ',{exact:true}).waitFor();assert.match(await row.innerText(),/הגדלה/);assert.match(await row.innerText(),/הקלדה/);
 assert.deepEqual(errors,[]);console.log('Scope browser QA passed: generic notes accepted, low/verbose excluded, saved session refreshed, manual data retained, result stale');
}finally{await browser.close();}

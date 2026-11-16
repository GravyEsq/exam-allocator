import {createRequire} from 'node:module';
import assert from 'node:assert/strict';
const require=createRequire(import.meta.url),{chromium}=require(process.env.PLAYWRIGHT_MODULE||'playwright');
const browser=await chromium.launch({channel:'msedge',headless:true});
try {
 const page=await browser.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.goto('http://127.0.0.1:4173/exam-allocator/');
 await page.locator('#xlsx').waitFor();
 const workbook=await page.evaluate(()=>{const w=XLSX.utils.book_new();XLSX.utils.book_append_sheet(w,XLSX.utils.aoa_to_sheet([['ת.ז','שם התלמיד','שכבה','כיתה','תוספת זמן 33%','התעלמות משגיאות כתיב','מלווה ללקוי שמיעה'],['001234567','אור פיקטיבי','יא',1,'H','H','X'],['001234568','שם פיקטיבי','יא',1,'X','','H']]),'בדיקת כללים');return XLSX.write(w,{type:'base64',bookType:'xlsx'});});
 await page.locator('#xlsx').setInputFiles({name:'synthetic.xlsx',mimeType:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',buffer:Buffer.from(workbook,'base64')});
 await page.locator('#import').click();await page.locator('[data-step="3"]').click();
 const first=page.locator('#student-list tbody tr').first(),second=page.locator('#student-list tbody tr').nth(1);
 assert.ok(!(await first.innerText()).includes('התעלמות משגיאות כתיב'));
 await first.locator('[data-edit]').click();assert.equal(await page.locator('[data-acc="spelling"]').isDisabled(),true);
 assert.ok(await page.getByText('הוחרג: מלווה ללקוי שמיעה',{exact:true}).count());
 await page.locator('[name="immigrant"]').selectOption('C');assert.equal(await page.locator('[data-acc="spelling"]').isDisabled(),false);
 await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();assert.ok((await first.innerText()).includes('התעלמות משגיאות כתיב'));
 await first.locator('[data-edit]').click();await page.locator('[name="immigrant"]').selectOption('');assert.equal(await page.locator('[data-acc="spelling"]').isDisabled(),true);await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();assert.ok(!(await first.innerText()).includes('התעלמות משגיאות כתיב'));
 // A manual source remains saved but inactive when immigrant status is removed.
 await second.locator('[data-edit]').click();await page.locator('[name="immigrant"]').selectOption('B');await page.locator('[data-acc="spelling"]').selectOption('yes');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();assert.ok((await second.innerText()).includes('התעלמות משגיאות כתיב'));
 await second.locator('[data-edit]').click();await page.locator('[name="immigrant"]').selectOption('');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();assert.ok(!(await second.innerText()).includes('התעלמות משגיאות כתיב'));
 await second.locator('[data-edit]').click();assert.equal(await page.locator('[data-acc="spelling"]').inputValue(),'yes');await page.locator('[name="immigrant"]').selectOption('B');await page.getByRole('button',{name:'שמירת השינויים',exact:true}).click();assert.ok((await second.innerText()).includes('התעלמות משגיאות כתיב'));
 assert.deepEqual(errors,[]);console.log('Policy browser QA passed: spelling restricted to immigrants, sources preserved, hearing companion excluded');
} finally {await browser.close();}

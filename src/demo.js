import {parseRows} from './importer.js';
export function demoData(){
 const rows=[['ת.ז','שם התלמיד','שכבה','כיתה','תוספת זמן - 25%','הקלדה בעברית','כיתה מצומצמת']];
 const first=['אור','מיקה','נועם','יובל','יעל','איתי','שירה','אמיר','רוני','תמר','ליאור','שחר'];
 const last=['ישראלי','דוגמה','לוי לדוגמה','כהן לדוגמה','אביב','שקד','אלון','גפן'];
 for(let i=0;i<144;i++)rows.push([String(800000000+i),`${first[i%first.length]} ${last[Math.floor(i/first.length)%last.length]} ${i+1}`,11,Math.floor(i/24)+1,i%6===0?'X':'',i%12===0?'X':'','']);
 return {students:parseRows(rows,'נתונים פיקטיביים').students,sheets:[{name:'נתונים פיקטיביים',headerRow:1,unknown:[]}]};
}

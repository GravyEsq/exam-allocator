export const clean = value => String(value ?? '').normalize('NFKC').replace(/[\u200e\u200f\u202a-\u202e\u2066-\u2069]/g, '').replace(/[\u0591-\u05bd\u05bf\u05c1\u05c2\u05c4\u05c5\u05c7]/g, '').replace(/[״“”„]/g, '"').replace(/[׳‘’`]/g, "'").replace(/[־–—−]/g, '-').replace(/\s+/g, ' ').trim();
export const headerKey = value => clean(value).toLowerCase().replace(/[\s'".\-_:()\/]/g, '');
export function gradeOf(value) {
  const k = headerKey(value).replace(/^שכבה/, '');
  return ({'10':10,'11':11,'12':12,'י':10,'יא':11,'יב':12})[k] || null;
}
export const gradeLabel = n => ({10:'י׳',11:'י״א',12:'י״ב'})[n] || String(n);
export const classLabel = s => `${gradeLabel(s.grade)}${s.classroom}`;
export const natural = new Intl.Collator('he', {numeric:true, sensitivity:'base'}).compare;
export const sortedStudents = list => [...list].sort((a,b) => a.grade-b.grade || a.classroom-b.classroom || natural(a.name,b.name) || natural(a.id,b.id));
export const escapeHTML = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'})[c]);
export function normalizedId(value) { return clean(value).replace(/[ -]/g, ''); }
export function validateStudent(s) {
  const errors=[];
  if(!/^\d{9}$/.test(s.id)) errors.push('תעודת זהות חייבת להכיל 9 ספרות; ניתן לתקן ידנית');
  if(!s.name.trim()) errors.push('חסר שם תלמיד');
  if(![10,11,12].includes(s.grade)) errors.push('שכבה חסרה או לא מזוהה');
  if(!Number.isInteger(s.classroom) || s.classroom<1) errors.push('מספר כיתה חסר או לא תקין');
  return errors;
}

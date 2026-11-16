import {clean} from './normalize.js';
export function nameTokens(name){return clean(name).replace(/["'\-]/g,' ').split(' ').filter(Boolean).sort();}
function subset(a,b){const remaining=[...b];return a.every(t=>{const i=remaining.indexOf(t);if(i<0)return false;remaining.splice(i,1);return true;});}
export function candidates(name,students){
 const a=nameTokens(name);if(a.length<2)return [];
 return students.filter(s=>{const b=nameTokens(s.name);return b.length>=2 && (subset(a,b)||subset(b,a));});
}
export function matchLines(text,students){
 return text.replace(/^\uFEFF/,'').split(/\r?\n/).map(s=>s.trim()).filter(Boolean).map((line,i)=>{
  const options=candidates(line,students),exact=options.length===1 && nameTokens(line).join(' ' )===nameTokens(options[0].name).join(' ');
  // Missing middle names are offered, never guessed; identical names remain ambiguous.
  return {key:`d${i}`,line,candidates:options.map(s=>s.key),status:exact?'matched':options.length?'pending':'notfound',selected:exact?options[0].key:null};
 });
}
export function applyMatches(matches,students){
 for(const s of students)s.differential=null;
 for(const m of matches)if(m.status==='matched'&&m.selected){const s=students.find(s=>s.key===m.selected);if(s)s.differential={enabled:true,line:m.line};}
}

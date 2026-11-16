import {gradeLabel} from './normalize.js';
export function defaultRooms(grades,base=38,count=6){
 const rooms=[];
 for(const grade of grades)for(let n=1;n<=count;n++)if(n<=6)rooms.push({id:`g${grade}c${n}`,name:`${gradeLabel(grade)}${n}`,type:'regular',grade,classroom:n,capacity:Math.max(1,base-([5,6].includes(n)?10:0)),smallCapacity:15,enabled:true,computer:false,smallOnly:false});
 rooms.push(...['319','M-12','M-13'].map((name,i)=>({id:`pc${i}`,name,type:'computer',grade:null,classroom:null,capacity:38,smallCapacity:15,enabled:i===0,computer:true,smallOnly:false})));
 if(grades.includes(10))rooms.push({id:'g10c7',name:'י׳7',type:'fixed',grade:10,classroom:7,capacity:38,smallCapacity:15,enabled:true,computer:true,smallOnly:false});
 return rooms;
}
export function validateRooms(rooms){
 const errors=[],names=new Set();
 for(const r of rooms){if(!r.enabled)continue;if(!r.name.trim())errors.push('חסר שם חדר');if(names.has(r.name.trim()))errors.push(`שם חדר כפול: ${r.name}`);names.add(r.name.trim());if(!Number.isInteger(r.capacity)||r.capacity<1||r.capacity>38)errors.push(`${r.name}: קיבולת נדרשת בין 1 ל־38 כדי לאפשר דוח קריא בעמוד אחד`);if(!Number.isInteger(r.smallCapacity)||r.smallCapacity<1||r.smallCapacity>r.capacity)errors.push(`${r.name}: קיבולת מצומצמת לא תקינה`);}
 return errors;
}

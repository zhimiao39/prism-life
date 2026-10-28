export const uid=()=>globalThis.crypto?.randomUUID?.()||'local-'+Date.now().toString(36)+'-'+Math.random().toString(36).slice(2)+'-'+Math.random().toString(36).slice(2);
export const defaults=[
{id:'cat',name:'喂猫',minutes:6,required:true,enabled:true,icon:'♧',step:'先拿出猫碗和今天的口粮'},
{id:'shower',name:'洗澡',minutes:15,required:true,enabled:true,icon:'◌',step:'先拿好干净衣服和毛巾'},
{id:'coffee',name:'做咖啡并收拾用品',minutes:12,required:true,enabled:true,icon:'☕',step:'先把咖啡用品放到台面上'},
{id:'teeth',name:'刷牙',minutes:3,required:true,enabled:true,icon:'◇',step:'先拿出牙刷和牙膏'},
{id:'litter',name:'铲屎 / 清理猫用品',minutes:8,icon:'♧',step:'先拿好垃圾袋'},
{id:'hair',name:'洗澡洗头吹发',minutes:35,required:true,icon:'◌',step:'先拿好衣服、毛巾和吹风机'},
{id:'wash',name:'洗衣准备',minutes:8,icon:'≈',step:'先把衣服放进洗衣机'},
{id:'hang',name:'晾衣',minutes:10,icon:'≈',step:'先拿出衣架'},
{id:'collect',name:'收衣服',minutes:8,icon:'≈',step:'先腾出叠衣服的地方'}];
export function eveningKey(now=Date.now()){const d=new Date(now);d.setHours(d.getHours()-4);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`}
export function targetAt(key,time='23:30'){const d=new Date(`${key}T${time}:00`);if(d.getHours()<4)d.setDate(d.getDate()+1);return d.getTime()}
export function fresh(){return {schemaVersion:1,routineVersion:2,templates:structuredClone(defaults),plans:[],records:[],active:null,settings:{target:'23:30',phone:'00:00',buffer:5,backupReminder:true,lastBackup:null,arrivalEnabled:true,firstTaskId:'cat'},revision:0}}
export function ensurePlan(s,now=Date.now()){const key=s.active?s.plans.find(p=>p.tasks.some(t=>t.id===s.active.instanceId))?.date:eveningKey(now);let p=s.plans.find(p=>p.date===key);if(!p){p={id:uid(),date:key,targetTime:s.settings.target,tasks:s.templates.filter(t=>t.enabled).map(t=>({...t,id:uid(),templateId:t.id,status:'pending'})),machineReady:null};s.plans.push(p)}return p}
export function elapsed(a,now=Date.now()){return Math.max(0,((a.pausedAt||now)-a.startAt-(a.pauses||[]).reduce((n,p)=>n+p.end-p.start,0))/60000)}
export function stats(s,id){const records=s.records.filter(r=>r.templateId===id&&!r.excluded).sort((a,b)=>b.endAt-a.endAt).slice(0,10);if(!records.length)return null;const sorted=records.map(r=>r.minutes).sort((a,b)=>a-b);return {n:records.length,median:median(sorted),low:sorted[0],high:sorted.at(-1),estimate:median(records.map(r=>r.estimate)),records}}
export function median(a){const b=[...a].sort((x,y)=>x-y);return b.length?(b[Math.floor((b.length-1)/2)]+b[Math.ceil((b.length-1)/2)])/2:0}
export function remaining(t,a,now){return a?.instanceId===t.id?Math.max(0,t.minutes-elapsed(a,now)):t.minutes}
export function schedule(plan,s,now=Date.now(),requiredOnly=false){let tasks=plan.tasks.filter(t=>t.status==='pending'&&(!requiredOnly||t.required));if(requiredOnly&&tasks.some(t=>t.templateId==='hang')&&!plan.machineReady){const wash=plan.tasks.find(t=>t.templateId==='wash'&&t.status==='pending');if(wash&&!tasks.includes(wash))tasks.unshift(wash)}let cursor=now;let ready=plan.machineReady;const rows=[];const active=tasks.find(t=>t.id===s.active?.instanceId);tasks=tasks.filter(t=>t!==active);if(!plan.manualOrder)tasks.sort((a,b)=>Number(b.templateId==='wash')-Number(a.templateId==='wash')||Number(b.required)-Number(a.required)||a.minutes-b.minutes);if(active)tasks.unshift(active);if(tasks.some(t=>t.templateId==='hang')&&!ready&&!tasks.some(t=>t.templateId==='wash'))return {end:Infinity,rows,blocked:true};while(tasks.length){let idx=tasks.findIndex(t=>(t.templateId!=='teeth'||tasks.length===1||t.id===s.active?.instanceId)&&(t.templateId!=='hang'||(ready&&ready<=cursor)));if(idx<0){if(ready){cursor=Math.max(cursor,ready);idx=tasks.findIndex(t=>(t.templateId!=='teeth'||tasks.length===1||t.id===s.active?.instanceId)&&(t.templateId!=='hang'||ready<=cursor));if(idx<0)return {end:Infinity,rows,blocked:true}}else return {end:Infinity,rows,blocked:true}}const t=tasks.splice(idx,1)[0];const start=cursor;cursor+=remaining(t,s.active,now)*60000;rows.push({task:t,start,end:cursor});if(t.templateId==='wash')ready=cursor+(plan.machineMinutes||40)*60000}return {end:cursor+s.settings.buffer*60000,rows,blocked:false}}
export function validateRecord(r,now=Date.now()){if(!r||!['id','templateId','planId','instanceId','name'].every(k=>typeof r[k]==='string')||!Number.isFinite(r.estimate)||r.estimate<=0||!Number.isFinite(r.startAt)||!Number.isFinite(r.endAt)||r.startAt>r.endAt||r.endAt>now||!Array.isArray(r.pauses))throw Error('记录时间或字段无效');if(r.reasonIds!=null&&(!Array.isArray(r.reasonIds)||r.reasonIds.length>8||new Set(r.reasonIds).size!==r.reasonIds.length||r.reasonIds.some(id=>!noteReasons.some(reason=>reason.id===id))))throw Error('备注原因格式无效');if(r.note!=null&&(typeof r.note!=='string'||r.note.length>500))throw Error('备注需在500字以内');let end=r.startAt;for(const p of r.pauses){if(!Number.isFinite(p.start)||!Number.isFinite(p.end)||p.start<end||p.end<p.start||p.end>r.endAt)throw Error('暂停时段超出记录范围或重叠');end=p.end}r.minutes=elapsed({startAt:r.startAt,pauses:r.pauses},r.endAt);return r}
export function validateBackup(s){if(!s||s.schemaVersion!==1||!Array.isArray(s.templates)||!Array.isArray(s.plans)||!Array.isArray(s.records)||!s.settings)throw Error('不支持的备份格式或版本');if(s.routineVersion!=null&&![1,2].includes(s.routineVersion))throw Error('不支持的任务数据版本');const positive=n=>Number.isFinite(n)&&n>0&&n<=1440;const ids=new Set();for(const t of s.templates){if(!t||typeof t.id!=='string'||ids.has(t.id)||typeof t.name!=='string'||!t.name.trim()||!positive(t.minutes))throw Error('任务模板无效');ids.add(t.id)}if(!['target','phone'].every(k=>/^([01]\d|2[0-3]):[0-5]\d$/.test(s.settings[k]))||!Number.isFinite(s.settings.buffer)||s.settings.buffer<0||s.settings.buffer>120)throw Error('设置无效');if(s.settings.arrivalEnabled!=null&&typeof s.settings.arrivalEnabled!=='boolean')throw Error('到家模式设置无效');if(s.settings.firstTaskId!=null&&typeof s.settings.firstTaskId!=='string')throw Error('第一件事设置无效');const instances=new Set(),plans=new Set();for(const p of s.plans){if(!p||typeof p.id!=='string'||plans.has(p.id)||!/^\d{4}-\d{2}-\d{2}$/.test(p.date)||!Number.isFinite(targetAt(p.date))||!Array.isArray(p.tasks)||!(p.machineReady==null||Number.isFinite(p.machineReady)))throw Error('晚间计划无效');if(p.targetTime!=null&&!/^([01]\d|2[0-3]):[0-5]\d$/.test(p.targetTime))throw Error('晚间目标时间无效');if(p.arrival!=null&&(!p.arrival||!['ready','rest','micro','done','plan'].includes(p.arrival.mode)||(p.arrival.invited!=null&&typeof p.arrival.invited!=='boolean')||!(p.arrival.restUntil==null||(Number.isFinite(p.arrival.restUntil)&&p.arrival.restUntil>0&&p.arrival.restUntil<=8640000000000000))))throw Error('到家模式状态无效');plans.add(p.id);for(const t of p.tasks){if(!t||typeof t.id!=='string'||instances.has(t.id)||!ids.has(t.templateId)||typeof t.name!=='string'||!positive(t.minutes)||!['pending','done'].includes(t.status))throw Error('计划任务无效');instances.add(t.id)}}const recordIds=new Set();for(const r of s.records){validateRecord(r);if(recordIds.has(r.id)||!ids.has(r.templateId)||!plans.has(r.planId)||!instances.has(r.instanceId))throw Error('记录关联无效');recordIds.add(r.id)}if(s.active){const a=s.active;if(!instances.has(a.instanceId)||!Number.isFinite(a.startAt)||a.startAt>Date.now()||!Array.isArray(a.pauses))throw Error('运行中计时无效');validateRecord({id:'check',templateId:'check',planId:'check',instanceId:'check',name:'check',estimate:1,startAt:a.startAt,endAt:a.pausedAt||Date.now(),pauses:a.pauses})}return s}

// Invert the same dependency-aware schedule used by the homepage.
export function latestStart(plan,s,now=Date.now(),requiredOnly=false){
 const deadline=targetAt(plan.date,s.settings.target),copy=structuredClone(plan);
 for(const t of copy.tasks)if(t.id===s.active?.instanceId)t.minutes=remaining(t,s.active,now);
 const frozen={...s,active:null};let low=Math.ceil(new Date(`${plan.date}T04:00:00`).getTime()/60000),high=Math.floor(deadline/60000),best=null;
 while(low<=high){const mid=Math.floor((low+high)/2);if(schedule(copy,frozen,mid*60000,requiredOnly).end<=deadline){best=mid*60000;low=mid+1}else high=mid-1}
 return best;
}
export function taskAccuracy(s,id){
 const rs=s.records.filter(r=>r.templateId===id&&!r.excluded).sort((a,b)=>a.startAt-b.startAt).slice(-10);
 const mean=a=>a.reduce((n,r)=>n+Math.abs(r.minutes-r.estimate),0)/a.length;
 const split=Math.floor(rs.length/2);
 return {n:rs.length,records:rs,error:rs.length?mean(rs):null,under:rs.filter(r=>r.minutes>r.estimate).length,over:rs.filter(r=>r.minutes<r.estimate).length,before:rs.length>=6?mean(rs.slice(0,split)):null,after:rs.length>=6?mean(rs.slice(split)):null,split};
}
export function eveningSummary(s,plan){
 const rs=s.records.filter(r=>r.planId===plan.id);if(!rs.length)return null;
 const start=Math.min(...rs.map(r=>r.startAt)),end=Math.max(...rs.map(r=>r.endAt));
 const intervals=[];for(const r of rs){let cursor=r.startAt;for(const p of r.pauses){intervals.push([cursor,p.start]);cursor=p.end}intervals.push([cursor,r.endAt])}
 intervals.sort((a,b)=>a[0]-b[0]);let covered=0,last=start;for(const [a,b] of intervals){covered+=Math.max(0,b-Math.max(a,last));last=Math.max(last,b)}
 return {start,end,active:rs.reduce((n,r)=>n+r.minutes,0),span:(end-start)/60000,gaps:Math.max(0,(end-start-covered)/60000),estimate:rs.reduce((n,r)=>n+r.estimate,0),count:rs.length,excluded:rs.filter(r=>r.excluded).length,complete:plan.tasks.length>0&&plan.tasks.every(t=>t.status==='done')};
}

export const eveningCombos=[
 {id:'normal',name:'普通夜',hint:'喂猫 · 洗澡 · 咖啡 · 最后刷牙',hair:false,laundry:false},
 {id:'hair',name:'洗头夜',hint:'洗澡洗头吹发 · 最后刷牙',hair:true,laundry:false},
 {id:'laundry',name:'洗衣夜',hint:'普通夜 + 洗衣准备、晾衣 · 最后刷牙',hair:false,laundry:true},
 {id:'hair-laundry',name:'洗头＋洗衣',hint:'洗头整套 + 洗衣、晾衣 · 最后刷牙',hair:true,laundry:true}
];
export function prepareCombo(s,plan,key){
 const combo=eveningCombos.find(c=>c.id===key);if(!combo)throw Error('未知的晚间组合');
 const next=structuredClone(plan),notices=[];
 const locked=t=>t.status==='done'||t.id===s.active?.instanceId||s.records.some(r=>r.instanceId===t.id);
 const laundryStarted=next.machineReady!=null||next.tasks.some(t=>t.templateId==='wash'&&locked(t));
 const opposite=combo.hair?'shower':'hair',preferred=combo.hair?'hair':'shower';
 const protectedBath=next.tasks.find(t=>(t.templateId===opposite||t.templateId==='shower-legacy')&&locked(t));
 const bath=protectedBath?protectedBath.templateId:preferred;
 if(protectedBath)notices.push('洗澡任务已完成或正在计时，保留原任务，不重复安排');
 const wanted=new Set(['cat',bath,'coffee','teeth',...(combo.laundry?['wash','hang']:[])]);
 next.tasks=next.tasks.filter(t=>{
  if(locked(t))return true;
  if(['wash','hang'].includes(t.templateId)&&laundryStarted)return true;
  if(t.templateId===opposite&&!protectedBath)return false;
  return !t.presetManaged||wanted.has(t.templateId);
 });
 if(!combo.laundry&&laundryStarted)notices.push('洗衣已启动，保留洗衣任务与晾衣等待');
 for(const id of wanted){
  if(next.tasks.some(t=>t.templateId===id))continue;
  const template=s.templates.find(t=>t.id===id);if(!template)throw Error('缺少组合所需的任务模板，请先恢复完整备份');
  next.tasks.push({...template,id:uid(),templateId:id,status:'pending',presetManaged:true,minutes:Math.max(1,Math.round(stats(s,id)?.median||template.minutes))});
 }
 next.comboKey=key;next.comboNote=notices.join('；');return next;
}

export const noteReasons=[
 {id:'interrupted',label:'突发事件 / 被打断'},
 {id:'extra-task',label:'顺手做了别的事'},
 {id:'prep-cleanup',label:'准备或收尾比预想多'},
 {id:'more-work',label:'步骤或份量增加'},
 {id:'equipment',label:'设备或用品耽误'},
 {id:'rest',label:'中途休息了一会儿'},
 {id:'less-work',label:'这次步骤或份量较少'},
 {id:'uncertain',label:'预估不太确定'}
];
export function reasonInsights(s,id){const rs=taskAccuracy(s,id).records;return noteReasons.map(reason=>{const matching=rs.filter(r=>r.reasonIds?.includes(reason.id));return {...reason,n:matching.length,delta:matching.length?median(matching.map(r=>r.minutes-r.estimate)):null}}).filter(reason=>reason.n)}

// Arrival support is operational state only; no waiting-time analytics are collected.
export function arrivalTask(s,plan,now=Date.now()){
 const ready=plan.tasks.filter(t=>taskCanStart(plan,t,now));
 return ready.find(t=>t.templateId===(s.settings.firstTaskId||'cat'))||ready.sort((a,b)=>Number(b.required)-Number(a.required)||a.minutes-b.minutes)[0]||null;
}
export function arrivalEstimate(s,t){return t.manualEstimate?t.minutes:Math.max(1,Math.round(stats(s,t.templateId)?.median??t.minutes))}
export function arrivalMode(s,plan){if(s.active)return 'done';if(plan.arrival)return plan.arrival.mode;return s.settings.arrivalEnabled!==false&&!s.records.some(r=>r.planId===plan.id)?'ready':'plan'}
export function restState(plan,now=Date.now()){const until=plan.arrival?.restUntil;if(plan.arrival?.mode!=='rest')return null;return until==null?{due:false,seconds:null}:{due:now>=until,seconds:Math.max(0,Math.ceil((until-now)/1000))}}

export function migrateRoutine(s,now=Date.now()){
 if(s.routineVersion===2)return s;
 const current=s.active?s.plans.find(p=>p.tasks.some(t=>t.id===s.active.instanceId)):s.plans.find(p=>p.date===eveningKey(now));
 const old=s.templates.find(t=>t.id==='shower');if(old){old.id='shower-legacy';old.enabled=false;old.archived=true}
 const bath=structuredClone(defaults.find(t=>t.id==='shower')),teeth=structuredClone(defaults.find(t=>t.id==='teeth'));
 if(!s.templates.some(t=>t.id==='shower'))s.templates.push(bath);
 if(!s.templates.some(t=>t.id==='teeth'))s.templates.push(teeth);
 for(const p of s.plans)for(const t of p.tasks)if(t.templateId==='shower'){
  if(p===current&&t.status==='pending'&&t.id!==s.active?.instanceId&&!s.records.some(r=>r.instanceId===t.id))Object.assign(t,{name:bath.name,step:bath.step,minutes:t.manualEstimate?t.minutes:bath.minutes});
  else t.templateId='shower-legacy';
 }
 for(const r of s.records)if(r.templateId==='shower')r.templateId='shower-legacy';
 if(current&&!current.tasks.some(t=>t.templateId==='teeth'))current.tasks.push({...teeth,id:uid(),templateId:'teeth',status:'pending'});
 s.routineVersion=2;return s;
}
export function taskCanStart(plan,t,now=Date.now()){return t?.status==='pending'&&(t.templateId!=='hang'||(plan.machineReady!=null&&plan.machineReady<=now))&&(t.templateId!=='teeth'||!plan.tasks.some(other=>other.id!==t.id&&other.status==='pending'))}

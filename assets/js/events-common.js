/* Shared presentation helpers; permissions and calendar expansion remain server-side. */
(() => {
 'use strict';
 const el=(tag,text,attrs={})=>{const n=document.createElement(tag);if(text!==null&&text!==undefined)n.textContent=text;for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);return n;};
 const day=(date,zone='UTC')=>new Intl.DateTimeFormat('en-CA',{timeZone:zone,year:'numeric',month:'2-digit',day:'2-digit'}).format(new Date(date));
 const add=(d,n)=>new Date(Date.parse(d+'T12:00Z')+n*86400000).toISOString().slice(0,10);
 const time=(date,zone)=>new Intl.DateTimeFormat('en-US',{timeZone:zone,dateStyle:'medium',timeStyle:'short'}).format(new Date(date));
 const weekdays=['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday'];
 function recurrence(r){
  if(!r||r.frequency==='once')return 'One-time gathering';
  const n=r.interval||1, start=new Date(r.start.slice(0,10)+'T12:00Z');let text='';
  if(r.frequency==='daily')text=n===1?'Every day':`Every ${n} days`;
  if(r.frequency==='weekly')text=`Every ${n===1?'week':n+' weeks'} on ${(r.weekdays?.length?r.weekdays:[start.getUTCDay()]).map(i=>weekdays[i]).join(', ')}`;
  if(r.frequency==='monthly_date')text=`Every ${n===1?'month':n+' months'} on day ${start.getUTCDate()}`;
  if(r.frequency==='monthly_weekday')text=`Every ${n===1?'month':n+' months'} on the ${{1:'first',2:'second',3:'third',4:'fourth','-1':'last'}[r.ordinal]} ${weekdays[r.weekday]}`;
  if(r.frequency==='yearly')text=`Every ${n===1?'year':n+' years'} on ${start.toLocaleDateString('en-US',{timeZone:'UTC',month:'long',day:'numeric'})}`;
  return text+(r.until?` through ${r.until}`:'')+(r.count?` · ${r.count} occurrences`:'');
 }
 function registration(r,now=Date.now()){
  if(!r||r.mode==='none')return el('span',r?.required?'Registration details to follow':'No registration needed');
  if(r.mode==='native_future')return el('span','Registration is not available yet');
  if(r.opens&&Date.parse(r.opens)>now)return el('span','Registration opens '+new Date(r.opens).toLocaleDateString());
  if(r.closes&&Date.parse(r.closes)<=now)return el('span','Registration has closed');
  if(!safeURL(r.url))return el('span','Registration details to follow');
  return el('a','Register with event host',{href:r.url,rel:'noopener noreferrer',target:'_blank',class:'event-cta'});
 }
 function safeURL(u){try{return new URL(u).protocol==='https:';}catch{return false;}}
 const button=(text,fn)=>{const b=el('button',text,{type:'button'});b.addEventListener('click',fn);return b;};
 const field=(form,label,name,type='text',value='')=>{const l=el('label',label),i=el(type==='textarea'?'textarea':'input',null,{name});if(type!=='textarea')i.type=type;if(type==='checkbox')i.checked=!!value;else i.value=value??'';l.append(i);form.append(l);return i;};
 const select=(form,label,name,choices,value='',multiple=false)=>{const l=el('label',label),s=el('select',null,{name});s.multiple=multiple;for(const[v,t]of choices){const o=el('option',t,{value:v});o.selected=multiple?(value||[]).includes(v):String(value??'')===String(v);s.append(o);}l.append(s);form.append(l);return s;};
 window.PropelEvents={el,day,add,time,recurrence,registration,safeURL,button,field,select,weekdays};
})();

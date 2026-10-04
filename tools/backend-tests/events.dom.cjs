const {JSDOM}=require('jsdom'),fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..'),read=f=>fs.readFileSync(path.join(root,f),'utf8'),wait=()=>new Promise(r=>setTimeout(r,0));
const click=(d,t)=>{const b=[...d.querySelectorAll('button')].find(x=>x.textContent===t);assert(b,'button '+t);b.click();};
async function flush(){await wait();await wait();await wait();}
const now=new Date(),start=new Date(now.getTime()+864e5).toISOString(),end=new Date(now.getTime()+9e7).toISOString();
const event={id:'e1',title:'Synthetic Gathering',summary:'A safe sample',description:'Full synthetic description',image_url:'javascript:alert(1)',timezone:'America/Chicago',department:{id:'d1',name:'Synthetic Department'},audiences:[{id:'a1',name:'Families'}],type:{id:'t1',name:'Class'},recurrence:{start:start.slice(0,10)+'T10:00',frequency:'monthly_weekday',interval:1,ordinal:3,weekday:4},registration:{mode:'native_future'},occurrences:[{id:'o1',starts_at:start,ends_at:end,location:{name:'Sample room'}}]};
const data={timezone:'America/Chicago',events:[event],departments:[event.department],labels:[{id:'a1',name:'Families',kind:'audience'},{id:'t1',name:'Class',kind:'type'}]};
(async()=>{
 for(const url of ['events.html','events.html?view=calendar','event.html?id=e1','events.html?embed=1']){
  const dom=new JSDOM(read(url.startsWith('event.html')?'event.html':'events.html'),{runScripts:'outside-only',url:'https://synthetic.test/'+url}),w=dom.window,d=w.document,calls=[];
  w.ChampionLifeAuth={client:{rpc:async(n,a)=>{calls.push(a);return{data};},auth:{onAuthStateChange(){}}}};
  w.eval(read('assets/js/events-common.js'));w.eval(read('assets/js/events-public.js'));await flush();
  assert.match(d.querySelector('#events-app').textContent,/Synthetic Gathering/);assert.equal(d.querySelector('img[src^="javascript:"]'),null);
  if(url.includes('calendar'))assert.equal(d.querySelectorAll('.event-day').length,42);
  else assert.match(d.querySelector('#events-app').textContent,/Registration is not available yet/);
  if(url.startsWith('event.html')){assert.match(d.querySelector('.event-detail').textContent,/Full synthetic description/);assert.match(d.querySelector('.event-schedule').textContent,/Upcoming dates/);}
  if(url.includes('embed'))assert(d.body.classList.contains('events-embed'));
  const f=d.querySelector('select[name=audience_id]');f.value='a1';f.dispatchEvent(new w.Event('change'));await flush();assert.equal(calls.at(-1).p_filters.audience_id,'a1');assert.match(d.querySelector('nav[aria-label="Event views"] a').href,/audience_id=a1/);f.value='';f.dispatchEvent(new w.Event('change'));await flush();assert.equal(calls.at(-1).p_filters.audience_id,'');assert(!d.querySelector('nav[aria-label="Event views"] a').href.includes('audience_id'));
  const T=w.PropelEvents;assert.match(T.recurrence(event.recurrence),/third Thursday/);assert.match(T.registration({mode:'external',url:'https://example.test',closes:'2020-01-01'}).textContent,/closed/);assert.equal(T.registration({mode:'external',url:'https://example.test'}).tagName,'A');assert.notEqual(T.registration({mode:'external',url:'javascript:alert(1)'}).tagName,'A');dom.window.close();
 }
 const dom=new JSDOM(read('staff-events.html'),{runScripts:'outside-only',url:'https://synthetic.test/staff-events.html'}),w=dom.window,d=w.document;
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};w.HTMLDialogElement.prototype.close=function(){this.open=false};
 let canManage=true,denied=false,delay=null,authChange;const calls=[];
 const series={id:'e1',title:'Synthetic Gathering',local_start:start.slice(0,16),local_end:end.slice(0,16),timezone:'America/Chicago',status:'draft',visibility:'public',revision:1,department_id:'d1',frequency:'once'};
 w.ChampionLifeAuth={getUser:async()=>({id:'user'}),client:{auth:{onAuthStateChange(cb){authChange=cb;}},rpc:async(n,a)=>{
  calls.push({n,...a});if(n==='staff_workspace_context')return {data:{organizations:[{id:'org',name:'Synthetic Church',slug:'synthetic'}],grants:[{organization_id:'org',permission:'events.view'}]}};
  if(denied)return {error:Error('Access denied')};if(a.p_action==='detail'&&delay)await new Promise(r=>delay=r);
  return {data:a.p_action==='context'?{timezone:'America/Chicago',settings_revision:1,manage_configuration:canManage,departments:[{id:'d1',name:'Synthetic Department',can_manage:canManage}],labels:data.labels,locations:[]}:
   a.p_action==='list'?[series]:a.p_action==='detail'?{series,can_manage:canManage,conflicts:1,audit:[],occurrences:[{id:'o1',slot_date:start.slice(0,10),starts_at:start,ends_at:end,scheduled:true}]}:series};
 }}};
 w.eval(read('assets/js/events-common.js'));w.eval(read('assets/js/staff-events.js'));await flush();assert.match(d.querySelector('#staff-events-app').textContent,/Synthetic Gathering/);
 click(d,'Create event');let f=d.querySelector('dialog form');f.elements.title.value='New gathering';f.elements.local_start.value=start.slice(0,16);f.elements.local_end.value=end.slice(0,16);f.elements.frequency.value='monthly_weekday';f.elements.frequency.dispatchEvent(new w.Event('change'));f.elements.ordinal.value='3';f.elements.weekday.value='4';f.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();let save=calls.find(c=>c.p_action==='save');assert.equal(save.p_data.frequency,'monthly_weekday');assert.equal(save.p_data.ordinal,3);assert.equal(save.p_data.weekday,4);assert.equal(save.p_data.revision,0);
 assert.match(d.querySelector('dialog').textContent,/possible room overlaps/);click(d,'Edit this occurrence');f=d.querySelector('dialog form');f.elements.cancelled.checked=true;f.dispatchEvent(new w.Event('submit',{cancelable:true}));await flush();let exception=calls.find(c=>c.p_action==='exception');assert.equal(exception.p_data.occurrence_id,'o1');assert.equal(exception.p_data.series_revision,1);assert.equal(exception.p_data.cancelled,true);
 click(d,'Edit entire series');assert.match(d.querySelector('dialog').textContent,/entire series/);click(d,'Close');await flush();
 canManage=false;authChange();await flush();await flush();assert(![...d.querySelectorAll('button')].some(b=>b.textContent==='Create event'));click(d,'Synthetic Gathering');await flush();assert(![...d.querySelectorAll('button')].some(b=>b.textContent==='Edit entire series'));click(d,'Close');await flush();
 delay=true;click(d,'Synthetic Gathering');await wait();denied=true;authChange();const release=delay;delay=null;release();await flush();await flush();assert.equal(d.querySelector('dialog').textContent,'');assert.equal(d.querySelector('.event-admin-list').textContent,'');assert.match(d.querySelector('#staff-events-app').textContent,/unavailable/);dom.window.close();
 console.log('PASS Events DOM: list, 42-cell calendar, detail, combined filter payload, embed, recurrence, registration states, unsafe URL rejection, editor, override, scoped controls and late-response clearing');
})().catch(e=>{console.error(e);process.exitCode=1});

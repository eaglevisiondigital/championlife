import assert from 'node:assert/strict';
import {mountCampaignDecisionWorkspace} from './campaign-workspace-mount.mjs';
let passed=0;const check=(v,name)=>{assert.ok(v,name);passed++;console.log('PASS '+name)};
class Element extends EventTarget{constructor(tag,doc){super();this.tag=tag;this.ownerDocument=doc;this.children=[];this.attributes={};this.textContent='';this.value=''}append(...nodes){this.children.push(...nodes)}replaceChildren(...nodes){this.children=[...nodes]}setAttribute(k,v){this.attributes[k]=v}}
const org='00000000-0000-4000-8000-000000000001',campaign='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',record='00000000-0000-4000-8000-000000000004',userA='00000000-0000-4000-8000-000000000005',userB='00000000-0000-4000-8000-000000000006';
const data=()=>({kind:'assigned-decision-campaign-directory',campaigns:[{organization_id:org,campaign_id:campaign,campaign_name:'Approved campaign',scope:'assigned',capabilities:['decisions.read','followup.manage']}]});
const pending=()=>{let resolve;const promise=new Promise(r=>resolve=r);return{promise,resolve}};
const tick=()=>new Promise(r=>setTimeout(r,0));
function fixture(){
 const doc={createElement:t=>new Element(t,doc),createTextNode:t=>({textContent:t})},root=new Element('div',doc),events=new EventTarget(),listeners=new Set(),calls=[];
 const fx={who:userA,token:'a',verified:true,active:true,expires:Date.now()/1000+3600,directory:async()=>({data:data()}),foundation:async args=>({data:args.p_action==='context'?{organization_id:org,campaign_id:campaign,scope:'assigned',capabilities:['decisions.read','followup.manage']}:{organization_id:org,campaign_id:campaign,page:0,registrations:[]}})};
 const auth={getSession:async()=>({user:{id:fx.who},access_token:fx.token,expires_at:fx.expires}),client:{supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:fx.who,email_confirmed_at:fx.verified?'2026-01-01':null}}}),onAuthStateChange:fn=>{listeners.add(fn);return{data:{subscription:{unsubscribe(){listeners.delete(fn)}}}}}},rpc:async(name,args)=>{calls.push({name,args});return name==='campaign_decision_directory'?fx.directory():fx.foundation(args)}}};
 const mount=mountCampaignDecisionWorkspace({root,auth,workspace:{active:()=>fx.active},eventTarget:events,projectRef:'abcdefghijklmnopqrst'});
 return{...fx,fx,mount,root,auth,events,calls,listeners,change(who,token){fx.who=who;fx.token=token;listeners.forEach(fn=>fn('SIGNED_IN'))}};
}
{
 const f=fixture();check(f.mount.snapshot().state==='unavailable','closed initially');await f.mount.refresh();check(f.mount.snapshot().campaigns.length===1,'directory from backend');check(f.calls[0].name==='campaign_decision_directory'&&f.calls[0].args===undefined,'no caller scope in discovery');await f.mount.select(org,campaign);check(f.mount.snapshot().record.state==='list','reuses foundation view after discovery');check(f.calls.filter(c=>c.args?.p_action==='context').length===2,'foundation authority before and after list');await assert.rejects(f.mount.select(org,other));check(!f.calls.some(c=>c.args?.p_campaign===other),'unknown campaign never queried');check(!JSON.stringify(f.mount.snapshot()).includes('access_token'),'no session tokens projected');f.mount.close();check(f.listeners.size===0,'all subscriptions disposed');
}
for(const name of ['staff-protected-clear','staff-access-denied','pagehide','pageshow','popstate','storage']){const f=fixture();await f.mount.refresh();await f.mount.select(org,campaign);f.events.dispatchEvent(new Event(name));check(f.mount.snapshot().campaigns.length===0&&f.mount.snapshot().record===null,name+' clears all protected state');f.mount.close()}
for(const event of ['SIGNED_OUT','TOKEN_REFRESHED','USER_UPDATED']){const f=fixture();await f.mount.refresh();f.listeners.forEach(fn=>fn(event));check(f.mount.snapshot().campaigns.length===0,event+' immediately invalidates');f.mount.close()}
for(const response of [{error:{code:'42501'}},{status:401},{error:{status:403}},{error:{code:'PGRST301'}},{error:{code:'PGRST302'}},{error:{code:'PGRST303'}}]){const f=fixture();await f.mount.refresh();f.fx.directory=async()=>response;await assert.rejects(f.mount.refresh());check(f.mount.snapshot().campaigns.length===0,'explicit denial '+JSON.stringify(response));f.mount.close()}
for(const code of ['PGRST202','NETWORK']){const f=fixture();f.fx.directory=async()=>({error:{code}});await assert.rejects(f.mount.refresh());check(f.mount.snapshot().campaigns.length===0&&f.mount.snapshot().message.includes(code==='PGRST202'?'not installed':'cleared'),code+' safe unavailable');f.mount.close()}
{
 const f=fixture();f.fx.directory=async()=>({data:{kind:data().kind,campaigns:[]}});await f.mount.refresh();check(f.mount.snapshot().state==='ready'&&f.mount.snapshot().campaigns.length===0,'empty permitted directory');f.mount.close();
}
for(const malformed of [{kind:data().kind,campaigns:[{...data().campaigns[0],organization_id:[org]}]},{kind:data().kind,campaigns:[{...data().campaigns[0],campaign_id:[campaign]}]},null,{}, {...data(),extra:'private'}, {kind:data().kind,campaigns:[{...data().campaigns[0],email:'secret'}]}, {kind:data().kind,campaigns:[{...data().campaigns[0],capabilities:['registration.view']}]},{kind:data().kind,campaigns:[...data().campaigns,...data().campaigns]},{kind:data().kind,campaigns:[{...data().campaigns[0],scope:'all'}]}]){const f=fixture();f.fx.directory=async()=>({data:malformed});await assert.rejects(f.mount.refresh());check(f.mount.snapshot().campaigns.length===0,'malformed projection rejected');f.mount.close()}
{
 const f=fixture();const old=pending();f.fx.directory=()=>old.promise;const stale=f.mount.refresh().catch(()=>{});await tick();f.fx.directory=async()=>({data:data()});await f.mount.refresh();old.resolve({error:{code:'42501'}});await stale;check(f.mount.snapshot().state==='unavailable','late same-principal directory denial retires new directory');f.mount.close();
}
{
 const f=fixture();const old=pending();f.fx.directory=()=>old.promise;const stale=f.mount.refresh().catch(()=>{});await tick();f.change(userB,'b');f.fx.directory=async()=>({data:data()});await f.mount.refresh();old.resolve({error:{code:'42501'}});await stale;check(f.mount.snapshot().state==='ready','old account directory denial cannot retire new account');f.mount.close();
}
{
 const f=fixture();const old=pending();f.fx.directory=()=>old.promise;const stale=f.mount.refresh().catch(()=>{});await tick();f.change(userB,'b');old.resolve({data:data()});await stale;check(f.mount.snapshot().campaigns.length===0,'late old account directory success discarded');f.mount.close();
}
{
 const f=fixture();await f.mount.refresh();f.fx.directory=async()=>({data:{kind:data().kind,campaigns:[]}});await assert.rejects(f.mount.select(org,campaign));check(f.mount.snapshot().record===null,'selection reauthorizes current directory');check(!f.calls.some(c=>c.name==='campaign_decision_foundation'),'revoked selection cannot issue foundation request');f.mount.close();
}
for(const condition of ['unverified','expired','inactive','changed-endpoint','client-replaced']){const f=fixture();if(condition==='unverified')f.fx.verified=false;if(condition==='expired')f.fx.expires=1;if(condition==='inactive')f.fx.active=false;if(condition==='changed-endpoint')f.auth.client.rest.url='https://elsewhere.invalid/rest/v1';if(condition==='client-replaced')f.auth.client={...f.auth.client};await assert.rejects(f.mount.refresh());check(f.calls.length===0,condition+' denied before directory');f.mount.close()}
{
 const f=fixture();await f.mount.refresh();f.fx.foundation=async()=>({error:{code:'42501'}});await assert.rejects(f.mount.select(org,campaign));check(f.mount.snapshot().record===null&&f.mount.snapshot().campaigns.length===0,'foundation denial clears parent metadata and child');f.mount.close();
}
{
 const f=fixture();const old=pending();f.fx.directory=()=>old.promise;const stale=f.mount.refresh().catch(()=>{});await tick();f.auth.client.rest.url='https://elsewhere.invalid/rest/v1';old.resolve({data:data()});await stale;check(f.mount.snapshot().campaigns.length===0,'endpoint change during directory fails closed');f.mount.close();
}
{
 const f=fixture();let reject;f.fx.directory=()=>new Promise((_,r)=>reject=r);const stale=f.mount.refresh().catch(()=>{});await tick();f.fx.directory=async()=>({data:data()});await f.mount.refresh();reject(Object.assign(new Error('denied'),{code:'42501'}));await stale;check(f.mount.snapshot().campaigns.length===0,'thrown late same-principal denial retires directory');f.mount.close();
}

// Actual view under the existing shared-client contract; no hosted Auth or new authority.
const {createRequire}=await import('node:module');
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {JSDOM}=require('jsdom');
const {mountCampaignDecisionView}=await import('./campaign-decision-view.mjs');
async function rosterFixture(){
 const dom=new JSDOM('<main id="roster"></main>',{url:'https://roster.invalid'}),doc=dom.window.document,events=new EventTarget();
 const calls=[],listeners=[];let actor=userA,token='fictional-a',deny=false,hold=false,release;
 const rows=[{registration_id:record,name:'Fictional Alpha',status:'new',next_contact_on:'2026-11-20',consent:true},{registration_id:other,name:'Fictional Beta',status:'completed',next_contact_on:null,consent:false}].map(r=>({...r,kind:'decision-free-book-registration',revision:1,contact_allowed:false,email:'PRIVATE-EMAIL',prayer:'PRIVATE-PRAYER',answers:'PRIVATE-ANSWERS'}));
 const auth={
  getSession:async()=>({user:{id:actor},access_token:token,expires_at:Date.now()/1000+3600}),
  client:{
   supabaseUrl:'https://abcdefghijklmnopqrst.supabase.co',rest:{url:'https://abcdefghijklmnopqrst.supabase.co/rest/v1'},
   auth:{url:'https://abcdefghijklmnopqrst.supabase.co/auth/v1',getUser:async()=>({data:{user:{id:actor,email_confirmed_at:'2026-01-01'}}}),onAuthStateChange:fn=>{listeners.push(fn);return{data:{subscription:{unsubscribe(){}}}}}},
   rpc:async(name,p)=>{calls.push({name,...p});if(hold&&p.p_action==='list'){hold=false;await new Promise(r=>release=r)}if(deny)return{error:{code:'42501'}};if(p.p_action==='context')return{data:{organization_id:org,campaign_id:campaign,scope:'assigned',capabilities:['decisions.read']}};return{data:{organization_id:org,campaign_id:campaign,page:p.p_payload.page,registrations:rows}}}
  }
 };
 const root=doc.querySelector('#roster'),view=mountCampaignDecisionView({root,auth,workspace:{active:()=>true},eventTarget:events,getAllowedCampaigns:()=>[{organizationId:org,campaignId:campaign}],projectRef:'abcdefghijklmnopqrst'});
 const settle=async()=>{for(let i=0;i<15;i++)await tick()};view.select(org,campaign);await view.list();
 return{dom,doc,root,view,calls,settle,rows,button:text=>[...root.querySelectorAll('button')].find(n=>n.textContent===text),deny:()=>deny=true,hold:()=>hold=true,release:()=>release(),held:()=>!!release,change:(notify=true)=>{actor=userB;token='fictional-b';if(notify)listeners.forEach(fn=>fn('SIGNED_IN'))},close(){view.close();dom.window.close()}};
}
{
 const f=await rosterFixture();try{
  check(!!f.root.querySelector('[name=rosterSearch]'),'roster offers a current-page name search');
  check(f.root.textContent.includes('Event registrations and check-in are separate'),'roster distinguishes decision records from event attendance');
  check(f.root.textContent.includes('Next review: 2026-11-20')&&f.root.textContent.includes('Follow-up consent: withdrawn or not given'),'existing permitted date and consent are visible');
  check(!/PRIVATE-/.test(f.root.textContent),'no contact, prayer or learner projection');
  const before=f.calls.length;f.root.querySelector('[name=rosterSearch]').value='alpha';f.button('Apply filters').click();await f.settle();
  check(f.root.textContent.includes('Fictional Alpha')&&!f.root.textContent.includes('Fictional Beta'),'name filter works on authorized rows');
  check(f.calls.slice(before).filter(c=>c.p_action==='context').length===2,'filter verifies existing authority before and after read');
  check(JSON.stringify(f.calls.filter(c=>c.p_action==='list').at(-1).p_payload)==='{"page":0}','filter never invents server query fields');
  check(f.root.textContent.includes('1 of 2 assigned records on this page'),'visible count is not campaign total');
  f.button('Clear filters').click();await f.settle();f.root.querySelector('[name=rosterStatus]').value='completed';f.button('Apply filters').click();await f.settle();
  check(!f.root.textContent.includes('Fictional Alpha')&&f.root.textContent.includes('Fictional Beta'),'follow-up status filtering works');
  check(f.root.textContent.includes('Follow-up: completed')&&f.root.textContent.includes('Discipleship status is unavailable'),'completed follow-up never certifies course');
  f.button('Clear filters').click();await f.settle();f.root.querySelector('[name=rosterConsent]').value='no';f.button('Apply filters').click();await f.settle();
  check(!f.root.textContent.includes('Fictional Alpha')&&f.root.textContent.includes('Fictional Beta'),'consent filter uses exact existing boolean');
  f.root.querySelector('[name=rosterSearch]').value='<script>';f.button('Apply filters').click();await f.settle();check(f.root.textContent.includes('No matches on this page')&&!f.root.querySelector('script'),'literal search has no markup execution or inferred identity');
  const old=f.button('Apply filters');f.deny();old.click();await f.settle();check(!f.root.querySelector('[name=rosterSearch]')&&!f.root.textContent.includes('Fictional'),'denial clears rows and search');const after=f.calls.length;old.click();await f.settle();check(f.calls.length===after,'retained denied filters issue no requests');
  check(f.calls.every(c=>['context','list'].includes(c.p_action)),'new roster journey is read-only');
 }finally{f.close()}
}
{
 const f=await rosterFixture();try{f.root.querySelector('[name=rosterSearch]').value='Private Alpha';const old=f.button('Apply filters');f.hold();old.click();for(let i=0;i<100&&!f.held();i++)await tick();assert(f.held());f.change();f.release();await f.settle();check(!f.root.querySelector('[name=rosterSearch]')&&!f.root.textContent.includes('Fictional Alpha'),'account change discards delayed filtered rows and private search');const count=f.calls.length;old.click();await f.settle();check(f.calls.length===count,'old account filter cannot refetch');f.view.select(org,campaign);await f.view.list();check(f.root.querySelector('[name=rosterSearch]').value==='','fresh account starts with no old filter');}finally{f.close()}
}

{
 const f=await rosterFixture();try{
  f.root.querySelector('[name=rosterSearch]').value='Private Alpha';f.change(false);const before=f.calls.length;
  f.button('Apply filters').click();await f.settle();
  check(!f.root.querySelector('[name=rosterSearch]')&&!f.root.textContent.includes('Fictional'),'silent account replacement clears old search and rows');
  check(f.calls.length===before,'silent account replacement denied before scoped RPC');
 }finally{f.close()}
}
{
 const f=await rosterFixture();try{
  for(let i=2;i<50;i++)f.rows.push({...f.rows[0],registration_id:`00000000-0000-4000-8000-${String(i+100).padStart(12,'0')}`});
  await f.view.list();f.root.querySelector('[name=rosterSearch]').value='no matching person';f.button('Apply filters').click();await f.settle();
  check(f.root.textContent.includes('0 of 50')&&!f.button('Next page').disabled,'filtered-empty full page preserves next-page access');
  f.button('Next page').click();await f.settle();check(f.calls.filter(c=>c.p_action==='list').at(-1).p_payload.page===1,'filtered page navigation uses existing page contract');
 }finally{f.close()}
}

{
 const f=fixture();const loading=f.mount.refresh();f.listeners.forEach(fn=>fn('INITIAL_SESSION',{user:{id:userA},access_token:'a'}));await loading;
 check(f.mount.snapshot().state==='ready','initial SDK notification does not retire verified startup');
 f.listeners.forEach(fn=>fn('INITIAL_SESSION',{user:{id:userA},access_token:'a'}));check(f.mount.snapshot().state==='unavailable','repeated initial notification retires scope');f.mount.close();
}
for(const value of [null,{user:{id:userB},access_token:'b'},{user:{id:userA},access_token:'replaced'}]){
 const f=fixture();await f.mount.refresh();f.listeners.forEach(fn=>fn('INITIAL_SESSION',value));check(f.mount.snapshot().state==='unavailable','initial notification cannot retain different or missing principal');f.mount.close();
}

console.log(JSON.stringify({passed,failed:0}));

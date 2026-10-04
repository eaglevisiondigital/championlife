import{JSDOM}from'jsdom';import{readFileSync}from'node:fs';import assert from'node:assert/strict';
const read=p=>readFileSync(new URL('../../assets/js/'+p,import.meta.url),'utf8');
const dom=new JSDOM('<div id="outreach-intakes"></div>',{url:'https://preview.example/staff-outreach-partners.html',runScripts:'outside-only'}),w=dom.window;
let user={id:'staff'},callback,linked=false,task=false,revision=1;const calls=[];
w.confirm=()=>true;w.ChampionLifeAuth={getUser:async()=>user,getSession:async()=>user?{user}:null,client:{auth:{onAuthStateChange:f=>callback=f},rpc:async(name,p)=>{calls.push({name,p});if(name==='staff_workspace_context')return{data:{organizations:[{id:'org',name:'SowGo'}],grants:['outreach.view','outreach.manage','people.read','people.create','people.update','followup.read','followup.manage'].map(permission=>({organization_id:'org',permission}))}};
if(name==='people_workspace')return{data:[{id:'person',first_name:'Reviewed',last_name:'Contact',email:'test@example.test'}]};
if(p.p_action==='list')return{data:[{id:'intake',first_name:'<script>bad</script>',last_name:'Synthetic',email:'test@example.test',phone:'5555551234',source_site:'sowgo',submitted_at:new Date().toISOString(),status:linked?'linked':'new',commitment_amount:25,commitment_frequency:'Monthly'}]};
if(p.p_action==='detail')return{data:{id:'intake',revision,status:linked?'linked':'new',raw_submission:{'first-name':'Synthetic',email:'test@example.test'},source_site:'sowgo',source_path:'/outreach-partner.html',person_id:linked?'person':null,followup_task_id:task?'task':null,history:[]}};
if(p.p_action==='link')linked=true;if(p.p_action==='followup')task=true;revision++;return{data:{saved:true}}}}};
w.eval(read('events-common.js'));w.eval(read('staff-outreach-partners.js'));const tick=()=>new Promise(r=>setTimeout(r,10)),click=async t=>{const b=[...w.document.querySelectorAll('button')].find(b=>b.textContent===t);assert(b,'button '+t);b.click();await tick()};await tick();assert(!w.document.querySelector('script'));assert(w.document.body.textContent.includes('<script>bad</script>'));await click('Review intake');await click('Search People');await click('Link reviewed contact');assert(linked);await click('Create follow-up task');assert(task);assert(calls.some(x=>x.p?.p_action==='link'&&x.p.p_data.person_id==='person'));assert(w.document.querySelector('a[href="staff-people.html?person=person"]'));user=null;callback('SIGNED_OUT',null);await tick();assert(!w.document.body.textContent.includes('test@example.test'));assert(w.document.body.textContent.includes('Sign in'));dom.window.close();console.log('PASS staff intake review, escaped contact text, explicit linking, existing follow-up and sign-out clearing');

// Exercise real navigation with Supabase-shaped HTTP responses, not permission changes.
async function denialHarness({initial, noGrant=false}={}) {
 const dom=new JSDOM('<div id="outreach-intakes"></div>',{url:'https://preview.example/staff-outreach-partners.html',runScripts:'outside-only'}),w=dom.window;
 let session={user:{id:'synthetic-staff'}},authChanged;
 const calls=[],responses=new Map(Object.entries(initial||{}));
 const record={id:'synthetic-intake',first_name:'Protected',last_name:'Applicant',email:'protected@example.test',phone:'5555550100',submitted_at:'2026-10-04T12:00:00Z',source_site:'sowgo',status:'new',commitment_amount:25,commitment_frequency:'Monthly'};
 const detail={...record,revision:1,raw_submission:{'first-name':'Protected',email:record.email,'address-line-1':'Private test address'},source_path:'/outreach-partner.html',person_id:'synthetic-person',history:[{action:'reviewed',occurred_at:record.submitted_at}]};
 w.ChampionLifeAuth={getUser:async()=>session?.user,getSession:async()=>session,client:{auth:{onAuthStateChange:fn=>authChanged=fn},rpc:async(name,args)=>{
  const action=name==='staff_workspace_context'?'context':args.p_action;calls.push(action);
  if(responses.has(action))return await responses.get(action)();
  if(action==='context')return {status:200,data:{organizations:[{id:'org',name:'SowGo'}],grants:noGrant?[]:['outreach.view','outreach.manage','people.read'].map(permission=>({organization_id:'org',permission}))}};
  return {status:200,data:action==='list'?[record]:detail};
 }}};
 w.eval(read('events-common.js'));w.eval(read('staff-outreach-partners.js'));await tick();
 const root=w.document.querySelector('#outreach-intakes');
 function button(label){const result=[...root.querySelectorAll('button')].find(b=>b.textContent===label);assert(result,label);return result}
 async function click(label){button(label).click();await tick()}
 const deny=code=>({status:code,data:null,error:{code:code===403?'42501':'PGRST301',message:'PRIVATE backend RPC outreach_partner_workspace outreach.view synthetic-intake',details:'private response body',hint:'internal permission details'}});
 function assertDenied(code){
  const text=root.textContent;
  assert(!text.includes('Loading'),text);
  for(const secret of ['protected@example.test','Private test address','Protected Applicant','PRIVATE','outreach_partner_workspace','outreach.view','synthetic-intake','42501','PGRST301'])assert(!text.includes(secret),secret+' leaked');
  assert.equal(root.querySelectorAll('button,select,input,article').length,0,'protected controls/state cleared');
  assert(root.querySelector('[role="alert"]'));
  if(code===403){assert(text.includes('Your access to Outreach Partner Intakes is no longer available.'));assert(text.includes('If you believe you should still have access, contact an administrator.'));assert.equal(root.querySelector('a').textContent,'Return to Staff Home');assert.equal(root.querySelector('a').getAttribute('href'),'staff-people.html');}
  else{assert(text.includes('Your session has expired. Sign in to continue.'));assert.equal(root.querySelector('a').getAttribute('href'),'discipleship-login.html?next=%2Fstaff-outreach-partners.html');}
 }
 return {dom,w,root,calls,responses,record,detail,button,click,deny,assertDenied,expire:()=>session=null,signOut:()=>{session=null;authChanged('SIGNED_OUT',null)}};
}
let scenarios=0;
for(const code of [401,403]) {
 // Initial load and a fresh reload both remain denied, without retry loops.
 for(let reload=0;reload<2;reload++){
  const h=await denialHarness({initial:{list:()=>({status:code,data:null,error:{message:'PRIVATE raw response'}})}});
  h.assertDenied(code);assert.deepEqual(h.calls,['context','list']);h.dom.window.close();scenarios++;
 }
 const h=await denialHarness();h.responses.set('detail',()=>h.deny(code));await h.click('Review intake');h.assertDenied(code);h.dom.window.close();scenarios++;
 const back=await denialHarness();await back.click('Review intake');assert(back.root.textContent.includes('Private test address'));
 const oldDetail=back.button('Mark reviewed');back.responses.set('list',()=>back.deny(code));await back.click('Back to intakes');back.assertDenied(code);
 const count=back.calls.length;oldDetail.click();await tick();assert.equal(back.calls.length,count,'detached protected actions cannot reuse revoked state');back.assertDenied(code);back.dom.window.close();scenarios++;
}
// No session uses the existing sign-in route without sending an intake request.
{
 const h=await denialHarness();await h.click('Review intake');h.expire();const count=h.calls.length;await h.click('Back to intakes');h.assertDenied(401);assert.equal(h.calls.length,count);h.dom.window.close();scenarios++;
}
// A context refreshed after revocation has no usable grants: same access-removed UX.
{
 const h=await denialHarness({noGrant:true});h.assertDenied(403);assert.deepEqual(h.calls,['context']);h.dom.window.close();scenarios++;
}
// Revocation during another pending request cannot repopulate cleared detail/state.
{
 const h=await denialHarness();await h.click('Review intake');let finish;
 h.responses.set('review',()=>new Promise(resolve=>finish=resolve));h.button('Mark reviewed').click();await tick();
 h.responses.set('list',()=>h.deny(403));await h.click('Back to intakes');h.assertDenied(403);
 const count=h.calls.length;finish({status:200,data:{saved:true}});await tick();assert.equal(h.calls.length,count,'late action cannot trigger a detail reload');h.assertDenied(403);h.dom.window.close();scenarios++;
}
// A late denied response from an obsolete view must not replace a newer authorized view.
{
 const h=await denialHarness();await h.click('Review intake');let finish;
 h.responses.set('review',()=>new Promise(resolve=>finish=resolve));h.button('Mark reviewed').click();await tick();await h.click('Back to intakes');
 finish(h.deny(403));await tick();assert(h.root.textContent.includes('Protected Applicant'));assert(!h.root.textContent.includes('no longer available'));h.dom.window.close();scenarios++;
}
// Non-auth failures also stop loading without displaying raw backend response details.
{
 const h=await denialHarness();h.responses.set('detail',()=>h.deny(500));await h.click('Review intake');assert(h.root.textContent.includes('Unable to load Outreach Partner Intakes. Please try again.'));assert(!h.root.textContent.includes('PRIVATE'));assert(!h.root.textContent.includes('Loading'));h.dom.window.close();scenarios++;
}
console.log(`PASS ${scenarios} staff denial scenarios: initial/reload list, detail, revoked Back, stale controls/requests, expired session, missing grants and safe errors`);

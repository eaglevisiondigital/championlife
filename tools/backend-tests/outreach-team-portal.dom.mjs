// Controlled local DOM/Auth/RPC contract only. No account, link or backend write.
import assert from'node:assert/strict';import{readFileSync}from'node:fs';import vm from'node:vm';import{JSDOM}from'jsdom';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),source=read('assets/js/outreach-team-portal.js'),campaign='11111111-1111-4111-8111-111111111111',other='99999999-9999-4999-8999-999999999999';let n=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)},tick=()=>new Promise(r=>setTimeout(r,10));
const record=()=>({campaign_id:campaign,member_id:'55555555-5555-4555-8555-555555555555',campaign:'Synthetic outreach',status:'approved',source_application_status:'pending',travel_ready:true,checked_in_at:'2026-12-19T17:00:00Z',attended_at:'2026-12-19T19:00:00Z',private_review:'PRIVATE REVIEW MUST NEVER RENDER',other_person_id:other,manifest:[{name:'OTHER PASSENGER MUST NEVER RENDER'}],travel:[{leg:'Outbound',vehicle:'Synthetic confirmed van',state:'confirmed',itinerary_confirmed:true,departure_at:'2026-12-19T14:00:00Z',departure_location:'Synthetic meeting point',destination:'Synthetic destination',other_person_id:other}]});
async function harness({query='?campaign='+campaign,rows=[record()],signedIn=true,error=null,hold=false,logoutFailure=false}={}){
 const dom=new JSDOM(read('outreach-team.html'),{url:'https://outreach.local.test/outreach-team.html'+query,runScripts:'outside-only',pretendToBeVisual:true}),w=dom.window,d=w.document;let user=signedIn?{id:'synthetic-own-user',email:'own@example.test'}:null,callback,currentRows=rows,currentError=error,held=hold,finish,reloads=0;const calls=[],signouts=[];let userReads=0;
 w.localStorage.setItem('unrelated-setting','preserve');w.sessionStorage.setItem('unrelated-draft','preserve');
 w.ChampionLifeAuth={getUser:async()=>{userReads++;return user},getSession:async()=>user?{user}:null,client:{rpc:async(name,p)=>{calls.push({name,p});if(held){held=false;return new Promise(r=>finish=r)}return currentError?{error:currentError}:{data:JSON.parse(JSON.stringify(currentRows))}},auth:{onAuthStateChange:fn=>callback=fn,signOut:async opts=>{signouts.push(opts);if(logoutFailure)return{error:{message:'Private provider error'}};user=null;callback('SIGNED_OUT',null);return{error:null}}}}};
 vm.runInNewContext(source,{window:w,document:d,location:{search:query,reload:()=>reloads++},URLSearchParams,Intl,Date,setTimeout});await tick();
 const click=async text=>{const b=[...d.querySelectorAll('button')].find(b=>b.textContent===text);assert.ok(b,'button '+text);b.click();await tick();};
 return{w,d,dom,calls,signouts,click,get userReads(){return userReads},get reloads(){return reloads},change:async(nextRows,nextError=null)=>{currentRows=nextRows;currentError=nextError;w.dispatchEvent(new w.Event('focus'));await tick()},auth:async(next,event='SIGNED_IN')=>{user=next;callback(event,next?{user:next}:null);await tick()},finish:value=>finish(value)};
}
for(const query of['','?campaign=','?campaign=not-a-uuid','?campaign='+campaign+'&campaign='+other]){const h=await harness({query});try{ok(h.d.body.textContent.includes('Open Your Event Link'),'missing/invalid/ambiguous link requests authorized event link');ok(h.calls.length===0&&h.userReads===0,'missing/invalid event never guesses an ID or calls own history');}finally{h.dom.window.close()}}
{
 const h=await harness({signedIn:false});try{ok(h.d.body.textContent.includes('Sign In to View Your Outreach Information'),'signed-out reader receives sign-in prompt');ok(h.calls.length===0,'signed-out reader does not call participant RPC');const url=new URL(h.d.querySelector('main a').href);ok(url.searchParams.get('next')==='/outreach-team.html?campaign='+campaign,'sign-in return preserves only validated event link');}finally{h.dom.window.close()}
}
{
 const h=await harness();try{
  ok(h.calls.length===1&&h.calls[0].name==='outreach_team_own'&&h.calls[0].p.p_campaign===campaign,'read-only view calls only event-scoped existing own RPC');
  ok(h.d.body.textContent.includes('Approved to Serve')&&h.d.body.textContent.includes('Checked In:')&&h.d.body.textContent.includes('Attended:'),'own serving decision and attendance history render');
  ok(h.d.body.textContent.includes('Confirmed Itinerary')&&h.d.body.textContent.includes('Synthetic confirmed van')&&h.d.body.textContent.includes('Synthetic meeting point'),'currently valid confirmed itinerary renders');
  ok(!h.d.documentElement.outerHTML.includes(other)&&!h.d.documentElement.outerHTML.includes('55555555-5555-4555-8555-555555555555'),'member/other-person IDs are never rendered');
  ok(!h.d.body.textContent.includes('PRIVATE REVIEW')&&!h.d.body.textContent.includes('OTHER PASSENGER'),'private review/manifest data is ignored');
  ok(!h.d.querySelector('form,input,select,textarea'),'participant presentation provides no signup, claiming or write controls');
  await h.change([]);ok(h.d.body.textContent.includes('No serving record is available')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'current canonical link revocation clears previous itinerary');
  await h.change([record()]);await h.change([],{code:'42501',message:'PRIVATE DATABASE ERROR'});ok(h.d.body.textContent.includes('Your outreach information is unavailable')&&!h.d.body.textContent.includes('PRIVATE DATABASE ERROR')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'permission denial clears data and suppresses backend diagnostics');
 }finally{h.dom.window.close()}
}
for(const variant of['assigned','invalid-confirmation','not-ready','cancelled-source','invalid-time']){
 const r=record();if(variant==='assigned')r.travel[0].state='assigned';if(variant==='invalid-confirmation')r.travel[0].itinerary_confirmed=false;if(variant==='not-ready')r.travel_ready=false;if(variant==='cancelled-source')r.source_application_status='cancelled';if(variant==='invalid-time')r.travel[0].departure_at='PRIVATE INVALID TIME';
 const h=await harness({rows:[r]});try{ok(!h.d.body.textContent.includes('Synthetic confirmed van')&&!h.d.body.textContent.includes('Synthetic meeting point')&&!h.d.body.textContent.includes('Synthetic destination'),'unconfirmed/ineligible travel details are withheld: '+variant);ok(!h.d.body.textContent.includes('Confirmed Itinerary')&&!h.d.body.textContent.includes('PRIVATE INVALID TIME'),'no fabricated itinerary confirmation: '+variant);}finally{h.dom.window.close()}
}
{
 const r=record();r.campaign_id=other;const h=await harness({rows:[r]});try{ok(h.d.body.textContent.includes('could not be confirmed')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'cross-event/malformed RPC response fails closed');}finally{h.dom.window.close()}
}
{
 const r=record();r.campaign='<img src=x onerror=alert(1)>';r.travel[0].vehicle='<script>alert(1)</script>';const h=await harness({rows:[r]});try{ok(h.d.body.textContent.includes('<img src=x onerror=alert(1)>')&&!h.d.querySelector('[onerror]')&&!h.d.querySelector('main script'),'own text fields never become executable HTML');}finally{h.dom.window.close()}
}
{
 const h=await harness({hold:true});try{await h.auth(null,'SIGNED_OUT');h.finish({data:[record()]});await tick();ok(h.d.body.textContent.includes('Sign In to View')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'late own response cannot restore a signed-out view');}finally{h.dom.window.close()}
}
{
 const h=await harness({hold:true});try{await h.auth({id:'new-synthetic-user',email:'new@example.test'});h.finish({data:[{...record(),campaign:'OLD ACCOUNT PRIVATE EVENT'}]});await tick();ok(h.d.getElementById('trip-account-email').textContent==='new@example.test'&&!h.d.body.textContent.includes('OLD ACCOUNT PRIVATE EVENT'),'account switch clears and rejects old-account response');}finally{h.dom.window.close()}
}
{
 const h=await harness();try{await h.click('Log Out');ok(h.signouts.length===1&&h.signouts[0].scope==='local','logout uses only the existing current-session API');ok(h.d.body.textContent.includes('Sign In to View')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'logout removes protected participant information');ok(h.w.localStorage.getItem('unrelated-setting')==='preserve'&&h.w.sessionStorage.getItem('unrelated-draft')==='preserve','logout preserves unrelated browser state');}finally{h.dom.window.close()}
}
{
 const h=await harness({logoutFailure:true});try{await h.click('Log Out');h.w.dispatchEvent(new h.w.Event('focus'));await h.auth({id:'synthetic-own-user',email:'own@example.test'},'TOKEN_REFRESHED');ok(h.d.body.textContent.includes('Your outreach details are hidden')&&!h.d.body.textContent.includes('Synthetic confirmed van'),'failed logout remains locked despite focus/auth refresh');ok(!h.d.body.textContent.includes('Private provider error'),'failed logout suppresses provider diagnostics');}finally{h.dom.window.close()}
}
{
 const h=await harness();try{h.w.dispatchEvent(new h.w.PageTransitionEvent('pagehide',{persisted:true}));ok(!h.d.getElementById('outreach-team-portal').textContent&&!h.d.getElementById('trip-account-email').textContent,'pagehide clears private browser snapshot');h.w.dispatchEvent(new h.w.PageTransitionEvent('pageshow',{persisted:true}));ok(h.reloads===1&&!h.d.getElementById('outreach-team-portal').textContent,'BFCache restoration reloads before exposing data');}finally{h.dom.window.close()}
}
{
 const h=await harness();try{Object.defineProperty(h.d,'visibilityState',{configurable:true,value:'hidden'});h.d.dispatchEvent(new h.w.Event('visibilitychange'));ok(!h.d.getElementById('outreach-team-portal').textContent,'hidden tab clears participant content');Object.defineProperty(h.d,'visibilityState',{configurable:true,value:'visible'});h.d.dispatchEvent(new h.w.Event('visibilitychange'));await tick();ok(h.calls.length===2&&h.d.body.textContent.includes('Synthetic confirmed van'),'visible tab refreshes current server authority');}finally{h.dom.window.close()}
}
ok(!source.includes('innerHTML')&&!source.includes('outreach_team_workspace')&&!source.includes('portal_account_links'),'no staff API, raw identity-link access or HTML interpolation');
console.log(n+' participant portal DOM/security checks passed (controlled synthetic Auth/RPC only)');

// Focused first-confirmation regression. Synthetic SDK/session only; no provider.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {inline} from '../outreach-login/generate.mjs';
const html=readFileSync(new URL('../../outreach-login.html',import.meta.url),'utf8'),script=inline(html),next='/outreach-team.html?campaign=11111111-1111-4111-8111-111111111111',search='?next='+encodeURIComponent(next),fragment='#access_token=synthetic-access&refresh_token=synthetic-refresh&type=signup';
const tick=()=>new Promise(r=>setImmediate(r));let n=0,scenarios=0;
const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
async function harness({hash=fragment,query=search,session=true,initError=false,restoreError=false,initEvent=false,restoreEvent=false,deferredInit=false,blockedStorage=false,source=script}={}){
 const dom=new JSDOM(html),calls={init:0,restore:0,verify:[],navigate:[],scrub:[],order:[],send:0};let callback,finish;
 const user={user:{id:'synthetic-signup-user'}},storage=new Map(),location={origin:'https://outreach.local.test',pathname:'/outreach-login.html',search:query,hash,set href(v){calls.navigate.push(v);calls.order.push('navigate')}};
 const auth={getSession:async()=>{calls.restore++;if(restoreEvent)callback('SIGNED_IN',user);if(restoreError)throw Error('SDK synthetic-private-secret');return session?user:null},client:{auth:{
  initialize:async()=>{calls.init++;if(initEvent)callback('SIGNED_IN',user);if(deferredInit)await new Promise(r=>finish=r);return{error:initError?Error('SDK synthetic-private-secret'):null}},
  onAuthStateChange:fn=>callback=fn,signInWithOtp:async()=>{calls.send++;return{}},
  verifyOtp:async args=>{calls.verify.push(args);return{data:{session:user}}}
 }}};
 vm.runInNewContext(source,{window:{ChampionLifeAuth:auth},document:dom.window.document,location,URL,URLSearchParams,setTimeout:f=>f(),history:{replaceState(_a,_b,v){calls.scrub.push(v);calls.order.push('scrub')}},sessionStorage:{getItem:k=>{if(blockedStorage)throw Error('blocked');return storage.get(k)},setItem:(k,v)=>{if(blockedStorage)throw Error('blocked');storage.set(k,v)},removeItem:k=>{if(blockedStorage)throw Error('blocked');storage.delete(k)}}});
 await tick();return{dom,calls,event:()=>callback('SIGNED_IN',user),finish:async()=>{finish();await tick()},close:()=>{dom.window.close();scenarios++}};
}
function scrubbed(h,label){ok(h.calls.scrub.length===1&&h.calls.scrub[0]==='/outreach-login.html?next='+encodeURIComponent(next),label+': URL retains only sanitized event destination');ok(!h.dom.window.document.body.textContent.includes('synthetic-private-secret'),label+': raw SDK/provider diagnostics never render')}
{
 const original=inline(readFileSync(new URL('../../discipleship-login.html',import.meta.url),'utf8')),h=await harness({source:original});try{ok(h.calls.init===0&&h.calls.navigate.length===0,'unchanged canonical source reproduces rejection of legitimate signup callback');ok(h.dom.window.document.getElementById('authMessage').textContent.includes('expired, was already used'),'original regression reproduced its false expired-link message')}finally{h.close()}
}
for(const options of[{}, {blockedStorage:true}, {initEvent:true}, {restoreEvent:true}]){
 const h=await harness(options);try{ok(h.calls.init===1&&h.calls.restore===1,'signup callback uses existing SDK initialization/session restore');ok(h.calls.verify.length===0&&h.calls.send===0,'signup fragment neither reverifies tokens nor requests another email');ok(h.calls.navigate.length===1&&h.calls.navigate[0]===next,'valid signup confirmation reaches the exact event destination');ok(h.calls.order.join(',')==='scrub,navigate','signup credentials are scrubbed before navigation/auth events');scrubbed(h,'valid signup');h.event();ok(h.calls.navigate.length===1,'late signup auth event cannot duplicate navigation')}finally{h.close()}
}
{
 const h=await harness({deferredInit:true});try{h.event();ok(h.calls.navigate.length===0&&h.calls.scrub.length===0,'early signup auth event cannot outrun SDK initialization');ok(h.dom.window.document.getElementById('sendCodeBtn').disabled,'signup callback holds sign-in controls while SDK initializes');await h.finish();ok(h.calls.order.join(',')==='scrub,navigate'&&h.calls.navigate[0]===next,'deferred valid signup scrubs credentials before its single redirect')}finally{h.close()}
}
for(const[label,options]of[['missing session',{session:false}],['SDK initialization error',{initError:true,initEvent:true}],['SDK restoration error',{restoreError:true,restoreEvent:true}],['provider error',{hash:fragment+'&error_code=otp_expired&error_description=synthetic-private-secret'}]]){
 const h=await harness(options);try{h.event();ok(h.calls.navigate.length===0,label+': cannot use an older/early session to claim successful signup');ok(h.calls.verify.length===0&&h.calls.send===0,label+': no extra Auth API/email operation');ok(h.dom.window.document.getElementById('authMessage').textContent.includes('expired, was already used'),label+': safe failure is shown');scrubbed(h,label)}finally{h.close()}
}
for(const[type,query]of[['signup&access_token=duplicate',search],['signup&type=signup',search],['signup&type=email',search],['email&type=signup',search],['magiclink&type=recovery',search],['recovery',search],['invite',search],['email_change',search],['',search],['signup',search+'&type=signup'],['signup',search+'&type=recovery'],['signup',search+'&type=']]){
 const h=await harness({hash:'#access_token=synthetic-access&refresh_token=synthetic-refresh&type='+type,query});try{h.event();ok(h.calls.init===0&&h.calls.restore===0&&h.calls.navigate.length===0,'wrong/duplicate/mixed implicit type rejected before SDK restore: '+type+' '+query.slice(search.length));scrubbed(h,'type refusal')}finally{h.close()}
}
for(const hash of['#access_token=synthetic-access&type=signup','#refresh_token=synthetic-refresh&type=signup']){
 const h=await harness({hash});try{h.event();ok(h.calls.init===0&&h.calls.navigate.length===0,'incomplete signup fragment remains rejected');scrubbed(h,'incomplete signup')}finally{h.close()}
}
// The single policy delta must not widen direct TokenHash APIs or accepted types.
for(const type of['email','magiclink','signup']){
 const h=await harness({hash:'',query:search+'&token_hash='+('a'.repeat(64))+'&type='+type});try{ok(h.calls.verify.length===(type==='signup'?0:1),'direct TokenHash verification type unchanged: '+type);ok(h.calls.navigate.length===(type==='signup'?0:1),'direct TokenHash outcome unchanged: '+type);if(type!=='signup')ok(h.calls.verify[0].type===type,'direct TokenHash API argument preserved');scrubbed(h,'direct TokenHash '+type)}finally{h.close()}
}
console.log(n+' focused signup callback checks passed across'+scenarios+' synthetic scenarios; no provider/session/account action');

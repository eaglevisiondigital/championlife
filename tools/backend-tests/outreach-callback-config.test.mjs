// Source-policy fixtures and real generated page code; all Auth facts synthetic.
// This does not execute GoTrue or contact a deployed Supabase project.
import assert from 'node:assert/strict';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
import {target,proposal,prepareCallbackChange,assertCallbackAdded,prepareCallbackRollback,assertCallbackRestored} from '../outreach-login/callback-config.mjs';
import {inline,verifyGenerated} from '../outreach-login/generate.mjs';

let n=0,scenarios=0;
const ok=(value,label)=>{assert.ok(value,label);n++;console.log('PASS '+label)};
const equal=(actual,expected,label)=>{assert.deepEqual(JSON.parse(JSON.stringify(actual)),expected,label);n++;console.log('PASS '+label)};
const refused=(fn,code,label)=>{assert.throws(fn,e=>e.code===code,label);n++;console.log('PASS '+label)};
const clone=value=>JSON.parse(JSON.stringify(value));
const baseline={site_url:target.siteUrl,uri_allow_list:target.existingCallback,
 smtp_host:'smtp.synthetic.test',smtp_port:465,smtp_user:'synthetic-user',smtp_pass:'SYNTHETIC-SECRET-DO-NOT-PRINT',
 mailer_templates_confirmation_content:'<a href="{{ .ConfirmationURL }}">Synthetic confirmation</a>',
 mailer_templates_magic_link_content:'<p>{{ .Token }}</p>',
 future_config_field:{flag:true,items:['synthetic-unchanged']}};
const added={...clone(baseline),uri_allow_list:proposal.patch.uri_allow_list};
const input={projectRef:target.projectRef,baseline,current:added};
await verifyGenerated();ok(true,'canonical generator, signup correction and equivalent matrices remain byte-preserved');
equal(JSON.parse(readFileSync(new URL('../../docs/releases/outreach-auth-callback-config.json',import.meta.url),'utf8')),proposal,'committed proposal exactly matches executable dry-run plan');
equal(prepareCallbackChange(input).patch,{uri_allow_list:target.existingCallback+','+target.outreachCallback},'proposal changes exactly one provider field with the old entry first and the sole exact addition');
equal(prepareCallbackRollback(input),{uri_allow_list:target.existingCallback},'rollback changes only the list and retains original course callback');
ok(assertCallbackAdded(input)&&assertCallbackRestored({...input,current:clone(baseline)}),'before/after/restored snapshots accept the exact bounded transition');
equal(proposal.changedFields,['uri_allow_list'],'Site URL, SMTP, templates and future settings are absent from provider patch');
ok(proposal.providerWritePerformed===false&&proposal.status==='PROPOSAL_ONLY','prepared plan is explicit about no provider execution');
for(const projectRef of ['',null,'nzumcermzbwsqnefyeib','other-project'])refused(()=>prepareCallbackChange({...input,projectRef}),'TARGET','incorrect or obsolete target refused: '+projectRef);
for(const mutate of [
 x=>x.site_url='https://changed.synthetic.test',x=>delete x.site_url,x=>x.uri_allow_list='',
 x=>x.uri_allow_list+=','+target.outreachCallback,x=>x.uri_allow_list+='/**',
 x=>x.uri_allow_list=[target.existingCallback],x=>x.uri_allow_list+=' ',
 x=>x.uri_allow_list=target.existingCallback+'?next=anything'
]){const x=clone(baseline);mutate(x);refused(()=>prepareCallbackChange({...input,baseline:x}),'BASELINE_DRIFT','preflight refuses changed/malformed/already-added baseline');}
for(const mutate of [
 x=>x.site_url+='/',x=>x.uri_allow_list=target.outreachCallback,
 x=>x.uri_allow_list+=','+target.outreachCallback,x=>x.uri_allow_list+=',https://other.synthetic.test/callback',
 x=>x.uri_allow_list=target.existingCallback+',https://championlifefwb.com/**',
 x=>x.smtp_host='different.synthetic.test',x=>x.smtp_pass='changed-secret',
 x=>x.mailer_templates_confirmation_content='<p>changed</p>',x=>delete x.mailer_templates_magic_link_content,
 x=>x.future_config_field.items.push('drift'),x=>x.new_unreviewed_setting=true
]){const x=clone(added);mutate(x);refused(()=>assertCallbackAdded({...input,current:x}),'CONFIG_DRIFT','postflight refuses extra/removal/replacement or unrelated setting drift');refused(()=>prepareCallbackRollback({...input,current:x}),'CONFIG_DRIFT','rollback refuses stale or later changed configuration');}
refused(()=>prepareCallbackRollback({...input,current:baseline}),'CONFIG_DRIFT','rollback refuses a callback that is no longer present');
refused(()=>assertCallbackRestored({...input,current:added}),'CONFIG_DRIFT','restored check refuses an unapplied rollback');
equal(baseline.smtp_pass,'SYNTHETIC-SECRET-DO-NOT-PRINT','pure review never mutates its caller snapshot');
{
 const dir=mkdtempSync(path.join(tmpdir(),'outreach-callback-review-'));
 try{
  const file=path.join(dir,'synthetic.json'),script=fileURLToPath(new URL('../outreach-login/callback-config.mjs',import.meta.url));
  for(const mode of ['before','after','rollback','restored']){
   writeFileSync(file,JSON.stringify({mode,...input,current:mode==='restored'?baseline:added}));
   const output=execFileSync(process.execPath,[script,'--check',file],{encoding:'utf8'});
   ok(JSON.parse(output).status==='PASS'&&!output.includes('SYNTHETIC-SECRET'),'offline executable '+mode+' returns redacted proof only');
  }
  writeFileSync(file,JSON.stringify({mode:'after',...input,current:{...added,smtp_pass:'changed-SYNTHETIC-SECRET'}}));
  try{execFileSync(process.execPath,[script,'--check',file],{encoding:'utf8',stdio:'pipe'});assert.fail('drift must refuse')}
  catch(e){ok(e.status===1&&!String(e.stdout+e.stderr).includes('SYNTHETIC-SECRET')&&String(e.stderr).includes('REFUSED CONFIG_DRIFT'),'CLI drift refusal prints no raw snapshot/provider credential diagnostics');}
 }finally{rmSync(dir,{recursive:true,force:true});}
}

// Bounded port of the relevant regular-HTTP/literal-entry branch of upstream
// IsRedirectURLValid, pinned in provenance. No glob, IP, loopback or URL-parser
// equivalence is claimed. Fail outside this fixture's declared supported domain.
function providerPolicyFixture(config,redirect){
 if(!redirect)return false;
 let site,url;try{site=new URL(config.site_url);url=new URL(redirect)}catch{return false}
 for(const value of [site,url]){
  if(!['http:','https:'].includes(value.protocol)||value.username||value.password||
    !/^[a-z][a-z0-9.-]*$/.test(value.hostname)||value.hostname==='localhost')throw Error('outside bounded fixture');
 }
 if(site.protocol===url.protocol&&site.hostname===url.hostname&&site.port===url.port)return true;
 const entries=config.uri_allow_list.split(',');
 if(entries.some(entry=>/[?*{}[\\]/.test(entry)))throw Error('outside literal-entry fixture');
 return entries.includes(redirect.split('#',1)[0]);
}
const html=readFileSync(new URL('../../outreach-login.html',import.meta.url),'utf8'),script=inline(html);
const tick=()=>new Promise(r=>setImmediate(r));
async function harness({query='',hash='',session=false,initError=false,missingDirectSession=false,blockedStorage=true}={}){
 const dom=new JSDOM(html),calls={send:[],verify:[],scrub:[],navigate:[],init:0,restore:0,order:[]};let callback;
 const location={origin:target.siteUrl,pathname:'/outreach-login.html',search:query,hash,set href(value){calls.navigate.push(value);calls.order.push('navigate')}};
 const storage=new Map();
 const auth={getSession:async()=>{calls.restore++;return session?{user:{id:'synthetic-user'}}:null},client:{auth:{
  initialize:async()=>{calls.init++;callback('SIGNED_IN',{user:{id:'synthetic-early'}});return{error:initError?Error('synthetic-private-provider-error'):null}},
  onAuthStateChange:fn=>callback=fn,
  signInWithOtp:async value=>{calls.send.push(value);return{}},
  verifyOtp:async value=>{calls.verify.push(value);callback('SIGNED_IN',{user:{id:'synthetic-early'}});return{data:{session:missingDirectSession?null:{user:{id:'synthetic-user'}}}}}
 }}};
 vm.runInNewContext(script,{window:{ChampionLifeAuth:auth},document:dom.window.document,location,URL,URLSearchParams,setTimeout:fn=>fn(),
  sessionStorage:{getItem:k=>{if(blockedStorage)throw Error('blocked');return storage.get(k)},setItem:(k,v)=>{if(blockedStorage)throw Error('blocked');storage.set(k,v)},removeItem:k=>storage.delete(k)},
  history:{replaceState:(_a,_b,value)=>{calls.scrub.push(value);calls.order.push('scrub')}}});
 await tick();return{calls,dom,event:()=>callback('SIGNED_IN',{user:{id:'synthetic-late'}}),
  async send(){dom.window.document.getElementById('loginEmail').value='synthetic@example.test';dom.window.document.getElementById('sendCodeBtn').click();await tick()},
  async code(value){dom.window.document.getElementById('loginCode').value=value;dom.window.document.getElementById('verifyCodeBtn').click();await tick()},
  close(){dom.window.close();scenarios++}};
}
for(const next of ['/outreach-team.html?campaign=11111111-1111-4111-8111-111111111111','/staff-outreach-team-travel.html?campaign=11111111-1111-4111-8111-111111111111','/outreach.html']){
 const q='?next='+encodeURIComponent(next),h=await harness({query:q});let redirect;
 try{
  await h.send();redirect=h.calls.send[0].options.emailRedirectTo;
  equal(redirect,target.outreachCallback+q,'actual generated emailRedirectTo retains the sanitized event query without storage');
  ok(providerPolicyFixture(baseline,redirect)&&providerPolicyFixture(added,redirect),'SiteURL-origin policy accepts actual generated query both before and after exact addition');
  const otherSite={...added,site_url:'https://different.synthetic.test'};
  ok(providerPolicyFixture(otherSite,target.outreachCallback)&&!providerPolicyFixture(otherSite,redirect),'literal entry alone accepts bare callback but does not match its next query on another SiteURL origin');
  ok(providerPolicyFixture(otherSite,target.outreachCallback+'#synthetic-fragment'),'upstream matching strips fragment but preserves query');
 }finally{h.close()}
 for(const type of ['signup','magiclink','email']){
  const u=new URL(redirect),r=await harness({query:u.search,hash:'#access_token=synthetic-access&refresh_token=synthetic-refresh&type='+type,session:true});
  try{equal(r.calls.navigate,[next],'fresh-storage '+type+' callback reaches exact generated event destination');equal(r.calls.order,['scrub','navigate'],type+' credentials scrub before navigation despite early SDK event');equal(r.calls.scrub,['/outreach-login.html'+q],type+' history keeps only sanitized destination');r.event();equal(r.calls.navigate,[next],type+' late event cannot duplicate redirect');equal(r.calls.verify,[],type+' SDK fragment does not invoke direct token API')}finally{r.close()}
 }
 for(const code of ['123456','12345678']){
  const r=await harness({query:q});try{await r.send();await r.code(code);equal(r.calls.navigate,[next],'manual '+code.length+'-digit code reaches exact event');equal(r.calls.verify,[{email:'synthetic@example.test',token:code,type:'email'}],'manual code API is unchanged')}finally{r.close()}
 }
}
for(const url of ['https://evil.synthetic.test/outreach-login.html','https://championlifefwb.com.evil.synthetic.test/outreach-login.html','http://championlifefwb.com/outreach-login.html','https://championlifefwb.com:8443/outreach-login.html'])ok(!providerPolicyFixture(added,url),'bounded policy fixture refuses unrelated host/scheme/port: '+url);
ok(providerPolicyFixture(baseline,target.siteUrl+'/different-path?query=1'),'SiteURL acceptance is broader than explicit paths; config entry is not an authorization boundary');
const next='/outreach-team.html?campaign=11111111-1111-4111-8111-111111111111',q='?next='+encodeURIComponent(next),tokens='#access_token=synthetic-access&refresh_token=synthetic-refresh';
for(const options of [
 {hash:tokens+'&type=signup&type=signup'}, {hash:tokens+'&type=signup&type=magiclink'},
 {hash:tokens+'&type=signup',query:q+'&type=signup'}, {hash:tokens+'&type=signup',query:q+'&type=email&type=signup'},
 {hash:tokens+'&type=signup&access_token=duplicate'}, {hash:tokens+'&type=signup&refresh_token=duplicate'},
 {query:q+'&token_hash='+('a'.repeat(64))+'&token_hash='+('b'.repeat(64))+'&type=email'},
 {query:q+'&token_hash='+('a'.repeat(64))+'&type=email&type=magiclink'},
 {query:q+'&token_hash='+('a'.repeat(64))+'&type=email',hash:tokens+'&type=signup'},
 {hash:tokens+'&type=signup',initError:true}, {hash:tokens+'&type=signup',session:false},
 {hash:tokens+'&type=signup&error_description=synthetic-private-provider-error&error_code=otp_expired'}
]){
 const h=await harness({query:q,session:true,...options});
 try{h.event();equal(h.calls.navigate,[],'malformed/ambiguous/missing/error callback cannot use an old session or late event');equal(h.calls.scrub,['/outreach-login.html'+q],'refused query/fragment callback scrubs every credential/type/error from history');ok(!h.dom.window.document.body.textContent.includes('synthetic-private-provider-error'),'provider diagnostics remain redacted')}finally{h.close()}
}
console.log(n+' callback configuration/provider-policy assertions passed across '+scenarios+' generated-page scenarios; no provider/account/message action');

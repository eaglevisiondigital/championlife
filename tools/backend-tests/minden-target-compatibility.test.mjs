// Target-only, fictional transport checks. No remote project or deployment exists here.
import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {mkdtemp,readFile,mkdir,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';import path from 'node:path';import vm from 'node:vm';
import {previewConfiguration,buildSite} from '../site-build/build.mjs';
import {createRegistrationHandler} from '../../supabase/functions/outreach-registration-submit/gateway.mjs';
const target='https://apovvmvuljfspobribjv.supabase.co';
const origin='https://minden-acceptance--championlifechurch.netlify.app';
const hostname=new URL(origin).hostname,production={url:'https://exdocjbmylgxssanymjk.supabase.co',publishableKey:'sb_publishable_production_sentinel'};
const preview={CONTEXT:'branch-deploy',DEPLOY_PRIME_URL:origin,CHAMPION_PREVIEW_SUPABASE_URL:target,CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:'sb_publishable_fictional_minden'};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++checks)+' '+m)};
ok(previewConfiguration(preview,production)?.url===target,'exact proposed origin and target accepted only as a nonproduction preview');
for(const change of[{CONTEXT:'production'},{CONTEXT:'dev'},{CONTEXT:''},{DEPLOY_PRIME_URL:undefined},{DEPLOY_PRIME_URL:'https://championlifechurch.netlify.app'},{DEPLOY_PRIME_URL:'https://minden-acceptance--championlifechurch.netlify.app.evil.test'},{DEPLOY_PRIME_URL:origin+'/'},{DEPLOY_PRIME_URL:origin+'/minden/'},{CHAMPION_PREVIEW_SUPABASE_URL:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co'},{CHAMPION_PREVIEW_SUPABASE_URL:production.url},{CHAMPION_PREVIEW_SUPABASE_URL:target+'/'},{CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:'sb_secret_NOT_A_PUBLIC_KEY'},{CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY:production.publishableKey}])ok(previewConfiguration({...preview,...change},production)===null,'preview rejects '+JSON.stringify(change));
const cfg={url:target,serviceKey:'FICTIONAL_SERVER_ONLY',pepper:'fictional'.repeat(8),turnstileSecret:'1x0000000000000000000000000000000AA',action:'outreach-registration',hostnames:[hostname],origins:[origin],mode:'acceptance'};
const request=(changes={})=>new Request(target+'/functions/v1/outreach-registration-submit',{method:changes.method||'POST',headers:{'content-type':'application/json',origin:changes.origin||origin,'cf-connecting-ip':'192.0.2.123'},...(changes.method==='OPTIONS'?{}:{body:JSON.stringify({slug:changes.slug||'minden-family-fun-day',payload:{request_key:'fictional'},turnstile_token:'XXXX.DUMMY.TOKEN.XXXX'})})});
async function run(config=cfg,changes={},verification={success:true,hostname:'example.com',metadata:{result_with_testing_key:true}}){const calls=[];const handler=createRegistrationHandler(config,async(url,init)=>{calls.push({url,init});if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return new Response(JSON.stringify(verification));assert.equal(url,target+'/rest/v1/rpc/outreach_registration_gateway');return new Response(JSON.stringify({accepted:true,reference:'R-ABCDEF0123456789',attendee_count:2,PRIVATE:'MUST_NOT_LEAK'}))});return{response:await handler(request(changes)),calls}}
let r=await run();ok(r.response.status===200&&r.calls.length===2,'exact Minden acceptance profile reaches only dedicated canonical RPC');ok(JSON.stringify(await r.response.json())==='{"accepted":true,"reference":"R-ABCDEF0123456789","attendee_count":2}','response projection preserves approved minimum fields');
const sent=JSON.parse(r.calls[1].init.body);ok(sent.p_slug==='minden-family-fun-day'&&/^[a-f0-9]{64}$/.test(sent.p_network),'exact Minden slug and trusted-ingress HMAC retained');
for(const change of[{mode:'production'},{mode:''},{origins:[origin,'https://championlifechurch.netlify.app']},{origins:['https://other.invalid']},{hostnames:[hostname,'championlifechurch.netlify.app']},{hostnames:['other.invalid']},{action:'other'},{url:'https://aaaaaaaaaaaaaaaaaaaa.supabase.co'},{url:production.url}]){r=await run({...cfg,...change});ok(r.response.status>=400&&r.calls.length===0,'gateway rejects incompatible profile '+JSON.stringify(change));}
for(const change of[{slug:'huntsville-2026'},{slug:'bessemer-2026'},{slug:'minden-family-fun-day-other'},{origin:'https://championlifechurch.netlify.app'},{origin:origin+'.evil.test'}]){r=await run(cfg,change);ok(r.response.status>=400&&r.calls.length===0,'gateway denies wrong campaign/origin before verification or database '+JSON.stringify(change));}
for(const invalid of [{...cfg,mode:'production'},{...cfg,origins:[origin,'https://championlifechurch.netlify.app']}]){r=await run(invalid,{method:'OPTIONS'});ok(r.response.status===503&&!r.response.headers.has('access-control-allow-origin')&&r.calls.length===0,'invalid target profile cannot authorize a CORS preflight');}
r=await run(cfg,{method:'OPTIONS'});ok(r.response.status===204&&r.calls.length===0&&r.response.headers.get('access-control-allow-origin')===origin,'exact-origin preflight does not invoke provider or database');
for(const verification of[{success:false},{success:true,hostname:'example.com',metadata:{}},{success:true,hostname:'other.invalid',action:'outreach-registration'},{success:true,hostname,action:'other'}]){r=await run(cfg,{},verification);ok(r.response.status===400&&r.calls.length===1,'invalid challenge cannot reach canonical RPC');}
// Real-key mode still requires exact origin/action/hostname and acceptance mode.
r=await run({...cfg,turnstileSecret:'FICTIONAL_NON_DUMMY'},{},{success:true,hostname,action:'outreach-registration'});ok(r.response.status===200,'exact target permits ordinary verified acceptance challenge without changing origin/campaign boundary');
r=await run({...cfg,turnstileSecret:'FICTIONAL_NON_DUMMY',mode:'production'},{},{success:true,hostname,action:'outreach-registration'});ok(r.response.status===503&&r.calls.length===0,'new target remains acceptance-only even without a test key');
const root=await mkdtemp(path.join(tmpdir(),'minden-target-build-'));
try{
 await mkdir(path.join(root,'tools/site-build'),{recursive:true});await mkdir(path.join(root,'assets/js'),{recursive:true});await writeFile(path.join(root,'tools/site-build/public-files.json'),JSON.stringify(['assets/js/supabase-config.js']));const original='window.CHAMPION_LIFE_SUPABASE = '+JSON.stringify(production)+';';await writeFile(path.join(root,'assets/js/supabase-config.js'),original);
 for(const context of['branch-deploy','deploy-preview']){const result=await buildSite({root,env:{...preview,CONTEXT:context}});ok(result.backend==='isolated-preview','actual '+context+' build selects exact target');const text=await readFile(path.join(root,'dist/assets/js/supabase-config.js'),'utf8'),box={window:{}};vm.runInNewContext(text,box);ok(box.window.CHAMPION_LIFE_SUPABASE.url===target&&!text.includes(production.url)&&!text.includes('FICTIONAL_SERVER_ONLY'),'actual preview contains no production endpoint or server credential');}
 await buildSite({root,env:{...preview,DEPLOY_PRIME_URL:'https://wrong.invalid'}});ok((await readFile(path.join(root,'dist/assets/js/supabase-config.js'),'utf8')).includes('window.CHAMPION_LIFE_SUPABASE = null'),'wrong-origin actual preview build fails closed');
 await buildSite({root,env:{...preview,CONTEXT:'production'}});ok(await readFile(path.join(root,'dist/assets/js/supabase-config.js'),'utf8')===original,'production build remains byte-for-byte source configuration; preview env cannot replace it');
}finally{await rm(root,{recursive:true,force:true})}
console.log(checks+' exact-target compatibility checks PASS; synthetic only; proposed preview UNCREATED; hosted readiness HOLD');
const proposed=await readFile(new URL('../../supabase/release/minden-acceptance-functions.toml',import.meta.url),'utf8');
assert.equal(proposed.split('\n').filter(line=>line.trim()&&!line.trim().startsWith('#')).join('\n'),'[functions.outreach-registration-submit]\nverify_jwt = false');
assert.match(proposed,/apovvmvuljfspobribjv only/);
await assert.rejects(readFile(new URL('../../supabase/config.toml',import.meta.url)),{code:'ENOENT'});
const publicHandler=await readFile(new URL('../../assets/js/outreach-registration-public.js',import.meta.url),'utf8');
assert.match(publicHandler,/headers:\{'Content-Type':'application\/json'\}/);assert.doesNotMatch(publicHandler,/Authorization:|Bearer sb_publishable/);
console.log('PASS target-only UNINSTALLED function template; no global configuration or browser credential workaround');

const reader=await readFile(new URL('../../king-kind-reader.html',import.meta.url),'utf8');
for(const currentOrigin of [origin,'https://championlifefwb.com']){
 const dom=new JSDOM(reader,{url:currentOrigin+'/king-kind-reader.html?source=minden'});
 try{assert.equal(dom.window.document.querySelector('#login-link').href,currentOrigin+'/discipleship-login.html?next=%2Fking-kind-reader.html');}
 finally{dom.window.close()}
}
console.log('PASS actual reader HTML stays on proposed preview and preserves the exact production login destination');
// Source-derived existing login sanitizer, not a replacement Auth or route policy.
const loginSource=await readFile(new URL('../../discipleship-login.html',import.meta.url),'utf8');
const sanitizer=loginSource.match(/function sanitizeNext\(value\) \{[\s\S]*?\n  \}\n  const params/);
assert.ok(sanitizer,'existing login route sanitizer present');
const sourceFunction=sanitizer[0].replace(/\n  const params$/,'');
const sanitize=vm.runInNewContext('('+sourceFunction+')',{URL,location:{origin}});
assert.equal(sanitize('/staff-minden-decisions.html'),'/staff-minden-decisions.html');
assert.equal(sanitize('/staff-outreach-registration.html'),'/staff-outreach-registration.html');
assert.equal(sanitize('/king-kind-reader.html'),'/king-kind-reader.html');
assert.equal(sanitize('https://championlifefwb.com/staff-minden-decisions.html'),'/my-discipleship.html');
assert.equal(sanitize('//championlifefwb.com/staff-minden-decisions.html'),'/my-discipleship.html');
console.log('PASS actual login sanitizer accepts bounded Minden/registration/book destinations and rejects production-origin return hints');

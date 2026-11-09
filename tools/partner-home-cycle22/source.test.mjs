import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {current,original,expectedRuntime,expectedRouter,verifyActual,checkpointReader,runtime,modified,reviewedHashes,root,registrationRuntime,expectedRegistrationRuntime} from './source.mjs';
const alter=(p,b)=>x=>x===p?Buffer.from(b):current(x);
test('actual123 includes only reviewed home return, continuity and bounded routers',()=>{const v=verifyActual();assert.equal(v.hostedAcceptance,false);assert.equal(v.releaseAuthorized,false);assert.deepEqual(current(runtime),expectedRuntime())});
test('financial and People permissions remain separate and fresh',()=>{for(const marker of ["['outreach.view','finance.read',...(link.dataset.partnerReturn==='home'?[]:['people.read'])]","!required.every(key=>latest.grants","await rpc('staff_workspace_context',{},link)","org!==organization||!currentControl(link))return;","if(!required.every(can))continue;"]){const s=current(runtime).toString();assert(s.includes(marker));assert.throws(()=>verifyActual(alter(runtime,s.replace(marker,'/* removed */'))),/Exact123/)} });
test('every exact router and continuity derivation rejects unreviewed source',()=>{for(const p of modified.filter(p=>p!==runtime)){assert.deepEqual(current(p),expectedRouter(p));assert.throws(()=>verifyActual(alter(p,original(p))),/Exact123/)} });
test('projection follows current verification; historical assertions and workflow timeouts exact',()=>{const read=checkpointReader();for(const p of modified)assert.deepEqual(read(p),original(p));for(const p of ['tools/staff-financial-navigation-cycle21/source.test.mjs','tools/staff-runtime-cycle14/source.test.mjs','.github/workflows/staff-financial-navigation-cycle21.yml','.github/workflows/staff-runtime-cycle14.yml']){assert.deepEqual(current(p),original(p));assert.throws(()=>verifyActual(alter(p,Buffer.alloc(0))),/Exact123/)} });
test('SQL, task lifetimes, session, SDK, other modules and deployment remain exact123',()=>{for(const p of ['supabase/migrations/20261022201357_operations_admin_security.sql','assets/js/outreach-people.js','assets/js/staff-workspace.js','assets/js/staff-session.js','assets/js/champion-life-auth.js','staff-outreach-partners.html','assets/js/communications.js','assets/js/forms-admin.js','assets/js/staff-events.js','assets/js/dream-team-manual.js','tools/site-build/public-files.json','netlify.toml'])assert.throws(()=>verifyActual(alter(p,Buffer.concat([current(p),Buffer.from('\n/* unreviewed */')]))),/Exact123/)} );
test('all added tests, workflow and recipe pinned',()=>{for(const p of Object.keys(reviewedHashes))assert.throws(()=>verifyActual(alter(p,Buffer.alloc(0))),/Independent reviewed addition/)} );
test('unlisted file cannot hide behind historical projection',()=>{const script=String.raw`
import child from 'node:child_process';import {syncBuiltinESMExports}from'node:module';import assert from'node:assert/strict';const original=child.execFileSync;child.execFileSync=(file,args,options)=>file==='git'&&args[0]==='ls-files'?original(file,args,options)+'tools/partner-home-cycle22/unauthorized.mjs\n':original(file,args,options);syncBuiltinESMExports();const{verifyActual}=await import('./tools/partner-home-cycle22/source.mjs');assert.throws(()=>verifyActual(),/Unlisted composition file/);console.log('EXPECTED_REJECTION');`;assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8'}).trim(),'EXPECTED_REJECTION')});

test('registration pre-dispatch correction retains exact PR134/135 input and Staff126 parent equality',()=>{
 const read=(ref,p)=>execFileSync('git',['show',ref+':'+p],{cwd:root});
 assert.deepEqual(original(registrationRuntime),read('95723fae9d4cbc16eb80e350191495b4d37d4498',registrationRuntime));
 assert.deepEqual(original(registrationRuntime),read('0c246a96ccd9e280dd423eb91c623559b7fdb064^',registrationRuntime));
 const recipes=JSON.parse(current('tools/partner-home-cycle22/derivations.json'));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime][1][0]),read('0c246a96ccd9e280dd423eb91c623559b7fdb064',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-7)[0]),read('8691d618f29e8988c51928132aa4a622276c5e8d',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-6)[0]),read('7adeec04d466937b85fce15b998242a4075b5037',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-5)[0]),read('3d03a59f2fbd5c235d5761f6a59b9fdaaa202a72',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-4)[0]),read('1d5d884259d49f4bf3c6e644341a5167a0bf4b2e',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-3)[0]),read('f31a7829be6ad46047d0556bdcd46934e4c12a75',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-2)[0]),read('5e1dcbfccbc5751b2131ffb7cb4fe09e5ecee54a',registrationRuntime));
 assert.deepEqual(Buffer.from(recipes[registrationRuntime].at(-1)[0]),read('6a0c1bc121eb8dbf7873046c6485d37e72ce91d8',registrationRuntime));
 const priorRecipes=JSON.parse(read('6a0c1bc121eb8dbf7873046c6485d37e72ce91d8','tools/partner-home-cycle22/derivations.json'));
 for(const [path,pairs]of Object.entries(priorRecipes))assert.deepEqual(recipes[path].slice(0,pairs.length),pairs,'Every original derivation remains intact: '+path);
 assert.deepEqual(current(registrationRuntime),expectedRegistrationRuntime());
 for(const text of [original(registrationRuntime),Buffer.concat([current(registrationRuntime),Buffer.from('/* unreviewed */')])])assert.throws(()=>verifyActual(alter(registrationRuntime,text)),/Exact123/);
 for(const name of ['registration-checkin-journey.browser.mjs','registration-checkin-status.native.mjs'])assert.deepEqual(current('tools/partner-home-cycle22/'+name),read('0c246a96ccd9e280dd423eb91c623559b7fdb064','tools/outreach/'+name));
});

// Independently authored actual-runtime lifetime checks. Fictional transport only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {pathToFileURL,fileURLToPath} from 'node:url';
const root=resolve(process.env.PEOPLE_SOURCE_ROOT||fileURLToPath(new URL('../..',import.meta.url)));
const dependency=process.env.PLAYWRIGHT_MODULE||resolve(root,'tools/backend-tests/node_modules/playwright/index.mjs');
const {chromium,webkit}=await import(pathToFileURL(dependency));
const original=process.env.PEOPLE_ORIGINAL==='1',ref=process.env.PEOPLE_REF;
const read=p=>ref?execFileSync('git',['show',ref+':'+p],{cwd:root,encoding:'utf8'}):readFileSync(resolve(root,p),'utf8');
const runtime=read('assets/js/outreach-people.js'),common=read('assets/js/outreach-staff-common.js');
let checks=0;const results=[];const check=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
const scenarios=['normal-status','normal-due','normal-clear','button-before','card-before','controls-before','ancestor-before','extracted-before','button-held','card-held','controls-held','ancestor-held','extracted-held','button-detached','card-detached','account-held','silent-account-held','organization-held','revocation-held','session-retired-held','already-submitted','conflict-review','uncertain-review','conflict-review-retired','uncertain-review-retired'];
for(const [engine,type] of [['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const mode of scenarios){
  const page=await browser.newPage({viewport:{width:engine==='chromium'?390:1440,height:900}}),errors=[];
  page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{assert.equal(new URL(r.request().url()).origin,'https://people-lifetime.invalid');return r.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'})});
  await page.goto('https://people-lifetime.invalid/staff-people.html?org=org-a&person=11111111-1111-4111-8111-111111111111');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};window.caps=['people.read','followup.read','followup.manage'];window.calls=[];window.timeline=[];window.live=true;window.retiredAt=null;
   window.P='11111111-1111-4111-8111-111111111111';window.task={id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001',title:'Fictional follow-up',status:'open',due_on:'2026-12-01',revision:7,created_at:'2026-11-06T01:02:03.123456Z'};
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(name,p)=>{
    calls.push({kind:'rpc',name,...p});
    if(name==='staff_workspace_context'){
     if(window.holdPermissions){holdPermissions=false;timeline.push('permissions-held');await new Promise(r=>window.releasePermissions=r)}
     return{data:{organizations:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))}};
    }
    if(p.p_action==='list')return{data:[{id:P,first_name:'Fictional',last_name:'Person'}]};
    if(p.p_action==='detail')return{data:{person:{id:P,first_name:'Fictional',last_name:'Person'},relationships:[]}};
    throw Error('Unexpected RPC');
   },from:table=>{
    const spec={kind:'table',table,filters:[]};const q={select:v=>(spec.select=v,q),eq:(k,v)=>(spec.filters.push([k,v]),q),order:()=>q,limit:n=>(spec.limit=n,q),or:s=>(spec.or=s,q),update:p=>(spec.update=structuredClone(p),q),maybeSingle:()=>q,then:async(resolve,reject)=>{try{
     calls.push(structuredClone(spec));
     if(spec.update){
      timeline.push('mutation-submitted');
      if(window.conflict)return resolve({data:null});
      if(window.uncertain)return resolve({error:{code:'XX000',message:'PRIVATE_UNCERTAIN'}});
      if(window.holdMutation){holdMutation=false;await new Promise(r=>window.releaseMutation=r)}
      if(spec.filters.find(f=>f[0]==='revision')?.[1]!==task.revision)return resolve({data:null});
      Object.assign(task,spec.update);task.revision++;return resolve({data:{id:task.id}});
     }
     resolve({data:[structuredClone(task)]});
    }catch(e){reject(e)}}};return q;
   }}};
  });
  await page.addScriptTag({content:common});await page.addScriptTag({content:runtime});
  await page.getByRole('button',{name:'Save task status',exact:true}).waitFor();
  await page.evaluate(mode=>{
   window.oldButton=[...document.querySelectorAll('button')].find(x=>x.textContent===(mode==='normal-due'?'Save due date':mode==='normal-clear'?'Remove due date':'Save task status'));
   window.oldHandler=oldButton.onclick;window.oldCard=oldButton.closest('article');window.oldControls=oldButton.parentElement;window.oldContent=oldCard.parentElement;window.originalParent=oldContent.parentElement;
   oldCard.querySelector('select').value='completed';oldCard.querySelector('input[type=date]').value='2026-12-05';
   window.retire=kind=>{
    timeline.push('retired');retiredAt=calls.filter(c=>c.update).length;
    const node=kind==='button'?oldButton:kind==='controls'?oldControls:kind==='ancestor'?oldContent:oldCard;
    const parent=node.parentElement,next=node.nextSibling;node.remove();
    if(kind==='extracted'){originalParent.append(oldCard);return}
    if(!mode.endsWith('detached'))parent.insertBefore(node,next);
   };
   if(mode.endsWith('held'))holdPermissions=true;
   if(mode==='already-submitted')holdMutation=true;
   if(mode.startsWith('conflict-'))conflict=true;
   if(mode.startsWith('uncertain-'))uncertain=true;
  },mode);
  if(mode.endsWith('before')||mode.endsWith('detached'))await page.evaluate(mode=>{retire(mode.split('-')[0]);window.intent=Promise.resolve(oldHandler())},mode);
  else await page.evaluate(()=>{window.intent=Promise.resolve(oldHandler()).then(()=>{window.intentDone=true})});
  if(mode.endsWith('held')){
   await page.waitForFunction(()=>typeof releasePermissions==='function');
   await page.evaluate(mode=>{
    if(mode==='account-held'){actor={id:'actor-b'};authChange('SIGNED_IN',{user:actor})}
    else if(mode==='silent-account-held')actor={id:'actor-b'};
    else if(mode==='organization-held'){const s=document.querySelector('select[aria-label=Organization]');s.value='org-b';s.dispatchEvent(new Event('change'))}
    else if(mode==='revocation-held')caps=['people.read'];
    else if(mode==='session-retired-held')window.dispatchEvent(new Event('staff-protected-clear'));
    else retire(mode.split('-')[0]);
    releasePermissions();
   },mode);
  }
  if(mode==='already-submitted'){
   await page.waitForFunction(()=>typeof releaseMutation==='function');
   check(await page.evaluate(()=>calls.filter(c=>c.update).length),1,engine+' already-submitted request predates retirement');
   await page.evaluate(()=>{retire('card');releaseMutation()});
  }
  await page.evaluate(()=>intent);await page.waitForTimeout(30);
  const observed=await page.evaluate(()=>({writes:calls.filter(c=>c.update),timeline,retiredAt,revision:task.revision,storage:localStorage.length+sessionStorage.length}));
  const knownOriginalGap=/^(button|card|controls|ancestor|extracted)-(before|held)$/.test(mode)||mode==='button-detached';
  const expected=mode.startsWith('normal-')||mode.includes('-review')||mode==='already-submitted'||original&&knownOriginalGap?1:0;
  check(observed.writes.length,expected,engine+' '+mode+' mutation count');
  if(observed.writes.length){check(observed.writes[0].filters,[['organization_id','org-a'],['person_id','11111111-1111-4111-8111-111111111111'],['id','aaaaaaaa-aaaa-4aaa-8aaa-000000000001'],['revision',7]],engine+' '+mode+' exact original scope/revision');}
  if(mode==='already-submitted'){check(observed.timeline.indexOf('mutation-submitted')<observed.timeline.indexOf('retired'),true,engine+' write issued before retirement');check(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Save task status'&&b!==oldButton).length),original?1:0,engine+' no fresh editor created by retired submitted response');}
  else if(original&&knownOriginalGap)check(observed.timeline.indexOf('mutation-submitted')>observed.timeline.indexOf('retired'),true,engine+' '+mode+' NEW mutation issued after retirement');
  const before=observed.writes.length;await page.evaluate(()=>Promise.resolve(oldHandler()));await page.waitForTimeout(20);
  check(await page.evaluate(()=>calls.filter(c=>c.update).length),before,engine+' '+mode+' captured handler cannot add another mutation');
  if(mode.includes('-review')){
   const refresh=page.getByRole('button',{name:'Refresh follow-up tasks',exact:true});await refresh.waitFor();
   check(await page.getByRole('button',{name:'Save task status',exact:true}).count(),0,engine+' '+mode+' old edits removed');
   await page.evaluate(()=>{window.oldReview=[...document.querySelectorAll('button')].find(x=>x.textContent==='Refresh follow-up tasks');window.reviewHandler=oldReview.onclick;window.reviewCalls=calls.length;window.conflict=false;window.uncertain=false;});
   if(mode.endsWith('retired'))await page.evaluate(()=>{const parent=oldReview.parentElement;oldReview.remove();parent.append(oldReview);});
   await page.evaluate(()=>reviewHandler());await page.waitForTimeout(30);
   const expectedRefresh=!mode.endsWith('retired')||original;
   check(await page.evaluate(()=>calls.length>reviewCalls),expectedRefresh,engine+' '+mode+' safe read-only refresh admission');
   check(await page.evaluate(()=>calls.filter(c=>c.update).length),before,engine+' '+mode+' refresh issues no mutation');
   check((await page.locator('body').innerText()).includes('PRIVATE_UNCERTAIN'),false,engine+' '+mode+' transport detail remains private');
  }
  check(observed.storage,0,engine+' '+mode+' no private browser storage');check(errors,[],engine+' '+mode+' no browser errors');results.push({engine,mode,...observed});await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,sourceRoot:root,ref:ref||null,original,runtimeSHA256:createHash('sha256').update(runtime).digest('hex'),results,genuineAuth:false}));

// Independent Cycle20 actual-runtime task-create lifetime review. Fictional origin only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
import {createHash} from 'node:crypto';
const root=resolve(process.env.PEOPLE_SOURCE_ROOT||fileURLToPath(new URL('../..',import.meta.url)));
const {chromium,webkit}=await import(pathToFileURL(process.env.PLAYWRIGHT_MODULE||resolve(root,'tools/backend-tests/node_modules/playwright/index.mjs')));
const runtime=readFileSync(resolve(root,'assets/js/outreach-people.js'),'utf8'),common=readFileSync(resolve(root,'assets/js/outreach-staff-common.js'),'utf8');
const original=process.env.PEOPLE_ORIGINAL==='1';let checks=0;const cases=[];const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const modes=['normal','button-before','form-before','card-before','ancestor-before','input-before','label-before','body-before','extracted-before','button-held','form-held','card-held','ancestor-held','input-held','button-detached','form-detached','account-held','organization-held','revoked-held','client-held','already-submitted','unknown','unknown-retired'];
for(const[engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const mode of modes){
  const page=await browser.newPage({viewport:{width:engine==='chromium'?390:1440,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
  await page.route('**/*',r=>{assert.equal(new URL(r.request().url()).origin,'https://task-create.invalid');return r.fulfill({contentType:'text/html',body:'<main id="outreach-people"></main>'})});
  await page.goto('https://task-create.invalid/staff-people.html?org=org-a&person=11111111-1111-4111-8111-111111111111');
  await page.evaluate(()=>{
   window.actor={id:'actor-a'};window.caps=['people.read','followup.read','followup.manage'];window.calls=[];window.timeline=[];window.live=true;window.StaffWorkspace={active:()=>live,navigate:path=>{window.navigation=path;live=false;window.dispatchEvent(new Event('staff-protected-clear'))}};
   window.ChampionLifeAuth={getUser:async()=>actor,getSession:async()=>actor?{user:actor}:null,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:async(name,p)=>{
    calls.push({kind:'rpc',name,...p});
    if(name==='staff_workspace_context'){if(window.holdPermission){holdPermission=false;timeline.push('permission-held');await new Promise(r=>window.releasePermission=r)}return{data:{organizations:[{id:'org-a',name:'A'},{id:'org-b',name:'B'}],grants:['org-a','org-b'].flatMap(organization_id=>caps.map(permission=>({organization_id,permission,department_ids:null})))}}}
    if(p.p_action==='list')return{data:[]};if(p.p_action==='detail')return{data:{person:{id:'11111111-1111-4111-8111-111111111111',first_name:'Fictional',last_name:'Person'},relationships:[]}};throw Error('Unexpected RPC');
   },from:table=>{
    const spec={kind:'table',table,filters:[]},q={select:v=>(spec.select=v,q),eq:(k,v)=>(spec.filters.push([k,v]),q),order:()=>q,limit:n=>(spec.limit=n,q),or:()=>q,insert:p=>(spec.insert=structuredClone(p),q),single:()=>q,then:async(resolve,reject)=>{try{
     calls.push(structuredClone(spec));if(spec.insert){timeline.push('insert-submitted');if(window.holdInsert){holdInsert=false;await new Promise(r=>window.releaseInsert=r)}if(window.unknown)return resolve({error:{code:'XX000',message:'PRIVATE_TRANSPORT_DETAIL'}});return resolve({data:{id:'aaaaaaaa-aaaa-4aaa-8aaa-000000000001'}})}resolve({data:[]});
    }catch(e){reject(e)}}};return q;
   }}};
  });
  await page.addScriptTag({content:common});await page.addScriptTag({content:runtime});await page.getByRole('button',{name:'Add follow-up task',exact:true}).waitFor();
  await page.evaluate(mode=>{
   window.oldButton=[...document.querySelectorAll('button')].find(x=>x.textContent==='Add follow-up task');window.oldForm=oldButton.form;window.oldHandler=oldForm.onsubmit;window.oldCard=oldForm.parentElement;window.oldContent=oldCard.parentElement;window.oldTitle=oldForm.querySelector('input[type=text]');window.oldDue=oldForm.querySelector('input[type=date]');
   oldTitle.value='Fictional authorized next step';oldDue.value='2026-12-08';window.invoke=()=>Promise.resolve(oldHandler({preventDefault(){}}));
   window.retire=kind=>{timeline.push('retired');const node=kind==='button'?oldButton:kind==='form'?oldForm:kind==='ancestor'?oldContent:kind==='input'?oldTitle:kind==='label'?oldTitle.parentElement:kind==='body'?document.body:oldCard;const parent=node.parentNode,next=node.nextSibling;node.remove();if(kind==='extracted'){document.getElementById('outreach-people').append(oldForm);return}if(!mode.endsWith('detached'))parent.insertBefore(node,next)};
   if(mode.endsWith('held'))holdPermission=true;if(mode==='already-submitted')holdInsert=true;if(mode.startsWith('unknown'))unknown=true;
  },mode);
  if(mode.endsWith('before')||mode.endsWith('detached'))await page.evaluate(mode=>{retire(mode.split('-')[0]);window.intent=invoke()},mode);else await page.evaluate(()=>{window.intent=invoke()});
  if(mode.endsWith('held')){await page.waitForFunction(()=>typeof releasePermission==='function');await page.evaluate(mode=>{
   if(mode==='account-held'){actor={id:'actor-b'};authChange('SIGNED_IN',{user:actor})}
   else if(mode==='organization-held'){const s=document.querySelector('select[aria-label=Organization]');s.value='org-b';s.dispatchEvent(new Event('change'))}
   else if(mode==='revoked-held')caps=['people.read'];else if(mode==='client-held')ChampionLifeAuth.client={...ChampionLifeAuth.client};else retire(mode.split('-')[0]);releasePermission();
  },mode)}
  if(mode==='already-submitted'){await page.waitForFunction(()=>typeof releaseInsert==='function');eq(await page.evaluate(()=>calls.filter(x=>x.insert).length),1,engine+' submittedbefore retirement');await page.evaluate(()=>{retire('card');releaseInsert()})}
  await page.evaluate(()=>intent);await page.waitForTimeout(25);
  const result=await page.evaluate(()=>({writes:calls.filter(x=>x.insert),timeline,storage:localStorage.length+sessionStorage.length}));
  const gap=/^(button|form|card|ancestor|input|label|body|extracted)-(before|held)$/.test(mode)||mode==='button-detached';const expected=mode==='normal'||mode==='already-submitted'||mode.startsWith('unknown')||original&&gap?1:0;
  eq(result.writes.length,expected,engine+' '+mode+' insert count');
  if(result.writes.length)eq(result.writes[0].insert,{organization_id:'org-a',person_id:'11111111-1111-4111-8111-111111111111',title:'Fictional authorized next step',due_on:'2026-12-08'},engine+' '+mode+' exactserverbound source scope');
  if(original&&gap)eq(result.timeline.indexOf('insert-submitted')>result.timeline.indexOf('retired'),true,engine+' '+mode+' NEW insert afterretirement');
  if(mode==='already-submitted'){eq(result.timeline.indexOf('insert-submitted')<result.timeline.indexOf('retired'),true,engine+' submittedbefore retired');eq(await page.evaluate(()=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Add follow-up task'&&b!==oldButton).length),original?1:0,engine+' no late fresh editor afterretirement')}
  await page.evaluate(()=>invoke());eq(await page.evaluate(()=>calls.filter(x=>x.insert).length),expected,engine+' '+mode+' retainedhandler no duplicate create');
  if(mode.startsWith('unknown')){const refresh=page.getByRole('button',{name:'Refresh follow-up tasks',exact:true});await refresh.waitFor();await refresh.evaluate(b=>{window.reviewHandler=b.onclick;window.oldReview=b;window.readBefore=calls.length});if(mode.endsWith('retired'))await page.evaluate(()=>{const p=oldReview.parentNode;oldReview.remove();p.append(oldReview)});await page.evaluate(()=>reviewHandler());eq(await page.evaluate(()=>calls.length>readBefore),mode==='unknown'||original,engine+' '+mode+' read-only reconciliation lifetime');eq(await page.evaluate(()=>calls.filter(x=>x.insert).length),1,engine+' '+mode+' no automatic uncertain retry');eq((await page.locator('body').innerText()).includes('PRIVATE_TRANSPORT_DETAIL'),false,engine+' no transportdetail leak')}
  if(mode==='organization-held')eq(await page.evaluate(()=>window.navigation),'staff-people.html?org=org-b',engine+' organization navigation carries only authorized org');
  eq(result.storage,0,engine+' '+mode+' no private storage');eq(errors,[],engine+' '+mode+' strict no errors');cases.push({engine,mode,...result});await page.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,original,sourceRoot:root,runtimeSHA256:createHash('sha256').update(runtime).digest('hex'),cases,hosted:false}));

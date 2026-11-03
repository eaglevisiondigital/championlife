import {chromium,webkit} from 'playwright';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {readFile,writeFile} from 'node:fs/promises';
import path from 'node:path';
import assert from 'node:assert/strict';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sdk=await readFile(process.env.SUPABASE_SDK_PATH);
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const evidence=process.env.EVIDENCE_DIR;
// Independent discovery-race tests: fictional Auth adapter, no provider requests.
let checks=0,findings=[];
const ok=(v,m)=>{checks++;if(!v)findings.push(m);console.log((v?'PASS ':'FAIL ')+m)};
for(const [engine,options] of [[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{
 const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage();
 await context.route('**/*',async route=>{
  const u=new URL(route.request().url());
  if(u.hostname==='cdn.jsdelivr.net')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
  if(u.origin!=='https://review.invalid')throw Error('Unexpected network '+u.origin);
  if(u.pathname==='/assets/js/champion-life-auth.js')return route.fulfill({contentType:'text/javascript',body:`
   window.fixture={denied:false,hold:false,reverse:false,calls:0,release:null,holdStaff:false,denyCampaign:false,network:false,remove:false,mutations:0};
   const user={id:'11111111-1111-4111-8111-111111111111',email:'reviewer@example.test',email_confirmed_at:'2026-01-01'};
   window.ChampionLifeAuth={getUser:async()=>user,getSession:async()=>({user}),client:{auth:{getUser:async()=>({data:{user}}),onAuthStateChange:()=>{}},rpc:async(name,args)=>{
    fixture.calls++;
    if(!['staff_workspace_context','outreach_registration_workspace'].includes(name)){fixture.mutations++;return {data:{}}}
    if(name==='staff_workspace_context'){
     if(fixture.holdStaff)await new Promise(r=>fixture.release=r);
     if(fixture.network)throw Error('Synthetic network failure');
     if(fixture.denied)return {error:{code:'42501'},status:403};
     const grants=['people.read','followup.read'].map(permission=>({organization_id:'org',permission,department_ids:null}));
     return {data:{organizations:[{id:'org',name:'Fictional Church'}],grants:fixture.remove?grants.slice(0,1):fixture.reverse?grants.reverse():grants}};
    }
    if(fixture.denyCampaign)return {error:{code:'42501'},status:403};
    if(fixture.hold)await new Promise(r=>fixture.release=r);
    return {data:[{id:'22222222-2222-4222-8222-222222222222',name:'Fictional Campaign'}]};
   }}};`});
  const f=path.join(root,u.pathname);try{return route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
 });
 await page.goto('https://review.invalid/staff-home.html');await page.waitForFunction(()=>StaffWorkspace.active());
 await page.evaluate(()=>{document.querySelector('#staff-main').append(Object.assign(document.createElement('p'),{textContent:'PRIVATE REVIEW FIXTURE'}));fixture.denied=true;fixture.hold=true;window.dispatchEvent(new Event('focus'))});
 await page.waitForFunction(()=>fixture.release!==null);await page.waitForTimeout(100);
 ok(!await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': immediate denial despite sibling discovery pending');
 ok(!await page.getByText('PRIVATE REVIEW FIXTURE',{exact:true}).isVisible(),engine.name()+': private DOM cleared on processed discovery denial');
 if(evidence)await page.screenshot({path:path.join(evidence,engine.name()+'-parallel-denial.png')});
 await page.evaluate(()=>ChampionLifeAuth.client.rpc('retained_save',{p_action:'save'}));
 ok(await page.evaluate(()=>fixture.mutations===0),engine.name()+': retained mutation blocked after denial');
 await page.evaluate(()=>fixture.release());await page.waitForTimeout(50);ok(!await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': late sibling cannot restore denied state');
 await page.reload();await page.waitForFunction(()=>StaffWorkspace.active());
 await page.evaluate(()=>{fixture.reverse=true;window.dispatchEvent(new Event('focus'))});await page.waitForTimeout(100);
 ok(await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': equivalent permission order preserves active workspace');

 await page.evaluate(()=>{fixture.remove=true;window.dispatchEvent(new Event('focus'))});await page.waitForTimeout(100);
 ok(!await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': actual permission removal invalidates access');
 for(const scenario of ['campaign-denial','network-error']){
  await page.reload();await page.waitForFunction(()=>StaffWorkspace.active());
  await page.evaluate(s=>{if(s==='campaign-denial'){fixture.holdStaff=true;fixture.denyCampaign=true}else{fixture.hold=true;fixture.network=true}window.dispatchEvent(new Event('focus'))},scenario);
  await page.waitForFunction(()=>fixture.release!==null);await page.waitForTimeout(100);
  ok(!await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': '+scenario+' stops without waiting for sibling');
  ok(!await page.locator('#staff-main').isVisible(),engine.name()+': '+scenario+' clears protected content');
  await page.evaluate(()=>fixture.release());await page.waitForTimeout(50);
  ok(!await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': '+scenario+' late response cannot restore access');
 }
 await page.reload();await page.waitForFunction(()=>StaffWorkspace.active());
 ok(await page.evaluate(()=>StaffWorkspace.active()),engine.name()+': fresh authorized discovery restores new page');
 await context.close();
 }finally{await browser.close()}
}
if(evidence)await writeFile(path.join(evidence,'independent-adversarial-results.json'),JSON.stringify({checks,findings},null,2)+'\n');
console.log(JSON.stringify({checks,failures:findings.length}));if(findings.length)process.exitCode=1;

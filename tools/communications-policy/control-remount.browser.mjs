// Actual existing Communications HTML, shell and runtime; all traffic is fictional.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const read=p=>fs.readFileSync(p==='assets/js/communications.js'&&process.env.COMM_SOURCE?process.env.COMM_SOURCE:p,'utf8'),origin='https://communications-remount.invalid';
const reproduce=process.env.REPRODUCE_REMOUNT==='1';let checks=0;
const eq=(a,b,m)=>{assert.deepEqual(a,b,m);checks++;console.log('PASS '+m)};
for(const [name,engine] of Object.entries({chromium,webkit})){
 const browser=await engine.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,1440]){
  async function setup(view='templates'){
   const page=await browser.newPage({viewport:{width,height:900}}),errors=[];page.on('pageerror',e=>errors.push(e.message));
   const file=view==='templates'?'staff-communication-templates.html':'staff-communication-activity.html';
   const html=read(file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
   await page.route('**/*',r=>{assert.equal(new URL(r.request().url()).origin,origin);return r.fulfill({contentType:r.request().resourceType()==='document'?'text/html':'text/plain',body:r.request().resourceType()==='document'?html:''})});
   await page.goto(origin+'/'+file);await page.addScriptTag({content:read('tools/backend-tests/fixtures/communications-browser-fixture.js')});
   for(const p of['assets/js/outreach-staff-common.js','assets/js/staff-workspace.js','assets/js/communications.js'])await page.addScriptTag({content:read(p)});
   await page.getByRole('button',{name:view==='templates'?'Publish version':'View message',exact:true}).first().waitFor();return{page,errors};
  }
  for(const mode of['button','row','root']){
   const{page,errors}=await setup();
   const before=await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='template_publish').length);
   await page.getByRole('button',{name:'Publish version',exact:true}).first().evaluate((button,mode)=>{
    const node=mode==='root'?document.getElementById('communications-app'):mode==='row'?button.closest('.comm-row'):button;
    const parent=node.parentNode,next=node.nextSibling;window.oldPublish=button.onclick;node.remove();parent.insertBefore(node,next);window.oldAction=oldPublish();
   },mode);await page.evaluate(()=>oldAction);
   eq(await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='template_publish').length),before+(reproduce?1:0),name+width+' '+mode+' same-task reinsertion '+(reproduce?'reproduces mutation':'cannot revive mutation'));
   eq(errors,[],name+width+' '+mode+' browser errors absent');await page.close();
  }
  for(const reinsert of[false,true]){
   const{page,errors}=await setup();const before=await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='templates').length);
   await page.locator('select[name="scope"]').evaluate((select,reinsert)=>{const parent=select.parentNode,next=select.nextSibling;select.remove();if(reinsert)parent.insertBefore(select,next);select.value=[...select.options].find(o=>o.value.startsWith('org:')).value;select.onchange()},reinsert);
   await page.waitForTimeout(30);
   eq(await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='templates').length),before+(reproduce?1:0),name+width+' removed scope selector '+(reinsert?'reattached':'detached')+' '+(reproduce?'reproduces stale navigation':'cannot navigate'));
   eq(errors,[],name+width+' scope selector browser errors absent');await page.close();
  }
  if(!reproduce){
   for(const boundary of[1,2]){
    const{page,errors}=await setup();
    await page.getByRole('button',{name:'Publish version',exact:true}).first().evaluate((button,boundary)=>{window.heldButton=button;let n=0;const get=ChampionLifeAuth.getUser;ChampionLifeAuth.getUser=()=>++n===boundary?new Promise(resolve=>window.releaseIdentity=()=>resolve(commFixture.user)):get();window.pendingAction=button.onclick()},boundary);
    await page.waitForFunction(()=>typeof releaseIdentity==='function');await page.evaluate(()=>{const parent=heldButton.parentNode;heldButton.remove();parent.append(heldButton);releaseIdentity()});await page.evaluate(()=>pendingAction);
    eq(await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='template_publish').length),0,name+width+' remounted control during Auth await'+boundary+' sends no mutation');
    eq(errors,[],name+width+' delayed Auth browser errors absent');await page.close();
   }
   {
    const{page,errors}=await setup('activity');
    await page.evaluate(()=>{const rpc=ChampionLifeAuth.client.rpc;ChampionLifeAuth.client.rpc=async(...args)=>{const result=await rpc(...args);if(args[1]?.p_action==='message')await new Promise(resolve=>window.releaseRead=resolve);return result}});
    await page.getByRole('button',{name:'View message',exact:true}).first().evaluate(button=>{window.oldMessage=button;window.pendingRead=button.onclick()});await page.waitForFunction(()=>typeof releaseRead==='function');
    await page.evaluate(()=>{const row=oldMessage.closest('.comm-row'),parent=row.parentNode;row.remove();parent.append(row);releaseRead()});await page.evaluate(()=>pendingRead);
    eq(await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='message').length),1,name+width+' read already issued distinguished from new mutation');
    eq(await page.locator('.comm-body').count(),0,name+width+' remounted response cannot publish private body');
    eq(errors,[],name+width+' delayed response browser errors absent');await page.close();
   }
   const{page}=await setup();await page.getByRole('button',{name:'Publish version',exact:true}).first().click();await page.waitForFunction(()=>commFixture.calls.some(c=>c.args.p_action==='template_publish'));
   eq(await page.evaluate(()=>commFixture.calls.filter(c=>c.args.p_action==='template_publish').length),1,name+width+' attached authorized publish remains one request');await page.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({checks,reproduce,hostedAcceptance:false,externalSending:false}));

// Permanent independent reproduction/correction of post-retirement RPC issuance.
import assert from 'node:assert/strict';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness} from './browser-fixture.mjs';
import {original,partner,hash,expected} from './source.mjs';
const reproduce=process.env.REPRODUCE_PARTNER_AWAIT==='1';let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
const actions=[
 {label:'Mark reviewed',action:'review'},
 {label:'Create follow-up task',action:'followup'},
 {label:'Link reviewed contact',action:'link',unlinked:true,searchFirst:true},
 {label:'Create contact after review',action:'create_contact',unlinked:true},
 {label:'Search People',action:'list',rpc:'people_workspace',unlinked:true},
 {return:true,action:'context',rpc:'staff_workspace_context'},
 {label:'Mark reviewed',action:'review',ancestor:true},
 {label:'Mark reviewed',action:'review',reparent:true},
 {return:true,action:'context',rpc:'staff_workspace_context',reparent:true}
];
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const a of actions){
  const h=await createHarness(browser,390),{page,state}=h,label=engine+' '+(a.return?'People return':a.label)+(a.reparent?' extracted descendant':a.ancestor?' ancestor':' control');
  state.caps.push('people.update','people.create','followup.read','followup.manage');if(a.unlinked)state.person=null;
  page.on('dialog',dialog=>dialog.accept());
  if(reproduce)await page.route('**/assets/js/staff-outreach-partners.js',route=>route.fulfill({body:original('assets/js/staff-outreach-partners.js',partner),contentType:'text/javascript'}));
  await h.open();await page.getByRole('button',{name:'Review intake',exact:true}).click();await page.getByRole('button',{name:'Mark reviewed',exact:true}).waitFor();
  if(a.searchFirst){await page.getByRole('button',{name:'Search People',exact:true}).click();await page.getByRole('button',{name:a.label,exact:true}).waitFor()}
  const locator=a.return?page.locator('[data-partner-return="people"]'):page.getByRole('button',{name:a.label,exact:true});
  const select=call=>call.name===(a.rpc||'outreach_partner_workspace')&&(a.rpc==='staff_workspace_context'||call.p?.p_action===a.action);
  const before=state.calls.filter(select).length;
  await locator.evaluate(control=>{
   const get=ChampionLifeAuth.getSession;let held=false;window.oldControl=control;window.oldAction=control.onclick;
   ChampionLifeAuth.getSession=()=>!held?(held=true,new Promise(resolve=>window.releaseSession=async()=>resolve(await get()))):get();
   window.pendingAction=oldAction({preventDefault(){}});
  });
  await page.waitForFunction(()=>typeof releaseSession==='function');
  eq(state.calls.filter(select).length,before,label+' no target RPC before session resolution');
  if(a.reparent){
   // Let removal records deliver while the child remains in the detached subtree.
   await page.evaluate(()=>oldControl.parentNode.remove());
   await page.evaluate(async()=>{document.getElementById('outreach-intakes').append(oldControl);await releaseSession()});
  }else await page.evaluate(async ancestor=>{const node=ancestor?oldControl.parentNode:oldControl,parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);await releaseSession()},!!a.ancestor);
  // The original return handler may navigate; its counted authority RPC is the reproduction.
  if(reproduce&&a.return)await page.waitForURL(/staff-people\.html/);
  else await page.evaluate(()=>pendingAction);
  eq(state.calls.filter(select).length,before+(reproduce?1:0),label+(reproduce?' original issues RPC after retirement':' corrected issues zero RPC after retirement'));
  eq(state.errors,[],label+' no browser errors');await h.close();
 }
 if(!reproduce){
  const h=await createHarness(browser,390),{page,state}=h;await h.open();await page.getByRole('button',{name:'Review intake',exact:true}).click();
  const button=page.getByRole('button',{name:'Mark reviewed',exact:true});await button.waitFor();
  const before=state.calls.filter(c=>c.name==='outreach_partner_workspace'&&c.p?.p_action==='detail').length;
  await button.evaluate(async button=>{
   const get=ChampionLifeAuth.getSession;let n=0;window.continuationRemoved=false;
   ChampionLifeAuth.getSession=()=>{const call=++n;return Promise.resolve(get()).then(value=>{if(call===2)queueMicrotask(()=>queueMicrotask(()=>{const parent=button.parentNode,next=button.nextSibling;button.remove();parent.insertBefore(button,next);window.continuationRemoved=true}));return value})};await button.onclick();
  });
  eq(await page.evaluate(()=>continuationRemoved),true,engine+' control retired at caller continuation boundary');
  eq(state.writes.length,1,engine+' continuation test preserves already-issued review outcome');
  eq(state.calls.filter(c=>c.name==='outreach_partner_workspace'&&c.p?.p_action==='detail').length,before,engine+' retired caller cannot refresh private detail');
  eq(state.errors,[],engine+' caller continuation no browser errors');await h.close();
 }
 }finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,reproduce,source:reproduce?partner:hash(expected('assets/js/staff-outreach-partners.js')),hostedAcceptance:false,realIdentityLinks:false,realTaskWrites:false}));

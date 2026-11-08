// Independent composition review: actual selected modules and SDK, fictional HTTP only.
import assert from 'node:assert/strict';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness,A,B,O,Q,session} from './browser-fixture.mjs';
let checks=0;
const check=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const label=engine+' '+width;
  async function ready(options={}){
   const h=await createHarness(browser,width);Object.assign(h.state,options);await h.open();
   await h.page.getByRole('button',{name:'Review intake',exact:true}).waitFor();return h;
  }
  const intakeCalls=h=>h.state.calls.filter(x=>x.name==='outreach_partner_workspace');
  const detail=async h=>{await h.page.getByRole('button',{name:'Review intake',exact:true}).click();await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).waitFor()};
  for(const missing of ['finance.read','outreach.view']){
   const h=await createHarness(browser,width);h.state.caps=h.state.caps.filter(x=>x!==missing);await h.open();
   await h.page.getByText('Your access to Outreach Partner Intakes is no longer available.',{exact:true}).waitFor();
   check(intakeCalls(h).length,0,label+' missing '+missing+' never requests intake data');
   check(await h.page.locator('[data-partner-return][href]').count(),0,label+' missing '+missing+' has no authorized return');await h.close();
  }
  {
   const h=await ready({caps:['finance.read','outreach.view']});
   check(await h.page.locator('[data-partner-return="people"]').getAttribute('href'),null,label+' financial intake does not confer People navigation');
   check(await h.page.locator('[data-partner-return="home"]').getAttribute('href'),'staff-home.html?context=church&org='+O,label+' existing financial authority permits exact home return');
   check(h.state.calls.some(x=>x.name==='people_workspace'),false,label+' financial-only context never reads People');await h.close();
  }
  for(const hint of ['org='+O+'&org='+Q,'org=unavailable','org=cccccccc-cccc-4ccc-8ccc-ccccccccccc3']){
   const h=await createHarness(browser,width);await h.open('staff-outreach-partners.html?'+hint);
   await h.page.getByText('Your access to Outreach Partner Intakes is no longer available.',{exact:true}).waitFor();
   check(intakeCalls(h).length,0,label+' invalid or unauthorized hint has no fallback '+hint);await h.close();
  }
  for(const removed of ['control','root','main']){
   const h=await ready();await detail(h);
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(async(button,removed)=>{
    const old=button.onclick,node=removed==='control'?button:document.getElementById(removed==='root'?'outreach-intakes':'staff-main');
    const parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);await old();
   },removed);
   check(h.state.writes.length,0,label+' '+removed+' same-task remount cannot revive review intent');
   check(h.state.errors,[],label+' '+removed+' retirement has no browser exception');await h.close();
  }
  {
   const h=await ready();await detail(h);
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(button=>{window.retiredChild=button;window.retiredHandler=button.onclick;button.parentNode.remove()});
   // Separate task: observer already processed the removed container before extraction.
   await h.page.evaluate(async()=>{document.getElementById('outreach-intakes').append(retiredChild);await retiredHandler()});
   check(h.state.writes.length,0,label+' extracted descendant cannot escape retired ancestor');
   check(h.state.errors,[],label+' extracted descendant no browser error');await h.close();
  }
  // The click begins first, but no RPC has started while the current session is awaited.
  for(const removal of ['control','container']){
   const h=await ready();await detail(h);
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(button=>{
    const get=ChampionLifeAuth.getSession;let held=false;window.retainedReview=button.onclick;window.reviewButton=button;
    ChampionLifeAuth.getSession=()=>!held?(held=true,new Promise(resolve=>window.releaseSession=async()=>resolve(await get()))):get();
    window.pendingReview=retainedReview();
   });
   await h.page.waitForFunction(()=>typeof releaseSession==='function');
   check(h.state.writes.length,0,label+' '+removal+' no RPC issued before held session resolves');
   await h.page.evaluate(async removal=>{const node=removal==='control'?reviewButton:reviewButton.parentNode,parent=node.parentNode,next=node.nextSibling;node.remove();parent.insertBefore(node,next);await releaseSession();await pendingReview;await retainedReview()},removal);
   check(h.state.writes.length,0,label+' '+removal+' retired during session await cannot issue or retry review');
   check(h.state.errors,[],label+' '+removal+' held-session retirement no browser errors');await h.close();
  }
  {
   const h=await ready();await detail(h);const before=intakeCalls(h).filter(c=>c.p.p_action==='detail').length;
   h.state.hold=c=>c.name==='outreach_partner_workspace'&&c.p?.p_action==='review';
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(button=>{window.retainedReview=button.onclick;window.reviewButton=button;window.pendingReview=retainedReview()});await h.held();
   check(h.state.writes.length,1,label+' distinguishes one already-issued review from unsubmitted intent');
   await h.page.evaluate(()=>{const parent=reviewButton.parentNode,next=reviewButton.nextSibling;reviewButton.remove();parent.insertBefore(reviewButton,next)});await h.release();
   await h.page.evaluate(async()=>{await pendingReview;await retainedReview()});
   check(h.state.writes.length,1,label+' retired already-issued review is not automatically retried');
   check(intakeCalls(h).filter(c=>c.p.p_action==='detail').length,before,label+' retired review response cannot refresh private detail');await h.close();
  }
  {
   const h=await ready();await detail(h);
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(async(button,replacement)=>{
    const old=button.onclick;ChampionLifeAuth.getSession=async()=>replacement;await old();
   },session(B));
   check(h.state.writes.length,0,label+' changed identity without callback denies mutation');
   check(await h.page.locator('#outreach-intakes').innerText().then(x=>x.includes('restricted@example.test')),false,label+' missed-callback identity clears private detail');await h.close();
  }
  for(const transition of ['account','logout']){
   const h=await ready();await detail(h);
   await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).evaluate(button=>{
    // INITIAL_SESSION is subscription discovery, not the replacement/logout under test.
    const old=button.onclick;ChampionLifeAuth.client.auth.onAuthStateChange(event=>{if(event==='SIGNED_IN'||event==='SIGNED_OUT')void old()});
   });
   if(transition==='account'){
    h.state.actor=B;await h.page.evaluate(value=>{void ChampionLifeAuth.client.auth.setSession(value)},session(B));
   }else await h.page.getByRole('button',{name:'Log Out',exact:true}).click();
   await h.page.waitForURL(/discipleship-login\.html/);
   check(new URL(h.page.url()).searchParams.get('next'),'/staff-outreach-partners.html?org='+O,label+' '+transition+' login return preserves exact authorized organization');
   check(h.state.writes.length,0,label+' actual SDK '+transition+' event retires captured review handler');
   check(await h.page.locator('#outreach-intakes').count(),0,label+' '+transition+' navigation cannot retain intake DOM');await h.close();
  }
  {
   const h=await ready();await h.page.locator('[data-partner-return="people"]').evaluate(link=>window.oldReturn=link.onclick);
   await h.page.getByRole('combobox',{name:'Organization',exact:true}).selectOption(Q);
   await h.page.getByRole('heading',{name:'Fictional Intake B',exact:true}).waitFor();
   const before=h.state.calls.length;await h.page.evaluate(()=>oldReturn({preventDefault(){}}));
   check(h.state.calls.length,before,label+' previous-organization return handler cannot request');
   check(await h.page.locator('[data-partner-return="people"]').getAttribute('href'),'staff-people.html?org='+Q,label+' current People return preserves exact organization');
   check(new URL(h.page.url()).searchParams.get('org'),Q,label+' selected organization is represented in route');await h.close();
  }
  {
   const h=await ready();h.state.hold=c=>c.name==='outreach_partner_workspace'&&c.p?.p_action==='detail';
   await h.page.getByRole('button',{name:'Review intake',exact:true}).click();await h.held();
   await h.page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));await h.release();
   check(await h.page.locator('#outreach-intakes').innerText().then(x=>x.includes('restricted@example.test')),false,label+' delayed detail cannot repopulate retired shared host');
   check(await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).count(),0,label+' delayed detail cannot recreate mutation controls');await h.close();
  }
  {
   const h=await ready();h.state.caps=h.state.caps.filter(x=>x!=='finance.read');
   await h.page.getByRole('button',{name:'Next',exact:true}).click();
   await h.page.getByText('Your access to Outreach Partner Intakes is no longer available.',{exact:true}).waitFor();
   check(await h.page.locator('#outreach-intakes').innerText().then(x=>x.includes('private@example.test')),false,label+' server revocation clears protected list');
   check(h.state.writes.length,0,label+' revoked financial authority causes no mutation');await h.close();
  }
  {
   const h=await createHarness(browser,width);
   await h.page.addInitScript(()=>{history.replaceState=()=>{throw Error('Fictional denied history')}});await h.open();
   await h.page.getByText('Your access to Outreach Partner Intakes is no longer available.',{exact:true}).waitFor();
   check(intakeCalls(h).length,0,label+' failed route persistence does not fall back to default organization');await h.close();
  }
  {
   const h=await ready();await detail(h);await h.page.getByRole('button',{name:'Mark reviewed',exact:true}).click();
   await h.page.waitForFunction(()=>document.getElementById('outreach-intakes')?.textContent.includes('Review history'));
   check(h.state.writes.length,1,label+' attached independently authorized review remains usable');
   check(h.state.writes[0].p.p_org,O,label+' allowed review remains exact organization');
   check(h.state.writes[0].p.p_data.revision,3,label+' allowed review retains expected revision');
   check(h.state.unexpected,[],label+' no real or unapproved origin traffic');await h.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,engines:['chromium','webkit'],widths:[390,1440],actualSelectedSDK:true,fictionalHTTP:true,hostedAcceptance:false,realGrants:false}));

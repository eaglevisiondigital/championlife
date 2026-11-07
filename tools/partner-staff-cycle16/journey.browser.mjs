import assert from 'node:assert/strict';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness,A,B,O,Q,P,origin,session} from './browser-fixture.mjs';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const [name,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of [390,1440]){
  const label=name+' '+width;
  {
   const h=await createHarness(browser,width),{page,state}=h;
   await h.open('staff-home.html?context=church&org='+Q);
   if(width<1024)await page.getByRole('button',{name:'Menu',exact:true}).click();
   await page.getByRole('link',{name:'Financial Outreach Review',exact:true}).click();await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
   eq(new URL(page.url()).searchParams.get('org'),Q,label+' staff financial route preserves authorized organization');
   eq(await page.getByRole('heading',{name:'Fictional Intake B',exact:true}).count(),1,label+' actual intake source mounts under shared Auth/session');
   await page.getByRole('button',{name:'Review intake',exact:true}).click();await page.getByRole('link',{name:'Open Person / follow-up tasks',exact:true}).waitFor();
   const personLink=await page.getByRole('link',{name:'Open Person / follow-up tasks',exact:true}).getAttribute('href');
   eq(personLink,'staff-people.html?person='+P+'&org='+Q,label+' verified backend Person handoff exact org and Person');
   await page.locator('[data-partner-return="people"]').click();await page.getByRole('button',{name:'Review Person & follow-up',exact:true}).waitFor();
   eq(new URL(page.url()).searchParams.get('org'),Q,label+' authorized return joins actual current People runtime');
   eq(state.writes.length,0,label+' read-only navigation creates no task or identity writes');eq(state.unexpected,[],label+' no external transport');eq(state.errors,[],label+' no runtime errors');await h.close();
  }
  for(const caps of [['outreach.view'],['finance.read'],['people.read'],['outreach.view','finance.read']]){
   const h=await createHarness(browser,width),{page,state}=h;state.caps=caps;
   await h.open();
   if(caps.length===2){await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();eq(await page.locator('[data-partner-return="people"]').getAttribute('href'),null,label+' finance intake grants do not confer People return');}
   else{await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();eq(state.calls.filter(c=>c.name==='outreach_partner_workspace').length,0,label+' missing independent '+caps.join('/')+' denies intake before request');}
   eq(state.writes.length,0,label+' authority separation creates zero writes');await h.close();
  }
  for(const query of ['org=invalid','org='+O+'&org='+Q,'org=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9']){
   const h=await createHarness(browser,width);await h.open('staff-outreach-partners.html?'+query);await h.page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();
   eq(h.state.calls.filter(c=>c.name==='outreach_partner_workspace').length,0,label+' invalid or unauthorized organization cannot fall back');await h.close();
  }
  for(const mode of ['pagehide','root-remount','row-remount','silent-account','denial']){
   const h=await createHarness(browser,width),{page,state}=h;await h.open();await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
   await page.getByRole('button',{name:'Review intake',exact:true}).evaluate(b=>{window.oldReview=b.onclick;window.oldButton=b});
   if(mode==='pagehide')await page.evaluate(()=>dispatchEvent(new Event('pagehide')));
   if(mode.endsWith('remount'))await page.evaluate(mode=>{const n=mode==='root-remount'?document.getElementById('outreach-intakes'):oldButton.closest('article');const p=n.parentNode,next=n.nextSibling;n.remove();p.insertBefore(n,next);oldReview()},mode);
   if(mode==='silent-account'){state.actor=B;await page.evaluate(()=>oldReview())}
   if(mode==='denial'){state.deny=true;await page.getByRole('button',{name:'Next',exact:true}).click();await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor()}
   const before=state.calls.length;await page.evaluate(()=>oldReview());await page.waitForLoadState('networkidle');
   eq(state.calls.length,before,label+' '+mode+' retained handler makes no further protected request');eq(state.writes.length,0,label+' '+mode+' zero writes');await h.close();
  }
  {
   const h=await createHarness(browser,width),{page,state}=h;await h.open();await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
   state.hold=c=>c.name==='outreach_partner_workspace'&&c.p.p_action==='detail';await page.getByRole('button',{name:'Review intake',exact:true}).evaluate(b=>{window.pendingDetail=b.onclick()});await h.held();
   await page.evaluate(()=>dispatchEvent(new Event('staff-protected-clear')));await h.release();await page.evaluate(()=>pendingDetail);
   eq((await page.locator('body').innerText()).includes('restricted@example.test'),false,label+' delayed protected intake response cannot restore retired view');eq(state.writes.length,0,label+' delayed request makes no mutation');await h.close();
  }
  {
   const h=await createHarness(browser,width),{page}=h;await h.open('staff-outreach-partners.html?org='+Q);await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();
   await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?**');
   eq(new URL(page.url()).searchParams.get('next'),'/staff-outreach-partners.html?org='+Q,label+' Partner logout preserves only validated organization return');await h.close();
  }
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,compositionMode:process.env.PARTNER_TEST_COMPOSITION==='1'?'test-only':'actual-runtime',hostedAcceptance:false,releaseAuthorized:false}));

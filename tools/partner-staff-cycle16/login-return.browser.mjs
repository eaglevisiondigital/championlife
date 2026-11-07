import assert from 'node:assert/strict';import {chromium,webkit}from '../backend-tests/node_modules/playwright/index.mjs';
import {createHarness,O,Q,origin}from './browser-fixture.mjs';
let checks=0;const eq=(a,b,label)=>{assert.deepEqual(a,b,label);checks++;console.log('PASS '+label)};
for(const[name,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch(name==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{for(const width of[390,1440])for(const[query,next,denied]of[
  ['?org='+Q+'&person=PRIVATE_PERSON&intake=PRIVATE_INTAKE#PRIVATE_FRAGMENT','/staff-outreach-partners.html?org='+Q,false],
  ['?org='+O+'&org='+Q,'/staff-outreach-partners.html?org=unavailable',true],
  ['?org=bad','/staff-outreach-partners.html?org=unavailable',true],
  ['?org=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9','/staff-outreach-partners.html?org=bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbb9',true],
  ['?person=PRIVATE_PERSON','/staff-outreach-partners.html',false]
 ]){
  const h=await createHarness(browser,width),{page,state}=h,label=name+' '+width+' '+query.split('&')[0];
  // No session exists in this new context. The real SDK/module renders the sign-in link.
  await page.goto(origin+'/staff-outreach-partners.html'+query);const link=page.getByRole('link',{name:'Sign in to your workspace',exact:true});await link.waitFor();
  const href=await link.getAttribute('href');eq(new URL(href,origin).searchParams.get('next'),next,label+' exact scope-only initial return');
  eq(href.includes('PRIVATE'),false,label+' private fields excluded');await link.click();await page.waitForURL(/discipleship-login\.html/);
  eq(state.calls.filter(c=>c.name==='outreach_partner_workspace').length,0,label+' no authenticated intake requested before login');
  // Fictional local login boundary only; genuine provider Auth remains separately gated.
  await h.seed();await page.goto(origin+next);
  if(denied){await page.getByRole('heading',{name:'Outreach Partner Access Removed',exact:true}).waitFor();eq(state.calls.filter(c=>c.name==='outreach_partner_workspace').length,0,label+' unavailable or unauthorized hint cannot become another organization')}
  else{await page.getByRole('button',{name:'Review intake',exact:true}).waitFor();eq(new URL(page.url()).searchParams.get('org'),query.startsWith('?org=')?Q:O,label+' authorized return retains intended organization')}
  eq(state.errors,[],label+' no runtime errors');eq(state.writes.length,0,label+' login route creates no identity or task');await h.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,hostedAcceptance:false,genuineEmailVerification:false}));

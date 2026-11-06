// TEST-ONLY compatibility probes. Frozen application inputs are never patched.
import assert from 'node:assert/strict';
import {readFileSync,mkdirSync,writeFileSync} from 'node:fs';
import {pathToFileURL} from 'node:url';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const loader=process.env.STAFF_SOURCE_LOADER?pathToFileURL(process.env.STAFF_SOURCE_LOADER).href:new URL('./source.mjs',import.meta.url).href;
const {loadSource,sourceManifest}=await import(loader);
const fixture=readFileSync(new URL('./communications-browser-fixture.js',import.meta.url),'utf8');
const sources=Object.fromEntries(['shell','common','auth','sharedSession','homeHtml','communications','commCampaignHtml','commActivityHtml','legacyCommunicationsShell','communicationsWorkspaceCss','communicationsCss','campaignCss','portalCss','workspaceCss'].map(id=>[id,loadSource(id)]));
const origin='https://communications-composition.invalid',O='11111111-1111-4111-8111-111111111111',C='33333333-3333-4333-8333-333333333333';
let checks=0;const eq=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;console.log('PASS '+label)};
const transcripts=[];
for(const [engine,type] of Object.entries({chromium,webkit})){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 try{
  async function setup(kind,legacy=false){
   const page=await browser.newPage({viewport:{width:engine==='chromium'?390:1440,height:900}}),errors=[],sdkRequests=[];
   page.on('pageerror',error=>errors.push(error.message));await page.addInitScript({content:fixture});
   const file=kind==='home'?'staff-home.html':kind==='activity'?'staff-communication-activity.html':'staff-campaign-communications.html';
   const html=sources[kind==='home'?'homeHtml':kind==='activity'?'commActivityHtml':'commCampaignHtml'];
   const js={'champion-life-auth.js':sources.auth,'outreach-staff-common.js':sources.common,'staff-session.js':sources.sharedSession,'staff-workspace.js':legacy?sources.legacyCommunicationsShell:sources.shell,'communications.js':sources.communications};
   await page.route('**/*',async route=>{
    const url=new URL(route.request().url());
    if(url.origin!==origin){
     // Do not fetch or silently upgrade the SDK. Original HTML URL/integrity remain
     // unchanged; the explicitly fictional SDK port was installed before parsing.
     if(url.hostname==='cdn.jsdelivr.net'&&url.pathname.startsWith('/npm/@supabase/supabase-js@'))sdkRequests.push(url.href);
     return route.fulfill({contentType:'text/javascript',body:''});
    }
    if(url.pathname==='/'+file)return route.fulfill({contentType:'text/html',body:html});
    const name=url.pathname.split('/').at(-1);
    if(name==='supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'/* fictional configuration is provided only by the test fixture */'});
    if(js[name])return route.fulfill({contentType:'text/javascript',body:js[name]});
    const css={'outreach-campaigns.css':sources.campaignCss,'staff-portal.css':sources.portalCss,'staff-workspace.css':kind==='home'?sources.workspaceCss:sources.communicationsWorkspaceCss,'communications.css':sources.communicationsCss};
    return route.fulfill({contentType:css[name]?'text/css':'text/plain',body:css[name]||''});
   });
   await page.goto(origin+'/'+file+(kind==='home'?'?context=church&org='+O:'?campaign='+C));return{page,errors,sdkRequests,html};
  }
  for(const kind of ['campaign','activity']){
   const {page,errors,sdkRequests,html}=await setup(kind);
   await page.getByRole('button',{name:kind==='campaign'?'Preview audience & message':'View message',exact:true}).first().waitFor();
   const state=await page.evaluate(()=>({calls:communicationComposition.calls,events:communicationComposition.events,api:Object.keys(StaffWorkspace),header:!!document.getElementById('staff-session'),menu:!!document.getElementById('staff-menu'),shellActive:StaffWorkspace.active()}));
   if(process.argv.includes('--expect-compatible')){console.log(JSON.stringify({engine,kind,state,errors}));assert.deepEqual(errors,[],'exact new shell and Communications page must compose without runtime failure')}
   eq(state.menu,false,engine+' '+kind+' exact77 page lacks required102 shell menu');
   eq(errors.some(e=>e.includes('addEventListener')),true,engine+' '+kind+' shell fails at missing required DOM');
   eq(state.api,['active','navigate'],engine+' '+kind+'102 exports no legacy Communications APIs');
   eq(state.shellActive,false,engine+' '+kind+' module renders while failed new shell is inactive');
   eq(state.calls.filter(c=>c.name==='communications_workspace').map(c=>c.args.p_action),kind==='campaign'?['context','senders','templates']:['context','activity'],engine+' '+kind+' partial module mount reaches existing reads after shell failure');
   eq(state.header,false,engine+' '+kind+' exact77 page lacks shared97 session header');
   const before=await page.evaluate(()=>communicationComposition.callbacks.length);await page.addScriptTag({content:sources.sharedSession});
   eq(await page.evaluate(()=>communicationComposition.callbacks.length),before,engine+' '+kind+' injected exact97 session returns without required mount');
   eq(html.includes('assets/js/staff-session.js'),false,engine+' '+kind+' original HTML does not install shared session');
   eq(/supabase-js@2"/.test(html)&&!/<script[^>]*supabase-js[^>]*integrity=/.test(html),true,engine+' '+kind+' original floating SDK/noSRI remains recorded, not rewritten');
   eq(sdkRequests,['https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2'],engine+' '+kind+' actual original SDK request intercepted without provider traffic');
   await page.getByRole('button',{name:kind==='campaign'?'Preview audience & message':'View message',exact:true}).first().evaluate(b=>window.retained=b.onclick);
   const callsBefore=await page.evaluate(()=>communicationComposition.calls.length);
   await page.locator('#communications-app select[name=scope]').selectOption('org:22222222-2222-4222-8222-222222222222');
   await page.waitForFunction(()=>communicationComposition.events.some(e=>e.kind==='error'&&e.message.includes('selectCampaign')));
   eq(await page.locator('#communications-app').textContent(),'',engine+' '+kind+' missing selectCampaign clears editor but cannot render selected scope');
   await page.evaluate(()=>retained());eq(await page.evaluate(()=>communicationComposition.calls.length),callsBefore,engine+' '+kind+' old control remains retired after failed scope transition');
   transcripts.push({engine,kind,mode:'exact77HTML-plus102shell',initial:state,errors,events:await page.evaluate(()=>communicationComposition.events)});await page.close();
  }
  for(const scenario of ['denial','delayed-account']){
   const {page,errors}=await setup('campaign');await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   await page.getByRole('button',{name:'Preview audience & message',exact:true}).evaluate(b=>window.retained=b.onclick);
   if(scenario==='denial')await page.evaluate(()=>{communicationComposition.denied=true;window.dispatchEvent(new Event('focus'))});
   else{
    await page.evaluate(()=>{communicationComposition.hold='communications_workspace:context';window.dispatchEvent(new Event('focus'))});
    await page.waitForFunction(()=>typeof communicationComposition.release==='function');
    await page.evaluate(()=>{communicationComposition.user=communicationComposition.sessionUser={id:'fictional-b',email:'fictional-b@example.invalid',email_confirmed_at:'2026-01-01'};communicationComposition.release()});
   }
   await page.waitForFunction(()=>document.getElementById('communications-app').childElementCount===0);
   eq(await page.locator('#communications-app').textContent(),'',engine+' '+scenario+' protected content clears despite incompatible host');
   eq(await page.evaluate(()=>typeof StaffWorkspace.state),'undefined',engine+' '+scenario+' host lacks retirement state renderer');
   eq(await page.locator('#communications-app .staff-state').count(),0,engine+' '+scenario+' missing host contract cannot publish retirement guidance');
   const callsAfter=await page.evaluate(()=>communicationComposition.calls.length);await page.evaluate(()=>retained());eq(await page.evaluate(()=>communicationComposition.calls.length),callsAfter,engine+' '+scenario+' retained previous-principal control cannot issue RPC');
   transcripts.push({engine,mode:scenario,errors,events:await page.evaluate(()=>communicationComposition.events)});await page.close();
  }
  {
   const {page,errors}=await setup('home');await page.waitForFunction(()=>StaffWorkspace.active());
   eq(await page.locator('#staff-navigation a[href*="communication"]').count(),0,engine+'102 navigation does not register Communications despite fictional Communications authority');
   const before=await page.evaluate(()=>communicationComposition.calls.length);await page.evaluate(()=>StaffWorkspace.navigate('staff-campaign-communications.html?campaign=33333333-3333-4333-8333-333333333333'));
   eq(new URL(page.url()).pathname,'/staff-home.html',engine+' unregistered full-page Communications destination is rejected');
   eq(await page.evaluate(()=>communicationComposition.calls.length),before,engine+' rejected navigation issues no discovery or module request');
   // Test assembly only: give module its existing mount inside the exact new host.
   // This isolates API compatibility without inventing any missing shell methods.
   await page.evaluate(()=>{const node=document.createElement('div');node.id='communications-app';node.dataset.view='campaign';document.getElementById('staff-main').append(node)});
   await page.addScriptTag({content:sources.communications});await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   eq(await page.evaluate(()=>typeof StaffWorkspace.selectCampaign),'undefined',engine+' complete102 DOM still lacks required selectCampaign API');
   eq(await page.evaluate(()=>communicationComposition.calls.filter(c=>c.name==='communications_workspace').map(c=>c.args.p_action)),['context','senders','templates'],engine+' complete host reaches authorized module reads despite absent legacy API');
   await page.getByRole('button',{name:'Preview audience & message',exact:true}).evaluate(b=>window.retained=b.onclick);
   await page.locator('#communications-app select[name=scope]').selectOption('org:22222222-2222-4222-8222-222222222222');
   await page.waitForFunction(()=>communicationComposition.events.some(e=>e.kind==='error'&&e.message.includes('selectCampaign')));
   eq(await page.getByRole('button',{name:'Preview audience & message',exact:true}).count(),0,engine+' complete host still cannot complete Communications scope switch');
   const callsAfter=await page.evaluate(()=>communicationComposition.calls.length);await page.evaluate(()=>retained());eq(await page.evaluate(()=>communicationComposition.calls.length),callsAfter,engine+' retained editor cannot act after failed scope switch in complete host');
   transcripts.push({engine,mode:'exact102home-plus-test-mount',errors,events:await page.evaluate(()=>communicationComposition.events)});await page.close();
  }
  {
   const {page,errors}=await setup('campaign',true);await page.getByRole('button',{name:'Preview audience & message',exact:true}).waitFor();
   eq(await page.evaluate(()=>['state','refresh','selectCampaign'].every(k=>typeof StaffWorkspace[k]==='function')),true,engine+' exact77 own host supplies the required legacy contract');
   eq(errors,[],engine+' own-host control proves fictional ports support existing module mount');
   eq(await page.evaluate(()=>communicationComposition.calls.filter(c=>c.name==='communications_workspace'&&!['context','senders','templates'].includes(c.args.p_action)).length),0,engine+' positive mount control performs no preview queue or mutation');
   eq(await page.locator('#staff-session-email').count(),0,engine+' own-host control is not shared97 session integration');await page.close();
  }
 }finally{await browser.close()}
}
if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.EVIDENCE_DIR+'/communications-composition-transcripts.json',JSON.stringify({heads:sourceManifest.heads,transcripts},null,2)+'\n')}
console.log(JSON.stringify({status:'BLOCKED_COMPOSITION',verifiedChecks:checks,blockers:['77 HTML missing102 shell mounts','102 missing77 shell APIs/context contract','102 Communications route unregistered','77 floating SDK/noSRI and missing shared97 session mount'],commonShellAccepted:false,providerRequests:0,hostedAcceptance:false}));

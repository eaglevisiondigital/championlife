// Real staff/form source; synthetic RPC responses only, no hosted requests.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
import {response,campaign,user} from '../backend-tests/fixtures/outreach-registration-ui.mjs';
const origin='https://walkup.invalid',sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const failures={validation:{status:400,error:{code:'23514',message:'Synthetic phone validation rejected'}},ambiguous:{status:500,error:{code:'23514',message:'Synthetic server failure'}},missingStatus:{error:{code:'23514',message:'Synthetic unknown transport status'}},retryChanged:{status:400,error:{code:'P0001',message:'Submission retry changed'}},unique:{status:409,error:{code:'23505',message:'Synthetic uniqueness conflict'}},network:null,denied:{status:403,error:{code:'42501',message:'Synthetic denied'}},expired:{status:401,error:{code:'PGRST301',message:'Synthetic expired'}},forbidden:{status:403,error:{code:'PGRST999',message:'Synthetic forbidden'}}};
for(const[engine,type]of[['chromium',chromium],['webkit',webkit]]){
 const browser=await type.launch(engine==='chromium'&&!process.env.CI?{channel:'chrome'}:{});
 for(const width of[390,1280])for(const[kind,failure]of Object.entries(failures)){
  if(process.env.REPRO&&!['validation','denied','expired','forbidden'].includes(kind))continue;
  const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let attempts=0;
  page.on('pageerror',e=>errors.push(e.message));await page.route('**/*',async route=>{
   const u=new URL(route.request().url());assert.equal(u.origin,origin);
   if(u.pathname==='/rpc'){
    const p=route.request().postDataJSON();calls.push(p);
    if(p.p_action==='walkup'&&++attempts===1){if(kind==='network'){await route.abort();return}await route.fulfill({json:{data:null,...failure}});return}
    const data=response('outreach_registration_workspace',p);if(p.p_action==='context'){data.config={...data.config,address_required:false,waiver_required:false,waiver:null}}
    await route.fulfill({json:{data,error:null,status:200}});return;
   }await route.fulfill({contentType:'text/html',body:'<div id="outreach-registration-staff"></div>'});
  });
  await page.goto(origin+'/?campaign='+campaign);await page.evaluate(({user})=>{window.actor={id:user};window.ChampionLifeAuth={getUser:async()=>window.actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(n,p)=>fetch('/rpc',{method:'POST',body:JSON.stringify(p)}).then(r=>r.json())}}},{user});for(const source of sources)await page.addScriptTag({content:source});
  await page.getByRole('button',{name:'Add walk-up',exact:true}).click();await page.getByLabel('Primary adult first name',{exact:true}).fill('Morgan');await page.getByLabel('Primary adult last name',{exact:true}).fill('Fixture');await page.getByLabel('Email',{exact:true}).fill('synthetic@example.test');await page.getByLabel('Mobile phone',{exact:true}).fill('1');await page.getByLabel('Attendee first name',{exact:true}).fill('Morgan');await page.getByLabel('Attendee last name',{exact:true}).fill('Fixture');await page.getByLabel('Age',{exact:true}).fill('38');
  await page.evaluate(()=>window.oldForm=document.querySelector('#outreach-registration-staff form'));
  await page.getByRole('button',{name:'Submit household registration',exact:true}).click();await page.waitForFunction(()=>!oldForm.querySelector('button[type=submit]').disabled);
  if(['denied','expired','forbidden'].includes(kind)){
   const retained=await page.getByLabel('Mobile phone',{exact:true}).count();
   if(process.env.REPRO){ok(retained===1,'original denial retains private form');console.log(JSON.stringify({engine,width,kind,privateFormRetained:true}));}
   else{ok(retained===0,'explicit denial removes private form');ok(await page.getByRole('heading',{name:kind==='expired'?'Sign in to continue':'Registration access unavailable'}).count()===1,'safe denial shown');const n=calls.length;await page.evaluate(()=>oldForm.onsubmit(new Event('submit')));ok(calls.length===n,'retained denied form cannot send again');}
  }else{
   await page.getByLabel('Mobile phone',{exact:true}).fill('+15555550100');await page.getByRole('button',{name:'Submit household registration',exact:true}).click();await page.waitForTimeout(40);
   const writes=calls.filter(p=>p.p_action==='walkup');
   if(process.env.REPRO){ok(writes.length===1&&await page.locator('body').innerText().then(t=>t.includes('pending confirmation')),'original validation correction blocked');console.log(JSON.stringify({engine,width,kind,requests:writes.length,correctionBlocked:true}));}
   else if(kind==='validation'){
    ok(writes.length===2,'confirmed check rejection permits correction');ok(writes[0].p_payload.request_key===writes[1].p_payload.request_key&&writes[0].p_payload.attendees[0].client_key===writes[1].p_payload.attendees[0].client_key,'retry preserves idempotency identities');ok(writes[1].p_payload.phone==='+15555550100','corrected value submitted');await page.getByRole('heading',{level:2,name:'Morgan Fixture',exact:true}).waitFor();ok(true,'successful correction opens canonical household');
   }else{
    ok(writes.length===1,'uncertain outcome forbids changed-payload retry');ok(await page.locator('body').innerText().then(t=>t.includes('pending confirmation')),'uncertainty explained');await page.getByLabel('Mobile phone',{exact:true}).fill('1');await page.getByRole('button',{name:'Submit household registration',exact:true}).click();await page.getByRole('heading',{level:2,name:'Morgan Fixture',exact:true}).waitFor();const retried=calls.filter(p=>p.p_action==='walkup');ok(retried.length===2&&JSON.stringify(retried[0].p_payload)===JSON.stringify(retried[1].p_payload),'uncertain retry preserves exact payload');
   }
  }
  ok(errors.length===0,'no runtime errors');await page.close();
 }
 await browser.close();
}
console.log(`${checks} walk-up retry browser assertions PASS`);

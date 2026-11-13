// Actual public handlers and canonical disposable PostgreSQL. Auth/OTP/Turnstile are fictional;
// no external request is permitted and no provider acceptance is claimed.
import {createRegistrationHandler} from '../../supabase/functions/outreach-registration-submit/gateway.mjs';
import assert from 'node:assert/strict';import {chromium,webkit} from 'playwright';import {read} from './minden-contract-fixture.mjs';
export async function publicJourney(db){
 let checks=0;
 for(const [browserName,type] of [['chromium',chromium],['webkit',webkit]]){
  const browser=await type.launch({headless:true});
  try{for(const width of [390,1280]){
   const page=await browser.newPage({viewport:{width,height:900}});const errors=[];page.on('pageerror',e=>errors.push(e.message));
   const client=await db.connect();let created=null,decisionId=null,otp=0;
   async function sql(role,query,args=[]){await client.query('reset role');await client.query('set role '+role);return client.query(query,args)}
   await page.exposeFunction('localConfig',async()=>({data:(await sql('anon',"select outreach_registration_config('minden-family-fun-day') v")).rows[0].v}));
   const gateway=createRegistrationHandler({url:'https://bkbmjisprwmkptywtmih.supabase.co',serviceKey:'FICTIONAL',pepper:'synthetic'.repeat(8),turnstileSecret:'synthetic-real-format',action:'outreach-registration',hostnames:['local.invalid'],origins:['https://local.invalid'],mode:'acceptance'},async(endpoint,init)=>{
    if(endpoint==='https://challenges.cloudflare.com/turnstile/v0/siteverify')return new Response(JSON.stringify({success:true,action:'outreach-registration',hostname:'local.invalid'}));
    assert.equal(endpoint,'https://bkbmjisprwmkptywtmih.supabase.co/rest/v1/rpc/outreach_registration_gateway');const body=JSON.parse(init.body);assert.equal(body.p_slug,'minden-family-fun-day');assert.match(body.p_network,/^[a-f0-9]{64}$/);
    created=(await sql('service_role','select outreach_registration_gateway($1,$2,$3) v',[body.p_slug,body.p_payload,body.p_network])).rows[0].v;return new Response(JSON.stringify(created));
   });
   await page.exposeFunction('localSubmit',async body=>{assert.equal(body.slug,'minden-family-fun-day');assert.equal(body.turnstile_token,'FICTIONAL-LOCAL');const response=await gateway(new Request('https://synthetic.invalid/functions/v1/outreach-registration-submit',{method:'POST',headers:{'content-type':'application/json',origin:'https://local.invalid','cf-connecting-ip':'192.0.2.123'},body:JSON.stringify(body)}));assert.equal(response.status,200);return response.json()});
   await page.exposeFunction('localDecision',async p=>{assert.equal(p.source,'minden_la_outreach');const id=crypto.randomUUID();await sql('anon','insert into outreach_registrations(id,source,first_name,last_name,email,phone,decision,prayer_request,consent)values($1,$2,$3,$4,$5,$6,$7,$8,$9)',[id,p.source,p.first_name,p.last_name,p.email,p.phone,p.decision,p.prayer_request,p.consent]);decisionId=id;return{error:null}});
   await page.exposeFunction('blockedOtp',()=>{otp++;return{error:{message:'Synthetic transport disabled'}}});
   await page.addInitScript(()=>{
    window.CHAMPION_LIFE_SUPABASE={url:'https://synthetic.invalid',publishableKey:'fictional',outreachSiteKey:'fictional'};
    window.supabase={createClient:()=>({rpc:(name,args)=>{if(name!=='outreach_registration_config'||args.p_slug!=='minden-family-fun-day')throw Error('Unexpected config contract');return window.localConfig()}})};
    window.turnstile={render:(_root,opts)=>{opts.callback('FICTIONAL-LOCAL');return 1},remove:()=>{},reset:()=>{}};
    window.ChampionLifeAuth={client:{from:name=>{if(name!=='outreach_registrations')throw Error('Unexpected table');return{insert:p=>window.rejectDecision?Promise.resolve({error:{code:'42501'}}):window.localDecision(p)}},auth:{signInWithOtp:()=>window.blockedOtp()}}};
    window.fetch=async(url,options)=>{if(url!=='https://synthetic.invalid/functions/v1/outreach-registration-submit'||options.method!=='POST')throw Error('Unexpected submission endpoint');return{ok:true,status:200,json:()=>window.localSubmit(JSON.parse(options.body))}};
   });
   await page.route('**/*',async route=>{const u=new URL(route.request().url()),p=u.pathname;
    if(u.hostname!=='local.invalid')return route.fulfill({status:200,body:'',contentType:'application/javascript'});
    if(p==='/minden/register/')return route.fulfill({contentType:'text/html',body:read('minden/register/index.html')});
    if(p==='/minden/es/')return route.fulfill({contentType:'text/html',body:read('minden/es/index.html')});
    if(p==='/minden/')return route.fulfill({contentType:'text/html',body:read('minden/index.html')});
    if(p==='/assets/js/outreach-registration-form.js')return route.fulfill({contentType:'application/javascript',body:read(p.slice(1))+"\nconst originalMount=OutreachRegistrationForm.mount;OutreachRegistrationForm.mount=(...a)=>window.testEditor=originalMount(...a);"});
    if(['/assets/js/outreach-staff-common.js','/assets/js/outreach-registration-public.js'].includes(p))return route.fulfill({contentType:'application/javascript',body:read(p.slice(1))});
    return route.fulfill({status:200,body:'',contentType:p.endsWith('.css')?'text/css':'application/javascript'});
   });
   try{
    await page.goto('https://local.invalid/minden/register/');await page.waitForFunction(()=>Boolean(window.testEditor));
    assert.equal(await page.locator('#registration-hosted-by').textContent(),'Venue: Victory Park');
    await page.evaluate(()=>{
     const editor=window.testEditor,set=(label,value)=>{const l=[...document.querySelectorAll('label')].find(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===label);if(!l)throw Error('Missing '+label);const input=l.querySelector('input,select,textarea');if(input.type==='checkbox')input.checked=value;else input.value=value;input.dispatchEvent(new Event('change'))};
     for(const [label,v]of Object.entries({'Primary adult first name':'Browser','Primary adult last name':'Synthetic','Email':'browser@example.invalid','Mobile phone':'+15555550100','Street address':'100 Synthetic Street','City':'Minden','State / Province':'LA','Postal / ZIP code':'71055','Emergency telephone number':'+15555550101','Typed legal name':'Browser Synthetic','Signer relationship':'parent','Media release initials':'BS'}))set(label,v);
     editor.addMember('child');for(const[i,r]of editor.rows.entries()){r.first.value=i?'Child':'Browser';r.last.value='Synthetic';r.age.value=i?'8':'35';r.age.dispatchEvent(new Event('input'));r.relationship.value=i?'child':'self';r.guardian.value=i?'Parent':'';r.cover.checked=true;}
     for(const label of['I have read and acknowledge this waiver.','I am an adult with authority to sign for each selected attendee.','I give permission under the media release above.'])set(label,true);
     editor.form.dispatchEvent(new Event('submit',{bubbles:true,cancelable:true}));
    });
    await page.waitForFunction(()=>document.querySelector('.registration-confirmation'));assert.equal(created.attendee_count,2);
    assert.match(await page.locator('#outreach-registration-app').textContent(),/Bicycle eligibility and giveaway procedures must be confirmed/);
    await sql('postgres','select 1');assert.equal((await client.query('select count(*)::int n from outreach_event_registrations where reference=$1',[created.reference])).rows[0].n,1);
    checks++;console.log(`PASS ${browserName}/${width} actual family handler -> Edge handler -> canonical database -> confirmation`);
    await page.goto('https://local.invalid/minden/'+(width===390?'es/':''));
    await page.locator('[name="first-name"]').fill('Browser');await page.locator('[name="last-name"]').fill('Decision');await page.locator('[name="email"]').fill('decision@example.invalid');await page.locator('[name="phone"]').fill('+15555550100');await page.locator('[name="decision"]').selectOption('salvation');await page.locator('input[type="checkbox"]').check();await page.evaluate(()=>window.rejectDecision=true);await page.locator('#mindenDecisionSubmit').click();await page.waitForFunction(()=>document.querySelector('#mindenDecisionFormMsg').classList.contains('error'));assert.equal(otp,0);assert.equal(decisionId,null);assert.equal(await page.locator('#mindenDecisionFormCard').evaluate(n=>n.classList.contains('registered')),false);await page.evaluate(()=>window.rejectDecision=false);await page.locator('#mindenDecisionSubmit').click();await page.waitForFunction(()=>document.querySelector('#mindenDecisionFormCard').classList.contains('registered'));
    await sql('postgres','select 1');assert.equal((await client.query('select source from outreach_registrations where id=$1',[decisionId])).rows[0].source,'minden_la_outreach');assert.equal(otp,1);assert.match(await page.locator('#mindenDecisionAccountNote').textContent(),/registration is complete|registro está completo/);assert.deepEqual(errors,[]);
    checks++;console.log(`PASS ${browserName}/${width} actual decision handler -> canonical INSERT; OTP intercepted and disabled`);
   }finally{await page.close();await client.end()}
  }}finally{await browser.close()}
 }
 return checks;
}

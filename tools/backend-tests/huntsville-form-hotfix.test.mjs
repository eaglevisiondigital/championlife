// Actual DOM-generated household payloads -> unchanged SQL gateway -> confirmation.
// Disposable local database only; no hosted connection or real Turnstile request.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID as uuid} from 'node:crypto';
import {JSDOM,VirtualConsole} from 'jsdom';
import {PGlite} from '@electric-sql/pglite';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
import {createRegistrationHandler} from '../../supabase/functions/outreach-registration-submit/gateway.mjs';
const definition=JSON.parse(readFileSync(new URL('../../config/outreach/huntsville-2026.json',import.meta.url)));
const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite();
const q=(s,a=[])=>db.query(s,a),admin=uuid(),viewer=uuid();
let checks=0,c,config,expectedAdults=0,expectedKids=0,expectedHouseholds=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const role=async(r,id='')=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role '+r)};
const staff=(action,p={})=>q('select outreach_registration_workspace($1,$2,$3) v',[action,c,p]).then(x=>x.rows[0].v);
const gateway=async p=>{await role('service_role');return (await q('select outreach_registration_gateway($1,$2,$3) v',['huntsville-2026',p,'f'.repeat(64)])).rows[0].v};
// Run the actual Edge handler with a synthetic Siteverify fixture and native SQL.
// No request in this test can leave the injected fetcher.
const endpoint='https://aaaaaaaaaaaaaaaaaaaa.supabase.co';
const handler=createRegistrationHandler({url:endpoint,serviceKey:'SYNTHETIC_SERVICE',pepper:'x'.repeat(32),turnstileSecret:'SYNTHETIC_SECRET',action:'outreach-registration',hostnames:['synthetic.example.test'],origins:['https://synthetic.example.test']},async(url,init)=>{
 if(url==='https://challenges.cloudflare.com/turnstile/v0/siteverify'){assert.equal(JSON.parse(init.body).response,'SYNTHETIC_CHALLENGE');return Response.json({success:true,hostname:'synthetic.example.test',action:'outreach-registration'});}
 assert.equal(url,endpoint+'/rest/v1/rpc/outreach_registration_gateway');const input=JSON.parse(init.body);assert.equal(input.p_slug,'huntsville-2026');return Response.json(await gateway(input.p_payload));
});
const submitHttp=async p=>{const r=await handler(new Request(endpoint+'/functions/v1/outreach-registration-submit',{method:'POST',headers:{Origin:'https://synthetic.example.test','Content-Type':'application/json','cf-connecting-ip':'192.0.2.123'},body:JSON.stringify({slug:'huntsville-2026',payload:p,turnstile_token:'SYNTHETIC_CHALLENGE'})}));assert.equal(r.status,200);return r.json();};
function label(t,name){const l=[...t.d.querySelectorAll('label')].find(x=>[...x.childNodes].filter(n=>n.nodeType===3).map(n=>n.textContent).join('').trim()===name);assert(l,name);return l.querySelector('input,select,textarea')}
function set(t,name,value){const i=label(t,name);if(i.type==='checkbox')i.checked=value;else i.value=value;i.dispatchEvent(new t.w.Event('change'));return i}
function mount(ages,preference='',cfg=config){
 const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));
 const dom=new JSDOM('<main id="root"></main>',{url:'https://synthetic.example.test/outreach-register.html',runScripts:'outside-only',virtualConsole:vc});
 const t={dom,w:dom.window,d:dom.window.document,errors,sent:[]};t.w.TextEncoder=TextEncoder;
 for(const file of ['outreach-staff-common.js','outreach-registration-form.js'])t.w.eval(readFileSync(new URL('../../assets/js/'+file,import.meta.url),'utf8'));
 t.root=t.d.getElementById('root');t.editor=t.w.OutreachRegistrationForm.mount(t.root,cfg,async p=>{t.sent.push(JSON.parse(JSON.stringify(p)))});
 for(const[name,value]of Object.entries({'Primary adult first name':'Morgan','Primary adult last name':'Synthetic','Email':'family@example.test','Mobile phone':'+15555550100','Street address':'100 Synthetic Street','City':'Madison','State / Province':'AL','Postal / ZIP code':'35758','Emergency telephone number':'+15555550101','Typed legal name':'Morgan Synthetic','Signer relationship':ages.some(a=>a<18)?'parent':ages.length===1?'self':'authorized_adult','Media release initials':'MS'}))set(t,name,value);
 ages.forEach((age,i)=>{const r=i?t.editor.addMember(age<18?'child':'adult'):t.editor.rows[0];r.first.value=i?'Person'+i:'Morgan';r.last.value='Synthetic';r.age.value=String(age);r.age.dispatchEvent(new t.w.Event('input'));r.relationship.value=age<18?'child':i?'other':'self';r.guardian.value=age<18?'Parent':'';r.choice.value=preference;r.cover.checked=true;});
 for(const name of ['I have read and acknowledge this waiver.','I am an adult with authority to sign for each selected attendee.','I give permission under the media release above.'])set(t,name,true);
 t.submit=async()=>{t.editor.form.dispatchEvent(new t.w.Event('submit',{bubbles:true,cancelable:true}));await new Promise(r=>setTimeout(r,0));};
 return t;
}
async function accept(t,ages,preference){
 ok(t.editor.form.checkValidity(),'native form validity for ages '+ages.join('/'));
 await t.submit();assert.equal(t.sent.length,1);const p=t.sent[0];
 assert.deepEqual(p.attendees.map(a=>a.age),ages);
 for(const a of p.attendees){assert.equal(a.prize_participation,!!preference);assert.equal(a.bike_interest,preference==='bicycle');assert.equal(a.tablet_only,preference==='tablet');assert.equal(a.prize_choice,null);}
 assert.deepEqual(p.consents,{ministry_followup:false,communications:false,marketing:false,media:true});
 const receipt=await submitHttp(p);ok(receipt.accepted===true&&receipt.attendee_count===ages.length,'unchanged HTTP gateway and SQL accept DOM payload '+ages.join('/')+' '+(preference||'no prize'));
 assert.equal((await submitHttp(p)).reference,receipt.reference);
 expectedHouseholds++;expectedAdults+=ages.filter(a=>a>=18).length;expectedKids+=ages.filter(a=>a<18).length;
 await role('authenticated',viewer);const list=await staff('list'),r=list.registrations.find(r=>r.reference===receipt.reference),detail=await staff('detail',{registration_id:r.id});
 assert.deepEqual([list.summary.households,list.summary.adults,list.summary.minors],[expectedHouseholds,expectedAdults,expectedKids]);
 assert.equal(detail.signatures.length,1);assert.equal(detail.signatures[0].coverage_snapshot.length,ages.length);assert.equal(detail.signatures[0].text_snapshot,definition.waiver.text);assert.equal(detail.signatures[0].media_initials,'MS');
 assert(detail.attendees.every(a=>!a.present_to_win&&!a.checked_in_at&&a.waiver_covered));
 t.w.OutreachRegistrationForm.confirmation(t.root,config,receipt,p);
 assert(t.root.textContent.includes('YOU’RE REGISTERED!'));assert(t.root.textContent.includes(receipt.reference));assert.equal(t.root.querySelectorAll('a').length,1);
 assert.match(t.root.querySelector('a').href,/^https:\/\/calendar.google.com\/calendar\/render\?/);
 assert([...t.root.querySelectorAll('button')].some(b=>b.textContent==='Add to Apple Calendar'));
 assert.equal(t.root.textContent.split(' · Child').length-1,ages.filter(a=>a<18).length);
 assert.equal(t.root.textContent.split(' · Adult').length-1,ages.filter(a=>a>=18).length);
 assert.equal(t.d.activeElement,t.root.querySelector('.registration-confirmation'));assert.deepEqual(t.errors,[]);
 ok(true,'reference, waiver, totals, idempotency, unchanged prize eligibility and calendar confirmation '+ages.join('/'));
 t.dom.window.close();return p;
}
try{
 await db.exec(readFileSync(new URL('fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const file of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+file,import.meta.url),'utf8'));
 const campaign=(await q("select id,organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0];c=campaign.id;
 const otherCampaigns=JSON.stringify((await q('select * from outreach_campaigns where id<>$1 order by id',[c])).rows);
 for(const[id,name]of[[admin,'Admin'],[viewer,'Viewer']])await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[id,name+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name) values($1,$2,'Synthetic admin')",[campaign.organization_id,admin]);
 await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason) values($1,$2,'manage','Local fixture')",[campaign.organization_id,admin]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,reason) values($1,$2,'local_leader',array['view','registration.view','registration.export'],'Local fixture')",[c,viewer]);
 await q("update outreach_campaigns set status='approved' where id=$1",[c]);
 await role('authenticated',admin);await staff('configure',{...definition.registration,revision:1,enabled:true});await staff('waiver_publish',{...definition.waiver,effective_at:'2026-01-01T00:00:00Z'});
 await role('anon');config=(await q('select outreach_registration_config($1) v',['huntsville-2026'])).rows[0].v;
 let sample;
 for(const age of [0,5,12,17,18,40])for(const preference of ['', 'bicycle','tablet'])sample=await accept(mount([age],preference),[age],preference);
 sample=await accept(mount([40,0,5,12,17,18],'bicycle'),[40,0,5,12,17,18],'bicycle');
 await accept(mount([18,40],'tablet'),[18,40],'tablet');
 await accept(mount([40,5,12],'tablet'),[40,5,12],'tablet');
 await accept(mount([40,5,12],''),[40,5,12],'');
 await accept(mount([40,0],''),[40,0],'');
 const noFields=mount([0]);ok(!noFields.root.textContent.includes('Optional consent')&&!noFields.root.textContent.includes('Marketing communications')&&!noFields.root.textContent.includes('Interested in a bike')&&!noFields.root.textContent.includes('Tablet only'),'no overlapping prize or optional communication controls');
 assert.deepEqual([...label(noFields,'Prize Preference').options].map(o=>[o.value,o.textContent]),[['bicycle','Bicycle'],['tablet','Tablet'],['','No preference']]);ok(noFields.root.textContent.includes('does not guarantee')&&noFields.root.textContent.includes('Children of any age may register'),'registration independent of prize preference');noFields.dom.window.close();
 const clientCases=[
  ['missing guardian',t=>{t.editor.rows[0].guardian.value='';}],
  ['minor marked Self',t=>{t.editor.rows[0].relationship.value='self';}],
  ['Self signer for minor',t=>set(t,'Signer relationship','self')],
  ['authorized adult without guardian authority',t=>set(t,'Signer relationship','authorized_adult')],
  ['missing coverage',t=>{t.editor.rows[0].cover.checked=false;}],
  ['missing waiver acknowledgment',t=>set(t,'I have read and acknowledge this waiver.',false)],
  ['missing authority acknowledgment',t=>set(t,'I am an adult with authority to sign for each selected attendee.',false)],
  ['missing media permission',t=>set(t,'I give permission under the media release above.',false)],
  ['missing initials',t=>set(t,'Media release initials','')],
 ];
 for(const[name,change]of clientCases){const t=mount([0]);change(t);await t.submit();ok(t.sent.length===0,'before-API denial: '+name);t.dom.window.close();}
 for(const[name,value,message]of [
  ['Primary adult first name','   ','first and last name'],
  ['Mobile phone','555','7–15 digits'],
  ['Mobile phone','555-555-0100 ext 2','omit extensions'],
  ['Emergency telephone number','not a phone','7–15 digits'],
  ['Email','parent@example','complete email address'],
  ['Typed legal name','  ','full legal name'],
  ['Media release initials','  ','initials'],
  ['City','  ','address fields'],
 ]){const t=mount([40,5,12]);const field=set(t,name,value);await t.submit();assert(t.root.querySelector('[role=alert]').textContent.includes(message));assert.equal(t.d.activeElement,field);ok(t.sent.length===0,'safe focused validation before API: '+name);t.dom.window.close();}
 for(const age of [-1,121,1.5]){const t=mount([age]);await t.submit();ok(t.sent.length===0,'before-API invalid age '+age);t.dom.window.close();}
 for(const ages of [[18,40],[18]]){const t=mount(ages);set(t,'Signer relationship','self');if(ages.length===1)set(t,'Typed legal name','Different Synthetic');await t.submit();ok(t.sent.length===0,'self signature must cover only matching signer');t.dom.window.close();}
 const guardian=mount([0]);set(guardian,'Signer relationship','legal_guardian');await guardian.submit();ok((await gateway(guardian.sent[0])).accepted,'legal guardian remains supported');guardian.dom.window.close();
 for(const[name,change]of [
  ['minor Self signer',p=>{p.waiver.signer_relationship='self';}],
  ['missing guardian',p=>{p.attendees[1].guardian_relationship='';}],
  ['uncovered child',p=>{p.waiver.covered_keys.splice(1,1);}],
  ['unconfigured prize catalog ID',p=>{p.attendees[1].prize_choice='bicycle';}],
  ['conflicting prize flags',p=>{p.attendees[1].tablet_only=true;}],
  ['age below zero',p=>{p.attendees[1].age=-1;}],
  ['fractional age',p=>{p.attendees[1].age=0.5;}],
  ['missing authority',p=>{p.waiver.authority_acknowledged=false;}],
  ['missing acknowledgment',p=>{p.waiver.acknowledged=false;}],
 ]){const p=structuredClone(sample);p.request_key=uuid();p.waiver.request_key=uuid();change(p);const r=await gateway(p);ok(r.accepted===false&&r.reason==='invalid','unchanged backend rejects '+name);}
 await db.exec('reset role');ok((await q('select count(*)::int n from outreach_event_registrations')).rows[0].n===expectedHouseholds+1,'rejected payloads create no partial household records');
 ok(JSON.stringify((await q('select * from outreach_campaigns where id<>$1 order by id',[c])).rows)===otherCampaigns,'all other campaign definitions unchanged');
 const legacy=mount([18],'',{...config,slug:'another-city',prize_choices:[{id:'approved-bike',label:'Approved bike'}]});
 ok(legacy.root.textContent.includes('Optional consent')&&legacy.editor.rows[0].prize&&legacy.editor.rows[0].age.min==='18','other cities retain approved controls and adult-row validation');
 assert.equal(legacy.editor.addMember('child').age.max,'17');assert.equal(legacy.editor.rows[0].choice.options[1].value,'approved-bike');legacy.dom.window.close();
 await role('authenticated',viewer);ok((await staff('csv')).csv.includes('Minor'),'existing scoped CSV remains available');
 await db.exec('reset role');await q('update outreach_campaign_assignments set active=false where campaign_id=$1 and user_id=$2',[c,viewer]);await role('authenticated',viewer);await assert.rejects(()=>staff('csv'));ok(true,'same-session export revocation preserved');
 await role('anon');await assert.rejects(()=>staff('list'));await assert.rejects(()=>q('select * from outreach_event_registrations'));ok(true,'anonymous reporting and raw records denied');
 console.log(`${checks} Huntsville form hotfix checks passed`);
}finally{await db.close()}

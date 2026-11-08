// Actual registration runtime and unchanged SQL; fictional local identities only.
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),admin=uuid(),worker=uuid(),other=uuid(),A=uuid(),B=uuid();let checks=0;
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const actor=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
const staff=(action,p={},campaign=A)=>q('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p]).then(r=>r.rows[0].v);
const sources=['outreach-staff-common.js','outreach-registration-form.js','outreach-registration-staff.js'].map(n=>process.env.REVIEW_BASE?execFileSync('git',['show',process.env.REVIEW_BASE+':assets/js/'+n],{encoding:'utf8'}):readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8'));
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const f of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 for(const id of[admin,worker,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic administrator')",[org,admin]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic fixture')",[org,admin]);await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,admin]);
 for(const[id,code]of[[A,'synthetic_roster_a'],[B,'synthetic_roster_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[id,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.'})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];
 await staff('walkup',{request_key:uuid(),first_name:'Morgan',last_name:'Fixture',email:'fixture@example.test',phone:'+15555550100',attendees:members,consents:{ministry_followup:false,communications:false,marketing:false,media:false},waiver:{request_key:uuid(),version_id:version,signer_name:'Morgan Fixture',signer_relationship:'parent',acknowledged:true,authority_acknowledged:true,covered_keys:members.map(m=>m.client_key)}});

 await actor(worker);const full=await staff('detail',{registration_id:(await staff('list')).registrations[0].id});
 await db.exec('reset role');
 const reset=async()=>{await q('update outreach_event_attendees set checked_in_at=null,checked_in_by=null where registration_id=$1',[full.id]);await q("update outreach_event_registrations set status='confirmed' where id=$1",[full.id]);await q("update outreach_campaign_assignments set active=true,capabilities=array['view','registration.view','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker])};
 const state=async()=>({status:(await q('select status from outreach_event_registrations where id=$1',[full.id])).rows[0].status,checked:(await q('select count(*) n from outreach_event_attendees where registration_id=$1 and checked_in_at is not null',[full.id])).rows[0].n,audits:(await q("select count(*) n from outreach_campaign_audit where campaign_id=$1 and kind in ('attendee.checked_in','attendee.checkin_reversed')",[A])).rows[0].n});
 for(const [engine,type] of Object.entries({chromium,webkit})){
  if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
  const browser=await type.launch({headless:true});try{for(const width of [390,1280]){
   await reset();const page=await browser.newPage({viewport:{width,height:900}}),calls=[],errors=[];let who=worker,hold=null,release=null,held=false;
   page.on('pageerror',e=>errors.push(e.message));
   await page.exposeFunction('fixtureRpc',async(name,p)=>{
    assert.equal(name,'outreach_registration_workspace','no People/decision/finance/learner calls');calls.push({...p,actor:who});
    const connection=await db.connect();let result;try{
     await connection.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await connection.query('set role authenticated');
     result={data:(await connection.query('select outreach_registration_workspace($1,$2,$3) v',[p.p_action,p.p_campaign,p.p_payload])).rows[0].v,error:null,status:200};
    }catch(e){result={data:null,error:{code:e.code,message:e.message},status:e.code==='42501'?403:400}}
    finally{await connection.end()}
    if(hold===p.p_action){hold=null;held=true;await new Promise(r=>release=r)}
    return result;
   });
   await page.route('**/*',route=>{assert.equal(new URL(route.request().url()).origin,'https://registration-journey.invalid');return route.fulfill({contentType:'text/html',body:'<meta name="viewport" content="width=device-width,initial-scale=1"><div id="outreach-registration-staff"></div>'})});
   await page.goto('https://registration-journey.invalid/?campaign='+A);
   await page.evaluate(id=>{window.actor={id};window.StaffWorkspace={active:()=>true};window.ChampionLifeAuth={getUser:async()=>actor,client:{auth:{onAuthStateChange:f=>window.authChange=f},rpc:(n,p)=>fixtureRpc(n,p)}}},worker);
   for(const source of sources)await page.addScriptTag({content:source});
   const label=engine+'/'+width+' ',mutations=()=>calls.filter(c=>['checkin','reverse'].includes(c.p_action));
   const open=async()=>{await page.getByRole('button',{name:'Open household',exact:true}).click();await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const fresh=async()=>{await page.evaluate(()=>dispatchEvent(new Event('focus')));await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor()};
   const checkIn=async()=>{const count=await page.getByRole('button',{name:'Reverse check-in',exact:true}).count();await page.getByRole('button',{name:'Check in attendee',exact:true}).first().click();await page.waitForFunction(n=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Reverse check-in').length===n,count+1)};
   const reverse=async()=>{const count=await page.getByRole('button',{name:'Reverse check-in',exact:true}).count();const card=page.locator('.registration-member').filter({has:page.getByRole('button',{name:'Reverse check-in',exact:true})}).first();await card.getByLabel('Reason for check-in correction').fill('Fictional correction');await card.getByRole('button',{name:'Reverse check-in',exact:true}).click();await page.waitForFunction(n=>[...document.querySelectorAll('button')].filter(b=>b.textContent==='Reverse check-in').length===n&&document.body.textContent.includes('Attendees & check-in'),count-1)};
   await open();const auditStart=(await state()).audits;ok(await page.locator('.registration-member').count()===2,label+'registered adult/minor roster');ok(!await page.getByRole('button',{name:'Save household',exact:true}).count(),label+'check-in role has no registration management');
   await checkIn();ok((await state()).status==='checked_in'&&(await state()).checked===1,label+'one attendee marks household checked in');
   await checkIn();ok((await state()).checked===2,label+'second attendee checked in independently');
   await reverse();ok((await state()).status==='checked_in'&&(await state()).checked===1,label+'partial reversal preserves checked-in household');
   await reverse();ok((await state()).status==='confirmed'&&(await state()).checked===0,label+'last reversal restores confirmed household');
   ok((await state()).audits===auditStart+4,label+'each check-in/reversal has exactly one audit');
   await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('button',{name:'Open household',exact:true}).waitFor();ok((await page.locator('.registration-row').innerText()).includes('confirmed'),label+'list reflects authoritative registration status');await open();
   for(const target of ['button','card','root']){
    await fresh();const before=mutations().length;
    await page.evaluate(async target=>{const button=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee'),node=target==='button'?button:target==='card'?button.closest('.registration-member'):document.getElementById('outreach-registration-staff'),parent=node.parentNode,next=node.nextSibling;window.oldCheck=button;window.savedHandler=button.onclick;node.remove();parent.insertBefore(node,next);await savedHandler()},target);
    const delta=mutations().length-before;
    if(process.env.REPRO){ok(delta===1,label+'original removed/reinserted '+target+' issued NEW check-in');console.log(JSON.stringify({engine,width,target,newMutation:delta,actualDatabase:await state()}));await reset();continue}
    ok(delta===0,label+'removed/reinserted '+target+' cannot issue NEW mutation');await page.evaluate(()=>savedHandler());ok(mutations().length===before,label+'captured retired handler remains denied');
   }
   if(process.env.REPRO){await page.close();continue}
   await fresh();await checkIn();const beforeReverse=mutations().length;
   await page.evaluate(async()=>{const b=[...document.querySelectorAll('button')].find(b=>b.textContent==='Reverse check-in'),p=b.parentNode;b.closest('.registration-member').querySelector('input').value='Fictional correction';const fn=b.onclick;b.remove();p.append(b);await fn()});
   ok(mutations().length===beforeReverse&&(await state()).checked===1,label+'retired reversal cannot change attendance');await fresh();await reverse();
   // Already submitted requests are not cancelled; only a second request is forbidden.
   await fresh();hold='checkin';held=false;const beforeHeld=mutations().length;await page.evaluate(()=>{window.oldCheck=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee');window.inflight=oldCheck.onclick()});
   for(let i=0;!held&&i<200;i++)await page.waitForTimeout(10);assert(held);
   await page.evaluate(async()=>{const p=oldCheck.parentNode;oldCheck.remove();p.append(oldCheck);await oldCheck.onclick()});ok(mutations().length===beforeHeld+1,label+'pending request not duplicated after removal');release();await page.evaluate(()=>inflight);await page.getByRole('button',{name:'Reverse check-in',exact:true}).waitFor();await page.evaluate(()=>oldCheck.onclick());ok(mutations().length===beforeHeld+1,label+'completed old handler cannot initiate second request');await reverse();
   await fresh();await page.evaluate(()=>window.oldCheck=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee'));
   await q("update outreach_campaign_assignments set capabilities=array['view','registration.view'] where campaign_id=$1 and user_id=$2",[A,worker]);const beforeDenied=await state();await page.evaluate(()=>oldCheck.onclick());await page.getByRole('heading',{name:'Registration access unavailable',exact:true}).waitFor();assert.deepEqual(await state(),beforeDenied);ok(true,label+'native revoked check-in denies without record/audit changes');await reset();
   await page.evaluate(()=>dispatchEvent(new Event('focus')));await open();const previous=mutations().length;who=other;await page.evaluate(id=>{window.oldCheck=[...document.querySelectorAll('button')].find(b=>b.textContent==='Check in attendee');window.actor={id};authChange('SIGNED_IN',{user:actor});oldCheck.onclick()},other);await page.getByRole('heading',{name:'Registration access unavailable',exact:true}).waitFor();ok(mutations().length===previous,label+'account replacement invalidates old check-in');
   ok(errors.length===0,label+'no browser errors');ok(calls.every(c=>c.p_campaign===A),label+'all requests preserve campaign');
   if(process.env.REGISTRATION_EVIDENCE_DIR){mkdirSync(process.env.REGISTRATION_EVIDENCE_DIR,{recursive:true});writeFileSync(process.env.REGISTRATION_EVIDENCE_DIR+'/'+engine+'-'+width+'.json',JSON.stringify({calls,errors},null,2))}
   who=worker;await page.close();
  }}finally{await browser.close()}
 }
 console.log(JSON.stringify({checks,status:'PASS',nativePostgres:true,fictionalAuth:true,reproduction:!!process.env.REPRO,hosted:false}));
}finally{await db.close()}

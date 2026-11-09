// Actual registration runtime and unchanged SQL; fictional local identities only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {session} from '../staff-cycle7/people-registration-fixture.mjs';
import {randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const db=await localPostgres(),q=(s,p=[])=>db.query(s,p),admin=uuid(),worker=uuid(),other=uuid(),A=uuid(),B=uuid();let checks=0;const reproductions=[];
const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
const actor=async id=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[id]);await db.exec('set role authenticated')};
const staff=(action,p={},campaign=A)=>q('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p]).then(r=>r.rows[0].v);
try{
 await db.exec(readFileSync(new URL('../backend-tests/fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));for(const f of migrationOrder)await db.exec(readFileSync(new URL('../../supabase/migrations/'+f,import.meta.url),'utf8'));
 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 for(const id of[admin,worker,other])await q('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[id,id+'@example.test']);
 await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'Synthetic administrator')",[org,admin]);await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Synthetic fixture')",[org,admin]);await q("insert into organization_staff_permissions(organization_id,user_id,permission)values($1,$2,'staff.manage')",[org,admin]);
 for(const[id,code]of[[A,'synthetic_roster_a'],[B,'synthetic_roster_b']])await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status)values($1,$2,$3,$3,'Test','US','UTC','approved')",[id,org,code]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason)values($1,$2,'local_leader',array['view','registration.view','registration.manage','checkin.manage'],true,'Synthetic fixture')",[A,worker]);
 await actor(admin);await staff('configure',{revision:0,public_slug:'synthetic-roster-a',enabled:true,waiver_required:true,prize_choices:[{id:'bike',label:'Bicycle'}]});
 const version=(await staff('waiver_publish',{template_key:'synthetic-only',version:1,effective_at:'2026-01-01T00:00:00Z',text:'SYNTHETIC TEST WAIVER. Not approved for real events.',media_text:'SYNTHETIC MEDIA RELEASE. Fictional only.',media_initials_required:true})).id;
 const members=[{client_key:uuid(),first_name:'Morgan',last_name:'Fixture',age:38,relationship:'self',guardian_relationship:'',attending:true,prize_participation:false,prize_choice:null,answers:{}},{client_key:uuid(),first_name:'Alex',last_name:'Fixture',age:9,relationship:'child',guardian_relationship:'Parent',attending:true,prize_participation:true,prize_choice:'bike',answers:{}}];


 let full;await db.exec('reset role');
 const root=new URL('../../',import.meta.url),sdk=readFileSync(process.env.SUPABASE_SDK_PATH),origin='https://household-native.invalid',backend='https://synthetic-composition.supabase.co',key='sb-synthetic-composition-auth-token';
 assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
 const publicFiles=new Set(JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root))));
 const execute=async(who,action,p={},campaign=A)=>{const c=await db.connect();try{await c.query("select set_config('request.jwt.claim.sub',$1,false)",[who]);await c.query('set role authenticated');return{data:(await c.query('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p])).rows[0].v,error:null,status:200}}catch(e){return{data:null,error:{code:e.code,message:e.message},status:e.code==='42501'?403:400}}finally{await c.end()}};
 const state=async()=>Object.fromEntries(await Promise.all(['outreach_event_registrations','outreach_event_attendees','outreach_waiver_signatures','outreach_waiver_corrections','outreach_campaign_audit','outreach_campaign_events'].map(async table=>[table,(await q('select to_jsonb(t) v from '+table+' t order by to_jsonb(t)::text')).rows])));

 for(const [engine,type]of Object.entries({chromium,webkit})){
  if(process.env.TEST_BROWSER&&process.env.TEST_BROWSER!==engine)continue;
  const browser=await type.launch({headless:true});try{
   const context=await browser.newContext({viewport:{width:1280,height:900}}),page=await context.newPage(),calls=[],errors=[];page.setDefaultTimeout(10000);page.on('pageerror',e=>errors.push(e.message));let responseHold=null,release=null,submitted=false;
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url()),reply=(json,status=200)=>route.fulfill({json,status,headers:{'access-control-allow-origin':'*'}});
    if(req.url()==='https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.118.0')return route.fulfill({body:sdk,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}});
    if(u.origin===backend){
     const token=req.headers().authorization?.split(' ')[1];let who;try{who=JSON.parse(Buffer.from(token.split('.')[1],'base64url')).sub}catch{}
     if(u.pathname==='/auth/v1/user')return [worker,other].includes(who)?reply(session(who).user):reply({message:'Fictional denied'},401);
     if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
     const name=u.pathname.split('/').at(-1),p=req.postDataJSON();
     if(name==='staff_workspace_context')return reply({organizations:[],grants:[]});
     if(name==='communications_workspace')return reply({external_delivery_enabled:false,organizations:[],campaigns:[]});
     if(name==='forms_workspace')return reply({capabilities:{profile:'private_draft_v1'},organizations:[]});
     assert.equal(name,'outreach_registration_workspace','No inherited People/decisions/finance/learning RPCs');calls.push({...p,actor:who});
     const r=await execute(who,p.p_action,p.p_payload,p.p_campaign);
     if(responseHold===p.p_action){responseHold=null;submitted=true;await new Promise(resolve=>release=resolve)}
     return reply(r.error||r.data,r.status);
    }
    assert.equal(u.origin,origin);assert.equal(req.method(),'GET');const path=u.pathname.slice(1);
    if(['seed','discipleship-login.html'].includes(path))return route.fulfill({contentType:'text/html',body:'<!doctype html><h1>Fictional login</h1>'});
    if(path==='assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-no-authority'})});
    assert(publicFiles.has(path));return route.fulfill({body:process.env.REVIEW_BASE&&['assets/js/staff-workspace.js','assets/js/outreach-registration-staff.js'].includes(path)?execFileSync('git',['show',process.env.REVIEW_BASE+':'+path],{cwd:root}):readFileSync(new URL(path,root)),contentType:path.endsWith('.html')?'text/html':path.endsWith('.css')?'text/css':path.endsWith('.js')?'text/javascript':'image/png'});
   });
   await page.goto(origin+'/seed');await page.evaluate(({key,value})=>localStorage.setItem(key,JSON.stringify(value)),{key,value:session(worker)});

   const mutations=()=>calls.filter(p=>p.p_action==='walkup');
   const prepare=async()=>{
    await page.goto(origin+'/seed');await page.evaluate(({key,value})=>{localStorage.setItem(key,JSON.stringify(value));sessionStorage.clear()},{key,value:session(worker)});
    await page.goto(origin+'/staff-outreach-registration.html?campaign='+A);await page.getByRole('button',{name:'Add walk-up',exact:true}).click();
    const form=page.locator('form').filter({has:page.getByRole('button',{name:'Submit household registration',exact:true})});
    for(const[name,value]of [['Primary adult first name','Morgan'],['Primary adult last name','Fixture'],['Email','fixture@example.test'],['Mobile phone','+15555550100']])await form.getByLabel(name,{exact:true}).fill(value);
    const adult=form.locator('.registration-member').first();for(const[name,value]of [['Attendee first name','Morgan'],['Attendee last name','Fixture'],['Age','38']])await adult.getByLabel(name,{exact:true}).fill(value);
    await form.getByRole('button',{name:'Add attendee',exact:true}).click();const child=form.locator('.registration-member').last();for(const[name,value]of [['Attendee first name','Alex'],['Attendee last name','Fixture'],['Age','9'],['Guardian relationship (required for minors)','Parent']])await child.getByLabel(name,{exact:true}).fill(value);await child.getByLabel(/^Relationship to primary/).selectOption('child');
    await form.getByLabel('Typed legal name',{exact:true}).fill('Morgan Fixture');await form.getByLabel(/^Signer relationship/).selectOption('parent');for(const name of ['Morgan Fixture','Alex Fixture','I have read and acknowledge this waiver.','I am an adult with authority to sign for each selected attendee.','I give permission under the media release above.'])await form.getByLabel(name,{exact:true}).check();await form.getByLabel('Media release initials',{exact:true}).fill('MF');
    await form.evaluate(f=>{window.control=f.querySelector('button[type=submit]');const fn=f.onsubmit;window.invoke=()=>fn({preventDefault(){}})});return form;
   };
   for(const phase of ['staff','sdk']){
    await prepare();const before=await state(),n=mutations().length;
    await page.evaluate(phase=>{const api=phase==='staff'?ChampionLifeAuth:ChampionLifeAuth.client.auth,get=api.getSession.bind(api);let once=false;const hold=()=>api.getSession=()=>!once?(once=true,new Promise(resolve=>window.releaseSession=async()=>resolve(await get()))):get();if(phase==='staff')hold();else{const outer=ChampionLifeAuth.getSession;ChampionLifeAuth.getSession=async()=>{const s=await outer();hold();ChampionLifeAuth.getSession=outer;return s}}window.pending=invoke()},phase);await page.waitForFunction(()=>typeof releaseSession==='function');
    await page.evaluate(async()=>{const f=control.closest('form'),p=f.parentNode;f.remove();p.append(f);await releaseSession();await pending;await invoke()});const after=await state(),newHttp=mutations().length-n;reproductions.push({engine,phase,newHttp,stateChanged:JSON.stringify(after)!==JSON.stringify(before)});console.log(JSON.stringify(reproductions.at(-1)));
    if(!process.env.REPRO){ok(newHttp===0,engine+' '+phase+' zero NEW walkup HTTP after form retirement');assert.deepEqual(after,before);ok(true,engine+' '+phase+' all canonical records and audit unchanged')}
   }
   // Real SQL commit with delayed response: a submitted operation is not cancelled or duplicated.
   await prepare();const before=await state(),n=mutations().length;responseHold='walkup';submitted=false;await page.evaluate(()=>{window.pending=invoke()});for(let i=0;!submitted&&i<200;i++)await page.waitForTimeout(10);assert(submitted);const payload=mutations().at(-1).p_payload;
   await page.evaluate(async()=>{const p=control.parentNode;control.remove();p.append(control);await invoke()});ok(mutations().length===n+1,engine+' pending submitted request not duplicated');release();await page.evaluate(()=>pending);await page.evaluate(()=>invoke());ok(mutations().length===n+1,engine+' retired handler cannot send again after committed response');
   const committed=await state();ok(committed.outreach_event_registrations.length===before.outreach_event_registrations.length+1,engine+' exactly one household inserted');ok(committed.outreach_event_attendees.length===before.outreach_event_attendees.length+2,engine+' exactly adult and minor inserted');ok(committed.outreach_waiver_signatures.length===before.outreach_waiver_signatures.length+1,engine+' one immutable household signature');
   const registration=committed.outreach_event_registrations.find(x=>x.v.request_key===payload.request_key).v;
   assert.equal(registration.source,'walkup');assert.equal(registration.organization_id,org);assert.deepEqual(registration.consents,{ministry_followup:false,communications:false,marketing:false,media:true});ok(true,engine+' source/org and separate consent recorded without marketing permission');
   const signed=committed.outreach_waiver_signatures.find(x=>x.v.registration_id===registration.id).v;
   assert.equal(signed.recorded_by,worker);assert.equal(signed.text_snapshot,'SYNTHETIC TEST WAIVER. Not approved for real events.');assert.equal(signed.media_text_snapshot,'SYNTHETIC MEDIA RELEASE. Fictional only.');assert.equal(signed.media_consent,true);assert.equal(signed.media_initials,'MF');assert.equal(signed.coverage_snapshot.length,2);ok(true,engine+' exact legal/media snapshots, guardian coverage and actor audit');
   const repeats=await Promise.all([execute(worker,'walkup',payload),execute(worker,'walkup',payload)]);assert(repeats.every(r=>r.status===200&&r.data.reference===registration.reference));assert.deepEqual(await state(),committed);ok(true,engine+' simultaneous exact request retries return canonical reference without duplicate records or audit');
   assert.equal((await execute(worker,'walkup',{...payload,first_name:'Changed'})).status,400);assert.deepEqual(await state(),committed);ok(true,engine+' same key changed payload rejected atomically');
   const fresh=()=>{const p=structuredClone(payload);p.request_key=uuid();p.waiver.request_key=uuid();const keys=new Map(p.attendees.map(a=>[a.client_key,uuid()]));p.attendees.forEach(a=>a.client_key=keys.get(a.client_key));p.waiver.covered_keys=p.waiver.covered_keys.map(k=>keys.get(k));return p};
   for(const [label,change]of [['missing guardian',p=>p.attendees[1].guardian_relationship=''],['unqualified signer',p=>p.waiver.signer_relationship='self'],['missing coverage',p=>p.waiver.covered_keys.pop()],['missing acknowledgment',p=>p.waiver.acknowledged=false],['missing authority',p=>p.waiver.authority_acknowledged=false],['missing media initials',p=>p.waiver.media_initials=''],['wrong waiver version',p=>p.waiver.version_id=uuid()]]){const bad=fresh();change(bad);assert.equal((await execute(worker,'walkup',bad)).status,400,label);assert.deepEqual(await state(),committed);ok(true,engine+' '+label+' rejects entire transaction')}
   for(const[who,campaign,label]of[[other,A,'other account'],[worker,B,'wrong campaign']]){assert.equal((await execute(who,'walkup',fresh(),campaign)).status,403);assert.deepEqual(await state(),committed);ok(true,engine+' '+label+' denied without new household')}
   await q("update outreach_campaign_assignments set effective_at=now()-interval '2 days',expires_at=now()-interval '1 day' where campaign_id=$1 and user_id=$2",[A,worker]);assert.equal((await execute(worker,'walkup',fresh())).status,403);assert.deepEqual(await state(),committed);ok(true,engine+' expired assignment denied');await q('update outreach_campaign_assignments set expires_at=null where campaign_id=$1 and user_id=$2',[A,worker]);
   await prepare();const nDenied=mutations().length;await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);await page.evaluate(()=>invoke());await page.getByRole('link',{name:'Verify access again',exact:true}).waitFor();ok(mutations().length===nDenied+1,engine+' fresh SQL denies revoked registration.manage after admitted request');assert.deepEqual(await state(),committed);ok(true,engine+' revoked request cannot change canonical records');await q("update outreach_campaign_assignments set capabilities=array['view','registration.view','registration.manage','checkin.manage'] where campaign_id=$1 and user_id=$2",[A,worker]);
   // Normal authorized UI completes registration -> roster -> check-in -> partial/final reversal.
   await prepare();const baseline=(await execute(worker,'list')).data.summary;await page.evaluate(()=>invoke());await page.getByRole('heading',{name:'Attendees & check-in',exact:true}).waitFor();const normalPayload=mutations().at(-1).p_payload,normal=(await q('select id from outreach_event_registrations where request_key=$1',[normalPayload.request_key])).rows[0];
   const detail=async()=>(await execute(worker,'detail',{registration_id:normal.id})).data;
   let d=await detail();ok(d.attendees.length===2&&d.attendees.every(a=>a.waiver_covered),engine+' UI-created household roster has adult/minor legal coverage');assert.equal(d.status,'submitted');
   const historyBefore=await state();
   for(const[name,checked]of[['Morgan Fixture',1],['Alex Fixture',2]]){const card=page.locator('.registration-member').filter({has:page.getByRole('heading',{name,exact:true})});await card.getByRole('button',{name:'Check in attendee',exact:true}).click();await card.getByRole('button',{name:'Reverse check-in',exact:true}).waitFor();d=await detail();ok(d.status==='checked_in'&&d.attendees.filter(a=>a.checked_in_at).length===checked,engine+' attendance '+checked+' reflected in canonical household');}
   for(const[name,checked,status]of[['Alex Fixture',1,'checked_in'],['Morgan Fixture',0,'confirmed']]){const card=page.locator('.registration-member').filter({has:page.getByRole('heading',{name,exact:true})});await card.getByLabel('Reason for check-in correction',{exact:true}).fill('Fictional arrival correction');await card.getByRole('button',{name:'Reverse check-in',exact:true}).click();await card.getByRole('button',{name:'Check in attendee',exact:true}).waitFor();d=await detail();ok(d.status===status&&d.attendees.filter(a=>a.checked_in_at).length===checked,engine+' '+(checked?'partial':'final')+' reversal status accurate');}
   const historyAfter=await state();assert.deepEqual(historyAfter.outreach_waiver_signatures,historyBefore.outreach_waiver_signatures);assert.deepEqual(historyAfter.outreach_waiver_corrections,historyBefore.outreach_waiver_corrections);ok(true,engine+' arrival/reversals preserve immutable legal history');for(const old of historyBefore.outreach_campaign_audit)assert(historyAfter.outreach_campaign_audit.some(x=>JSON.stringify(x)===JSON.stringify(old)));ok(true,engine+' prior campaign audit entries preserved');ok(historyAfter.outreach_campaign_audit.length===historyBefore.outreach_campaign_audit.length+4,engine+' exactly four canonical attendance audit events');
   const totals=(await execute(worker,'list')).data.summary;for(const[k,delta]of[['households',1],['attendees',2],['adults',1],['minors',1],['checked_in',0]])assert.equal(totals[k],baseline[k]+delta,k);ok(true,engine+' household/adult/minor totals and final attendance accurate');
   await page.getByRole('button',{name:'Registrations',exact:true}).click();await page.getByRole('heading',{name:'Campaign totals',exact:true}).waitFor();for(const k of ['households','attendees','adults','minors','checked_in'])assert.equal(await page.locator('[data-metric='+k+'] strong').textContent(),String(totals[k]));ok(true,engine+' live staff roster displays authoritative totals');
   assert.deepEqual(errors,[]);ok(true,engine+' no browser errors');await context.close();
  }finally{await browser.close()}
 }
 assert(reproductions.every(r=>r.newHttp===0&&!r.stateChanged),'Walkup denies new HTTP and database mutation after retirement');
 console.log(JSON.stringify({status:'PASS',checks,actualStaffHost:true,nativePostgres:true,fictionalAuth:true,hosted:false}));
}finally{await db.close()}

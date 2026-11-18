import assert from'node:assert/strict';import{randomUUID as uuid}from'node:crypto';import{decisionFixture,read,campaign}from'./minden-decision-v2.fixture.mjs';
const f=await decisionFixture(process.env.TEST_NATIVE_PG==='1'),{db,q,as,ids}=f;let n=0;const ok=(v,m)=>{assert.ok(v,m);console.log('PASS '+(++n)+' '+m)},reject=async(fn,m,code)=>{await assert.rejects(fn,code?e=>e.code===code:undefined);ok(true,m)};
const secret='a'.repeat(64),network='b'.repeat(64),token=()=>uuid().replaceAll('-','').repeat(2),policy=uuid();
const payload=()=>({first_name:'SYNTHETIC',last_name:'Intake',email:'reader@example.invalid',phone:'',decision:'salvation',prayer_request:'PRIVATE SYNTHETIC',policy_id:policy,locale:'en',subject_kind:'adult_self',guardian_name:'',processing_consent:true,resource_consent:true,followup_consent:true,adult_attested:true,guardian_attested:false});
const admin=async(s,p=[])=>{await db.exec('reset role');return q(s,p)};
const send=async(p=payload(),id=uuid(),tok=token(),action='submit',sec=secret,client=db)=>(await client.query('select public.minden_decision_gateway($1,$2,$3,$4,$5,$6) v',[action,id,sec,p,network,tok])).rows[0].v;
try{
 await db.exec(read('supabase/release/minden-decision-intake-v2.sql'));
 await db.exec('create schema app_private;grant usage on schema app_private to authenticated');await db.exec(read('supabase/release/minden-king-kind-entitlement-v2.sql'));
 await db.exec(read('supabase/release/minden-family-intake-disabled-v2.sql'));
 await as('reader','anon');ok((await q('select public.minden_decision_config() v')).rows[0].v.enabled===false,'policy/runtime/mapping absent defaults OFF for anonymous config');await db.exec('reset role');
 for(const role of['anon','authenticated']){await as('reader',role);await reject(()=>send(),'raw gateway not callable as '+role,'42501');await reject(()=>q("insert into outreach_registrations(source,first_name,last_name,email,phone,decision)values('minden_la_outreach','SYNTHETIC','Denied','x@example.invalid','','salvation')"),'direct Minden REST-equivalent insert denied '+role,'42501')}
 await admin("insert into outreach_decision_campaign_sources values($1,'minden_la_outreach',true,1)",[campaign]);
 const copy=Object.fromEntries(['en','es'].map(l=>[l,Object.fromEntries(['processing','resource','followup','adult','guardian'].map(k=>[k,'SYNTHETIC TEST COPY ONLY '+l+' '+k]))]));
 await admin("insert into private.minden_decision_policies(id,campaign_id,version,copy,approved_by,approval_reference,approved_at,effective_at,expires_at)values($1,$2,'SYNTHETIC-v1',$3,$4,'SYNTHETIC LOCAL TEST APPROVAL',clock_timestamp()-interval'2 hours',clock_timestamp()-interval'1 hour',clock_timestamp()+interval'1 hour')",[policy,campaign,copy,ids.owner]);
 await admin('insert into private.minden_decision_runtime values($1,true,true,$2,1)',[campaign,policy]);
 ok((await q('select public.minden_decision_config() v')).rows[0].v.copy.en.processing.includes('SYNTHETIC'),'only explicit current approved fixture supplies consent copy');
 await reject(()=>q("update private.minden_decision_policies set version='tampered'"),'policy snapshot immutable','42501');
 const id=uuid(),p=payload();await db.exec('set role service_role');let r=await send(p,id);ok(r.state==='ACCEPTED'&&r.receipt===id,'protected intake commits receipt');
 ok((await send(p,id)).state==='ACCEPTED','same operation replays without duplicate');ok((await send({...p,decision:'learn_more'},id)).state==='CONFLICT','same key changed decision refused');ok((await send(p,id,token(),'status','c'.repeat(64))).state==='UNKNOWN','wrong receipt secret does not enumerate');
 r=await send({},id,token(),'status');ok(Object.keys(r).sort().join()==='accepted_at,receipt,state'&&!JSON.stringify(r).includes('@'),'status is redacted accepted truth');
 await admin("update private.minden_decision_runtime set enabled=false");await db.exec('set role service_role');ok((await send(p,id)).state==='ACCEPTED','stopping intake retains durable accepted truth');await reject(()=>send(),'stopped intake refuses new operation','42501');await admin('update private.minden_decision_runtime set enabled=true');
 const reused=token();await send(payload(),uuid(),reused);await reject(()=>send(payload(),uuid(),reused),'one proof cannot create two operations','23505');
 await admin('select 1');ok((await q('select count(*)::int n from private.minden_decision_receipts')).rows[0].n===2,'failed proof transaction leaves no registration/followup/receipt');
 ok((await q("select count(*)::int n from outreach_decision_audit where actor_kind='service_intake' and actor_user_id is null")).rows[0].n===2,'genuine service audit recorded atomically');
 ok((await q('select count(*)::int n from outreach_event_registrations')).rows[0].n===0&&(await q('select count(*)::int n from outreach_volunteer_applications')).rows[0].n===0,'decision does not increment attendee or volunteer totals');
 ok((await q('select count(*)::int n from private.outreach_team_notice_intents')).rows[0].n===0,'no status email intent created');
 for(const p2 of[{...payload(),policy_id:uuid()},{...payload(),subject_kind:'guardian',guardian_name:'Synthetic guardian',guardian_attested:true},{...payload(),processing_consent:false},{...payload(),email:'invalid'},{...payload(),first_name:''},{...payload(),unknown:'field'}])await reject(()=>send(p2),'invalid/stale consent or unapproved guardian cannot persist');
 await as('reader');ok((await q('select app_private.can_read_king_kind() v')).rows[0].v,'verified current recipient receives protected book entitlement');
 await as('other');ok(!(await q('select app_private.can_read_king_kind() v')).rows[0].v,'different verified email has no book entitlement');await reject(()=>q('select public.minden_decision_revoke($1,true,true)',[id]),'other recipient cannot revoke','42501');
 await as('reader');await q('select public.minden_decision_revoke($1,true,true)',[id]);
 await admin('select 1');const registration=(await q('select registration_id from private.minden_decision_receipts where request_id=$1',[id])).rows[0].registration_id;ok(!(await q('select private.minden_decision_followup_consent($1) v',[registration])).rows[0].v,'current withdrawn followup consent blocks updates');
 // Revoke the second independent receipt as well; one valid consent would legitimately suffice.
 const second=(await q('select request_id from private.minden_decision_receipts where request_id<>$1',[id])).rows[0].request_id;await as('reader');await q('select public.minden_decision_revoke($1,true,true)',[second]);ok(!(await q('select app_private.can_read_king_kind() v')).rows[0].v,'book entitlement withdraws after all own resource receipts revoked');
 // Legacy cities retain the prior exact email+consent behavior; raw Minden cannot confer rights.
 await admin("insert into outreach_registrations(source,first_name,last_name,email,phone,decision,consent)values('bessemer_al_2026','SYNTHETIC','Legacy','other@example.invalid','','salvation',true)");await as('other');ok((await q('select app_private.can_read_king_kind() v')).rows[0].v,'legacy Bessemer entitlement preserved');
 await admin("delete from auth.sessions where user_id=$1",[ids.reader]);await as('reader');await reject(()=>q('select public.minden_decision_revoke($1,true,true)',[id]),'revoked session rejects stale JWT','42501');ok(!(await q('select app_private.can_read_king_kind() v')).rows[0].v,'revoked Minden session cannot obtain new signed URL');
 console.log(n+' protected intake/reader checks passed ('+(process.env.TEST_NATIVE_PG==='1'?'native':'PGlite')+'); all people, sessions and policy approvals synthetic');
}finally{await db.close()}

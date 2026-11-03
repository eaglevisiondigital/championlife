// Focused gaps beyond the accepted restoration suite. Disposable Unix-socket PG only.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash,randomUUID as uuid} from 'node:crypto';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';

const read=path=>readFileSync(new URL(path,import.meta.url),'utf8');
const migration=read('../../supabase/migrations/20261103193001_church_operations_restore_capacity.sql');
const signature='private.outreach_registration_workspace(text,uuid,jsonb)';
const anchor="   perform private.outreach_registration_answers(c,coalesce(p->'answers',m.answers));";
// Deliberately independent expected body delta, not extracted from the migration under test.
const insertion=`   -- The caller already holds the same campaign lock as attendee_add.
   if not m.active and coalesce((p->>'active')::boolean,false) and
      (select count(*) from public.outreach_event_attendees where registration_id=r.id and active)>=30 then
    raise exception 'Household attendee limit reached';
   end if;
`;
let checks=0;
const equal=(actual,expected,label)=>{assert.deepEqual(actual,expected,label);checks++;};
equal(createHash('sha256').update(migration).digest('hex'),'ece906c504b0eb75d99d2fc706aead20be48b6162ae90f9af596ad85c3fdbf68','accepted migration bytes unchanged');
const db=await localPostgres(),q=(...args)=>db.query(...args);
const catalog=async()=>(await q("select p.oid, n.nspname, p.proname, p.proargtypes::text, to_jsonb(p) as metadata from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') order by p.oid")).rows;
const routine=async()=>(await q('select prosrc, md5(prosrc) as md5, pg_get_functiondef(oid) as definition from pg_proc where oid=to_regprocedure($1)',[signature])).rows[0];
const data=async()=>{
 const result={};
 for(const table of ['outreach_event_attendees','outreach_event_registrations','outreach_campaign_audit','outreach_campaign_events','outreach_waiver_signatures'])
  result[table]=(await q(`select to_jsonb(t) as row from public.${table} t order by to_jsonb(t)::text`)).rows;
 return result;
};
async function safeStop(label,code='P0001'){
 const before=await catalog(),rows=await data();
 await assert.rejects(()=>db.exec(migration),e=>e.code===code&&(code!=='P0001'||e.message==='Incompatible registration workspace; review restoration capacity migration'));checks++;
 // Failed DO leaves BEGIN aborted; every caller must stop and explicitly ROLLBACK.
 await assert.rejects(()=>q('select 1'),e=>e.code==='25P02');checks++;
 await db.exec('rollback');
 equal(await catalog(),before,label+' preserves every public/private routine and metadata');
 equal(await data(),rows,label+' preserves attendee, registration, signature, audit and event contents');
}
try{
 await db.exec(read('../backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('../../supabase/bootstrap/automatic-rls.sql'));
 for(const file of migrationOrder)await db.exec(read('../../supabase/migrations/'+file));
 const baseline=await routine(),before=await catalog();
 equal(baseline.md5,'ad750e647756c6e45590932313cdd052','exact source body prerequisite');
 equal(baseline.prosrc.split(anchor).length,2,'independent expected insertion point is unique');
 const expected=baseline.prosrc.replace(anchor,insertion+anchor);
 await db.exec(migration);
 equal((await routine()).prosrc,expected,'only reviewed capacity insertion changes body');
 equal(await catalog(),before.map(row=>row.metadata.prosrc===baseline.prosrc?{...row,metadata:{...row.metadata,prosrc:expected}}:row),'owner ACL security-definer search-path OIDs and all other routines preserved');
 console.log('installed body MD5 '+(await routine()).md5);

 // Minimal synthetic household: two distinct removed attendees compete for place 30.
 const campaign=uuid(),registration=uuid(),worker=uuid();
 const org=(await q("select organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0].organization_id;
 await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[worker,worker+'@example.test']);
 await q("insert into outreach_campaigns(id,organization_id,code,name,city,country,timezone,status) values($1,$2,'restore_installability','Synthetic restoration','Test','US','UTC','approved')",[campaign,org]);
 await q("insert into outreach_campaign_assignments(campaign_id,user_id,role_key,capabilities,active,reason) values($1,$2,'local_leader',array['view','registration.view','registration.manage'],true,'Synthetic fixture')",[campaign,worker]);
 await q("insert into outreach_event_registrations(id,campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,source) values($1,$2,$3,$4,'{}','Synthetic','Fixture','fixture@example.test','+15555550100','walkup')",[registration,campaign,org,uuid()]);
 await q("insert into outreach_event_attendees(campaign_id,registration_id,client_key,first_name,last_name,age,relationship,active) select $1,$2,gen_random_uuid(),'Synthetic','Member '||n,30,'other',n<=29 from generate_series(1,31)n",[campaign,registration]);
 await safeStop('already installed rerun');

 // Exact unchanged migration must reject each unrelated body/anchor/lock drift.
 for(const [label,definition] of [
  ['unrelated body drift',baseline.definition.replace('declare x','-- synthetic drift\n declare x')],
  ['missing insertion anchor',baseline.definition.replace(anchor,'   perform 1;')],
  ['duplicate insertion anchor',baseline.definition.replace(anchor,anchor+'\n'+anchor)],
  ['missing campaign lock',baseline.definition.replace('for update;',';')],
  ['missing post-lock authority',baseline.definition.replace("for update;\n  if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;","for update;")]
 ]){
  await db.exec(definition);await safeStop(label);
 }
 // Rename only in this disposable database to prove missing-signature STOP without DROP CASCADE.
 await db.exec(baseline.definition);
 await db.exec('alter function '+signature+' rename to synthetic_workspace_missing');
 await safeStop('missing function','42883');
 await db.exec('alter function private.synthetic_workspace_missing(text,uuid,jsonb) rename to outreach_registration_workspace');
 await db.exec(migration);
 equal((await routine()).prosrc,expected,'fresh baseline installs after independent negative fixtures');

 const removed=(await q('select * from outreach_event_attendees where registration_id=$1 and not active order by id',[registration])).rows;
 const beforeRace=await data(), clients=await Promise.all([db.connect(),db.connect()]);
 for(const c of clients){await c.query("select set_config('request.jwt.claim.sub',$1,false)",[worker]);await c.query('set role authenticated');}
 await db.exec('begin');await q('select id from outreach_campaigns where id=$1 for update',[campaign]);
 const pending=clients.map((c,i)=>c.query("select public.outreach_registration_workspace('attendee_update',$1,$2)",[campaign,{registration_id:registration,attendee_id:removed[i].id,revision:removed[i].revision,active:true}]).then(()=>({ok:true}),e=>({code:e.code,message:e.message})));
 let waiting=false;
 for(let i=0;i<300;i++){
  const count=(await q("select count(*) n from pg_stat_activity where pid=any($1) and wait_event_type='Lock'",[clients.map(c=>c.processID)])).rows[0].n;
  if(count===2){waiting=true;break;}await new Promise(resolve=>setTimeout(resolve,10));
 }
 equal(waiting,true,'two independent distinct-attendee restorations observed blocked on campaign');
 await db.exec('commit');const results=await Promise.all(pending);
 equal(results.filter(r=>r.ok).length,1,'one distinct restore takes last place');
 equal(results.filter(r=>r.code==='P0001'&&r.message==='Household attendee limit reached').length,1,'loser denied by capacity, not stale revision');
 equal((await q('select count(*) n from outreach_event_attendees where registration_id=$1 and active',[registration])).rows[0].n,30,'30 active upper bound');
 const loser=removed[results.findIndex(r=>!r.ok)],winner=removed[results.findIndex(r=>r.ok)];
 equal((await q('select * from outreach_event_attendees where id=$1',[loser.id])).rows[0],loser,'loser preserves complete row');
 equal((await q('select revision from outreach_event_attendees where id=$1',[winner.id])).rows[0].revision,winner.revision+1,'winner revision advances once');
 const afterRace=await data();
 equal(afterRace.outreach_event_registrations,beforeRace.outreach_event_registrations,'neither restore rewrites household row');
 equal(afterRace.outreach_waiver_signatures,beforeRace.outreach_waiver_signatures,'race creates no signatures');
 equal(afterRace.outreach_campaign_audit.length-beforeRace.outreach_campaign_audit.length,2,'only winner attendee and household audits committed');
 equal(afterRace.outreach_campaign_events.length-beforeRace.outreach_campaign_events.length,1,'only winner household event committed');
 const audits=(await q("select kind,actor_user_id,subject_id from outreach_campaign_audit where campaign_id=$1 order by kind",[campaign])).rows;
 equal(audits,[{kind:'attendee.updated',actor_user_id:worker,subject_id:winner.id},{kind:'registration.updated',actor_user_id:worker,subject_id:registration}],'only successful actor-bound restoration audited');
 console.log(`${checks} focused restoration installability assertions PASS`);
}finally{await db.close();}

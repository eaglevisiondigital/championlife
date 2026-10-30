// Disposable PostgreSQL / PGlite acceptance of the separate general King Kind signup.
// Never connects to a hosted database. Real Storage object acceptance is a separate gate.
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomUUID as uuid } from 'node:crypto';
import { PGlite } from '@electric-sql/pglite';
import { localPostgres } from './local-postgres.mjs';
import { migrationOrder } from './migration-order.mjs';
const read=path=>readFileSync(new URL('../../'+path,import.meta.url),'utf8');
const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite();
let checked=0;
const q=(s,a=[])=>db.query(s,a);
const pass=(v,description)=>{assert.ok(v,description);checked++;};
const denied=async(task,label)=>{await assert.rejects(task,label);checked++;};
const users=[uuid(),uuid(),uuid(),uuid()];
const role=async(i)=>{await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[i===null?'':users[i]]);await db.exec('set role '+(i===null?'anon':'authenticated'));};
const eligibility=async()=>Boolean((await q('select app_private.can_read_king_kind() eligible')).rows[0].eligible);
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const name of migrationOrder)await db.exec(read('supabase/migrations/'+name));
 // Production already has this private exact-object eligibility function and schema.
 // Standalone tests model the previously deployed release before applying forward migration.
 await db.exec("create schema app_private; revoke all on schema app_private from public; grant usage on schema app_private to authenticated;");
 await db.exec(`create function app_private.can_read_king_kind() returns boolean language sql stable security definer set search_path='' as $$
  select exists(select 1 from auth.users u join public.outreach_registrations r on lower(btrim(r.email))=lower(btrim(u.email))
  where u.id=auth.uid() and u.email_confirmed_at is not null and r.consent and r.source in ('bessemer_al_2026','huntsville_al_2026'))
 $$; revoke all on function app_private.can_read_king_kind() from public,anon; grant execute on function app_private.can_read_king_kind() to authenticated;`);
 await db.exec(read('supabase/migrations/20261029235955_general_king_kind_resource_registration.sql'));
 pass(true,'migration applies to disposable baseline');
 for(let i=0;i<users.length;i++)await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[users[i],`prayer-${i}@example.test`,i===1?null:new Date('2026-01-01')]);
 // anon and verified user without registration must not read the book or raw registrant table.
 await role(null);
 await denied(()=>q("select * from public.general_king_kind_registrants"),'anonymous cannot read registrants');
 await denied(()=>q("select public.register_general_king_kind_resource('Anon','User')"),'anonymous cannot register');
 await role(0);
 pass(!(await eligibility()),'unregistered verified account lacks book eligibility');
 await denied(()=>q('select * from public.general_king_kind_registrants'),'authenticated cannot enumerate registrations');
 await denied(()=>q("insert into public.general_king_kind_registrants(user_id,first_name,last_name,verified_email)values($1,'Attacker','User','fake@example.test')",[users[2]]),'authenticated cannot write raw registration');
 await denied(()=>q("select public.register_general_king_kind_resource('','Name')"),'empty first name denied');
 await denied(()=>q("select public.register_general_king_kind_resource('First','')"),'empty last name denied');
 const registered=(await q("select public.register_general_king_kind_resource('First','Attendee') v")).rows[0].v;
 pass(registered?.registered===true,'verified user can register without outreach decision');
 pass(await eligibility(),'registered verified user gains book eligibility');
 pass((await q('select count(*)::int n from public.course_enrollments where user_id=$1',[users[0]])).rows[0].n===1,'verified resource registrant is enrolled atomically in course');
 await q("select public.register_general_king_kind_resource('Changed','Attendee')");
 pass(await eligibility(),'idempotent registration remains eligible');
 pass((await q('select count(*)::int n from public.course_enrollments where user_id=$1',[users[0]])).rows[0].n===1,'duplicate registration never creates duplicate course enrollment');
 await role(2);
 pass(!(await eligibility()),'another verified user cannot inherit eligibility');
 pass((await q('select count(*)::int n from public.course_enrollments where user_id=$1',[users[0]])).rows[0].n===0,'another learner cannot enumerate the enrollment');
 await role(1);
 await denied(()=>q("select public.register_general_king_kind_resource('Unverified','Person')"),'unverified email cannot register');
 pass(!(await eligibility()),'unverified email never gains book eligibility');
 pass((await q('select count(*)::int n from public.course_enrollments where user_id=$1',[users[1]])).rows[0].n===0,'unverified user never receives course enrollment');
 await role(0);
 // An email change never carries the original registry's entitlement into the new address.
 await db.exec('reset role');
 await q("update auth.users set email='renamed@example.test' where id=$1",[users[0]]);
 await role(0);
 pass(!(await eligibility()),'changed email invalidates prior resource eligibility');
 await role(null);
 await denied(()=>q('select app_private.can_read_king_kind()'),'anonymous cannot execute eligibility helper');
 // Verify historical outreach eligibility remains independent of new general registration.
 await db.exec('reset role');
 await q("insert into public.outreach_registrations (source,first_name,last_name,email,phone,decision,consent) values('huntsville_al_2026','Historical','Registrant','prayer-2@example.test','+15550000000','learn_more',true)");
 await role(2);
 pass(await eligibility(),'previous eligible outreach registrant remains eligible');
 await role(3);
 pass(!(await eligibility()),'unrelated verified account denied');
 await db.exec('reset role');
 await q('update auth.users set is_anonymous=true where id=$1',[users[3]]);
 await role(3);
 await denied(()=>q("select public.register_general_king_kind_resource('Anonymous','User')"),'anonymous Supabase identity cannot use verified resource RPC');
 console.log('General King Kind disposable DB RLS:',checked,'checks passed');
}finally{try{await db.exec('reset role')}catch{};await db.close();}

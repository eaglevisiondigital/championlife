// In-memory synthetic database only; no remote connection or credentials accepted.
import {PGlite} from '@electric-sql/pglite';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {migrationOrder} from './migration-order.mjs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const db=new PGlite();let checks=0;
const ok=(v,label)=>{assert.ok(v,label);checks++;console.log('PASS '+label);};
const candidate=read('supabase/release/dream-track-v1-forward-candidate.sql');
try{
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const file of migrationOrder)await db.exec(read('supabase/migrations/'+file));
 const originalHelper=(await db.query("select pg_get_functiondef('private.staff_assignment_active(uuid,uuid)'::regprocedure) as definition")).rows[0].definition;
 async function reject(label,arrange,restore,pattern){
  await db.exec(arrange);
  await assert.rejects(()=>db.exec(candidate),pattern);
  await db.exec('rollback');
  ok((await db.query("select count(*)::int as n from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='public' and c.relname='course_questions'")).rows[0].n===0,label+' stops before creating the question bank');
  await db.exec(restore);
 }
 await reject('existing course',"insert into public.courses(slug,title,total_lessons) values('dream-track','Synthetic conflicting course',7)","delete from public.courses where slug='dream-track'",/already present/);
 await reject('partial schema','create table public.course_settings(synthetic integer)','drop table public.course_settings',/partial schema/);
 await reject('additional permissive policy',"create policy synthetic_extra_access on public.lesson_progress for select to authenticated using(true)",'drop policy synthetic_extra_access on public.lesson_progress',/RLS baseline drift/);
 await reject('weakened existing policy','alter policy progress_insert_own on public.lesson_progress with check(true)','alter policy progress_insert_own on public.lesson_progress with check((select auth.uid())=user_id)',/RLS baseline drift/);
 await reject('changed staff helper',"create or replace function private.staff_assignment_active(p_org uuid,p_user uuid) returns boolean language sql stable security definer set search_path='' as $$select true$$",originalHelper,/helper drift/);
 await db.exec(candidate);
 ok((await db.query('select count(*)::int n from public.course_questions')).rows[0].n===140,'verified baseline installs the exact-size question bank');
 await assert.rejects(()=>db.exec(candidate),/already present/);await db.exec('rollback');
 ok((await db.query('select count(*)::int n from public.course_questions')).rows[0].n===140,'duplicate application stops without altering installed content');
 console.log(`${checks} DreamTrack recovery guard assertions passed`);
}finally{await db.close();}

// Fictional local/CI database only. No hosted connection or provider credential.
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
export const U='11111111-1111-4111-8111-111111111111',S='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',B='22222222-2222-4222-8222-222222222222',BS='bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
export const read=p=>readFileSync(new URL(p,import.meta.url),'utf8');
export async function claims(db,user=U,session=S){await db.query("select set_config('request.jwt.claim.sub',$1,false),set_config('request.jwt.claims',$2,false)",[user,JSON.stringify({session_id:session})]);}
export async function setupCompletion(db){
 await db.exec(read('../backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec("alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id) on delete cascade,not_after timestamptz);create function auth.jwt() returns jsonb language sql stable as $$select current_setting('request.jwt.claims',true)::jsonb$$;");
 await db.exec(read('../../supabase/bootstrap/automatic-rls.sql'));
 for(const f of ['20260923114743_create_course_progress_schema.sql','20260923114822_harden_course_security_and_indexes.sql','20260923115706_grant_authenticated_course_api_access.sql','20260923115732_restrict_authenticated_course_privileges.sql','20261101165620_prepare_owned_worksheet_transactions.sql','20261101231330_owned_progression_snapshot.sql','20261102014452_prepare_trusted_lesson_completion.sql'])await db.exec(read('../../supabase/migrations/'+f));
 await db.query("insert into auth.users(id,email,email_confirmed_at) values($1,'fictional-a@example.test',now()),($2,'fictional-b@example.test',now())",[U,B]);
 await db.query('insert into auth.sessions(id,user_id) values($1,$2),($3,$4)',[S,U,BS,B]);
 await db.query('insert into course_enrollments(user_id,course_id) values($1,1),($2,1)',[U,B]);
 await db.query("insert into lesson_answers(user_id,course_id,lesson_number,question_number,answer) select $1,1,1,q,'FICTIONAL PRIVATE ANSWER' from generate_series(1,20) q",[U]);
 await claims(db);
}
export async function fictionalProfile(db){
 return (await db.query(`insert into private.lesson_observer_profiles(lesson_number,provider,observer_key_id,public_key_sha256,source_review_sha256,source_kind,media_id,video_revision,policy_version,duration_ms,effective_at,expires_at)
 values(1,'FICTIONAL_OBSERVER','fictional_key',repeat('a',64),repeat('b',64),'independent_provider_observation','fictional_media','fictional_v1','fictional_policy',1000,now()-interval '2 hours',now()+interval '1 hour') returning *`)).rows[0];
}
export async function observation(db,p,overrides={}){
 const r={id:randomUUID(),profile_id:p.id,profile_revision:p.revision,provider_receipt_id:randomUUID(),envelope_sha256:randomUUID().replaceAll('-','').repeat(2),user_id:U,session_id:S,enrollment_id:1,lesson_number:1,media_id:p.media_id,video_revision:p.video_revision,policy_version:p.policy_version,start_ms:0,end_ms:950,elapsed_ms:950,eligible_playback:true,observed_at:new Date(Date.now()-3600000),valid_until:new Date(Date.now()+3600000),revoked:false,...overrides};
 const keys=Object.keys(r);await db.query(`insert into private.lesson_watch_observations(${keys.join(',')}) values(${keys.map((_,i)=>'$'+(i+1)).join(',')})`,Object.values(r));return r;
}
export async function args(db,p,ids){return [1,(await db.query('select private.owned_progression_snapshot(1) r')).rows[0].r.worksheetRevision,p.id,p.revision,ids];}
export async function complete(db,a){return(await db.query('select private.commit_trusted_lesson_completion($1,$2,$3,$4,$5::uuid[]) r',a)).rows[0].r;}
export async function counts(db){return(await db.query('select (select count(*)::int from lesson_progress) progress,(select count(*)::int from private.trusted_lesson_completion_audit) audit')).rows[0];}

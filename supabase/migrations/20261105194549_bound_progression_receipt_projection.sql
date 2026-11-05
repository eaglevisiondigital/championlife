-- SOURCE ONLY / UNINSTALLED. Execute the entire migration in one transaction.
-- All historical migrations, answer stores, RLS and grants stay unchanged.
-- Only the existing progression snapshot's answer-receipt projection changes.
do $$
declare item record; fn pg_proc%rowtype;
begin
 perform pg_advisory_xact_lock(261101,56001);
 for item in select * from (values
  ('private.owned_progression_snapshot(integer)','2eec002dfc990c07821688f6f5dc63aca43de933fb52658bc3fe288d9eab647f',true,array['search_path=""','lock_timeout=2s']),
  ('public.owned_progression_snapshot(integer)','dc776e2978f61f8deb40bd71be993c406481b6844ac94dc3d047f94be840ea9a',false,array['search_path=""']),
  ('private.owned_worksheet_transaction(integer,text,jsonb)','faee7bef0c8be32560f32e17461d4c327449fecd92351c0e2ad1b59d8eca2a04',true,array['search_path=""','lock_timeout=2s'])
 ) as expected(signature,source_hash,definer,settings) loop
  select * into fn from pg_proc where oid=to_regprocedure(item.signature);
  if not found or encode(sha256(convert_to(fn.prosrc,'UTF8')),'hex') is distinct from item.source_hash
   or fn.prosecdef is distinct from item.definer or fn.proconfig is distinct from item.settings
   or fn.prokind<>'f' or fn.prorettype<>'jsonb'::regtype or pg_get_userbyid(fn.proowner)<>'postgres'
   or (select lanname from pg_language where oid=fn.prolang) is distinct from
      (case when item.signature like 'public.%' then 'sql' else 'plpgsql' end)
   or (select count(*) from aclexplode(coalesce(fn.proacl,acldefault('f',fn.proowner))))<>2
   or exists(select 1 from aclexplode(coalesce(fn.proacl,acldefault('f',fn.proowner))) a
      where a.grantee not in ('postgres'::regrole,'authenticated'::regrole)
       or a.grantor<>'postgres'::regrole or a.privilege_type<>'EXECUTE' or a.is_grantable)
   or not has_function_privilege('authenticated',fn.oid,'EXECUTE') then
   raise exception 'Accepted progression receipt dependency drift: %',item.signature using errcode='55000';
  end if;
 end loop;
end $$;
create or replace function private.owned_progression_snapshot(p_lesson integer)
 returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare receipt jsonb; actor uuid; sid uuid; enrollment bigint; version uuid; deadline timestamptz;
begin
 receipt:=private.owned_worksheet_transaction(p_lesson,null,null);
 -- Receipt metadata is an explicit projection, never an evolving RPC envelope.
 -- Lessons 5–13 load/save legitimately return private answers to the worksheet;
 -- downstream progression evidence must not duplicate those answer bodies.
 receipt:=jsonb_build_object(
  'status',receipt->'status','course',receipt->'course','lesson',receipt->'lesson',
  'revision',receipt->'revision','savedNonblankAnswers',receipt->'savedNonblankAnswers',
  'requiredQuestions',receipt->'requiredQuestions',
  'allRequiredAnswersSaved',receipt->'allRequiredAnswersSaved',
  'canComplete',receipt->'canComplete','canCommit',receipt->'canCommit')
  ||case when p_lesson between 5 and 13 then
    jsonb_build_object('worksheet',receipt->'worksheet')
    else '{}'::jsonb end;
 actor:=auth.uid();sid:=(auth.jwt()->>'session_id')::uuid;
 select e.id,v.token into enrollment,version from public.course_enrollments e
 join public.courses c on c.id=e.course_id
 join private.worksheet_versions v on v.enrollment_id=e.id and v.lesson_number=p_lesson
 where e.user_id=actor and c.slug='getting-a-grip-on-the-basics';
 if enrollment is null or version::text is distinct from receipt->>'revision' then
  raise exception 'Worksheet evidence unavailable' using errcode='42501';
 end if;
 -- Time can advance while locks are held; never return an expired-session receipt.
 select not_after into deadline from auth.sessions where id=sid and user_id=actor;
 if not found or deadline<=clock_timestamp() then
  raise exception 'Learner unavailable' using errcode='42501';
 end if;
 return jsonb_build_object('source','owned_progression_snapshot_v1',
  'userId',actor::text,'sessionId',sid::text,'course','getting-a-grip-on-the-basics',
  'lesson',p_lesson,'enrollmentId',enrollment::text,'worksheetRevision',version::text,
  'answerReceipt',jsonb_build_object('source','owned_worksheet_transaction_v1',
   'userId',actor::text,'sessionId',sid::text,'enrollmentId',enrollment::text,'receipt',receipt),
  'playbackStatus','observer_unconfigured','canComplete',false,'canCommit',false);
end $$;

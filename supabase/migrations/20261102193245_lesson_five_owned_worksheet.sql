-- Source-only, uninstalled. Reuse existing private answer and version stores.
-- Ten response groups map the existing Lesson 5 workbook sections, not a
-- fabricated twenty-question syllabus. No trusted completion or watch credit.
-- Existing lesson5 answers have no accepted mapping: never silently adopt them.
do $$begin
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='private.owned_worksheet_transaction(integer,text,jsonb)'::regprocedure) is distinct from 'da64ee229f7a16dd5190cdbab728a8de2dd07614351b5d392cfc7cc107ad7d9e' then
  raise exception 'Accepted owned_worksheet_transaction source drift' using errcode='55000';
 end if;
 if (select encode(sha256(convert_to(prosrc,'UTF8')),'hex') from pg_proc where oid='private.worksheet_enrollment_versions()'::regprocedure) is distinct from 'f9895d7ab4d0cb2ff64d45736bfbabaa2ad4fbaf2bea656796a7a5ab4350d9d0' then
  raise exception 'Accepted worksheet_enrollment_versions source drift' using errcode='55000';
 end if;
 if (select pg_get_constraintdef(oid) from pg_constraint where conrelid='private.worksheet_versions'::regclass and conname='worksheet_versions_lesson_number_check' and convalidated) is distinct from 'CHECK (((lesson_number >= 1) AND (lesson_number <= 4)))' then
  raise exception 'Accepted worksheet version constraint drift' using errcode='55000';
 end if;
 if exists(select 1 from public.lesson_answers a join public.courses c on c.id=a.course_id
  where c.slug='getting-a-grip-on-the-basics' and a.lesson_number=5) then
  raise exception 'Existing lesson5 answers require independently reviewed provenance reconciliation' using errcode='55000';
 end if;
end $$;
alter table private.worksheet_versions drop constraint worksheet_versions_lesson_number_check;
alter table private.worksheet_versions add constraint worksheet_versions_lesson_number_check check(lesson_number between 1 and 5);
create or replace function private.worksheet_enrollment_versions() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into private.worksheet_versions(enrollment_id,lesson_number) select new.id,q from generate_series(1,5) q;
 return null;
end $$;
insert into private.worksheet_versions(enrollment_id,lesson_number) select id,5 from public.course_enrollments;
create or replace function private.owned_worksheet_transaction(p_lesson integer,p_expected_revision text,p_answers jsonb)
 returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
 actor uuid:=auth.uid(); sid uuid; deadline timestamptz; course bigint; enrollment bigint;
 version uuid; item jsonb; q integer; count_saved integer; required integer; result jsonb;
begin
 if actor is null then raise exception 'Learner unavailable' using errcode='42501';end if;
 if p_lesson is null or p_lesson not between 1 and 5 then raise exception 'Cloud worksheet unavailable' using errcode='22023';end if;
 required:=case when p_lesson=5 then 10 else 20 end;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then raise exception 'Learner unavailable' using errcode='42501';end;
 if sid is null then raise exception 'Learner unavailable' using errcode='42501';end if;
 -- Authoritative user/session rows precede the shared worksheet mutex.
 perform 1 from auth.users where id=actor and email_confirmed_at is not null and not coalesce(is_anonymous,false)
  and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) for share;
 if not found then raise exception 'Learner unavailable' using errcode='42501';end if;
 select not_after into deadline from auth.sessions where id=sid and user_id=actor for share;
 if not found or deadline<=clock_timestamp() then raise exception 'Learner unavailable' using errcode='42501';end if;
 perform pg_advisory_xact_lock(261101,56001);
 select id into course from public.courses where slug='getting-a-grip-on-the-basics' for share;
 select id into enrollment from public.course_enrollments where user_id=actor and course_id=course for share;
 if not found then raise exception 'Enrollment unavailable' using errcode='42501';end if;
 select token into version from private.worksheet_versions where enrollment_id=enrollment and lesson_number=p_lesson for update;
 if not found then raise exception 'Worksheet version unavailable' using errcode='42501';end if;
 if p_answers is not null then
  if p_expected_revision is null or p_expected_revision !~ '^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$' or p_expected_revision<>version::text then
   raise exception 'Worksheet changed; reload before saving' using errcode='40001';end if;
  if jsonb_typeof(p_answers)<>'array' then raise exception 'Answer list required' using errcode='22023';end if;
  if jsonb_array_length(p_answers) not between 1 and required then raise exception 'Answer list required' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_answers) loop
   if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
    or not(item?'question') or not(item?'answer') or jsonb_typeof(item->'question')<>'number'
    or (item->>'question') !~ '^([1-9]|1[0-9]|20)$' or jsonb_typeof(item->'answer')<>'string'
    or (item->>'question')::numeric>required or length(item->>'answer')>20000 then raise exception 'Invalid worksheet answer' using errcode='22023';end if;
  end loop;
  if (select count(distinct value->>'question') from jsonb_array_elements(p_answers))<>jsonb_array_length(p_answers) then
   raise exception 'Duplicate worksheet question' using errcode='22023';end if;
  if deadline<=clock_timestamp() then raise exception 'Learner session expired' using errcode='42501';end if;
  for item in select value from jsonb_array_elements(p_answers) order by (value->>'question')::integer loop
   q:=(item->>'question')::integer;
   insert into public.lesson_answers(user_id,course_id,lesson_number,question_number,answer,updated_at)
    values(actor,course,p_lesson,q,item->>'answer',clock_timestamp())
    on conflict(user_id,course_id,lesson_number,question_number) do update set answer=excluded.answer,updated_at=excluded.updated_at;
  end loop;
  select token into version from private.worksheet_versions where enrollment_id=enrollment and lesson_number=p_lesson;
 elsif p_expected_revision is not null then
  raise exception 'Read does not accept a revision' using errcode='22023';
 end if;
 select count(*) into count_saved from public.lesson_answers where user_id=actor and course_id=course
  and lesson_number=p_lesson and question_number between 1 and required and length(btrim(answer))>0;
 if deadline<=clock_timestamp() then raise exception 'Learner session expired' using errcode='42501';end if;
 result:=jsonb_build_object('status','available','course','getting-a-grip-on-the-basics','lesson',p_lesson,
  'revision',version::text,'savedNonblankAnswers',count_saved,'requiredQuestions',required,
  'allRequiredAnswersSaved',count_saved=required,'canComplete',false,'canCommit',false);
 if p_lesson=5 then
  result:=result||jsonb_build_object('worksheet','lesson-5-workbook-sections-v1','answers',
   coalesce((select jsonb_agg(jsonb_build_object('question',question_number,'answer',answer) order by question_number)
    from public.lesson_answers where user_id=actor and course_id=course and lesson_number=5 and question_number between 1 and 10),'[]'::jsonb));
 end if;
 return result;
end $$;

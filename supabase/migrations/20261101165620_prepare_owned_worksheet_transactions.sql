-- SOURCE CANDIDATE ONLY: not installed; leaves original answer store/RLS intact.
-- Revisions describe worksheet answers, never verified playback or completion.
-- Internal sequence values never leave private storage. Random UUID receipt
-- tokens prevent clients from inferring unrelated worksheet mutation counts.
create schema if not exists private;
create sequence private.worksheet_version_seq as bigint;
create table private.worksheet_versions (
 enrollment_id bigint not null references public.course_enrollments(id) on delete cascade,
 lesson_number integer not null check (lesson_number between 1 and 4),
 revision bigint not null default nextval('private.worksheet_version_seq') check (revision>0),
 token uuid not null default gen_random_uuid(),
 primary key(enrollment_id,lesson_number)
);
alter table private.worksheet_versions enable row level security;
revoke all on private.worksheet_versions,private.worksheet_version_seq from public,anon,authenticated,service_role;

-- Every legacy answer/enrollment statement participates before taking row locks.
-- Conservative global serialization avoids RPC/legacy row-lock inversion. This
-- is a bounded local preparation, not an unmeasured high-throughput design.
create function private.worksheet_statement_lock() returns trigger
 language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
begin
 perform pg_advisory_xact_lock(261101,56001);
 return null;
end $$;
create trigger worksheet_answer_lock before insert or update or delete or truncate on public.lesson_answers
 for each statement execute function private.worksheet_statement_lock();
create trigger worksheet_enrollment_lock before insert or update or delete or truncate on public.course_enrollments
 for each statement execute function private.worksheet_statement_lock();

create function private.worksheet_immutable_owner() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 if new.id is distinct from old.id or new.user_id is distinct from old.user_id or new.course_id is distinct from old.course_id then
  raise exception 'Worksheet ownership is immutable' using errcode='42501';
 end if;
 if tg_table_name='lesson_answers' then
  if new.lesson_number is distinct from old.lesson_number or new.question_number is distinct from old.question_number then
   raise exception 'Worksheet question identity is immutable' using errcode='42501';end if;
 end if;
 return new;
end $$;
create trigger worksheet_answer_owner before update on public.lesson_answers
 for each row execute function private.worksheet_immutable_owner();
create trigger worksheet_enrollment_owner before update on public.course_enrollments
 for each row execute function private.worksheet_immutable_owner();

create function private.worksheet_enrollment_versions() returns trigger
 language plpgsql security definer set search_path='' as $$
begin
 insert into private.worksheet_versions(enrollment_id,lesson_number)
 select new.id,q from generate_series(1,4) q;
 return null;
end $$;
create trigger worksheet_enrollment_versions after insert on public.course_enrollments
 for each row execute function private.worksheet_enrollment_versions();
insert into private.worksheet_versions(enrollment_id,lesson_number)
 select e.id,q from public.course_enrollments e cross join generate_series(1,4) q;

create function private.worksheet_answer_version() returns trigger
 language plpgsql security definer set search_path='' as $$
declare u uuid; c bigint; l integer;
begin
 if tg_op='TRUNCATE' then
  update private.worksheet_versions set revision=nextval('private.worksheet_version_seq'),token=gen_random_uuid();return null;
 end if;
 if tg_op='DELETE' then u:=old.user_id;c:=old.course_id;l:=old.lesson_number;
 else u:=new.user_id;c:=new.course_id;l:=new.lesson_number;end if;
 update private.worksheet_versions v set revision=nextval('private.worksheet_version_seq'),token=gen_random_uuid()
 from public.course_enrollments e where v.enrollment_id=e.id and e.user_id=u and e.course_id=c and v.lesson_number=l;
 -- Legacy owner writes without enrollment remain possible under existing RLS.
 -- They have no receipt; a later enrollment receives entirely fresh versions.
 return null;
end $$;
create trigger worksheet_answer_version after insert or update or delete on public.lesson_answers
 for each row execute function private.worksheet_answer_version();
create trigger worksheet_answer_truncate after truncate on public.lesson_answers
 for each statement execute function private.worksheet_answer_version();

create function private.owned_worksheet_transaction(p_lesson integer,p_expected_revision text,p_answers jsonb)
 returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare
 actor uuid:=auth.uid(); sid uuid; deadline timestamptz; course bigint; enrollment bigint;
 version uuid; item jsonb; q integer; count_saved integer;
begin
 if actor is null then raise exception 'Learner unavailable' using errcode='42501';end if;
 if p_lesson is null or p_lesson not between 1 and 4 then raise exception 'Cloud worksheet unavailable' using errcode='22023';end if;
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
  if jsonb_array_length(p_answers) not between 1 and 20 then raise exception 'Answer list required' using errcode='22023';end if;
  for item in select value from jsonb_array_elements(p_answers) loop
   if jsonb_typeof(item)<>'object' or (select count(*) from jsonb_object_keys(item))<>2
    or not(item?'question') or not(item?'answer') or jsonb_typeof(item->'question')<>'number'
    or (item->>'question') !~ '^([1-9]|1[0-9]|20)$' or jsonb_typeof(item->'answer')<>'string'
    or length(item->>'answer')>20000 then raise exception 'Invalid worksheet answer' using errcode='22023';end if;
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
  and lesson_number=p_lesson and question_number between 1 and 20 and length(btrim(answer))>0;
 if deadline<=clock_timestamp() then raise exception 'Learner session expired' using errcode='42501';end if;
 return jsonb_build_object('status','available','course','getting-a-grip-on-the-basics','lesson',p_lesson,
  'revision',version::text,'savedNonblankAnswers',count_saved,'requiredQuestions',20,
  'allRequiredAnswersSaved',count_saved=20,'canComplete',false,'canCommit',false);
end $$;
revoke all on function private.worksheet_statement_lock(),private.worksheet_immutable_owner(),private.worksheet_enrollment_versions(),
 private.worksheet_answer_version(),private.owned_worksheet_transaction(integer,text,jsonb) from public,anon,authenticated,service_role;
grant usage on schema private to authenticated;
grant execute on function private.owned_worksheet_transaction(integer,text,jsonb) to authenticated;
create function public.owned_worksheet_transaction(p_lesson integer,p_expected_revision text default null,p_answers jsonb default null)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.owned_worksheet_transaction(p_lesson,p_expected_revision,p_answers)
$$;
revoke all on function public.owned_worksheet_transaction(integer,text,jsonb) from public,anon,service_role;
grant execute on function public.owned_worksheet_transaction(integer,text,jsonb) to authenticated;

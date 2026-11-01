-- SOURCE ONLY: durable answer evidence, not playback or completion authority.
-- The prior worksheet function remains byte-for-byte unchanged. Its Auth locks
-- and worksheet mutation mutex remain held until this transaction completes.
create function private.owned_progression_snapshot(p_lesson integer)
 returns jsonb language plpgsql security definer set search_path='' set lock_timeout='2s' as $$
declare receipt jsonb; actor uuid; sid uuid; enrollment bigint; version uuid; deadline timestamptz;
begin
 receipt:=private.owned_worksheet_transaction(p_lesson,null,null);
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
revoke all on function private.owned_progression_snapshot(integer) from public,anon,authenticated,service_role;
grant execute on function private.owned_progression_snapshot(integer) to authenticated;
create function public.owned_progression_snapshot(p_lesson integer)
 returns jsonb language sql security invoker set search_path='' as $$
 select private.owned_progression_snapshot(p_lesson)
$$;
revoke all on function public.owned_progression_snapshot(integer) from public,anon,authenticated,service_role;
grant execute on function public.owned_progression_snapshot(integer) to authenticated;

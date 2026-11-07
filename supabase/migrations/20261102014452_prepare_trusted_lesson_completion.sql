-- SOURCE ONLY / UNINSTALLED. No observer is seeded, no API role is granted access.
-- Only a separately reviewed trusted server may ever populate observation rows.
-- Signatures prove origin, not human attention; browser telemetry is insufficient.
create table private.lesson_observer_profiles (
 id uuid primary key default gen_random_uuid(),
 revision uuid not null default gen_random_uuid(),
 lesson_number integer not null unique check(lesson_number between 1 and 4),
 provider text not null check(length(provider) between 1 and 100),
 observer_key_id text not null check(length(observer_key_id) between 1 and 100),
 public_key_sha256 text not null check(public_key_sha256 ~ '^[a-f0-9]{64}$'),
 source_review_sha256 text not null check(source_review_sha256 ~ '^[a-f0-9]{64}$'),
 source_kind text not null check(source_kind='independent_provider_observation'),
 media_id text not null check(length(media_id) between 1 and 100),
 video_revision text not null check(length(video_revision) between 1 and 100),
 policy_version text not null check(length(policy_version) between 1 and 100),
 duration_ms bigint not null check(duration_ms between 1 and 86400000),
 enabled boolean not null default false,
 effective_at timestamptz not null check(isfinite(effective_at)),
 expires_at timestamptz not null check(isfinite(expires_at) and expires_at>effective_at)
);
create table private.lesson_watch_observations (
 id uuid primary key,
 profile_id uuid not null references private.lesson_observer_profiles(id),
 profile_revision uuid not null,
 provider_receipt_id text not null check(length(provider_receipt_id) between 1 and 100),
 envelope_sha256 text not null check(envelope_sha256 ~ '^[a-f0-9]{64}$'),
 user_id uuid not null,
 session_id uuid not null,
 enrollment_id bigint not null,
 lesson_number integer not null check(lesson_number between 1 and 4),
 media_id text not null,
 video_revision text not null,
 policy_version text not null,
 start_ms bigint not null check(start_ms>=0),
 end_ms bigint not null check(end_ms>start_ms),
 elapsed_ms bigint not null check(elapsed_ms>=end_ms-start_ms and elapsed_ms<=86400000),
 eligible_playback boolean not null check(eligible_playback),
 observed_at timestamptz not null check(isfinite(observed_at)),
 valid_until timestamptz not null check(isfinite(valid_until) and valid_until>observed_at),
 revoked boolean not null default false,
 unique(profile_id,provider_receipt_id),
 unique(profile_id,envelope_sha256)
);
create table private.trusted_lesson_completion_audit (
 id uuid primary key default gen_random_uuid(),
 user_id uuid not null, session_id uuid not null, enrollment_id bigint not null,
 course_id bigint not null, lesson_number integer not null check(lesson_number between 1 and 4),
 worksheet_revision uuid not null, profile_id uuid not null, profile_revision uuid not null,
 provider text not null, observer_key_id text not null, public_key_sha256 text not null,
 source_review_sha256 text not null, media_id text not null, video_revision text not null,
 policy_version text not null, duration_ms bigint not null, unique_watched_ms bigint not null,
 observation_bindings jsonb not null, committed_at timestamptz not null default clock_timestamp(),
 unique(enrollment_id,lesson_number,worksheet_revision,profile_id,profile_revision,session_id)
);
alter table private.lesson_observer_profiles enable row level security;
alter table private.lesson_watch_observations enable row level security;
alter table private.trusted_lesson_completion_audit enable row level security;
revoke all on private.lesson_observer_profiles,private.lesson_watch_observations,private.trusted_lesson_completion_audit from public,anon,authenticated,service_role;

-- Reuse the accepted worksheet mutex. Every profile/receipt mutation participates
-- before row locks, including removal/revocation; no unprotected second check.
create trigger lesson_observer_lock before insert or update or delete or truncate on private.lesson_observer_profiles
 for each statement execute function private.worksheet_statement_lock();
create trigger lesson_observation_lock before insert or update or delete or truncate on private.lesson_watch_observations
 for each statement execute function private.worksheet_statement_lock();
create function private.lesson_observer_revision() returns trigger language plpgsql set search_path='' as $$
begin
 if new.id is distinct from old.id or new.lesson_number is distinct from old.lesson_number then
  raise exception 'Observer identity is immutable' using errcode='42501';end if;
 new.revision:=gen_random_uuid();return new;
end $$;
create trigger lesson_observer_revision before update on private.lesson_observer_profiles
 for each row execute function private.lesson_observer_revision();
create function private.lesson_evidence_immutable() returns trigger language plpgsql set search_path='' as $$
begin
 if tg_table_name='lesson_watch_observations' and tg_op='UPDATE' then
  if (to_jsonb(new)-'revoked')=(to_jsonb(old)-'revoked') and new.revoked and not old.revoked then return new;end if;
 end if;
 raise exception 'Historical lesson evidence is immutable' using errcode='42501';
end $$;
create trigger lesson_observation_immutable before update or delete on private.lesson_watch_observations
 for each row execute function private.lesson_evidence_immutable();
create trigger lesson_observation_no_truncate before truncate on private.lesson_watch_observations
 for each statement execute function private.lesson_evidence_immutable();
create trigger trusted_completion_immutable before update or delete on private.trusted_lesson_completion_audit
 for each row execute function private.lesson_evidence_immutable();
create trigger trusted_completion_no_truncate before truncate on private.trusted_lesson_completion_audit
 for each statement execute function private.lesson_evidence_immutable();
revoke all on function private.lesson_observer_revision(),private.lesson_evidence_immutable() from public,anon,authenticated,service_role;

-- No public wrapper or API EXECUTE grant. Auth claims must originate in a future
-- independently reviewed provider-authenticated server binding, never a client ID.
-- Existing owner-writable lesson_progress is a compatibility projection, NOT
-- trusted proof. Only this separately protected audit establishes this transaction.
create function private.commit_trusted_lesson_completion(
 p_lesson integer,p_worksheet_revision uuid,p_profile_id uuid,p_profile_revision uuid,p_observation_ids uuid[])
 returns jsonb language plpgsql security invoker set search_path='' set lock_timeout='2s' as $$
declare
 snap jsonb; actor uuid; sid uuid; enrollment bigint; course bigint; deadline timestamptz;
 profile private.lesson_observer_profiles%rowtype; observation private.lesson_watch_observations%rowtype;
 bindings jsonb:='[]'; seen integer:=0; watched bigint:=0; prior_end bigint:=0;
 audit private.trusted_lesson_completion_audit%rowtype;
begin
 if p_worksheet_revision is null or p_profile_id is null or p_profile_revision is null or p_observation_ids is null
  or cardinality(p_observation_ids) not between 1 and 10000
  or array_ndims(p_observation_ids)<>1 or array_position(p_observation_ids,null) is not null
  or (select count(distinct x) from unnest(p_observation_ids) x)<>cardinality(p_observation_ids) then
  raise exception 'Exact evidence binding required' using errcode='22023';end if;
 -- Existing current Auth locks -> worksheet mutex -> course/enrollment/version.
 snap:=private.owned_progression_snapshot(p_lesson);
 actor:=(snap->>'userId')::uuid;sid:=(snap->>'sessionId')::uuid;enrollment:=(snap->>'enrollmentId')::bigint;
 if (snap->>'worksheetRevision')::uuid is distinct from p_worksheet_revision then
  raise exception 'Worksheet changed' using errcode='40001';end if;
 if (snap#>>'{answerReceipt,receipt,allRequiredAnswersSaved}')::boolean is distinct from true then
  raise exception 'Durable answers incomplete' using errcode='42501';end if;
 select * into profile from private.lesson_observer_profiles where id=p_profile_id and lesson_number=p_lesson for share;
 if not found or profile.revision is distinct from p_profile_revision or not profile.enabled
  or profile.effective_at>clock_timestamp() or profile.expires_at<=clock_timestamp() then
  raise exception 'Trusted observer unavailable' using errcode='42501';end if;
 for observation in select * from private.lesson_watch_observations where id=any(p_observation_ids)
  order by start_ms,end_ms,id for share loop
  if observation.profile_id<>profile.id or observation.profile_revision<>profile.revision or observation.revoked
   or observation.user_id<>actor or observation.session_id<>sid or observation.enrollment_id<>enrollment
   or observation.lesson_number<>p_lesson or observation.media_id<>profile.media_id
   or observation.video_revision<>profile.video_revision or observation.policy_version<>profile.policy_version
   or observation.end_ms>profile.duration_ms or observation.observed_at<profile.effective_at
   or observation.observed_at+observation.elapsed_ms*interval '1 millisecond'>clock_timestamp()
   or observation.valid_until<=clock_timestamp() then
   raise exception 'Observation unavailable' using errcode='42501';end if;
  seen:=seen+1;
  watched:=watched+greatest(0,observation.end_ms-greatest(observation.start_ms,prior_end));
  prior_end:=greatest(prior_end,observation.end_ms);
  bindings:=bindings||jsonb_build_array(jsonb_build_object('id',observation.id,'providerReceiptId',observation.provider_receipt_id,
   'envelopeSha256',observation.envelope_sha256,'startMs',observation.start_ms,'endMs',observation.end_ms,
   'elapsedMs',observation.elapsed_ms,'observedAt',observation.observed_at,'validUntil',observation.valid_until));
 end loop;
 if seen<>cardinality(p_observation_ids) or watched*100<profile.duration_ms*95 then
  raise exception 'Verified watch threshold unavailable' using errcode='42501';end if;
 select course_id into course from public.course_enrollments where id=enrollment and user_id=actor;
 select * into audit from private.trusted_lesson_completion_audit where enrollment_id=enrollment and lesson_number=p_lesson
  and worksheet_revision=p_worksheet_revision and profile_id=profile.id and profile_revision=profile.revision and session_id=sid;
 if found and audit.observation_bindings is distinct from bindings then
  raise exception 'Completion evidence changed' using errcode='40001';end if;
 -- Return an existing exact committed receipt only after rechecking CURRENT proof.
 -- Do not overwrite a later legacy progress edit during an idempotent replay.
 if audit.id is null then
  insert into public.lesson_progress(user_id,course_id,lesson_number,status,started_at,completed_at,updated_at)
   values(actor,course,p_lesson,'completed',clock_timestamp(),clock_timestamp(),clock_timestamp())
   on conflict(user_id,course_id,lesson_number) do update set status='completed',
    completed_at=coalesce(public.lesson_progress.completed_at,excluded.completed_at),updated_at=excluded.updated_at;
  insert into private.trusted_lesson_completion_audit(user_id,session_id,enrollment_id,course_id,lesson_number,
   worksheet_revision,profile_id,profile_revision,provider,observer_key_id,public_key_sha256,source_review_sha256,
   media_id,video_revision,policy_version,duration_ms,unique_watched_ms,observation_bindings)
  values(actor,sid,enrollment,course,p_lesson,p_worksheet_revision,profile.id,profile.revision,profile.provider,
   profile.observer_key_id,profile.public_key_sha256,profile.source_review_sha256,profile.media_id,profile.video_revision,
   profile.policy_version,profile.duration_ms,watched,bindings) returning * into audit;
 end if;
 -- Deadline may advance while waiting on an existing progress row; reject atomically.
 select not_after into deadline from auth.sessions where id=sid and user_id=actor;
 if not found or deadline<=clock_timestamp() or profile.expires_at<=clock_timestamp()
  or exists(select 1 from private.lesson_watch_observations where id=any(p_observation_ids) and valid_until<=clock_timestamp()) then
  raise exception 'Completion authority expired' using errcode='42501';end if;
 return jsonb_build_object('source','trusted_lesson_completion_v1','completionReceipt',audit.id,
  'course','getting-a-grip-on-the-basics','lesson',p_lesson,'worksheetRevision',p_worksheet_revision,
  'uniqueWatchedMs',watched,'durationMs',profile.duration_ms,'committedAt',audit.committed_at);
end $$;
revoke all on function private.commit_trusted_lesson_completion(integer,uuid,uuid,uuid,uuid[]) from public,anon,authenticated,service_role;

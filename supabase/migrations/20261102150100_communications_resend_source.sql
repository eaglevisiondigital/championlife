-- SOURCE ONLY. No profile provisioning/enablement or runtime registry installation.
-- Existing queue, attempts, consent, suppression, service-role boundary and audits.
alter table public.communication_sender_profiles drop constraint communication_sender_profiles_provider_check;
alter table public.communication_sender_profiles add constraint communication_sender_profiles_provider_check check(provider in ('acceptance_sink','smtp_transport','sms_transport','resend_email'));
alter table public.communication_provider_controls add column resend_account_id text check(resend_account_id is null or length(resend_account_id) between 1 and 100);
alter table public.communication_attempts add column resend_binding jsonb;
create unique index communication_resend_receipt_unique on public.communication_outbox(organization_id,provider,provider_message_id) where provider='resend_email' and provider_message_id is not null;
create function private.comm_resend_binding(m public.communication_outbox,c public.communication_provider_controls,s public.communication_sender_profiles) returns jsonb language sql immutable set search_path='' as $$
 select jsonb_build_object('environment',c.environment,'project_ref',c.project_ref,'organization_id',m.organization_id,'profile_id',s.id,'provider',s.provider,'account_id',c.resend_account_id,'from',s.from_address,'reply_to',s.reply_to,'message_id',m.id,'idempotency_key',m.idempotency_key,'recipient',m.address_snapshot,'purpose',m.purpose,'subject',m.subject,'body_sha256',encode(sha256(convert_to(m.rendered_body,'UTF8')),'hex'),'api_idempotency_key','cl-resend-'||encode(sha256(convert_to(concat_ws(E'\n',c.environment,c.project_ref,m.organization_id,s.id,c.resend_account_id,m.id,m.idempotency_key),'UTF8')),'hex'))
$$;
revoke all on function private.comm_resend_binding(public.communication_outbox,public.communication_provider_controls,public.communication_sender_profiles) from public,anon,authenticated,service_role;
alter function private.comm_provider_service(text,uuid,jsonb) rename to comm_provider_service_context_v1;
revoke all on function private.comm_provider_service_context_v1(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.comm_provider_service(action text,o uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare m public.communication_outbox;a public.communication_attempts;c public.communication_provider_controls;
 s public.communication_sender_profiles;g public.communication_external_control;e public.communication_callbacks;b jsonb;answer jsonb;
begin
 if action='authorize_external' then
  perform private.comm_external_lock(o);
  answer:=private.comm_provider_service_context_v1(action,o,p);
  select * into m from public.communication_outbox where organization_id=o and id=(p->>'message_id')::uuid;
  select * into s from public.communication_sender_profiles where id=m.sender_profile_id and organization_id=o;
  if s.provider='resend_email' and answer->>'authorized'='true' then
   select * into c from public.communication_provider_controls where profile_id=s.id and organization_id=o;
   if c.resend_account_id is null then raise exception 'Resend account binding required';end if;
   b:=private.comm_resend_binding(m,c,s);
   update public.communication_attempts set resend_binding=b where organization_id=o and message_id=m.id and lease_token=m.lease_token and finished_at is null;
   if not found then raise exception 'Resend attempt unavailable';end if;
   answer:=answer||jsonb_build_object('resend_binding',b);
  end if;
  return answer;
 end if;
 if action is distinct from 'resend_receipt' then
  -- Resend receipts must use their exact persisted envelope, not generic callbacks.
  if action in ('callback_external','reconcile_external','keyword_external') then perform private.comm_external_lock(o);end if;
  if action in ('callback_external','reconcile_external','keyword_external') and exists(select 1 from public.communication_sender_profiles where organization_id=o and id=(p->>'id')::uuid and provider='resend_email') then raise exception 'Resend receipt binding required';end if;
  return private.comm_provider_service_context_v1(action,o,p);
 end if;
 perform private.comm_external_lock(o);
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>8192 then raise exception 'Receipt required';end if;
 select * into g from public.communication_external_control;
 select * into c from public.communication_provider_controls where organization_id=o and profile_id=(p->>'id')::uuid;
 select * into s from public.communication_sender_profiles where organization_id=o and id=c.profile_id;
 if s.id is null or s.provider<>'resend_email' or s.channel<>'email' or not c.structured_callbacks or c.environment is distinct from g.environment or c.project_ref is distinct from g.project_ref or c.environment is distinct from p->>'environment' or c.project_ref is distinct from p->>'project_ref' or c.resend_account_id is null or c.resend_account_id is distinct from p->>'account_id' or p->>'provider' is distinct from s.provider or s.from_address is distinct from p->>'from' or s.reply_to is distinct from p->>'reply_to' then raise exception 'Resend context mismatch';end if;
 if (p->>'body_sha256') is null or p->>'body_sha256' !~ '^[0-9a-f]{64}$' or coalesce(p->>'event_id','') !~ '^[A-Za-z0-9_-]{1,200}$' or p->>'outcome' is null or p->>'outcome' not in ('sent','delivered','hard_bounce','complaint','failed','soft_bounce') then raise exception 'Signed event evidence required';end if;
 if p->>'event_type' is null or p->>'outcome' is distinct from (case p->>'event_type' when 'email.sent' then 'sent' when 'email.delivery_delayed' then 'sent' when 'email.delivered' then 'delivered' when 'email.bounced' then 'hard_bounce' when 'email.complained' then 'complaint' when 'email.failed' then 'failed' end) or p->>'occurred_at' is null or (p->>'occurred_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'Event semantics required';end if;
 select * into m from public.communication_outbox where organization_id=o and id=(p->>'message_id')::uuid and sender_profile_id=s.id and provider=s.provider for update;
 if m.id is null or m.provider_message_id is null or m.provider_message_id is distinct from p->>'provider_message_id' or m.address_snapshot is distinct from p->>'recipient' or m.idempotency_key is distinct from p->>'idempotency_key' or m.purpose is distinct from p->>'purpose' or m.dispatch_authorized_at is null then raise exception 'Known canonical receipt required; UNKNOWN held';end if;
 select * into a from public.communication_attempts where organization_id=o and message_id=m.id and id=(p->>'attempt_id')::uuid and attempt=m.attempts and outcome='sent' and finished_at is not null for update;
 if a.id is null or a.resend_binding is distinct from private.comm_resend_binding(m,c,s) then raise exception 'Current accepted attempt required';end if;
 b:=jsonb_build_object('body_sha256',p->>'body_sha256','event_type',p->>'event_type','occurred_at',p->>'occurred_at','profile_id',s.id,'account_id',c.resend_account_id,'attempt_id',a.id,'environment',c.environment,'project_ref',c.project_ref,'message_id',m.id,'idempotency_key',m.idempotency_key,'purpose',m.purpose);
 select * into e from public.communication_callbacks where organization_id=o and provider=s.provider and event_id=p->>'event_id';
 if found then
  if e.message_id is distinct from m.id or e.outcome is distinct from p->>'outcome' or e.receipt_binding is distinct from b then raise exception 'Resend replay conflict';end if;
  return jsonb_build_object('duplicate',true,'retry_allowed',false);
 end if;
 -- Existing callback atomically records delivered/failure/suppression and audit.
 -- It deliberately accepts complaints even after delivery; nothing queues retries.
 answer:=private.comm_provider_service_h1('callback_external',o,p);
 update public.communication_callbacks set receipt_binding=b where organization_id=o and provider=s.provider and event_id=p->>'event_id';
 perform private.comm_audit(o,m.campaign_id,'provider.resend_receipt',m.id,jsonb_build_object('event_id',p->>'event_id','body_sha256',p->>'body_sha256','outcome',p->>'outcome','event_type',p->>'event_type','occurred_at',p->>'occurred_at','attempt_id',a.id));
 return answer||jsonb_build_object('retry_allowed',false);
end$$;
revoke all on function private.comm_provider_service(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.comm_provider_service(text,uuid,jsonb) to service_role;

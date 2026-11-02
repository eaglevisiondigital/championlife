-- SOURCE ONLY. Forward correction; historical migrations remain byte-identical.
-- No profiles, credentials, permissions, sends or callback endpoints are enabled.
do $guard$ begin
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_provider_service_resend_v1(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from '9b76bc45d84e44012951242b8f8be7fc3557d08e2291773023cc4aa01b90a6ca' then raise exception 'Reviewed Resend receipt dependency drift';end if;
 if has_function_privilege('anon','public.communications_provider_service(text,uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.communications_provider_service(text,uuid,jsonb)','EXECUTE') or has_function_privilege('service_role','private.comm_provider_service_resend_v1(text,uuid,jsonb)','EXECUTE') then raise exception 'Service boundary drift';end if;
end $guard$;
alter table public.communication_suppressions drop constraint communication_suppressions_reason_check;
alter table public.communication_suppressions add constraint communication_suppressions_reason_check check(reason in ('stop','unsubscribe','hard_bounce','complaint','admin','invalid_address','provider_suppressed'));
create or replace function private.comm_provider_service_resend_v1(action text,o uuid,p jsonb) returns jsonb
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
 if (p->>'body_sha256') is null or p->>'body_sha256' !~ '^[0-9a-f]{64}$' or coalesce(p->>'event_id','') !~ '^[A-Za-z0-9_-]{1,200}$' or p->>'outcome' is null or p->>'outcome' not in ('sent','delivered','hard_bounce','complaint','failed','provider_suppressed') then raise exception 'Signed event evidence required';end if;
 if p->>'event_type' is null or p->>'outcome' is distinct from (case p->>'event_type' when 'email.sent' then 'sent' when 'email.delivery_delayed' then 'sent' when 'email.delivered' then 'delivered' when 'email.bounced' then 'hard_bounce' when 'email.complained' then 'complaint' when 'email.failed' then 'failed' when 'email.suppressed' then 'provider_suppressed' end) or p->>'occurred_at' is null or (p->>'occurred_at')::timestamptz>clock_timestamp()+interval '5 minutes' then raise exception 'Event semantics required';end if;
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
 -- Canonical Resend reducer: no retry scheduling, consent mutation or unsuppression.
 -- Record event semantics even when an out-of-order event cannot change state.
 insert into public.communication_callbacks(organization_id,provider,event_id,message_id,outcome,receipt_binding)
 values(o,s.provider,p->>'event_id',m.id,p->>'outcome',b);
 if p->>'outcome'='provider_suppressed' then
  insert into public.communication_suppressions(organization_id,channel,address,reason)
  values(o,'email',m.address_snapshot,'provider_suppressed')
  on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;
  if m.status<>'delivered' then
   update public.communication_outbox set status='suppressed',failure_class='provider_suppressed',failed_at=clock_timestamp() where id=m.id;
  end if;
  perform private.comm_audit(o,m.campaign_id,'delivery.provider_suppressed',m.id);
 elsif p->>'outcome'='delivered' and m.status='sent' then
  update public.communication_outbox set status='delivered',delivered_at=clock_timestamp(),failure_class=null where id=m.id;
  perform private.comm_audit(o,m.campaign_id,'delivery.delivered',m.id);
 elsif p->>'outcome' in ('hard_bounce','complaint','failed') then
  if m.status not in ('delivered','suppressed') then
   update public.communication_outbox set status='failed',failure_class=p->>'outcome',failed_at=clock_timestamp() where id=m.id;
  end if;
  if p->>'outcome' in ('hard_bounce','complaint') then
   insert into public.communication_suppressions(organization_id,channel,address,reason)
   values(o,'email',m.address_snapshot,p->>'outcome')
   on conflict(organization_id,channel,address,reason) do update set active=true,cleared_at=null;
  end if;
  perform private.comm_audit(o,m.campaign_id,'delivery.'||(p->>'outcome'),m.id);
 elsif p->>'event_type'='email.delivery_delayed' then
  -- Temporary delay is neither delivery nor permanent failure. The existing sent
  -- status means API acceptance only. Retain terminal statuses and UNKNOWN holds.
  perform private.comm_audit(o,m.campaign_id,'delivery.delayed',m.id);
 end if;
 update public.communication_provider_controls set last_callback_at=clock_timestamp() where profile_id=s.id and organization_id=o;
 answer:=jsonb_build_object('recorded',true);
 perform private.comm_audit(o,m.campaign_id,'provider.resend_receipt',m.id,jsonb_build_object('event_id',p->>'event_id','body_sha256',p->>'body_sha256','outcome',p->>'outcome','event_type',p->>'event_type','occurred_at',p->>'occurred_at','attempt_id',a.id));
 return answer||jsonb_build_object('retry_allowed',false);
end$$;
revoke all on function private.comm_provider_service_resend_v1(text,uuid,jsonb) from public,anon,authenticated,service_role;

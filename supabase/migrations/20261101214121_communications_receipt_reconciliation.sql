-- LOCAL CANDIDATE. Existing H1 outbox, authority lock and append-only audit.
-- No sender activation, grant, new queue or permission expansion.
alter table public.communication_callbacks add column receipt_binding jsonb;
alter function private.comm_provider_service(text,uuid,jsonb) rename to comm_provider_service_h1;
revoke all on function private.comm_provider_service_h1(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.comm_provider_service(action text,o uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare m public.communication_outbox;a public.communication_attempts;c public.communication_provider_controls;
 g public.communication_external_control;s public.communication_sender_profiles;e public.communication_callbacks;
 b jsonb;outcome text;receipt text;
begin
 if action not in ('reconcile_external','callback_external') then return private.comm_provider_service_h1(action,o,p);end if;
 perform private.comm_external_lock(o);
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>8192 then raise exception 'Receipt envelope required';end if;
 select * into g from public.communication_external_control;
 select * into c from public.communication_provider_controls where organization_id=o and profile_id=(p->>'id')::uuid;
 select * into s from public.communication_sender_profiles where organization_id=o and id=c.profile_id;
 if c.profile_id is null or not c.structured_callbacks or c.environment is distinct from g.environment or c.project_ref is distinct from g.project_ref or s.provider is distinct from p->>'provider' then raise exception 'Authenticated provider binding required';end if;
 if length(coalesce(p->>'event_id','')) not between 1 and 200 or p->>'event_id' ~ '[[:cntrl:]]' then raise exception 'Provider event required';end if;
 if action='callback_external' then
  select * into m from public.communication_outbox where organization_id=o and sender_profile_id=c.profile_id and provider=s.provider and provider_message_id=p->>'provider_message_id';
  if m.id is null then raise exception 'Provider receipt not found';end if;
  select * into e from public.communication_callbacks where organization_id=o and provider=s.provider and event_id=p->>'event_id';
  if found and (e.message_id is distinct from m.id or e.outcome is distinct from p->>'outcome' or e.receipt_binding is not null) then raise exception 'Provider event replay conflict';end if;
  return private.comm_provider_service_h1(action,o,p);
 end if;
 -- Vendor verifier must authenticate these exact fields; there is no caller
 -- supplied "verified" switch. Only the existing service-role RPC can call us.
 if p->>'environment' is distinct from g.environment or p->>'project_ref' is distinct from g.project_ref then raise exception 'Receipt environment mismatch';end if;
 outcome:=p->>'outcome';receipt:=p->>'provider_message_id';
 if outcome is null or outcome not in ('sent','rejected','uncertain') then raise exception 'Unsupported reconciliation outcome';end if;
 if outcome='sent' and (length(coalesce(trim(receipt),'')) not between 1 and 200 or receipt ~ '[[:cntrl:]]') then raise exception 'Accepted provider receipt required';end if;
 if outcome<>'sent' and receipt is not null then raise exception 'Unaccepted receipt cannot bind provider ID';end if;
 select * into m from public.communication_outbox where organization_id=o and id=(p->>'message_id')::uuid and sender_profile_id=c.profile_id and provider=s.provider for update;
 if m.id is null or m.idempotency_key is distinct from p->>'idempotency_key' or m.dispatch_authorized_at is null or not exists(select 1 from public.communication_provider_tests where organization_id=o and message_id=m.id and profile_id=c.profile_id) then raise exception 'Authoritative H1 request binding required';end if;
 select * into a from public.communication_attempts where organization_id=o and message_id=m.id and id=(p->>'attempt_id')::uuid and attempt=m.attempts for update;
 if a.id is null then raise exception 'Current attempt binding required';end if;
 b:=jsonb_build_object('profile_id',c.profile_id,'environment',g.environment,'project_ref',g.project_ref,'message_id',m.id,'attempt_id',a.id,'idempotency_key',m.idempotency_key,'provider_message_id',receipt,'outcome',outcome);
 select * into e from public.communication_callbacks where organization_id=o and provider=s.provider and event_id=p->>'event_id';
 if found then
  if e.message_id is distinct from m.id or e.outcome is distinct from outcome or e.receipt_binding is distinct from b then raise exception 'Provider event replay conflict';end if;
  return jsonb_build_object('duplicate',true,'message_id',m.id,'retry_allowed',false);
 end if;
 if m.status<>'failed' or m.failure_class is distinct from 'uncertain' or a.failure_class is distinct from 'uncertain' or a.finished_at is null or m.provider_message_id is not null then raise exception 'Current unresolved UNKNOWN attempt required';end if;
 insert into public.communication_callbacks(organization_id,provider,event_id,message_id,outcome,receipt_binding)values(o,s.provider,p->>'event_id',m.id,outcome,b);
 if outcome<>'uncertain' then
  update public.communication_outbox set status=case when outcome='sent' then 'sent' else 'failed' end,
   provider_message_id=receipt,sent_at=case when outcome='sent' then now() else sent_at end,
   failure_class=case when outcome='sent' then null else 'rejected' end,
   credits_consumed=case when outcome='sent' then credits_consumed+credits_reserved else credits_consumed end,
   credits_reserved=case when outcome='sent' then 0 else credits_reserved end where id=m.id;
  update public.communication_attempts set outcome=outcome,failure_class=case when outcome='sent' then null else 'rejected' end where id=a.id;
 end if;
 perform private.comm_audit(o,m.campaign_id,'provider.reconciled',m.id,b||jsonb_build_object('event_id',p->>'event_id'));
 return jsonb_build_object('recorded',true,'message_id',m.id,'outcome',outcome,'retry_allowed',false);
end$$;
revoke all on function private.comm_provider_service(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.comm_provider_service(text,uuid,jsonb) to service_role;

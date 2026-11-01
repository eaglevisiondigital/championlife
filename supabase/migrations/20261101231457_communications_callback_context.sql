-- SOURCE ONLY. Bind the final receipt transaction to the server profile read
-- before provider verification. No provider is installed or activated.
alter function private.comm_provider_service(text,uuid,jsonb) rename to comm_provider_service_receipt_v1;
revoke all on function private.comm_provider_service_receipt_v1(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.comm_provider_service(action text,o uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare c public.communication_provider_controls;s public.communication_sender_profiles;g public.communication_external_control;expected jsonb;
begin
 if action in ('reconcile_external','callback_external','keyword_external') then
  perform private.comm_external_lock(o);
  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>8192 then raise exception 'Receipt context required';end if;
  select * into g from public.communication_external_control;
  select * into c from public.communication_provider_controls where organization_id=o and profile_id=(p->>'id')::uuid;
  select * into s from public.communication_sender_profiles where organization_id=o and id=c.profile_id;
  if c.profile_id is null or s.id is null or not c.structured_callbacks or
   c.environment is distinct from g.environment or c.project_ref is distinct from g.project_ref then raise exception 'Receipt context unavailable';end if;
  expected:=jsonb_build_object('profile_id',c.profile_id,'organization_id',o,
   'environment',c.environment,'project_ref',c.project_ref,'provider',s.provider,
   'channel',s.channel,'from_address',s.from_address,'reply_to',s.reply_to);
  if p->'callback_context' is distinct from expected then raise exception 'Provider callback context changed';end if;
 end if;
 -- Existing service owns receipt idempotency, canonical attempts, UNKNOWN holds,
 -- suppression and audit. The same transaction-scoped authority lock is retained.
 return private.comm_provider_service_receipt_v1(action,o,p);
end $$;
revoke all on function private.comm_provider_service(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.comm_provider_service(text,uuid,jsonb) to service_role;

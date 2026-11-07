-- SOURCE ONLY / UNINSTALLED. No sender, callback verifier, role or transport enabled.
-- Preserve existing keyword records; their unknown original binding cannot be guessed.
begin;
do $guard$
declare fn pg_catalog.pg_proc;
begin
 select * into strict fn from pg_catalog.pg_proc where oid='private.comm_service(text,uuid,jsonb)'::regprocedure;
 if encode(sha256(convert_to(fn.prosrc,'UTF8')),'hex') is distinct from '065a10ac2429fe4ffa1ff30b1fabba6bdf65d746bf09cae3aec015fe2a3b82f7'
  or not fn.prosecdef or fn.proconfig is distinct from array['search_path=""']::text[] then
  raise exception 'Reviewed preference service dependency drift';
 end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_external_lock(uuid)'::regprocedure),'UTF8')),'hex') is distinct from '340a4efe9e6052eb0424b47d46ca555cf3149445caba6b7a4a8d56ee56e40863' then raise exception 'Reviewed preference lock dependency drift';end if;
 if has_function_privilege('anon',fn.oid,'EXECUTE') or has_function_privilege('authenticated',fn.oid,'EXECUTE')
  or not has_function_privilege('service_role',fn.oid,'EXECUTE') then raise exception 'Preference service boundary drift';end if;
 if not (select relrowsecurity from pg_catalog.pg_class where oid='public.communication_keyword_events'::regclass)
  or has_table_privilege('anon','public.communication_keyword_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE')
  or has_table_privilege('authenticated','public.communication_keyword_events','SELECT,INSERT,UPDATE,DELETE,TRUNCATE') then
  raise exception 'Preference ledger boundary drift';
 end if;
end $guard$;
alter table public.communication_keyword_events add column receipt_binding jsonb;
do $patch$
declare definition text;original text;replacement text;
begin
 definition:=pg_catalog.pg_get_functiondef('private.comm_service(text,uuid,jsonb)'::regprocedure);
 original:=$original$  if length(coalesce(p->>'event_id','')) not between 1 and 200 then raise exception 'Preference event ID required';end if;
  insert into public.communication_keyword_events(organization_id,event_id,keyword) values(o,p->>'event_id',p->>'keyword') on conflict do nothing;if not found then return jsonb_build_object('duplicate',true);end if;
  if p->>'keyword' not in ('STOP','START','HELP','UNSUBSCRIBE') then raise exception 'Unknown preference keyword';end if;$original$;
 replacement:=$replacement$  if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>8192 or
   jsonb_typeof(p->'event_id') is distinct from 'string' or jsonb_typeof(p->'channel') is distinct from 'string' or
   jsonb_typeof(p->'keyword') is distinct from 'string' or jsonb_typeof(p->'address') is distinct from 'string' or
   (p ? 'provider' and jsonb_typeof(p->'provider') is distinct from 'string') or
   length(coalesce(p->>'event_id','')) not between 1 and 200 or p->>'event_id' ~ '[[:cntrl:]]' then raise exception 'Preference event required';end if;
  if p->>'keyword' is null or p->>'channel' is null or not (
   (p->>'channel'='sms' and p->>'keyword' in ('STOP','START','HELP')) or
   (p->>'channel'='email' and p->>'keyword'='UNSUBSCRIBE')) then raise exception 'Matching preference channel and keyword required';end if;
  if not private.comm_valid_address(p->>'channel',private.comm_address(p->>'channel',p->>'address')) then raise exception 'Valid preference recipient required';end if;
  -- The low-level service is also service-role callable. Validate its external
  -- context here rather than storing caller metadata or relying on outer routing.
  if p->'callback_context' is null or p->'callback_context'='null'::jsonb then
   if coalesce(p->>'provider','acceptance_sink')<>'acceptance_sink' or p ? 'id' then raise exception 'Acceptance preference context required';end if;
   r:=jsonb_build_object('organization_id',o,'provider','acceptance_sink');
  else
   if jsonb_typeof(p->'callback_context') is distinct from 'object' or
    jsonb_typeof(p->'id') is distinct from 'string' or p->>'provider' is distinct from 'sms_transport' or p->>'channel'<>'sms' then raise exception 'External preference context required';end if;
   select jsonb_build_object('profile_id',c.profile_id,'organization_id',c.organization_id,
    'environment',c.environment,'project_ref',c.project_ref,'provider',s.provider,
    'channel',s.channel,'from_address',s.from_address,'reply_to',s.reply_to) into r
   from public.communication_provider_controls c
   join public.communication_sender_profiles s on s.id=c.profile_id and s.organization_id=c.organization_id
   cross join public.communication_external_control g
   where c.organization_id=o and c.profile_id=(p->>'id')::uuid and c.structured_callbacks
    and c.environment=g.environment and c.project_ref=g.project_ref and s.provider='sms_transport' and s.channel='sms';
   if r is null or p->'callback_context' is distinct from r then raise exception 'Current preference context required';end if;
  end if;
  -- The existing organization lock already serializes every keyword operation.
  -- Keep raw recipient/envelope/secret bytes out of this metadata ledger.
  v:=jsonb_build_object('channel',p->>'channel','keyword',p->>'keyword',
   'recipient_sha256',encode(sha256(convert_to(private.comm_address(p->>'channel',p->>'address'),'UTF8')),'hex'),
   'provider',coalesce(p->>'provider','acceptance_sink'),'context_sha256',encode(sha256(convert_to(r::text,'UTF8')),'hex'));
  select to_jsonb(k) into r from public.communication_keyword_events k where k.organization_id=o and k.event_id=p->>'event_id';
  if found then
   if r->>'keyword' is distinct from p->>'keyword' or r->'receipt_binding' is distinct from v then raise exception 'Preference event replay conflict or unbound history';end if;
   return jsonb_build_object('duplicate',true);
  end if;
  insert into public.communication_keyword_events(organization_id,event_id,keyword,receipt_binding) values(o,p->>'event_id',p->>'keyword',v);$replacement$;
 if position(original in definition)=0 or (length(definition)-length(replace(definition,original,'')))<>length(original) then
  raise exception 'Reviewed preference source fragment drift';
 end if;
 definition:=replace(definition,original,replacement);
 original:=' perform private.comm_lock(o);select * into cfg from public.communication_settings where organization_id=o;';
 replacement:=$lock$ if action='keyword' and p->'callback_context' is not null and p->'callback_context'<>'null'::jsonb then
  perform private.comm_external_lock(o);
 else perform private.comm_lock(o);end if;
 select * into cfg from public.communication_settings where organization_id=o;$lock$;
 if position(original in definition)=0 or (length(definition)-length(replace(definition,original,'')))<>length(original) then
  raise exception 'Reviewed preference lock fragment drift';
 end if;
 -- CREATE OR REPLACE preserves the existing function identity, owner and ACL.
 -- Every unrelated action and the original preference reducer/audit stay exact.
 execute replace(definition,original,replacement);
end $patch$;
commit;

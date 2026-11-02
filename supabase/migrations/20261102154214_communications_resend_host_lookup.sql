-- SOURCE ONLY: adds one service-only, exact known-ID lookup; no sender/host activation.
-- Generated with supported Supabase CLI migration new. Prior source remains unchanged.
do $guard$ begin
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='public.communications_provider_service(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from 'f444f933e110c0f5e56e850971a325d15a690d55bf4cdadbd4407a25c1ebcac9' or (select prosecdef from pg_catalog.pg_proc where oid='public.communications_provider_service(text,uuid,jsonb)'::regprocedure) then raise exception 'Reviewed public wrapper drift';end if;
 if not exists(select 1 from pg_catalog.pg_index i where i.indexrelid=to_regclass('public.communication_resend_receipt_unique') and i.indisunique and i.indisvalid and i.indnkeyatts=3 and (select array_agg(a.attname::text order by k.n) from unnest(i.indkey) with ordinality k(attnum,n) join pg_catalog.pg_attribute a on a.attrelid=i.indrelid and a.attnum=k.attnum)=array['organization_id','provider','provider_message_id']) then raise exception 'Reviewed receipt uniqueness missing';end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_provider_service_h1(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from '1815ee150e66957e785803df6b04cffd0aaad88845c7278e9911582870ab7618' then raise exception 'Reviewed H1 dependency drift';end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_provider_service_receipt_v1(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from '2d0557825cbbd6386fc94fa6cabfef09cd48c798285fab3feef0af010edf875f' then raise exception 'Reviewed H1 dependency drift';end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_provider_service_context_v1(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from 'e9f7a5bf3396a9bffc4f2ed3f7b12c9fd4b23d5ce700af54ff10cec8d654201c' then raise exception 'Reviewed H1 dependency drift';end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_provider_service(text,uuid,jsonb)'::regprocedure),'UTF8')),'hex') is distinct from '9b76bc45d84e44012951242b8f8be7fc3557d08e2291773023cc4aa01b90a6ca' then raise exception 'Reviewed Resend dependency drift';end if;
 if encode(sha256(convert_to((select prosrc from pg_catalog.pg_proc where oid='private.comm_resend_binding(public.communication_outbox,public.communication_provider_controls,public.communication_sender_profiles)'::regprocedure),'UTF8')),'hex') is distinct from 'b9ce1ec836ccfebf63d9691e09b8c53c2fcc120baebc7b2e72ee83522189609d' then raise exception 'Reviewed Resend dependency drift';end if;
 if has_function_privilege('anon','public.communications_provider_service(text,uuid,jsonb)','EXECUTE') or has_function_privilege('authenticated','public.communications_provider_service(text,uuid,jsonb)','EXECUTE') then raise exception 'Service boundary drift';end if;
end $guard$;
alter function private.comm_provider_service(text,uuid,jsonb) rename to comm_provider_service_resend_v1;
revoke all on function private.comm_provider_service_resend_v1(text,uuid,jsonb) from public,anon,authenticated,service_role;
create function private.comm_provider_service(action text,o uuid,p jsonb) returns jsonb
language plpgsql security definer set search_path='' as $$
#variable_conflict use_variable
declare m public.communication_outbox;a public.communication_attempts;c public.communication_provider_controls;
 s public.communication_sender_profiles;g public.communication_external_control;
begin
 if action is distinct from 'resend_lookup' then return private.comm_provider_service_resend_v1(action,o,p);end if;
 -- Same serialization as profile changes and final receipt. This read is not a grant
 -- to commit later: resend_receipt repeats every binding/attempt check under this lock.
 perform private.comm_external_lock(o);
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>2048 or
  (select count(*) from jsonb_object_keys(p))<>6 or not(p ?& array['id','provider_message_id','account_id','environment','project_ref','provider']) or
  p->>'provider' is distinct from 'resend_email' or coalesce(p->>'provider_message_id','') !~ '^[a-f0-9]{8}(-[a-f0-9]{4}){3}-[a-f0-9]{12}$' then raise exception 'Exact known receipt binding required';end if;
 select * into strict g from public.communication_external_control;
 select * into strict c from public.communication_provider_controls where organization_id=o and profile_id=(p->>'id')::uuid;
 select * into strict s from public.communication_sender_profiles where organization_id=o and id=c.profile_id;
 if s.id is null or s.provider<>'resend_email' or s.channel<>'email' or not c.structured_callbacks or c.environment is distinct from g.environment or c.project_ref is distinct from g.project_ref or c.environment is distinct from p->>'environment' or c.project_ref is distinct from p->>'project_ref' or c.resend_account_id is null or c.resend_account_id is distinct from p->>'account_id' then raise exception 'Resend lookup context mismatch';end if;
 select * into strict m from public.communication_outbox where organization_id=o and sender_profile_id=s.id and provider=s.provider and provider_message_id=p->>'provider_message_id';
 if m.id is null or m.dispatch_authorized_at is null then raise exception 'Known accepted receipt required; UNKNOWN held';end if;
 select * into strict a from public.communication_attempts where organization_id=o and message_id=m.id and attempt=m.attempts and outcome='sent' and finished_at is not null;
 if a.id is null or a.resend_binding is distinct from private.comm_resend_binding(m,c,s) then raise exception 'Current accepted attempt required';end if;
 -- Whitelist only resolver fields, never message/subject/body, credentials or extra people.
 return jsonb_build_object('message_id',m.id,'attempt_id',a.id,'organization_id',o,'profile_id',s.id,'provider',s.provider,'provider_message_id',m.provider_message_id,'recipient',m.address_snapshot,'from',s.from_address,'environment',c.environment,'project_ref',c.project_ref,'account_id',c.resend_account_id,'idempotency_key',m.idempotency_key,'purpose',m.purpose);
end$$;
revoke all on function private.comm_provider_service(text,uuid,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.comm_provider_service(text,uuid,jsonb) to service_role;

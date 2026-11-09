-- Source-only local candidate. NOT a hosted migration or activated API.
-- No new ledger, permission, role or browser grant. Existing import/adjust/refund unchanged.
begin;
-- One source identity across gift and imported correction kinds. Existing ambiguous
-- catalogs fail installation atomically instead of selecting an arbitrary record.
create unique index giving_historical_source_identity on public.giving_ledger(organization_id,source_system,external_transaction_id) where source_system is not null;
create function private.giving_history_boundary() returns trigger language plpgsql security invoker set search_path='' as $$
begin
 if exists(select 1 from public.giving_ledger where organization_id=new.organization_id and id=new.original_id and source='historical_import') then
  raise exception 'Historical correction descendants require reviewed remediation' using errcode='42501';
 end if;
 return new;
end$$;
revoke all on function private.giving_history_boundary() from public,anon,authenticated,service_role;
create trigger giving_history_boundary before insert on public.giving_ledger for each row execute function private.giving_history_boundary();
create function private.giving_import_history(o uuid,p jsonb) returns jsonb
language plpgsql security invoker set search_path='' as $$
declare
 g public.giving_ledger; prior public.giving_requests; row_id uuid; result jsonb;
 delta bigint; balance numeric; needed text; request_id uuid;
begin
 perform private.giving_payload(p,array['request_key','original_id','person_id','fund_id','currency','source_system','source_transaction_id','original_source_transaction_id','kind','direction','amount_minor','expected_balance_minor','occurred_at','tax_eligible','receipt_reference','statement_reference','statement_archive_sha256','review_reference']);
 if jsonb_typeof(p)<>'object' or not p ?& array['request_key','original_id','person_id','fund_id','currency','source_system','source_transaction_id','original_source_transaction_id','kind','direction','amount_minor','expected_balance_minor','occurred_at','tax_eligible','receipt_reference','statement_reference','statement_archive_sha256','review_reference'] then raise exception 'Exact historical contract required';end if;
 for needed in select unnest(array['request_key','original_id','fund_id','currency','source_system','source_transaction_id','original_source_transaction_id','kind','direction','amount_minor','expected_balance_minor','occurred_at','review_reference']) loop
  if jsonb_typeof(p->needed) is distinct from 'string' then raise exception 'Non-null string contract required';end if;
 end loop;
 foreach needed in array array['person_id','receipt_reference','statement_reference','statement_archive_sha256'] loop
  if jsonb_typeof(p->needed) not in('string','null') then raise exception 'Nullable string contract required';end if;
 end loop;
 perform private.giving_lock(o);
 foreach needed in array array['finance.read','finance.gifts.read','finance.gifts.create','finance.gifts.adjust','finance.reconciliation.manage'] loop
  if not private.giving_authorized(o,needed) then raise exception 'Historical finance authority denied' using errcode='42501';end if;
 end loop;
 if p->>'kind'='refund' and not private.giving_authorized(o,'finance.refunds.manage') then raise exception 'Historical refund authority denied' using errcode='42501';end if;
 if p->>'kind' not in('refund','correction') or p->>'direction' not in('increase','decrease') or (p->>'kind'='refund' and p->>'direction'<>'decrease') then raise exception 'Historical kind/direction invalid';end if;
 if (p->>'amount_minor')!~'^[1-9][0-9]{0,12}$' or (p->>'amount_minor')::numeric>1000000000000 or (p->>'expected_balance_minor')!~'^(0|[1-9][0-9]{0,12})$' then raise exception 'Historical amount invalid';end if;
 if (p->>'source_system')!~'^GiveHub:[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' or (p->>'source_transaction_id')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' or (p->>'review_reference')!~'^[A-Za-z0-9][A-Za-z0-9_.:-]{0,119}$' then raise exception 'Reviewed source references required';end if;
 if jsonb_typeof(p->'tax_eligible')<>'boolean' or jsonb_typeof(p->'occurred_at')<>'string' or (p->>'occurred_at')!~'^\d{4}-\d\d-\d\dT\d\d:\d\d:\d\d(\.\d{3})?Z$' then raise exception 'Historical classification/time required';end if;
 if p->>'receipt_reference' is not null and (length(p->>'receipt_reference')=0 or length(p->>'receipt_reference')>200) then raise exception 'Invalid receipt reference';end if;
 if (p->>'statement_reference' is null)<>(p->>'statement_archive_sha256' is null) or (p->>'statement_reference' is not null and (length(p->>'statement_reference')=0 or length(p->>'statement_reference')>200 or (p->>'statement_archive_sha256')!~'^[a-f0-9]{64}$')) then raise exception 'Statement archive binding required';end if;
 request_id:=(p->>'request_key')::uuid;if request_id is null then raise exception 'Request identity required';end if;
 select * into g from public.giving_ledger where organization_id=o and id=(p->>'original_id')::uuid for update;
 if not found or g.kind<>'gift' or g.source<>'import' or g.leg_id is not null or g.session_id is not null or g.source_system is distinct from p->>'source_system' or g.external_transaction_id is distinct from p->>'original_source_transaction_id' or g.person_id is distinct from (p->>'person_id')::uuid or g.fund_id is distinct from (p->>'fund_id')::uuid or g.currency is distinct from p->>'currency' or g.tax_eligible is distinct from (p->>'tax_eligible')::boolean then raise exception 'Original historical scope/classification mismatch';end if;
 perform private.giving_identity(o,g.person_id,g.household_id);
 select * into prior from public.giving_requests where organization_id=o and operation='historical_correction' and request_key=request_id;
 if found then if prior.payload is distinct from p then raise exception 'Historical request conflict';end if;return prior.result;end if;
 -- Source identity is unique across gifts AND corrections, independent of request key.
 select id into row_id from public.giving_ledger where organization_id=o and source_system=p->>'source_system' and external_transaction_id=p->>'source_transaction_id';
 if found then
  select * into prior from public.giving_requests where organization_id=o and operation='historical_correction' and giving_requests.result->>'id'=row_id::text;
  if not found or (prior.payload-'request_key') is distinct from (p-'request_key') then raise exception 'Historical source conflict';end if;
  return prior.result;
 end if;
 if exists(select 1 from public.giving_ledger where organization_id=o and original_id=g.id and source='historical_import' and gift_at>=(p->>'occurred_at')::timestamptz) then raise exception 'Historical correction order requires review';end if;
 if (p->>'occurred_at')::timestamptz<g.gift_at then raise exception 'Correction predates original';end if;
 if exists(select 1 from public.giving_batches where organization_id=o and id=g.batch_id and status<>'open') or exists(select 1 from public.giving_reconciliations where organization_id=o and batch_id=g.batch_id) or exists(select 1 from public.giving_pledge_allocations where organization_id=o and gift_id=g.id) or exists(select 1 from public.giving_ledger where organization_id=o and original_id=g.id and source<>'historical_import') then raise exception 'Original has incompatible batch/allocation/adjustment history';end if;
 select g.amount_minor+coalesce(sum(amount_minor),0) into balance from public.giving_ledger where organization_id=o and original_id=g.id;
 if balance<>(p->>'expected_balance_minor')::numeric then raise exception 'Historical balance revision conflict';end if;
 delta:=(p->>'amount_minor')::bigint * case when p->>'direction'='decrease' then -1 else 1 end;
 if balance+delta<0 or balance+delta>1000000000000 then raise exception 'Historical balance outside bounds';end if;
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,batch_id,original_id,kind,amount_minor,currency,gift_at,source,payment_method,tax_eligible,notes,external_reference,source_system,external_transaction_id,receipt_history_reference,anonymous_public,campaign_reference,event_reference,entered_by,posted_by)
 values(o,g.person_id,g.household_id,g.fund_id,g.batch_id,g.id,p->>'kind',delta,g.currency,(p->>'occurred_at')::timestamptz,'historical_import','external',g.tax_eligible,'Historical source record; no provider operation',p->>'source_transaction_id',g.source_system,p->>'source_transaction_id',p->>'receipt_reference',g.anonymous_public,g.campaign_reference,g.event_reference,auth.uid(),auth.uid()) returning id into row_id;
 result:=jsonb_build_object('id',row_id,'original_id',g.id,'balance_minor',(balance+delta)::text,'provider_operation',false);
 insert into public.giving_requests values(o,'historical_correction',request_id,p,result,now());
 perform private.giving_audit_event(o,'gift.historical_import',row_id,jsonb_build_object('original_id',g.id,'kind',p->>'kind','review_reference',p->>'review_reference'));
 return result;
end$$;
revoke all on function private.giving_import_history(uuid,jsonb) from public,anon,authenticated,service_role;
commit;

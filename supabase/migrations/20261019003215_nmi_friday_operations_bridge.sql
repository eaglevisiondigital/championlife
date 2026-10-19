-- Integrate the accepted sibling NMI and Operations modules. Observations only:
-- no ledger finalization, provider execution, retry authorization or credential access.
create function private.nmi_friday_operations_observation() returns trigger
language plpgsql security definer set search_path='' as $$
declare op private.payments_operations; normalized text;
begin
 select * into op from private.payments_operations
 where organization_id=new.organization_id and id=new.attempt_id;
 if not found then raise exception 'NMI operation scope unavailable' using errcode='42501';end if;
 -- Vault/subscription/adjustment outcomes are not new gift outcomes.
 if op.leg_id is null or op.operation not in('sale','authorize','capture','transaction') then return new;end if;
 normalized:=case when new.status in('captured','settled','partially_refunded','refunded') then 'paid'
   when new.status='failed' then 'failed' when new.status in('pending','authorized','tokenized') then 'still_pending'
   else 'unknown' end;
 perform private.payment_ops_service('observe',new.organization_id,jsonb_build_object(
   'request_key',new.id,'source_key','nmi-observation:'||new.id::text,
   'leg_id',op.leg_id,'operation_id',op.id,'result',normalized,
   'failure_category',new.category));
 return new;
end$$;
revoke all on function private.nmi_friday_operations_observation() from public,anon,authenticated,service_role;
create trigger nmi_friday_operations_observation after insert on private.payments_nmi_observations
 for each row execute function private.nmi_friday_operations_observation();

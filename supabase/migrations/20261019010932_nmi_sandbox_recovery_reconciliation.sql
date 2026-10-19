-- Recovery, batch projections and provider-scheduled gifts use the same canonical ledger.
create function private.nmi_giving_recovery_route_ok(o uuid,r uuid)returns boolean language sql stable security definer set search_path=''as $$
select exists(select 1 from private.nmi_giving_route_proofs proof join private.payments_nmi_routes nr on nr.route_id=proof.route_id and nr.organization_id=o and nr.gateway_id=proof.gateway_id
 join private.payments_nmi_accounts a on a.organization_id=o and a.gateway_id=proof.gateway_id join public.giving_gateway_accounts g on g.organization_id=o and g.id=a.gateway_id
 join public.giving_processor_routes gr on gr.organization_id=o and gr.id=r and gr.gateway_id=g.id
 where proof.organization_id=o and proof.route_id=r and proof.verified_at is not null and proof.proof_reference is not null and nr.verified_at is not null and a.last_verified_at is not null
 and proof.mid_reference=gr.mid_reference and length(proof.settlement_reference)>0 and proof.merchant_reference=a.merchant_reference and g.provider='nmi'and g.environment='sandbox'and gr.environment='sandbox'and gr.currency='USD')
$$;
-- Cancel/pause/lookup remain structurally scoped after the new-charge switch is disabled.
do $$declare body text;begin
 body:=pg_get_functiondef('private.nmi_giving_service(text,uuid,jsonb)'::regprocedure);
 body:=replace(body,'not private.nmi_giving_route_ok(o,(l.route_snapshot->>''processor_route_id'')::uuid)',
  'not(case when p->>''operation'' in(''transaction'',''refund'',''void'',''recurring_cancel'',''recurring_pause'')then private.nmi_giving_recovery_route_ok(o,(l.route_snapshot->>''processor_route_id'')::uuid)else private.nmi_giving_route_ok(o,(l.route_snapshot->>''processor_route_id'')::uuid)end)');
 body:=replace(body,'not private.nmi_giving_route_ok(o,route.route_id)',
  'not(case when op.operation in(''transaction'',''refund'',''void'',''recurring_cancel'',''recurring_pause'')then private.nmi_giving_recovery_route_ok(o,route.route_id)else private.nmi_giving_route_ok(o,route.route_id)end)');
 body:=replace(body,'''save_method'',attempt.save_method',
  '''expected_subscription'',(select sub.provider_reference from private.nmi_giving_recurring_charges charge join private.nmi_giving_subscriptions sub on sub.instruction_id=charge.instruction_id and sub.route_id=route.route_id where charge.session_id=sid),''save_method'',attempt.save_method');
 execute body;
end$$;
create table private.nmi_giving_recurring_charges(
 organization_id uuid not null,gateway_id uuid not null,provider_reference text not null,instruction_id uuid not null,
 session_id uuid not null,leg_id uuid not null,created_at timestamptz not null default now(),
 primary key(gateway_id,provider_reference),foreign key(organization_id,instruction_id)references public.giving_recurring_instructions(organization_id,id),
 foreign key(organization_id,session_id,leg_id)references public.giving_transaction_legs(organization_id,session_id,id)
);
alter table private.nmi_giving_recurring_charges enable row level security;
revoke all on private.nmi_giving_recurring_charges from public,anon,authenticated,service_role;
create trigger nmi_giving_recurring_charges_immutable before update or delete on private.nmi_giving_recurring_charges for each row execute function private.giving_immutable();
create function private.nmi_giving_recurring_ledger()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.source='nmi_sandbox'and new.kind='gift'then select instruction_id into new.recurring_id from private.nmi_giving_recurring_charges where organization_id=new.organization_id and session_id=new.session_id;end if;return new;
end$$;
create trigger nmi_giving_recurring_ledger before insert on public.giving_ledger for each row execute function private.nmi_giving_recurring_ledger();
create table private.nmi_giving_batch_reconciliations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,gateway_id uuid not null,route_id uuid not null,batch_reference text not null,
 fee_minor bigint not null check(fee_minor>=0),net_minor bigint not null,deposit_minor bigint not null,statement_reference text not null,
 state text not null check(state in('balanced','attention')),actor_id uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(gateway_id,route_id,batch_reference)references private.nmi_giving_batches(gateway_id,route_id,batch_reference)
);
alter table private.nmi_giving_batch_reconciliations enable row level security;
revoke all on private.nmi_giving_batch_reconciliations from public,anon,authenticated,service_role;
create trigger nmi_giving_batch_reconciliations_immutable before update or delete on private.nmi_giving_batch_reconciliations for each row execute function private.giving_immutable();
alter function private.nmi_giving_service(text,uuid,jsonb)rename to nmi_giving_execution;
revoke all on function private.nmi_giving_execution(text,uuid,jsonb)from public,anon,authenticated,service_role;
create function private.nmi_giving_service(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare route private.payments_nmi_routes;account private.payments_nmi_accounts;proof private.nmi_giving_route_proofs;
 sub private.nmi_giving_subscriptions;original public.giving_sessions;context private.nmi_giving_checkouts;leg public.giving_transaction_legs;
 attempt private.nmi_giving_attempts;op private.payments_operations;item jsonb;result jsonb;computed_digest text;state text;sid uuid;lid uuid;identifier uuid;
 job private.payment_ops_jobs;total bigint:=0;expected bigint;matched int:=0;count_items int;actor uuid;kind text;
begin
 if current_setting('role',true)<>'service_role'then raise exception 'NMI service authority required'using errcode='42501';end if;
 if a not in('batch_scope','batch_record','batch_reconcile','operation_job','job_complete','webhook_scope','webhook','operations')then return private.nmi_giving_execution(a,o,p);end if;
 perform private.giving_lock(o);
 actor:=(p->>'actor_id')::uuid;
 if a in('operation_job','job_complete')then
  if not private.nmi_giving_actor(o,actor,'payments.manage')then raise exception 'Operations executor authority required';end if;
  select * into job from private.payment_ops_jobs where organization_id=o and id=(p->>'job_id')::uuid for update;
  if job.id is null then raise exception 'Job unavailable';end if;
  if a='job_complete'then
   perform private.giving_payload(p,array['actor_id','job_id','lease','state']);
   if job.status<>'leased'or job.lease_token is distinct from(p->>'lease')::uuid then raise exception 'Job lease unavailable';end if;
   update private.payment_ops_jobs set status=case when p->>'state'='completed'then 'completed'else 'review'end,lease_token=null,lease_until=null where id=job.id;return jsonb_build_object('recorded',true);
  end if;
  perform private.giving_payload(p,array['actor_id','job_id']);
  if job.status<>'held'or job.not_before>now()then return jsonb_build_object('claimed',false,'state',job.status);end if;
  if job.kind<>'lookup'then
   update private.payment_ops_jobs set status='review'where id=job.id;perform private.giving_audit_event(o,'nmi.operations.donor_action_required',job.id);
   return jsonb_build_object('claimed',false,'state','donor_action_required','automatic_charge',false);
  end if;
  select a.* into attempt from private.nmi_giving_attempts a join private.payments_operations x on x.id=a.id where x.organization_id=o and x.leg_id=job.leg_id and x.operation in('sale','authorize','capture')order by a.created_at desc limit 1;
  if attempt.id is null then raise exception 'Canonical NMI execution attempt required';end if;
  select * into op from private.payments_operations where id=attempt.id;
  result:=private.nmi_giving_execution('prepare',o,jsonb_build_object('session_id',attempt.session_id,'leg_id',op.leg_id,'operation','transaction','request_key',job.id,'parent_attempt_id',attempt.id,'actor_id',actor));
  sid:=gen_random_uuid();update private.payment_ops_jobs set status='leased',lease_token=sid,lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=job.id;
  return result||jsonb_build_object('claimed',true,'job_lease',sid,'session_id',attempt.session_id);
 end if;
 if a='batch_reconcile'then
  perform private.giving_payload(p,array['actor_id','gateway_id','route_id','batch_reference','fee_minor','net_minor','deposit_minor','statement_reference']);
  if not private.nmi_giving_actor(o,actor,'payments.reconcile')then raise exception 'Reconciliation authority required';end if;
  if jsonb_typeof(p->'fee_minor')<>'string'or jsonb_typeof(p->'net_minor')<>'string'or jsonb_typeof(p->'deposit_minor')<>'string'or p->>'fee_minor'!~'^[0-9]{1,13}$'or p->>'net_minor'!~'^[0-9]{1,13}$'or p->>'deposit_minor'!~'^[0-9]{1,13}$'then raise exception 'Exact statement money required';end if;
  perform private.payment_ops_safe_text(p->>'statement_reference',5,120);
  select snapshot into result from private.nmi_giving_batches where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and route_id=(p->>'route_id')::uuid and batch_reference=p->>'batch_reference';
  if result is null then raise exception 'Authoritative batch lookup required first';end if;
  state:=case when result->>'state'='gross_matched_fees_unverified'and (result->>'gross_minor')::bigint-(p->>'fee_minor')::bigint=(p->>'net_minor')::bigint and (p->>'net_minor')::bigint=(p->>'deposit_minor')::bigint then 'balanced'else 'attention'end;
  insert into private.nmi_giving_batch_reconciliations(organization_id,gateway_id,route_id,batch_reference,fee_minor,net_minor,deposit_minor,statement_reference,state,actor_id)
   values(o,(p->>'gateway_id')::uuid,(p->>'route_id')::uuid,p->>'batch_reference',(p->>'fee_minor')::bigint,(p->>'net_minor')::bigint,(p->>'deposit_minor')::bigint,p->>'statement_reference',state,actor)returning id into identifier;
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,actor,'nmi.batch.reconciled',identifier,jsonb_build_object('state',state));return jsonb_build_object('id',identifier,'state',state);
 end if;
 if a='operations'then
  perform private.giving_payload(p,array['actor_id']);if not private.nmi_giving_actor(o,actor,'payments.view')then raise exception 'Current finance view denied'using errcode='42501';end if;
  return jsonb_build_object('sandbox',true,'enabled',coalesce((select enabled from private.nmi_giving_control where organization_id=o),false),
   'attempts',(select coalesce(jsonb_agg(x),'[]')from(select jsonb_build_object('id',a.id,'session_id',a.session_id,'leg_id',op.leg_id,'operation',op.operation,'state',a.state,'amount_minor',op.amount_minor::text,'currency',l.currency,'route_label',l.route_snapshot->>'route_label','instruction_id',a.instruction_id,'refund_id',op.refund_id,'created_at',a.created_at,'has_lookup_reference',a.provider_reference is not null) x from private.nmi_giving_attempts a join private.payments_operations op on op.id=a.id join public.giving_transaction_legs l on l.id=op.leg_id where a.organization_id=o order by a.created_at desc limit 200)rows),
   'recurring',(select coalesce(jsonb_agg(jsonb_build_object('instruction_id',instruction_id,'session_id',session_id,'leg_id',leg_id,'state',status)),'[]')from private.nmi_giving_subscriptions where organization_id=o),
   'batches',(select coalesce(jsonb_agg(snapshot),'[]')from private.nmi_giving_batches where organization_id=o),
   'jobs',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'state',status)),'[]')from private.payment_ops_jobs where organization_id=o and status in('held','review')),
   'held_receipts',(select count(*)from private.nmi_giving_receipt_outbox where organization_id=o));
 end if;
 if a in('batch_scope','batch_record')then
  if not private.nmi_giving_actor(o,actor,'payments.reconcile')then raise exception 'Current reconciliation authority denied'using errcode='42501';end if;
  select * into route from private.payments_nmi_routes where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and route_id=(p->>'route_id')::uuid;
  if route.route_id is null or not private.nmi_giving_recovery_route_ok(o,route.route_id)then raise exception 'Batch route unverified';end if;
  select * into account from private.payments_nmi_accounts where organization_id=o and gateway_id=route.gateway_id;
  if a='batch_scope'then
   perform private.giving_payload(p,array['actor_id','gateway_id','route_id']);
   return jsonb_build_object('organization_id',o,'gateway_id',route.gateway_id,'route_id',route.route_id,'processor_id',route.processor_id,'provider','nmi','environment','sandbox','currency','USD','secret_version',account.secret_version,'route_verified',true);
  end if;
  perform private.giving_payload(p,array['actor_id','gateway_id','route_id','snapshot']);result:=p->'snapshot';
  perform private.giving_payload(result,array['batch_reference','date','currency','processor_id','complete','items','gross_minor','fee_minor','net_minor']);
  if result->>'processor_id' is distinct from route.processor_id or result->>'currency'<>'USD'or result->>'complete'<>'true'or result->>'batch_reference'!~'^[A-Za-z0-9_-]{1,120}$'or jsonb_typeof(result->'items')<>'array'or jsonb_array_length(result->'items')>1000 then raise exception 'Invalid bounded batch evidence';end if;
  count_items:=jsonb_array_length(result->'items');
  for item in select value from jsonb_array_elements(result->'items')loop
   perform private.giving_payload(item,array['provider_reference','gross_minor','currency']);
   if item->>'gross_minor'!~'^[0-9]{1,13}$'or item->>'currency'<>'USD'then raise exception 'Exact batch money required';end if;
   total:=total+(item->>'gross_minor')::bigint;
   select * into leg from public.giving_transaction_legs where organization_id=o and route_snapshot->>'gateway_id'=route.gateway_id::text and route_snapshot->>'processor_route_id'=route.route_id::text and provider_reference=item->>'provider_reference';
   if leg.id is not null and leg.status in('captured','settled')and leg.amount_minor=(item->>'gross_minor')::bigint and exists(select 1 from public.giving_ledger where leg_id=leg.id and kind='gift')then matched:=matched+1;end if;
  end loop;
  if total is distinct from(result->>'gross_minor')::bigint or (select count(distinct x->>'provider_reference')from jsonb_array_elements(result->'items')x)<>count_items then raise exception 'Batch totals/identity conflict';end if;
  state:=case when count_items>0 and matched=count_items then 'gross_matched_fees_unverified'else 'attention'end;
  result:=result||jsonb_build_object('state',state,'matched_transactions',matched,'fee_minor',null,'net_minor',null,'sandbox',true);
  computed_digest:=encode(sha256(convert_to(result::text,'UTF8')),'hex');
  if exists(select 1 from private.nmi_giving_batches where gateway_id=route.gateway_id and route_id=route.route_id and batch_reference=result->>'batch_reference'and nmi_giving_batches.digest<>computed_digest)then raise exception 'Immutable batch conflict'using errcode='PT409';end if;
  insert into private.nmi_giving_batches(organization_id,gateway_id,route_id,batch_reference,digest,snapshot)values(o,route.gateway_id,route.route_id,result->>'batch_reference',computed_digest,result)on conflict do nothing;
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,actor,'nmi.batch.observed',route.route_id,jsonb_build_object('state',state,'transactions',count_items));return result;
 end if;
 select * into account from private.payments_nmi_accounts where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and environment='sandbox'and last_verified_at is not null;
 if account.gateway_id is null then raise exception 'Webhook account unverified';end if;
 if a='webhook_scope'then perform private.giving_payload(p,array['gateway_id']);return jsonb_build_object('merchant_reference',account.merchant_reference);end if;
 perform private.giving_payload(p,array['gateway_id','event_id','digest','merchant_reference','processor_id','provider_reference','kind','status','subscription_reference']);
 if p->>'digest'!~'^[a-f0-9]{64}$'or p->>'merchant_reference'is distinct from account.merchant_reference or p->>'provider_reference'!~'^[A-Za-z0-9_-]{1,120}$'then raise exception 'Verified scoped webhook required';end if;
 select ev.digest into computed_digest from private.nmi_giving_events ev where gateway_id=account.gateway_id and event_id=p->>'event_id';
 if found then if computed_digest<>p->>'digest'then raise exception 'Webhook replay conflict'using errcode='PT409';end if;return jsonb_build_object('duplicate',true);end if;
 insert into private.nmi_giving_events(gateway_id,event_id,digest,organization_id,provider_reference,kind)values(account.gateway_id,p->>'event_id',p->>'digest',o,p->>'provider_reference',p->>'kind');
 if p->>'kind'<>'transaction'then return jsonb_build_object('accepted',true,'financial_posting',false);end if;
 select a.* into attempt from private.nmi_giving_attempts a join private.payments_operations op on op.id=a.id where a.organization_id=o and op.gateway_id=account.gateway_id and a.provider_reference=p->>'provider_reference'order by a.created_at limit 1;
 if attempt.id is null and p->>'subscription_reference'is not null then
  select * into sub from private.nmi_giving_subscriptions where organization_id=o and gateway_id=account.gateway_id and provider_reference=p->>'subscription_reference';
  if sub.instruction_id is not null then
   select * into route from private.payments_nmi_routes where organization_id=o and route_id=sub.route_id and gateway_id=account.gateway_id and processor_id=p->>'processor_id';
   if route.route_id is null or not private.nmi_giving_recovery_route_ok(o,route.route_id)then raise exception 'Recurring event route mismatch';end if;
   select session_id,leg_id into sid,lid from private.nmi_giving_recurring_charges where gateway_id=account.gateway_id and provider_reference=p->>'provider_reference';
   if sid is null then
    select * into original from public.giving_sessions where organization_id=o and id=sub.session_id;select * into context from private.nmi_giving_checkouts where session_id=original.id;
    select sum(amount_minor)into total from public.giving_recurring_lines where instruction_id=sub.instruction_id and route_snapshot->>'processor_route_id'=sub.route_id::text;
    insert into public.giving_sessions(organization_id,person_id,household_id,currency,intended_minor,source,request_key)values(o,original.person_id,original.household_id,original.currency,total,'nmi_sandbox',gen_random_uuid())returning id into sid;
    select * into leg from public.giving_transaction_legs where id=sub.leg_id;
    insert into public.giving_transaction_legs(organization_id,session_id,amount_minor,route_snapshot,route_key,currency)values(o,sid,total,leg.route_snapshot,leg.route_key,leg.currency)returning id into lid;
    insert into public.giving_session_lines(organization_id,session_id,leg_id,fund_id,amount_minor,route_snapshot,tax_eligible,payment_purpose)
     select o,sid,lid,r.fund_id,r.amount_minor,r.route_snapshot,coalesce(r.nmi_tax_eligible,false),coalesce(r.route_snapshot->>'payment_purpose','charitable_contribution')from public.giving_recurring_lines r join public.giving_funds f on f.id=r.fund_id and f.organization_id=o where r.instruction_id=sub.instruction_id and r.route_snapshot->>'processor_route_id'=sub.route_id::text;
    insert into private.nmi_giving_checkouts(organization_id,session_id,form_id,capability_hash,payload_digest,duplicate_digest,network_hash,receipt_email,donor_name,frequency)
     values(o,sid,context.form_id,p->>'digest',p->>'digest',p->>'digest',p->>'digest',context.receipt_email,context.donor_name,'once');
    insert into private.nmi_giving_recurring_charges(organization_id,gateway_id,provider_reference,instruction_id,session_id,leg_id)values(o,account.gateway_id,p->>'provider_reference',sub.instruction_id,sid,lid);
   end if;
  end if;
 elsif attempt.id is not null then
  sid:=attempt.session_id;select leg_id into lid from private.payments_operations where id=attempt.id;
 end if;
 if sid is null then return jsonb_build_object('accepted',true,'unmatched',true,'financial_posting',false);end if;
 select * into leg from public.giving_transaction_legs where organization_id=o and id=lid;
 select * into route from private.payments_nmi_routes where organization_id=o and route_id=(leg.route_snapshot->>'processor_route_id')::uuid and gateway_id=account.gateway_id and processor_id=p->>'processor_id';
 if route.route_id is null then raise exception 'Event route mismatch';end if;
 insert into private.payments_operations(organization_id,leg_id,gateway_id,operation,request_key,payload_digest,amount_minor)values(o,lid,account.gateway_id,'transaction',gen_random_uuid(),p->>'digest',leg.amount_minor)returning id into identifier;
 insert into private.nmi_giving_attempts(id,organization_id,session_id,provider_reference)values(identifier,o,sid,p->>'provider_reference');
 -- A signed event schedules lookup; its status never directly updates leg/ledger.
 return jsonb_build_object('accepted',true,'lookup_id',identifier,'session_id',sid,'financial_posting',false);
end$$;
revoke all on function private.nmi_giving_service(text,uuid,jsonb),private.nmi_giving_recovery_route_ok(uuid,uuid),private.nmi_giving_recurring_ledger()from public,anon,authenticated,service_role;
grant execute on function private.nmi_giving_service(text,uuid,jsonb)to service_role;

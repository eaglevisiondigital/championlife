-- GIV-3B sandbox metadata only. No live switch/ledger finalizer is changed or enabled.
create table private.payments_nmi_accounts(
 organization_id uuid not null,gateway_id uuid primary key,environment text not null default 'sandbox' check(environment='sandbox'),
 enabled boolean not null default false,secret_version int not null default 1 check(secret_version>0),last_verified_at timestamptz,
 subscription_default_verified boolean not null default false,subscription_default_route_id uuid,gateway_timezone text,merchant_reference text,
 foreign key(organization_id,gateway_id,subscription_default_route_id)references public.giving_processor_routes(organization_id,gateway_id,id),check(not subscription_default_verified or(subscription_default_route_id is not null and gateway_timezone is not null)),
 foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),unique(organization_id,gateway_id));
create table private.payments_nmi_routes(
 organization_id uuid not null,gateway_id uuid not null,route_id uuid primary key,processor_id text not null check(processor_id ~ '^[A-Za-z0-9_-]{1,50}$'),
 enabled boolean not null default false,verified_at timestamptz,proof_reference text,
 foreign key(organization_id,gateway_id,route_id) references public.giving_processor_routes(organization_id,gateway_id,id),
 unique(gateway_id,processor_id),unique(organization_id,gateway_id,route_id));
create table private.payments_nmi_plans(
 organization_id uuid not null,gateway_id uuid not null,plan_reference text not null check(plan_reference ~ '^[A-Za-z0-9_-]{1,50}$'),frequency text not null check(frequency in('weekly','biweekly','monthly','annual')),
 amount_minor bigint not null check(amount_minor>0),currency text not null check(currency ~ '^[A-Z]{3}$'),verified_at timestamptz not null,proof_reference text not null,
 primary key(gateway_id,plan_reference),foreign key(organization_id,gateway_id)references private.payments_nmi_accounts(organization_id,gateway_id));
create table private.payments_nmi_sessions(
 organization_id uuid not null,session_id uuid primary key,enabled boolean not null default false,
 foreign key(organization_id,session_id)references public.giving_sessions(organization_id,id));
create table private.payments_nmi_attempts(
 id uuid primary key references private.payments_operations(id),organization_id uuid not null,actor_id uuid not null references auth.users(id),
 session_id uuid not null,route_id uuid not null,processor_id text not null,method_id uuid references private.payments_methods(id),
 instruction_id uuid references public.giving_recurring_instructions(id),plan_reference text,save_method boolean not null default false,
 state text not null default 'prepared' check(state in('prepared','claimed','dispatched','completed','failed','review')),lease uuid,
 expires_at timestamptz not null default now()+interval '10 minutes',created_at timestamptz not null default now(),
 foreign key(organization_id,session_id)references public.giving_sessions(organization_id,id),foreign key(organization_id,route_id)references public.giving_processor_routes(organization_id,id));
create index payments_nmi_attempts_scope on private.payments_nmi_attempts(organization_id,session_id,created_at);
create table private.payments_nmi_observations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null references private.payments_nmi_attempts(id),
 provider_reference text check(provider_reference ~ '^[A-Za-z0-9_-]{1,120}$'),status text not null check(status in('pending','tokenized','authorized','captured','settled','failed','voided','partially_refunded','refunded','review')),
 category text check(category=any(array['declined','insufficient_funds','invalid_payment_method','expired_card','processor_unavailable','fraud_review','routing_error','configuration_error','duplicate','unknown'])),
 amount_minor bigint,created_at timestamptz not null default now());
create index payments_nmi_observations_attempt on private.payments_nmi_observations(attempt_id,created_at);
create table private.payments_nmi_vaults(
 organization_id uuid not null,gateway_id uuid not null,method_id uuid primary key,person_id uuid not null,provider_reference text not null check(provider_reference ~ '^[A-Za-z0-9_-]{1,120}$'),
 initial_transaction_reference text,active boolean not null default true,
 foreign key(organization_id,gateway_id)references public.giving_gateway_accounts(organization_id,id),foreign key(organization_id,person_id,method_id)references private.payments_methods(organization_id,person_id,id),unique(gateway_id,provider_reference));
create table private.payments_nmi_vault_routes(
 organization_id uuid not null,gateway_id uuid not null,method_id uuid not null,route_id uuid not null,verified_at timestamptz,proof_reference text not null,allowed_for_test boolean not null default false,
 primary key(method_id,route_id),foreign key(method_id)references private.payments_nmi_vaults(method_id),foreign key(organization_id,gateway_id,route_id)references private.payments_nmi_routes(organization_id,gateway_id,route_id));
create table private.payments_nmi_subscriptions(
 organization_id uuid not null,instruction_id uuid not null,route_id uuid not null,provider_reference text not null,
 attempt_id uuid not null references private.payments_nmi_attempts(id),created_at timestamptz not null default now(),
 primary key(instruction_id,route_id),foreign key(organization_id,instruction_id)references public.giving_recurring_instructions(organization_id,id),foreign key(organization_id,route_id)references public.giving_processor_routes(organization_id,id));
create table private.payments_nmi_events(
 organization_id uuid not null,gateway_id uuid not null,event_id text not null,event_digest text not null check(event_digest ~ '^[a-f0-9]{64}$'),
 attempt_id uuid references private.payments_nmi_attempts(id),status text not null default 'review',created_at timestamptz not null default now(),
 primary key(gateway_id,event_id),foreign key(organization_id,gateway_id)references public.giving_gateway_accounts(organization_id,id));
create table private.payments_nmi_batches(
 organization_id uuid not null,gateway_id uuid not null,route_id uuid not null,batch_reference text not null,settlement_date date,
 gross_minor bigint,fee_minor bigint,net_minor bigint,transaction_count int,status text not null default 'review',digest text not null,
 primary key(gateway_id,route_id,batch_reference),foreign key(organization_id,gateway_id,route_id)references public.giving_processor_routes(organization_id,gateway_id,id),check(gross_minor is null or gross_minor>=0),check(transaction_count is null or transaction_count>=0),check(fee_minor is null or fee_minor>=0),check(net_minor is null or gross_minor is not null and fee_minor is not null and net_minor=gross_minor-fee_minor));
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='private'and tablename like 'payments_nmi_%'loop
 execute format('alter table private.%I enable row level security',r.tablename);execute format('revoke all on private.%I from public,anon,authenticated,service_role',r.tablename);end loop;
end$$;
create trigger payments_nmi_observations_immutable before update or delete on private.payments_nmi_observations for each row execute function private.giving_immutable();
create trigger payments_nmi_events_immutable before update or delete on private.payments_nmi_events for each row execute function private.giving_immutable();
create trigger payments_nmi_subscriptions_immutable before update or delete on private.payments_nmi_subscriptions for each row execute function private.giving_immutable();
create trigger payments_nmi_batches_immutable before update or delete on private.payments_nmi_batches for each row execute function private.giving_immutable();
create function private.payments_nmi_authorized(o uuid,u uuid,k text,s uuid)returns boolean language sql stable security definer set search_path=''as $$
select private.outreach_verified(u)and(exists(select 1 from private.effective_staff_permissions g where g.organization_id=o and g.user_id=u and g.permission=k)or(k='payments.configure'and exists(select 1 from private.giving_donor_account_links d join public.giving_sessions gs on gs.person_id=d.person_id and gs.organization_id=d.organization_id where d.organization_id=o and d.user_id=u and d.active and gs.id=s)))$$;
create function private.payments_nmi_gate(o uuid,s uuid,r uuid)returns boolean language sql stable security definer set search_path=''as $$
select exists(select 1 from private.payments_nmi_sessions c join public.giving_sessions gs on gs.id=c.session_id join public.giving_transaction_legs l on l.session_id=gs.id join private.payments_nmi_routes route on route.route_id=(l.route_snapshot->>'processor_route_id')::uuid and route.organization_id=l.organization_id join private.payments_nmi_accounts account on account.gateway_id=route.gateway_id and account.organization_id=route.organization_id join public.giving_gateway_accounts g on g.id=account.gateway_id where c.organization_id=o and c.session_id=s and c.enabled and gs.status<>'cancelled'and l.organization_id=o and route.route_id=r and route.enabled and route.verified_at is not null and route.proof_reference is not null and account.enabled and account.last_verified_at is not null and account.environment='sandbox'and exists(select 1 from public.giving_processor_routes gr where gr.id=route.route_id and gr.organization_id=o and gr.gateway_id=g.id and gr.environment='sandbox'and gr.currency=l.currency and gr.active)and g.environment='sandbox'and g.provider='nmi'and l.route_snapshot->>'environment'='sandbox')$$;
create function private.payments_nmi_workspace(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare s public.giving_sessions;l public.giving_transaction_legs;op private.payments_operations;v private.payments_nmi_vaults;r private.payments_nmi_routes;key uuid;id uuid;perm text;kind text;digest text;amt bigint;result jsonb;begin
 if not private.outreach_verified(auth.uid())then raise exception 'Payment access unavailable'using errcode='42501';end if;
 perform private.giving_lock(o);
 if a='configuration'then
  perform private.giving_payload(p,array[]::text[]);perform private.payments_require(o,'payments.view');
  return jsonb_build_object('environment','sandbox','global_live_enabled',false,'accounts',(select coalesce(jsonb_agg(jsonb_build_object('gateway_id',c.gateway_id,'enabled',c.enabled,'last_verified',c.last_verified_at,'subscription_default_verified',c.subscription_default_verified,'routes',(select count(*)from private.payments_nmi_routes x where x.gateway_id=c.gateway_id and x.verified_at is not null))),'[]')from private.payments_nmi_accounts c where organization_id=o));
 end if;
 select * into s from public.giving_sessions where organization_id=o and id=(p->>'session_id')::uuid;
 if not found then raise exception 'Sandbox checkout unavailable'using errcode='42501';end if;
 if a='session'then
  perform private.giving_payload(p,array['session_id']);if not private.payments_nmi_authorized(o,auth.uid(),'payments.configure',s.id)and not private.giving_authorized(o,'payments.view')then raise exception 'Sandbox checkout unavailable'using errcode='42501';end if;
  result:=private.payments_session_view(o,s.id);
  return result||jsonb_build_object('sandbox_only',true,'can_prepare',private.payments_nmi_authorized(o,auth.uid(),'payments.configure',s.id),'sandbox_ready',(select bool_and(private.payments_nmi_gate(o,s.id,(route_snapshot->>'processor_route_id')::uuid))from public.giving_transaction_legs where organization_id=o and session_id=s.id),'methods',(select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'brand',m.brand,'last4',m.last4)),'[]')from private.payments_methods m join private.payments_nmi_vaults v on v.method_id=m.id where m.organization_id=o and m.person_id=s.person_id and m.status<>'removed'and v.active),'attempts',(select coalesce(jsonb_agg(jsonb_build_object('id',n.id,'state',n.state,'operation',x.operation,'leg_id',x.leg_id)),'[]')from private.payments_nmi_attempts n join private.payments_operations x on x.id=n.id where n.organization_id=o and n.session_id=s.id));
 end if;
 if a<>'prepare'then raise exception 'Unknown sandbox action';end if;
 perform private.giving_payload(p,array['session_id','leg_id','operation','request_key','method_id','refund_id','instruction_id','plan_reference','save_method']);
 kind:=p->>'operation';if kind='create_customer'and p->>'save_method'is distinct from'true'then raise exception 'Explicit saved method choice required';end if;perm:=case kind when 'refund'then 'payments.refund'when 'void'then 'payments.void'when 'create_recurring_profile'then 'payments.recurring.manage'when 'update_recurring_profile'then 'payments.recurring.manage'when 'cancel_recurring_profile'then 'payments.recurring.manage'else 'payments.configure'end;
 if not private.payments_nmi_authorized(o,auth.uid(),perm,s.id)then raise exception 'Sandbox authority unavailable'using errcode='42501';end if;
 if kind not in('sale','authorize','capture','void','refund','create_customer','create_recurring_profile','update_recurring_profile','cancel_recurring_profile','retrieve_transaction')then raise exception 'Unsupported sandbox operation';end if;
 select * into l from public.giving_transaction_legs where organization_id=o and session_id=s.id and id=(p->>'leg_id')::uuid;
 if not found or not private.payments_nmi_gate(o,s.id,(l.route_snapshot->>'processor_route_id')::uuid)then raise exception 'Sandbox route held'using errcode='42501';end if;
 if kind in('sale','authorize','create_customer')and s.expires_at<=now()then raise exception 'Sandbox checkout expired';end if;
 select * into r from private.payments_nmi_routes where route_id=(l.route_snapshot->>'processor_route_id')::uuid;amt:=l.amount_minor;
 if kind in('capture','void','refund','retrieve_transaction')and l.provider_reference is null then raise exception 'Original provider transaction required';end if;
 if kind='capture'and l.status<>'authorized'or kind='void'and l.status not in('authorized','captured')then raise exception 'Transaction state unavailable';end if;
 if kind='refund'and l.status not in('settled','partially_refunded')then raise exception 'Sandbox refund requires confirmed settlement';end if;
 if kind='refund'then select amount_minor into amt from public.giving_refunds where organization_id=o and id=(p->>'refund_id')::uuid and leg_id=l.id and kind='refund'and status='requested';if not found then raise exception 'Original refund required';end if;end if;
 if p->>'method_id'is not null then
  select * into v from private.payments_nmi_vaults where organization_id=o and gateway_id=r.gateway_id and method_id=(p->>'method_id')::uuid and person_id=s.person_id and active;
  if not found or not exists(select 1 from private.payments_methods m join private.payments_nmi_vault_routes vr on vr.method_id=m.id where m.id=v.method_id and m.status<>'removed'and vr.route_id=r.route_id and vr.organization_id=o and vr.gateway_id=r.gateway_id and vr.allowed_for_test)then raise exception 'Saved method route unavailable'using errcode='42501';end if;
 end if;
 if kind like '%recurring_profile'then
  if not exists(select 1 from public.giving_recurring_instructions i where i.id=(p->>'instruction_id')::uuid and i.organization_id=o and i.person_id=s.person_id)then raise exception 'Canonical recurring instruction required';end if;
  select sum(amount_minor)into amt from public.giving_recurring_lines where organization_id=o and instruction_id=(p->>'instruction_id')::uuid and route_snapshot->>'processor_route_id'=r.route_id::text;
  if amt is null then raise exception 'Recurring route unavailable';end if;
  if kind='create_recurring_profile'and not exists(select 1 from private.payments_nmi_plans plan join public.giving_recurring_instructions i on i.id=(p->>'instruction_id')::uuid where plan.organization_id=o and plan.gateway_id=r.gateway_id and plan.plan_reference=p->>'plan_reference'and plan.frequency=i.frequency and plan.currency=i.currency and plan.amount_minor=amt)then raise exception 'Verified canonical subscription plan binding required';end if;
 end if;
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Idempotency key required';end if;digest:=encode(sha256(convert_to(p::text,'UTF8')),'hex');
 select * into op from private.payments_operations where organization_id=o and request_key=key and operation=case kind when 'create_customer'then 'customer'when 'create_recurring_profile'then 'recurring_create'when 'update_recurring_profile'then 'recurring_update'when 'cancel_recurring_profile'then 'recurring_cancel'when 'retrieve_transaction'then 'transaction'else kind end;
 if found then if op.payload_digest<>digest then raise exception 'Sandbox retry conflict'using errcode='PT409';end if;return jsonb_build_object('id',op.id,'state',(select state from private.payments_nmi_attempts where id=op.id));end if;
 if kind='refund'and exists(select 1 from private.payments_nmi_attempts n join private.payments_operations x on x.id=n.id where n.organization_id=o and x.refund_id=(p->>'refund_id')::uuid)then raise exception 'Original sandbox refund requires reconciliation'using errcode='PT409';end if;
 if kind='create_customer'and exists(select 1 from private.payments_nmi_attempts n join private.payments_operations x on x.id=n.id where x.leg_id=l.id and x.operation='customer'and n.state<>'failed')then raise exception 'Original vault creation requires reconciliation'using errcode='PT409';end if;
 if kind='create_recurring_profile'and exists(select 1 from private.payments_nmi_attempts n join private.payments_operations x on x.id=n.id where n.instruction_id=(p->>'instruction_id')::uuid and n.route_id=r.route_id and x.operation='recurring_create'and n.state<>'failed')then raise exception 'Original subscription creation requires reconciliation'using errcode='PT409';end if;
 -- One unresolved charge per leg across different client keys; unknown results cannot be blindly retried.
 if kind in('sale','authorize')and exists(select 1 from private.payments_nmi_attempts n join private.payments_operations x on x.id=n.id where x.leg_id=l.id and x.operation in('sale','authorize')and n.state<>'failed')then raise exception 'Original sandbox attempt requires reconciliation'using errcode='PT409';end if;
 insert into private.payments_operations(organization_id,leg_id,gateway_id,operation,request_key,payload_digest,amount_minor,refund_id)values(o,l.id,r.gateway_id,case kind when 'create_customer'then 'customer'when 'create_recurring_profile'then 'recurring_create'when 'update_recurring_profile'then 'recurring_update'when 'cancel_recurring_profile'then 'recurring_cancel'when 'retrieve_transaction'then 'transaction'else kind end,key,digest,amt,(p->>'refund_id')::uuid)returning payments_operations.id into id;
 insert into private.payments_nmi_attempts(id,organization_id,actor_id,session_id,route_id,processor_id,method_id,instruction_id,plan_reference,save_method)values(id,o,auth.uid(),s.id,r.route_id,r.processor_id,v.method_id,(p->>'instruction_id')::uuid,p->>'plan_reference',coalesce((p->>'save_method')::boolean,false));
 perform private.giving_audit_event(o,'payments.nmi.sandbox.prepared',id,jsonb_build_object('operation',kind));return jsonb_build_object('id',id,'state','prepared');
end$$;
create function private.payments_nmi_service(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare n private.payments_nmi_attempts;x private.payments_operations;l public.giving_transaction_legs;c private.payments_nmi_accounts;v private.payments_nmi_vaults;u uuid;perm text;id uuid;st text;event private.payments_nmi_events;ref text;batch_digest text;begin
 if current_setting('role',true)<>'service_role'then raise exception 'Sandbox service required'using errcode='42501';end if;perform private.giving_lock(o);
 if a='webhook'then
  perform private.giving_payload(p,array['gateway_id','event_id','digest','provider_reference','processor_id','status','merchant_reference','kind','gross_minor','transaction_count']);
  select * into event from private.payments_nmi_events where gateway_id=(p->>'gateway_id')::uuid and event_id=p->>'event_id';
  if found then if event.event_digest<>p->>'digest'then raise exception 'Webhook replay conflict'using errcode='PT409';end if;return jsonb_build_object('duplicate',true);end if;
  if not exists(select 1 from private.payments_nmi_accounts where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and enabled and merchant_reference=p->>'merchant_reference')then raise exception 'Sandbox event owner unavailable'using errcode='42501';end if;
  if p->>'kind'='batch'then
   if not exists(select 1 from private.payments_nmi_routes where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and processor_id=p->>'processor_id'and verified_at is not null)then raise exception 'Batch route unavailable';end if;
   batch_digest:=encode(sha256(convert_to(jsonb_build_object('organization_id',o,'gateway_id',p->>'gateway_id','processor_id',p->>'processor_id','batch_reference',p->>'provider_reference','gross_minor',(p->>'gross_minor')::bigint,'transaction_count',(p->>'transaction_count')::int,'status',p->>'status')::text,'UTF8')),'hex');
   if exists(select 1 from private.payments_nmi_batches b join private.payments_nmi_routes r on r.route_id=b.route_id where b.organization_id=o and b.gateway_id=(p->>'gateway_id')::uuid and r.processor_id=p->>'processor_id'and b.batch_reference=p->>'provider_reference'and b.digest<>batch_digest)then raise exception 'Settlement observation conflict'using errcode='PT409';end if;
   insert into private.payments_nmi_batches(organization_id,gateway_id,route_id,batch_reference,gross_minor,transaction_count,status,digest)select o,gateway_id,route_id,p->>'provider_reference',(p->>'gross_minor')::bigint,(p->>'transaction_count')::int,p->>'status',batch_digest from private.payments_nmi_routes where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and processor_id=p->>'processor_id'on conflict do nothing;
   insert into private.payments_nmi_events(organization_id,gateway_id,event_id,event_digest,status)values(o,(p->>'gateway_id')::uuid,p->>'event_id',p->>'digest',p->>'status');return jsonb_build_object('accepted',true,'reconciliation','review');
  elsif p->>'kind'='subscription'then
   select attempts.* into n from private.payments_nmi_subscriptions sub join private.payments_nmi_attempts attempts on attempts.id=sub.attempt_id join private.payments_operations op on op.id=attempts.id where sub.organization_id=o and sub.provider_reference=p->>'provider_reference'and op.gateway_id=(p->>'gateway_id')::uuid;
   if not found then raise exception 'Subscription event unavailable';end if;
   insert into private.payments_nmi_events(organization_id,gateway_id,event_id,event_digest,attempt_id,status)values(o,(p->>'gateway_id')::uuid,p->>'event_id',p->>'digest',n.id,p->>'status');return jsonb_build_object('accepted',true,'reconciliation','review');
  elsif p->>'kind'<>'transaction'then raise exception 'Unsupported gateway event';end if;
  select attempts.* into n from private.payments_nmi_attempts attempts join private.payments_operations op on op.id=attempts.id join public.giving_transaction_legs leg on leg.id=op.leg_id where attempts.organization_id=o and op.gateway_id=(p->>'gateway_id')::uuid and leg.provider_reference=p->>'provider_reference'and attempts.processor_id=p->>'processor_id'order by attempts.created_at limit 1;
  if not found then raise exception 'Sandbox event transaction unavailable'using errcode='42501';end if;
  insert into private.payments_nmi_events(organization_id,gateway_id,event_id,event_digest,attempt_id,status)values(o,(p->>'gateway_id')::uuid,p->>'event_id',p->>'digest',n.id,p->>'status');
  perform private.giving_audit_event(o,'payments.nmi.sandbox.webhook',n.id,jsonb_build_object('status',p->>'status'));return jsonb_build_object('accepted',true,'reconciliation','review');
 end if;
 select * into n from private.payments_nmi_attempts where id=(p->>'id')::uuid and organization_id=o for update;if not found then raise exception 'Sandbox attempt unavailable'using errcode='42501';end if;
 select * into x from private.payments_operations where id=n.id;select * into l from public.giving_transaction_legs where id=x.leg_id;
 perm:=case x.operation when 'refund'then 'payments.refund'when 'void'then 'payments.void'when 'recurring_create'then 'payments.recurring.manage'when 'recurring_update'then 'payments.recurring.manage'when 'recurring_cancel'then 'payments.recurring.manage'else 'payments.configure'end;
 if a in('claim','handoff')then
  perform private.giving_payload(p,array['id','actor_id','lease']);
  if n.actor_id is distinct from (p->>'actor_id')::uuid or not private.payments_nmi_authorized(o,n.actor_id,perm,n.session_id)or not private.payments_nmi_gate(o,n.session_id,n.route_id)or n.processor_id is distinct from(select processor_id from private.payments_nmi_routes where route_id=n.route_id and gateway_id=x.gateway_id and organization_id=o)or n.expires_at<=now()then raise exception 'Sandbox current authority unavailable'using errcode='42501';end if;
  if a='claim'then if n.state<>'prepared'then return jsonb_build_object('claimed',false,'state',n.state);end if;u:=gen_random_uuid();update private.payments_nmi_attempts set state='claimed',lease=u where payments_nmi_attempts.id=n.id;n.lease:=u;
  else if n.state<>'claimed'or n.lease is distinct from (p->>'lease')::uuid then raise exception 'Sandbox lease unavailable'using errcode='PT409';end if;update private.payments_nmi_attempts set state='dispatched'where payments_nmi_attempts.id=n.id;end if;
  select * into c from private.payments_nmi_accounts where gateway_id=x.gateway_id and organization_id=o;
  select * into v from private.payments_nmi_vaults where method_id=n.method_id and active;
  if n.method_id is not null and(not found or not exists(select 1 from private.payments_methods where id=n.method_id and status<>'removed')or not exists(select 1 from private.payments_nmi_vault_routes where method_id=n.method_id and route_id=n.route_id and organization_id=o and gateway_id=x.gateway_id and allowed_for_test))then raise exception 'Sandbox method revoked'using errcode='42501';end if;
  return jsonb_build_object('claimed',true,'lease',n.lease,'actor_id',n.actor_id,'scope',jsonb_build_object('organization_id',o,'gateway_id',x.gateway_id,'provider','nmi','environment','sandbox','secret_version',c.secret_version,'route_id',n.route_id,'processor_id',n.processor_id,'route_verified',true,'vault_route_authorized',v.active,'currency',l.currency,'subscription_default_verified',c.subscription_default_verified and c.subscription_default_route_id=n.route_id),'operation',case x.operation when 'customer'then 'create_customer'when 'recurring_create'then 'create_recurring_profile'when 'recurring_update'then 'update_recurring_profile'when 'recurring_cancel'then 'cancel_recurring_profile'when 'transaction'then 'retrieve_transaction'else x.operation end,'amount_minor',x.amount_minor::text,'transaction_reference',l.provider_reference,'vault_reference',v.provider_reference,'initial_transaction_id',v.initial_transaction_reference,'customer_id',n.id,'save_method',n.save_method,'plan_reference',n.plan_reference,'subscription_reference',(select provider_reference from private.payments_nmi_subscriptions where instruction_id=n.instruction_id and route_id=n.route_id),'start_date',(select to_char(next_run_at at time zone c.gateway_timezone,'YYYYMMDD')from public.giving_recurring_instructions where id=n.instruction_id));
 elsif a='complete'then
  perform private.giving_payload(p,array['id','lease','status','category','provider_reference','customer_reference','last4','brand','amount_minor']);
  if n.state<>'dispatched'or n.lease is distinct from (p->>'lease')::uuid then raise exception 'Sandbox outcome lease unavailable'using errcode='PT409';end if;
  st:=p->>'status';ref:=p->>'provider_reference';if ref is not null and ref!~ '^[A-Za-z0-9_-]{1,120}$'then raise exception 'Safe provider identity required';end if;
  if p->>'amount_minor'is not null and (p->>'amount_minor')::bigint<>x.amount_minor then st:='review';end if;
  insert into private.payments_nmi_observations(organization_id,attempt_id,provider_reference,status,category,amount_minor)values(o,n.id,ref,st,p->>'category',(p->>'amount_minor')::bigint);
  update private.payments_nmi_attempts set state=case st when 'failed'then 'failed'when 'review'then 'review'else 'completed'end where id=n.id;
  if x.operation in('sale','authorize')and st='failed'then update public.giving_transaction_legs set status='failed'where id=l.id;end if;
  if x.operation in('sale','authorize','capture')and st in('authorized','captured','settled')and ref is not null then
   update public.giving_transaction_legs set status=st,provider_reference=coalesce(provider_reference,ref)where id=l.id;
   if n.method_id is not null then update private.payments_nmi_vault_routes set verified_at=now(),proof_reference=ref where method_id=n.method_id and route_id=n.route_id and organization_id=o and gateway_id=x.gateway_id;end if;
   update private.payments_nmi_vaults set initial_transaction_reference=coalesce(initial_transaction_reference,ref)where method_id=n.method_id and active;
  end if;
  if x.operation='transaction'and st in('authorized','captured','settled','failed','voided','partially_refunded','refunded')and ref=l.provider_reference then update public.giving_transaction_legs set status=st where id=l.id;end if;
  if x.operation in('refund','void')and st in('refunded','voided')then
   if x.operation='refund'and(select coalesce(sum(obs.amount_minor),0)from private.payments_nmi_observations obs join private.payments_operations op on op.id=obs.attempt_id where op.organization_id=o and op.leg_id=l.id and op.operation='refund'and obs.status='refunded')<l.amount_minor then st:='partially_refunded';end if;
   update public.giving_transaction_legs set status=st where id=l.id;
  end if;
  if n.save_method and st in('tokenized','authorized','captured','settled')and p->>'customer_reference'is not null and p->>'last4'~ '^\d{4}$'and p->>'brand'=any(array['Visa','Mastercard','American Express','Discover','Bank','Other'])then
   if p->>'customer_reference'!~ '^[A-Za-z0-9_-]{1,120}$'then raise exception 'Safe vault reference required';end if;
   select method_id into id from private.payments_nmi_vaults where gateway_id=x.gateway_id and provider_reference=p->>'customer_reference';
   if id is not null and not exists(select 1 from private.payments_nmi_vaults where method_id=id and organization_id=o and person_id=(select person_id from public.giving_sessions where id=n.session_id))then raise exception 'Vault owner conflict'using errcode='42501';end if;
   if id is null then
    insert into private.payments_methods(organization_id,person_id,brand,last4,status)values(o,(select person_id from public.giving_sessions where id=n.session_id),p->>'brand',p->>'last4','held')returning payments_methods.id into id;
    insert into private.payments_nmi_vaults(organization_id,gateway_id,method_id,person_id,provider_reference,initial_transaction_reference)values(o,x.gateway_id,id,(select person_id from public.giving_sessions where id=n.session_id),p->>'customer_reference',case when x.operation in('sale','authorize')then ref end);
    insert into private.payments_nmi_vault_routes(organization_id,gateway_id,method_id,route_id,verified_at,proof_reference,allowed_for_test)values(o,x.gateway_id,id,n.route_id,null,'Initial scoped sandbox test; portability unverified',true);
   end if;
  end if;
  if x.operation='recurring_create'and ref is not null and st<>'failed'and st<>'review'then insert into private.payments_nmi_subscriptions values(o,n.instruction_id,n.route_id,ref,n.id,now());end if;
  if x.operation='recurring_cancel'and st='voided'and not exists(select 1 from private.payments_nmi_subscriptions sub where sub.instruction_id=n.instruction_id and not exists(select 1 from private.payments_nmi_attempts a join private.payments_operations op on op.id=a.id join private.payments_nmi_observations obs on obs.attempt_id=a.id where a.instruction_id=sub.instruction_id and a.route_id=sub.route_id and op.operation='recurring_cancel'and obs.status='voided'))then update public.giving_recurring_instructions set status='cancelled'where id=n.instruction_id and organization_id=o;end if;
  if x.operation in('sale','authorize','capture')then
   update public.giving_sessions set status=case
    when exists(select 1 from private.payments_nmi_attempts where session_id=n.session_id and state='review')then 'requires_attention'
    when not exists(select 1 from public.giving_transaction_legs where session_id=n.session_id and status not in('captured','settled'))then 'completed'
    when not exists(select 1 from public.giving_transaction_legs where session_id=n.session_id and status<>'failed')then 'failed'
    when exists(select 1 from public.giving_transaction_legs where session_id=n.session_id and status='failed')and exists(select 1 from public.giving_transaction_legs where session_id=n.session_id and status in('captured','settled'))then 'partially_completed'
    else 'requires_attention'end where id=n.session_id and organization_id=o;
  end if;
  insert into private.payments_journal(organization_id,operation_id,provider,route_id,state,failure_category)values(o,n.id,'nmi',n.route_id,case st when 'tokenized'then 'pending'else st end,p->>'category');
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,n.actor_id,'payments.nmi.sandbox.outcome',n.id,jsonb_build_object('status',st,'operation',x.operation));
  return jsonb_build_object('id',n.id,'status',st,'sandbox_only',true,'method_id',id,'ledger_posted',false);
 else raise exception 'Unknown sandbox service action';end if;
end$$;
create function public.payments_nmi_workspace(p_action text,p_org uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.payments_nmi_workspace(p_action,p_org,p_payload)$$;
create function public.payments_nmi_service(p_action text,p_org uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.payments_nmi_service(p_action,p_org,p_payload)$$;
revoke all on function private.payments_nmi_authorized(uuid,uuid,text,uuid),private.payments_nmi_gate(uuid,uuid,uuid),private.payments_nmi_workspace(text,uuid,jsonb),private.payments_nmi_service(text,uuid,jsonb),public.payments_nmi_workspace(text,uuid,jsonb),public.payments_nmi_service(text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function private.payments_nmi_workspace(text,uuid,jsonb),public.payments_nmi_workspace(text,uuid,jsonb)to authenticated;
grant execute on function private.payments_nmi_service(text,uuid,jsonb),public.payments_nmi_service(text,uuid,jsonb)to service_role;

create or replace function private.payments_method_summary(o uuid,person uuid default null)returns jsonb language sql stable security definer set search_path=''as $$
select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'person_id',m.person_id,'brand',m.brand,'last4',m.last4,'expiry_month',m.expiry_month,'expiry_year',m.expiry_year,'status',m.status,'gateway_count',(select count(distinct gateway_id)from(select gateway_id from private.giving_payment_profiles where organization_id=o and logical_method_id=m.id and reference_status<>'removed' union select gateway_id from private.payments_nmi_vaults where organization_id=o and method_id=m.id and active and m.status<>'removed')x))order by m.created_at),'[]')from private.payments_methods m where m.organization_id=o and(person is null or m.person_id=person)$$;

create function private.payments_nmi_method_removed()returns trigger language plpgsql security definer set search_path=''as $$begin if new.status='removed'then update private.payments_nmi_vaults set active=false where method_id=new.id and organization_id=new.organization_id;end if;return new;end$$;
revoke all on function private.payments_nmi_method_removed()from public,anon,authenticated,service_role;
create trigger payments_nmi_method_removed after update of status on private.payments_methods for each row execute function private.payments_nmi_method_removed();

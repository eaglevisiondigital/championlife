-- Dedicated isolated NMI execution. No seeds, grants, credentials or enablement.
create table private.nmi_giving_control(
 organization_id uuid primary key references public.organizations(id),enabled boolean not null default false,
 environment text not null default 'sandbox' check(environment='sandbox'),receipt_identity text not null default '',
 fallback_path text not null default '/' check(fallback_path in('/outreach-giving.html','/give.html','/')),
 revision int not null default 1
);
create table private.nmi_giving_forms(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),label text not null check(length(label) between 1 and 120),
 enabled boolean not null default false,currency text not null default 'USD' check(currency='USD'),
 min_minor bigint not null default 100 check(min_minor>0),max_minor bigint not null default 1000000,
 recurring_allowed boolean not null default false,revision int not null default 1,
 unique(organization_id,id),unique(organization_id,slug),check(max_minor>=min_minor)
);
create table private.nmi_giving_form_funds(
 organization_id uuid not null,form_id uuid not null,fund_id uuid not null,
 purpose text not null default 'charitable_contribution' check(purpose in('charitable_contribution','event_fee','merchandise')),
 primary key(form_id,fund_id),foreign key(organization_id,form_id) references private.nmi_giving_forms(organization_id,id),
 foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id)
);
create table private.nmi_giving_route_proofs(
 organization_id uuid not null,gateway_id uuid not null,route_id uuid primary key,enabled boolean not null default false,
 mid_reference text not null,settlement_reference text not null,merchant_reference text not null,
 public_tokenization_key text not null,verified_at timestamptz,proof_reference text,
 foreign key(organization_id,gateway_id,route_id) references private.payments_nmi_routes(organization_id,gateway_id,route_id),
 check(length(mid_reference) between 1 and 120),check(length(settlement_reference) between 1 and 120)
);
create table private.nmi_giving_checkouts(
 organization_id uuid not null,session_id uuid primary key,form_id uuid not null,capability_hash text not null check(capability_hash ~ '^[a-f0-9]{64}$'),
 payload_digest text not null,duplicate_digest text not null,network_hash text not null check(network_hash ~ '^[a-f0-9]{64}$'),
 receipt_email text not null check(length(receipt_email)<=254),donor_name text not null check(length(donor_name)<=120),
 actor_id uuid references auth.users(id),frequency text not null default 'once' check(frequency in('once','weekly','biweekly','monthly')),
 starts_on date,created_at timestamptz not null default now(),expires_at timestamptz not null default now()+interval '30 minutes',
 foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),
 foreign key(organization_id,form_id) references private.nmi_giving_forms(organization_id,id),unique(organization_id,session_id)
);
create index nmi_giving_duplicate on private.nmi_giving_checkouts(organization_id,duplicate_digest,created_at);
alter table private.giving_donor_account_links add column verified_household_id uuid;
alter table private.giving_donor_account_links add foreign key(organization_id,verified_household_id) references public.households(organization_id,id);
alter table public.giving_recurring_instructions alter column person_id drop not null;
alter table public.giving_recurring_instructions add column guest_session_id uuid;
alter table public.giving_recurring_instructions add foreign key(organization_id,guest_session_id) references public.giving_sessions(organization_id,id);
alter table public.giving_recurring_instructions add constraint giving_recurring_verified_or_guest check(person_id is not null or guest_session_id is not null);
alter table private.payments_operations drop constraint payments_operations_operation_check;
alter table private.payments_operations add constraint payments_operations_operation_check check(operation in('tokenization','customer','attach','authorize','capture','sale','void','refund','recurring_create','recurring_update','recurring_cancel','recurring_pause','transaction','settlement'));
create index nmi_giving_checkout_network on private.nmi_giving_checkouts(network_hash,created_at);
create index nmi_giving_checkout_duplicate on private.nmi_giving_checkouts(organization_id,duplicate_digest,created_at);
create table private.nmi_giving_attempts(
 id uuid primary key references private.payments_operations(id),organization_id uuid not null,session_id uuid not null,
 actor_id uuid references auth.users(id),parent_attempt_id uuid references private.nmi_giving_attempts(id),
 instruction_id uuid references public.giving_recurring_instructions(id),plan_reference text,provider_reference text,
 state text not null default 'prepared' check(state in('prepared','claimed','dispatched','completed','failed','review')),
 lease uuid,expires_at timestamptz not null default now()+interval '5 minutes',created_at timestamptz not null default now(),
 authority_kind text not null default 'service'check(authority_kind in('service','checkout','donor','staff')),
 save_method boolean not null default false,foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id)
);
create table private.nmi_giving_vault_bindings(
 organization_id uuid not null,session_id uuid not null,gateway_id uuid not null,route_id uuid not null,
 provider_reference text not null,consent_at timestamptz not null default now(),active boolean not null default true,
 primary key(session_id,route_id),foreign key(organization_id,session_id)references public.giving_sessions(organization_id,id),
 foreign key(organization_id,gateway_id,route_id)references public.giving_processor_routes(organization_id,gateway_id,id)
);
create table private.nmi_giving_results(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,attempt_id uuid not null references private.nmi_giving_attempts(id),
 status text not null check(status in('authorized','captured','settled','failed','voided','refunded','pending','review','active','paused','cancelled')),
 authoritative boolean not null default false,provider_reference text,amount_minor bigint,currency text,processor_id text,
 category text,created_at timestamptz not null default now()
);
create table private.nmi_giving_subscriptions(
 organization_id uuid not null,instruction_id uuid not null,route_id uuid not null,gateway_id uuid not null,
 session_id uuid not null,leg_id uuid not null,provider_reference text not null,status text not null check(status in('active','paused','cancelled')),
 primary key(instruction_id,route_id),unique(gateway_id,provider_reference),
 foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id),
 foreign key(organization_id,gateway_id,route_id) references public.giving_processor_routes(organization_id,gateway_id,id)
);
create table private.nmi_giving_receipt_outbox(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,receipt_id uuid not null references public.giving_receipts(id),
 recipient text not null,sender_identity text not null,snapshot jsonb not null,state text not null default 'held' check(state='held'),
 created_at timestamptz not null default now(),unique(receipt_id)
);
create table private.nmi_giving_events(
 gateway_id uuid not null,event_id text not null,digest text not null,organization_id uuid not null,provider_reference text not null,
 kind text not null,created_at timestamptz not null default now(),primary key(gateway_id,event_id)
);
create table private.nmi_giving_batches(
 organization_id uuid not null,gateway_id uuid not null,route_id uuid not null,batch_reference text not null,
 digest text not null,snapshot jsonb not null,created_at timestamptz not null default now(),
 primary key(gateway_id,route_id,batch_reference)
);
-- All metadata is RPC-only, including service_role: only guarded definers may read/write.
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='private' and tablename like 'nmi_giving_%' loop
 execute format('alter table private.%I enable row level security',r.tablename);
 execute format('revoke all on private.%I from public,anon,authenticated,service_role',r.tablename);
end loop;end$$;
create trigger nmi_giving_results_immutable before update or delete on private.nmi_giving_results for each row execute function private.giving_immutable();
create trigger nmi_giving_events_immutable before update or delete on private.nmi_giving_events for each row execute function private.giving_immutable();
create trigger nmi_giving_batches_immutable before update or delete on private.nmi_giving_batches for each row execute function private.giving_immutable();
create trigger nmi_giving_receipts_immutable before update or delete on private.nmi_giving_receipt_outbox for each row execute function private.giving_immutable();

alter table public.giving_recurring_lines add column nmi_tax_eligible boolean;

create function private.nmi_giving_route_fingerprint(o uuid,r uuid)returns text language sql stable security definer set search_path=''as $$
select encode(sha256(convert_to(jsonb_build_object('organization',o,'gateway',proof.gateway_id,'route',r,'processor',nr.processor_id,
 'mid',proof.mid_reference,'settlement',proof.settlement_reference,'merchant',proof.merchant_reference,'component',proof.public_tokenization_key,
 'secret_version',a.secret_version,'recurring_default',a.subscription_default_route_id,'timezone',a.gateway_timezone)::text,'UTF8')),'hex')
from private.nmi_giving_route_proofs proof join private.payments_nmi_routes nr on nr.organization_id=o and nr.gateway_id=proof.gateway_id and nr.route_id=proof.route_id
join private.payments_nmi_accounts a on a.organization_id=o and a.gateway_id=proof.gateway_id where proof.organization_id=o and proof.route_id=r
$$;
revoke all on function private.nmi_giving_route_fingerprint(uuid,uuid)from public,anon,authenticated,service_role;

create function private.nmi_giving_route_ok(o uuid,r uuid)returns boolean language sql stable security definer set search_path=''as $$
select exists(select 1 from private.nmi_giving_control c join private.nmi_giving_route_proofs proof on proof.organization_id=c.organization_id
 join private.payments_nmi_routes nr on nr.route_id=proof.route_id and nr.gateway_id=proof.gateway_id and nr.organization_id=o
 join private.payments_nmi_accounts a on a.gateway_id=nr.gateway_id and a.organization_id=o
 join public.giving_gateway_accounts g on g.id=a.gateway_id and g.organization_id=o
 join public.giving_processor_routes gr on gr.id=nr.route_id and gr.organization_id=o and gr.gateway_id=g.id
 where c.organization_id=o and c.enabled and length(btrim(c.receipt_identity))>0 and c.fallback_path in('/give.html','/outreach-giving.html') and proof.route_id=r and proof.enabled and proof.verified_at is not null and proof.proof_reference is not null
 and proof.mid_reference=gr.mid_reference and length(proof.settlement_reference)>0 and proof.merchant_reference=a.merchant_reference
 and nr.enabled and nr.verified_at is not null and a.enabled and a.last_verified_at is not null
 and g.provider='nmi' and g.environment='sandbox' and gr.environment='sandbox' and gr.active and gr.currency='USD'
 and not exists(select 1 from private.payment_ops_incidents i where i.organization_id=o and i.gateway_id=g.id and i.status in('unavailable','maintenance')))
$$;
create function private.nmi_giving_actor(o uuid,u uuid,k text)returns boolean language sql stable security definer set search_path=''as $$
select coalesce(private.outreach_verified(u),false) and exists(select 1 from private.effective_staff_permissions p where p.organization_id=o and p.user_id=u and p.permission=k and p.department_ids is null)
$$;
create function private.nmi_giving_view(o uuid,sid uuid)returns jsonb language sql stable security definer set search_path=''as $$
select jsonb_build_object('session_id',s.id,'sandbox',true,'currency',s.currency,'status',case when exists(select 1 from private.nmi_giving_attempts a where a.session_id=s.id and a.state in('review','dispatched'))then 'pending' when s.status='completed'then 'success' when s.status='partially_completed'then 'partial' when s.status='failed'then 'declined' else 'pending'end,
 'total_minor',s.intended_minor::text,'legs',(select coalesce(jsonb_agg(jsonb_build_object('id',l.id,'amount_minor',l.amount_minor::text,'status',l.status,'component_key',proof.public_tokenization_key,'merchant_reference',proof.merchant_reference)),'[]')from public.giving_transaction_legs l join private.nmi_giving_route_proofs proof on proof.route_id=(l.route_snapshot->>'processor_route_id')::uuid and proof.organization_id=o where l.organization_id=o and l.session_id=s.id),
 'receipt',(select snapshot||jsonb_build_object('delivery','held','sandbox',true)from public.giving_receipts where organization_id=o and session_id=s.id order by version desc limit 1),
 'recurring',(select coalesce(jsonb_agg(jsonb_build_object('id',i.id,'status',i.status,'frequency',i.frequency,'starts_on',i.starts_on,'next_run_at',null,'next_date_verification','required from NMI')),'[]')from public.giving_recurring_instructions i where i.organization_id=o and i.guest_session_id=s.id),
 'retry_automatically',false,'fallback_path',(select fallback_path from private.nmi_giving_control where organization_id=o))
from public.giving_sessions s where s.organization_id=o and s.id=sid
$$;
create function private.nmi_giving_receipt(o uuid,sid uuid)returns void language plpgsql security definer set search_path=''as $$
declare s public.giving_sessions;c private.nmi_giving_checkouts;snapshot jsonb;rid uuid;begin
 select * into s from public.giving_sessions where organization_id=o and id=sid;
 select * into c from private.nmi_giving_checkouts where organization_id=o and session_id=sid;
 if s.status not in('completed','partially_completed')or c.session_id is null then return;end if;
 if exists(select 1 from public.giving_receipts where session_id=sid)then return;end if;
 select jsonb_build_object('sandbox',true,'session_id',sid,'organization',(select name from public.organizations where id=o),
 'receipt_identity',(select receipt_identity from private.nmi_giving_control where organization_id=o),'currency',s.currency,
 'total_minor',sum(g.amount_minor)::text,'intended_minor',s.intended_minor::text,'session_status',s.status,'delivery','held',
 'funds',jsonb_agg(jsonb_build_object('fund',f.name,'amount_minor',g.amount_minor::text,'tax_eligible',g.tax_eligible))) into snapshot
 from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id where g.organization_id=o and g.session_id=sid and g.kind='gift';
 insert into public.giving_receipts(organization_id,session_id,person_id,receipt_number,snapshot)values(o,sid,s.person_id,'SANDBOX-'||sid,snapshot)returning id into rid;
 insert into private.nmi_giving_receipt_outbox(organization_id,receipt_id,recipient,sender_identity,snapshot)values(o,rid,c.receipt_email,coalesce(snapshot->>'receipt_identity',''),snapshot);
 perform private.giving_audit_event(o,'nmi.receipt.held',rid);
end$$;

create function private.nmi_giving_service(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare form private.nmi_giving_forms;c private.nmi_giving_checkouts;s public.giving_sessions;l public.giving_transaction_legs;
 op private.payments_operations;attempt private.nmi_giving_attempts;account private.payments_nmi_accounts;route private.payments_nmi_routes;
 proof private.nmi_giving_route_proofs;refund public.giving_refunds;approval private.payment_ops_approvals;
 row jsonb;result jsonb;payload jsonb;link private.giving_donor_account_links;st text;kind text;perm text;digest text;cap text;
 key uuid;sid uuid;identifier uuid;actor uuid;instruction uuid;parent uuid;total bigint:=0;amount bigint;rid uuid;token uuid;frozen jsonb;purpose text;
begin
 if current_setting('role',true)<>'service_role'then raise exception 'NMI service authority required'using errcode='42501';end if;
 perform private.giving_lock(o);
 if a='form'then
  perform private.giving_payload(p,array['form_id']);select * into form from private.nmi_giving_forms where organization_id=o and id=(p->>'form_id')::uuid and enabled;
  if not found or not exists(select 1 from private.nmi_giving_control where organization_id=o and enabled)then return jsonb_build_object('available',false,'sandbox',true);end if;
  return jsonb_build_object('available',true,'sandbox',true,'form_id',form.id,'label',form.label,'currency',form.currency,'min_minor',form.min_minor::text,'max_minor',form.max_minor::text,'recurring_allowed',form.recurring_allowed,
   'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'label',f.name,'purpose',ff.purpose)),'[]')from private.nmi_giving_form_funds ff join public.giving_funds f on f.organization_id=ff.organization_id and f.id=ff.fund_id join public.giving_destinations d on d.id=f.destination_id and d.organization_id=o where ff.form_id=form.id and f.status='active' and f.is_public and private.nmi_giving_route_ok(o,d.processor_route_id)));
 elsif a='create'then
  perform private.giving_payload(p,array['form_id','request_key','capability_hash','network_hash','receipt_email','donor_name','frequency','starts_on','lines','actor_id']);
  select * into form from private.nmi_giving_forms where organization_id=o and id=(p->>'form_id')::uuid and enabled;
  if not found or not exists(select 1 from private.nmi_giving_control where organization_id=o and enabled)then raise exception 'Giving unavailable'using errcode='42501';end if;
  if p->>'capability_hash'!~'^[a-f0-9]{64}$'or p->>'network_hash'!~'^[a-f0-9]{64}$'or p->>'receipt_email'!~'^[^[:space:]@]{1,120}@[^[:space:]@]{1,120}\.[A-Za-z]{2,}$'or length(p->>'receipt_email')>254 or coalesce(p->>'donor_name','')~'[0-9]{13,19}'or length(coalesce(p->>'donor_name',''))>120 then raise exception 'Invalid donor request';end if;
  if jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 1 and 10 then raise exception 'Bounded gift lines required';end if;
  key:=(p->>'request_key')::uuid;digest:=encode(sha256(convert_to((p-'network_hash')::text,'UTF8')),'hex');
  select gs.* into s from public.giving_sessions gs where gs.organization_id=o and gs.request_key=key;
  if found then select * into c from private.nmi_giving_checkouts where session_id=s.id;if c.payload_digest is distinct from digest then raise exception 'Checkout replay conflict'using errcode='PT409';end if;return private.nmi_giving_view(o,s.id);end if;
  if (select count(*)from private.nmi_giving_checkouts where network_hash=p->>'network_hash'and created_at>now()-interval '1 hour')>=10 then raise exception 'Giving request limit';end if;
  cap:=encode(sha256(convert_to(jsonb_build_object('email',lower(p->>'receipt_email'),'lines',p->'lines','form',form.id,'frequency',p->>'frequency')::text,'UTF8')),'hex');
  if exists(select 1 from private.nmi_giving_checkouts cc join public.giving_sessions ss on ss.id=cc.session_id where cc.organization_id=o and cc.duplicate_digest=cap and cc.created_at>now()-interval '15 minutes'and ss.status not in('failed','cancelled'))then raise exception 'Existing payment must be reviewed; do not resubmit'using errcode='PT409';end if;
  if coalesce(p->>'frequency','once')not in('once','weekly','biweekly','monthly')or(p->>'frequency'<>'once'and not form.recurring_allowed)then raise exception 'Recurring not available';end if;
  actor:=(p->>'actor_id')::uuid;
  if actor is not null and private.outreach_verified(actor)then select * into link from private.giving_donor_account_links where organization_id=o and user_id=actor and active;end if;
  if link.person_id is not null then perform private.giving_identity(o,link.person_id,link.verified_household_id);end if;
  payload:=jsonb_build_object('request_key',key,'person_id',link.person_id,'household_id',link.verified_household_id,'currency',form.currency,'intended_minor','0','source','nmi_sandbox','lines','[]'::jsonb);
  for row in select value from jsonb_array_elements(p->'lines')loop
   perform private.giving_payload(row,array['fund_id','amount_minor']);
   if jsonb_typeof(row->'amount_minor')<>'string'or row->>'amount_minor'!~'^[0-9]{1,10}$'then raise exception 'Exact minor units required';end if;
   amount:=(row->>'amount_minor')::bigint;if amount<form.min_minor or amount>form.max_minor then raise exception 'Amount outside form bounds';end if;
   if not exists(select 1 from private.nmi_giving_form_funds ff join public.giving_funds f on f.id=ff.fund_id and f.organization_id=o join public.giving_destinations d on d.id=f.destination_id and d.organization_id=o where ff.organization_id=o and ff.form_id=form.id and ff.fund_id=(row->>'fund_id')::uuid and f.is_public and f.status='active'and private.nmi_giving_route_ok(o,d.processor_route_id))then raise exception 'Fund route unavailable';end if;
   total:=total+amount;payload:=jsonb_set(payload,'{lines}',(payload->'lines')||jsonb_build_array(row));
  end loop;
  if total>form.max_minor then raise exception 'Total outside form bounds';end if;
  insert into public.giving_sessions(organization_id,person_id,household_id,currency,intended_minor,source,request_key,created_by)
   values(o,link.person_id,link.verified_household_id,form.currency,total,'nmi_sandbox',key,actor)returning id into sid;
  perform set_config('giving.build_session','on',true);
  for row in select value from jsonb_array_elements(p->'lines')loop
   select ff.purpose into purpose from private.nmi_giving_form_funds ff where ff.form_id=form.id and ff.fund_id=(row->>'fund_id')::uuid;
   frozen:=private.payments_route(o,(row->>'fund_id')::uuid,null,purpose,form.currency);
   frozen:=frozen||jsonb_build_object('nmi_route_proof',private.nmi_giving_route_fingerprint(o,(frozen->>'processor_route_id')::uuid));
   insert into public.giving_transaction_legs(organization_id,session_id,amount_minor,route_snapshot,route_key,currency)
    values(o,sid,(row->>'amount_minor')::bigint,frozen,frozen->>'processor_route_id',form.currency)
    on conflict(session_id,route_key)do update set amount_minor=giving_transaction_legs.amount_minor+excluded.amount_minor returning id into rid;
   insert into public.giving_session_lines(organization_id,session_id,leg_id,fund_id,amount_minor,route_snapshot,tax_eligible,payment_purpose)
    select o,sid,rid,f.id,(row->>'amount_minor')::bigint,frozen,f.tax_eligible and purpose='charitable_contribution',purpose from public.giving_funds f where f.organization_id=o and f.id=(row->>'fund_id')::uuid;
  end loop;
  perform set_config('giving.build_session','off',true);
  insert into private.nmi_giving_checkouts(organization_id,session_id,form_id,capability_hash,payload_digest,duplicate_digest,network_hash,receipt_email,donor_name,actor_id,frequency,starts_on)
   values(o,sid,form.id,p->>'capability_hash',digest,cap,p->>'network_hash',lower(p->>'receipt_email'),coalesce(p->>'donor_name',''),actor,coalesce(p->>'frequency','once'),(p->>'starts_on')::date);
  return private.nmi_giving_view(o,sid);
 end if;
 if a='shutdown'then
  perform private.giving_payload(p,array['actor_id','reason']);actor:=(p->>'actor_id')::uuid;
  if not private.nmi_giving_actor(o,actor,'payments.configure')then raise exception 'Shutdown authority denied'using errcode='42501';end if;
  update private.nmi_giving_control set enabled=false,revision=revision+1 where organization_id=o;
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,actor,'nmi.emergency.disabled',o,jsonb_build_object('reason',private.payment_ops_safe_text(p->>'reason',5,500)));
  return jsonb_build_object('disabled',true,'public_links_changed',false);
 end if;
 sid:=(p->>'session_id')::uuid;select * into s from public.giving_sessions where organization_id=o and id=sid and source='nmi_sandbox';
 select * into c from private.nmi_giving_checkouts where organization_id=o and session_id=sid;
 if s.id is null or c.session_id is null then raise exception 'Checkout unavailable'using errcode='42501';end if;
 actor:=(p->>'actor_id')::uuid;
 if a in('status','prepare')then
  if not(c.capability_hash=coalesce(p->>'capability_hash','')and c.expires_at>now())and not private.nmi_giving_actor(o,actor,'payments.view')and not exists(select 1 from private.giving_donor_account_links dl where dl.organization_id=o and dl.user_id=actor and dl.person_id=s.person_id and dl.active and private.outreach_verified(actor))then raise exception 'Checkout authority unavailable'using errcode='42501';end if;
 end if;
 if a='status'then perform private.giving_payload(p,array['session_id','actor_id','capability_hash']);return private.nmi_giving_view(o,sid);end if;
 if a='prepare'then
  perform private.giving_payload(p,array['session_id','leg_id','actor_id','capability_hash','operation','request_key','refund_id','instruction_id','parent_attempt_id','save_method']);
  kind:=p->>'operation';key:=(p->>'request_key')::uuid;
  select * into l from public.giving_transaction_legs where organization_id=o and session_id=sid and id=(p->>'leg_id')::uuid;
  if not found or not private.nmi_giving_route_ok(o,(l.route_snapshot->>'processor_route_id')::uuid)then raise exception 'Route held'using errcode='42501';end if;
  if kind not in('sale','authorize','capture','refund','void','transaction','recurring_create','recurring_cancel','recurring_pause')then raise exception 'Unsupported operation';end if;
  perm:=case kind when 'refund'then 'payments.refund.execute'when 'void'then 'payments.void.execute'when 'transaction'then 'payments.manage'when 'capture'then 'payments.manage'when 'recurring_pause'then 'payments.recurring.manage'else null end;
  if perm is not null and not private.nmi_giving_actor(o,actor,perm)then raise exception 'Current operation authority denied'using errcode='42501';end if;
  if kind in('sale','authorize','recurring_create')and(c.expires_at<=now()or s.expires_at<=now())then raise exception 'Checkout expired';end if;
  if kind in('sale','authorize','recurring_create','recurring_cancel')and not(c.capability_hash=coalesce(p->>'capability_hash','')and c.expires_at>now())and not exists(select 1 from private.giving_donor_account_links dl where dl.organization_id=o and dl.user_id=actor and dl.person_id=s.person_id and dl.active and private.outreach_verified(actor))and not private.nmi_giving_actor(o,actor,case when kind like 'recurring_%'then 'payments.recurring.manage'else 'payments.configure'end)then raise exception 'Explicit execution authority required';end if;
  if (l.route_snapshot->>'processor_revision')::int is distinct from(select revision from public.giving_processor_routes where id=(l.route_snapshot->>'processor_route_id')::uuid)then raise exception 'Frozen route changed';end if;
  amount:=l.amount_minor;
  if kind in('refund','void')then
   select * into refund from public.giving_refunds where organization_id=o and id=(p->>'refund_id')::uuid and leg_id=l.id and kind=(p->>'operation') and status in('approved','execution_pending');
   select * into approval from private.payment_ops_approvals where organization_id=o and refund_id=refund.id;
   if refund.id is null or approval.refund_id is null or(approval.approval_required and(approval.approved_by is null or not private.nmi_giving_actor(o,approval.approved_by,'payments.'||kind||'.approve')or(not approval.self_approval and approval.approved_by=approval.requested_by)))or approval.route_snapshot is distinct from l.route_snapshot then raise exception 'Original approved request required';end if;
   if kind='void'and l.status<>'authorized'or kind='refund'and l.status not in('settled','partially_refunded')then raise exception 'Authoritative original transaction state required';end if;
   amount:=refund.amount_minor;
   if kind='refund'and amount+coalesce((select sum(x.amount_minor)from private.payments_operations x join private.nmi_giving_attempts a on a.id=x.id where x.organization_id=o and x.leg_id=l.id and x.operation='refund'and a.state not in('completed','failed')),0)>(select coalesce(sum(amount_minor),0)from public.giving_ledger where organization_id=o and leg_id=l.id)then raise exception 'Refund exceeds remaining principal';end if;
  end if;
  if kind='capture'and l.status<>'authorized'then raise exception 'Authorization required';end if;
  instruction:=(p->>'instruction_id')::uuid;
  if kind='recurring_create'then
   select * into account from private.payments_nmi_accounts where gateway_id=(l.route_snapshot->>'gateway_id')::uuid and organization_id=o;
   if coalesce((p->>'save_method')::boolean,false) is not true then raise exception 'Explicit recurring storage consent required';end if;
   if c.frequency='once'or c.starts_on is null or c.starts_on<=(now() at time zone account.gateway_timezone)::date then raise exception 'Future recurring start required';end if;
   select * into account from private.payments_nmi_accounts where gateway_id=(l.route_snapshot->>'gateway_id')::uuid and organization_id=o;
   if not account.subscription_default_verified or account.subscription_default_route_id is distinct from(l.route_snapshot->>'processor_route_id')::uuid or account.gateway_timezone is null then raise exception 'Verified default recurring route required';end if;
   if instruction is null then
    select i.id into instruction from public.giving_recurring_instructions i where organization_id=o and guest_session_id=sid;
    if instruction is null then
     insert into public.giving_recurring_instructions(organization_id,person_id,household_id,guest_session_id,currency,frequency,starts_on,next_run_at)
      values(o,s.person_id,s.household_id,sid,s.currency,c.frequency,c.starts_on,c.starts_on::timestamp at time zone account.gateway_timezone)returning id into instruction;
     insert into public.giving_recurring_lines(organization_id,instruction_id,fund_id,amount_minor,route_snapshot,nmi_tax_eligible)select o,instruction,fund_id,amount_minor,route_snapshot,tax_eligible from public.giving_session_lines where session_id=sid;
    end if;
   end if;
  end if;
  if kind in('recurring_create','recurring_cancel','recurring_pause')and not exists(select 1 from public.giving_recurring_instructions where organization_id=o and id=instruction and guest_session_id=sid and status<>'cancelled')then raise exception 'Recurring owner unavailable';end if;
  digest:=encode(sha256(convert_to((p-'capability_hash')::text,'UTF8')),'hex');
  select * into op from private.payments_operations where organization_id=o and operation=kind and request_key=key;
  if found then if op.payload_digest<>digest then raise exception 'Operation replay conflict'using errcode='PT409';end if;return jsonb_build_object('id',op.id,'state',(select state from private.nmi_giving_attempts where id=op.id));end if;
  if kind in('sale','authorize')and exists(select 1 from private.nmi_giving_attempts a join private.payments_operations x on x.id=a.id where x.leg_id=l.id and x.operation in('sale','authorize')and a.state<>'failed')then raise exception 'Existing attempt requires authoritative lookup'using errcode='PT409';end if;
  if kind in('refund','void','recurring_create','recurring_cancel','recurring_pause')and exists(select 1 from private.nmi_giving_attempts a join private.payments_operations x on x.id=a.id where x.leg_id=l.id and x.operation=kind and a.state<>'failed'and(kind not in('refund','void')or x.refund_id=refund.id))then raise exception 'Existing financial action requires lookup'using errcode='PT409';end if;
  if kind='transaction'then
   select aa.id,xx.amount_minor,aa.instruction_id into parent,amount,instruction from private.nmi_giving_attempts aa join private.payments_operations xx on xx.id=aa.id and xx.leg_id=l.id where aa.organization_id=o and aa.session_id=sid and aa.id=(p->>'parent_attempt_id')::uuid and xx.operation<>'transaction';
   if parent is null then raise exception 'Original attempt required';end if;
  end if;
  insert into private.payments_operations(organization_id,leg_id,gateway_id,operation,request_key,payload_digest,amount_minor,refund_id)
   values(o,l.id,(l.route_snapshot->>'gateway_id')::uuid,kind,key,digest,amount,refund.id)returning id into identifier;
  insert into private.nmi_giving_attempts(id,organization_id,session_id,actor_id,parent_attempt_id,instruction_id,save_method,authority_kind)
   values(identifier,o,sid,actor,parent,instruction,coalesce((p->>'save_method')::boolean,false),case when kind in('sale','authorize','recurring_create','recurring_cancel')and c.capability_hash=coalesce(p->>'capability_hash','')and c.expires_at>now()then 'checkout'when kind in('sale','authorize','recurring_create','recurring_cancel')and exists(select 1 from private.giving_donor_account_links dl where dl.organization_id=o and dl.user_id=actor and dl.person_id=s.person_id and dl.active and private.outreach_verified(actor))then 'donor'else 'staff'end);
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,actor,'nmi.operation.prepared',identifier,jsonb_build_object('operation',kind));
  return jsonb_build_object('id',identifier,'state','prepared');
 end if;
 select * into attempt from private.nmi_giving_attempts where organization_id=o and session_id=sid and id=(p->>'id')::uuid for update;
 if not found then raise exception 'Attempt unavailable'using errcode='42501';end if;
 select * into op from private.payments_operations where id=attempt.id and organization_id=o;
 select * into l from public.giving_transaction_legs where organization_id=o and id=op.leg_id;
 select * into route from private.payments_nmi_routes where organization_id=o and route_id=(l.route_snapshot->>'processor_route_id')::uuid;
 select * into account from private.payments_nmi_accounts where organization_id=o and gateway_id=op.gateway_id;
 select * into proof from private.nmi_giving_route_proofs where organization_id=o and route_id=route.route_id;
 if a='release'then
  perform private.giving_payload(p,array['session_id','id','lease']);
  if attempt.state<>'claimed'or attempt.lease is distinct from(p->>'lease')::uuid then raise exception 'Only unhanded claim may be released';end if;
  update private.nmi_giving_attempts set state='failed'where id=attempt.id;update private.payments_operations set status='failed'where id=attempt.id;
  perform private.giving_audit_event(o,'nmi.pre_handoff.released',attempt.id);return jsonb_build_object('released',true,'provider_called',false);
 end if;
 if a in('claim','handoff')then
  perform private.giving_payload(p,array['session_id','id','lease']);
  if not private.nmi_giving_route_ok(o,route.route_id)or attempt.expires_at<=now()then raise exception 'Execution held'using errcode='42501';end if;
  if attempt.authority_kind='checkout'and c.expires_at<=now()then raise exception 'Checkout authority expired';end if;
  if attempt.authority_kind='staff'and not private.nmi_giving_actor(o,attempt.actor_id,case op.operation when 'refund'then 'payments.refund.execute'when 'void'then 'payments.void.execute'when 'sale'then 'payments.configure'when 'authorize'then 'payments.configure'when 'recurring_create'then 'payments.recurring.manage'when 'recurring_cancel'then 'payments.recurring.manage'when 'recurring_pause'then 'payments.recurring.manage'else 'payments.manage'end)then raise exception 'Execution authority revoked';end if;
  if op.operation in('refund','void')then
   select * into refund from public.giving_refunds where id=op.refund_id and organization_id=o and status in('approved','execution_pending');select * into approval from private.payment_ops_approvals where refund_id=refund.id and organization_id=o;
   if refund.id is null or approval.refund_id is null or approval.route_snapshot is distinct from l.route_snapshot or(approval.approval_required and not private.nmi_giving_actor(o,approval.approved_by,'payments.'||op.operation||'.approve'))then raise exception 'Adjustment approval no longer current';end if;
  end if;
  if (l.route_snapshot->>'processor_revision')::int is distinct from(select revision from public.giving_processor_routes where id=route.route_id)then raise exception 'Frozen route changed before handoff';end if;
  if op.operation in('sale','authorize','recurring_create','capture')then
   -- Every contributing line must still resolve to its original organization/fund/destination/gateway/MID.
   if exists(select 1 from public.giving_session_lines sl where sl.organization_id=o and sl.leg_id=l.id and (private.payments_route(o,sl.fund_id,null,sl.payment_purpose,l.currency) is distinct from(sl.route_snapshot-'nmi_route_proof')or sl.route_snapshot->>'nmi_route_proof'is distinct from private.nmi_giving_route_fingerprint(o,route.route_id)))then raise exception 'Frozen financial routing changed';end if;
   if s.person_id is not null and not exists(select 1 from private.giving_donor_account_links dl where dl.organization_id=o and dl.user_id=attempt.actor_id and dl.person_id=s.person_id and dl.verified_household_id is not distinct from s.household_id and dl.active and private.outreach_verified(attempt.actor_id))then raise exception 'Donor linkage revoked';end if;
  end if;
  if op.operation='recurring_pause'and not private.nmi_giving_actor(o,attempt.actor_id,'payments.recurring.manage')then raise exception 'Recurring authority revoked';end if;
  if op.operation='recurring_cancel'and attempt.actor_id is not null and not private.nmi_giving_actor(o,attempt.actor_id,'payments.recurring.manage')and not exists(select 1 from private.giving_donor_account_links dl where dl.organization_id=o and dl.user_id=attempt.actor_id and dl.person_id=s.person_id and dl.active and private.outreach_verified(attempt.actor_id))and not(c.actor_id is null and c.expires_at>now())then raise exception 'Recurring cancellation authority revoked';end if;
  if a='claim'then
   if attempt.state<>'prepared'then return jsonb_build_object('claimed',false,'state',attempt.state);end if;
   token:=gen_random_uuid();update private.nmi_giving_attempts set state='claimed',lease=token where id=attempt.id;
  else
   if attempt.state<>'claimed'or attempt.lease is distinct from(p->>'lease')::uuid then raise exception 'Handoff already used'using errcode='PT409';end if;
   token:=attempt.lease;update private.nmi_giving_attempts set state='dispatched'where id=attempt.id;
   insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,attempt.actor_id,'nmi.operation.dispatched',attempt.id,jsonb_build_object('operation',op.operation,'sandbox',true,'authority',attempt.authority_kind));
  end if;
  if op.operation='recurring_create'then
   select plan.plan_reference into cap from private.payments_nmi_plans plan join public.giving_recurring_instructions i on i.id=attempt.instruction_id where plan.organization_id=o and plan.gateway_id=op.gateway_id and plan.amount_minor=op.amount_minor and plan.currency=l.currency and plan.frequency=i.frequency order by plan.verified_at desc limit 1;
   if cap is null then raise exception 'Verified recurring plan required';end if;update private.nmi_giving_attempts set plan_reference=cap where id=attempt.id;
  end if;
  return jsonb_build_object('claimed',true,'lease',token,'id',attempt.id,'session_id',sid,'operation',op.operation,'amount_minor',op.amount_minor::text,'order_reference',coalesce(attempt.parent_attempt_id,attempt.id)::text,
   'recovery_operation',(select operation from private.payments_operations where id=attempt.parent_attempt_id),'parent_provider_reference',(select provider_reference from private.nmi_giving_attempts where id=attempt.parent_attempt_id),
   'transaction_reference',coalesce(l.provider_reference,attempt.provider_reference,(select provider_reference from private.nmi_giving_attempts where id=attempt.parent_attempt_id)),
   'refunded_minor_before',coalesce((select -sum(amount_minor)from public.giving_ledger where organization_id=o and leg_id=l.id and kind='refund'),0)::text,'save_method',attempt.save_method,'instruction_id',attempt.instruction_id,'plan_reference',coalesce(cap,(select plan_reference from private.nmi_giving_attempts where id=attempt.parent_attempt_id)),
   'start_date',(select to_char(next_run_at at time zone account.gateway_timezone,'YYYYMMDD')from public.giving_recurring_instructions where id=attempt.instruction_id),
   'subscription_reference',(select provider_reference from private.nmi_giving_subscriptions where instruction_id=attempt.instruction_id and route_id=route.route_id),
   'scope',jsonb_build_object('organization_id',o,'gateway_id',op.gateway_id,'route_id',route.route_id,'processor_id',route.processor_id,'provider','nmi','environment','sandbox','currency',l.currency,'route_verified',true,'secret_version',account.secret_version,'subscription_default_verified',account.subscription_default_verified and account.subscription_default_route_id=route.route_id,'merchant_reference',proof.merchant_reference));
 elsif a='complete'then
  perform private.giving_payload(p,array['session_id','id','lease','status','authoritative','provider_reference','amount_minor','currency','processor_id','category','customer_reference']);
  if attempt.state<>'dispatched'or attempt.lease is distinct from(p->>'lease')::uuid then raise exception 'Outcome lease unavailable'using errcode='PT409';end if;
  st:=p->>'status';
  if p->>'provider_reference'is not null and(p->>'provider_reference'!~'^[A-Za-z0-9_-]{1,120}$'or p->>'provider_reference'~'^[0-9]{13,19}$')then raise exception 'Safe provider reference required';end if;
  if coalesce((p->>'authoritative')::boolean,false)and (st in('authorized','captured','settled','refunded','voided')or st='failed'and op.operation='transaction')and((p->>'amount_minor')::bigint is distinct from op.amount_minor or p->>'currency'is distinct from l.currency or p->>'processor_id'is distinct from route.processor_id or p->>'provider_reference'is null)then st:='review';end if;
  if st not in('review','pending')and not coalesce((p->>'authoritative')::boolean,false)then st:='review';end if;
  kind:=op.operation;
  if kind='transaction'and attempt.parent_attempt_id is not null then
   select x.operation,x.refund_id into kind,rid from private.payments_operations x where x.id=attempt.parent_attempt_id and x.organization_id=o and x.leg_id=l.id;
  else rid:=op.refund_id;end if;

  insert into private.nmi_giving_results(organization_id,attempt_id,status,authoritative,provider_reference,amount_minor,currency,processor_id,category)
   values(o,attempt.id,st,coalesce((p->>'authoritative')::boolean,false),p->>'provider_reference',(p->>'amount_minor')::bigint,p->>'currency',p->>'processor_id',p->>'category');
  update private.nmi_giving_attempts set state=case st when 'failed'then 'failed'when 'review'then 'review'when 'pending'then 'review'else 'completed'end,provider_reference=coalesce(p->>'provider_reference',provider_reference)where id=attempt.id;
  update private.payments_operations set status=case st when 'failed'then 'failed'when 'review'then 'review'when 'pending'then 'review'else 'completed'end where id=op.id;
  if op.operation='transaction'and st in('authorized','captured','settled','failed','refunded','voided','active','paused','cancelled')and coalesce((p->>'authoritative')::boolean,false)then
   update private.nmi_giving_attempts aa set state=case when st='failed'then 'failed'else 'completed'end,provider_reference=coalesce(aa.provider_reference,p->>'provider_reference')
    from private.payments_operations xx where xx.id=aa.id and xx.leg_id=l.id and xx.operation in('sale','authorize','capture','refund','void','recurring_create','recurring_pause','recurring_cancel')and aa.state in('review','dispatched')and(aa.id=attempt.parent_attempt_id or aa.provider_reference=p->>'provider_reference');
  end if;
  if kind in('sale','authorize','capture','transaction')and st in('authorized','captured','settled','failed')then
   if l.provider_reference is not null and p->>'provider_reference'is not null and l.provider_reference<>p->>'provider_reference'then raise exception 'Original transaction identity conflict';end if;
   update public.giving_transaction_legs set status=st,provider_reference=coalesce(provider_reference,p->>'provider_reference')where id=l.id;
   if st in('captured','settled')then perform private.giving_post_session(o,sid);perform private.nmi_giving_receipt(o,sid);
   elsif st='failed'then perform private.giving_post_session(o,sid);perform private.nmi_giving_receipt(o,sid);end if;
  end if;
  if kind in('refund','void')and st in('refunded','voided')then
   select * into refund from public.giving_refunds where id=rid and organization_id=o;
   if refund.id is null then raise exception 'Adjustment request unavailable';end if;
   if not exists(select 1 from public.giving_refund_outcomes where refund_id=refund.id)then
    if st='refunded'then
     amount:=refund.amount_minor;
     for row in select to_jsonb(g)from public.giving_ledger g where organization_id=o and leg_id=l.id and kind='gift'order by id loop
      total:=(row->>'amount_minor')::bigint+coalesce((select sum(amount_minor)from public.giving_ledger where original_id=(row->>'id')::uuid),0);
      if total>0 and amount>0 then
       insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,session_id,leg_id,original_id,kind,amount_minor,currency,gift_at,source,payment_method,route_snapshot,tax_eligible,entered_by,posted_by)
        values(o,s.person_id,s.household_id,(row->>'fund_id')::uuid,sid,l.id,(row->>'id')::uuid,'refund',-least(total,amount),l.currency,now(),'nmi_sandbox','card',row->'route_snapshot',(row->>'tax_eligible')::boolean,attempt.actor_id,attempt.actor_id);
       amount:=amount-least(total,amount);
      end if;
     end loop;
     if amount<>0 then raise exception 'Refund principal mismatch';end if;
    end if;
    insert into public.giving_refund_outcomes(refund_id,organization_id,gateway_id,provider_reference,payload_digest)values(refund.id,o,op.gateway_id,p->>'provider_reference',encode(sha256(convert_to(p::text,'UTF8')),'hex'));
    update public.giving_refunds set status='recorded'where id=refund.id;
    update public.giving_transaction_legs set status=case when st='voided'then 'voided'when(select sum(amount_minor)from public.giving_ledger where leg_id=l.id)=0 then 'refunded'else 'partially_refunded'end where id=l.id;
   end if;
  end if;
  if attempt.save_method and st in('captured','settled','active')and p->>'customer_reference'is not null then
   if p->>'customer_reference'!~'^[A-Za-z0-9_-]{1,120}$'or p->>'customer_reference'~'^[0-9]{13,19}$'then raise exception 'Safe vault reference required';end if;
   insert into private.nmi_giving_vault_bindings(organization_id,session_id,gateway_id,route_id,provider_reference)values(o,sid,op.gateway_id,route.route_id,p->>'customer_reference')on conflict(session_id,route_id)do nothing;
  end if;
  if kind='recurring_create'and st='active'and coalesce((p->>'authoritative')::boolean,false)then
   insert into private.nmi_giving_subscriptions(organization_id,instruction_id,route_id,gateway_id,session_id,leg_id,provider_reference,status)values(o,attempt.instruction_id,route.route_id,op.gateway_id,sid,l.id,p->>'provider_reference','active')on conflict(instruction_id,route_id)do nothing;
   if not exists(select 1 from private.nmi_giving_subscriptions where instruction_id=attempt.instruction_id and route_id=route.route_id and provider_reference=p->>'provider_reference')then raise exception 'Subscription identity conflict';end if;
   if not exists(select 1 from public.giving_recurring_lines lines where instruction_id=attempt.instruction_id and not exists(select 1 from private.nmi_giving_subscriptions sub where sub.instruction_id=lines.instruction_id and sub.route_id=(lines.route_snapshot->>'processor_route_id')::uuid and sub.status='active'))then update public.giving_recurring_instructions set status='active'where id=attempt.instruction_id;end if;
  elsif kind='recurring_pause'and st='paused'and coalesce((p->>'authoritative')::boolean,false)then
   update private.nmi_giving_subscriptions set status='paused'where instruction_id=attempt.instruction_id and route_id=route.route_id;update public.giving_recurring_instructions set status=case when exists(select 1 from private.nmi_giving_subscriptions where instruction_id=attempt.instruction_id and status='active')then 'active'else 'paused'end,revision=revision+1 where id=attempt.instruction_id;
  elsif kind='recurring_cancel'and st='cancelled'and coalesce((p->>'authoritative')::boolean,false)then
   update private.nmi_giving_subscriptions set status='cancelled'where instruction_id=attempt.instruction_id and route_id=route.route_id;
   if not exists(select 1 from private.nmi_giving_subscriptions where instruction_id=attempt.instruction_id and status<>'cancelled')then update public.giving_recurring_instructions set status='cancelled',revision=revision+1 where id=attempt.instruction_id;end if;
  end if;
  if kind in('sale','authorize','capture','transaction')then
  perform private.payment_ops_service('observe',o,jsonb_build_object('request_key',attempt.id,'source_key','nmi-execution:'||attempt.id,'leg_id',l.id,'operation_id',op.id,'result',case when st in('captured','settled')then 'paid'when st='failed'then 'failed'else 'unknown'end,'failure_category',case when st in('review','pending')then 'unknown'else null end));
  end if;
  insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail)values(o,attempt.actor_id,'nmi.operation.'||st,attempt.id,jsonb_build_object('operation',op.operation,'authoritative',p->'authoritative','sandbox',true));
  return private.nmi_giving_view(o,sid)||jsonb_build_object('operation_status',st);
 end if;
 raise exception 'Unsupported NMI service action';
end$$;
create function public.nmi_giving_service(p_action text,p_org uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.nmi_giving_service(p_action,p_org,p_payload)$$;
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'nmi_giving_%'loop execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;end$$;
revoke all on function public.nmi_giving_service(text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.nmi_giving_service(text,uuid,jsonb),private.nmi_giving_service(text,uuid,jsonb)to service_role;

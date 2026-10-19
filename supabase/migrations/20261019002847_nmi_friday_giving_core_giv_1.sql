-- GIV-1 local build foundation. No processor, SMS, donor delivery or GiveHub cutover.
-- Monetary values are integer minor units; each operation and aggregate has one currency.
create function private.giving_permissions() returns text[] language sql immutable set search_path='' as $$
 select array['finance.read','finance.configure','finance.gifts.read','finance.gifts.create','finance.gifts.adjust','finance.pledges.read','finance.pledges.manage','finance.recurring.read','finance.recurring.manage','finance.reconciliation.read','finance.reconciliation.manage','finance.reports.read','finance.statements.generate','finance.refunds.manage','finance.merchant.configure','finance.export']::text[]
$$;
-- Preserve the accepted permission registry, adding only explicit finance capabilities.
do $$declare keys text[];begin
 keys:=private.staff_permission_keys()||array(select k from unnest(private.giving_permissions()) k where not k=any(private.staff_permission_keys()));
 alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
 execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
 execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end$$;

create table public.giving_gateway_accounts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 provider text not null check(provider in('authorize_net','nmi','stripe_connect','paypal','square','external_connector')),
 label text not null check(length(btrim(label)) between 1 and 120),environment text not null default 'sandbox' check(environment in('sandbox','live')),
 enabled boolean not null default false check(not enabled),verified boolean not null default false check(not verified),
 nonsecret_account_reference text check(length(nonsecret_account_reference)<=120),capabilities text[] not null default '{}',
 revision int not null default 1,created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id)
);
create table public.giving_processor_routes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),gateway_id uuid not null,
 label text not null check(length(btrim(label)) between 1 and 120),processor_reference text not null check(length(btrim(processor_reference)) between 1 and 120),
 mid_reference text check(length(mid_reference)<=120),settlement_label text not null default '',descriptor text not null default '',priority int not null default 0,
 is_default boolean not null default false,active boolean not null default true,capabilities text[] not null default '{}',revision int not null default 1,
 created_at timestamptz not null default now(),foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),
 unique(organization_id,id),unique(organization_id,gateway_id,id),unique(gateway_id,processor_reference)
);
create unique index giving_one_default_processor on public.giving_processor_routes(gateway_id) where active and is_default;
alter table public.giving_destinations drop constraint giving_destinations_provider_check;
alter table public.giving_destinations drop constraint giving_destinations_purpose_check;
alter table public.giving_destinations drop constraint giving_destinations_organization_id_purpose_key;
alter table public.giving_destinations add column legal_entity text not null default '',add column deposit_label text not null default '',
 add column active boolean not null default true,add column currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),
 add column gateway_id uuid,add column processor_route_id uuid,add column settlement_label text not null default '',add column internal_notes text not null default '',
 add column revision int not null default 1,
 add foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),
 add foreign key(organization_id,gateway_id,processor_route_id) references public.giving_processor_routes(organization_id,gateway_id,id),
 add check((gateway_id is null)=(processor_route_id is null));
-- Provider is retained as compatibility metadata; the gateway account is authoritative.
alter table public.giving_destinations add constraint giving_destinations_provider_check check(provider in('authorize_net','nmi','stripe_connect','paypal','square','external_connector'));
create table public.giving_fund_groups(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),name text not null check(length(btrim(name)) between 1 and 120),
 display_order int not null default 0,unique(organization_id,id),unique(organization_id,name)
);
alter table public.giving_funds add column parent_id uuid,add column group_id uuid,add column fund_type text not null default 'contribution',
 add column display_order int not null default 0,add column is_public boolean not null default false,add column tax_eligible boolean not null default false,
 add column accounting_code text not null default '',add column reporting_category text not null default '',add column starts_on date,add column ends_on date,
 add foreign key(organization_id,parent_id) references public.giving_funds(organization_id,id),
 add foreign key(organization_id,group_id) references public.giving_fund_groups(organization_id,id),add check(ends_on is null or starts_on is null or ends_on>=starts_on),add check(parent_id is distinct from id);
create index giving_fund_parent on public.giving_funds(organization_id,parent_id);
create table public.giving_organization_config(
 organization_id uuid primary key references public.organizations(id),giving_enabled boolean not null default false check(not giving_enabled),
 donor_portal_enabled boolean not null default false check(not donor_portal_enabled),text_enabled boolean not null default false check(not text_enabled),
 recurring_enabled boolean not null default false,pledges_enabled boolean not null default true,manual_enabled boolean not null default true,
 currency text not null default 'USD' check(currency ~ '^[A-Z]{3}$'),timezone text not null default 'UTC',minor_unit_scale smallint not null default 2 check(minor_unit_scale between 0 and 4),
 default_fund_id uuid,default_destination_id uuid,receipt_language text not null default '',statement_language text not null default '',
 fiscal_start_month int not null default 1 check(fiscal_start_month between 1 and 12),service_weekday int not null default 0 check(service_weekday between 0 and 6),
 service_boundary time not null default '00:00',donor_fee_option boolean not null default false,revision int not null default 1,
 foreign key(organization_id,default_fund_id) references public.giving_funds(organization_id,id),foreign key(organization_id,default_destination_id) references public.giving_destinations(organization_id,id)
);
create table public.giving_batches(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 kind text not null check(kind in('service','manual_deposit','processor_settlement')),label text not null check(length(btrim(label)) between 1 and 150),
 currency text not null check(currency ~ '^[A-Z]{3}$'),batch_date date not null,reference text not null default '',bank_destination_label text not null default '',
 status text not null default 'open' check(status in('open','reconciled','attention')),created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 unique(organization_id,id)
);
create table public.giving_sessions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid,household_id uuid,
 guest_reference text,anonymous_public boolean not null default false,currency text not null check(currency ~ '^[A-Z]{3}$'),
 intended_minor bigint not null check(intended_minor between 1 and 1000000000000),source text not null check(source ~ '^[a-z][a-z0-9_]{0,39}$'),channel text not null default 'web',
 status text not null default 'pending' check(status in('pending','processing','completed','partially_completed','failed','requires_attention','cancelled')),
 campaign_reference text,event_reference text,donor_fee_preference boolean not null default false,request_key uuid not null,
 created_by uuid references auth.users(id),created_at timestamptz not null default now(),completed_at timestamptz,
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 unique(organization_id,id),unique(organization_id,request_key)
);
create table public.giving_transaction_legs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,session_id uuid not null,amount_minor bigint not null check(amount_minor between 1 and 1000000000000),
 route_snapshot jsonb not null,route_key text not null,currency text not null check(currency ~ '^[A-Z]{3}$'),
 status text not null default 'created' check(status in('created','pending','authorized','captured','settled','failed','voided','partially_refunded','refunded','disputed')),
 provider_reference text,processor_fee_minor bigint check(processor_fee_minor>=0),platform_fee_minor bigint check(platform_fee_minor>=0),
 donor_fee_minor bigint check(donor_fee_minor>=0),net_settlement_minor bigint,
 created_at timestamptz not null default now(),foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),
 unique(organization_id,id),unique(organization_id,session_id,id),unique(session_id,route_key)
);
create unique index giving_provider_transaction_identity on public.giving_transaction_legs((route_snapshot->>'gateway_id'),(route_snapshot->>'processor_route_id'),provider_reference) where provider_reference is not null;
create table public.giving_session_lines(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,session_id uuid not null,leg_id uuid not null,fund_id uuid not null,
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),memo text not null default '' check(length(memo)<=500),route_snapshot jsonb not null,
 tax_eligible boolean not null,campaign_reference text,event_reference text,
 foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),foreign key(organization_id,session_id,leg_id) references public.giving_transaction_legs(organization_id,session_id,id),
 foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id),unique(organization_id,id)
);
create table public.giving_ledger(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid,household_id uuid,
 fund_id uuid not null,session_id uuid,leg_id uuid,line_id uuid,batch_id uuid,original_id uuid,
 kind text not null check(kind in('gift','reversal','reclassification','correction','refund')),amount_minor bigint not null check(amount_minor<>0 and abs(amount_minor)<=1000000000000),
 currency text not null check(currency ~ '^[A-Z]{3}$'),gift_at timestamptz not null,posted_at timestamptz not null default now(),
 source text not null,payment_method text not null check(payment_method in('card','ach','cash','check','external','other')),
 route_snapshot jsonb,tax_eligible boolean not null,anonymous_public boolean not null default false,recurring_id uuid,
 campaign_reference text,event_reference text,notes text not null default '' check(length(notes)<=1000),external_reference text,
 source_system text,external_transaction_id text,receipt_history_reference text,entered_by uuid references auth.users(id),posted_by uuid references auth.users(id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id),foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),
 foreign key(organization_id,leg_id) references public.giving_transaction_legs(organization_id,id),foreign key(organization_id,line_id) references public.giving_session_lines(organization_id,id),
 foreign key(organization_id,batch_id) references public.giving_batches(organization_id,id),unique(organization_id,id),foreign key(organization_id,original_id) references public.giving_ledger(organization_id,id),
 check((source_system is null)=(external_transaction_id is null)),check(kind<>'gift' or amount_minor>0)
);
create unique index giving_one_post_per_line on public.giving_ledger(line_id) where kind='gift' and line_id is not null;
create unique index giving_external_import_identity on public.giving_ledger(organization_id,source_system,external_transaction_id) where kind='gift' and source_system is not null;
create index giving_ledger_period on public.giving_ledger(organization_id,currency,gift_at,id);
create index giving_ledger_donor on public.giving_ledger(organization_id,person_id,gift_at);
create index giving_ledger_household on public.giving_ledger(organization_id,household_id,gift_at);
create index giving_ledger_batch on public.giving_ledger(organization_id,batch_id);
create table public.giving_pledges(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid,household_id uuid,fund_id uuid not null,
 amount_minor bigint not null check(amount_minor between 1 and 1000000000000),currency text not null check(currency ~ '^[A-Z]{3}$'),
 starts_on date not null,ends_on date,frequency text not null check(frequency in('weekly','biweekly','monthly','custom','none')),
 status text not null default 'active' check(status in('active','completed','cancelled','paused','written_off','closed')),campaign_reference text,notes text not null default '',
 source text not null default 'staff_manual',created_by uuid references auth.users(id),revision int not null default 1,created_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id),unique(organization_id,id),check(person_id is not null or household_id is not null),check(ends_on is null or ends_on>=starts_on)
);
create table public.giving_pledge_schedule(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,pledge_id uuid not null,due_on date not null,expected_minor bigint not null check(expected_minor>0),
 foreign key(organization_id,pledge_id) references public.giving_pledges(organization_id,id),unique(pledge_id,due_on)
);
create table public.giving_pledge_allocations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,pledge_id uuid not null,gift_id uuid not null,amount_minor bigint not null check(amount_minor>0),
 request_key uuid not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,pledge_id) references public.giving_pledges(organization_id,id),foreign key(organization_id,gift_id) references public.giving_ledger(organization_id,id),unique(organization_id,request_key)
);
-- Tokens are kept in a private schema, never joined into staff/report projections.
create table private.giving_payment_profiles(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,person_id uuid not null,gateway_id uuid not null,
 provider_customer_reference text not null,provider_payment_reference text not null,method text not null check(method in('card','ach')),
 descriptor text not null check(length(descriptor)<=100),active boolean not null default true,
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),unique(organization_id,id),unique(organization_id,gateway_id,provider_customer_reference,provider_payment_reference)
);
alter table private.giving_payment_profiles enable row level security;
revoke all on private.giving_payment_profiles from public,anon,authenticated,service_role;
create table public.giving_recurring_instructions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,person_id uuid not null,household_id uuid,currency text not null check(currency ~ '^[A-Z]{3}$'),
 frequency text not null check(frequency in('weekly','biweekly','monthly','twice_monthly','custom')),starts_on date not null,ends_on date,next_run_at timestamptz not null,
 status text not null default 'draft' check(status in('draft','active','paused','cancelled','failed','completed')),
 payment_profile_id uuid,provider_schedule_reference text,failure_state text,revision int not null default 1,created_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 foreign key(organization_id,payment_profile_id) references private.giving_payment_profiles(organization_id,id),unique(organization_id,id),check(ends_on is null or ends_on>=starts_on)
);
create table public.giving_recurring_lines(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,instruction_id uuid not null,fund_id uuid not null,amount_minor bigint not null check(amount_minor>0),route_snapshot jsonb not null,
 foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id),foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id)
);
create table public.giving_recurring_runs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,instruction_id uuid not null,scheduled_at timestamptz not null,claim_token uuid not null default gen_random_uuid(),
 status text not null default 'held' check(status in('held','completed','requires_attention')),created_at timestamptz not null default now(),
 foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id),unique(instruction_id,scheduled_at)
);
create table public.giving_refunds(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,leg_id uuid not null,amount_minor bigint not null check(amount_minor>0),
 kind text not null check(kind in('refund','void','dispute')),status text not null default 'requested' check(status in('requested','recorded','failed')),
 reason text not null check(length(btrim(reason)) between 5 and 500),request_key uuid not null,created_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,leg_id) references public.giving_transaction_legs(organization_id,id),unique(organization_id,request_key),unique(organization_id,id)
);
-- Settlement membership is append-only: existing gifts are never rewritten into a batch.
create table public.giving_batch_entries(
 organization_id uuid not null,batch_id uuid not null,ledger_id uuid not null,added_by uuid references auth.users(id),added_at timestamptz not null default now(),
 primary key(ledger_id),foreign key(organization_id,batch_id) references public.giving_batches(organization_id,id),foreign key(organization_id,ledger_id) references public.giving_ledger(organization_id,id)
);
create table public.giving_refund_outcomes(
 refund_id uuid primary key references public.giving_refunds(id),organization_id uuid not null,gateway_id uuid not null,provider_reference text not null,payload_digest text not null,recorded_at timestamptz not null default now(),
 foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),unique(gateway_id,provider_reference)
);
create table public.giving_reconciliations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,batch_id uuid not null,ledger_minor bigint not null,
 settlement_minor bigint not null,deposit_minor bigint not null,difference_minor bigint not null,status text not null check(status in('balanced','attention')),
 notes text not null default '',reconciled_by uuid references auth.users(id),reconciled_at timestamptz not null default now(),
 foreign key(organization_id,batch_id) references public.giving_batches(organization_id,id),unique(batch_id)
);
create table public.giving_receipts(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,session_id uuid not null,person_id uuid,receipt_number text not null,
 version int not null default 1,snapshot jsonb not null,delivery_status text not null default 'held' check(delivery_status='held'),email_reference uuid,
 generated_at timestamptz not null default now(),foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),unique(session_id,version),unique(organization_id,receipt_number)
);
create table public.giving_statements(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),person_id uuid,household_id uuid,
 starts_at timestamptz not null,ends_at timestamptz not null,currency text not null check(currency ~ '^[A-Z]{3}$'),version int not null default 1,
 snapshot jsonb not null,generated_by uuid references auth.users(id),generated_at timestamptz not null default now(),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 check(ends_at>starts_at),check((person_id is null)<>(household_id is null))
);
create table public.giving_text_scopes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),sender_scope text not null unique check(sender_scope ~ '^[a-z0-9_-]{1,80}$'),
 active boolean not null default false,unique(organization_id,id)
);
create table public.giving_text_keywords(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,scope_id uuid not null,keyword text not null check(keyword ~ '^[A-Z][A-Z0-9]{0,29}$'),
 display_name text not null,fund_id uuid not null,destination_override_id uuid,default_minor bigint check(default_minor>0),active boolean not null default true,
 starts_at timestamptz,ends_at timestamptz,confirmation_template_reference uuid,landing_page text,reporting_category text not null default '',accounting_code text not null default '',
 attribution text,owner_user_id uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,scope_id) references public.giving_text_scopes(organization_id,id),foreign key(organization_id,fund_id) references public.giving_funds(organization_id,id),
 foreign key(organization_id,destination_override_id) references public.giving_destinations(organization_id,id),check(ends_at is null or starts_at is null or ends_at>starts_at)
);
create unique index giving_keyword_collision on public.giving_text_keywords(scope_id,keyword) where active;
create table public.giving_provider_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,gateway_id uuid not null,event_reference text not null,
 leg_id uuid not null,outcome text not null,payload_digest text not null,financial_snapshot jsonb not null default '{}',received_at timestamptz not null default now(),
 foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id),foreign key(organization_id,leg_id) references public.giving_transaction_legs(organization_id,id),
 unique(gateway_id,event_reference)
);
create table public.giving_requests(
 organization_id uuid not null references public.organizations(id),operation text not null,request_key uuid not null,payload jsonb not null,result jsonb not null,
 created_at timestamptz not null default now(),primary key(organization_id,operation,request_key)
);
create table public.giving_audit(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),actor_user_id uuid references auth.users(id),
 action text not null,subject_id uuid,safe_detail jsonb not null default '{}',created_at timestamptz not null default now()
);
create index giving_audit_org on public.giving_audit(organization_id,created_at,id);
-- RPC-only public financial relations; no table-reading client policy or service shortcut.
do $$declare r record;begin for r in select tablename from pg_tables where schemaname='public' and tablename like 'giving_%' loop
 execute format('alter table public.%I enable row level security',r.tablename);
 execute format('revoke all on public.%I from public,anon,authenticated,service_role',r.tablename);
end loop;end$$;
-- Keep historical audit functions but replace their direct browser mutation boundary.
drop trigger guard_giving_funds on public.giving_funds;
drop trigger guard_giving_routes on public.giving_form_routes;
create function private.giving_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Financial history is append-only' using errcode='42501';end$$;
do $$declare t text;begin foreach t in array array['giving_refund_outcomes','giving_recurring_lines','giving_batch_entries','giving_ledger','giving_session_lines','giving_pledge_allocations','giving_receipts','giving_statements','giving_audit','giving_requests','giving_provider_events','giving_reconciliations','giving_recurring_runs','giving_configuration_events'] loop
 execute format('create trigger giving_immutable before update or delete on public.%I for each row execute function private.giving_immutable()',t);
end loop;end$$;
create function private.giving_frozen_leg() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (new.organization_id,new.session_id,new.route_snapshot,new.route_key,new.currency) is distinct from (old.organization_id,old.session_id,old.route_snapshot,old.route_key,old.currency)
 or (new.amount_minor<>old.amount_minor and coalesce(current_setting('giving.build_session',true),'')<>'on') then raise exception 'Transaction principal and route are frozen' using errcode='42501';end if;
 if old.provider_reference is not null and new.provider_reference is distinct from old.provider_reference then raise exception 'Provider transaction identity is frozen' using errcode='42501';end if;return new;
end$$;
create trigger giving_frozen_leg before update or delete on public.giving_transaction_legs for each row execute function private.giving_frozen_leg();
create function private.giving_frozen_session() returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-'status'-'completed_at') is distinct from (to_jsonb(old)-'status'-'completed_at') then raise exception 'Session intent is frozen' using errcode='42501';end if;return new;
end$$;
create trigger giving_frozen_session before update or delete on public.giving_sessions for each row execute function private.giving_frozen_session();
create function private.giving_lock(p_org uuid) returns void language sql volatile set search_path='' as $$select pg_advisory_xact_lock(hashtextextended('giving:'||p_org::text,0))$$;
create function private.giving_authorized(p_org uuid,p_permission text) returns boolean language sql volatile security definer set search_path='' as $$
 select private.has_staff_permission(p_org,p_permission) and exists(select 1 from auth.users where id=auth.uid() and email_confirmed_at is not null and not coalesce(is_anonymous,false))
$$;
create function private.giving_audit_event(p_org uuid,p_action text,p_id uuid,p_detail jsonb default '{}') returns void language sql security definer set search_path='' as $$
 insert into public.giving_audit(organization_id,actor_user_id,action,subject_id,safe_detail) values(p_org,auth.uid(),p_action,p_id,p_detail)
$$;
create function private.giving_route(p_org uuid,p_fund uuid,p_override uuid default null) returns jsonb language plpgsql security definer set search_path='' as $$
declare f public.giving_funds;d public.giving_destinations;g public.giving_gateway_accounts;r public.giving_processor_routes;
begin
 select * into f from public.giving_funds where organization_id=p_org and id=p_fund and status='active' and (starts_on is null or starts_on<=current_date) and (ends_on is null or ends_on>=current_date);
 if not found then raise exception 'Fund unavailable' using errcode='22023';end if;
 select * into d from public.giving_destinations where organization_id=p_org and id=coalesce(p_override,f.destination_id) and active;
 if not found or d.gateway_id is null then raise exception 'Merchant route incomplete' using errcode='22023';end if;
 select * into g from public.giving_gateway_accounts where organization_id=p_org and id=d.gateway_id;
 select * into r from public.giving_processor_routes where organization_id=p_org and id=d.processor_route_id and gateway_id=g.id and active;
 if not found then raise exception 'Processor route unavailable' using errcode='22023';end if;
 return jsonb_build_object('destination_id',d.id,'destination_revision',d.revision,'destination_label',d.merchant_label,'gateway_id',g.id,'gateway_revision',g.revision,
 'provider',g.provider,'environment',g.environment,'processor_route_id',r.id,'processor_revision',r.revision,'processor_reference',r.processor_reference,'mid_reference',r.mid_reference,
 'settlement_label',r.settlement_label,'currency',d.currency,'fund_id',f.id,'fund_revision',f.revision);
end$$;
create function private.giving_identity(p_org uuid,p_person uuid,p_household uuid) returns void language plpgsql security definer set search_path='' as $$begin
 if p_person is not null and not exists(select 1 from public.organization_people where organization_id=p_org and id=p_person) then raise exception 'Donor unavailable' using errcode='22023';end if;
 if p_household is not null and not exists(select 1 from public.households where organization_id=p_org and id=p_household and status='active') then raise exception 'Household unavailable' using errcode='22023';end if;
 if p_person is not null and p_household is not null and not exists(select 1 from public.household_members where organization_id=p_org and household_id=p_household and person_id=p_person and active) then raise exception 'Reviewed donor household membership required' using errcode='22023';end if;
end$$;

create function private.giving_payload(p jsonb,allowed text[]) returns void language plpgsql set search_path='' as $$begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 or exists(select 1 from jsonb_object_keys(p) k where not k=any(allowed)) then raise exception 'Unsupported financial request fields' using errcode='22023';end if;
end$$;
create function private.giving_configure(o uuid,a text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;identifier uuid:=(p->>'id')::uuid;parent uuid:=(p->>'parent_id')::uuid;row_f public.giving_funds;destination public.giving_destinations;gateway public.giving_gateway_accounts;
begin
 if a='config_save' then
 perform private.giving_payload(p,array['timezone','currency','minor_unit_scale','recurring_enabled','pledges_enabled','manual_enabled','default_fund_id','default_destination_id','receipt_language','statement_language','fiscal_start_month','service_weekday','service_boundary','donor_fee_option']);
 if not exists(select 1 from pg_timezone_names where name=coalesce(p->>'timezone','UTC')) then raise exception 'Unknown timezone';end if;
 insert into public.giving_organization_config(organization_id,timezone,currency,minor_unit_scale,recurring_enabled,pledges_enabled,manual_enabled,default_fund_id,default_destination_id,receipt_language,statement_language,fiscal_start_month,service_weekday,service_boundary,donor_fee_option)
 values(o,coalesce(p->>'timezone','UTC'),coalesce(p->>'currency','USD'),coalesce((p->>'minor_unit_scale')::smallint,2),coalesce((p->>'recurring_enabled')::boolean,false),coalesce((p->>'pledges_enabled')::boolean,true),coalesce((p->>'manual_enabled')::boolean,true),(p->>'default_fund_id')::uuid,(p->>'default_destination_id')::uuid,coalesce(p->>'receipt_language',''),coalesce(p->>'statement_language',''),coalesce((p->>'fiscal_start_month')::int,1),coalesce((p->>'service_weekday')::int,0),coalesce((p->>'service_boundary')::time,'00:00'),coalesce((p->>'donor_fee_option')::boolean,false))
 on conflict(organization_id) do update set timezone=excluded.timezone,currency=excluded.currency,minor_unit_scale=excluded.minor_unit_scale,recurring_enabled=excluded.recurring_enabled,pledges_enabled=excluded.pledges_enabled,manual_enabled=excluded.manual_enabled,default_fund_id=excluded.default_fund_id,default_destination_id=excluded.default_destination_id,receipt_language=excluded.receipt_language,statement_language=excluded.statement_language,fiscal_start_month=excluded.fiscal_start_month,service_weekday=excluded.service_weekday,service_boundary=excluded.service_boundary,donor_fee_option=excluded.donor_fee_option,revision=giving_organization_config.revision+1 returning to_jsonb(giving_organization_config.*) into result;
 elsif a='group_create' then
 perform private.giving_payload(p,array['name','display_order']);insert into public.giving_fund_groups(organization_id,name,display_order) values(o,btrim(p->>'name'),coalesce((p->>'display_order')::int,0)) returning to_jsonb(giving_fund_groups.*) into result;
 elsif a in('fund_create','fund_update') then
 perform private.giving_payload(p,array['id','revision','name','code','description','destination_id','parent_id','group_id','fund_type','display_order','is_public','tax_eligible','accounting_code','reporting_category','starts_on','ends_on','status']);
 if parent is not null and not exists(select 1 from public.giving_funds where organization_id=o and id=parent and parent_id is null and status='active') then raise exception 'Choose a top-level parent fund';end if;
 if a='fund_update' then select * into row_f from public.giving_funds where organization_id=o and id=identifier;
 if not found or row_f.revision is distinct from (p->>'revision')::int then raise exception 'Fund changed or unavailable' using errcode='40001';end if;
 if parent is not null and exists(select 1 from public.giving_funds where organization_id=o and parent_id=identifier) then raise exception 'Parent with children cannot be nested';end if;
 update public.giving_funds set name=coalesce(p->>'name',name),description=coalesce(p->>'description',description),destination_id=coalesce((p->>'destination_id')::uuid,destination_id),parent_id=case when p?'parent_id' then parent else parent_id end,
 group_id=case when p?'group_id' then (p->>'group_id')::uuid else group_id end,status=coalesce(p->>'status',status),fund_type=coalesce(p->>'fund_type',fund_type),display_order=coalesce((p->>'display_order')::int,display_order),is_public=coalesce((p->>'is_public')::boolean,is_public),tax_eligible=coalesce((p->>'tax_eligible')::boolean,tax_eligible),accounting_code=coalesce(p->>'accounting_code',accounting_code),reporting_category=coalesce(p->>'reporting_category',reporting_category),starts_on=case when p?'starts_on' then (p->>'starts_on')::date else starts_on end,ends_on=case when p?'ends_on' then (p->>'ends_on')::date else ends_on end,revision=revision+1,updated_at=clock_timestamp() where organization_id=o and id=identifier returning to_jsonb(giving_funds.*) into result;
 else insert into public.giving_funds(organization_id,destination_id,name,code,description,parent_id,group_id,fund_type,display_order,is_public,tax_eligible,accounting_code,reporting_category,starts_on,ends_on)
 values(o,(p->>'destination_id')::uuid,btrim(p->>'name'),p->>'code',coalesce(p->>'description',''),parent,(p->>'group_id')::uuid,coalesce(p->>'fund_type','contribution'),coalesce((p->>'display_order')::int,0),coalesce((p->>'is_public')::boolean,false),coalesce((p->>'tax_eligible')::boolean,false),coalesce(p->>'accounting_code',''),coalesce(p->>'reporting_category',''),(p->>'starts_on')::date,(p->>'ends_on')::date) returning to_jsonb(giving_funds.*) into result;end if;
 elsif a='gateway_create' then
 perform private.giving_payload(p,array['provider','label','environment','nonsecret_account_reference','capabilities']);insert into public.giving_gateway_accounts(organization_id,provider,label,environment,nonsecret_account_reference,capabilities)
 values(o,p->>'provider',p->>'label',coalesce(p->>'environment','sandbox'),p->>'nonsecret_account_reference',array(select jsonb_array_elements_text(coalesce(p->'capabilities','[]')))) returning to_jsonb(giving_gateway_accounts.*) into result;
 elsif a='processor_create' then
 perform private.giving_payload(p,array['gateway_id','label','processor_reference','mid_reference','settlement_label','descriptor','priority','is_default','capabilities']);
 insert into public.giving_processor_routes(organization_id,gateway_id,label,processor_reference,mid_reference,settlement_label,descriptor,priority,is_default,capabilities)
 values(o,(p->>'gateway_id')::uuid,p->>'label',p->>'processor_reference',p->>'mid_reference',coalesce(p->>'settlement_label',''),coalesce(p->>'descriptor',''),coalesce((p->>'priority')::int,0),coalesce((p->>'is_default')::boolean,false),array(select jsonb_array_elements_text(coalesce(p->'capabilities','[]')))) returning to_jsonb(giving_processor_routes.*) into result;
 elsif a in('destination_create','destination_update') then
 perform private.giving_payload(p,array['id','revision','purpose','label','legal_entity','deposit_label','currency','gateway_id','processor_route_id','settlement_label','internal_notes','active']);
 select * into gateway from public.giving_gateway_accounts where organization_id=o and id=(p->>'gateway_id')::uuid;
 if not found then raise exception 'Gateway unavailable';end if;
 if a='destination_update' then
 select * into destination from public.giving_destinations where organization_id=o and id=identifier;
 if not found or destination.revision is distinct from (p->>'revision')::int then raise exception 'Destination changed or unavailable' using errcode='40001';end if;
 update public.giving_destinations set merchant_label=coalesce(p->>'label',merchant_label),legal_entity=coalesce(p->>'legal_entity',legal_entity),deposit_label=coalesce(p->>'deposit_label',deposit_label),currency=coalesce(p->>'currency',currency),gateway_id=gateway.id,processor_route_id=(p->>'processor_route_id')::uuid,provider=gateway.provider,settlement_label=coalesce(p->>'settlement_label',settlement_label),internal_notes=coalesce(p->>'internal_notes',internal_notes),active=coalesce((p->>'active')::boolean,active),revision=revision+1 where organization_id=o and id=identifier returning to_jsonb(giving_destinations.*) into result;
 else insert into public.giving_destinations(organization_id,purpose,provider,checkout_label,merchant_label,legal_entity,deposit_label,currency,gateway_id,processor_route_id,settlement_label,internal_notes)
 values(o,coalesce(p->>'purpose','giving'),gateway.provider,p->>'label',p->>'label',coalesce(p->>'legal_entity',''),coalesce(p->>'deposit_label',''),coalesce(p->>'currency','USD'),gateway.id,(p->>'processor_route_id')::uuid,coalesce(p->>'settlement_label',''),coalesce(p->>'internal_notes','')) returning to_jsonb(giving_destinations.*) into result;end if;
 elsif a='text_scope_create' then
 perform private.giving_payload(p,array['sender_scope']);insert into public.giving_text_scopes(organization_id,sender_scope) values(o,p->>'sender_scope') returning to_jsonb(giving_text_scopes.*) into result;
 elsif a='keyword_create' then
 perform private.giving_payload(p,array['scope_id','keyword','display_name','fund_id','destination_override_id','default_minor','starts_at','ends_at','confirmation_template_reference','landing_page','reporting_category','accounting_code','attribution']);
 perform private.giving_route(o,(p->>'fund_id')::uuid,(p->>'destination_override_id')::uuid);
 if p->>'landing_page' is not null and p->>'landing_page' !~ '^/[a-zA-Z0-9/_-]+(\.html)?$' then raise exception 'Same-site safe landing path required';end if;
 insert into public.giving_text_keywords(organization_id,scope_id,keyword,display_name,fund_id,destination_override_id,default_minor,starts_at,ends_at,confirmation_template_reference,landing_page,reporting_category,accounting_code,attribution,owner_user_id)
 values(o,(p->>'scope_id')::uuid,upper(p->>'keyword'),p->>'display_name',(p->>'fund_id')::uuid,(p->>'destination_override_id')::uuid,(p->>'default_minor')::bigint,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,(p->>'confirmation_template_reference')::uuid,p->>'landing_page',coalesce(p->>'reporting_category',''),coalesce(p->>'accounting_code',''),p->>'attribution',auth.uid()) returning to_jsonb(giving_text_keywords.*) into result;
 else raise exception 'Unknown configuration action';end if;
 perform private.giving_audit_event(o,a,coalesce((result->>'id')::uuid,o),jsonb_build_object('revision',result->'revision'));
 return result;
end$$;

create function private.giving_create_session(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare identifier uuid;leg uuid;line jsonb;route jsonb;routekey text;sum_minor bigint:=0;cur text:=p->>'currency';amount bigint;existing public.giving_requests;
begin
 perform private.giving_payload(p,array['request_key','person_id','household_id','guest_reference','anonymous_public','currency','intended_minor','source','channel','campaign_reference','event_reference','donor_fee_preference','lines']);
 if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines') not between 1 and 30 then raise exception 'One to thirty gift lines required';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 select * into existing from public.giving_requests where organization_id=o and operation='session_create' and request_key=(p->>'request_key')::uuid;
 if found then if existing.payload<>p then raise exception 'Idempotency key reused with changed content';end if;return existing.result;end if;
 insert into public.giving_sessions(organization_id,person_id,household_id,guest_reference,anonymous_public,currency,intended_minor,source,channel,campaign_reference,event_reference,donor_fee_preference,request_key,created_by)
 values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,p->>'guest_reference',coalesce((p->>'anonymous_public')::boolean,false),cur,(p->>'intended_minor')::bigint,coalesce(p->>'source','web'),coalesce(p->>'channel','web'),p->>'campaign_reference',p->>'event_reference',coalesce((p->>'donor_fee_preference')::boolean,false),(p->>'request_key')::uuid,auth.uid()) returning id into identifier;
 perform set_config('giving.build_session','on',true);
 for line in select value from jsonb_array_elements(p->'lines') loop
 perform private.giving_payload(line,array['fund_id','amount_minor','memo','destination_override_id','campaign_reference','event_reference']);amount:=(line->>'amount_minor')::bigint;
 route:=private.giving_route(o,(line->>'fund_id')::uuid,(line->>'destination_override_id')::uuid);
 if cur<>route->>'currency' then raise exception 'Session and destination currency differ';end if;
 routekey:=concat(route->>'destination_id',':',route->>'gateway_id',':',route->>'processor_route_id');
 insert into public.giving_transaction_legs(organization_id,session_id,amount_minor,route_snapshot,route_key,currency) values(o,identifier,amount,route,routekey,cur)
 on conflict(session_id,route_key) do update set amount_minor=giving_transaction_legs.amount_minor+excluded.amount_minor returning id into leg;
 insert into public.giving_session_lines(organization_id,session_id,leg_id,fund_id,amount_minor,memo,route_snapshot,tax_eligible,campaign_reference,event_reference)
 select o,identifier,leg,id,amount,coalesce(line->>'memo',''),route,tax_eligible,coalesce(line->>'campaign_reference',p->>'campaign_reference'),coalesce(line->>'event_reference',p->>'event_reference') from public.giving_funds where organization_id=o and id=(line->>'fund_id')::uuid;
 sum_minor:=sum_minor+amount;
 end loop;
 perform set_config('giving.build_session','off',true);
 if sum_minor<>(p->>'intended_minor')::bigint then raise exception 'Gift lines do not equal intended total';end if;
 insert into public.giving_requests values(o,'session_create',(p->>'request_key')::uuid,p,jsonb_build_object('id',identifier),now());
 perform private.giving_audit_event(o,'session.created',identifier);
 return jsonb_build_object('id',identifier);
end$$;

create function private.giving_post_session(o uuid,identifier uuid) returns jsonb language plpgsql security definer set search_path='' as $$
declare s public.giving_sessions;success int;fail int;waiting int;nextstate text;
begin
 select * into s from public.giving_sessions where organization_id=o and id=identifier;
 if not found then raise exception 'Session unavailable';end if;
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,session_id,leg_id,line_id,kind,amount_minor,currency,gift_at,source,payment_method,route_snapshot,tax_eligible,anonymous_public,campaign_reference,event_reference,entered_by,posted_by)
 select o,s.person_id,s.household_id,l.fund_id,s.id,l.leg_id,l.id,'gift',l.amount_minor,s.currency,s.created_at,s.source,'card',l.route_snapshot,l.tax_eligible,s.anonymous_public,l.campaign_reference,l.event_reference,s.created_by,auth.uid()
 from public.giving_session_lines l join public.giving_transaction_legs t on t.organization_id=l.organization_id and t.id=l.leg_id
 where l.organization_id=o and l.session_id=s.id and t.status in('captured','settled','partially_refunded','refunded','disputed')
 on conflict(line_id) where kind='gift' and line_id is not null do nothing;
 select count(*) filter(where status in('captured','settled','partially_refunded','refunded','disputed')),count(*) filter(where status in('failed','voided')),count(*) filter(where status in('created','pending','authorized')) into success,fail,waiting from public.giving_transaction_legs where organization_id=o and session_id=s.id;
 nextstate:=case when waiting>0 and success>0 then 'processing' when waiting>0 then 'pending' when success>0 and fail>0 then 'partially_completed' when success>0 then 'completed' else 'failed' end;
 if s.status<>nextstate then update public.giving_sessions set status=nextstate,completed_at=case when waiting=0 then clock_timestamp() else null end where organization_id=o and id=s.id;perform private.giving_audit_event(o,'session.'||nextstate,s.id);end if;
 return jsonb_build_object('id',s.id,'status',nextstate,'posted_legs',success,'failed_legs',fail);
end$$;

create function private.giving_manual(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;existing public.giving_requests;f public.giving_funds;b public.giving_batches;identifier uuid;prior public.giving_ledger;
begin
 perform private.giving_payload(p,array['request_key','person_id','household_id','fund_id','amount_minor','currency','gift_at','gift_local','payment_method','batch_id','notes','external_reference','source_system','external_transaction_id','receipt_history_reference','anonymous_public','campaign_reference','event_reference']);
 if p?'gift_local' then if p?'gift_at' then raise exception 'Choose a received timestamp or local date/time';end if;p:=(p-'gift_local')||jsonb_build_object('gift_at',((p->>'gift_local')::timestamp at time zone(select timezone from public.giving_organization_config where organization_id=o)));end if;
 if not coalesce((select manual_enabled from public.giving_organization_config where organization_id=o),false) then raise exception 'Manual entry is disabled';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 select * into existing from public.giving_requests where organization_id=o and operation='manual' and request_key=(p->>'request_key')::uuid;
 if found then if existing.payload<>p then raise exception 'Idempotency key reused with changed content';end if;return existing.result;end if;
 if p->>'payment_method' not in('cash','check','ach','external','other') then raise exception 'Manual card input prohibited; use external reference only';end if;
 if p->>'payment_method' in('check','ach','external') and length(btrim(coalesce(p->>'external_reference','')))=0 then raise exception 'External payment reference required';end if;
 select * into f from public.giving_funds where organization_id=o and id=(p->>'fund_id')::uuid and status='active';if not found then raise exception 'Fund unavailable';end if;
 select * into b from public.giving_batches where organization_id=o and id=(p->>'batch_id')::uuid and status='open';if not found or b.currency<>p->>'currency' then raise exception 'Open same-currency batch required';end if;
 if p->>'source_system' is not null then
 select * into prior from public.giving_ledger where organization_id=o and source_system=p->>'source_system' and external_transaction_id=p->>'external_transaction_id' and kind='gift';
 if found then if prior.amount_minor<>(p->>'amount_minor')::bigint or prior.fund_id<>(p->>'fund_id')::uuid or prior.person_id is distinct from (p->>'person_id')::uuid or prior.currency<>p->>'currency' or prior.gift_at<>(p->>'gift_at')::timestamptz or prior.household_id is distinct from (p->>'household_id')::uuid or prior.payment_method is distinct from p->>'payment_method' or prior.external_reference is distinct from p->>'external_reference' or prior.receipt_history_reference is distinct from p->>'receipt_history_reference' or prior.notes is distinct from coalesce(p->>'notes','') or prior.anonymous_public is distinct from coalesce((p->>'anonymous_public')::boolean,false) or prior.campaign_reference is distinct from p->>'campaign_reference' or prior.event_reference is distinct from p->>'event_reference' then raise exception 'Historical source key conflicts with existing gift';end if;return jsonb_build_object('id',prior.id,'duplicate',true);end if;end if;
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,batch_id,kind,amount_minor,currency,gift_at,source,payment_method,tax_eligible,notes,external_reference,source_system,external_transaction_id,receipt_history_reference,anonymous_public,campaign_reference,event_reference,entered_by,posted_by)
 values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,f.id,b.id,'gift',(p->>'amount_minor')::bigint,p->>'currency',(p->>'gift_at')::timestamptz,case when p->>'source_system' is null then 'staff_manual' else 'import' end,p->>'payment_method',f.tax_eligible,coalesce(p->>'notes',''),p->>'external_reference',p->>'source_system',p->>'external_transaction_id',p->>'receipt_history_reference',coalesce((p->>'anonymous_public')::boolean,false),p->>'campaign_reference',p->>'event_reference',auth.uid(),auth.uid()) returning id into identifier;
 result:=jsonb_build_object('id',identifier);insert into public.giving_requests values(o,'manual',(p->>'request_key')::uuid,p,result,now());perform private.giving_audit_event(o,'gift.manual',identifier,jsonb_build_object('method',p->>'payment_method'));return result;
end$$;

create function private.giving_financial_action(o uuid,a text,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;identifier uuid:=(p->>'id')::uuid;gift public.giving_ledger;pledge public.giving_pledges;leg public.giving_transaction_legs;batch public.giving_batches;
 s public.giving_sessions;fund public.giving_funds;line jsonb;route jsonb;amount bigint;used bigint;available bigint;replacement uuid;negative uuid;
begin
 if a='batch_create' then
 perform private.giving_payload(p,array['request_key','kind','label','currency','batch_date','reference','bank_destination_label']);
 insert into public.giving_batches(organization_id,kind,label,currency,batch_date,reference,bank_destination_label,created_by) values(o,p->>'kind',p->>'label',p->>'currency',(p->>'batch_date')::date,coalesce(p->>'reference',''),coalesce(p->>'bank_destination_label',''),auth.uid()) returning to_jsonb(giving_batches.*) into result;
 elsif a='pledge_create' then
 perform private.giving_payload(p,array['request_key','person_id','household_id','fund_id','amount_minor','currency','starts_on','ends_on','frequency','campaign_reference','notes','schedule']);
 if not coalesce((select pledges_enabled from public.giving_organization_config where organization_id=o),false) then raise exception 'Pledges disabled';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 insert into public.giving_pledges(organization_id,person_id,household_id,fund_id,amount_minor,currency,starts_on,ends_on,frequency,campaign_reference,notes,created_by)
 values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,(p->>'fund_id')::uuid,(p->>'amount_minor')::bigint,p->>'currency',(p->>'starts_on')::date,(p->>'ends_on')::date,p->>'frequency',p->>'campaign_reference',coalesce(p->>'notes',''),auth.uid()) returning id into identifier;
 for line in select value from jsonb_array_elements(coalesce(p->'schedule','[]')) loop
 perform private.giving_payload(line,array['due_on','expected_minor']);insert into public.giving_pledge_schedule(organization_id,pledge_id,due_on,expected_minor) values(o,identifier,(line->>'due_on')::date,(line->>'expected_minor')::bigint);end loop;
 result:=jsonb_build_object('id',identifier);
 elsif a='pledge_status' then
 perform private.giving_payload(p,array['request_key','id','revision','status','notes']);
 update public.giving_pledges set status=p->>'status',notes=coalesce(p->>'notes',notes),revision=revision+1 where organization_id=o and id=identifier and revision=(p->>'revision')::int returning to_jsonb(giving_pledges.*) into result;
 if result is null then raise exception 'Pledge changed or unavailable' using errcode='40001';end if;
 elsif a='allocate' then
 perform private.giving_payload(p,array['request_key','pledge_id','gift_id','amount_minor']);amount:=(p->>'amount_minor')::bigint;
 select * into pledge from public.giving_pledges where organization_id=o and id=(p->>'pledge_id')::uuid and status='active';
 select * into gift from public.giving_ledger where organization_id=o and id=(p->>'gift_id')::uuid and kind='gift';
 if pledge.id is null or gift.id is null or gift.currency<>pledge.currency or gift.fund_id<>pledge.fund_id or not((pledge.person_id is not null and gift.person_id=pledge.person_id) or (pledge.household_id is not null and gift.household_id=pledge.household_id)) then raise exception 'Same-donor, fund and currency allocation required';end if;
 select gift.amount_minor+coalesce(sum(amount_minor),0) into available from public.giving_ledger where organization_id=o and original_id=gift.id;
 select coalesce(sum(amount_minor),0) into used from public.giving_pledge_allocations where organization_id=o and gift_id=gift.id;
 if amount is null or amount<=0 or amount>available-used then raise exception 'Gift allocation exceeds unallocated principal' using errcode='23514';end if;
 -- Pledge overage is retained; the same gift principal cannot be allocated twice.
 insert into public.giving_pledge_allocations(organization_id,pledge_id,gift_id,amount_minor,request_key,created_by) values(o,pledge.id,gift.id,amount,(p->>'request_key')::uuid,auth.uid()) returning to_jsonb(giving_pledge_allocations.*) into result;
 elsif a='recurring_create' then
 perform private.giving_payload(p,array['request_key','person_id','household_id','currency','frequency','starts_on','ends_on','next_run_at','payment_profile_id','lines']);
 if not coalesce((select recurring_enabled from public.giving_organization_config where organization_id=o),false) then raise exception 'Recurring model disabled';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 if jsonb_typeof(p->'lines')<>'array' or jsonb_array_length(p->'lines') not between 1 and 30 then raise exception 'Recurring gift lines required';end if;
 if p->>'payment_profile_id' is not null and not exists(select 1 from private.giving_payment_profiles where organization_id=o and id=(p->>'payment_profile_id')::uuid and person_id=(p->>'person_id')::uuid and active) then raise exception 'Donor payment profile unavailable';end if;
 insert into public.giving_recurring_instructions(organization_id,person_id,household_id,currency,frequency,starts_on,ends_on,next_run_at,payment_profile_id)
 values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,p->>'currency',p->>'frequency',(p->>'starts_on')::date,(p->>'ends_on')::date,(p->>'next_run_at')::timestamptz,(p->>'payment_profile_id')::uuid) returning id into identifier;
 for line in select value from jsonb_array_elements(p->'lines') loop
 perform private.giving_payload(line,array['fund_id','amount_minor','destination_override_id']);route:=private.giving_route(o,(line->>'fund_id')::uuid,(line->>'destination_override_id')::uuid);
 if route->>'currency'<>p->>'currency' then raise exception 'Recurring currency mismatch';end if;
 insert into public.giving_recurring_lines(organization_id,instruction_id,fund_id,amount_minor,route_snapshot) values(o,identifier,(line->>'fund_id')::uuid,(line->>'amount_minor')::bigint,route);end loop;
 result:=jsonb_build_object('id',identifier,'status','draft');
 elsif a='recurring_status' then
 perform private.giving_payload(p,array['request_key','id','revision','status']);
 if p->>'status' not in('draft','paused','cancelled') then raise exception 'Processor activation is a later gate';end if;
 update public.giving_recurring_instructions set status=p->>'status',revision=revision+1 where organization_id=o and id=identifier and revision=(p->>'revision')::int returning to_jsonb(giving_recurring_instructions.*)-'payment_profile_id'-'provider_schedule_reference' into result;
 if result is null then raise exception 'Recurring instruction changed or unavailable';end if;
 elsif a='adjust' then
 perform private.giving_payload(p,array['request_key','id','reason','replacement_fund_id','replacement_person_id','replacement_household_id','replacement_minor']);
 select * into gift from public.giving_ledger where organization_id=o and id=identifier and kind in('gift','correction','reclassification') and amount_minor>0;
 if not found or exists(select 1 from public.giving_ledger where organization_id=o and original_id=gift.id) or exists(select 1 from public.giving_pledge_allocations where organization_id=o and gift_id=gift.id) then raise exception 'Gift unavailable or already adjusted/allocated; reviewed remediation required';end if;
 if length(btrim(coalesce(p->>'reason','')))<5 then raise exception 'Correction reason required';end if;
 if gift.batch_id is not null and exists(select 1 from public.giving_reconciliations where organization_id=o and batch_id=gift.batch_id) then raise exception 'Reconciled batch requires a new correction batch';end if;
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,session_id,leg_id,batch_id,original_id,kind,amount_minor,currency,gift_at,source,payment_method,route_snapshot,tax_eligible,notes,entered_by,posted_by)
 values(o,gift.person_id,gift.household_id,gift.fund_id,gift.session_id,gift.leg_id,gift.batch_id,gift.id,'reversal',-gift.amount_minor,gift.currency,gift.gift_at,gift.source,gift.payment_method,gift.route_snapshot,gift.tax_eligible,p->>'reason',auth.uid(),auth.uid()) returning id into negative;
 if p?'replacement_minor' or p?'replacement_fund_id' or p?'replacement_person_id' then
 perform private.giving_identity(o,case when p?'replacement_person_id' then (p->>'replacement_person_id')::uuid else gift.person_id end,case when p?'replacement_household_id' then (p->>'replacement_household_id')::uuid else gift.household_id end);
 select * into fund from public.giving_funds where organization_id=o and id=coalesce((p->>'replacement_fund_id')::uuid,gift.fund_id) and status='active';if not found then raise exception 'Replacement fund unavailable';end if;
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,session_id,leg_id,batch_id,original_id,kind,amount_minor,currency,gift_at,source,payment_method,route_snapshot,tax_eligible,notes,entered_by,posted_by)
 values(o,case when p?'replacement_person_id' then (p->>'replacement_person_id')::uuid else gift.person_id end,case when p?'replacement_household_id' then (p->>'replacement_household_id')::uuid else gift.household_id end,fund.id,gift.session_id,gift.leg_id,gift.batch_id,gift.id,case when fund.id<>gift.fund_id then 'reclassification' else 'correction' end,coalesce((p->>'replacement_minor')::bigint,gift.amount_minor),gift.currency,gift.gift_at,gift.source,gift.payment_method,gift.route_snapshot,fund.tax_eligible,p->>'reason',auth.uid(),auth.uid()) returning id into replacement;
 end if;result:=jsonb_build_object('id',gift.id,'reversal_id',negative,'replacement_id',replacement);
 elsif a='refund_request' then
 perform private.giving_payload(p,array['request_key','leg_id','amount_minor','kind','reason']);
 select * into leg from public.giving_transaction_legs where organization_id=o and id=(p->>'leg_id')::uuid;if not found then raise exception 'Transaction unavailable';end if;
 amount:=(p->>'amount_minor')::bigint;
 if p->>'kind'='void' and amount<>leg.amount_minor then raise exception 'Void requires full principal';end if;
 if p->>'kind'='void' and leg.status not in('created','pending','authorized') then raise exception 'Captured payments require refund';end if;
 if p->>'kind'='refund' and leg.status not in('captured','settled','partially_refunded') then raise exception 'Refund requires captured principal';end if;
 select coalesce(sum(amount_minor),0) into used from public.giving_refunds where organization_id=o and leg_id=leg.id and kind='refund' and status<>'failed';
 if amount is null or amount<=0 or amount>leg.amount_minor-used then raise exception 'Refund exceeds remaining principal';end if;
 insert into public.giving_refunds(organization_id,leg_id,amount_minor,kind,reason,request_key,created_by) values(o,leg.id,amount,p->>'kind',p->>'reason',(p->>'request_key')::uuid,auth.uid()) returning to_jsonb(giving_refunds.*) into result;
 elsif a='batch_attach' then
 perform private.giving_payload(p,array['request_key','batch_id','ledger_ids']);select * into batch from public.giving_batches where organization_id=o and id=(p->>'batch_id')::uuid and status='open';
 if not found or jsonb_typeof(p->'ledger_ids')<>'array' or jsonb_array_length(p->'ledger_ids') not between 1 and 200 then raise exception 'Open batch and ledger selection required';end if;
 for line in select value from jsonb_array_elements(p->'ledger_ids') loop
 select * into gift from public.giving_ledger where organization_id=o and id=(line#>>'{}')::uuid and currency=batch.currency and batch_id is null;
 if not found then raise exception 'Unbatched same-currency ledger record required';end if;
 insert into public.giving_batch_entries(organization_id,batch_id,ledger_id,added_by)values(o,batch.id,gift.id,auth.uid()) on conflict(ledger_id) do nothing;
 if not exists(select 1 from public.giving_batch_entries where ledger_id=gift.id and batch_id=batch.id) then raise exception 'Ledger record already belongs to another batch';end if;end loop;
 result:=jsonb_build_object('id',batch.id);
 elsif a='reconcile' then
 perform private.giving_payload(p,array['request_key','batch_id','settlement_minor','deposit_minor','notes']);select * into batch from public.giving_batches where organization_id=o and id=(p->>'batch_id')::uuid;
 if not found then raise exception 'Batch unavailable';end if;
 select to_jsonb(r.*) into result from public.giving_reconciliations r where organization_id=o and batch_id=batch.id;
 if result is not null then if (result->>'settlement_minor')::bigint<>(p->>'settlement_minor')::bigint or (result->>'deposit_minor')::bigint<>(p->>'deposit_minor')::bigint then raise exception 'Reconciliation already recorded with different totals';end if;return result;end if;
 select coalesce(sum(amount_minor),0) into amount from public.giving_ledger where organization_id=o and currency=batch.currency and (batch_id=batch.id or id in(select ledger_id from public.giving_batch_entries where organization_id=o and batch_id=batch.id));
 insert into public.giving_reconciliations(organization_id,batch_id,ledger_minor,settlement_minor,deposit_minor,difference_minor,status,notes,reconciled_by)
 values(o,batch.id,amount,(p->>'settlement_minor')::bigint,(p->>'deposit_minor')::bigint,(p->>'deposit_minor')::bigint-amount,case when amount=(p->>'deposit_minor')::bigint and amount=(p->>'settlement_minor')::bigint then 'balanced' else 'attention' end,coalesce(p->>'notes',''),auth.uid()) returning to_jsonb(giving_reconciliations.*) into result;
 update public.giving_batches set status=case when result->>'status'='balanced' then 'reconciled' else 'attention' end where organization_id=o and id=batch.id;
 elsif a='receipt' then
 perform private.giving_payload(p,array['request_key','session_id']);select * into s from public.giving_sessions where organization_id=o and id=(p->>'session_id')::uuid;
 if not found or s.status not in('completed','partially_completed') then raise exception 'Receipt requires posted contribution';end if;
 select to_jsonb(r.*) into result from public.giving_receipts r where organization_id=o and session_id=s.id and version=1;if result is not null then return result;end if;
 select jsonb_build_object('session_id',s.id,'currency',s.currency,'total_minor',sum(g.amount_minor)::text,'intended_minor',s.intended_minor::text,'session_status',s.status,
 'funds',jsonb_agg(jsonb_build_object('fund',f.name,'amount_minor',g.amount_minor::text,'tax_eligible',g.tax_eligible,'destination',g.route_snapshot->>'destination_label')),
 'organization',(select name from public.organizations where id=o),'tax_language',(select receipt_language from public.giving_organization_config where organization_id=o)) into result
 from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id where g.organization_id=o and g.session_id=s.id and g.kind='gift';
 insert into public.giving_receipts(organization_id,session_id,person_id,receipt_number,snapshot) values(o,s.id,s.person_id,'KP-'||s.id::text,result) returning to_jsonb(giving_receipts.*) into result;
 else raise exception 'Unknown financial action';end if;
 perform private.giving_audit_event(o,a,coalesce((result->>'id')::uuid,identifier));return result;
end$$;

create function private.giving_service(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare leg public.giving_transaction_legs;event public.giving_provider_events;instruction public.giving_recurring_instructions;result jsonb;identifier uuid;outcome text:=p->>'outcome';profile private.giving_payment_profiles;r public.giving_refunds;gift public.giving_ledger;remaining bigint;available bigint;used bigint;part bigint;existing public.giving_requests;
begin
 if current_setting('role',true)<>'service_role' then raise exception 'Service authority required' using errcode='42501';end if;
 perform private.giving_lock(o);
 if a='finalize' then perform private.giving_payload(p,array['session_id']);return private.giving_post_session(o,(p->>'session_id')::uuid);
 elsif a='webhook' then
 perform private.giving_payload(p,array['gateway_id','event_reference','leg_id','outcome','provider_reference','payload_digest','processor_fee_minor','platform_fee_minor','donor_fee_minor','net_settlement_minor']);
 select * into leg from public.giving_transaction_legs where organization_id=o and id=(p->>'leg_id')::uuid;
 if not found or leg.route_snapshot->>'gateway_id'<>p->>'gateway_id' or leg.route_snapshot->>'environment'<>'sandbox' then raise exception 'Sandbox transaction binding required';end if;
 if length(coalesce(p->>'event_reference','')) not between 1 and 120 or length(coalesce(p->>'payload_digest','')) not between 1 and 128 then raise exception 'Verified provider event reference required';end if;
 select * into event from public.giving_provider_events where gateway_id=(p->>'gateway_id')::uuid and event_reference=p->>'event_reference';
 if found then if event.leg_id<>leg.id or event.payload_digest<>p->>'payload_digest' or event.outcome<>outcome or event.financial_snapshot is distinct from p-'payload_digest' then raise exception 'Provider event replay conflict';end if;return jsonb_build_object('duplicate',true,'leg_id',leg.id);end if;
 if leg.status in('partially_refunded','refunded') and outcome<>'disputed' then raise exception 'Refund state cannot regress';end if;
 if leg.status='authorized' and outcome='pending' then raise exception 'Authorization cannot regress';end if;
 if outcome not in('pending','authorized','captured','settled','failed','voided','disputed') or (leg.status in('settled','refunded','partially_refunded','disputed') and outcome not in('settled','disputed')) or (leg.status='captured' and outcome not in('captured','settled','disputed')) or (leg.status in('failed','voided') and outcome<>leg.status) then raise exception 'Invalid provider transition';end if;
 update public.giving_transaction_legs set status=outcome,provider_reference=coalesce(p->>'provider_reference',provider_reference),processor_fee_minor=coalesce((p->>'processor_fee_minor')::bigint,processor_fee_minor),platform_fee_minor=coalesce((p->>'platform_fee_minor')::bigint,platform_fee_minor),donor_fee_minor=coalesce((p->>'donor_fee_minor')::bigint,donor_fee_minor),net_settlement_minor=coalesce((p->>'net_settlement_minor')::bigint,net_settlement_minor) where organization_id=o and id=leg.id;
 insert into public.giving_provider_events(organization_id,gateway_id,event_reference,leg_id,outcome,payload_digest,financial_snapshot) values(o,(p->>'gateway_id')::uuid,p->>'event_reference',leg.id,outcome,p->>'payload_digest',p-'payload_digest');
 perform private.giving_audit_event(o,'provider.'||outcome,leg.id);result:=private.giving_post_session(o,leg.session_id);return result;
 elsif a='refund_record' then
 perform private.giving_payload(p,array['id','provider_reference','payload_digest']);select * into r from public.giving_refunds where organization_id=o and id=(p->>'id')::uuid;
 if not found then raise exception 'Refund request unavailable';end if;
 select * into leg from public.giving_transaction_legs where organization_id=o and id=r.leg_id;
 if leg.route_snapshot->>'environment'<>'sandbox' or length(coalesce(p->>'provider_reference','')) not between 1 and 120 or length(coalesce(p->>'payload_digest','')) not between 1 and 128 then raise exception 'Verified sandbox outcome required';end if;
 select * into existing from public.giving_requests where organization_id=o and operation='refund_record' and request_key=r.id;
 if found then if existing.payload<>p then raise exception 'Refund outcome replay conflict';end if;return existing.result;end if;
 insert into public.giving_refund_outcomes(refund_id,organization_id,gateway_id,provider_reference,payload_digest)values(r.id,o,(leg.route_snapshot->>'gateway_id')::uuid,p->>'provider_reference',p->>'payload_digest');
 if r.status<>'requested' then raise exception 'Refund request not pending';end if;
 if r.kind='void' then
 if leg.status not in('created','pending','authorized') or r.amount_minor<>leg.amount_minor or exists(select 1 from public.giving_ledger where organization_id=o and leg_id=leg.id) then raise exception 'Void requires full unposted authorization';end if;
 update public.giving_transaction_legs set status='voided' where organization_id=o and id=leg.id;
 elsif r.kind='dispute' then
 update public.giving_transaction_legs set status='disputed' where organization_id=o and id=leg.id;
 else
 if leg.status not in('captured','settled','partially_refunded') then raise exception 'Refund requires posted principal';end if;
 remaining:=r.amount_minor;
 for gift in select * from public.giving_ledger where organization_id=o and leg_id=leg.id and kind='gift' order by id loop
 select gift.amount_minor+coalesce(sum(amount_minor),0) into available from public.giving_ledger where organization_id=o and original_id=gift.id;
 select coalesce(sum(amount_minor),0) into used from public.giving_pledge_allocations where organization_id=o and gift_id=gift.id;
 part:=least(remaining,available-used);if part>0 then
 insert into public.giving_ledger(organization_id,person_id,household_id,fund_id,session_id,leg_id,original_id,kind,amount_minor,currency,gift_at,source,payment_method,route_snapshot,tax_eligible,notes,external_reference,posted_by)
 values(o,gift.person_id,gift.household_id,gift.fund_id,gift.session_id,gift.leg_id,gift.id,'refund',-part,gift.currency,clock_timestamp(),gift.source,gift.payment_method,gift.route_snapshot,gift.tax_eligible,r.reason,p->>'provider_reference',auth.uid());remaining:=remaining-part;end if;end loop;
 if remaining<>0 then raise exception 'Refund principal is allocated or corrected; reviewed remediation required';end if;
 select coalesce(sum(amount_minor),0) into used from public.giving_refunds where organization_id=o and leg_id=leg.id and kind='refund' and status='recorded';
 update public.giving_transaction_legs set status=case when used+r.amount_minor=leg.amount_minor then 'refunded' else 'partially_refunded' end where organization_id=o and id=leg.id;
 end if;
 update public.giving_refunds set status='recorded' where organization_id=o and id=r.id;result:=jsonb_build_object('id',r.id,'kind',r.kind,'status','recorded');
 insert into public.giving_requests values(o,'refund_record',r.id,p,result,now());perform private.giving_audit_event(o,r.kind||'.recorded',r.id);return result;
 elsif a='recurring_claim' then
 perform private.giving_payload(p,array['id']);select * into instruction from public.giving_recurring_instructions where organization_id=o and id=(p->>'id')::uuid and status='active' and next_run_at<=now() and starts_on<=current_date and (ends_on is null or ends_on>=current_date);
 if not found then return jsonb_build_object('claimed',false);end if;
 insert into public.giving_recurring_runs(organization_id,instruction_id,scheduled_at) values(o,instruction.id,instruction.next_run_at) on conflict(instruction_id,scheduled_at) do nothing returning id into identifier;
 if identifier is null then return jsonb_build_object('claimed',false);end if;
 perform private.giving_audit_event(o,'recurring.claim.held',instruction.id);return jsonb_build_object('claimed',true,'id',identifier,'execution','held');
 elsif a='profile_reference' then
 perform private.giving_payload(p,array['person_id','gateway_id','provider_customer_reference','provider_payment_reference','method','descriptor']);
 perform private.giving_identity(o,(p->>'person_id')::uuid,null);
 select * into profile from private.giving_payment_profiles where organization_id=o and gateway_id=(p->>'gateway_id')::uuid and provider_customer_reference=p->>'provider_customer_reference' and provider_payment_reference=p->>'provider_payment_reference';
 if found then if profile.person_id<>(p->>'person_id')::uuid or profile.method<>p->>'method' then raise exception 'Payment profile binding conflict';end if;return jsonb_build_object('id',profile.id);end if;
 insert into private.giving_payment_profiles(organization_id,person_id,gateway_id,provider_customer_reference,provider_payment_reference,method,descriptor)
 values(o,(p->>'person_id')::uuid,(p->>'gateway_id')::uuid,p->>'provider_customer_reference',p->>'provider_payment_reference',p->>'method',p->>'descriptor') returning id into identifier;return jsonb_build_object('id',identifier);
 else raise exception 'Service action unavailable';end if;
end$$;

create function private.giving_period(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.giving_organization_config;at_time timestamptz:=coalesce((p->>'as_of')::timestamptz,now());local_time timestamp;start_local timestamp;end_local timestamp;
 starts timestamptz;ends timestamptz;prior_start timestamptz;prior_end timestamptz;kind text:=coalesce(p->>'period','month');
begin
 select * into cfg from public.giving_organization_config where organization_id=o;if not found then raise exception 'Giving reporting configuration required';end if;
 local_time:=at_time at time zone cfg.timezone;
 if kind='custom' then starts:=(p->>'starts_at')::timestamptz;ends:=(p->>'ends_at')::timestamptz;prior_start:=starts-(ends-starts);prior_end:=starts;
 elsif kind='past_24_hours' then starts:=at_time-interval '24 hours';ends:=at_time;prior_start:=starts-interval '24 hours';prior_end:=starts;
 elsif kind='past_7_days' then starts:=(local_time-interval '7 days') at time zone cfg.timezone;ends:=at_time;prior_start:=(local_time-interval '14 days') at time zone cfg.timezone;prior_end:=starts;
 else
 start_local:=case kind when 'today' then date_trunc('day',local_time) when 'week' then date_trunc('week',local_time)
 when 'sunday' then (local_time::date-((extract(dow from local_time)::int-cfg.service_weekday+7)%7))::timestamp+cfg.service_boundary
 when 'month' then date_trunc('month',local_time) when 'quarter' then date_trunc('quarter',local_time)
 when 'semiannual' then date_trunc('year',local_time)+case when extract(month from local_time)>6 then interval '6 months' else interval '0' end
 when 'annual' then date_trunc('year',local_time) when 'ytd' then date_trunc('year',local_time) else null end;
 if start_local is null then raise exception 'Unknown financial reporting period';end if;
 if kind='sunday' and start_local>local_time then start_local:=start_local-interval '7 days';end if;
 end_local:=case kind when 'today' then start_local+interval '1 day' when 'week' then start_local+interval '7 days' when 'sunday' then start_local+interval '7 days' when 'month' then start_local+interval '1 month' when 'quarter' then start_local+interval '3 months' when 'semiannual' then start_local+interval '6 months' else start_local+interval '1 year' end;
 starts:=start_local at time zone cfg.timezone;ends:=case when kind='ytd' then at_time else end_local at time zone cfg.timezone end;
 prior_start:=(start_local-case kind when 'today' then interval '1 day' when 'week' then interval '7 days' when 'sunday' then interval '7 days' when 'month' then interval '1 month' when 'quarter' then interval '3 months' when 'semiannual' then interval '6 months' else interval '1 year' end) at time zone cfg.timezone;
 prior_end:=case when kind='ytd' then (local_time-interval '1 year') at time zone cfg.timezone else starts end;
 end if;
 if starts is null or ends is null or ends<=starts or ends-starts>interval '20 years' then raise exception 'Valid bounded financial date range required';end if;
 return jsonb_build_object('period',kind,'timezone',cfg.timezone,'starts_at',starts,'ends_at',ends,'prior_starts_at',prior_start,'prior_ends_at',prior_end,'service_weekday',cfg.service_weekday,'service_boundary',cfg.service_boundary);
end$$;
create function private.giving_report(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare period jsonb;starts timestamptz;ends timestamptz;cur text:=p->>'currency';dimension text:=coalesce(p->>'dimension','fund');rows jsonb;principal text;previous text;
begin
 perform private.giving_payload(p,array['period','as_of','starts_at','ends_at','currency','dimension','fund_id','person_id','household_id','tax_only']);
 period:=private.giving_period(o,p);starts:=(period->>'starts_at')::timestamptz;ends:=(period->>'ends_at')::timestamptz;
 if cur is null or cur !~ '^[A-Z]{3}$' then raise exception 'Select one report currency';end if;
 if dimension not in('day','week','month','quarter','semiannual','year','fund','parent_fund','category','donor','household','source','payment_method','campaign','event','destination','gateway','mid','recurring','manual','kind') then raise exception 'Unsupported reporting dimension';end if;
 if p->>'fund_id' is not null and not exists(select 1 from public.giving_funds where organization_id=o and id=(p->>'fund_id')::uuid) then raise exception 'Fund unavailable';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 with eligible as(select g.*,f.name fund_name,f.parent_id,f.reporting_category,coalesce(pf.name,f.name) parent_name,
 g.gift_at at time zone (period->>'timezone') local_time from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id
 left join public.giving_funds pf on pf.organization_id=f.organization_id and pf.id=f.parent_id
 where g.organization_id=o and g.currency=cur and g.gift_at>=starts and g.gift_at<ends
 and (p->>'fund_id' is null or g.fund_id=(p->>'fund_id')::uuid or f.parent_id=(p->>'fund_id')::uuid)
 and (p->>'person_id' is null or g.person_id=(p->>'person_id')::uuid) and (p->>'household_id' is null or g.household_id=(p->>'household_id')::uuid)
 and (not coalesce((p->>'tax_only')::boolean,false) or g.tax_eligible)),grouped as(select
 case dimension when 'day' then to_char(local_time,'YYYY-MM-DD') when 'week' then to_char(date_trunc('week',local_time),'YYYY-MM-DD') when 'month' then to_char(local_time,'YYYY-MM') when 'quarter' then to_char(local_time,'YYYY-"Q"Q') when 'semiannual' then to_char(local_time,'YYYY')||case when extract(month from local_time)<=6 then '-H1' else '-H2' end when 'year' then to_char(local_time,'YYYY')
 when 'fund' then fund_id::text when 'parent_fund' then coalesce(parent_id,fund_id)::text when 'category' then reporting_category when 'donor' then coalesce(person_id::text,'anonymous') when 'household' then coalesce(household_id::text,'individual') when 'source' then source when 'payment_method' then payment_method when 'campaign' then coalesce(campaign_reference,'unattributed') when 'event' then coalesce(event_reference,'unattributed') when 'destination' then coalesce(route_snapshot->>'destination_id','manual') when 'gateway' then coalesce(route_snapshot->>'gateway_id','manual') when 'mid' then coalesce(route_snapshot->>'processor_route_id','manual') when 'recurring' then case when recurring_id is not null or source='recurring' then 'recurring' else 'one_time' end when 'manual' then case when source in('staff_manual','import') then 'manual' else 'online' end else kind end bucket,
 case dimension when 'fund' then fund_name when 'parent_fund' then parent_name else null end label,sum(amount_minor)::text amount_minor,count(*) entries from eligible group by 1,2)
 select coalesce(jsonb_agg(to_jsonb(grouped.*) order by bucket),'[]') into rows from grouped;
 select coalesce(sum(g.amount_minor),0)::text into principal from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id where g.organization_id=o and g.currency=cur and g.gift_at>=starts and g.gift_at<ends and (p->>'fund_id' is null or g.fund_id=(p->>'fund_id')::uuid or f.parent_id=(p->>'fund_id')::uuid) and (p->>'person_id' is null or g.person_id=(p->>'person_id')::uuid) and (p->>'household_id' is null or g.household_id=(p->>'household_id')::uuid) and (not coalesce((p->>'tax_only')::boolean,false) or g.tax_eligible);
 select coalesce(sum(g.amount_minor),0)::text into previous from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id where g.organization_id=o and g.currency=cur and g.gift_at>=(period->>'prior_starts_at')::timestamptz and g.gift_at<(period->>'prior_ends_at')::timestamptz and (p->>'fund_id' is null or g.fund_id=(p->>'fund_id')::uuid or f.parent_id=(p->>'fund_id')::uuid) and (p->>'person_id' is null or g.person_id=(p->>'person_id')::uuid) and (p->>'household_id' is null or g.household_id=(p->>'household_id')::uuid) and (not coalesce((p->>'tax_only')::boolean,false) or g.tax_eligible);
 return jsonb_build_object('currency',cur,'period',period,'dimension',dimension,'rows',rows,'total_minor',principal,'prior_total_minor',previous,'difference_minor',(principal::numeric-previous::numeric)::text,'data_source','canonical_ledger','financial_detail',jsonb_build_object(
 'refund_minor',(select coalesce(sum(amount_minor),0)::text from public.giving_ledger where organization_id=o and currency=cur and kind='refund' and gift_at>=starts and gift_at<ends),
 'pledged_minor',(select coalesce(sum(amount_minor),0)::text from public.giving_pledges where organization_id=o and currency=cur and status='active'),
 'pledge_received_minor',(select coalesce(sum(a.amount_minor),0)::text from public.giving_pledge_allocations a join public.giving_pledges p on p.organization_id=a.organization_id and p.id=a.pledge_id where a.organization_id=o and p.currency=cur),
 'failed_transactions',(select count(*) from public.giving_transaction_legs where organization_id=o and currency=cur and status='failed' and created_at>=starts and created_at<ends),
 'processor_fee_minor',(select sum(processor_fee_minor)::text from public.giving_transaction_legs where organization_id=o and currency=cur and status in('captured','settled','partially_refunded','refunded','disputed') and created_at>=starts and created_at<ends),
 'unreported_processor_fee_legs',(select count(*)from public.giving_transaction_legs where organization_id=o and currency=cur and processor_fee_minor is null and created_at>=starts and created_at<ends),
 'platform_fee_minor',(select sum(platform_fee_minor)::text from public.giving_transaction_legs where organization_id=o and currency=cur and status in('captured','settled','partially_refunded','refunded','disputed') and created_at>=starts and created_at<ends),
 'donor_fee_minor',(select sum(donor_fee_minor)::text from public.giving_transaction_legs where organization_id=o and currency=cur and status in('captured','settled','partially_refunded','refunded','disputed') and created_at>=starts and created_at<ends),
 'reconciliation',(select coalesce(jsonb_agg(to_jsonb(r.*)),'[]')from public.giving_reconciliations r join public.giving_batches b on b.organization_id=r.organization_id and b.id=r.batch_id where r.organization_id=o and b.currency=cur and b.batch_date>=(starts at time zone(period->>'timezone'))::date and b.batch_date<(ends at time zone(period->>'timezone'))::date)));
end$$;

create function private.giving_workspace(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare needed text;result jsonb;existing public.giving_requests;identifier uuid:=(p->>'id')::uuid;key uuid:=(p->>'request_key')::uuid;
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified finance identity required' using errcode='42501';end if;
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid finance request';end if;
 if a='context' then return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'currency',(select currency from public.giving_organization_config where organization_id=x.id),'minor_unit_scale',(select minor_unit_scale from public.giving_organization_config where organization_id=x.id),'permissions',(select jsonb_agg(k) from unnest(private.giving_permissions()) k where private.giving_authorized(x.id,k)))),'[]') from public.organizations x where exists(select 1 from unnest(private.giving_permissions()) k where private.giving_authorized(x.id,k))));end if;
 if o is null then raise exception 'Finance organization required';end if;
 needed:=case when a in('gateway_create','processor_create','destination_create','destination_update','merchants') then 'finance.merchant.configure'
 when a in('config_save','group_create','fund_create','fund_update','text_scope_create','keyword_create') then 'finance.configure'
 when a in('session_create','manual','import') then 'finance.gifts.create' when a='adjust' then 'finance.gifts.adjust' when a in('pledge_create','pledge_status','allocate') then 'finance.pledges.manage'
 when a in('pledges') then 'finance.pledges.read' when a in('recurring_create','recurring_status') then 'finance.recurring.manage' when a='recurring' then 'finance.recurring.read'
 when a in('batch_create','batch_attach','reconcile') then 'finance.reconciliation.manage' when a='batches' then 'finance.reconciliation.read'
 when a='refund_request' then 'finance.refunds.manage' when a='statement' then 'finance.statements.generate'
 when a in('overview','report','export','period') then 'finance.reports.read' when a='entry_options' then 'finance.gifts.create' when a in('gifts','gift','donors','donor','receipt') then 'finance.gifts.read' else 'finance.read' end;
 perform private.giving_lock(o);
 if not private.giving_authorized(o,needed) then raise exception 'Finance access denied' using errcode='42501';end if;
 if a='export' and not private.giving_authorized(o,'finance.export') then raise exception 'Explicit finance export required' using errcode='42501';end if;
 if a in('session_create','manual','import') then
 if a='session_create' then return private.giving_create_session(o,p);else return private.giving_manual(o,p);end if;
 elsif a in('config_save','group_create','fund_create','fund_update','gateway_create','processor_create','destination_create','destination_update','text_scope_create','keyword_create') then return private.giving_configure(o,a,p);
 elsif a in('batch_attach','batch_create','pledge_create','pledge_status','allocate','recurring_create','recurring_status','adjust','refund_request','reconcile','receipt','statement') then
 if key is null then raise exception 'Financial request key required';end if;
 select * into existing from public.giving_requests where organization_id=o and operation=a and request_key=key;
 if found then if existing.payload<>p then raise exception 'Idempotency key reused with changed content';end if;return existing.result;end if;
 if a='statement' then
 perform private.giving_payload(p,array['request_key','person_id','household_id','starts_at','ends_at','currency']);
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 result:=private.giving_report(o,(p-'request_key')||jsonb_build_object('period','custom','dimension','fund','tax_only',true));
 insert into public.giving_statements(organization_id,person_id,household_id,starts_at,ends_at,currency,version,snapshot,generated_by)
 values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,(p->>'starts_at')::timestamptz,(p->>'ends_at')::timestamptz,p->>'currency',(select coalesce(max(version),0)+1 from public.giving_statements where organization_id=o and person_id is not distinct from (p->>'person_id')::uuid and household_id is not distinct from (p->>'household_id')::uuid and starts_at=(p->>'starts_at')::timestamptz and ends_at=(p->>'ends_at')::timestamptz and currency=p->>'currency'),result||jsonb_build_object('organization',(select name from public.organizations where id=o),'tax_language',(select statement_language from public.giving_organization_config where organization_id=o)),auth.uid()) returning to_jsonb(giving_statements.*) into result;
 perform private.giving_audit_event(o,'statement.generated',(result->>'id')::uuid);
 else result:=private.giving_financial_action(o,a,p);end if;
 insert into public.giving_requests values(o,a,key,p,result,now());return result;
 elsif a in('report','export','overview') then
 result:=private.giving_report(o,p);
 if a='overview' then result:=result||jsonb_build_object('unreconciled_batches',(select count(*) from public.giving_batches where organization_id=o and currency=p->>'currency' and status<>'reconciled'),
 'failed_transactions',(select count(*) from public.giving_transaction_legs where organization_id=o and currency=p->>'currency' and status='failed'),
 'pledged_minor',(select coalesce(sum(amount_minor),0)::text from public.giving_pledges where organization_id=o and currency=p->>'currency' and status='active'),
 'pledge_received_minor',(select coalesce(sum(x.amount_minor),0)::text from public.giving_pledge_allocations x join public.giving_pledges g on g.organization_id=x.organization_id and g.id=x.pledge_id where x.organization_id=o and g.currency=p->>'currency'));
 end if;
 if a='export' then perform private.giving_audit_event(o,'report.export',null,jsonb_build_object('period',result->'period','dimension',result->'dimension'));end if;return result;
 elsif a='period' then return private.giving_period(o,p);
 elsif a='entry_options' then return jsonb_build_object('funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status)),'[]')from public.giving_funds where organization_id=o and status='active'),'batches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'currency',currency,'status',status)),'[]')from public.giving_batches where organization_id=o and status='open'),'config',(select jsonb_build_object('currency',currency,'timezone',timezone,'minor_unit_scale',minor_unit_scale)from public.giving_organization_config where organization_id=o));
 elsif a='funds' then return jsonb_build_object('funds',(select coalesce(jsonb_agg(to_jsonb(f.*) order by display_order,name),'[]') from public.giving_funds f where organization_id=o),'groups',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_fund_groups g where organization_id=o),'destinations',(select coalesce(jsonb_agg(jsonb_build_object('id',d.id,'label',d.merchant_label,'currency',d.currency)),'[]') from public.giving_destinations d where organization_id=o),'config',(select to_jsonb(c.*) from public.giving_organization_config c where organization_id=o));
 elsif a='route' then return private.giving_route(o,(p->>'fund_id')::uuid,(p->>'destination_override_id')::uuid);
 elsif a='keyword_route' then
 select jsonb_build_object('keyword',k.keyword,'route',private.giving_route(o,k.fund_id,k.destination_override_id),'default_minor',k.default_minor::text,'execution','disabled','sms_credit_hook','future_organization_usage_event') into result from public.giving_text_keywords k where organization_id=o and scope_id=(p->>'scope_id')::uuid and keyword=upper(p->>'keyword') and active and (starts_at is null or starts_at<=now()) and (ends_at is null or ends_at>now());if result is null then raise exception 'Keyword unavailable';end if;return result;
 elsif a='merchants' then return jsonb_build_object('destinations',(select coalesce(jsonb_agg(to_jsonb(d.*)),'[]') from public.giving_destinations d where organization_id=o),'gateways',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_gateway_accounts g where organization_id=o),'routes',(select coalesce(jsonb_agg(to_jsonb(r.*)),'[]') from public.giving_processor_routes r where organization_id=o),'activation','NOT CONNECTED');
 elsif a='gifts' then return jsonb_build_object('gifts',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from(select g.*,f.name fund_name from public.giving_ledger g join public.giving_funds f on f.organization_id=g.organization_id and f.id=g.fund_id where g.organization_id=o order by g.gift_at desc,g.id limit 200)x),'sessions',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from(select * from public.giving_sessions where organization_id=o order by created_at desc limit 100)x));
 elsif a='gift' then
 select to_jsonb(g.*) into result from public.giving_ledger g where organization_id=o and id=identifier;
 if result is null then raise exception 'Gift unavailable' using errcode='42501';end if;
 return result||jsonb_build_object('adjustments',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_ledger g where organization_id=o and original_id=identifier),'allocations',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from public.giving_pledge_allocations x where organization_id=o and gift_id=identifier));
 elsif a='pledges' then return jsonb_build_object('pledges',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from(select g.*,coalesce((select sum(amount_minor) from public.giving_pledge_allocations where organization_id=o and pledge_id=g.id),0)::text received_minor,coalesce((select jsonb_agg(to_jsonb(s.*)) from public.giving_pledge_schedule s where organization_id=o and pledge_id=g.id),'[]') schedule from public.giving_pledges g where organization_id=o)x));
 elsif a='recurring' then return jsonb_build_object('instructions',(select coalesce(jsonb_agg(to_jsonb(x.*)-'payment_profile_id'-'provider_schedule_reference'),'[]') from public.giving_recurring_instructions x where organization_id=o),'lines',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from public.giving_recurring_lines x where organization_id=o),'execution','DISABLED');
 elsif a='batches' then return jsonb_build_object('batches',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from public.giving_batches x where organization_id=o),'reconciliations',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from public.giving_reconciliations x where organization_id=o));
 elsif a='donors' then return jsonb_build_object('donors',(select coalesce(jsonb_agg(to_jsonb(x.*)),'[]') from(select person.id,person.first_name,person.last_name,person.email from public.organization_people person where person.organization_id=o and exists(select 1 from public.giving_ledger g where g.organization_id=o and g.person_id=person.id))x));
 elsif a='donor' then
 identifier:=(p->>'person_id')::uuid;perform private.giving_identity(o,identifier,null);if identifier is null then raise exception 'Donor required';end if;
 return jsonb_build_object('person',(select jsonb_build_object('id',id,'first_name',first_name,'last_name',last_name) from public.organization_people where organization_id=o and id=identifier),
 'gifts',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_ledger g where organization_id=o and person_id=identifier),'pledges',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_pledges g where organization_id=o and person_id=identifier),
 'recurring',(select coalesce(jsonb_agg(to_jsonb(g.*)-'payment_profile_id'-'provider_schedule_reference'),'[]') from public.giving_recurring_instructions g where organization_id=o and person_id=identifier),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_receipts g where organization_id=o and person_id=identifier),'statements',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_statements g where organization_id=o and person_id=identifier));
 else raise exception 'Unknown finance action';end if;
end$$;

-- Separately reviewed financial ownership; a general portal link or matching email is insufficient.
create table private.giving_donor_account_links(
 organization_id uuid not null,person_id uuid not null,user_id uuid not null references auth.users(id),active boolean not null default false,
 verification_reference text not null,reviewed_at timestamptz not null default now(),primary key(organization_id,person_id,user_id),unique(organization_id,user_id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id)
);
alter table private.giving_donor_account_links enable row level security;
revoke all on private.giving_donor_account_links from public,anon,authenticated,service_role;
create function private.giving_donor_history(o uuid) returns jsonb language plpgsql security definer set search_path='' as $$declare person uuid;begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified donor required' using errcode='42501';end if;
 select person_id into person from private.giving_donor_account_links where organization_id=o and user_id=auth.uid() and active;
 if person is null then raise exception 'Reviewed financial ownership required' using errcode='42501';end if;
 return jsonb_build_object('gifts',(select coalesce(jsonb_agg(to_jsonb(g.*)-'notes'-'entered_by'-'posted_by'-'route_snapshot'-'external_reference'),'[]') from public.giving_ledger g where organization_id=o and person_id=person),
 'recurring',(select coalesce(jsonb_agg(to_jsonb(g.*)-'payment_profile_id'-'provider_schedule_reference'),'[]') from public.giving_recurring_instructions g where organization_id=o and person_id=person),
 'pledges',(select coalesce(jsonb_agg(to_jsonb(g.*)-'notes'-'created_by'),'[]') from public.giving_pledges g where organization_id=o and person_id=person),
 'receipts',(select coalesce(jsonb_agg(to_jsonb(g.*)),'[]') from public.giving_receipts g where organization_id=o and person_id=person),
 'statements',(select coalesce(jsonb_agg(to_jsonb(g.*)-'generated_by'),'[]') from public.giving_statements g where organization_id=o and person_id=person),
 'payment_methods',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'method',method,'descriptor',descriptor)),'[]') from private.giving_payment_profiles where organization_id=o and person_id=person and active));
end$$;
create function public.giving_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.giving_workspace(p_action,p_org,p_payload)$$;
create function public.giving_service(p_action text,p_org uuid,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.giving_service(p_action,p_org,p_payload)$$;
create function public.giving_donor_history(p_org uuid) returns jsonb language sql security invoker set search_path='' as $$select private.giving_donor_history(p_org)$$;
-- Every newly introduced helper starts private. Only guarded entry points are executable.
do $$declare r record;begin for r in select p.oid::regprocedure sig from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'giving_%' loop execute format('revoke all on function %s from public,anon,authenticated,service_role',r.sig);end loop;end$$;
revoke all on function public.giving_workspace(text,uuid,jsonb),public.giving_service(text,uuid,jsonb),public.giving_donor_history(uuid) from public,anon,authenticated,service_role;
grant execute on function public.giving_workspace(text,uuid,jsonb),private.giving_workspace(text,uuid,jsonb),public.giving_donor_history(uuid),private.giving_donor_history(uuid) to authenticated;
grant execute on function public.giving_service(text,uuid,jsonb),private.giving_service(text,uuid,jsonb) to service_role;

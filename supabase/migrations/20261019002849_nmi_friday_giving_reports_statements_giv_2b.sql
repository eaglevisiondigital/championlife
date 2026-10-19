-- GIV-2B build only. No grants, provider transport, delivery or hosted application.
create or replace function private.giving_permissions() returns text[] language sql immutable set search_path='' as $$
select array['finance.read','finance.configure','finance.gifts.read','finance.gifts.create','finance.gifts.adjust','finance.pledges.read','finance.pledges.manage','finance.recurring.read','finance.recurring.manage','finance.reconciliation.read','finance.reconciliation.manage','finance.reports.read','finance.statements.generate','finance.refunds.manage','finance.merchant.configure','finance.export','finance.reports.export','finance.reports.merchant']::text[] $$;
do $$declare keys text[];begin
keys:=private.staff_permission_keys()||array(select k from unnest(private.giving_permissions())k where not k=any(private.staff_permission_keys()));
alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');end$$;

alter table public.giving_statements add constraint giving_statements_org_identity unique(organization_id,id);
create table public.giving_statement_delivery_events(
id uuid primary key default gen_random_uuid(),event_order bigint generated always as identity,organization_id uuid not null,statement_id uuid not null,
status text not null check(status in('generated','held','queued','delivered','failed')),
communication_reference uuid,created_at timestamptz not null default now(),
foreign key(organization_id,statement_id)references public.giving_statements(organization_id,id));
-- Existing statements predate this composite reference; no history is rewritten.
alter table public.giving_statement_delivery_events enable row level security;
revoke all on public.giving_statement_delivery_events from public,anon,authenticated,service_role;
create trigger giving_statement_delivery_immutable before update or delete on public.giving_statement_delivery_events for each row execute function private.giving_immutable();
create index giving_statement_delivery_history on public.giving_statement_delivery_events(organization_id,statement_id,created_at);
create unique index giving_statement_version_identity on public.giving_statements(organization_id,coalesce(person_id,'00000000-0000-0000-0000-000000000000'::uuid),coalesce(household_id,'00000000-0000-0000-0000-000000000000'::uuid),starts_at,ends_at,currency,version);
create index giving_statement_history on public.giving_statements(organization_id,person_id,household_id,starts_at,ends_at,version);

create function private.giving_reporting_period(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare tz text; t timestamptz:=coalesce((p->>'as_of')::timestamptz,now());s timestamptz;e timestamptz;begin
select timezone into tz from public.giving_organization_config where organization_id=o;
if p->>'period'='custom' then
s:=(p->>'starts_on')::date::timestamp at time zone tz;e:=((p->>'ends_on')::date+1)::timestamp at time zone tz;
return private.giving_period(o,jsonb_build_object('period','custom','starts_at',s,'ends_at',e));
elsif p->>'period'='six_months' then
s:=((t at time zone tz)-interval '6 months')at time zone tz;
return private.giving_period(o,jsonb_build_object('period','custom','starts_at',s,'ends_at',t))||jsonb_build_object('period','six_months');
else return private.giving_period(o,jsonb_build_object('period',coalesce(p->>'period','today'),'as_of',t));end if;end$$;

create function private.giving_reporting_rows(o uuid,p jsonb,b jsonb) returns setof private.giving_management_ledger language sql stable security definer set search_path='' as $$
select g.* from private.giving_management_ledger g join public.giving_organization_config c on c.organization_id=g.organization_id
where g.organization_id=o and g.currency=c.currency and g.gift_at>=(b->>'starts_at')::timestamptz and g.gift_at<(b->>'ends_at')::timestamptz
and(p->>'fund_id'is null or g.fund_id=(p->>'fund_id')::uuid or g.parent_id=(p->>'fund_id')::uuid)
and(p->>'parent_id'is null or coalesce(g.parent_id,g.fund_id)=(p->>'parent_id')::uuid)
and(p->>'person_id'is null or g.person_id=(p->>'person_id')::uuid)
and(p->>'household_id'is null or g.household_id=(p->>'household_id')::uuid)
and(coalesce(p->>'report','summary')<>'online'or g.source not in('staff_manual','import'))
and(coalesce(p->>'report','summary')<>'manual'or g.source in('staff_manual','import'))
and(coalesce(p->>'report','summary')<>'text'or g.source='text')
and(p->>'source'is null or g.source=p->>'source')and(p->>'payment_method'is null or g.payment_method=p->>'payment_method')
and(p->>'destination_id'is null or g.route_snapshot->>'destination_id'=p->>'destination_id')
and(p->>'gateway_id'is null or g.route_snapshot->>'gateway_id'=p->>'gateway_id')
and(p->>'processor_route_id'is null or g.route_snapshot->>'processor_route_id'=p->>'processor_route_id')
and(p->>'campaign'is null or g.campaign_reference=p->>'campaign')and(p->>'event'is null or g.event_reference=p->>'event')
and(p->>'min_minor'is null or g.amount_minor>=(p->>'min_minor')::bigint)and(p->>'max_minor'is null or g.amount_minor<=(p->>'max_minor')::bigint)
and(p->>'recurring'is null or (g.recurring_id is not null or g.source='recurring')=(p->>'recurring')::boolean)
$$;

create function private.giving_reporting_leg_matches(o uuid,l uuid,p jsonb)returns boolean language sql stable security definer set search_path=''as $$
select exists(select 1 from public.giving_transaction_legs t join public.giving_sessions s on(s.organization_id,s.id)=(t.organization_id,t.session_id)where t.organization_id=o and t.id=l
and(p->>'person_id'is null or s.person_id=(p->>'person_id')::uuid)and(p->>'household_id'is null or s.household_id=(p->>'household_id')::uuid)
and(p->>'source'is null or s.source=p->>'source')and(p->>'payment_method'is null or p->>'payment_method'='card')
and(p->>'destination_id'is null or t.route_snapshot->>'destination_id'=p->>'destination_id')and(p->>'gateway_id'is null or t.route_snapshot->>'gateway_id'=p->>'gateway_id')and(p->>'processor_route_id'is null or t.route_snapshot->>'processor_route_id'=p->>'processor_route_id')
and(p->>'min_minor'is null or t.amount_minor>=(p->>'min_minor')::bigint)and(p->>'max_minor'is null or t.amount_minor<=(p->>'max_minor')::bigint)
and(p->>'recurring'is null or(s.source='recurring')=(p->>'recurring')::boolean)
and exists(select 1 from public.giving_session_lines sl join public.giving_funds f on(f.organization_id,f.id)=(sl.organization_id,sl.fund_id)where sl.organization_id=o and sl.leg_id=t.id
and(p->>'fund_id'is null or f.id=(p->>'fund_id')::uuid or f.parent_id=(p->>'fund_id')::uuid)and(p->>'parent_id'is null or coalesce(f.parent_id,f.id)=(p->>'parent_id')::uuid)
and(p->>'campaign'is null or sl.campaign_reference=p->>'campaign')and(p->>'event'is null or sl.event_reference=p->>'event')))$$;

create function private.giving_reporting_summary(o uuid,p jsonb,b jsonb) returns jsonb language sql stable security definer set search_path='' as $$
select jsonb_build_object('gross_minor',coalesce(sum(amount_minor)filter(where kind='gift'),0)::text,
'refund_minor',coalesce(-sum(amount_minor)filter(where kind='refund'),0)::text,
'adjustment_minor',coalesce(sum(amount_minor)filter(where kind in('reversal','correction','reclassification')),0)::text,
'net_minor',coalesce(sum(amount_minor),0)::text,'gift_count',count(distinct coalesce(session_id,id))filter(where kind='gift'),
'average_minor',case when count(distinct coalesce(session_id,id))filter(where kind='gift')>0 then round(sum(amount_minor)::numeric/count(distinct coalesce(session_id,id))filter(where kind='gift'))::text end,
'recurring_minor',coalesce(sum(amount_minor)filter(where recurring_id is not null or source='recurring'),0)::text,
'one_time_minor',coalesce(sum(amount_minor)filter(where recurring_id is null and source<>'recurring'),0)::text)
from private.giving_reporting_rows(o,p,b)$$;

create function private.giving_reporting_series(o uuid,p jsonb,b jsonb,grain text) returns jsonb language sql stable security definer set search_path='' as $$
with periods as(select d from generate_series(date_trunc(grain,(b->>'starts_at')::timestamptz at time zone(b->>'timezone')),date_trunc(grain,((b->>'ends_at')::timestamptz-interval '1 microsecond')at time zone(b->>'timezone')),case grain when 'week'then interval '7 days'else interval '1 month'end)d),totals as(select date_trunc(grain,gift_at at time zone(b->>'timezone'))d,sum(amount_minor)::text amount_minor from private.giving_reporting_rows(o,p,b)group by 1)
select coalesce(jsonb_agg(jsonb_build_object('label',to_char(periods.d,'YYYY-MM-DD'),'amount_minor',coalesce(t.amount_minor,'0'))order by periods.d),'[]')from periods left join totals t using(d)$$;

create function private.giving_reporting(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare b jsonb;cfg public.giving_organization_config;k text:=coalesce(p->>'report','summary');rows jsonb;summary jsonb;charts jsonb;comparisons jsonb:='{}';cb jsonb;cur jsonb;prev jsonb;cp text;np jsonb;result jsonb;begin
perform private.giving_payload(p,array['report','period','starts_on','ends_on','as_of','as_on','fund_id','parent_id','person_id','household_id','source','payment_method','destination_id','gateway_id','processor_route_id','campaign','event','min_minor','max_minor','recurring','status','batch_type']);
if k in('batch','settlement','reconciliation')and exists(select 1 from jsonb_object_keys(p)x where x not in('report','period','starts_on','ends_on','as_of','as_on','status','batch_type'))then raise exception 'Batch reports support date, status and type filters';end if;
if k in('pledge','recurring')and exists(select 1 from jsonb_object_keys(p)x where x not in('report','period','starts_on','ends_on','as_of','as_on','status','fund_id','parent_id','person_id','household_id'))then raise exception 'Commitment reports support date, status, fund and donor filters';end if;
select *into cfg from public.giving_organization_config where organization_id=o;if not found then raise exception 'Giving configuration required';end if;
if k not in('summary','fund','parent','fund_detail','donor','household','first_donor','recurring','recurring_mix','pledge','manual','online','payment','destination','gateway','mid','settlement','batch','reconciliation','refund','failed','campaign','event','text')then raise exception 'Unknown report';end if;
if k in('donor','household','first_donor','recurring','pledge','refund','failed')or p->>'person_id'is not null or p->>'household_id'is not null then
if not private.giving_authorized(o,'finance.gifts.read')then raise exception 'Donor finance permission required'using errcode='42501';end if;
perform private.giving_audit_event(o,'report.sensitive',null,jsonb_build_object('report',k));end if;
if k in('destination','gateway','mid','settlement','batch','reconciliation')and not private.giving_authorized(o,'finance.reports.merchant')then raise exception 'Merchant reporting permission required'using errcode='42501';end if;
perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
if p->>'fund_id'is not null and not exists(select 1 from public.giving_funds where organization_id=o and id=(p->>'fund_id')::uuid)then raise exception 'Fund unavailable'using errcode='22023';end if;
if p->>'parent_id'is not null and not exists(select 1 from public.giving_funds where organization_id=o and id=(p->>'parent_id')::uuid)then raise exception 'Parent unavailable'using errcode='22023';end if;
if p->>'destination_id'is not null and not exists(select 1 from public.giving_destinations where organization_id=o and id=(p->>'destination_id')::uuid)then raise exception 'Destination unavailable';end if;
if p->>'gateway_id'is not null and not exists(select 1 from public.giving_gateway_accounts where organization_id=o and id=(p->>'gateway_id')::uuid)then raise exception 'Gateway unavailable';end if;
if p->>'processor_route_id'is not null and not exists(select 1 from public.giving_processor_routes where organization_id=o and id=(p->>'processor_route_id')::uuid)then raise exception 'MID unavailable';end if;
if p->>'min_minor'is not null and p->>'max_minor'is not null and(p->>'min_minor')::bigint>(p->>'max_minor')::bigint then raise exception 'Invalid amount range';end if;

b:=private.giving_reporting_period(o,p);summary:=private.giving_reporting_summary(o,p,b);
-- All money stays numeric in SQL and is serialized as strings. Only distinct session IDs count as donor gifts.
with eligible as(select *from private.giving_reporting_rows(o,p,b)where(k<>'online'or source not in('staff_manual','import'))and(k<>'manual'or source in('staff_manual','import'))and(k<>'text'or source='text')),
groups as(select case k when 'parent'then coalesce(parent_id,fund_id)::text when 'donor'then coalesce(person_id::text,'anonymous')when 'first_donor'then coalesce(person_id::text,'anonymous')when 'household'then coalesce(household_id::text,'individual')when 'recurring_mix'then case when recurring_id is not null or source='recurring'then 'Recurring'else 'One-Time'end when 'payment'then payment_method when 'manual'then payment_method when 'online'then source when 'destination'then coalesce(route_snapshot->>'destination_id','manual')when 'gateway'then coalesce(route_snapshot->>'gateway_id','manual')when 'mid'then coalesce(route_snapshot->>'processor_route_id','manual')when 'campaign'then coalesce(campaign_reference,'Unattributed')when 'event'then coalesce(event_reference,'Unattributed')when 'text'then coalesce(campaign_reference,'Text source; keyword not recorded')else fund_id::text end bucket,
case k when 'parent'then coalesce(parent_name,fund_name)when 'donor'then donor_name when 'first_donor'then donor_name when 'household'then coalesce(household_name,'Individual / no household attribution')when 'recurring_mix'then case when recurring_id is not null or source='recurring'then 'Recurring'else 'One-Time'end when 'payment'then payment_method when 'manual'then payment_method when 'online'then source when 'destination'then coalesce(route_snapshot->>'destination_label','Manual / no merchant')when 'gateway'then coalesce(route_snapshot->>'provider','Manual / no gateway')when 'mid'then coalesce(route_snapshot->>'mid_reference','Manual / no MID')when 'campaign'then coalesce(campaign_reference,'Unattributed')when 'event'then coalesce(event_reference,'Unattributed')when 'text'then coalesce(campaign_reference,'Text source; keyword not recorded')else fund_name end label,g.* from eligible g)
select coalesce(jsonb_agg(to_jsonb(x)order by label),'[]')into rows from(select bucket,label,max(parent_name)parent,case when k in('donor','household','first_donor')then max(household_name)end household,
count(distinct coalesce(session_id,id))filter(where kind='gift')gift_count,coalesce(sum(amount_minor)filter(where kind='gift'),0)::text gross_minor,coalesce(sum(amount_minor),0)::text net_minor,
case when count(distinct coalesce(session_id,id))filter(where kind='gift')>0 then round(sum(amount_minor)::numeric/count(distinct coalesce(session_id,id))filter(where kind='gift'))::text end average_minor,
case when(summary->>'net_minor')::numeric<>0 then round(sum(amount_minor)*100/(summary->>'net_minor')::numeric,2)::text end percent_of_total,
coalesce(sum(amount_minor)filter(where recurring_id is not null or source='recurring'),0)::text recurring_minor,
coalesce(sum(amount_minor)filter(where recurring_id is null and source<>'recurring'),0)::text one_time_minor,
max(gift_at)filter(where kind='gift')last_gift,count(distinct person_id)donors
from groups where k<>'first_donor'or person_id is not null and not exists(select 1 from public.giving_ledger old where old.organization_id=o and old.person_id=groups.person_id and old.kind='gift'and old.gift_at<(b->>'starts_at')::timestamptz)
group by bucket,label)x;
if k='household'then select coalesce(jsonb_agg(r||jsonb_build_object('individuals',(select jsonb_agg(jsonb_build_object('donor',donor_name,'amount_minor',amount_minor::text,'date',gift_at))from private.giving_reporting_rows(o,p,b)where household_id::text=r->>'bucket'))),'[]')into rows from jsonb_array_elements(rows)r;end if;
if k in('donor','first_donor')then
select coalesce(jsonb_agg(r||jsonb_build_object('ytd_minor',(select coalesce(sum(amount_minor),0)::text from public.giving_ledger where organization_id=o and currency=cfg.currency and person_id=(r->>'bucket')::uuid and gift_at>=date_trunc('year',coalesce((p->>'as_of')::timestamptz,now())at time zone cfg.timezone)at time zone cfg.timezone and gift_at<coalesce((p->>'as_of')::timestamptz,now())), 'recurring_status',coalesce((select string_agg(distinct status,', ')from public.giving_recurring_instructions where organization_id=o and person_id=(r->>'bucket')::uuid),'None'),'pledge_status',coalesce((select string_agg(distinct status,', ')from public.giving_pledges where organization_id=o and person_id=(r->>'bucket')::uuid),'None'))),'[]')into rows from jsonb_array_elements(rows)r where r->>'bucket'<>'anonymous';end if;
if k in('mid','gateway','destination')then
select coalesce(jsonb_agg(r||jsonb_build_object('fees_minor',case when p->>'fund_id'is null and p->>'parent_id'is null then(select case when count(*)filter(where t.processor_fee_minor is null or t.platform_fee_minor is null)=0 then sum(t.processor_fee_minor+t.platform_fee_minor)::text end from public.giving_transaction_legs t where t.organization_id=o and t.id in(select distinct leg_id from private.giving_reporting_rows(o,p,b)where route_snapshot->>case k when 'mid'then 'processor_route_id'when 'gateway'then 'gateway_id'else 'destination_id'end=r->>'bucket'))end,
'net_settlement_minor',case when p->>'fund_id'is null and p->>'parent_id'is null then(select case when count(*)filter(where net_settlement_minor is null)=0 then sum(net_settlement_minor)::text end from public.giving_transaction_legs t where t.organization_id=o and t.id in(select distinct leg_id from private.giving_reporting_rows(o,p,b)where route_snapshot->>case k when 'mid'then 'processor_route_id'when 'gateway'then 'gateway_id'else 'destination_id'end=r->>'bucket'))end,
'merchant',(select max(route_snapshot->>'destination_label')from private.giving_reporting_rows(o,p,b)where route_snapshot->>case k when 'mid'then 'processor_route_id'when 'gateway'then 'gateway_id'else 'destination_id'end=r->>'bucket'),
'funds',(select jsonb_agg(distinct fund_name)from private.giving_reporting_rows(o,p,b)where route_snapshot->>case k when 'mid'then 'processor_route_id'when 'gateway'then 'gateway_id'else 'destination_id'end=r->>'bucket'),
'settlement_state',(select string_agg(distinct status,', ')from public.giving_transaction_legs where organization_id=o and id in(select distinct leg_id from private.giving_reporting_rows(o,p,b)where route_snapshot->>case k when 'mid'then 'processor_route_id'when 'gateway'then 'gateway_id'else 'destination_id'end=r->>'bucket')))),'[]')into rows from jsonb_array_elements(rows)r;end if;
if k='pledge'then
select coalesce(jsonb_agg(to_jsonb(x)),'[]')into rows from(select g.id,g.status,g.frequency,concat_ws(' ',person.first_name,person.last_name)label,f.name fund,g.amount_minor pledged_minor,
coalesce((select sum(amount_minor)from public.giving_pledge_allocations where organization_id=o and pledge_id=g.id),0)received_minor,
greatest(g.amount_minor-coalesce((select sum(amount_minor)from public.giving_pledge_allocations where organization_id=o and pledge_id=g.id),0),0)remaining_minor
from public.giving_pledges g join public.giving_funds f on(f.organization_id,f.id)=(g.organization_id,g.fund_id)left join public.organization_people person on(person.organization_id,person.id)=(g.organization_id,g.person_id)
where g.organization_id=o and g.currency=cfg.currency and(p->>'fund_id'is null or g.fund_id=(p->>'fund_id')::uuid)and(p->>'person_id'is null or g.person_id=(p->>'person_id')::uuid)and(p->>'household_id'is null or g.household_id=(p->>'household_id')::uuid)and(p->>'parent_id'is null or f.parent_id=(p->>'parent_id')::uuid or f.id=(p->>'parent_id')::uuid)and(p->>'status'is null or g.status=p->>'status')and g.starts_on<((b->>'ends_at')::timestamptz at time zone cfg.timezone)::date and(g.ends_on is null or g.ends_on>=((b->>'starts_at')::timestamptz at time zone cfg.timezone)::date))x;
elsif k='recurring'then
select coalesce(jsonb_agg(to_jsonb(x)),'[]')into rows from(select i.id,concat_ws(' ',person.first_name,person.last_name)label,i.status,i.frequency,i.next_run_at,
(select sum(amount_minor)from public.giving_recurring_lines where organization_id=o and instruction_id=i.id)amount_minor,
(select jsonb_agg(jsonb_build_object('fund',f.name,'amount_minor',l.amount_minor::text,'gateway',l.route_snapshot->>'provider','mid',l.route_snapshot->>'mid_reference'))from public.giving_recurring_lines l join public.giving_funds f on(f.organization_id,f.id)=(l.organization_id,l.fund_id)where l.organization_id=o and l.instruction_id=i.id)funds
from public.giving_recurring_instructions i left join public.organization_people person on(person.organization_id,person.id)=(i.organization_id,i.person_id)where i.organization_id=o and i.currency=cfg.currency and(p->>'status'is null or i.status=p->>'status')and(p->>'person_id'is null or i.person_id=(p->>'person_id')::uuid)and(p->>'household_id'is null or i.household_id=(p->>'household_id')::uuid)and(p->>'fund_id'is null or exists(select 1 from public.giving_recurring_lines where organization_id=o and instruction_id=i.id and fund_id=(p->>'fund_id')::uuid))and(p->>'parent_id'is null or exists(select 1 from public.giving_recurring_lines l join public.giving_funds f on(f.organization_id,f.id)=(l.organization_id,l.fund_id)where l.organization_id=o and l.instruction_id=i.id and(f.parent_id=(p->>'parent_id')::uuid or f.id=(p->>'parent_id')::uuid)))and i.starts_on<((b->>'ends_at')::timestamptz at time zone cfg.timezone)::date and(i.ends_on is null or i.ends_on>=((b->>'starts_at')::timestamptz at time zone cfg.timezone)::date))x;
elsif k in('batch','settlement','reconciliation')then
select coalesce(jsonb_agg(to_jsonb(x)),'[]')into rows from(select bt.id,bt.label,bt.batch_date,bt.kind,bt.status,
coalesce(r.ledger_minor,(select sum(amount_minor)from public.giving_ledger where organization_id=o and currency=cfg.currency and(batch_id=bt.id or id in(select ledger_id from public.giving_batch_entries where organization_id=o and batch_id=bt.id))),0)ledger_minor,r.settlement_minor,r.deposit_minor,r.difference_minor,r.reconciled_at
from public.giving_batches bt left join public.giving_reconciliations r on(r.organization_id,r.batch_id)=(bt.organization_id,bt.id)where bt.organization_id=o and bt.currency=cfg.currency and bt.batch_date>=((b->>'starts_at')::timestamptz at time zone cfg.timezone)::date and bt.batch_date<((b->>'ends_at')::timestamptz at time zone cfg.timezone)::date and(p->>'status'is null or bt.status=p->>'status')and(p->>'batch_type'is null or bt.kind=p->>'batch_type'))x;
elsif k='failed'then
select coalesce(jsonb_agg(to_jsonb(x)),'[]')into rows from(select t.id,t.created_at date,t.amount_minor,t.status,'Processor failure; raw reason withheld'category,t.route_snapshot->>'provider'gateway,t.route_snapshot->>'mid_reference'mid,
(select jsonb_agg(f.name)from public.giving_session_lines l join public.giving_funds f on(f.organization_id,f.id)=(l.organization_id,l.fund_id)where l.organization_id=o and l.leg_id=t.id)funds,
concat_ws(' ',person.first_name,person.last_name)donor
from public.giving_transaction_legs t join public.giving_sessions s on(s.organization_id,s.id)=(t.organization_id,t.session_id)left join public.organization_people person on(person.organization_id,person.id)=(s.organization_id,s.person_id)where t.organization_id=o and t.currency=cfg.currency and t.status='failed'and private.giving_reporting_leg_matches(o,t.id,p)and t.created_at>=(b->>'starts_at')::timestamptz and t.created_at<(b->>'ends_at')::timestamptz)x;
elsif k='refund'then
select coalesce(jsonb_agg(to_jsonb(x)),'[]')into rows from(select r.id,r.created_at date,r.amount_minor,r.status,r.kind,r.reason,r.leg_id original_transaction,(select jsonb_agg(distinct original_id)from public.giving_ledger where organization_id=o and leg_id=r.leg_id and kind='refund')original_gifts,
case when r.amount_minor=t.amount_minor then 'Full'else 'Partial'end extent,t.route_snapshot->>'mid_reference'mid,t.route_snapshot->>'destination_label'merchant,
concat_ws(' ',person.first_name,person.last_name)donor,(select jsonb_agg(f.name)from public.giving_session_lines l join public.giving_funds f on(f.organization_id,f.id)=(l.organization_id,l.fund_id)where l.organization_id=o and l.leg_id=t.id)funds
from public.giving_refunds r join public.giving_transaction_legs t on(t.organization_id,t.id)=(r.organization_id,r.leg_id)join public.giving_sessions s on(s.organization_id,s.id)=(t.organization_id,t.session_id)left join public.organization_people person on(person.organization_id,person.id)=(s.organization_id,s.person_id)where r.organization_id=o and t.currency=cfg.currency and private.giving_reporting_leg_matches(o,t.id,p-array['min_minor','max_minor'])and(p->>'min_minor'is null or r.amount_minor>=(p->>'min_minor')::bigint)and(p->>'max_minor'is null or r.amount_minor<=(p->>'max_minor')::bigint)and r.created_at>=(b->>'starts_at')::timestamptz and r.created_at<(b->>'ends_at')::timestamptz and(p->>'status'is null or r.status=p->>'status'))x;
end if;
-- Comparisons use calendar-local prior ranges. Percent is undefined when the baseline is zero.
foreach cp in array array['today','sunday','week','month','quarter','ytd']loop
cb:=private.giving_period(o,jsonb_build_object('period',cp,'as_of',p->>'as_of'));
cur:=private.giving_reporting_summary(o,p,cb);prev:=private.giving_reporting_summary(o,p,cb||jsonb_build_object('starts_at',cb->'prior_starts_at','ends_at',cb->'prior_ends_at'));
comparisons:=comparisons||jsonb_build_object(cp,jsonb_build_object('period',cb,'current_minor',cur->>'net_minor','prior_minor',prev->>'net_minor','difference_minor',((cur->>'net_minor')::numeric-(prev->>'net_minor')::numeric)::text,'percent_change',case when(prev->>'net_minor')::numeric<>0 then round(((cur->>'net_minor')::numeric-(prev->>'net_minor')::numeric)*100/abs((prev->>'net_minor')::numeric),2)::text end));end loop;
charts:=jsonb_build_object('weekly',private.giving_reporting_series(o,p,b,'week'),'monthly',private.giving_reporting_series(o,p,b,'month'),'prior_monthly',private.giving_reporting_series(o,p,b||jsonb_build_object('starts_at',(((b->>'starts_at')::timestamptz at time zone cfg.timezone)-interval '1 year')at time zone cfg.timezone,'ends_at',(((b->>'ends_at')::timestamptz at time zone cfg.timezone)-interval '1 year')at time zone cfg.timezone),'month'));
return private.giving_management_money(jsonb_build_object('report',k,'period',b,'currency',cfg.currency,'minor_unit_scale',cfg.minor_unit_scale,'summary',summary,'rows',rows,'charts',charts,'comparisons',comparisons,'source_breakdown',(select coalesce(jsonb_agg(jsonb_build_object('label',label,'amount_minor',amount_minor)),'[]')from(select case when source not in('staff_manual','import')then 'Online'else 'Manual '||payment_method end label,sum(amount_minor)::text amount_minor from private.giving_reporting_rows(o,p,b)group by 1)x),'data_source','canonical_ledger','limitations','First recorded donor dates reflect available ledger history, not proven lifetime first gifts. Unknown fees/net proceeds remain unavailable. Commitment reports show overlapping schedules; recurring amounts are per occurrence.','filters',p,
'funds',case when k in('fund','parent','fund_detail')then(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'parent_id',f.parent_id,'direct_minor',coalesce((select sum(amount_minor)from private.giving_reporting_rows(o,p,b)where fund_id=f.id),0)::text)order by f.display_order,f.name),'[]')from public.giving_funds f where organization_id=o)else '[]'::jsonb end,
'selected_routes',case when k='fund_detail'then(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select route_snapshot->>'destination_label'merchant,route_snapshot->>'provider'gateway,route_snapshot->>'mid_reference'mid,sum(amount_minor)::text net_minor from private.giving_reporting_rows(o,p,b)group by 1,2,3)x)else '[]'::jsonb end));end$$;

create function private.giving_statements_ui(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare cfg public.giving_organization_config;b jsonb;result jsonb;s public.giving_statements;identifier uuid;key uuid:=(p->>'request_key')::uuid;v int;existing public.giving_requests;begin
select *into cfg from public.giving_organization_config where organization_id=o;
if a='statement_options'then return jsonb_build_object('people',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',concat_ws(' ',first_name,last_name))order by last_name),'[]')from public.organization_people where organization_id=o),'households',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]')from public.households where organization_id=o and status='active'),'tax_language',cfg.statement_language);end if;
if a='statement_history'then
return jsonb_build_object('statements',(select coalesce(jsonb_agg(jsonb_build_object('id',g.id,'name',g.snapshot->>'recipient','starts_at',g.starts_at,'ends_at',g.ends_at,'generated_at',g.generated_at,'version',g.version,'status','Generated','delivery_status',coalesce((select status from public.giving_statement_delivery_events where organization_id=o and statement_id=g.id order by event_order desc limit 1),'held'))order by g.generated_at desc),'[]')from public.giving_statements g where organization_id=o));end if;
if a='statement_detail'then perform private.giving_payload(p,array['id']);select *into s from public.giving_statements where organization_id=o and id=(p->>'id')::uuid;if not found then raise exception 'Statement unavailable'using errcode='42501';end if;
perform private.giving_audit_event(o,'statement.preview',s.id);return to_jsonb(s)-'generated_by';end if;
perform private.giving_payload(p,array['request_key','person_id','household_id','period','as_of','as_on','starts_on','ends_on','fund_summary']);
b:=private.giving_reporting_period(o,p);
if a='statement_bulk_preview'then
perform private.giving_audit_event(o,'statement.bulk.dry_run',null,jsonb_build_object('period',b));
return jsonb_build_object('dry_run',true,'writes',0,'individuals',(select count(distinct person_id)from private.giving_reporting_rows(o,'{}',b)where tax_eligible and person_id is not null),'households',(select count(distinct household_id)from private.giving_reporting_rows(o,'{}',b)where tax_eligible and household_id is not null),'delivery','HELD');end if;
if (p->>'person_id'is null)=(p->>'household_id'is null)then raise exception 'Choose exactly one donor or household';end if;
perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
select jsonb_build_object('organization',(select name from public.organizations where id=o),'recipient',case when p->>'person_id'is not null then(select concat_ws(' ',first_name,last_name)from public.organization_people where organization_id=o and id=(p->>'person_id')::uuid)else(select name from public.households where organization_id=o and id=(p->>'household_id')::uuid)end,
'address',null,'address_note','No approved mailing address recorded in canonical finance identity.','period',b,'currency',cfg.currency,'minor_unit_scale',cfg.minor_unit_scale,'tax_language',cfg.statement_language,'fund_summary',coalesce((p->>'fund_summary')::boolean,true),'total_minor',coalesce(sum(amount_minor),0)::text,
'contributions',coalesce(jsonb_agg(jsonb_build_object('date',gift_at,'donor',donor_name,'designation',fund_name,'amount_minor',amount_minor::text,'kind',kind)order by gift_at,id),'[]'))into result from private.giving_reporting_rows(o,p,b)where tax_eligible;
if a='statement_preview'then return result||jsonb_build_object('preview',true,'delivery','HELD');end if;
if key is null then raise exception 'Stable statement request key required';end if;
select *into existing from public.giving_requests where organization_id=o and operation='statement_generate'and request_key=key;
if found then if existing.payload<>p then raise exception 'Statement retry content changed';end if;return existing.result;end if;
select coalesce(max(version),0)+1 into v from public.giving_statements where organization_id=o and person_id is not distinct from(p->>'person_id')::uuid and household_id is not distinct from(p->>'household_id')::uuid and starts_at=(b->>'starts_at')::timestamptz and ends_at=(b->>'ends_at')::timestamptz and currency=cfg.currency;
insert into public.giving_statements(organization_id,person_id,household_id,starts_at,ends_at,currency,version,snapshot,generated_by)values(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid,(b->>'starts_at')::timestamptz,(b->>'ends_at')::timestamptz,cfg.currency,v,result,auth.uid())returning id into identifier;
insert into public.giving_statement_delivery_events(organization_id,statement_id,status)values(o,identifier,'generated'),(o,identifier,'held');
result:=jsonb_build_object('id',identifier,'version',v,'delivery','HELD','communications_hook','statement_id; current authority, recipient, consent and provider checks required before future queue');
insert into public.giving_requests values(o,'statement_generate',key,p,result,now());perform private.giving_audit_event(o,case when v=1 then 'statement.generated'else 'statement.regenerated'end,identifier);return result;
end$$;

create function private.giving_reports_api(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;needed text;begin
if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid reporting payload';end if;
if not private.outreach_verified(auth.uid())then raise exception 'Verified reporting identity required'using errcode='42501';end if;
if a='context'then return private.giving_management('context',o,p);end if;
perform private.giving_lock(o);
if p->>'as_on'is not null then p:=(p-'as_on')||jsonb_build_object('as_of',((p->>'as_on')::date+time '12:00')at time zone(select timezone from public.giving_organization_config where organization_id=o));end if;
needed:=case when a like 'statement_%'then 'finance.statements.generate'else 'finance.reports.read'end;
if not private.giving_authorized(o,needed)then raise exception 'Report access denied'using errcode='42501';end if;
if a='choices'then return jsonb_build_object('funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'parent_id',parent_id)order by display_order,name),'[]')from public.giving_funds where organization_id=o),
'people',case when private.giving_authorized(o,'finance.gifts.read')then(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',concat_ws(' ',first_name,last_name))),'[]')from public.organization_people where organization_id=o)else '[]'::jsonb end,
'households',case when private.giving_authorized(o,'finance.gifts.read')then(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]')from public.households where organization_id=o)else '[]'::jsonb end,
'routes',case when private.giving_authorized(o,'finance.reports.merchant')then private.giving_management_routes(o)else '[]'::jsonb end);end if;
if a in('report','dashboard','export')then
result:=private.giving_reporting(o,p);
if a='dashboard'then result:=result||jsonb_build_object('funds',(select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'parent_id',f.parent_id,'display_order',f.display_order,'direct_minor',coalesce((select sum(amount_minor)from private.giving_reporting_rows(o,p,result->'period')where fund_id=f.id),0)::text)order by f.display_order,f.name),'[]')from public.giving_funds f where organization_id=o),
'leadership',jsonb_build_object('pledged_minor',(select coalesce(sum(amount_minor),0)::text from public.giving_pledges where organization_id=o and currency=result->>'currency'and status in('active','paused')),'received_minor',(select coalesce(sum(a.amount_minor),0)::text from public.giving_pledge_allocations a join public.giving_pledges g on(g.organization_id,g.id)=(a.organization_id,a.pledge_id)where a.organization_id=o and g.currency=result->>'currency'and g.status in('active','paused')),'outstanding_minor',(select coalesce(sum(greatest(g.amount_minor-coalesce((select sum(amount_minor)from public.giving_pledge_allocations where organization_id=o and pledge_id=g.id),0),0)),0)::text from public.giving_pledges g where organization_id=o and g.currency=result->>'currency'and g.status in('active','paused')),'unreconciled_batches',(select count(*)from public.giving_batches where organization_id=o and currency=result->>'currency'and status in('open','ready','attention')),
'settlements',(select coalesce(jsonb_agg(jsonb_build_object('merchant',r.route_snapshot->>'destination_label','mid',r.route_snapshot->>'mid_reference','net_minor',r.net_minor)),'[]')from(select t.route_snapshot,case when count(*)filter(where t.net_settlement_minor is null)=0 then sum(t.net_settlement_minor)::text end net_minor from public.giving_transaction_legs t where t.organization_id=o and t.currency=result->>'currency'and t.created_at>=(result->'period'->>'starts_at')::timestamptz and t.created_at<(result->'period'->>'ends_at')::timestamptz group by t.route_snapshot)r)));end if;
if a='export'then
if not(private.giving_authorized(o,'finance.export')or private.giving_authorized(o,'finance.reports.export')and coalesce(p->>'report','summary')in('summary','fund','parent','fund_detail','recurring_mix','payment','manual','online'))then raise exception 'Explicit scoped report export required'using errcode='42501';end if;
perform private.giving_audit_event(o,'report.export',null,jsonb_build_object('report',p->>'report','period',result->'period'));end if;return result;
elsif a in('statement_options','statement_history','statement_detail','statement_preview','statement_generate','statement_bulk_preview')then return private.giving_statements_ui(a,o,p);end if;
raise exception 'Unknown reporting action';end$$;
create function public.giving_reports(p_action text,p_org uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.giving_reports_api(p_action,p_org,p_payload)$$;
revoke all on function public.giving_reports(text,uuid,jsonb)from public,anon,service_role;
grant execute on function public.giving_reports(text,uuid,jsonb)to authenticated;
revoke all on function private.giving_reports_api(text,uuid,jsonb),private.giving_reporting(uuid,jsonb),private.giving_statements_ui(text,uuid,jsonb),private.giving_reporting_rows(uuid,jsonb,jsonb),private.giving_reporting_summary(uuid,jsonb,jsonb),private.giving_reporting_period(uuid,jsonb),private.giving_reporting_series(uuid,jsonb,jsonb,text),private.giving_reporting_leg_matches(uuid,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function private.giving_reports_api(text,uuid,jsonb)to authenticated;

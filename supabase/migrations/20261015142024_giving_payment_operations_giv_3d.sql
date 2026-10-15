-- GIV-3D LOCAL BUILD ONLY. Operational metadata; never a second ledger or payment executor.
create function private.payment_ops_permissions() returns text[] language sql immutable set search_path='' as $$
select array['payments.view','payments.manage','payments.refund.request','payments.refund.approve','payments.refund.execute','payments.void.request','payments.void.approve','payments.void.execute','payments.recurring.manage','payments.method.manage','payments.reconcile','payments.issue.assign']::text[]$$;
do $$declare keys text[];begin
 keys:=array(select distinct unnest(private.staff_permission_keys()||private.payment_ops_permissions()));
 alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
 execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
 execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end$$;
create table private.payment_ops_policy(
 organization_id uuid primary key references public.organizations(id),refund_approval_required boolean not null default true,
 void_approval_required boolean not null default true,refund_threshold_minor bigint check(refund_threshold_minor>=0),currency text not null default 'USD' check(currency~'^[A-Z]{3}$'),
 self_approval boolean not null default false,retry_days int[] not null default '{}',max_attempts int not null default 3 check(max_attempts between 1 and 10),
 expiry_horizon_days int not null default 60 check(expiry_horizon_days between 1 and 180),check(cardinality(retry_days)<=5),check(0<all(retry_days)and 365>=all(retry_days)));
create table private.payment_ops_issues(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),fingerprint text not null,
 issue_type text not null check(issue_type in('payment_failed','payment_unknown','partial_checkout','recurring_failed','payment_method_expiring','refund_pending','void_pending','settlement_mismatch','unreconciled','duplicate_review','provider_configuration','chargeback','manual_review')),
 session_id uuid,leg_id uuid,instruction_id uuid,method_id uuid,gateway_id uuid,
 status text not null default 'open' check(status in('open','assigned','review','resolved','closed')),priority text not null default 'normal' check(priority in('low','normal','high','urgent')),
 assigned_to uuid references auth.users(id),next_action text not null default 'Review payment',last_action text not null default 'Issue opened',revision int not null default 1,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),unique(organization_id,id),unique(organization_id,fingerprint),
 foreign key(organization_id,session_id) references public.giving_sessions(organization_id,id),foreign key(organization_id,leg_id) references public.giving_transaction_legs(organization_id,id),
 foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id),foreign key(organization_id,method_id) references private.payments_methods(organization_id,id),foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id));
create index payment_ops_queue on private.payment_ops_issues(organization_id,status,assigned_to,created_at,id);
create index payment_ops_leg on private.payment_ops_issues(organization_id,leg_id);
create table private.payment_ops_observations(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,leg_id uuid not null,operation_id uuid,
 source_key text not null check(length(source_key) between 1 and 120),result text not null check(result in('paid','failed','unknown','not_found','still_pending','settlement_mismatch','unreconciled','chargeback')),
 failure_category text check(failure_category in('declined','expired_card','invalid_payment_method','insufficient_funds','fraud_review','duplicate','configuration_error','routing_error','processor_unavailable','unknown')),
 gross_minor bigint check(gross_minor>=0),fee_minor bigint check(fee_minor>=0),net_minor bigint,due_on date,
 exception_type text check(exception_type in('missing_transaction','amount_mismatch','fee_mismatch','net_mismatch','duplicate_settlement_mapping','unexpected_mid','provider_transaction_not_found','unmatched_settlement_item')),
 created_at timestamptz not null default now(),unique(organization_id,source_key),
 foreign key(organization_id,leg_id) references public.giving_transaction_legs(organization_id,id),foreign key(organization_id,operation_id) references private.payments_operations(organization_id,id));
create index payment_ops_observation_leg on private.payment_ops_observations(organization_id,leg_id,created_at desc,id);
-- Approval lifecycle extends the existing canonical refund/void request, not a parallel financial request.
alter table public.giving_refunds drop constraint giving_refunds_status_check;
alter table public.giving_refunds add constraint giving_refunds_status_check check(status in('requested','approved','rejected','execution_pending','processing','completed','failed','review','recorded'));
create table private.payment_ops_approvals(
 organization_id uuid not null,refund_id uuid primary key,approval_required boolean not null,self_approval boolean not null,requested_by uuid not null references auth.users(id),
 approved_by uuid references auth.users(id),approved_at timestamptz,route_snapshot jsonb not null,foreign key(organization_id,refund_id) references public.giving_refunds(organization_id,id));
create table private.payment_ops_resolutions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,issue_id uuid not null,resolution_type text not null check(resolution_type in('matched','unmatched','difference','review','resolved','closed','leave_partial','contact_donor','lookup_required')),
 reason text not null check(length(btrim(reason)) between 5 and 500),actor uuid not null references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,issue_id) references private.payment_ops_issues(organization_id,id));
create table private.payment_ops_notes(id uuid primary key default gen_random_uuid(),organization_id uuid not null,issue_id uuid not null,body text not null check(length(btrim(body)) between 1 and 1000),actor uuid not null references auth.users(id),created_at timestamptz not null default now(),foreign key(organization_id,issue_id) references private.payment_ops_issues(organization_id,id));
create table private.payment_ops_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),subject_id uuid not null,
 event_key text not null,kind text not null check(kind in('payment.failed','payment.unknown','recurring.failed','payment_method.expiring','refund.requested','refund.completed','settlement.exception','partial_checkout','provider.degraded','staff.task.requested')),
 delivery_state text not null default 'held' check(delivery_state='held'),created_at timestamptz not null default now(),unique(organization_id,event_key));
create table private.payment_ops_recurring(
 organization_id uuid not null,instruction_id uuid primary key,logical_method_id uuid,status text not null check(status in('active','paused','payment_method_required','past_due','cancel_pending','cancelled','completed','review')),
 failure_count int not null default 0 check(failure_count>=0),last_payment_at timestamptz,last_failure text,next_retry_at timestamptz,cancel_effective_on date,
 revision int not null default 1,foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id),foreign key(organization_id,logical_method_id) references private.payments_methods(organization_id,id));
create table private.payment_ops_recurring_changes(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,instruction_id uuid not null,effective_on date not null,lines jsonb not null,authorization_reference text not null check(length(btrim(authorization_reference))between 5 and 180),
 requested_by uuid not null references auth.users(id),execution text not null default 'held'check(execution='held'),created_at timestamptz not null default now(),foreign key(organization_id,instruction_id) references public.giving_recurring_instructions(organization_id,id));
create table private.payment_ops_defaults(organization_id uuid not null,person_id uuid not null,method_id uuid not null,primary key(organization_id,person_id),foreign key(organization_id,person_id,method_id) references private.payments_methods(organization_id,person_id,id));
create table private.payment_ops_incidents(organization_id uuid not null,gateway_id uuid not null,status text not null check(status in('healthy','degraded','unavailable','maintenance','unknown')),reason text not null check(length(btrim(reason)) between 5 and 500),updated_at timestamptz not null default now(),primary key(organization_id,gateway_id),foreign key(organization_id,gateway_id) references public.giving_gateway_accounts(organization_id,id));
-- Work leases never execute a provider action. Unknown or stale charge outcomes require lookup first.
create table private.payment_ops_jobs(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,issue_id uuid,instruction_id uuid,leg_id uuid,operation_id uuid,kind text not null check(kind in('lookup','retry','recurring_retry','method_update')),
 request_key uuid not null,status text not null default 'held'check(status in('held','leased','completed','review','dead_letter')),lease_token uuid,lease_until timestamptz,attempts int not null default 0,not_before timestamptz not null default now(),requested_by uuid references auth.users(id),created_at timestamptz not null default now(),
 foreign key(organization_id,issue_id) references private.payment_ops_issues(organization_id,id),foreign key(organization_id,instruction_id)references public.giving_recurring_instructions(organization_id,id),foreign key(organization_id,leg_id)references public.giving_transaction_legs(organization_id,id),foreign key(organization_id,operation_id)references private.payments_operations(organization_id,id),unique(organization_id,kind,request_key),unique(organization_id,id));
create unique index payment_ops_open_job on private.payment_ops_jobs(organization_id,issue_id,kind)where status in('held','leased');
create unique index payment_ops_recurring_retry on private.payment_ops_jobs(organization_id,instruction_id,not_before)where kind='recurring_retry';
do $$declare t text;begin for t in select tablename from pg_tables where schemaname='private'and tablename like 'payment_ops_%'loop execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;foreach t in array array['payment_ops_observations','payment_ops_resolutions','payment_ops_notes','payment_ops_events','payment_ops_recurring_changes']loop execute format('create trigger payment_ops_immutable before update or delete on private.%I for each row execute function private.giving_immutable()',t);end loop;end$$;

create function private.payment_ops_safe_text(v text,minimum int default 1,maximum int default 500)returns text language plpgsql immutable set search_path=''as $$begin
 if v is null or length(btrim(v))not between minimum and maximum or v~'[0-9]{13,}'or lower(v)~'(bearer |api[_ -]?key|transaction[_ -]?key|password|raw[_ -]?response|data[valueV]|cvv|cardnumber|routing.number)'then raise exception 'Use a safe non-secret reference or note';end if;return btrim(v);end$$;
create function private.payment_ops_expiry(m int,y int)returns date language sql immutable set search_path=''as $$select (make_date(y,m,1)+interval '1 month'-interval '1 day')::date$$;
create function private.payment_ops_emit(o uuid,subject uuid,k text,key text)returns void language sql security definer set search_path=''as $$insert into private.payment_ops_events(organization_id,subject_id,kind,event_key)values(o,subject,k,key)on conflict do nothing$$;
create function private.payment_ops_issue(o uuid,k text,f text,s uuid default null,l uuid default null,r uuid default null,m uuid default null,g uuid default null)returns uuid language plpgsql security definer set search_path=''as $$declare identifier uuid;event_kind text;begin
 insert into private.payment_ops_issues(organization_id,issue_type,fingerprint,session_id,leg_id,instruction_id,method_id,gateway_id,next_action,priority)
 values(o,k,f,s,l,r,m,g,case k when 'payment_unknown'then 'Check Provider Status — do not retry'when 'duplicate_review'then 'Reconcile related attempts before retry'when 'payment_failed'then 'Ask donor to update method or contact bank'when 'partial_checkout'then 'Review successful and failed lines'else 'Review payment issue'end,case when k in('payment_unknown','duplicate_review','chargeback')then 'high'else 'normal'end)on conflict(organization_id,fingerprint)do nothing returning id into identifier;
 if identifier is null then select id into identifier from private.payment_ops_issues where organization_id=o and fingerprint=f;else
 event_kind:=case k when 'payment_failed'then 'payment.failed'when 'payment_unknown'then 'payment.unknown'when 'partial_checkout'then 'partial_checkout'when 'recurring_failed'then 'recurring.failed'when 'payment_method_expiring'then 'payment_method.expiring'when 'refund_pending'then 'refund.requested'when 'settlement_mismatch'then 'settlement.exception'when 'unreconciled'then 'settlement.exception'when 'provider_configuration'then 'provider.degraded'else null end;if event_kind is not null then perform private.payment_ops_emit(o,identifier,event_kind,'issue:'||identifier);end if;end if;return identifier;end$$;
create function private.payment_ops_sync(o uuid)returns void language plpgsql security definer set search_path=''as $$declare x record;k text;begin
 for x in select l.*,v.result,v.failure_category,v.id observation_id from public.giving_transaction_legs l left join lateral(select * from private.payment_ops_observations v where v.organization_id=o and v.leg_id=l.id order by v.created_at desc,v.id desc limit 1)v on true where l.organization_id=o loop
 k:=case when x.failure_category='duplicate'then 'duplicate_review'when x.failure_category='fraud_review'then 'manual_review'when x.result in('unknown','still_pending')then 'payment_unknown'when x.result='settlement_mismatch'then 'settlement_mismatch'when x.result='unreconciled'then 'unreconciled'when x.result='chargeback'or x.status='disputed'then 'chargeback'when x.result='failed'or x.status='failed'then 'payment_failed'else null end;
 if k is not null then perform private.payment_ops_issue(o,k,k||':'||x.id,x.session_id,x.id,null,null,(x.route_snapshot->>'gateway_id')::uuid);end if;
 end loop;
 for x in select * from public.giving_sessions where organization_id=o and(status='partially_completed'or exists(select 1 from public.giving_transaction_legs where session_id=giving_sessions.id and status in('captured','settled'))and exists(select 1 from public.giving_transaction_legs where session_id=giving_sessions.id and status='failed'))loop perform private.payment_ops_issue(o,'partial_checkout','partial:'||x.id,x.id);end loop;
 for x in select * from private.payments_methods where organization_id=o and status<>'removed'and expiry_month is not null and expiry_year is not null and private.payment_ops_expiry(expiry_month,expiry_year)<=current_date+coalesce((select expiry_horizon_days from private.payment_ops_policy where organization_id=o),60)loop perform private.payment_ops_issue(o,'payment_method_expiring','expiry:'||x.id,null,null,null,x.id);end loop;
 for x in select * from public.giving_recurring_instructions where organization_id=o loop
 insert into private.payment_ops_recurring(organization_id,instruction_id,status)values(o,x.id,case x.status when 'draft'then 'review'when 'failed'then 'past_due'else x.status end)on conflict do nothing;
 if x.status='failed'or exists(select 1 from private.payment_ops_recurring where instruction_id=x.id and status in('past_due','payment_method_required'))then perform private.payment_ops_issue(o,'recurring_failed','recurring:'||x.id,null,null,x.id);end if;
 end loop;
 for x in select * from public.giving_refunds where organization_id=o and status in('requested','approved','execution_pending','review')loop perform private.payment_ops_issue(o,case x.kind when 'void'then 'void_pending'else 'refund_pending'end,'adjustment:'||x.id,null,x.leg_id);end loop;
 for x in select * from public.giving_gateway_accounts where organization_id=o and(configuration_status in('missing','invalid')or not enabled or not exists(select 1 from private.payments_gateway_bindings b where b.organization_id=o and b.gateway_id=giving_gateway_accounts.id))loop perform private.payment_ops_issue(o,'provider_configuration','configuration:'||x.id,null,null,null,null,x.id);end loop;
 for x in select r.* from public.giving_processor_routes r join public.giving_gateway_accounts g on(g.organization_id,g.id)=(r.organization_id,r.gateway_id)where r.organization_id=o and(not r.active or not r.payments_enabled or r.environment<>g.environment or exists(select 1 from public.giving_destinations d where d.organization_id=o and d.processor_route_id=r.id and(d.currency<>r.currency or d.gateway_id<>r.gateway_id)))loop perform private.payment_ops_issue(o,'provider_configuration','configuration.route:'||x.id,null,null,null,null,x.gateway_id);end loop;
end$$;
create function private.payment_ops_rows(o uuid,p jsonb)returns jsonb language sql stable security definer set search_path=''as $$
 select coalesce(jsonb_agg(row_data order by created_at desc,id),'[]')from(
 select i.id,i.created_at,jsonb_build_object('id',i.id,'issue_type',i.issue_type,'status',i.status,'priority',i.priority,'assigned_to',i.assigned_to,'revision',i.revision,'date',i.created_at,'next_action',i.next_action,'last_action',i.last_action,'session_id',coalesce(i.session_id,l.session_id),'leg_id',i.leg_id,'instruction_id',i.instruction_id,'method_id',i.method_id,'gateway_id',i.gateway_id,'donor',concat_ws(' ',person.first_name,person.last_name),'person_id',person.id,'amount_minor',coalesce(adj.amount_minor,l.amount_minor,(select sum(amount_minor)from public.giving_recurring_lines where organization_id=o and instruction_id=i.instruction_id),s.intended_minor)::text,'currency',coalesce(l.currency,rec.currency,s.currency),'provider',g.provider,'gateway',g.label,'merchant_destination',l.route_snapshot->>'destination_label','mid_route',l.route_snapshot->>'route_label','transaction_reference',l.provider_reference)row_data
 from private.payment_ops_issues i left join public.giving_transaction_legs l on(l.organization_id,l.id)=(i.organization_id,i.leg_id)left join public.giving_sessions s on(s.organization_id,s.id)=(i.organization_id,coalesce(i.session_id,l.session_id))left join public.giving_recurring_instructions rec on(rec.organization_id,rec.id)=(i.organization_id,i.instruction_id)left join private.payments_methods met on(met.organization_id,met.id)=(i.organization_id,i.method_id)left join public.giving_refunds adj on adj.organization_id=i.organization_id and i.fingerprint='adjustment:'||adj.id left join public.organization_people person on(person.organization_id,person.id)=(i.organization_id,coalesce(s.person_id,rec.person_id,met.person_id))left join public.giving_gateway_accounts g on(g.organization_id,g.id)=(i.organization_id,coalesce(i.gateway_id,(l.route_snapshot->>'gateway_id')::uuid))
 where i.organization_id=o and(p->>'id'is null or i.id=(p->>'id')::uuid)and(p->>'issue_type'is null or i.issue_type=p->>'issue_type')and(p->>'status'is null or i.status=p->>'status')and(p->>'provider'is null or g.provider=p->>'provider')and(p->>'destination'is null or l.route_snapshot->>'destination_label'=p->>'destination')and(p->>'mid'is null or l.route_snapshot->>'route_label'=p->>'mid')and(p->>'assigned_to'is null or i.assigned_to=(p->>'assigned_to')::uuid)and(p->>'starts_at'is null or i.created_at>=(p->>'starts_at')::timestamptz)and(p->>'ends_at'is null or i.created_at<(p->>'ends_at')::timestamptz)and(p->>'min_minor'is null or l.amount_minor>=(p->>'min_minor')::bigint)and(p->>'max_minor'is null or l.amount_minor<=(p->>'max_minor')::bigint)
 and(p->>'search'is null or concat_ws(' ',person.first_name,person.last_name,person.email,s.id::text,l.provider_reference,l.amount_minor::text,(select string_agg(receipt_number,' ')from public.giving_receipts where organization_id=o and session_id=s.id),(select string_agg(last4,' ')from private.payments_methods where organization_id=o and person_id=s.person_id)) ilike ('%'||(p->>'search')||'%'))order by i.created_at desc,i.id limit 500)x$$;
create function private.payment_ops_summary(o uuid)returns jsonb language sql stable security definer set search_path=''as $$select coalesce(jsonb_object_agg(issue_type,n),'{}')from(select issue_type,count(*)n from private.payment_ops_issues where organization_id=o and status not in('resolved','closed')group by issue_type)x$$;
create function private.payment_ops_session(o uuid,identifier uuid,donor boolean default false)returns jsonb language plpgsql security definer set search_path=''as $$declare s public.giving_sessions;paid bigint;failed bigint;uncertain bigint;begin
 select * into s from public.giving_sessions where organization_id=o and id=identifier;if not found then raise exception 'Payment unavailable'using errcode='42501';end if;
 select coalesce(sum(amount_minor)filter(where status in('captured','settled','partially_refunded','refunded')),0),coalesce(sum(amount_minor)filter(where status='failed'),0),coalesce(sum(amount_minor)filter(where status not in('captured','settled','partially_refunded','refunded','failed','voided')),0)into paid,failed,uncertain from public.giving_transaction_legs where organization_id=o and session_id=s.id;
 return jsonb_build_object('id',s.id,'date',s.created_at,'currency',s.currency,'intended_minor',s.intended_minor::text,'processed_minor',paid::text,'not_processed_minor',failed::text,'unconfirmed_minor',uncertain::text,'status',case when paid>0 and failed>0 then 'partial_success'when uncertain>0 then 'pending_review'else s.status end,'message',case when paid>0 and failed>0 then 'Part of your payment was completed. Review the amounts charged and not charged below.'when uncertain>0 then 'We''re confirming whether your payment went through. Please do not submit it again yet.'when failed>0 then 'Your payment was not completed.'else 'Payment history'end,
 'lines',(select coalesce(jsonb_agg(jsonb_build_object('purpose',private.payments_line_purpose(x),'fund',x.route_snapshot->>'fund_label','amount_minor',x.amount_minor::text,'status',l.status,'unresolved',l.status not in('captured','settled','refunded','partially_refunded','voided','failed'))),'[]')from public.giving_session_lines x join public.giving_transaction_legs l on(l.organization_id,l.id)=(x.organization_id,x.leg_id)where x.organization_id=o and x.session_id=s.id),
 'legs',case when donor then '[]'::jsonb else(select coalesce(jsonb_agg(jsonb_build_object('id',id,'amount_minor',amount_minor::text,'status',status,'provider',route_snapshot->>'provider','gateway_id',route_snapshot->>'gateway_id','route',route_snapshot->>'route_label','destination',route_snapshot->>'destination_label','transaction_reference',provider_reference)),'[]')from public.giving_transaction_legs where organization_id=o and session_id=s.id)end,
 'receipts',(select coalesce(jsonb_agg(jsonb_build_object('number',receipt_number,'generated_at',generated_at,'total_minor',snapshot->>'total_minor')),'[]')from public.giving_receipts where organization_id=o and session_id=s.id),
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'kind',r.kind,'amount_minor',r.amount_minor::text,'status',r.status,'date',r.created_at)),'[]')from public.giving_refunds r join public.giving_transaction_legs l on(l.organization_id,l.id)=(r.organization_id,r.leg_id)where r.organization_id=o and l.session_id=s.id));end$$;
create function private.payment_ops_methods(o uuid,person uuid default null)returns jsonb language sql stable security definer set search_path=''as $$select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'person_id',m.person_id,'brand',m.brand,'last4',m.last4,'expiry_month',m.expiry_month,'expiry_year',m.expiry_year,'status',m.status,'default',exists(select 1 from private.payment_ops_defaults where organization_id=o and person_id=m.person_id and method_id=m.id),'expiry_state',case when m.expiry_month is null or m.expiry_year is null then 'Unknown'when private.payment_ops_expiry(m.expiry_month,m.expiry_year)<current_date then 'Expired'when private.payment_ops_expiry(m.expiry_month,m.expiry_year)<=current_date+coalesce((select expiry_horizon_days from private.payment_ops_policy where organization_id=o),60)then 'Expires Soon'else 'Current'end)),'[]')from private.payments_methods m where m.organization_id=o and(person is null or m.person_id=person)and m.status<>'removed'$$;
create function private.payment_ops_recurring_view(o uuid)returns jsonb language sql stable security definer set search_path=''as $$select coalesce(jsonb_agg(jsonb_build_object('id',r.id,'person_id',r.person_id,'donor',concat_ws(' ',p.first_name,p.last_name),'currency',r.currency,'frequency',r.frequency,'next_due',r.next_run_at,'status',c.status,'failure_count',c.failure_count,'last_payment',c.last_payment_at,'next_action',case when c.status in('past_due','payment_method_required')then 'Update method; review safe retry'else 'Review instruction'end,'revision',c.revision,'method',m.brand||' ending '||m.last4,'amount_minor',(select sum(amount_minor)::text from public.giving_recurring_lines where organization_id=o and instruction_id=r.id),'lines',(select jsonb_agg(jsonb_build_object('fund_id',fund_id,'fund',route_snapshot->>'fund_label','route',route_snapshot->>'route_label','amount_minor',amount_minor::text))from public.giving_recurring_lines where organization_id=o and instruction_id=r.id),'changes',(select coalesce(jsonb_agg(jsonb_build_object('effective_on',effective_on,'lines',lines,'execution',execution)),'[]')from private.payment_ops_recurring_changes where organization_id=o and instruction_id=r.id))),'[]')from public.giving_recurring_instructions r join private.payment_ops_recurring c on(c.organization_id,c.instruction_id)=(r.organization_id,r.id)join public.organization_people p on(p.organization_id,p.id)=(r.organization_id,r.person_id)left join private.payments_methods m on(m.organization_id,m.id)=(c.organization_id,c.logical_method_id)where r.organization_id=o$$;
create function private.payment_ops_method_action(a text,o uuid,p jsonb,person uuid default null)returns jsonb language plpgsql security definer set search_path=''as $$declare m private.payments_methods;identifier uuid;begin
 perform private.giving_payload(p,array['id','request_key','person_id']);
 if a in('method_add','method_replace')then
 if a='method_replace'then select * into m from private.payments_methods where organization_id=o and id=(p->>'id')::uuid and(person is null or person_id=person)and status<>'removed';if not found then raise exception 'Method unavailable'using errcode='42501';end if;end if;
 perform private.giving_audit_event(o,'payment_ops.method_update.initiated',m.id);return jsonb_build_object('status','held','message','Secure provider-hosted payment entry is not yet enabled. No card or bank details are collected.');
 end if;
 select * into m from private.payments_methods where organization_id=o and id=(p->>'id')::uuid and(person is null or person_id=person)and status<>'removed';if not found then raise exception 'Method unavailable'using errcode='42501';end if;
 if a='method_default'then
 if m.status<>'active'or m.expiry_month is not null and private.payment_ops_expiry(m.expiry_month,m.expiry_year)<current_date then raise exception 'An active current method is required';end if;
 insert into private.payment_ops_defaults values(o,m.person_id,m.id)on conflict(organization_id,person_id)do update set method_id=excluded.method_id;
 elsif a='method_remove'then
 update private.payments_methods set status='removed',updated_at=now()where id=m.id;update private.giving_payment_profiles set active=false,reference_status='removed'where organization_id=o and logical_method_id=m.id;delete from private.payment_ops_defaults where organization_id=o and method_id=m.id;
 else raise exception 'Unknown method action';end if;perform private.giving_audit_event(o,'payment_ops.'||a,m.id);return jsonb_build_object('id',m.id,'execution','held');end$$;
create function private.payment_ops_method_guard()returns trigger language plpgsql security definer set search_path=''as $$begin
 if new.status='removed'and old.status<>'removed'and exists(select 1 from public.giving_recurring_instructions r where r.organization_id=new.organization_id and r.person_id=new.person_id and (r.status in('active','paused','failed')or exists(select 1 from private.payment_ops_recurring c where c.instruction_id=r.id and c.status in('active','paused','past_due','payment_method_required','cancel_pending')))and(r.payment_profile_id in(select id from private.giving_payment_profiles where organization_id=new.organization_id and logical_method_id=new.id)or exists(select 1 from private.payment_ops_recurring where instruction_id=r.id and logical_method_id=new.id)))then
 if not exists(select 1 from private.payments_methods m where m.organization_id=new.organization_id and m.person_id=new.person_id and m.id<>new.id and m.status='active'and(m.expiry_month is null or private.payment_ops_expiry(m.expiry_month,m.expiry_year)>=current_date))then raise exception 'Add a valid replacement before removing a method used by recurring giving';end if;
 -- Existence alone does not transfer provider bindings: require reviewed recurring remapping first.
 raise exception 'Update the recurring instruction to a compatible replacement before removal';end if;return new;end$$;
create trigger payment_ops_method_remove before update on private.payments_methods for each row execute function private.payment_ops_method_guard();
create function private.payment_ops_workspace(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare key uuid;identifier uuid:=(p->>'id')::uuid;permission text;result jsonb;previous public.giving_requests;i private.payment_ops_issues;l public.giving_transaction_legs;r public.giving_refunds;cfg private.payment_ops_policy;c private.payment_ops_recurring;ins public.giving_recurring_instructions;approval private.payment_ops_approvals;v private.payment_ops_observations;line jsonb;amount bigint;target uuid;begin
 if not private.outreach_verified(auth.uid())then raise exception 'Verified finance access required'using errcode='42501';end if;
 if a='context'then return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'permissions',permissions)),'[]')from(select id,name,array(select k from unnest(private.payment_ops_permissions()||array['finance.reports.read','finance.export'])k where private.giving_authorized(id,k))permissions from public.organizations)x where cardinality(permissions)>0),'execution','held');end if;
 perform private.giving_lock(o);
 if a='summary'then
 if not private.giving_authorized(o,'payments.view')and not private.giving_authorized(o,'finance.reports.read')then raise exception 'Summary unavailable'using errcode='42501';end if;perform private.payment_ops_sync(o);return private.payment_ops_summary(o);end if;
 perform private.payments_require(o,'payments.view');
 permission:=case when a in('refund_request','void_request')then 'payments.'||split_part(a,'_',1)||'.request'when a in('refund_approve','refund_reject','void_approve','void_reject')then 'payments.'||split_part(a,'_',1)||'.approve'when a in('refund_execute','void_execute')then 'payments.'||split_part(a,'_',1)||'.execute'when a like 'recurring_%'and a<>'recurring_list'then 'payments.recurring.manage'when a like 'method_%'then 'payments.method.manage'when a in('assign','claim')then 'payments.issue.assign'when a='reconcile'then 'payments.reconcile'when a in('policy','incident','retry','lookup','note','resolve','task_hook')then 'payments.manage'when a='export'then 'finance.export'else 'payments.view'end;
 perform private.payments_require(o,permission);
 perform private.payment_ops_sync(o);
 if a='options'then perform private.giving_payload(p,array[]::text[]);return jsonb_build_object('staff',(select coalesce(jsonb_agg(jsonb_build_object('id',d.user_id,'name',d.display_name)),'[]')from public.organization_staff_directory d where d.organization_id=o and private.payments_actor_current(o,d.user_id)),'gateways',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',label)),'[]')from public.giving_gateway_accounts where organization_id=o),'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]')from public.giving_funds where organization_id=o and status='active'),'methods',private.payment_ops_methods(o));
 elsif a in('dashboard','queue','my_work','report','export')then
 perform private.giving_payload(p,array['issue_type','provider','destination','mid','starts_at','ends_at','min_minor','max_minor','assigned_to','status','search']);
 if p->>'search'is not null then perform private.payment_ops_safe_text(p->>'search',1,120);end if;
 return jsonb_build_object('counts',private.payment_ops_summary(o),'issues',private.payment_ops_rows(o,case when a='my_work'then p||jsonb_build_object('assigned_to',auth.uid())else p end),'execution','held','policy',coalesce((select to_jsonb(x)from private.payment_ops_policy x where organization_id=o),'{}'),'staff',(select coalesce(jsonb_agg(jsonb_build_object('id',d.user_id,'name',d.display_name)),'[]')from public.organization_staff_directory d where d.organization_id=o and private.payments_actor_current(o,d.user_id)));
 elsif a='methods'then perform private.giving_payload(p,array['person_id']);return jsonb_build_object('methods',private.payment_ops_methods(o,(p->>'person_id')::uuid),'execution','held');
 elsif a='recurring_list'then perform private.giving_payload(p,array[]::text[]);return jsonb_build_object('recurring',private.payment_ops_recurring_view(o),'execution','held');
 elsif a='session'then perform private.giving_payload(p,array['id']);return private.payment_ops_session(o,identifier);
 elsif a in('issue','transaction','reconciliation','refund_detail')then
 perform private.giving_payload(p,array['id']);
 if a='refund_detail'then select * into r from public.giving_refunds where organization_id=o and id=identifier;if not found then raise exception 'Request unavailable'using errcode='42501';end if;select * into i from private.payment_ops_issues where organization_id=o and fingerprint='adjustment:'||r.id;else select * into i from private.payment_ops_issues where organization_id=o and id=identifier;end if;
 if i.id is null then raise exception 'Issue unavailable'using errcode='42501';end if;
 select * into l from public.giving_transaction_legs where organization_id=o and id=i.leg_id;
 return jsonb_build_object('issue',(select x from jsonb_array_elements(private.payment_ops_rows(o,jsonb_build_object('id',i.id)))x where x->>'id'=i.id::text),'session',case when coalesce(i.session_id,l.session_id)is not null then private.payment_ops_session(o,coalesce(i.session_id,l.session_id))end,
 'attempts',(select coalesce(jsonb_agg(jsonb_build_object('attempt',n,'date',started_at,'provider',provider,'route_id',route_id,'operation',operation,'result',state,'failure',failure_category,'next_action',case when failure_category in('unknown','duplicate','fraud_review')then 'Reconcile before retry'else 'Review safe next action'end)),'[]')from(select j.*,op.operation,row_number()over(order by j.started_at,j.id)n from private.payments_journal j join private.payments_operations op on(op.organization_id,op.id)=(j.organization_id,j.operation_id)where op.organization_id=o and op.leg_id=l.id)x),
 'observations',(select coalesce(jsonb_agg(jsonb_build_object('result',result,'failure',failure_category,'gross_minor',gross_minor::text,'fee_minor',fee_minor::text,'net_minor',net_minor::text,'difference_minor',case when gross_minor is null then null else(gross_minor-l.amount_minor)::text end,'due_on',due_on,'exception_type',exception_type,'date',created_at)order by created_at),'[]')from private.payment_ops_observations where organization_id=o and leg_id=l.id),
 'refunds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'amount_minor',amount_minor::text,'status',status,'reason',reason,'requested_by',created_by,'requested_at',created_at)),'[]')from public.giving_refunds where organization_id=o and leg_id=l.id),
 'notes',(select coalesce(jsonb_agg(jsonb_build_object('body',body,'actor',actor,'date',created_at)),'[]')from private.payment_ops_notes where organization_id=o and issue_id=i.id),
 'resolutions',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from private.payment_ops_resolutions x where organization_id=o and issue_id=i.id),
 'settlements',(select coalesce(jsonb_agg(jsonb_build_object('batch',provider_batch_reference,'date',settlement_date,'gross_minor',gross_minor::text,'fee_minor',fee_minor::text,'net_minor',net_minor::text,'state',state)),'[]')from private.payments_settlements where organization_id=o and route_id=(l.route_snapshot->>'processor_route_id')::uuid),
 'audit',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'actor',actor_user_id,'date',created_at,'detail',safe_detail)order by created_at),'[]')from public.giving_audit where organization_id=o and subject_id in(i.id,l.id,r.id)), 'execution','held');
 end if;
 -- Current permission is checked before returning any idempotent mutation result.
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Operation request key required';end if;
 select * into previous from public.giving_requests where organization_id=o and operation='payment_ops.'||a and request_key=key;
 if found then if previous.payload<>p then raise exception 'Operation content changed'using errcode='PT409';end if;return previous.result;end if;
 insert into private.payment_ops_policy(organization_id)values(o)on conflict do nothing;select * into cfg from private.payment_ops_policy where organization_id=o;
 if a='policy'then
 perform private.giving_payload(p,array['request_key','refund_approval_required','void_approval_required','refund_threshold_minor','currency','self_approval','retry_days','max_attempts','expiry_horizon_days']);
 update private.payment_ops_policy set refund_approval_required=(p->>'refund_approval_required')::boolean,void_approval_required=(p->>'void_approval_required')::boolean,refund_threshold_minor=(p->>'refund_threshold_minor')::bigint,currency=p->>'currency',self_approval=(p->>'self_approval')::boolean,retry_days=array(select jsonb_array_elements_text(p->'retry_days')::int),max_attempts=(p->>'max_attempts')::int,expiry_horizon_days=(p->>'expiry_horizon_days')::int where organization_id=o;result:=jsonb_build_object('configured',true,'execution','held');
 elsif a in('refund_request','void_request')then
 perform private.giving_payload(p,array['request_key','leg_id','amount_minor','reason']);
 perform private.payment_ops_safe_text(p->>'reason',5,500);if jsonb_typeof(p->'amount_minor')<>'string'or p->>'amount_minor'!~'^[0-9]{1,13}$'then raise exception 'Exact minor unit string required';end if;
 select * into l from public.giving_transaction_legs where organization_id=o and id=(p->>'leg_id')::uuid;if not found then raise exception 'Leg unavailable'using errcode='42501';end if;
 if l.currency<>cfg.currency then raise exception 'Configure approval policy for this currency';end if;
 if a='void_request'and exists(select 1 from public.giving_refunds where organization_id=o and leg_id=l.id and kind='void'and status not in('failed','rejected'))then raise exception 'A void request already exists for this authorization';end if;
 result:=private.giving_financial_action(o,'refund_request',p||jsonb_build_object('kind',split_part(a,'_',1)));
 identifier:=(result->>'id')::uuid;
 insert into private.payment_ops_approvals(organization_id,refund_id,requested_by,approval_required,self_approval,route_snapshot)values(o,identifier,auth.uid(),case when a='void_request'then cfg.void_approval_required else cfg.refund_approval_required or cfg.refund_threshold_minor is not null and (p->>'amount_minor')::bigint>=cfg.refund_threshold_minor end,cfg.self_approval,l.route_snapshot);
 result:=jsonb_build_object('id',identifier,'status','requested','execution','held');perform private.payment_ops_sync(o);
 elsif a in('refund_approve','void_approve','refund_reject','void_reject','refund_execute','void_execute')then
 perform private.giving_payload(p,array['request_key','id','reason']);perform private.payment_ops_safe_text(p->>'reason',5,500);
 select * into r from public.giving_refunds where organization_id=o and id=identifier and kind=split_part(a,'_',1);select * into approval from private.payment_ops_approvals where organization_id=o and refund_id=r.id;if r.id is null or approval.refund_id is null then raise exception 'Request unavailable'using errcode='42501';end if;
 if a like '%approve'or a like '%reject'then
 if r.status<>'requested'then raise exception 'Request already reviewed'using errcode='PT409';end if;
 if a like '%approve'and approval.requested_by=auth.uid()and not approval.self_approval then raise exception 'A different authorized reviewer must approve this request'using errcode='42501';end if;
 update public.giving_refunds set status=case when a like '%reject'then 'rejected'else 'approved'end where id=r.id;
 update private.payment_ops_approvals set approved_by=auth.uid(),approved_at=now()where refund_id=r.id;
 else
 if r.status<>'approved'and(approval.approval_required or r.status<>'requested')then raise exception 'Approval required';end if;
 select * into l from public.giving_transaction_legs where organization_id=o and id=r.leg_id;
 if r.kind='void'and l.status not in('created','pending','authorized')or r.kind='refund'and l.status not in('captured','settled','partially_refunded')then raise exception 'Original transaction state changed; review eligibility again';end if;
 -- This is a held execution request. It cannot invoke the provider or financial finalizer.
 update public.giving_refunds set status='execution_pending'where id=r.id;
 end if;
 result:=jsonb_build_object('id',r.id,'status',case when a like '%reject'then 'rejected'when a like '%approve'then 'approved'else 'execution_pending'end,'execution','held');
 elsif a in('assign','claim','note','resolve','reconcile','task_hook','lookup','retry')then
 perform private.giving_payload(p,array['request_key','id','revision','assigned_to','priority','reason','resolution_type']);
 select * into i from private.payment_ops_issues where organization_id=o and id=identifier;if not found then raise exception 'Issue unavailable'using errcode='42501';end if;
 if a='claim'and i.assigned_to is not null then result:=jsonb_build_object('id',i.id,'claimed',false);
 else
 if a in('assign','claim','resolve','reconcile')and(i.revision is distinct from(p->>'revision')::int)then raise exception 'Issue changed; reload'using errcode='PT409';end if;
 if a in('assign','claim')then
 target:=case when a='claim'then auth.uid()else(p->>'assigned_to')::uuid end;
 if target is not null and not private.payments_actor_current(o,target)then raise exception 'Active finance assignee required';end if;
 update private.payment_ops_issues set assigned_to=target,status=case when target is null then 'open'else 'assigned'end,priority=coalesce(p->>'priority',priority),revision=revision+1,updated_at=now(),last_action='Assignment updated'where id=i.id;
 result:=jsonb_build_object('id',i.id,'claimed',true,'assigned_to',target);
 elsif a='note'then insert into private.payment_ops_notes(organization_id,issue_id,body,actor)values(o,i.id,private.payment_ops_safe_text(p->>'reason',1,1000),auth.uid());result:=jsonb_build_object('id',i.id);
 elsif a in('resolve','reconcile')then
 if i.issue_type in('settlement_mismatch','unreconciled')then perform private.payments_require(o,'payments.reconcile');end if;
 if a='reconcile'and i.issue_type not in('settlement_mismatch','unreconciled')then raise exception 'Settlement exception required';end if;
 if i.issue_type in('payment_unknown','duplicate_review')and p->>'resolution_type'not in('review','lookup_required')and not exists(select 1 from(select result,created_at from private.payment_ops_observations where organization_id=o and leg_id=i.leg_id order by created_at desc,id desc limit 1)latest where result in('paid','failed','not_found')and created_at>i.created_at)then raise exception 'Verified provider lookup required before closing uncertainty';end if;
 insert into private.payment_ops_resolutions(organization_id,issue_id,resolution_type,reason,actor)values(o,i.id,p->>'resolution_type',private.payment_ops_safe_text(p->>'reason',5,500),auth.uid());
 update private.payment_ops_issues set status=case when p->>'resolution_type'in('review','difference','unmatched','lookup_required')then 'review'when p->>'resolution_type'='closed'then 'closed'else 'resolved'end,last_action='Resolution recorded',revision=revision+1,updated_at=now()where id=i.id;
 result:=jsonb_build_object('id',i.id,'resolution',p->>'resolution_type');
 elsif a='task_hook'then perform private.payment_ops_emit(o,i.id,'staff.task.requested','task:'||i.id);result:=jsonb_build_object('id',i.id,'task_hook','held','message','Task intent recorded; no donor message or cross-role task created.');
 else
 if a='retry'then
 select * into v from private.payment_ops_observations where organization_id=o and leg_id=i.leg_id order by created_at desc,id desc limit 1;
 if v.id is null or v.result not in('failed','not_found')or v.failure_category in('fraud_review','duplicate','configuration_error','routing_error','invalid_payment_method','expired_card','unknown')then raise exception 'Reconcile unknown outcomes or update payment method before retry';end if;
 if exists(select 1 from private.payment_ops_incidents where organization_id=o and gateway_id=i.gateway_id and status in('unavailable','maintenance'))then raise exception 'Provider is unavailable; retry held';end if;
 end if;
 insert into private.payment_ops_jobs(organization_id,issue_id,leg_id,kind,request_key,requested_by)values(o,i.id,i.leg_id,case when a='lookup'then 'lookup'else 'retry'end,key,auth.uid())on conflict do nothing returning id into target;
 if target is null then select id into target from private.payment_ops_jobs where organization_id=o and issue_id=i.id and kind=case when a='lookup'then 'lookup'else 'retry'end and status in('held','leased');end if;
 result:=jsonb_build_object('id',target,'execution','held','next_action',case when a='lookup'then 'Check Provider Status requested; no provider connected'else 'Retry requested; execution remains held'end);
 end if;end if;
 elsif a like 'method_%'then result:=private.payment_ops_method_action(a,o,p);
 elsif a in('recurring_pause','recurring_resume','recurring_cancel','recurring_change','recurring_method','recurring_retry')then
 perform private.giving_payload(p,array['request_key','id','revision','reason','method_id','effective_on','authorization_reference','lines']);
 select * into ins from public.giving_recurring_instructions where organization_id=o and id=identifier;select * into c from private.payment_ops_recurring where organization_id=o and instruction_id=identifier;
 if ins.id is null or c.revision is distinct from(p->>'revision')::int then raise exception 'Instruction changed or unavailable'using errcode='PT409';end if;
 if a='recurring_pause'then update private.payment_ops_recurring set status='paused',revision=revision+1 where instruction_id=ins.id;update public.giving_recurring_instructions set status='paused',revision=revision+1 where id=ins.id;
 elsif a='recurring_resume'then
 if c.status not in('paused','past_due','payment_method_required','review')or not exists(select 1 from private.payments_methods where organization_id=o and id=c.logical_method_id and person_id=ins.person_id and status='active'and(expiry_month is null or private.payment_ops_expiry(expiry_month,expiry_year)>=current_date))then raise exception 'A reviewed valid method is required before resume';end if;
 if c.last_failure in('unknown','fraud_review','duplicate','configuration_error','routing_error')then raise exception 'Reconcile current failure before resume';end if;
 update private.payment_ops_recurring set status='active',revision=revision+1 where instruction_id=ins.id;update public.giving_recurring_instructions set status='active',revision=revision+1 where id=ins.id;
 -- No provider activation implied; underlying execution gates remain false.
 elsif a='recurring_cancel'then
 if p->>'effective_on'is not null and(p->>'effective_on')::date>current_date then
 if ins.ends_on is null or(p->>'effective_on')::date<>ins.ends_on then raise exception 'Deferred cancel must use the agreed end date';end if;
 update private.payment_ops_recurring set status='cancel_pending',cancel_effective_on=ins.ends_on,revision=revision+1 where instruction_id=ins.id;
 else update private.payment_ops_recurring set status='cancelled',revision=revision+1 where instruction_id=ins.id;update public.giving_recurring_instructions set status='cancelled',revision=revision+1 where id=ins.id;end if;
 elsif a='recurring_method'then
 if not exists(select 1 from private.payments_methods where organization_id=o and id=(p->>'method_id')::uuid and person_id=ins.person_id and status='active'and(expiry_month is null or private.payment_ops_expiry(expiry_month,expiry_year)>=current_date))then raise exception 'Compatible active donor method required';end if;
 -- Private account profiles must cover every original route before a mapping can become usable.
 if exists(select 1 from public.giving_recurring_lines x where x.organization_id=o and instruction_id=ins.id and not exists(select 1 from private.giving_payment_profiles pp join private.payments_token_routes tr on tr.profile_id=pp.id where pp.organization_id=o and pp.person_id=ins.person_id and pp.logical_method_id=(p->>'method_id')::uuid and pp.active and pp.reference_status='active'and tr.route_id=(x.route_snapshot->>'processor_route_id')::uuid))then raise exception 'Method is not compatible with every recurring gateway route';end if;
 update private.payment_ops_recurring set logical_method_id=(p->>'method_id')::uuid,revision=revision+1 where instruction_id=ins.id;
 update public.giving_recurring_instructions set payment_profile_id=(select pp.id from private.giving_payment_profiles pp where pp.organization_id=o and pp.person_id=ins.person_id and pp.logical_method_id=(p->>'method_id')::uuid and pp.active and pp.reference_status='active'order by pp.id limit 1),revision=revision+1 where id=ins.id;
 elsif a='recurring_change'then
 if(p->>'effective_on')::date<current_date or p->>'effective_on'is null or jsonb_typeof(p->'lines')<>'array'or jsonb_array_length(p->'lines')not between 1 and 30 then raise exception 'Future effective date and exact designation lines required';end if;
 for line in select value from jsonb_array_elements(p->'lines')loop perform private.giving_payload(line,array['fund_id','amount_minor']);if jsonb_typeof(line->'amount_minor')<>'string'or line->>'amount_minor'!~'^[0-9]{1,13}$'or(line->>'amount_minor')::bigint not between 1 and 1000000000000 then raise exception 'Exact amount required';end if;perform private.payments_route(o,(line->>'fund_id')::uuid,null,'charitable_contribution',ins.currency);end loop;
 insert into private.payment_ops_recurring_changes(organization_id,instruction_id,effective_on,lines,authorization_reference,requested_by)values(o,ins.id,(p->>'effective_on')::date,p->'lines',private.payment_ops_safe_text(p->>'authorization_reference',5,180),auth.uid());
 update private.payment_ops_recurring set revision=revision+1 where instruction_id=ins.id;
 else
 if c.status not in('past_due','payment_method_required')or c.last_failure is null or c.last_failure in('unknown','fraud_review','duplicate','configuration_error','routing_error','invalid_payment_method','expired_card')then raise exception 'Recurring retry requires reconciled retryable failure';end if;
 insert into private.payment_ops_jobs(organization_id,instruction_id,kind,request_key,not_before,requested_by)values(o,ins.id,'recurring_retry',key,coalesce(c.next_retry_at,now()),auth.uid())on conflict do nothing;
 end if;
 result:=jsonb_build_object('id',ins.id,'execution','held');
 elsif a='incident'then
 perform private.giving_payload(p,array['request_key','id','status','reason']);if not exists(select 1 from public.giving_gateway_accounts where organization_id=o and id=identifier)then raise exception 'Gateway unavailable'using errcode='42501';end if;
 insert into private.payment_ops_incidents values(o,identifier,p->>'status',private.payment_ops_safe_text(p->>'reason',5,500),now())on conflict(organization_id,gateway_id)do update set status=excluded.status,reason=excluded.reason,updated_at=now();
 if p->>'status'<>'healthy'then perform private.payment_ops_emit(o,identifier,'provider.degraded','incident:'||key);end if;result:=jsonb_build_object('id',identifier,'execution','held');
 else raise exception 'Unknown operations action';end if;
 perform private.giving_audit_event(o,'payment_ops.'||a,coalesce(identifier,(result->>'id')::uuid),jsonb_build_object('request_key',key,'execution','held','reason',case when p->>'reason'is null then null else private.payment_ops_safe_text(p->>'reason',1,1000)end));
 insert into public.giving_requests values(o,'payment_ops.'||a,key,p,result,now());return result;
end$$;
create function private.payment_ops_service(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$
#variable_conflict use_column
declare l public.giving_transaction_legs;v private.payment_ops_observations;op private.payments_operations;j private.payment_ops_jobs;c private.payment_ops_recurring;ins public.giving_recurring_instructions;cfg private.payment_ops_policy;identifier uuid;key uuid;previous public.giving_requests;result jsonb;begin
 if current_setting('role',true)<>'service_role'then raise exception 'Operations service authority required'using errcode='42501';end if;perform private.giving_lock(o);
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Service request key required';end if;
 select * into previous from public.giving_requests where organization_id=o and operation='payment_ops.service.'||a and request_key=key;
 if found then if previous.payload<>p then raise exception 'Service replay conflict'using errcode='PT409';end if;if a='claim'and not exists(select 1 from private.payment_ops_jobs where organization_id=o and id=(p->>'id')::uuid and status='leased'and lease_until>now()and lease_token=(previous.result->>'lease_token')::uuid)then return jsonb_build_object('claimed',false,'execution','held');end if;return previous.result;end if;
 select * into cfg from private.payment_ops_policy where organization_id=o;
 if a='observe'then
 perform private.giving_payload(p,array['request_key','source_key','leg_id','operation_id','result','failure_category','gross_minor','fee_minor','net_minor','exception_type','due_on']);
 perform private.payment_ops_safe_text(p->>'source_key',1,120);
 if exists(select 1 from jsonb_each(p)x where x.key in('gross_minor','fee_minor','net_minor')and x.value<>'null'::jsonb and(jsonb_typeof(x.value)<>'string'or x.value#>>'{}'!~'^-?[0-9]{1,13}$'))then raise exception 'Exact minor units required';end if;
 select * into l from public.giving_transaction_legs where organization_id=o and id=(p->>'leg_id')::uuid;if not found then raise exception 'Leg unavailable'using errcode='42501';end if;
 if p->>'operation_id'is not null and not exists(select 1 from private.payments_operations where organization_id=o and id=(p->>'operation_id')::uuid and leg_id=l.id)then raise exception 'Operation/leg mismatch';end if;
 select * into v from private.payment_ops_observations where organization_id=o and source_key=p->>'source_key';if found then raise exception 'Observation identity already used; reuse exact request key'using errcode='PT409';end if;
 insert into private.payment_ops_observations(organization_id,leg_id,operation_id,source_key,result,failure_category,gross_minor,fee_minor,net_minor,exception_type,due_on)values(o,l.id,(p->>'operation_id')::uuid,p->>'source_key',p->>'result',p->>'failure_category',(p->>'gross_minor')::bigint,(p->>'fee_minor')::bigint,(p->>'net_minor')::bigint,p->>'exception_type',(p->>'due_on')::date)returning id into identifier;
 -- An observation resolves an operations question only; it cannot promote the canonical leg or ledger.
 perform private.payment_ops_sync(o);result:=jsonb_build_object('id',identifier,'financial_posting',false);
 elsif a='recurring_failure'then
 perform private.giving_payload(p,array['request_key','id','failure_category']);
 if p->>'failure_category'not in('declined','insufficient_funds','unknown','fraud_review','duplicate','configuration_error','routing_error','processor_unavailable','invalid_payment_method','expired_card')or p->>'failure_category'is null then raise exception 'Normalized reason required';end if;
 select * into ins from public.giving_recurring_instructions where organization_id=o and id=(p->>'id')::uuid;if not found then raise exception 'Instruction unavailable'using errcode='42501';end if;perform private.payment_ops_sync(o);
 update private.payment_ops_recurring set failure_count=failure_count+1,last_failure=p->>'failure_category',status=case when p->>'failure_category'in('expired_card','invalid_payment_method')then 'payment_method_required'when p->>'failure_category'in('unknown','fraud_review','duplicate','configuration_error','routing_error')then 'review'else 'past_due'end,revision=revision+1 where instruction_id=ins.id returning * into c;
 identifier:=private.payment_ops_issue(o,'recurring_failed','recurring:'||ins.id,null,null,ins.id);
 if c.failure_count>=coalesce(cfg.max_attempts,3)then update private.payment_ops_recurring set status='review',next_retry_at=null where instruction_id=ins.id;update private.payment_ops_issues set status='review',next_action='Manual review — retry limit reached'where id=identifier;
 elsif p->>'failure_category'in('declined','insufficient_funds','processor_unavailable')and cardinality(cfg.retry_days)>=c.failure_count then
 update private.payment_ops_recurring set next_retry_at=now()+make_interval(days=>cfg.retry_days[c.failure_count])where instruction_id=ins.id;
 insert into private.payment_ops_jobs(organization_id,instruction_id,kind,request_key,not_before)values(o,ins.id,'recurring_retry',key,now()+make_interval(days=>cfg.retry_days[c.failure_count]));
 end if;result:=jsonb_build_object('id',ins.id,'failure_count',c.failure_count,'execution','held');
 elsif a='claim'then
 perform private.giving_payload(p,array['request_key','id']);select * into j from private.payment_ops_jobs where organization_id=o and id=(p->>'id')::uuid;
 if not found then raise exception 'Work unavailable'using errcode='42501';end if;
 if j.status<>'held'or j.not_before>now()then return jsonb_build_object('claimed',false,'execution','held');end if;
 if j.requested_by is not null and not exists(select 1 from public.organization_staff_directory d join public.organization_staff_permissions p on(p.organization_id,p.user_id)=(d.organization_id,d.user_id)where d.organization_id=o and d.user_id=j.requested_by and d.active and d.effective_at<=now()and(d.expires_at is null or d.expires_at>now())and p.permission=case when j.kind='recurring_retry'then 'payments.recurring.manage'else 'payments.manage'end and p.revoked_at is null and p.effective_at<=now()and(p.expires_at is null or p.expires_at>now()))then raise exception 'Current initiating permission required'using errcode='42501';end if;
 if j.kind='retry'then select * into v from private.payment_ops_observations where organization_id=o and leg_id=j.leg_id order by created_at desc,id desc limit 1;if v.id is null or v.result not in('failed','not_found')or v.failure_category in('unknown','fraud_review','duplicate','configuration_error','routing_error','invalid_payment_method','expired_card')then raise exception 'Current reconciliation required before retry lease';end if;end if;
 if j.kind='recurring_retry'then select * into c from private.payment_ops_recurring where organization_id=o and instruction_id=j.instruction_id;if c.status not in('past_due','payment_method_required')or c.last_failure not in('declined','insufficient_funds','processor_unavailable')then raise exception 'Recurring execution is held for review';end if;end if;
 if j.attempts>=coalesce(cfg.max_attempts,3)then update private.payment_ops_jobs set status='dead_letter'where id=j.id;return jsonb_build_object('claimed',false,'state','dead_letter');end if;
 update private.payment_ops_jobs set status='leased',lease_token=gen_random_uuid(),lease_until=now()+interval '5 minutes',attempts=attempts+1 where id=j.id returning * into j;
 result:=jsonb_build_object('id',j.id,'claimed',true,'lease_token',j.lease_token,'lease_until',j.lease_until,'execution','held');
 elsif a='recover'then
 perform private.giving_payload(p,array['request_key','id']);select * into j from private.payment_ops_jobs where organization_id=o and id=(p->>'id')::uuid;
 if j.id is null or j.status<>'leased'or j.lease_until>=now()then raise exception 'Expired work lease required';end if;
 update private.payment_ops_jobs set status=case when attempts>=coalesce(cfg.max_attempts,3)then 'dead_letter'when kind='lookup'then 'held'else 'review'end,lease_token=null,lease_until=null where id=j.id;
 if j.kind in('retry','recurring_retry')and j.leg_id is not null then insert into private.payment_ops_jobs(organization_id,leg_id,operation_id,kind,request_key)values(o,j.leg_id,j.operation_id,'lookup',key)on conflict do nothing;end if;
 result:=jsonb_build_object('id',j.id,'execution','held','message','Expired lease recovered; uncertain charge requires lookup, never blind recharge.');
 elsif a='refund_completed'then
 perform private.giving_payload(p,array['request_key','id']);if not exists(select 1 from public.giving_refunds r join public.giving_refund_outcomes v on(v.organization_id,v.refund_id)=(r.organization_id,r.id)where r.organization_id=o and r.id=(p->>'id')::uuid and r.kind='refund'and r.status in('recorded','completed'))then raise exception 'Verified canonical refund outcome required';end if;perform private.payment_ops_emit(o,(p->>'id')::uuid,'refund.completed','refund.completed:'||(p->>'id'));result:=jsonb_build_object('notice','held');
 elsif a='recover_provider'then
 perform private.giving_payload(p,array['request_key','id']);select * into op from private.payments_operations where organization_id=o and id=(p->>'id')::uuid;
 if op.id is null or op.lease_token is null or op.lease_created_at>now()-interval '5 minutes'or op.status in('completed','failed')then raise exception 'Stale provider operation required';end if;
 update private.payments_operations set status='review'where id=op.id;
 insert into private.payment_ops_jobs(organization_id,leg_id,operation_id,kind,request_key)values(o,op.leg_id,op.id,'lookup',key);result:=jsonb_build_object('id',op.id,'state','review','execution','held');
 else raise exception 'Unknown operations service action';end if;
 perform private.giving_audit_event(o,'payment_ops.service.'||a,coalesce(identifier,(result->>'id')::uuid),jsonb_build_object('execution','held'));
 insert into public.giving_requests values(o,'payment_ops.service.'||a,key,p,result,now());return result;
end$$;
create function private.payment_ops_donor(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path=''as $$declare person uuid;result jsonb;key uuid;old public.giving_requests;begin
 if not private.outreach_verified(auth.uid())then raise exception 'Verified owner required'using errcode='42501';end if;perform private.giving_lock(o);
 select person_id into person from private.giving_donor_account_links where organization_id=o and user_id=auth.uid()and active;if person is null then raise exception 'Reviewed financial ownership required'using errcode='42501';end if;
 if a='history'then perform private.giving_payload(p,array[]::text[]);return jsonb_build_object('sessions',(select coalesce(jsonb_agg(private.payment_ops_session(o,id,true)order by created_at desc),'[]')from public.giving_sessions where organization_id=o and person_id=person),'methods',private.payment_ops_methods(o,person),'execution','held');
 elsif a='session'then perform private.giving_payload(p,array['id']);if not exists(select 1 from public.giving_sessions where organization_id=o and id=(p->>'id')::uuid and person_id=person)then raise exception 'Payment unavailable'using errcode='42501';end if;return private.payment_ops_session(o,(p->>'id')::uuid,true);
 elsif a in('method_add','method_replace','method_default','method_remove')then
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Method request key required';end if;
 select * into old from public.giving_requests where organization_id=o and operation='payment_ops.donor.'||a and request_key=key;
 if found then if old.payload<>jsonb_build_object('owner',person,'content',p)then raise exception 'Method content unavailable'using errcode='42501';end if;return old.result;end if;
 result:=private.payment_ops_method_action(a,o,p,person);insert into public.giving_requests values(o,'payment_ops.donor.'||a,key,jsonb_build_object('owner',person,'content',p),result,now());return result;
 else raise exception 'Unknown donor operation';end if;end$$;
create function public.payment_operations(p_action text,p_org uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.payment_ops_workspace(p_action,p_org,p_payload)$$;
create function public.payment_operations_service(p_action text,p_org uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.payment_ops_service(p_action,p_org,p_payload)$$;
create function public.payment_operations_donor(p_action text,p_org uuid,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.payment_ops_donor(p_action,p_org,p_payload)$$;
do $$declare r record;begin for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'payment_ops_%'loop execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;end$$;
revoke all on function public.payment_operations(text,uuid,jsonb),public.payment_operations_service(text,uuid,jsonb),public.payment_operations_donor(text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.payment_operations(text,uuid,jsonb),private.payment_ops_workspace(text,uuid,jsonb),public.payment_operations_donor(text,uuid,jsonb),private.payment_ops_donor(text,uuid,jsonb)to authenticated;
grant execute on function public.payment_operations_service(text,uuid,jsonb),private.payment_ops_service(text,uuid,jsonb)to service_role;

do $$declare b text;begin b:=pg_get_functiondef('private.giving_financial_action(uuid,text,jsonb)'::regprocedure);if position($needle$and kind='refund' and status<>'failed'$needle$ in b)=0 then raise exception 'Refund reservation contract changed';end if;b:=replace(b,$needle$and kind='refund' and status<>'failed'$needle$,$replacement$and kind='refund' and status not in('failed','rejected')$replacement$);execute b;end$$;

-- Fail closed for a currently unavailable provider without changing routing or global activation.
create function private.payment_ops_checkout_incident()returns trigger language plpgsql security definer set search_path=''as $$begin if exists(select 1 from private.payment_ops_incidents where organization_id=new.organization_id and gateway_id=(new.route_snapshot->>'gateway_id')::uuid and status in('unavailable','maintenance'))then raise exception 'Payment destination temporarily unavailable; no payment was submitted';end if;return new;end$$;
revoke all on function private.payment_ops_checkout_incident()from public,anon,authenticated,service_role;
create trigger payment_ops_checkout_incident before insert on public.giving_transaction_legs for each row execute function private.payment_ops_checkout_incident();

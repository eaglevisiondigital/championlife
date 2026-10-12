-- GIV-2A management projections and atomic manual batch posting. LOCAL BUILD ONLY.
-- Accepted GIV-1 tables, money, authority, routing and immutable history remain canonical.
create view private.giving_management_ledger with(security_invoker=true) as
select g.*, f.name fund_name,f.parent_id,pf.name parent_name,
 coalesce(nullif(concat_ws(' ',person.first_name,person.last_name),''),'Anonymous') donor_name,
 h.name household_name,b.label batch_label,
 coalesce(t.status,case when g.kind='gift' then 'posted' else g.kind end) transaction_status,
 t.provider_reference,
 (select r.receipt_number from public.giving_receipts r where r.organization_id=g.organization_id and r.session_id=g.session_id order by r.version desc limit 1) receipt_number
from public.giving_ledger g
join public.giving_funds f on (f.organization_id,f.id)=(g.organization_id,g.fund_id)
left join public.giving_funds pf on (pf.organization_id,pf.id)=(f.organization_id,f.parent_id)
left join public.organization_people person on (person.organization_id,person.id)=(g.organization_id,g.person_id)
left join public.households h on (h.organization_id,h.id)=(g.organization_id,g.household_id)
left join public.giving_batches b on (b.organization_id,b.id)=(g.organization_id,g.batch_id)
left join public.giving_transaction_legs t on (t.organization_id,t.id)=(g.organization_id,g.leg_id);
revoke all on private.giving_management_ledger from public,anon,authenticated,service_role;

-- JSON money is always a decimal string, including aggregates beyond JS safe integers.
create function private.giving_management_money(j jsonb) returns jsonb language plpgsql immutable set search_path='' as $$
declare k text; v jsonb; result jsonb:='{}';begin
 if jsonb_typeof(j)='array' then return coalesce((select jsonb_agg(private.giving_management_money(x)) from jsonb_array_elements(j)x),'[]');end if;
 if jsonb_typeof(j)<>'object' then return j;end if;
 for k,v in select * from jsonb_each(j) loop result:=result||jsonb_build_object(k,case when k like '%\_minor' escape '\' and v<>'null'::jsonb then to_jsonb(v#>>'{}') else private.giving_management_money(v) end);end loop;
 return result;
end$$;
create function private.giving_management_routes(o uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select coalesce(jsonb_agg(jsonb_build_object('fund_id',f.id,'fund',f.name,'destination_id',d.id,'destination',d.merchant_label,'gateway_id',g.id,'gateway',g.label,'provider',g.provider,'processor_route_id',r.id,'route',r.label,'mid',r.mid_reference,'status',case when d.active and r.active and g.id is not null then 'Not connected' else 'Configuration incomplete' end) order by f.display_order,f.name),'[]')
 from public.giving_funds f left join public.giving_destinations d on (d.organization_id,d.id)=(f.organization_id,f.destination_id)
 left join public.giving_gateway_accounts g on(g.organization_id,g.id)=(d.organization_id,d.gateway_id)
 left join public.giving_processor_routes r on(r.organization_id,r.id)=(d.organization_id,d.processor_route_id) where f.organization_id=o
$$;
create function private.giving_management_dashboard(o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare report jsonb; bounds jsonb; starts timestamptz; ends timestamptz; cur text; metrics jsonb; funds jsonb; comparisons jsonb;begin
 perform private.giving_payload(p,array['period','starts_on','ends_on','as_of']);
 select currency into cur from public.giving_organization_config where organization_id=o;
 if p->>'period'='custom' then
  if (p->>'ends_on')::date<(p->>'starts_on')::date then raise exception 'Custom end must follow start';end if;
  p:=(p-'starts_on'-'ends_on')||jsonb_build_object('starts_at',(p->>'starts_on')::date::timestamp at time zone(select timezone from public.giving_organization_config where organization_id=o),'ends_at',((p->>'ends_on')::date+1)::timestamp at time zone(select timezone from public.giving_organization_config where organization_id=o));
 else p:=p-'starts_on'-'ends_on';end if;
 report:=private.giving_report(o,p||jsonb_build_object('period',coalesce(p->>'period','today'),'currency',cur,'dimension','fund'));
 bounds:=report->'period';starts:=(bounds->>'starts_at')::timestamptz;ends:=(bounds->>'ends_at')::timestamptz;
 select jsonb_build_object('gift_count',count(distinct coalesce(session_id,id)) filter(where kind='gift'),
 'average_minor',case when count(distinct coalesce(session_id,id))filter(where kind='gift')>0 then round(sum(amount_minor)::numeric/count(distinct coalesce(session_id,id))filter(where kind='gift'))::text else null end,
 'recurring_minor',coalesce(sum(amount_minor)filter(where recurring_id is not null or source='recurring'),0)::text,
 'manual_minor',coalesce(sum(amount_minor)filter(where source in('staff_manual','import')),0)::text,
 'online_minor',coalesce(sum(amount_minor)filter(where source not in('staff_manual','import')),0)::text) into metrics from public.giving_ledger where organization_id=o and currency=cur and gift_at>=starts and gift_at<ends;
 metrics:=metrics||jsonb_build_object('outstanding_pledges_minor',(select coalesce(sum(greatest(g.amount_minor-coalesce((select sum(amount_minor)from public.giving_pledge_allocations a where a.organization_id=o and a.pledge_id=g.id),0),0)),0)::text from public.giving_pledges g where organization_id=o and currency=cur and status in('active','paused')),
 'unreconciled_batches',(select count(*)from public.giving_batches where organization_id=o and currency=cur and status in('open','ready','attention')));
 select coalesce(jsonb_agg(jsonb_build_object('id',f.id,'name',f.name,'parent_id',f.parent_id,'status',f.status,'display_order',f.display_order,'direct_minor',coalesce((select sum(g.amount_minor)from public.giving_ledger g where g.organization_id=o and g.currency=cur and g.fund_id=f.id and g.gift_at>=starts and g.gift_at<ends),0)::text)order by f.display_order,f.name),'[]')into funds from public.giving_funds f where organization_id=o;
 comparisons:=jsonb_build_object('month',private.giving_report(o,jsonb_build_object('period','month','as_of',p->>'as_of','currency',cur)), 'sunday',private.giving_report(o,jsonb_build_object('period','sunday','as_of',p->>'as_of','currency',cur)));
 return jsonb_build_object('report',report,'metrics',metrics,'funds',funds,'comparisons',comparisons,'attention',jsonb_build_object(
 'failed_transactions',(select count(*)from public.giving_transaction_legs where organization_id=o and currency=cur and status='failed' and created_at>=starts and created_at<ends),
 'failed_recurring',(select count(*)from public.giving_recurring_instructions where organization_id=o and currency=cur and status='failed'),
 'overdue_pledges',(select count(*)from public.giving_pledges where organization_id=o and currency=cur and status='active' and ends_on<(now()at time zone(bounds->>'timezone'))::date),
 'routing_warnings',(select count(*)from jsonb_array_elements(private.giving_management_routes(o))r where r->>'status'='Configuration incomplete')));
end$$;

create function private.giving_management(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare needed text; result jsonb; cfg public.giving_organization_config; identifier uuid; record_json jsonb; existing public.giving_requests; batch public.giving_batches; pledge public.giving_pledges; row_json jsonb; total bigint:=0; key uuid; ids jsonb:='[]'; starts timestamptz; ends timestamptz; membership uuid; person uuid;begin
 if a='context'then result:=private.giving_workspace(a,o,p);return jsonb_build_object('organizations',(select coalesce(jsonb_agg(x||jsonb_build_object('timezone',(select timezone from public.giving_organization_config where organization_id=(x->>'id')::uuid))),'[]')from jsonb_array_elements(result->'organizations')x));end if;
 -- New actions only; established GIV-1 contracts are delegated without alteration.
 if a not in('dashboard','gift_list','gift_detail','donor_list','donor_detail','fund_management','pledge_list','pledge_detail','recurring_list','recurring_detail','batch_list','batch_detail','manual_options','merchant_management','rapid_post','pledge_options','recurring_options','recurring_draft','pledge_expectation','batch_state','fund_edit','fund_reorder') then return private.giving_workspace(a,o,p);end if;
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified finance identity required' using errcode='42501';end if;
 if o is null or p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>32000 then raise exception 'Invalid finance request';end if;
 needed:=case when a='dashboard' then 'finance.reports.read' when a in('gift_list','gift_detail','donor_list','donor_detail')then 'finance.gifts.read'
 when a in('manual_options','rapid_post')then 'finance.gifts.create' when a='fund_management'then 'finance.read' when a in('fund_edit','fund_reorder')then 'finance.configure'
 when a in('pledge_list','pledge_detail')then 'finance.pledges.read' when a in('pledge_expectation','pledge_options')then 'finance.pledges.manage'
 when a in('recurring_list','recurring_detail')then 'finance.recurring.read' when a in('recurring_options','recurring_draft')then 'finance.recurring.manage' when a in('batch_list','batch_detail')then 'finance.reconciliation.read'
 when a='batch_state'then 'finance.reconciliation.manage' else 'finance.merchant.configure' end;
 perform private.giving_lock(o);
 if not private.giving_authorized(o,needed)then raise exception 'Finance access denied' using errcode='42501';end if;
 select * into cfg from public.giving_organization_config where organization_id=o;
 if not found then raise exception 'Giving configuration unavailable';end if;
 identifier:=(p->>'id')::uuid;
 if a in('fund_edit','fund_reorder')then
 if a='fund_edit'then result:=private.giving_configure(o,'fund_update',p);update public.giving_funds set code=coalesce(p->>'code',code)where organization_id=o and id=identifier;return result||jsonb_build_object('code',(select code from public.giving_funds where organization_id=o and id=identifier));end if;
 perform private.giving_payload(p,array['id','revision','other_id','other_revision']);
 if identifier=(p->>'other_id')::uuid then raise exception 'Two sibling funds required';end if;
 if not exists(select 1 from public.giving_funds f join public.giving_funds other on other.organization_id=f.organization_id and other.parent_id is not distinct from f.parent_id where f.organization_id=o and f.id=identifier and other.id=(p->>'other_id')::uuid and f.revision=(p->>'revision')::int and other.revision=(p->>'other_revision')::int)then raise exception 'Sibling funds changed or unavailable'using errcode='40001';end if;
 -- Normalize sibling positions before swapping, including ties in old display order.
 with ordered as(select id,row_number()over(order by display_order,name,id)::int pos from public.giving_funds where organization_id=o and parent_id is not distinct from(select parent_id from public.giving_funds where organization_id=o and id=identifier)),positions as(select *from ordered)
 update public.giving_funds f set display_order=case when f.id=identifier then(select pos from positions where id=(p->>'other_id')::uuid)when f.id=(p->>'other_id')::uuid then(select pos from positions where id=identifier)else positions.pos end,revision=f.revision+1,updated_at=clock_timestamp()from positions where f.organization_id=o and f.id=positions.id;
 perform private.giving_audit_event(o,'fund.reorder',identifier,jsonb_build_object('other_id',p->>'other_id'));return jsonb_build_object('id',identifier);
 elsif a='dashboard' then return private.giving_management_dashboard(o,p);
 elsif a='gift_list' then
 perform private.giving_payload(p,array['from','to','search','donor_search','person_id','fund_id','parent_id','source','payment_method','recurring','destination_id','gateway_id','processor_route_id','campaign','event','min_minor','max_minor','status','offset']);
 if p->>'person_id' is not null then perform private.giving_identity(o,(p->>'person_id')::uuid,null);end if;
 if coalesce((p->>'offset')::int,0)<0 then raise exception 'Invalid page';end if;
 starts:=(p->>'from')::date::timestamp at time zone cfg.timezone;ends:=((p->>'to')::date+1)::timestamp at time zone cfg.timezone;
 if starts is not null and ends is not null and starts>=ends then raise exception 'Invalid gift date range';end if;
 if p->>'min_minor' is not null and p->>'max_minor' is not null and (p->>'min_minor')::bigint>(p->>'max_minor')::bigint then raise exception 'Invalid gift amount range';end if;
 with filtered as(select g.* from private.giving_management_ledger g where g.organization_id=o and g.currency=cfg.currency
 and(starts is null or g.gift_at>=starts)and(ends is null or g.gift_at<ends)
 and(p->>'search' is null or concat_ws(' ',g.donor_name,g.household_name,g.fund_name,g.external_reference) ilike '%'||(p->>'search')||'%')
 and(p->>'donor_search' is null or g.donor_name ilike '%'||(p->>'donor_search')||'%')
 and(p->>'person_id' is null or g.person_id=(p->>'person_id')::uuid)
 and(p->>'fund_id' is null or g.fund_id=(p->>'fund_id')::uuid)
 and(p->>'parent_id' is null or coalesce(g.parent_id,g.fund_id)=(p->>'parent_id')::uuid)
 and(p->>'source' is null or g.source=p->>'source')and(p->>'payment_method' is null or g.payment_method=p->>'payment_method')
 and(p->>'recurring' is null or (g.recurring_id is not null or g.source='recurring')=(p->>'recurring')::boolean)
 and(p->>'destination_id' is null or g.route_snapshot->>'destination_id'=p->>'destination_id')
 and(p->>'gateway_id' is null or g.route_snapshot->>'gateway_id'=p->>'gateway_id')
 and(p->>'processor_route_id' is null or g.route_snapshot->>'processor_route_id'=p->>'processor_route_id')
 and(p->>'campaign' is null or g.campaign_reference=p->>'campaign')and(p->>'event' is null or g.event_reference=p->>'event')
 and(p->>'min_minor' is null or g.amount_minor>=(p->>'min_minor')::bigint)and(p->>'max_minor' is null or g.amount_minor<=(p->>'max_minor')::bigint)
 and(p->>'status' is null or g.transaction_status=p->>'status')),paged as(select *from filtered order by gift_at desc,id limit 100 offset coalesce((p->>'offset')::int,0))
 select jsonb_build_object('gifts',coalesce((select jsonb_agg(private.giving_management_money(to_jsonb(x))order by x.gift_at desc,x.id)from paged x),'[]'),'count',(select count(*)from filtered),'currency',cfg.currency,'timezone',cfg.timezone,'minor_unit_scale',cfg.minor_unit_scale,
 'funds',(select jsonb_agg(jsonb_build_object('id',id,'name',name,'parent_id',parent_id))from public.giving_funds where organization_id=o),
 'routes',private.giving_management_routes(o)) into result;return result;
 elsif a='gift_detail' then
 select private.giving_management_money(to_jsonb(g))into result from private.giving_management_ledger g where organization_id=o and id=identifier;
 if result is null then raise exception 'Gift unavailable' using errcode='42501';end if;
 return result||jsonb_build_object('adjustments',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g))),'[]')from private.giving_management_ledger g where organization_id=o and original_id=identifier),
 'receipts',(select coalesce(jsonb_agg(jsonb_build_object('receipt_number',receipt_number,'delivery_status',delivery_status,'generated_at',generated_at)),'[]')from public.giving_receipts where organization_id=o and session_id=(result->>'session_id')::uuid),
 'refunds',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(r))),'[]')from public.giving_refunds r where organization_id=o and leg_id=(result->>'leg_id')::uuid),
 'reconciliations',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(r))),'[]')from public.giving_reconciliations r where organization_id=o and batch_id=coalesce((result->>'batch_id')::uuid,(select batch_id from public.giving_batch_entries where organization_id=o and ledger_id=identifier))),
 'audit',(select coalesce(jsonb_agg(to_jsonb(x)order by x.created_at),'[]')from public.giving_audit x where organization_id=o and subject_id in(identifier,(result->>'session_id')::uuid,(result->>'leg_id')::uuid)));
 elsif a='recurring_draft'then
 perform private.giving_payload(p,array['request_key','person_id','household_id','currency','frequency','starts_on','ends_on','next_local','lines']);
 return private.giving_workspace('recurring_create',o,(p-'next_local')||jsonb_build_object('next_run_at',(p->>'next_local')::timestamp at time zone cfg.timezone));
 elsif a in('manual_options','pledge_options','recurring_options','fund_management','merchant_management')then
 if a in('manual_options','pledge_options','recurring_options')then perform private.giving_payload(p,array['search']);return jsonb_build_object('config',jsonb_build_object('currency',cfg.currency,'timezone',cfg.timezone,'minor_unit_scale',cfg.minor_unit_scale),
 'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'status',status)order by display_order,name),'[]')from public.giving_funds where organization_id=o and status='active'),
 'batches',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',label,'currency',currency,'status',status)),'[]')from public.giving_batches where organization_id=o and status='open'and currency=cfg.currency),
 'donors',(select coalesce(jsonb_agg(to_jsonb(x)),'[]')from(select id,first_name,last_name from public.organization_people where organization_id=o and concat_ws(' ',first_name,last_name)ilike '%'||coalesce(p->>'search','')||'%' order by last_name,first_name limit 100)x),
 'households',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name)),'[]')from public.households where organization_id=o),
 'members',(select coalesce(jsonb_agg(jsonb_build_object('person_id',person_id,'household_id',household_id)),'[]')from public.household_members where organization_id=o and active));end if;
 result:=private.giving_workspace(case when a='fund_management'then 'funds'else 'merchants'end,o,'{}');
 if a='merchant_management'then result:=result||jsonb_build_object('funds',(select coalesce(jsonb_agg(to_jsonb(f)),'[]')from public.giving_funds f where organization_id=o));end if;
 return result||jsonb_build_object('routing',private.giving_management_routes(o));
 elsif a='donor_list'then
 perform private.giving_payload(p,array['search','offset']);
 with people as(select person.id,person.first_name,person.last_name,person.email,person.phone,
 (select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name)),'[]')from public.household_members m join public.households h on(h.organization_id,h.id)=(m.organization_id,m.household_id)where m.organization_id=o and m.person_id=person.id and m.active) households,
 (select coalesce(sum(g.amount_minor),0)::text from public.giving_ledger g where g.organization_id=o and g.person_id=person.id and g.currency=cfg.currency and g.gift_at>=(date_trunc('year',now()at time zone cfg.timezone)at time zone cfg.timezone)and g.gift_at<=now())ytd_minor,
 (select max(gift_at)from public.giving_ledger where organization_id=o and person_id=person.id and currency=cfg.currency and kind='gift')last_gift,
 exists(select 1 from public.giving_recurring_instructions where organization_id=o and person_id=person.id and status in('active','draft','paused')) recurring,
 exists(select 1 from public.giving_pledges where organization_id=o and person_id=person.id and status in('active','paused'))pledged
 from public.organization_people person where organization_id=o and concat_ws(' ',first_name,last_name,email,phone)ilike '%'||coalesce(p->>'search','')||'%')
 select jsonb_build_object('donors',coalesce((select jsonb_agg(to_jsonb(x))from(select *from people order by last_name,first_name,id limit 100 offset greatest(coalesce((p->>'offset')::int,0),0))x),'[]'),'count',(select count(*)from people),'currency',cfg.currency)into result;return result;
 elsif a='donor_detail'then
 perform private.giving_payload(p,array['person_id','household_id']);person:=(p->>'person_id')::uuid;membership:=(p->>'household_id')::uuid;
 if person is null then raise exception 'Donor required';end if;
 perform private.giving_identity(o,person,membership);
 result:=private.giving_workspace('donor',o,jsonb_build_object('person_id',person));
 -- Household totals use recorded contribution attribution, not contact-name inference.
 if membership is not null then result:=result||jsonb_build_object('gifts',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g))order by gift_at desc),'[]')from private.giving_management_ledger g where organization_id=o and household_id=membership),
 'pledges',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g))),'[]')from public.giving_pledges g where organization_id=o and household_id=membership),
 'recurring',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g)-'payment_profile_id'-'provider_schedule_reference')),'[]')from public.giving_recurring_instructions g where organization_id=o and household_id=membership),
 'receipts',(select coalesce(jsonb_agg(jsonb_build_object('receipt_number',r.receipt_number,'delivery_status',r.delivery_status,'generated_at',r.generated_at)),'[]')from public.giving_receipts r join public.giving_sessions s on(s.organization_id,s.id)=(r.organization_id,r.session_id)where r.organization_id=o and s.household_id=membership),
 'statements',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'version',version,'starts_at',starts_at,'ends_at',ends_at,'generated_at',generated_at)),'[]')from public.giving_statements where organization_id=o and household_id=membership));
 else result:=result||jsonb_build_object('gifts',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g))order by gift_at desc),'[]')from private.giving_management_ledger g where organization_id=o and person_id=person));end if;
 return private.giving_management_money(result)||jsonb_build_object('currency',cfg.currency,'ytd_start',date_trunc('year',now()at time zone cfg.timezone)at time zone cfg.timezone,'as_of',now(),
 'households',(select coalesce(jsonb_agg(jsonb_build_object('id',h.id,'name',h.name)),'[]')from public.household_members m join public.households h on(h.organization_id,h.id)=(m.organization_id,m.household_id)where m.organization_id=o and m.person_id=person and m.active),
 'allocations',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(x))),'[]')from public.giving_pledge_allocations x join public.giving_pledges g on(g.organization_id,g.id)=(x.organization_id,x.pledge_id)where g.organization_id=o and ((membership is null and g.person_id=person)or(membership is not null and g.household_id=membership))),
 'recurring_lines',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(x))),'[]')from public.giving_recurring_lines x join public.giving_recurring_instructions g on(g.organization_id,g.id)=(x.organization_id,x.instruction_id)where g.organization_id=o and ((membership is null and g.person_id=person)or(membership is not null and g.household_id=membership))));
 elsif a in('pledge_list','pledge_detail')then
 perform private.giving_payload(p,array['id']);
 if a='pledge_detail'and not exists(select 1 from public.giving_pledges where organization_id=o and id=identifier)then raise exception 'Pledge unavailable'using errcode='42501';end if;
 select jsonb_build_object('pledges',coalesce(jsonb_agg(private.giving_management_money(to_jsonb(x))),'[]'),'currency',cfg.currency)into result from(
 select g.*,person.first_name||' '||person.last_name donor_name,f.name fund_name,
 coalesce((select sum(amount_minor)from public.giving_pledge_allocations where organization_id=o and pledge_id=g.id),0)received_minor,
 (select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(s))order by due_on),'[]')from public.giving_pledge_schedule s where organization_id=o and pledge_id=g.id)schedule,
 (select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(s))),'[]')from public.giving_pledge_allocations s where organization_id=o and pledge_id=g.id)allocations,
 (select coalesce(jsonb_agg(to_jsonb(s)order by created_at),'[]')from public.giving_audit s where organization_id=o and subject_id=g.id)history
 from public.giving_pledges g join public.giving_funds f on(f.organization_id,f.id)=(g.organization_id,g.fund_id)left join public.organization_people person on(person.organization_id,person.id)=(g.organization_id,g.person_id)where g.organization_id=o and(identifier is null or g.id=identifier))x;
 return result;
 elsif a in('recurring_list','recurring_detail')then
 perform private.giving_payload(p,array['id']);
 if a='recurring_detail'and not exists(select 1 from public.giving_recurring_instructions where organization_id=o and id=identifier)then raise exception 'Recurring instruction unavailable'using errcode='42501';end if;
 select jsonb_build_object('instructions',coalesce(jsonb_agg(private.giving_management_money(to_jsonb(x)-'payment_profile_id'-'provider_schedule_reference')),'[]'),'execution','DISABLED','currency',cfg.currency)into result from(
 select g.*,person.first_name||' '||person.last_name donor_name,profile.descriptor payment_descriptor,
 (select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(l)||jsonb_build_object('fund_name',f.name))),'[]')from public.giving_recurring_lines l join public.giving_funds f on(f.organization_id,f.id)=(l.organization_id,l.fund_id)where l.organization_id=o and l.instruction_id=g.id)lines,
 (select coalesce(jsonb_agg(to_jsonb(r)order by created_at),'[]')from public.giving_recurring_runs r where organization_id=o and instruction_id=g.id)runs,
 (select coalesce(jsonb_agg(to_jsonb(r)order by created_at),'[]')from public.giving_audit r where organization_id=o and subject_id=g.id)history
 from public.giving_recurring_instructions g join public.organization_people person on(person.organization_id,person.id)=(g.organization_id,g.person_id)left join private.giving_payment_profiles profile on(profile.organization_id,profile.id)=(g.organization_id,g.payment_profile_id)where g.organization_id=o and(identifier is null or g.id=identifier))x;return result;
 elsif a in('batch_list','batch_detail')then
 perform private.giving_payload(p,array['id']);
 if a='batch_detail'and not exists(select 1 from public.giving_batches where organization_id=o and id=identifier)then raise exception 'Batch unavailable'using errcode='42501';end if;
 select jsonb_build_object('batches',coalesce(jsonb_agg(private.giving_management_money(to_jsonb(x))order by batch_date desc),'[]'))into result from(
 select b.*,r.settlement_minor,r.deposit_minor,r.difference_minor,r.notes reconciliation_notes,d.display_name reviewer,
 (select coalesce(sum(amount_minor),0)from public.giving_ledger where organization_id=o and currency=b.currency and(batch_id=b.id or id in(select ledger_id from public.giving_batch_entries where organization_id=o and batch_id=b.id)))ledger_minor,
 (select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(g))order by gift_at desc),'[]')from private.giving_management_ledger g where organization_id=o and currency=b.currency and(batch_id=b.id or id in(select ledger_id from public.giving_batch_entries where organization_id=o and batch_id=b.id)))gifts,
 (select coalesce(jsonb_agg(to_jsonb(x)order by created_at),'[]')from public.giving_audit x where organization_id=o and subject_id=b.id)history
 from public.giving_batches b left join public.giving_reconciliations r on(r.organization_id,r.batch_id)=(b.organization_id,b.id)left join public.organization_staff_directory d on(d.organization_id,d.user_id)=(b.organization_id,r.reconciled_by)where b.organization_id=o and(identifier is null or b.id=identifier))x;return result;
 elsif a in('rapid_post','pledge_expectation','batch_state')then
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Financial request key required';end if;
 select *into existing from public.giving_requests where organization_id=o and operation=a and request_key=key;
 if found then if existing.payload<>p then raise exception 'Idempotency key reused with changed content';end if;return existing.result;end if;
 if a='rapid_post'then
 perform private.giving_payload(p,array['request_key','batch_id','gift_local','currency','expected_minor','event_reference','rows']);
 if jsonb_typeof(p->'rows')<>'array' or jsonb_array_length(p->'rows')not between 1 and 100 then raise exception 'One to 100 rows required';end if;
 select *into batch from public.giving_batches where organization_id=o and id=(p->>'batch_id')::uuid and status='open'and currency=p->>'currency';if not found then raise exception 'Open same-currency batch required';end if;
 if (select count(distinct value->>'request_key')from jsonb_array_elements(p->'rows'))<>jsonb_array_length(p->'rows')then raise exception 'Distinct stable row keys required';end if;
 for row_json in select value from jsonb_array_elements(p->'rows')loop
 perform private.giving_payload(row_json,array['request_key','person_id','household_id','fund_id','amount_minor','payment_method','external_reference','notes']);
 if row_json->>'request_key'is null then raise exception 'Stable row key required';end if;
 total:=total+(row_json->>'amount_minor')::bigint;
 record_json:=private.giving_manual(o,row_json||jsonb_build_object('batch_id',batch.id,'gift_local',p->>'gift_local','currency',p->>'currency','event_reference',p->>'event_reference'));ids:=ids||jsonb_build_array(record_json->>'id');
 end loop;
 if total is distinct from(p->>'expected_minor')::bigint then raise exception 'Rows do not equal the reviewed batch balance';end if;
 result:=jsonb_build_object('id',batch.id,'gift_ids',ids,'total_minor',total::text,'rows',jsonb_array_length(ids));
 elsif a='pledge_expectation'then
 perform private.giving_payload(p,array['request_key','id','revision','frequency','ends_on','notes','schedule']);
 select *into pledge from public.giving_pledges where organization_id=o and id=identifier and revision=(p->>'revision')::int;if not found then raise exception 'Pledge changed or unavailable'using errcode='40001';end if;
 perform private.giving_audit_event(o,'pledge.expectation.before',identifier,jsonb_build_object('revision',pledge.revision,'frequency',pledge.frequency,'ends_on',pledge.ends_on,'schedule',(select coalesce(jsonb_agg(private.giving_management_money(to_jsonb(s))),'[]')from public.giving_pledge_schedule s where organization_id=o and pledge_id=identifier)));
 if p?'schedule'then
 if jsonb_typeof(p->'schedule')<>'array'or jsonb_array_length(p->'schedule')>100 then raise exception 'Bounded future schedule required';end if;
 for row_json in select value from jsonb_array_elements(p->'schedule')loop
 perform private.giving_payload(row_json,array['due_on','expected_minor']);
 if(row_json->>'due_on')::date<=(now()at time zone cfg.timezone)::date then raise exception 'Only future expectations may be changed';end if;
 insert into public.giving_pledge_schedule(organization_id,pledge_id,due_on,expected_minor)values(o,identifier,(row_json->>'due_on')::date,(row_json->>'expected_minor')::bigint)on conflict(pledge_id,due_on)do update set expected_minor=excluded.expected_minor;
 end loop;end if;
 update public.giving_pledges set frequency=coalesce(p->>'frequency',frequency),ends_on=case when p?'ends_on'then(p->>'ends_on')::date else ends_on end,notes=coalesce(p->>'notes',notes),revision=revision+1 where organization_id=o and id=identifier returning private.giving_management_money(to_jsonb(giving_pledges.*))into result;
 else
 perform private.giving_payload(p,array['request_key','id','status']);select *into batch from public.giving_batches where organization_id=o and id=identifier;
 if not found or not((batch.status='open'and p->>'status'='ready')or(batch.status='ready'and p->>'status'='open')or(batch.status='reconciled'and p->>'status'='closed'))then raise exception 'Invalid batch transition';end if;
 update public.giving_batches set status=p->>'status'where organization_id=o and id=identifier;result:=jsonb_build_object('id',identifier,'status',p->>'status');end if;
 insert into public.giving_requests values(o,a,key,p,result,now());perform private.giving_audit_event(o,a,coalesce((result->>'id')::uuid,identifier));return result;
 end if;
 raise exception 'Unknown finance management action';
end$$;
-- Open/Ready stop further posting; reconciled may be explicitly closed, retaining evidence.
alter table public.giving_batches drop constraint giving_batches_status_check;
alter table public.giving_batches add constraint giving_batches_status_check check(status in('open','ready','reconciled','attention','closed'));
create or replace function public.giving_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path=''as $$select private.giving_management(p_action,p_org,p_payload)$$;
revoke all on function private.giving_management(text,uuid,jsonb),private.giving_management_dashboard(uuid,jsonb),private.giving_management_routes(uuid),private.giving_management_money(jsonb)from public,anon,authenticated,service_role;
grant execute on function private.giving_management(text,uuid,jsonb)to authenticated;

-- Only isolated acceptance / local synthetic replay. All fixtures roll back.
begin;
create temp table outreach_test_state as select gen_random_uuid() actor,gen_random_uuid() request_key,(select id from public.organizations where slug='sowgo') org,(select id from public.organizations where slug='champion-life') other;
insert into auth.users(id,email,email_confirmed_at) select actor,'outreach-rollback-only@example.test',now() from outreach_test_state;
insert into public.organization_staff_directory(organization_id,user_id,display_name) select org,actor,'Synthetic rollback outreach reviewer' from outreach_test_state;
insert into public.organization_staff_permissions(organization_id,user_id,permission) select org,actor,k from outreach_test_state cross join unnest(array['outreach.view','outreach.manage','people.read','people.create','people.update','followup.read','followup.manage']) k;
grant select on outreach_test_state to anon,authenticated;
set local role anon;
do $$declare p jsonb; n int;begin
 select jsonb_build_object('brand','sowgo','source_path','/outreach-partner.html','request_key',request_key,'fields',jsonb_build_object('first-name','Rollback','last-name','OutreachSynthetic','email','outreach-rollback-only@example.test','phone','+15555550199','address-line-1','1 Synthetic Lane','address-line-2','','city','Test','state-province','FL','postal-code','32548','commitment-amount','12.34','commitment-frequency','Bi-weekly')) into p from outreach_test_state;
 if public.outreach_partner_submit(p)<>jsonb_build_object('accepted',true) then raise exception 'Guest submit failed';end if;
 perform public.outreach_partner_submit(p);
 begin perform public.outreach_partner_submit(p||jsonb_build_object('organization_id',(select other from outreach_test_state)));raise exception 'Owner forgery accepted';exception when sqlstate '22023' then null;end;
 begin perform id from public.outreach_partner_intakes;raise exception 'Guest read accepted';exception when insufficient_privilege then null;end;
 begin perform public.outreach_partner_workspace((select org from outreach_test_state),'list','{}');raise exception 'Guest workspace accepted';exception when insufficient_privilege then null;end;
end $$;
reset role;
select set_config('request.jwt.claim.sub',actor::text,true) from outreach_test_state;
set local role authenticated;
do $$declare o uuid; r jsonb; id uuid;begin
 select org into o from outreach_test_state;
 select value->>'id' into id from jsonb_array_elements(public.outreach_partner_workspace(o,'list','{}')) where value->>'email'='outreach-rollback-only@example.test';
 r:=public.outreach_partner_workspace(o,'detail',jsonb_build_object('id',id));
 if r->>'source_site'<>'sowgo' or (r->>'organization_id')::uuid<>o or (r->>'commitment_amount')::numeric<>12.34 then raise exception 'Attribution/commitment mismatch';end if;
 begin perform public.outreach_partner_workspace((select other from outreach_test_state),'detail',jsonb_build_object('id',id));raise exception 'Cross org accepted';exception when insufficient_privilege then null;end;
 perform public.outreach_partner_workspace(o,'create_contact',jsonb_build_object('id',id,'revision',1));
 r:=public.outreach_partner_workspace(o,'detail',jsonb_build_object('id',id));
 if r->>'status'<>'linked' or r->>'person_id' is null then raise exception 'Reviewed link failed';end if;
 perform public.outreach_partner_workspace(o,'followup',jsonb_build_object('id',id,'revision',2));
 perform public.outreach_partner_workspace(o,'followup',jsonb_build_object('id',id,'revision',3));
end $$;
reset role;
do $$declare a uuid;o uuid;begin
 select actor,org into a,o from outreach_test_state;
 if (select count(*) from public.outreach_partner_intakes where request_key=(select request_key from outreach_test_state))<>1 then raise exception 'Duplicate replay';end if;
 if (select count(*) from public.person_organization_relationships r join public.outreach_partner_intakes i on i.person_id=r.person_id where i.request_key=(select request_key from outreach_test_state) and r.relationship='partner')<>1 then raise exception 'Partner relationship missing';end if;
 if (select count(*) from public.followup_tasks where created_by=a)<>1 then raise exception 'Task duplicated';end if;
 if (select count(*) from public.organization_staff_permissions where user_id=a)<>7 then raise exception 'Unexpected authority';end if;
 if exists(select 1 from public.portal_account_links where user_id=a) or exists(select 1 from public.organization_affiliations where user_id=a) then raise exception 'Unexpected identity link';end if;
end $$;
rollback;
select 'PASS: hosted guest/replay/ownership/privacy/review/partner/follow-up/no-grant assertions; synthetic fixtures rolled back' result;

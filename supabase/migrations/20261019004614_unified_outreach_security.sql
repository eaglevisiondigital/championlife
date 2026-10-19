-- Integration boundary corrections. No identities, grants, sends or activation.
-- Preserve every production registration function and the original source rows.
alter table public.outreach_partner_assignments add constraint outreach_partner_assignment_scope_unique unique(campaign_id,partner_church_id,id);
alter table public.outreach_partner_followup add constraint outreach_partner_followup_scope_fk foreign key(campaign_id,partner_church_id,assignment_id) references public.outreach_partner_assignments(campaign_id,partner_church_id,id);
alter table public.outreach_partner_pastoral_notes add constraint outreach_partner_notes_scope_fk foreign key(campaign_id,partner_church_id,assignment_id) references public.outreach_partner_assignments(campaign_id,partner_church_id,id);
create trigger outreach_partner_followup_immutable before update or delete on public.outreach_partner_followup for each row execute function private.outreach_immutable();
create trigger outreach_partner_notes_immutable before update or delete on public.outreach_partner_pastoral_notes for each row execute function private.outreach_immutable();

alter function private.outreach_partner_workspace(text,uuid,jsonb) rename to unified_partner_workspace_source;
revoke all on function private.unified_partner_workspace_source(text,uuid,jsonb) from public,anon,authenticated;
create function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb; row jsonb; csv text;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>25000 then raise exception 'Invalid request'; end if;
 result:=private.unified_partner_workspace_source(p_action,p_partner,p_payload);
 if p_action='export' then
  perform private.outreach_audit((select campaign_id from public.outreach_partner_churches where id=p_partner),(select c.organization_id from public.outreach_partner_churches p join public.outreach_campaigns c on c.id=p.campaign_id where p.id=p_partner),'partner.assigned_exported',p_partner,jsonb_build_object('rows',jsonb_array_length(result->'rows')));
  csv:='Name,Email,Phone,Decision,Status,Next contact'||E'\r\n';
  for row in select value from jsonb_array_elements(result->'rows') loop
   csv:=csv||private.outreach_csv_cell(row->>'name')||','||private.outreach_csv_cell(row->>'email')||','||private.outreach_csv_cell(row->>'phone')||','||private.outreach_csv_cell(row->>'decision')||','||private.outreach_csv_cell(row->>'status')||','||private.outreach_csv_cell(row->>'next_contact_at')||E'\r\n';
  end loop;
  result:=result||jsonb_build_object('csv',csv);
 end if;
 return result;
end $$;
grant execute on function private.outreach_partner_workspace(text,uuid,jsonb) to authenticated;

alter function private.outreach_partner_admin_workspace(text,uuid,jsonb) rename to unified_partner_admin_source;
revoke all on function private.unified_partner_admin_source(text,uuid,jsonb) from public,anon,authenticated;
create function private.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare uid uuid;
begin
 if not private.outreach_partner_central_manage(p_campaign) then raise exception 'Partner administration denied' using errcode='42501';end if;
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>25000 then raise exception 'Invalid request';end if;
 if p_action='user_grant' then
  uid:=nullif(p_payload->>'user_id','')::uuid;
  if uid is null then select id into uid from auth.users where lower(email)=lower(btrim(p_payload->>'email'));end if;
  if uid is null or not private.outreach_verified(uid) then raise exception 'Existing verified account required' using errcode='42501';end if;
 end if;
 return private.unified_partner_admin_source(p_action,p_campaign,p_payload);
end $$;
grant execute on function private.outreach_partner_admin_workspace(text,uuid,jsonb) to authenticated;

alter function private.outreach_decision_workspace(text,uuid,jsonb) rename to unified_decision_source;
revoke all on function private.unified_decision_source(text,uuid,jsonb) from public,anon,authenticated;
create function private.outreach_decision_workspace(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare worker uuid; result jsonb;
begin
 if jsonb_typeof(p_payload) is distinct from 'object' or octet_length(p_payload::text)>25000 then raise exception 'Invalid request';end if;
 if p_action='save' then
  if p_payload ?| array['decision','prayer_request','first_name','last_name','email','phone','created_at','source','consent'] then raise exception 'Original source fields are immutable' using errcode='42501';end if;
  worker:=nullif(p_payload->>'assigned_user_id','')::uuid;
  if worker is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=p_campaign and a.user_id=worker and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'decision.manage'=any(a.capabilities) and private.outreach_verified(a.user_id)) and not exists(select 1 from public.outreach_campaigns c join public.outreach_campaign_admins a on a.organization_id=c.organization_id where c.id=p_campaign and a.user_id=worker and a.active and a.capability='manage' and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.staff_assignment_active(a.organization_id,worker) and private.outreach_verified(worker)) then raise exception 'Worker outside campaign' using errcode='42501';end if;
 end if;
 result:=private.unified_decision_source(p_action,p_campaign,p_payload);
 if p_action='context' and private.outreach_decision_can(p_campaign,'decision.manage') then
  result:=result||jsonb_build_object('workers',coalesce((select jsonb_agg(jsonb_build_object('id',u.id,'label',u.email) order by lower(u.email)) from auth.users u where private.outreach_verified(u.id) and (exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=p_campaign and a.user_id=u.id and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and 'decision.manage'=any(a.capabilities)) or exists(select 1 from public.outreach_campaigns c join public.outreach_campaign_admins a on a.organization_id=c.organization_id where c.id=p_campaign and a.user_id=u.id and a.active and a.capability='manage' and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.staff_assignment_active(a.organization_id,u.id)))),'[]'));
 end if;
 return result;
end $$;
grant execute on function private.outreach_decision_workspace(text,uuid,jsonb) to authenticated;

-- This assignment models leadership; real onboarding stays behind the release gate.
-- Removing browser execution of the source provisioner also prevents indirect use.
alter function private.outreach_access_workspace(text,jsonb) rename to unified_access_source;
revoke all on function private.unified_access_source(text,jsonb) from public,anon,authenticated;
create function private.outreach_access_workspace(p_action text,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
begin
 if not private.outreach_access_admin() then raise exception 'Staff administration denied' using errcode='42501';end if;
 if p_action<>'list' then raise exception 'Staff onboarding requires a separately approved release' using errcode='42501';end if;
 return jsonb_build_object(
 'users',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.id,'email',u.email,'confirmed',u.email_confirmed_at is not null,
 'organizations',coalesce((select jsonb_agg(jsonb_build_object('slug',o.slug,'active',d.active)) from public.organization_staff_directory d join public.organizations o on o.id=d.organization_id where d.user_id=u.id and o.slug in ('champion-life','sowgo') and private.has_staff_permission(o.id,'staff.manage')),'[]'),
 'campaigns',coalesce((select jsonb_agg(jsonb_build_object('campaign_id',c.id,'name',c.name,'capabilities',a.capabilities,'active',a.active)) from public.outreach_campaign_assignments a join public.outreach_campaigns c on c.id=a.campaign_id join public.organizations o on o.id=c.organization_id where a.user_id=u.id and o.slug in ('champion-life','sowgo') and private.has_staff_permission(o.id,'staff.manage')),'[]')) order by lower(u.email)) from auth.users u where exists(select 1 from public.organization_staff_directory d join public.organizations o on o.id=d.organization_id where d.user_id=u.id and o.slug in ('champion-life','sowgo') and private.has_staff_permission(o.id,'staff.manage')) or exists(select 1 from public.outreach_campaign_assignments a join public.outreach_campaigns c on c.id=a.campaign_id join public.organizations o on o.id=c.organization_id where a.user_id=u.id and o.slug in ('champion-life','sowgo') and private.has_staff_permission(o.id,'staff.manage'))),'[]'),
 'campaigns',coalesce((select jsonb_agg(jsonb_build_object('id',c.id,'name',c.name,'code',c.code,'status',c.status)) from public.outreach_campaigns c join public.organizations o on o.id=c.organization_id where o.slug in ('champion-life','sowgo') and private.has_staff_permission(o.id,'staff.manage')),'[]'));

end $$;
grant execute on function private.outreach_access_workspace(text,jsonb) to authenticated;

create function private.unified_outreach_context() returns jsonb language plpgsql stable security definer set search_path='' as $$
declare staff jsonb; campaigns jsonb; version text; champion boolean; outreach boolean;
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501';end if;
 staff:=private.staff_workspace_context();
 select coalesce(jsonb_agg(jsonb_build_object('id',c.id,'name',case c.code when 'bessemer_al_2026' then 'Bessemer 2026' when 'huntsville_al_2026' then 'Huntsville / City Hangout 2026' else c.name end,'code',c.code,'city',c.city,'state_province',c.state_province,'country',c.country,'status',c.status,'public_page',c.public_page,
 'modules',to_jsonb(array_remove(array[
 case when private.outreach_can(c.id) then 'campaigns' end,
 case when private.outreach_decision_can(c.id,'decision.view') then 'decisions' end,
 case when private.outreach_registration_can(c.id,'registration.view') and exists(select 1 from public.outreach_registration_settings s where s.campaign_id=c.id) then 'registration' end,
 case when private.outreach_team_can(c.id,'team.view') or private.outreach_team_can(c.id,'travel.view') then 'team' end,
 case when private.outreach_partner_central_manage(c.id) then 'partneradmin' end,
 case when exists(select 1 from public.outreach_partner_churches p where p.campaign_id=c.id and private.outreach_partner_cap(p.id,'partner.view')) then 'partner' end,
 case when private.outreach_ops_can(c.id,'ops.view') then 'eventday' end,
 case when private.outreach_prize_can(c.id,'prize.view') then 'prizes' end,
 case when private.phasef_can(c.id,'preevent.view') then 'preevent' end,
 case when private.comm_can(c.organization_id,c.id,'communications.view') then 'communications' end
 ],null))) order by c.name),'[]') into campaigns
 from public.outreach_campaigns c
 where private.outreach_can(c.id) or private.outreach_decision_can(c.id,'decision.view') or private.outreach_registration_can(c.id,'registration.view') or exists(select 1 from public.outreach_partner_churches p where p.campaign_id=c.id and private.outreach_partner_cap(p.id,'partner.view'));
 select exists(select 1 from public.organizations o where o.slug='champion-life' and private.staff_assignment_active(o.id,auth.uid()) and exists(select 1 from jsonb_array_elements(staff->'grants') g where g->>'organization_id'=o.id::text)) into champion;
 outreach:=jsonb_array_length(campaigns)>0 or exists(select 1 from public.organizations o where o.slug='sowgo' and private.staff_assignment_active(o.id,auth.uid()));
 select md5(jsonb_build_array(staff,
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.campaign_id),'[]') from public.outreach_campaign_assignments a where a.user_id=auth.uid()),
 (select coalesce(jsonb_agg(to_jsonb(a) order by a.organization_id),'[]') from public.outreach_campaign_admins a where a.user_id=auth.uid()),
 (select coalesce(jsonb_agg(to_jsonb(u) order by u.partner_church_id),'[]') from public.outreach_partner_users u where u.user_id=auth.uid()),
 (select coalesce(jsonb_agg(jsonb_build_array(a.id,a.status,a.revision,p.active) order by a.id),'[]') from public.outreach_partner_assignments a join public.outreach_partner_churches p on p.id=a.partner_church_id where private.outreach_partner_cap(p.id,'partner.view')),
 campaigns)::text) into version;
 return jsonb_build_object('staff',staff,'campaigns',campaigns,'contexts',to_jsonb(array_remove(array[case when champion then 'champion' end,case when outreach then 'outreach' end],null)),'access_version',version,'role_label',case when champion and outreach then 'Champion Life + Outreach' when outreach then 'Outreach access' when champion then 'Champion Life staff' else 'No staff access assigned' end);
end $$;
create function public.unified_outreach_context() returns jsonb language sql stable security invoker set search_path='' as $$select private.unified_outreach_context()$$;
revoke all on function private.unified_outreach_context(),public.unified_outreach_context() from public,anon,authenticated;
grant execute on function private.unified_outreach_context(),public.unified_outreach_context() to authenticated;
-- Newly recreated entry points must not inherit PostgreSQL's PUBLIC EXECUTE default.
revoke all on function private.outreach_partner_workspace(text,uuid,jsonb),private.outreach_partner_admin_workspace(text,uuid,jsonb),private.outreach_decision_workspace(text,uuid,jsonb),private.outreach_access_workspace(text,jsonb) from public,anon;

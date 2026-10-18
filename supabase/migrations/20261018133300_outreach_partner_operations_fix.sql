create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(pc.id,k))),
        'central_manage',private.outreach_partner_central_manage(pc.campaign_id)
      ) order by c.name,pc.name)
      from public.outreach_partner_churches pc
      join public.outreach_campaigns c on c.id=pc.campaign_id
      where pc.active and (private.outreach_partner_central_manage(pc.campaign_id) or private.outreach_partner_cap(pc.id,'partner.view'))
    ),'[]'::jsonb);
  end if;

  select * into partner_row from public.outreach_partner_churches where id=p_partner and active;
  if partner_row.id is null or not(private.outreach_partner_central_manage(partner_row.campaign_id) or private.outreach_partner_cap(partner_row.id,'partner.view')) then
    raise exception 'Partner workspace access denied' using errcode='42501';
  end if;
  caps:=array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k));

  if p_action='context' then
    return jsonb_build_object(
      'partner',jsonb_build_object('id',partner_row.id,'name',partner_row.name,'campaign_id',partner_row.campaign_id,'slug',partner_row.slug),
      'campaign',(select jsonb_build_object('id',c.id,'name',c.name,'status',c.status,'city',c.city,'state_province',c.state_province) from public.outreach_campaigns c where c.id=partner_row.campaign_id),
      'capabilities',to_jsonb(caps),
      'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id),
      'workers',case when private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)
        then coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id)) order by lower((select email from auth.users where id=u.user_id)))
          from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'assigned',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'),
        'open',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='active'),
        'completed',(select count(*) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status='completed'),
        'needs_followup',(select count(distinct x.id) from public.outreach_partner_assignments x left join lateral (
          select status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1
        ) lf on true where x.partner_church_id=partner_row.id and x.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
      ),
      'assignments',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'subject',private.outreach_partner_subject_json(x),'status',x.status,
          'assigned_worker_user_id',x.assigned_worker_user_id,'assigned_at',x.assigned_at,
          'latest_followup',(select jsonb_build_object('status',y.status,'next_contact_at',y.next_contact_at,'created_at',y.created_at)
             from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at desc)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  assignment_id:=nullif(p_payload->>'assignment_id','')::uuid;
  if p_action in ('detail','followup_add','pastoral_note_add','assign_worker') then
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
  end if;

  if p_action='detail' then
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  elsif p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,nullif(p_payload->>'next_contact_at','')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  elsif p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  elsif p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=a.id;
    return jsonb_build_object('saved',true);
  elsif p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object('filename',partner_row.slug||'-followup.csv','rows',coalesce((
      select jsonb_agg(jsonb_build_object(
        'name',private.outreach_partner_subject_json(x)->>'name','email',private.outreach_partner_subject_json(x)->>'email',
        'phone',private.outreach_partner_subject_json(x)->>'phone','decision',private.outreach_partner_subject_json(x)->>'decision',
        'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
        'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
      ) order by x.assigned_at) from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
    ),'[]'::jsonb));
  end if;
  raise exception 'Unsupported partner action';
end $$;

create or replace function private.outreach_partner_admin_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  pid uuid; uid uuid; assignment uuid; decision_source text; target uuid;
begin
  if not private.outreach_partner_central_manage(p_campaign) then raise exception 'Partner administration denied' using errcode='42501'; end if;

  if p_action='list' then
    return jsonb_build_object(
      'partners',coalesce((
        select jsonb_agg(to_jsonb(x)||jsonb_build_object(
          'users',coalesce((select jsonb_agg(jsonb_build_object('user_id',u.user_id,'email',(select email from auth.users where id=u.user_id),'capabilities',u.capabilities,'active',u.active,'revision',u.revision) order by lower((select email from auth.users where id=u.user_id))) from public.outreach_partner_users u where u.partner_church_id=x.id),'[]'::jsonb),
          'assigned',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status<>'revoked'),
          'open',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='active'),
          'completed',(select count(*) from public.outreach_partner_assignments a where a.partner_church_id=x.id and a.status='completed'),
          'needs_followup',(select count(distinct a.id) from public.outreach_partner_assignments a left join lateral (select status from public.outreach_partner_followup f where f.assignment_id=a.id order by f.created_at desc limit 1) lf on true where a.partner_church_id=x.id and a.status<>'revoked' and coalesce(lf.status,'new') in ('new','attempted','needs_followup'))
        ) order by x.name) from public.outreach_partner_churches x where x.campaign_id=p_campaign
      ),'[]'::jsonb),
      'assignments',coalesce((select jsonb_agg(jsonb_build_object('id',a.id,'partner_church_id',a.partner_church_id,'subject',private.outreach_partner_subject_json(a),'status',a.status,'assigned_at',a.assigned_at) order by a.assigned_at desc) from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.status<>'revoked'),'[]'::jsonb),
      'unassigned_decisions',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'decision',r.decision,'created_at',r.created_at) order by r.created_at desc) from public.outreach_decision_campaign_sources s join public.outreach_registrations r on r.source=s.source where s.campaign_id=p_campaign and s.active and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.decision_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb),
      'unassigned_households',coalesce((select jsonb_agg(jsonb_build_object('id',r.id,'name',r.first_name||' '||r.last_name,'reference',r.reference,'submitted_at',r.submitted_at) order by r.submitted_at desc) from public.outreach_event_registrations r where r.campaign_id=p_campaign and not exists(select 1 from public.outreach_partner_assignments a where a.campaign_id=p_campaign and a.event_registration_id=r.id and a.status<>'revoked')),'[]'::jsonb)
    );
  elsif p_action='partner_save' then
    pid:=nullif(p_payload->>'id','')::uuid;
    if pid is null then insert into public.outreach_partner_churches(campaign_id,name,slug,external_organization_id,created_by) values(p_campaign,btrim(p_payload->>'name'),lower(btrim(p_payload->>'slug')),nullif(p_payload->>'external_organization_id','')::uuid,auth.uid()) returning id into pid;
    else update public.outreach_partner_churches set name=btrim(p_payload->>'name'),active=coalesce((p_payload->>'active')::boolean,true),revision=revision+1 where id=pid and campaign_id=p_campaign; if not found then raise exception 'Partner church unavailable' using errcode='42501'; end if; end if;
    return jsonb_build_object('saved',true,'id',pid);
  elsif p_action='user_grant' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if nullif(p_payload->>'user_id','') is not null then uid:=(p_payload->>'user_id')::uuid; else select id into uid from auth.users where lower(email)=lower(btrim(p_payload->>'email')); end if;
    if uid is null then raise exception 'Verified Auth account required'; end if;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_users(partner_church_id,campaign_id,user_id,capabilities,active,granted_by,reason)
    values(pid,p_campaign,uid,array(select jsonb_array_elements_text(p_payload->'capabilities')),true,auth.uid(),p_payload->>'reason')
    on conflict(partner_church_id,user_id) do update set capabilities=excluded.capabilities,active=true,effective_at=now(),expires_at=null,granted_by=excluded.granted_by,reason=excluded.reason,revision=public.outreach_partner_users.revision+1;
    return jsonb_build_object('saved',true);
  elsif p_action='user_revoke' then
    pid:=(p_payload->>'partner_church_id')::uuid; uid:=(p_payload->>'user_id')::uuid;
    update public.outreach_partner_users set active=false,expires_at=now(),granted_by=auth.uid(),reason=p_payload->>'reason',revision=revision+1 where partner_church_id=pid and campaign_id=p_campaign and user_id=uid and active;
    if not found then raise exception 'Partner user unavailable'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=null,revision=revision+1 where partner_church_id=pid and assigned_worker_user_id=uid and status<>'revoked';
    return jsonb_build_object('saved',true);
  elsif p_action='assign' then
    pid:=(p_payload->>'partner_church_id')::uuid;
    if not exists(select 1 from public.outreach_partner_churches where id=pid and campaign_id=p_campaign and active) then raise exception 'Partner church unavailable' using errcode='42501'; end if;
    target:=(p_payload->>'subject_id')::uuid;
    if p_payload->>'subject_type'='decision' then
      select s.source into decision_source from public.outreach_decision_campaign_sources s where s.campaign_id=p_campaign and s.active;
      if not exists(select 1 from public.outreach_registrations r where r.id=target and r.source=decision_source) then raise exception 'Decision outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,decision_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    elsif p_payload->>'subject_type'='household' then
      if not exists(select 1 from public.outreach_event_registrations r where r.id=target and r.campaign_id=p_campaign) then raise exception 'Household outside campaign' using errcode='42501'; end if;
      insert into public.outreach_partner_assignments(campaign_id,partner_church_id,event_registration_id,assigned_by,assignment_reason) values(p_campaign,pid,target,auth.uid(),p_payload->>'reason') returning id into assignment;
    else raise exception 'Invalid subject type'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_created',assignment,jsonb_build_object('partner_church_id',pid,'subject_type',p_payload->>'subject_type'));
    return jsonb_build_object('saved',true,'id',assignment);
  elsif p_action='revoke_assignment' then
    assignment:=(p_payload->>'assignment_id')::uuid;
    update public.outreach_partner_assignments set status='revoked',revoked_at=now(),revoked_by=auth.uid(),revision=revision+1 where id=assignment and campaign_id=p_campaign and status<>'revoked';
    if not found then raise exception 'Assignment unavailable'; end if;
    perform private.outreach_audit(p_campaign,(select organization_id from public.outreach_campaigns where id=p_campaign),'partner.assignment_revoked',assignment,'{}'::jsonb);
    return jsonb_build_object('saved',true);
  end if;
  raise exception 'Unsupported partner admin action';
end $$;

create or replace function private.outreach_partner_workspace(p_action text,p_partner uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  partner_row public.outreach_partner_churches;
  a public.outreach_partner_assignments;
  worker uuid;
  assignment_id uuid;
  source text;
  row_id uuid;
  caps text[];
  fstatus text;
begin
  if not private.outreach_verified(auth.uid()) then raise exception 'Verified sign-in required' using errcode='42501'; end if;

  if p_action='partners' then
    return coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',pc.id,'campaign_id',pc.campaign_id,'name',pc.name,'slug',pc.slug,
        'campaign_name',c.name,'campaign_status',c.status,
        'capabilities',to_jsonb(array(select k from unnest(array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']) k where private.outreach_partner_cap(partner_row.id,k))),
        'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
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
      'capabilities',to_jsonb(caps),'central_manage',private.outreach_partner_central_manage(partner_row.campaign_id)
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

  if p_action='detail' then
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object(
      'assignment',jsonb_build_object('id',a.id,'status',a.status,'assigned_worker_user_id',a.assigned_worker_user_id,'revision',a.revision),
      'subject',private.outreach_partner_subject_json(a),
      'followup',coalesce((select jsonb_agg(jsonb_build_object('id',x.id,'status',x.status,'next_contact_at',x.next_contact_at,'shared_note',x.shared_note,'created_at',x.created_at,'created_by',x.created_by) order by x.created_at desc) from public.outreach_partner_followup x where x.assignment_id=a.id),'[]'::jsonb),
      'pastoral_notes',case
        when private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')
        then coalesce((select jsonb_agg(jsonb_build_object('id',n.id,'note',n.note,'created_at',n.created_at,'created_by',n.created_by) order by n.created_at desc) from public.outreach_partner_pastoral_notes n where n.assignment_id=a.id),'[]'::jsonb)
        else '[]'::jsonb end
    );
  end if;

  if p_action='followup_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.followup') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Follow-up access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked' for update;
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    fstatus:=p_payload->>'status';
    if fstatus not in ('new','attempted','contacted','connected','discipleship_started','needs_followup','declined','complete') then raise exception 'Invalid follow-up status'; end if;
    insert into public.outreach_partner_followup(assignment_id,campaign_id,partner_church_id,status,next_contact_at,shared_note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,fstatus,(p_payload->>'next_contact_at')::timestamptz,left(coalesce(p_payload->>'shared_note',''),4000),auth.uid());
    if fstatus in ('complete','declined') then update public.outreach_partner_assignments set status='completed',revision=revision+1 where id=a.id; end if;
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.followup_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id,'status',fstatus));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='pastoral_note_add' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.pastoral_notes') or private.has_staff_permission((select organization_id from public.outreach_campaigns where id=partner_row.campaign_id),'care.read')) then raise exception 'Pastoral note access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    select * into a from public.outreach_partner_assignments where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if a.id is null then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    insert into public.outreach_partner_pastoral_notes(assignment_id,campaign_id,partner_church_id,note,created_by)
    values(a.id,a.campaign_id,a.partner_church_id,left(btrim(p_payload->>'note'),8000),auth.uid());
    perform private.outreach_audit(a.campaign_id,(select organization_id from public.outreach_campaigns where id=a.campaign_id),'partner.pastoral_note_recorded',a.id,jsonb_build_object('partner_church_id',partner_row.id));
    return jsonb_build_object('saved',true);
  end if;

  if p_action='assign_worker' then
    if not(private.outreach_partner_cap(partner_row.id,'partner.assign_local') or private.outreach_partner_central_manage(partner_row.campaign_id)) then raise exception 'Local assignment access denied' using errcode='42501'; end if;
    assignment_id:=(p_payload->>'assignment_id')::uuid;
    worker:=nullif(p_payload->>'user_id','')::uuid;
    if worker is not null and not exists(select 1 from public.outreach_partner_users u where u.partner_church_id=partner_row.id and u.user_id=worker and u.active and u.effective_at<=now() and (u.expires_at is null or u.expires_at>now())) then raise exception 'Worker outside partner church' using errcode='42501'; end if;
    update public.outreach_partner_assignments set assigned_worker_user_id=worker,revision=revision+1 where id=assignment_id and partner_church_id=partner_row.id and status<>'revoked';
    if not found then raise exception 'Assignment unavailable' using errcode='42501'; end if;
    return jsonb_build_object('saved',true);
  end if;

  if p_action='export' then
    if not private.outreach_partner_cap(partner_row.id,'partner.export') and not private.outreach_partner_central_manage(partner_row.campaign_id) then raise exception 'Export access denied' using errcode='42501'; end if;
    return jsonb_build_object(
      'filename',partner_row.slug||'-followup.csv',
      'rows',coalesce((
        select jsonb_agg(jsonb_build_object(
          'name',private.outreach_partner_subject_json(x)->>'name',
          'email',private.outreach_partner_subject_json(x)->>'email',
          'phone',private.outreach_partner_subject_json(x)->>'phone',
          'decision',private.outreach_partner_subject_json(x)->>'decision',
          'status',coalesce((select y.status from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1),'new'),
          'next_contact_at',(select y.next_contact_at from public.outreach_partner_followup y where y.assignment_id=x.id order by y.created_at desc limit 1)
        ) order by x.assigned_at)
        from public.outreach_partner_assignments x where x.partner_church_id=partner_row.id and x.status<>'revoked'
      ),'[]'::jsonb)
    );
  end if;

  raise exception 'Unsupported partner action';
end $$;



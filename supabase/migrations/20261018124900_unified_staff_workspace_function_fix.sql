create or replace function private.outreach_decision_workspace(p_action text,p_campaign uuid,p_payload jsonb)
returns jsonb
language plpgsql security definer set search_path=''
as $$
declare
  c public.outreach_campaigns;
  src text;
  r public.outreach_registrations;
  f public.outreach_decision_followup;
  search_text text;
  next_status text;
begin
  if not private.outreach_verified(auth.uid()) then
    raise exception 'Verified sign-in required' using errcode='42501';
  end if;

  if p_action='campaigns' then
    return coalesce((
      select jsonb_agg(
        jsonb_build_object(
          'id',oc.id,'name',oc.name,'code',oc.code,'city',oc.city,'state_province',oc.state_province,
          'country',oc.country,'status',oc.status,'public_page',oc.public_page,
          'decision_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source),
          'salvation_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='salvation'),
          'rededication_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='rededication'),
          'followup_count',(select count(*) from public.outreach_registrations rr where rr.source=srcmap.source and rr.decision='prayer_followup')
        )
        order by oc.name
      )
      from public.outreach_campaigns oc
      join public.outreach_decision_campaign_sources srcmap on srcmap.campaign_id=oc.id and srcmap.active
      where private.outreach_decision_can(oc.id,'decision.view')
    ),'[]'::jsonb);
  end if;

  select * into c from public.outreach_campaigns where id=p_campaign;
  select source into src from public.outreach_decision_campaign_sources where campaign_id=p_campaign and active;
  if c.id is null or src is null or not private.outreach_decision_can(p_campaign,'decision.view') then
    raise exception 'Decision workspace access denied' using errcode='42501';
  end if;

  if p_action='context' then
    return jsonb_build_object(
      'campaign',jsonb_build_object(
        'id',c.id,'name',c.name,'code',c.code,'city',c.city,'state_province',c.state_province,
        'country',c.country,'status',c.status,'public_page',c.public_page
      ),
      'capabilities',jsonb_build_array('decision.view') ||
        case when private.outreach_decision_can(p_campaign,'decision.manage')
          then jsonb_build_array('decision.manage') else '[]'::jsonb end
    );
  end if;

  if p_action='list' then
    search_text:=left(btrim(coalesce(p_payload->>'search','')),100);
    return jsonb_build_object(
      'summary',jsonb_build_object(
        'total',(select count(*) from public.outreach_registrations x where x.source=src),
        'salvation',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='salvation'),
        'rededication',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='rededication'),
        'learn_more',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='learn_more'),
        'prayer_followup',(select count(*) from public.outreach_registrations x where x.source=src and x.decision='prayer_followup'),
        'open_followup',(select count(*) from public.outreach_registrations x
          left join public.outreach_decision_followup y on y.registration_id=x.id
          where x.source=src and coalesce(y.status,'new')<>'closed')
      ),
      'registrations',coalesce((
        select jsonb_agg(jsonb_build_object(
          'id',x.id,'name',x.first_name||' '||x.last_name,'first_name',x.first_name,'last_name',x.last_name,
          'email',x.email,'phone',x.phone,'decision',x.decision,'created_at',x.created_at,
          'followup_status',coalesce(y.status,'new'),'assigned_user_id',y.assigned_user_id,'revision',coalesce(y.revision,0)
        ) order by x.created_at desc)
        from public.outreach_registrations x
        left join public.outreach_decision_followup y on y.registration_id=x.id
        where x.source=src
          and (
            search_text=''
            or concat_ws(' ',x.first_name,x.last_name,x.email,x.phone,x.decision) ilike
              '%'||replace(replace(search_text,'%','\%'),'_','\_')||'%'
          )
      ),'[]'::jsonb)
    );
  end if;

  if p_payload->>'registration_id' is null then
    raise exception 'Registration required';
  end if;
  select * into r from public.outreach_registrations
   where id=(p_payload->>'registration_id')::uuid and source=src;
  if r.id is null then raise exception 'Registration outside campaign' using errcode='42501'; end if;

  if p_action='detail' then
    select * into f from public.outreach_decision_followup where registration_id=r.id;
    return jsonb_build_object(
      'id',r.id,'first_name',r.first_name,'last_name',r.last_name,'email',r.email,'phone',r.phone,
      'decision',r.decision,'prayer_request',r.prayer_request,'created_at',r.created_at,'consent',r.consent,
      'followup_status',coalesce(f.status,'new'),'assigned_user_id',f.assigned_user_id,
      'notes',coalesce(f.notes,''),'revision',coalesce(f.revision,0)
    );
  end if;

  if p_action='save' then
    if not private.outreach_decision_can(p_campaign,'decision.manage') then
      raise exception 'Decision management access denied' using errcode='42501';
    end if;
    next_status:=p_payload->>'status';
    if next_status not in ('new','contacting','connected','discipleship','closed') then
      raise exception 'Invalid follow-up status';
    end if;
    if coalesce((p_payload->>'revision')::int,0)=0 then
      insert into public.outreach_decision_followup(
        registration_id,campaign_id,status,assigned_user_id,notes,updated_by
      ) values (
        r.id,p_campaign,next_status,
        nullif(p_payload->>'assigned_user_id','')::uuid,
        left(coalesce(p_payload->>'notes',''),4000),auth.uid()
      )
      on conflict(registration_id) do nothing;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    else
      update public.outreach_decision_followup
         set status=next_status,
             assigned_user_id=nullif(p_payload->>'assigned_user_id','')::uuid,
             notes=left(coalesce(p_payload->>'notes',''),4000),
             updated_by=auth.uid(),updated_at=now(),revision=revision+1
       where registration_id=r.id and revision=(p_payload->>'revision')::int;
      if not found then raise exception 'Follow-up changed; reload'; end if;
    end if;
    perform private.outreach_audit(p_campaign,c.organization_id,'decision.followup_updated',r.id,
      jsonb_build_object('status',next_status));
    return jsonb_build_object('saved',true);
  end if;

  raise exception 'Unsupported decision action';
end $$;

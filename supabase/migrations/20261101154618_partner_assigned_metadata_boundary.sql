-- LOCAL SOURCE CANDIDATE ONLY. CLI-generated forward migration. No seeds/grants to people.
-- Exactly the three reviewed #29/#35 Partner table contracts; no legacy RPC/policies copied.
-- Issuance/admin workflow is deliberately absent pending separately reviewed authority mapping.
create table public.outreach_partner_churches (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id),
  name text not null check(length(btrim(name)) between 2 and 180),
  slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{1,79}$'),
  external_organization_id uuid references public.organizations(id),
  active boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid not null references auth.users(id),
  revision integer not null default 1,
  unique(campaign_id,slug),
  unique(campaign_id,id)
);

create table public.outreach_partner_users (
  partner_church_id uuid not null references public.outreach_partner_churches(id),
  campaign_id uuid not null,
  user_id uuid not null references auth.users(id),
  capabilities text[] not null,
  active boolean not null default true,
  effective_at timestamptz not null default now(),
  expires_at timestamptz,
  granted_by uuid not null references auth.users(id),
  reason text not null check(length(btrim(reason)) between 10 and 500),
  revision integer not null default 1,
  primary key(partner_church_id,user_id),
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id),
  check(expires_at is null or expires_at>effective_at),
  check(
    capabilities <@ array['partner.view','partner.followup','partner.assign_local','partner.export','partner.pastoral_notes']::text[]
    and cardinality(capabilities)>0
    and array_position(capabilities,null) is null
    and (not('partner.followup'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.assign_local'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.export'=any(capabilities)) or 'partner.view'=any(capabilities))
    and (not('partner.pastoral_notes'=any(capabilities)) or 'partner.view'=any(capabilities))
  )
);
create index outreach_partner_users_user_idx on public.outreach_partner_users(user_id,campaign_id);

create table public.outreach_partner_assignments (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.outreach_campaigns(id),
  partner_church_id uuid not null,
  decision_registration_id uuid references public.outreach_registrations(id),
  event_registration_id uuid references public.outreach_event_registrations(id),
  assigned_worker_user_id uuid references auth.users(id),
  status text not null default 'active' check(status in ('active','completed','revoked')),
  assigned_by uuid not null references auth.users(id),
  assigned_at timestamptz not null default now(),
  assignment_reason text not null check(length(btrim(assignment_reason)) between 10 and 500),
  revoked_at timestamptz,
  revoked_by uuid references auth.users(id),
  revision integer not null default 1,
  foreign key(campaign_id,partner_church_id) references public.outreach_partner_churches(campaign_id,id),
  check((decision_registration_id is not null)::int + (event_registration_id is not null)::int = 1),
  check((status='revoked')=(revoked_at is not null))
);
create unique index outreach_partner_assignment_decision_active_uq
  on public.outreach_partner_assignments(partner_church_id,decision_registration_id)
  where decision_registration_id is not null and status<>'revoked';
create unique index outreach_partner_assignment_event_active_uq
  on public.outreach_partner_assignments(partner_church_id,event_registration_id)
  where event_registration_id is not null and status<>'revoked';
create index outreach_partner_assignments_campaign_idx on public.outreach_partner_assignments(campaign_id,partner_church_id,status);


alter table public.outreach_partner_churches enable row level security;
alter table public.outreach_partner_users enable row level security;
alter table public.outreach_partner_assignments enable row level security;
revoke all on public.outreach_partner_churches,public.outreach_partner_users,public.outreach_partner_assignments from public,anon,authenticated,service_role;
-- No direct reads/writes, policy-based role fallback or exposed issuer.

create function private.partner_assigned_metadata(p_campaign uuid,p_assignment uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare actor uuid:=auth.uid(); sid uuid; session_limit timestamptz; actor_ok boolean; row record;
 result jsonb:='[]'::jsonb; valid_until timestamptz:='infinity';
begin
 if actor is null or p_campaign is null then raise exception 'Partner access unavailable' using errcode='42501';end if;
 begin sid:=nullif(auth.jwt()->>'session_id','')::uuid;
 exception when invalid_text_representation then raise exception 'Partner access unavailable' using errcode='42501';end;
 if sid is null then raise exception 'Partner access unavailable' using errcode='42501';end if;
 -- FOR SHARE protects all non-key revocation fields and session deletion, unlike KEY SHARE.
 select email_confirmed_at is not null and not coalesce(is_anonymous,false)
   and deleted_at is null and (banned_until is null or banned_until<=clock_timestamp()) into actor_ok
 from auth.users where id=actor for share;
 if actor_ok is distinct from true then raise exception 'Partner access unavailable' using errcode='42501';end if;
 select not_after into session_limit from auth.sessions where id=sid and user_id=actor for share;
 if not found or session_limit<=clock_timestamp() then raise exception 'Partner access unavailable' using errcode='42501';end if;
 valid_until:=coalesce(session_limit,'infinity');
 -- Existing exact campaign assignment is necessary, never sufficient. An explicit
 -- Partner user grant AND explicit assigned worker record are also required.
 for row in
 select a.id,a.campaign_id,c.organization_id,a.partner_church_id,a.status,a.revision,
        ca.expires_at campaign_expiry,pu.expires_at partner_expiry
 from public.outreach_partner_assignments a
 join public.outreach_partner_churches pc on pc.id=a.partner_church_id and pc.campaign_id=a.campaign_id and pc.active
 join public.outreach_campaigns c on c.id=a.campaign_id
 join public.outreach_campaign_assignments ca on ca.campaign_id=c.id and ca.user_id=actor and ca.active
   and ca.effective_at<=clock_timestamp() and (ca.expires_at is null or ca.expires_at>clock_timestamp()) and 'view'=any(ca.capabilities)
 join public.outreach_partner_users pu on pu.partner_church_id=pc.id and pu.campaign_id=c.id and pu.user_id=actor and pu.active
   and pu.effective_at<=clock_timestamp() and (pu.expires_at is null or pu.expires_at>clock_timestamp()) and 'partner.view'=any(pu.capabilities)
 -- Exact campaign/decision association only. Its optional person_id is NOT
 -- independently verified identity evidence and is never exported or trusted.
 join public.outreach_campaign_registrants r on r.campaign_id=c.id and r.organization_id=c.organization_id and r.legacy_registration_id=a.decision_registration_id
 where a.campaign_id=p_campaign and a.assigned_worker_user_id=actor and a.status<>'revoked'
   and a.event_registration_id is null and (p_assignment is null or a.id=p_assignment)
 order by a.id limit 100
 for share of a,pc,c,ca,pu,r
 loop
  valid_until:=least(valid_until,coalesce(row.campaign_expiry,'infinity'),coalesce(row.partner_expiry,'infinity'));
  result:=result||jsonb_build_array(jsonb_build_object('id',row.id,'campaignId',row.campaign_id,'organizationId',row.organization_id,
    'partnerChurchId',row.partner_church_id,'personId',null,'identityStatus','unverified','status',row.status,'revision',row.revision));
 end loop;
 if clock_timestamp()>=valid_until or (p_assignment is not null and jsonb_array_length(result)=0) then
   raise exception 'Partner access unavailable' using errcode='42501';end if;
 return result;
end $$;
create function public.partner_assigned_metadata(p_campaign uuid,p_assignment uuid default null)
returns jsonb language sql volatile security invoker set search_path='' as $$ select private.partner_assigned_metadata(p_campaign,p_assignment) $$;
revoke all on function private.partner_assigned_metadata(uuid,uuid),public.partner_assigned_metadata(uuid,uuid) from public,anon,authenticated,service_role;
grant execute on function private.partner_assigned_metadata(uuid,uuid),public.partner_assigned_metadata(uuid,uuid) to authenticated;

-- Phase F local candidate only. No hosted changes, real sends or campaign activation.
alter table public.outreach_campaign_assignments drop constraint outreach_campaign_assignments_capabilities_check;
alter table public.outreach_campaign_assignments add constraint outreach_campaign_assignments_capabilities_check check (
 capabilities <@ array['view','export','followup','decisions','workflow','documents','draw','team.view','team.manage','travel.view','travel.manage','registration.view','registration.manage','registration.export','checkin.manage','prize.view','prize.manage','prize.draw','prize.claim','ops.view','ops.manage','inventory.view','inventory.manage','issue.manage','preevent.view','preevent.manage','host.view','host.respond']::text[]
 and cardinality(capabilities)>0 and array_position(capabilities,null) is null
 and (not('team.manage'=any(capabilities)) or 'team.view'=any(capabilities))
 and (not('travel.manage'=any(capabilities)) or 'travel.view'=any(capabilities))
 and (not(capabilities && array['registration.manage','registration.export','checkin.manage']) or 'registration.view'=any(capabilities))
 and (not(capabilities && array['prize.manage','prize.draw','prize.claim']) or 'prize.view'=any(capabilities))
 and (not('ops.manage'=any(capabilities)) or 'ops.view'=any(capabilities))
 and (not('inventory.manage'=any(capabilities)) or 'inventory.view'=any(capabilities))
 and (not('preevent.manage'=any(capabilities)) or 'preevent.view'=any(capabilities))
 and (not('host.respond'=any(capabilities)) or 'host.view'=any(capabilities))
 and (not('issue.manage'=any(capabilities)) or 'ops.view'=any(capabilities)));

alter table public.outreach_campaign_contacts drop constraint outreach_campaign_contacts_role_key_check;
alter table public.outreach_campaign_contacts add constraint outreach_campaign_contacts_role_key_check check(role_key in ('host_pastor','host_coordinator','local_coordinator','ground_coordinator','church_office','outreach_coordinator','pastor_roddy','internal_team','internal_manager','logistics_lead','production_lead','local_leader','other'));
alter table public.outreach_campaign_events drop constraint outreach_campaign_events_kind_check;
alter table public.outreach_campaign_events add constraint outreach_campaign_events_kind_check check(kind in (
 'campaign.created','campaign.approved','workflow.step_due','workflow.step_overdue','workflow.step_completed','document.requested','document.uploaded','agreement.completed','training.assigned','training.completed','registration.opened','team.signup_opened','event.ready','event.completed','followup.required','drawing_number.assigned','drawing_reminder','prize.won','prize.unclaimed',
 'team_signup.submitted','team_signup.approved','team_signup.waitlisted','team_signup.not_selected','vehicle.assigned','vehicle.changed','lodging.assigned','lodging.changed','trip_details.updated','departure_reminder','team_role.assigned','team.action_required',
 'outreach.registration.submitted','outreach.registration.updated','outreach.waiver.signed','outreach.registration.confirmed','outreach.attendee.checked_in','outreach.attendee.checkin_reversed','outreach.walkup.registered',
 'outreach.drawing.reminder','outreach.prize.winner_selected','outreach.prize.claimed','outreach.prize.unclaimed',
 'outreach.ops.ready','outreach.ops.issue_opened','outreach.ops.issue_resolved','outreach.ops.event_completed',
 'outreach.opportunity.submitted','outreach.opportunity.approved','outreach.campaign.created','outreach.agreement.requested','outreach.agreement.completed','outreach.cost_impact_detected','outreach.document.requested','outreach.document.uploaded','outreach.document.approved','outreach.training.assigned','outreach.training.completed','outreach.task.due','outreach.task.overdue','outreach.task.escalated','outreach.event_details.missing','outreach.packet.ready','outreach.packet.generated','outreach.final_readiness.changed','outreach.campaign.rescheduled','outreach.campaign.postponed','outreach.welcome.prepared','outreach.registration.qr_requested'));

alter table public.outreach_campaign_events alter column campaign_id drop not null;
alter table public.outreach_campaign_events add column organization_id uuid references public.organizations(id);
alter table public.outreach_campaign_events add constraint outreach_event_owner check(campaign_id is not null or organization_id is not null);
alter table public.outreach_opportunities drop constraint outreach_opportunities_stage_check;
alter table public.outreach_opportunities add constraint outreach_opportunities_stage_check check(stage in ('new','contacted','reviewing','tentative','approved','future','declined','converted'));
alter table public.outreach_opportunities add column assigned_owner uuid references auth.users(id);
alter table public.outreach_opportunities add column next_action text not null default '' check(length(next_action)<=1000);
alter table public.outreach_opportunities add column target_month text check(target_month ~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
alter table public.outreach_opportunities add column disposition_reason text not null default '' check(length(disposition_reason)<=2000);
alter table public.outreach_opportunities add column source_website text;
alter table public.outreach_opportunities add column request_key uuid;
alter table public.outreach_opportunities add column created_by uuid references auth.users(id);
create unique index outreach_opportunity_retry on public.outreach_opportunities(organization_id,request_key) where request_key is not null;
alter table public.outreach_campaigns drop constraint outreach_campaigns_status_check;
alter table public.outreach_campaigns add constraint outreach_campaigns_status_check check(status in ('draft','approved','preparing','registration_open','ready','completed','closed','cancelled','scheduled','postponed','rescheduled'));
alter table public.outreach_campaign_steps add column priority text not null default 'normal' check(priority in ('low','normal','high','critical'));
alter table public.outreach_campaign_steps add column reconfirmation_required boolean not null default false;
alter table public.outreach_campaign_steps add column reconfirmed_at timestamptz;
alter table public.outreach_campaign_steps add column created_by uuid references auth.users(id) default auth.uid();
alter table public.outreach_campaign_steps add column created_at timestamptz not null default now();
alter table public.outreach_campaign_steps add column updated_at timestamptz not null default now();
-- Categories are configuration labels, not a closed schema enumeration.
alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_category_check;
alter table public.outreach_campaign_documents add constraint outreach_document_category check(category ~ '^[a-z0-9_-]{1,80}$');
alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_status_check;
alter table public.outreach_campaign_documents add constraint outreach_document_status check(status in ('requested','uploaded','approved','rejected','needs_changes'));
alter table public.outreach_campaign_documents drop constraint outreach_campaign_documents_visibility_check;
alter table public.outreach_campaign_documents add constraint outreach_document_visibility check(visibility in ('restricted','internal','public','host_church','campaign_team','public_resource'));
alter table public.outreach_campaign_documents add column phase_f boolean not null default false;
alter table public.outreach_campaign_documents add column instructions text not null default '' check(length(instructions)<=6000);
alter table public.outreach_campaign_documents add column created_by uuid references auth.users(id) default auth.uid();
alter table public.outreach_campaign_documents add column reviewed_by uuid references auth.users(id);
alter table public.outreach_campaign_documents add column reviewed_at timestamptz;
alter table public.outreach_campaign_documents add column review_note text not null default '' check(length(review_note)<=2000);
alter table public.outreach_campaign_documents add column expires_at timestamptz;
alter table public.outreach_campaign_documents add column revision integer not null default 1;
alter table public.outreach_campaign_resources add column version integer not null default 1 check(version>0);
alter table public.outreach_campaign_resources drop constraint outreach_campaign_resources_campaign_id_resource_key_key;
alter table public.outreach_campaign_resources add unique(campaign_id,resource_key,version);
alter table public.outreach_campaign_resources drop constraint outreach_campaign_resources_resource_type_check;
alter table public.outreach_campaign_resources add constraint outreach_campaign_resources_resource_type_check check(resource_type in ('training','book','form','packet','flyer','other'));
create trigger phasef_resource_immutable before update or delete on public.outreach_campaign_resources for each row execute function private.outreach_immutable();
alter table public.outreach_campaign_resources add column visibility text not null default 'campaign_team' check(visibility in ('internal','host_church','campaign_team','public_resource'));
alter table public.outreach_campaign_resources add column created_at timestamptz not null default now();
alter table public.outreach_campaign_training add column assigned_role text;
alter table public.outreach_campaign_training add column assigned_at timestamptz not null default now();
alter table public.outreach_campaign_training add column required boolean not null default true;

create table public.outreach_host_profiles (
 owner_organization_id uuid not null references public.organizations(id), host_organization_id uuid not null references public.organizations(id),
 address text not null default '' check(length(address)<=600), city text not null, state_province text not null default '', country text not null,
 phone text not null default '' check(length(phone)<=40), website text check(website ~ '^https://[^[:space:]@]+$'),
 reviewed_by uuid not null references auth.users(id), reviewed_at timestamptz not null default now(), revision integer not null default 1,
 primary key(owner_organization_id,host_organization_id)
);
create table public.outreach_agreement_versions (
 id uuid primary key default gen_random_uuid(), organization_id uuid not null references public.organizations(id),
 template_key text not null check(template_key ~ '^[a-z0-9_]{1,80}$'), version integer not null check(version>0),
 title text not null check(length(title) between 1 and 160), text_snapshot text not null check(length(btrim(text_snapshot)) between 10 and 30000),
 fields jsonb not null check(jsonb_typeof(fields)='array' and octet_length(fields::text)<=20000),
 source text not null check(length(source) between 1 and 2000), created_by uuid not null references auth.users(id), created_at timestamptz not null default now(),
 unique(organization_id,template_key,version), unique(organization_id,id)
);
create table public.outreach_campaign_agreements (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, organization_id uuid not null,
 agreement_version_id uuid not null, request_key uuid not null, version integer not null,
 text_snapshot text not null, fields_snapshot jsonb not null, responses jsonb not null check(jsonb_typeof(responses)='object' and octet_length(responses::text)<=20000),
 signature_name text not null check(length(btrim(signature_name)) between 2 and 160), acknowledged boolean not null check(acknowledged),
 submitted_by uuid not null references auth.users(id), submitted_at timestamptz not null default now(), source text not null,
 status text not null default 'submitted' check(status in ('submitted','approved','rejected','needs_changes')),
 reviewed_by uuid references auth.users(id), reviewed_at timestamptz, review_note text not null default '' check(length(review_note)<=2000), revision integer not null default 1,
 unique(campaign_id,request_key), unique(campaign_id,version), unique(campaign_id,id),
 foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id),
 foreign key(organization_id,agreement_version_id) references public.outreach_agreement_versions(organization_id,id)
);
create table public.outreach_task_reminders (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, step_id uuid not null, reminder_key text not null unique,
 kind text not null check(kind in ('upcoming','due','overdue','repeated_overdue','escalation','stale')),
 scheduled_at timestamptz not null, due_snapshot timestamptz, recipient_roles jsonb not null default '[]',
 assigned_user_id uuid references auth.users(id), state text not null default 'pending' check(state in ('pending','acknowledged','superseded')),
 created_at timestamptz not null default now(), foreign key(campaign_id,step_id) references public.outreach_campaign_steps(campaign_id,id)
);
create index outreach_reminder_due on public.outreach_task_reminders(campaign_id,state,scheduled_at);
create table public.outreach_campaign_packets (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id), generation_key uuid not null,
 version integer not null, campaign_revision integer not null, state text not null check(state in ('final','updated')),
 snapshot jsonb not null, host_snapshot jsonb not null, generated_by uuid not null references auth.users(id), generated_at timestamptz not null default now(),
 unique(campaign_id,generation_key), unique(campaign_id,version), unique(campaign_id,id)
);
create table public.outreach_interest_channels (
 slug text primary key check(slug ~ '^[a-z0-9-]{3,80}$'), organization_id uuid not null references public.organizations(id), enabled boolean not null default false,
 source_website text not null check(source_website ~ '^https://[^[:space:]@]+$'),
 network_hour_limit integer not null default 120 check(network_hour_limit between 1 and 1000), contact_hour_limit integer not null default 5 check(contact_hour_limit between 1 and 100)
);
create table private.outreach_interest_rate (
 channel text not null references public.outreach_interest_channels(slug), fingerprint text not null check(fingerprint ~ '^[a-f0-9]{64}$'),
 bucket timestamptz not null, attempts integer not null, primary key(channel,fingerprint,bucket)
);
alter table private.outreach_interest_rate enable row level security;
revoke all on private.outreach_interest_rate from public,anon,authenticated;

-- Host capabilities deliberately do NOT imply legacy 'view': legacy registrant/travel APIs stay denied.
create function private.phasef_can(c uuid,cap text default 'preevent.view') returns boolean language sql stable security definer set search_path='' as $$
 select cap in ('preevent.view','preevent.manage','host.view','host.respond') and private.outreach_verified(auth.uid()) and exists(
 select 1 from public.outreach_campaigns x where x.id=c and (private.outreach_admin(x.organization_id,cap in ('preevent.manage','host.respond')) or exists(
 select 1 from public.outreach_campaign_assignments a where a.campaign_id=c and a.user_id=auth.uid() and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and cap=any(a.capabilities))))
$$;
create function private.phasef_host(c uuid) returns boolean language sql stable security definer set search_path='' as $$select private.phasef_can(c,'host.view') and not private.phasef_can(c,'preevent.view')$$;
create function private.phasef_step_visible(c uuid,s uuid) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_steps x where x.campaign_id=c and x.id=s and (private.phasef_can(c) or (private.phasef_can(c,'host.view') and coalesce(x.definition->>'visibility','internal') in ('host_church','public_resource') and (x.assigned_user_id is null or x.assigned_user_id=auth.uid()))))
$$;
create function private.phasef_doc_visible(c uuid,d uuid,writing boolean default false) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents x join public.outreach_campaigns y on y.id=x.campaign_id where x.id=d and x.campaign_id=c and
 ((private.phasef_can(c) and (x.visibility<>'restricted' or private.outreach_admin(y.organization_id,true)) and (not writing or private.phasef_can(c,'preevent.manage'))) or
 (private.phasef_can(c,'host.view') and x.phase_f and x.visibility in ('host_church','public_resource') and (not writing or (private.phasef_can(c,'host.respond') and x.requested_from=auth.uid())))) and (not writing or x.status='requested'))
$$;
create or replace function private.outreach_document_can(p_name text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents d join public.outreach_campaigns c on c.id=d.campaign_id where d.object_path=p_name and
 case when d.phase_f then private.phasef_doc_visible(c.id,d.id,p_write) else private.outreach_can(c.id,'documents') and (d.visibility<>'restricted' or private.outreach_admin(c.organization_id,true)) and (not p_write or d.status='requested') end)
$$;
create function private.phasef_agreement_guard() returns trigger language plpgsql set search_path='' as $$begin
 if (to_jsonb(new)-array['status','reviewed_by','reviewed_at','review_note','revision']) is distinct from (to_jsonb(old)-array['status','reviewed_by','reviewed_at','review_note','revision']) then raise exception 'Signed agreement snapshot is immutable' using errcode='42501';end if;return new;end$$;
create trigger phasef_agreement_immutable before update on public.outreach_campaign_agreements for each row execute function private.phasef_agreement_guard();
create trigger phasef_agreement_no_delete before delete on public.outreach_campaign_agreements for each row execute function private.outreach_immutable();
create trigger phasef_agreement_version_immutable before update or delete on public.outreach_agreement_versions for each row execute function private.outreach_immutable();
create trigger phasef_packet_immutable before update or delete on public.outreach_campaign_packets for each row execute function private.outreach_immutable();
create function private.phasef_document_guard() returns trigger language plpgsql set search_path='' as $$begin
 if old.phase_f and (to_jsonb(new)-array['status','uploaded_at','byte_size','mime_type','reviewed_by','reviewed_at','review_note','revision']) is distinct from (to_jsonb(old)-array['status','uploaded_at','byte_size','mime_type','reviewed_by','reviewed_at','review_note','revision']) then raise exception 'Document version is immutable';end if;
 if old.phase_f and old.status<>'requested' and (new.byte_size is distinct from old.byte_size or new.mime_type is distinct from old.mime_type or new.uploaded_at is distinct from old.uploaded_at) then raise exception 'Uploaded version is immutable';end if;return new;end$$;
create trigger phasef_document_immutable before update on public.outreach_campaign_documents for each row execute function private.phasef_document_guard();

-- Extend the validator while retaining the accepted Phase A checks.
alter function private.outreach_template_valid(jsonb) rename to phasef_legacy_template_valid;
create function private.outreach_template_valid(p jsonb) returns boolean language plpgsql set search_path='' as $$declare s jsonb; normalized jsonb:='[]';n jsonb;v jsonb;begin
 if jsonb_typeof(p)<>'array' then return false;end if;
 for s in select value from jsonb_array_elements(p) loop
  n:=s;
  if s ? 'completion_rule' and s->>'completion_rule' not in ('manual','assigned_training_complete','approved_agreement','packet_generated','final_readiness') then return false;end if;
  if s->>'completion_rule' in ('approved_agreement','packet_generated','final_readiness') then n:=jsonb_set(n,'{completion_rule}','"manual"');end if;
  if s ? 'visibility' and s->>'visibility' not in ('internal','host_church','campaign_team','public_resource') then return false;end if;
  if s ? 'reconfirm_on_change' and jsonb_typeof(s->'reconfirm_on_change')<>'boolean' then return false;end if;
  if s ? 'required_fields' and jsonb_typeof(s->'required_fields')<>'array' then return false;end if;
  if s ? 'reminder_offsets' then
   if jsonb_typeof(s->'reminder_offsets')<>'array' or jsonb_array_length(s->'reminder_offsets')>30 then return false;end if;
   for v in select value from jsonb_array_elements(s->'reminder_offsets') loop if v::text !~ '^-?[0-9]+$' or (v::text)::int not between -365 and 365 then return false;end if;end loop;
  end if;
  if s ? 'escalations' then
   if jsonb_typeof(s->'escalations')<>'array' or jsonb_array_length(s->'escalations')>10 then return false;end if;
   for v in select value from jsonb_array_elements(s->'escalations') loop if coalesce((v->>'after_days')::int,0) not between 1 and 365 or jsonb_typeof(v->'roles')<>'array' then return false;end if;end loop;
  end if;
  normalized:=normalized||jsonb_build_array(n);
 end loop;return private.phasef_legacy_template_valid(normalized);exception when others then return false;end$$;
create function private.phasef_fields_valid(fields jsonb,answers jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare f jsonb;k text;v jsonb;begin
 if jsonb_typeof(fields)<>'array' or jsonb_typeof(answers)<>'object' then return false;end if;
 for k in select jsonb_object_keys(answers) loop if not exists(select 1 from jsonb_array_elements(fields) x where x->>'key'=k) then return false;end if;end loop;
 for f in select value from jsonb_array_elements(fields) loop
  k:=f->>'key';v:=answers->k;
  if coalesce((f->>'required')::boolean,false) and (v is null or v='null' or v='""') then return false;end if;
  if v is not null and v<>'null' then
   if f->>'type'='boolean' and jsonb_typeof(v)<>'boolean' then return false;end if;
   if f->>'type'='integer' and (v::text !~ '^[0-9]+$' or (v::text)::numeric>100000) then return false;end if;
   if f->>'type' in ('text','choice') and (jsonb_typeof(v)<>'string' or length(answers->>k)>6000) then return false;end if;
   if f->>'type'='choice' and not coalesce((f->'options') ? (answers->>k),false) then return false;end if;
  end if;
 end loop;return true;exception when others then return false;end$$;
create function private.phasef_field_schema_valid(fields jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(fields)='array' and jsonb_array_length(fields)<=60 and not exists(select 1 from jsonb_array_elements(fields) f where coalesce(f->>'key','')!~'^[a-z0-9_]{1,80}$' or length(coalesce(f->>'label','')) not between 1 and 200 or coalesce(f->>'type','') not in ('text','boolean','integer','choice') or (f ? 'required' and jsonb_typeof(f->'required')<>'boolean') or (f->>'type'='choice' and (jsonb_typeof(f->'options') is distinct from 'array' or jsonb_array_length(f->'options')=0))) and (select count(*) from jsonb_array_elements(fields))=(select count(distinct f->>'key') from jsonb_array_elements(fields) f)
$$;
-- Known operational inputs are document-confirmed, independent from pending exact legacy form fields.
create function private.phasef_inputs_valid(p jsonb) returns boolean language sql immutable set search_path='' as $$
 select jsonb_typeof(p)='object' and octet_length(p::text)<=6000 and not exists(select 1 from jsonb_each(p) x where
 (x.key in ('flyers','bikes_enabled','tablets_enabled','personnel_final','inventory_confirmed','semi_parking','box_truck_parking','bus_rv_staging') and jsonb_typeof(x.value)<>'boolean') or
 (x.key in ('bikes_quantity','tablets_quantity') and (x.value::text!~'^[0-9]+$' or length(x.value::text)>6)) or
 (x.key in ('bikes_responsibility','tablets_responsibility') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('host','champion_sowgo'))) or
 (x.key in ('permits_required','insurance_required') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('yes','no','unknown'))) or
 (x.key in ('permits_state','insurance_state') and (jsonb_typeof(x.value) is distinct from 'string' or x.value#>>'{}' not in ('unknown','requested','submitted','approved','verified','not_required'))))
$$;

create function private.phasef_interest_valid(p jsonb) returns boolean language plpgsql immutable set search_path='' as $$declare k text;v jsonb;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>12000 then return false;end if;
 for k,v in select * from jsonb_each(p) loop
  if k<>all(array['church_name','pastor_name','city','state_province','country','primary_contact','submitter_is_pastor','submitter_role','phone','email','website','preferred_months','alternate_months','previous_experience','prior_outreach','notes']) then return false;end if;
  if k not in ('submitter_is_pastor','prior_outreach','alternate_months') and (jsonb_typeof(v)<>'string' or length(p->>k)>2000) then return false;end if;
 end loop;
 return length(btrim(coalesce(p->>'church_name',''))) between 1 and 160 and length(btrim(coalesce(p->>'city',''))) between 1 and 100 and length(btrim(coalesce(p->>'country',''))) between 2 and 100
 and length(btrim(coalesce(p->>'pastor_name',''))) between 1 and 160 and length(btrim(coalesce(p->>'primary_contact',''))) between 1 and 160
 and jsonb_typeof(p->'submitter_is_pastor')='boolean' and (p->>'submitter_is_pastor'='true' or length(btrim(coalesce(p->>'submitter_role',''))) between 1 and 160)
 and coalesce(p->>'email','') ~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' and length(p->>'email')<=254
 and coalesce(p->>'phone','') ~ '^[+0-9(). -]{7,40}$' and coalesce(p->>'preferred_months','') ~ '^[0-9]{4}-(0[1-9]|1[0-2])$'
 and (not(p ? 'prior_outreach') or jsonb_typeof(p->'prior_outreach')='boolean')
 and (not(p ? 'website') or p->>'website'='' or p->>'website' ~ '^https://[^[:space:]@]+$')
 and (not(p ? 'alternate_months') or jsonb_typeof(p->'alternate_months')='array') and not exists(select 1 from jsonb_array_elements_text(coalesce(p->'alternate_months','[]')) x where x !~ '^[0-9]{4}-(0[1-9]|1[0-2])$');
 exception when others then return false;end$$;
create function private.phasef_interest_gateway(channel text,p jsonb,network text,email_hash text,phone_hash text) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare ch public.outreach_interest_channels;o public.outreach_opportunities;h text;n int;begin
 select * into ch from public.outreach_interest_channels where slug=channel and enabled;
 if not found or p->>'request_key' is null or private.phasef_interest_valid(p->'details') is distinct from true or network !~ '^[a-f0-9]{64}$' or email_hash !~ '^[a-f0-9]{64}$' or phone_hash !~ '^[a-f0-9]{64}$' then raise exception 'Interest unavailable';end if;
 perform pg_advisory_xact_lock(hashtextextended('interest:'||channel,0));
 select * into o from public.outreach_opportunities where organization_id=ch.organization_id and request_key=(p->>'request_key')::uuid;
 if found then if o.details<>p->'details' or o.source_website<>ch.source_website then raise exception 'Retry differs';end if;return jsonb_build_object('accepted',true);end if;
 for h in select unnest(array[network,email_hash,phone_hash]) loop
  insert into private.outreach_interest_rate values(channel,h,date_trunc('hour',now()),1) on conflict(channel,fingerprint,bucket) do update set attempts=outreach_interest_rate.attempts+1 returning attempts into n;
  if n>(case when h=network then ch.network_hour_limit else ch.contact_hour_limit end) then return jsonb_build_object('accepted',false,'reason','rate');end if;
 end loop;
 insert into public.outreach_opportunities(organization_id,details,source_website,request_key,target_month) values(ch.organization_id,p->'details',ch.source_website,(p->>'request_key')::uuid,p->'details'->>'preferred_months') returning * into o;
 perform private.outreach_audit(null,ch.organization_id,'outreach.opportunity.submitted',o.id);
 insert into public.outreach_campaign_events(organization_id,kind,subject_id,event_key) values(ch.organization_id,'outreach.opportunity.submitted',o.id,'interest:'||o.id);
 return jsonb_build_object('accepted',true);end$$;
create function public.outreach_interest_gateway(p_channel text,p_payload jsonb,p_network text,p_email_hash text,p_phone_hash text) returns jsonb language sql security invoker set search_path='' as $$select private.phasef_interest_gateway(p_channel,p_payload,p_network,p_email_hash,p_phone_hash)$$;

create function private.phasef_blockers(c uuid) returns jsonb language plpgsql stable security definer set search_path='' as $$
 declare x public.outreach_campaigns;s public.outreach_campaign_steps;d public.outreach_campaign_documents;b jsonb:='[]';k text;begin
 select * into x from public.outreach_campaigns where id=c;
 if exists(select 1 from public.outreach_campaign_steps where campaign_id=c and definition->>'completion_rule'='approved_agreement') and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then b:=b||jsonb_build_array('Current agreement approval required');end if;
 if x.event_start is null or x.registration_start is null or x.event_end is null or length(btrim(coalesce(x.settings->>'setup_arrival','')))=0 or length(coalesce(x.venue->>'site_name',''))=0 or length(coalesce(x.venue->>'address',''))=0 then b:=b||jsonb_build_array('Event location and timeline incomplete');end if;
 if x.status in ('postponed','cancelled','closed','completed') then b:=b||jsonb_build_array('Campaign is '||x.status);end if;
 for s in select * from public.outreach_campaign_steps where campaign_id=c and coalesce((definition->>'required')::boolean,true) and coalesce(definition->>'category','') not in ('final_readiness','final_packet','event_day','post_event') loop
  if private.outreach_step_state(c,s.step_key) not in ('completed','not_applicable') then b:=b||jsonb_build_array('Task: '||(s.definition->>'title'));end if;
  if s.reconfirmation_required then b:=b||jsonb_build_array('Reconfirm: '||(s.definition->>'title'));end if;
 end loop;
 if coalesce(x.settings->>'training_gate','required')='required' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c and required) or exists(select 1 from public.outreach_campaign_training where campaign_id=c and required and state<>'completed')) then b:=b||jsonb_build_array('Required training incomplete');end if;
 for k in select unnest(array['permits','insurance']) loop
  if coalesce(x.settings->'workflow_inputs'->>(k||'_required'),'unknown')='unknown' then b:=b||jsonb_build_array(initcap(k)||' requirement unknown');
  elsif x.settings->'workflow_inputs'->>(k||'_required')='yes' and not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=k and status='approved' and (expires_at is null or expires_at>x.event_start)) then b:=b||jsonb_build_array(initcap(k)||' approval missing or expired');end if;
 end loop;
 for d in select * from public.outreach_campaign_documents where campaign_id=c and phase_f and replaces_id is null and status in ('requested','uploaded','needs_changes','rejected') and category in ('site_layout','production_packet') loop
  if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=d.category and status='approved' and (expires_at is null or expires_at>x.event_start)) then b:=b||jsonb_build_array('Document: '||d.title);end if;
 end loop;
 if not coalesce((x.settings->'workflow_inputs'->>'personnel_final')::boolean,false) then b:=b||jsonb_build_array('Personnel not finalized');end if;
 if not coalesce((x.settings->'workflow_inputs'->>'inventory_confirmed')::boolean,false) then b:=b||jsonb_build_array('Inventory not confirmed');end if;
 return b;end$$;
create function private.phasef_reminders(c uuid) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare x public.outreach_campaigns;s public.outreach_campaign_steps;offset_day int;item jsonb;due timestamptz;kind text;key text;id uuid;roles jsonb;count_new int:=0;begin
 select * into x from public.outreach_campaigns where id=c for update;
 update public.outreach_task_reminders r set state='superseded' from public.outreach_campaign_steps s where r.campaign_id=c and s.id=r.step_id and r.state='pending' and (s.due_at is distinct from r.due_snapshot or (s.status='completed' and not s.reconfirmation_required and r.kind<>'stale') or private.outreach_step_state(c,s.step_key)='not_applicable' or x.status in ('postponed','cancelled','closed','completed'));
 if x.status in ('postponed','cancelled','closed','completed') then return jsonb_build_object('created',0,'provider_connected',false);end if;
 for s in select * from public.outreach_campaign_steps where campaign_id=c and status<>'completed' and due_at is not null loop
  if private.outreach_step_state(c,s.step_key) not in ('ready','overdue') then continue;end if;
  for offset_day in select jsonb_array_elements_text(coalesce(s.definition->'reminder_offsets','[14,7,3,1,0,-7]'))::int loop
   due:=s.due_at-make_interval(days=>offset_day);kind:=case when offset_day>0 then 'upcoming' when offset_day=0 then 'due' when offset_day=-1 then 'overdue' else 'repeated_overdue' end;
   key:=s.id||':'||s.due_at||':'||kind||':'||offset_day;
   insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,assigned_user_id,recipient_roles) values(c,s.id,key,kind,due,s.due_at,s.assigned_user_id,jsonb_build_array(s.assigned_role)) on conflict(reminder_key) do nothing returning outreach_task_reminders.id into id;
   if id is not null then count_new:=count_new+1;end if;
  end loop;
  for item in select value from jsonb_array_elements(coalesce(s.definition->'escalations','[]')) loop
   due:=s.due_at+make_interval(days=>(item->>'after_days')::int);key:=s.id||':'||s.due_at||':escalation:'||(item->>'after_days');
   insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles) values(c,s.id,key,'escalation',due,s.due_at,item->'roles') on conflict(reminder_key) do nothing;
  end loop;
 end loop;
 -- Reconfirmation and expired-document work stays visible even after prior task completion.
 for s in select * from public.outreach_campaign_steps where campaign_id=c and reconfirmation_required loop
  insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles,assigned_user_id) values(c,s.id,s.id||':stale:'||s.revision,'stale',now(),s.due_at,jsonb_build_array(s.assigned_role),s.assigned_user_id) on conflict(reminder_key) do nothing;
 end loop;
 for item in select to_jsonb(d) from public.outreach_campaign_documents d where d.campaign_id=c and d.phase_f and d.status='approved' and d.expires_at<=coalesce(x.event_start,now()) loop
  select * into s from public.outreach_campaign_steps z where z.campaign_id=c order by coalesce(z.definition->'required_documents' ? (item->>'category'),false) desc,z.position limit 1;
  if found then insert into public.outreach_task_reminders(campaign_id,step_id,reminder_key,kind,scheduled_at,due_snapshot,recipient_roles) values(c,s.id,(item->>'id')||':expiry:'||(item->>'expires_at'),'stale',least(now(),(item->>'expires_at')::timestamptz),s.due_at,jsonb_build_array(s.assigned_role)) on conflict(reminder_key) do nothing;end if;
 end loop;
 -- Only materialize due hooks once; future rows remain pending. No delivery claim.
 for item in select to_jsonb(r) from public.outreach_task_reminders r where r.campaign_id=c and r.state='pending' and r.scheduled_at<=now() loop
  kind:=case when item->>'kind'='escalation' then 'outreach.task.escalated' when item->>'kind' in ('overdue','repeated_overdue') then 'outreach.task.overdue' else 'outreach.task.due' end;
  perform private.outreach_event(c,kind,(item->>'step_id')::uuid,'reminder:'||(item->>'id'));
 end loop;
 if x.event_start is not null and now()>=x.event_start-make_interval(days=>coalesce((x.settings->>'details_due_days')::int,30)) and (x.venue->>'site_name' is null or x.registration_start is null) then perform private.outreach_event(c,'outreach.event_details.missing',c,c||':details:'||x.revision);end if;
 return jsonb_build_object('created',count_new,'provider_connected',false,'delivery_state','pending');end$$;
create function private.phasef_reschedule_guard() returns trigger language plpgsql security definer set search_path='' as $$begin
 if new.event_start is distinct from old.event_start or new.registration_start is distinct from old.registration_start or new.event_end is distinct from old.event_end or new.settings->>'setup_arrival' is distinct from old.settings->>'setup_arrival' or new.venue is distinct from old.venue then
  update public.outreach_campaign_steps set due_at=new.event_start+make_interval(days=>coalesce((definition->>'due_days')::int,0)),reconfirmation_required=true,updated_at=clock_timestamp(),revision=revision+1 where campaign_id=new.id and status='completed' and coalesce((definition->>'reconfirm_on_change')::boolean,false);
  update public.outreach_task_reminders set state='superseded' where campaign_id=new.id and state='pending';
  perform private.outreach_audit(new.id,new.organization_id,'outreach.schedule.changed',new.id,jsonb_build_object('old_event_start',old.event_start,'new_event_start',new.event_start,'venue_changed',new.venue is distinct from old.venue));
  perform private.outreach_event(new.id,'outreach.campaign.rescheduled',new.id,new.id||':reschedule:'||new.revision);
 end if;return new;end$$;
create trigger phasef_campaign_changed after update on public.outreach_campaigns for each row execute function private.phasef_reschedule_guard();

create function private.phasef_packet(c uuid,host boolean) returns jsonb language plpgsql stable security definer set search_path='' as $$declare x public.outreach_campaigns;r jsonb;begin
 select * into x from public.outreach_campaigns where id=c;
 r:=jsonb_build_object('campaign',jsonb_build_object('name',x.name,'country',x.country,'city',x.city,'date',x.event_start,'timezone',x.timezone,'registration_start',x.registration_start,'event_end',x.event_end,'setup_arrival',x.settings->>'setup_arrival','venue',x.venue,'status',x.status),
 'host_church',(select jsonb_build_object('name',o.name,'address',p.address,'phone',p.phone,'website',p.website) from public.organizations o left join public.outreach_host_profiles p on p.host_organization_id=o.id and p.owner_organization_id=x.organization_id where o.id=x.host_organization_id),
 'registration',jsonb_build_object('url',x.settings->>'public_registration_url','qr_request',x.settings->>'qr_request_state'),
 'documents',(select coalesce(jsonb_agg(jsonb_build_object('title',d.title,'category',d.category,'document_id',d.id,'version',d.version,'expires_at',d.expires_at)),'[]') from public.outreach_campaign_documents d where d.campaign_id=c and d.status='approved' and (not host or d.visibility in ('host_church','public_resource'))),
 'permits',x.settings->'workflow_inputs'->>'permits_state','insurance',x.settings->'workflow_inputs'->>'insurance_state',
 'contacts',(select coalesce(jsonb_agg(jsonb_build_object('role',a.role_key,'name',p.first_name||' '||p.last_name,'phone',p.phone,'email',p.email)),'[]') from public.outreach_campaign_contacts a join public.organization_people p on p.organization_id=a.organization_id and p.id=a.person_id where a.campaign_id=c and a.active and (not host or a.role_key in ('host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','logistics_lead'))),
 'production_notes',x.settings->>'production_notes','generated_from_revision',x.revision);
 if not host then
  r:=r||jsonb_build_object('personnel',(select coalesce(jsonb_agg(jsonb_build_object('name',m.first_name||' '||m.last_name,'role',r.role,'area',a.title)),'[]') from public.outreach_event_area_members r join public.outreach_team_members m on m.id=r.member_id join public.outreach_event_areas a on a.id=r.area_id where r.campaign_id=c and r.active),
  'inventory',(select coalesce(jsonb_agg(jsonb_build_object('item',item_name,'required',required_quantity,'available',available_quantity,'responsibility',source_owner)),'[]') from public.outreach_event_inventory where campaign_id=c),
  'meetups',(select coalesce(jsonb_agg(to_jsonb(m)-'campaign_id'-'id'-'revision'),'[]') from public.outreach_team_meetings m where campaign_id=c),
  'lodging',(select coalesce(jsonb_agg(to_jsonb(l)-'internal_notes'-'campaign_id'-'id'-'revision'),'[]') from public.outreach_team_lodgings l where campaign_id=c and active));
 end if;return r;end$$;

create or replace function private.outreach_step_state(p_campaign uuid,p_key text) returns text language plpgsql stable security definer set search_path='' as $$
declare s public.outreach_campaign_steps; c public.outreach_campaigns; dep text; value jsonb;
begin
 select * into s from public.outreach_campaign_steps where campaign_id=p_campaign and step_key=p_key;
 if not found then return 'blocked';end if;
 if s.definition->>'phase_f'='true' and s.reconfirmation_required then return 'awaiting_reconfirmation';end if;
 if s.status='completed' then return 'completed';end if;
 select * into c from public.outreach_campaigns where id=p_campaign;
 if coalesce((s.definition->>'active')::boolean,true)=false then return 'not_applicable';end if;
 if s.definition ? 'condition' then
  value:=c.settings->'workflow_inputs'->(s.definition->'condition'->>'field');
  if value is null then return 'awaiting_configuration';end if;
  if value<>s.definition->'condition'->'equals' then return 'not_applicable';end if;
 end if;
 for dep in select jsonb_array_elements_text(coalesce(s.definition->'depends_on','[]')) loop
  if private.outreach_step_state(p_campaign,dep) not in ('completed','not_applicable') then return 'blocked';end if;
 end loop;
 return case when s.due_at<now() then 'overdue' else 'ready' end;
end $$;
create function private.phasef_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 #variable_conflict use_column
 declare x public.outreach_campaigns;o public.outreach_opportunities;s public.outreach_campaign_steps;d public.outreach_campaign_documents;a public.outreach_campaign_agreements;v public.outreach_agreement_versions;packet public.outreach_campaign_packets;
 org uuid:=(p->>'organization_id')::uuid;id uuid;host_org uuid;coordinator uuid;item jsonb;rows jsonb;b jsonb;value jsonb;k text;host boolean;manage boolean;host_request boolean:=false;signature text;roles jsonb;begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>125000 then raise exception 'Invalid request';end if;
 if action='organizations' then return private.outreach_core('context',null,'{}');end if;
 if action in ('opportunities','opportunity_save','convert','agreement_publish','agreement_templates','workflow_publish','hosts') then
  if not private.outreach_admin(org,action not in ('opportunities','agreement_templates','hosts')) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if action='hosts' then return coalesce((select jsonb_agg(to_jsonb(h)||jsonb_build_object('name',o.name)) from public.outreach_host_profiles h join public.organizations o on o.id=h.host_organization_id where owner_organization_id=org),'[]');end if;
  if action='agreement_templates' then return coalesce((select jsonb_agg(to_jsonb(t) order by version desc) from public.outreach_agreement_versions t where organization_id=org),'[]');end if;
  if action='agreement_publish' then
   if private.phasef_field_schema_valid(p->'fields') is distinct from true or length(btrim(coalesce(p->>'approval_reason','')))<10 then raise exception 'Exact reviewed text and field schema required';end if;
   insert into public.outreach_agreement_versions(organization_id,template_key,version,title,text_snapshot,fields,source,created_by) values(org,p->>'template_key',(p->>'version')::int,p->>'title',p->>'text_snapshot',p->'fields',p->>'source',auth.uid()) returning * into v;
   perform private.outreach_audit(null,org,'outreach.agreement.published',v.id);return to_jsonb(v);
  end if;
  if action='workflow_publish' then
   if exists(select 1 from jsonb_array_elements(p->'steps') s where s->>'phase_f' is distinct from 'true') then raise exception 'Native pre-event workflow marker required';end if;
   return private.outreach_workflow('template_publish',null,p);end if;
  if action='opportunities' then return coalesce((select jsonb_agg(to_jsonb(t) order by created_at desc) from public.outreach_opportunities t where organization_id=org),'[]');end if;
  if action='opportunity_save' then
   if private.phasef_interest_valid(p->'details') is distinct from true or coalesce(p->>'stage','new') in ('approved','converted') then raise exception 'Explicit reviewed conversion required';end if;
   if p->>'assigned_owner' is not null and not private.staff_assignment_active(org,(p->>'assigned_owner')::uuid) then raise exception 'Owner unavailable';end if;
   if p->>'stage' in ('declined','future') and length(btrim(coalesce(p->>'disposition_reason','')))<3 then raise exception 'Disposition reason required';end if;
   if p->>'id' is null then
    insert into public.outreach_opportunities(organization_id,details,created_by,source_website) values(org,p->'details',auth.uid(),'manual') returning * into o;
   else
    select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=(p->>'id')::uuid for update;
    if not found or o.stage in ('approved','converted') or o.revision is distinct from (p->>'revision')::int then raise exception 'Opportunity changed';end if;
   end if;
   update public.outreach_opportunities set details=p->'details',stage=coalesce(p->>'stage',stage),assigned_owner=(p->>'assigned_owner')::uuid,next_action=coalesce(p->>'next_action',''),target_month=coalesce(p->>'target_month',p->'details'->>'preferred_months'),disposition_reason=coalesce(p->>'disposition_reason',''),updated_at=clock_timestamp(),revision=revision+1 where outreach_opportunities.id=o.id returning * into o;
   perform private.outreach_audit(null,org,'outreach.opportunity.stage_changed',o.id,jsonb_build_object('stage',o.stage,'revision',o.revision));return to_jsonb(o);
  end if;
  select * into o from public.outreach_opportunities where organization_id=org and outreach_opportunities.id=(p->>'id')::uuid for update;
  if not found then raise exception 'Opportunity unavailable' using errcode='42501';end if;
  select * into x from public.outreach_campaigns where opportunity_id=o.id;
  if found then return to_jsonb(x);end if;
  if not exists(select 1 from public.outreach_workflow_templates t where t.id=(p->>'template_id')::uuid and (t.organization_id is null or t.organization_id=org) and not exists(select 1 from jsonb_array_elements(t.steps) s where s->>'phase_f' is distinct from 'true')) then raise exception 'Published native pre-event workflow required';end if;
  if not exists(select 1 from pg_timezone_names where name=p->>'timezone') then raise exception 'Valid IANA timezone required';end if;
  if length(btrim(coalesce(p->>'identity_review_reason','')))<10 then raise exception 'Reviewed host identity required';end if;
  -- Reuse explicit reviewed canonical Organization ID; new host requires a new reviewed slug, never email matching.
  host_org:=(p->>'host_organization_id')::uuid;
  if host_org is null then
   if not coalesce((p->>'create_host_confirmed')::boolean,false) then raise exception 'Select reviewed host or explicitly confirm new host';end if;
   insert into public.organizations(slug,name,kind) values(p->>'new_host_slug',o.details->>'church_name','church') returning organizations.id into host_org;
  elsif not exists(select 1 from public.outreach_host_profiles where owner_organization_id=org and host_organization_id=host_org) then raise exception 'Reviewed host outside owner directory';end if;
  insert into public.outreach_host_profiles(owner_organization_id,host_organization_id,city,state_province,country,address,phone,website,reviewed_by) values(org,host_org,o.details->>'city',coalesce(o.details->>'state_province',''),o.details->>'country',coalesce(p->>'host_address',''),coalesce(o.details->>'phone',''),nullif(o.details->>'website',''),auth.uid()) on conflict(owner_organization_id,host_organization_id) do nothing;
  coordinator:=(p->>'coordinator_user_id')::uuid;
  if coordinator is not null and not private.staff_assignment_active(org,coordinator) then raise exception 'Coordinator outside active staff';end if;
  value:=private.phasef_previous_core('approve',null,p);c:=(value->>'id')::uuid;
  update public.outreach_campaigns set host_organization_id=host_org,event_start=(p->>'event_start')::timestamptz,settings=settings||jsonb_build_object('coordinator_user_id',coordinator,'phase_f',true),revision=revision+1 where outreach_campaigns.id=c returning * into x;
  update public.outreach_opportunities set stage='converted' where outreach_opportunities.id=o.id;
  perform private.outreach_event(c,'outreach.opportunity.approved',o.id,'f-approved:'||o.id);
  perform private.outreach_event(c,'outreach.campaign.created',c,'f-created:'||c);
  perform private.outreach_event(c,'outreach.agreement.requested',c,'f-agreement:'||c);
  perform private.outreach_event(c,'outreach.welcome.prepared',c,'f-welcome:'||c);
  return to_jsonb(x);
 end if;
 if action='campaigns' then
  return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name,'country',z.country,'region',z.state_province,'city',z.city,'status',z.status,'event_start',z.event_start,'timezone',z.timezone,'host_organization_id',z.host_organization_id,'host_name',h.name,'coordinator',z.settings->>'coordinator_user_id','ready',jsonb_array_length(private.phasef_blockers(z.id))=0,'overdue',(select count(*) from public.outreach_campaign_steps s where s.campaign_id=z.id and private.phasef_step_visible(z.id,s.id) and private.outreach_step_state(z.id,s.step_key)='overdue'),'workflow_percent',(select coalesce(round(100.0*count(*) filter(where private.outreach_step_state(z.id,s.step_key) in ('completed','not_applicable'))/nullif(count(*),0)),0) from public.outreach_campaign_steps s where s.campaign_id=z.id and private.phasef_step_visible(z.id,s.id))) order by z.event_start nulls last,z.name) from public.outreach_campaigns z left join public.organizations h on h.id=z.host_organization_id where private.phasef_can(z.id) or private.phasef_can(z.id,'host.view')),'[]');
 end if;
 select * into x from public.outreach_campaigns where id=c for update;
 if not found or not (private.phasef_can(c) or private.phasef_can(c,'host.view')) then raise exception 'Campaign access denied' using errcode='42501';end if;
 host:=private.phasef_host(c);manage:=private.phasef_can(c,'preevent.manage');
 if action='context' then
  b:=private.phasef_blockers(c);
  return jsonb_build_object('campaign',jsonb_build_object('id',c,'name',x.name,'status',x.status,'event_start',x.event_start,'registration_start',x.registration_start,'event_end',x.event_end,'setup_arrival',x.settings->>'setup_arrival','timezone',x.timezone,'city',x.city,'country',x.country,'venue',x.venue,'revision',x.revision,'organization_id',x.organization_id,'host_organization_id',x.host_organization_id,'host_name',(select name from public.organizations where id=x.host_organization_id)),
   'host_profile',(select to_jsonb(h)-'reviewed_by' from public.outreach_host_profiles h where h.owner_organization_id=x.organization_id and h.host_organization_id=x.host_organization_id),
   'assignments',case when private.outreach_admin(x.organization_id,true) then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'role',a.role_key,'email',u.email,'active',a.active)),'[]') from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c) else '[]'::jsonb end,
   'comments',(select coalesce(jsonb_agg(jsonb_build_object('step_id',z.step_id,'body',z.body,'created_at',z.created_at) order by z.created_at),'[]') from public.outreach_campaign_step_comments z where z.campaign_id=c and private.phasef_step_visible(c,z.step_id)),
   'host',host,'manage',manage,'respond',manage or private.phasef_can(c,'host.respond'),'inputs',x.settings->'workflow_inputs','settings',case when host then null else x.settings end,'training_gate',coalesce(x.settings->>'training_gate','required'),'registration_url',x.settings->>'public_registration_url','flyer',x.settings->'flyer',
   'blockers',case when host then (select coalesce(jsonb_agg('Task: '||(s.definition->>'title')),'[]') from public.outreach_campaign_steps s where s.campaign_id=c and private.phasef_step_visible(c,s.id) and (s.reconfirmation_required or private.outreach_step_state(c,s.step_key) not in ('completed','not_applicable'))) else b end,
   'ready',jsonb_array_length(b)=0,'packet_due_at',x.event_start-make_interval(days=>coalesce((x.settings->>'packet_due_days')::int,14)),
   'steps',(select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('state',private.outreach_step_state(c,s.step_key)) order by position),'[]') from public.outreach_campaign_steps s where s.campaign_id=c and private.phasef_step_visible(c,s.id)),
   'documents',(select coalesce(jsonb_agg(to_jsonb(d) order by created_at desc),'[]') from public.outreach_campaign_documents d where d.campaign_id=c and private.phasef_doc_visible(c,d.id)),
   'resources',(select coalesce(jsonb_agg(to_jsonb(r)),'[]') from public.outreach_campaign_resources r where r.campaign_id=c and (not host or r.visibility in ('host_church','public_resource'))),
   'training',(select coalesce(jsonb_agg(to_jsonb(t)||jsonb_build_object('title',r.title,'url',r.source_url)),'[]') from public.outreach_campaign_training t join public.outreach_campaign_resources r on r.id=t.resource_id where t.campaign_id=c and (not host or t.assigned_user_id=auth.uid())),
   'agreement_version',(select to_jsonb(t) from public.outreach_agreement_versions t where t.organization_id=x.organization_id and t.id=(x.settings->>'agreement_version_id')::uuid),
   'agreements',(select coalesce(jsonb_agg(to_jsonb(a) order by version desc),'[]') from public.outreach_campaign_agreements a where a.campaign_id=c),
   'contacts',private.phasef_packet(c,host)->'contacts',
   'reminders',case when host then '[]'::jsonb else (select coalesce(jsonb_agg(to_jsonb(r) order by scheduled_at),'[]') from public.outreach_task_reminders r where campaign_id=c and state='pending') end,
   'events',case when host then '[]'::jsonb else (select coalesce(jsonb_agg(jsonb_build_object('id',e.id,'kind',e.kind,'delivery_state',e.delivery_state,'created_at',e.created_at) order by created_at desc),'[]') from public.outreach_campaign_events e where campaign_id=c) end,
   'packets',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'version',t.version,'state',t.state,'generated_at',t.generated_at,'current',t.campaign_revision=x.revision) order by version desc),'[]') from public.outreach_campaign_packets t where t.campaign_id=c),
   'team_ready',case when host then null else exists(select 1 from public.outreach_team_members where campaign_id=c and status='approved') end,
   'event_day_ready',case when host then null else exists(select 1 from public.outreach_event_areas where campaign_id=c and status='ready') end);
 end if;
 if action in ('packet_preview','packet_read') then
  if action='packet_preview' then return jsonb_build_object('snapshot',private.phasef_packet(c,host),'blockers',case when host then '[]'::jsonb else private.phasef_blockers(c) end);end if;
  select * into packet from public.outreach_campaign_packets where campaign_id=c and outreach_campaign_packets.id=(p->>'id')::uuid;
  if not found then raise exception 'Packet unavailable' using errcode='42501';end if;
  return jsonb_build_object('snapshot',case when host then packet.host_snapshot else packet.snapshot end,'generated_at',packet.generated_at,'version',packet.version,'current',packet.campaign_revision=x.revision);
 end if;
 if action='agreement_submit' then
  if not manage and not private.phasef_can(c,'host.respond') then raise exception 'Agreement access denied' using errcode='42501';end if;
  select * into v from public.outreach_agreement_versions where organization_id=x.organization_id and outreach_agreement_versions.id=(x.settings->>'agreement_version_id')::uuid;
  if not found then raise exception 'Reviewed agreement not configured; exact source mapping pending';end if;
  select * into a from public.outreach_campaign_agreements where campaign_id=c and request_key=(p->>'request_key')::uuid;
  if found then if a.responses<>p->'responses' or a.signature_name<>p->>'signature_name' or a.submitted_by<>auth.uid() or a.agreement_version_id<>v.id or (p->>'acknowledged')::boolean is distinct from true then raise exception 'Agreement retry differs';end if;return to_jsonb(a);end if;
  if exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=v.id and status in ('submitted','approved')) then raise exception 'Current agreement already submitted';end if;
  if private.phasef_fields_valid(v.fields,p->'responses') is distinct from true then raise exception 'Agreement answers invalid';end if;
  insert into public.outreach_campaign_agreements(campaign_id,organization_id,agreement_version_id,request_key,version,text_snapshot,fields_snapshot,responses,signature_name,acknowledged,submitted_by,source)
  values(c,x.organization_id,v.id,(p->>'request_key')::uuid,coalesce((select max(version)+1 from public.outreach_campaign_agreements where campaign_id=c),1),v.text_snapshot,v.fields,p->'responses',p->>'signature_name',(p->>'acknowledged')::boolean,auth.uid(),v.source) returning * into a;
  perform private.outreach_audit(c,x.organization_id,'outreach.agreement.submitted',a.id,jsonb_build_object('version',a.version));return to_jsonb(a);
 end if;
 if action='training_status' then
  if not manage and not private.phasef_can(c,'host.respond') then raise exception 'Training response denied' using errcode='42501';end if;
  update public.outreach_campaign_training set state=p->>'state',viewed_at=coalesce(viewed_at,now()),completed_at=case when p->>'state'='completed' then coalesce(completed_at,now()) else completed_at end where campaign_id=c and outreach_campaign_training.id=(p->>'id')::uuid and assigned_user_id=auth.uid() and (state<>'completed' or p->>'state'='completed') and p->>'state' in ('viewed','completed') returning outreach_campaign_training.id into id;
  if not found then raise exception 'Own training unavailable' using errcode='42501';end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.training.'||(p->>'state'),id);
  if p->>'state'='completed' then perform private.outreach_event(c,'outreach.training.completed',id,'f-training-complete:'||id);end if;return jsonb_build_object('saved',true);
 end if;
 if action='document_uploaded' then
  select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'id')::uuid;
  if not found or not private.phasef_doc_visible(c,d.id) or (not manage and (not private.phasef_can(c,'host.respond') or d.requested_from<>auth.uid())) then raise exception 'Document access denied' using errcode='42501';end if;
  if d.status<>'requested' then return to_jsonb(d);end if;
  select metadata into item from storage.objects where bucket_id='outreach-campaign-documents' and name=d.object_path;
  if item is null or coalesce((item->>'size')::bigint,0) not between 1 and 10485760 or coalesce(item->>'mimetype','')<>all(array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then raise exception 'Uploaded file unavailable';end if;
  update public.outreach_campaign_documents set status='uploaded',uploaded_at=now(),byte_size=(item->>'size')::bigint,mime_type=item->>'mimetype',revision=revision+1 where outreach_campaign_documents.id=d.id returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.uploaded',d.id);perform private.outreach_event(c,'outreach.document.uploaded',d.id,'f-doc-upload:'||d.id);return to_jsonb(d);
 end if;
 if action in ('step_complete','step_reopen','step_comment','step_reconfirm') then
  select * into s from public.outreach_campaign_steps where campaign_id=c and outreach_campaign_steps.id=(p->>'id')::uuid;
  if not found or not private.phasef_step_visible(c,s.id) or (not manage and (not private.phasef_can(c,'host.respond') or s.assigned_user_id is distinct from auth.uid())) then raise exception 'Task access denied' using errcode='42501';end if;
  if action='step_complete' and s.status='completed' then return to_jsonb(s);end if;
  if s.revision is distinct from (p->>'revision')::int then raise exception 'Task changed';end if;
  if action='step_comment' then insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) values(c,s.id,auth.uid(),p->>'body');
  elsif action='step_reopen' then
   if not manage or length(btrim(coalesce(p->>'note','')))<10 then raise exception 'Manager reopen reason required';end if;
   update public.outreach_campaign_steps set status='reopened',revision=revision+1,updated_at=now() where outreach_campaign_steps.id=s.id;
  elsif action='step_reconfirm' then
   if s.definition->>'completion_rule'='approved_agreement' and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Current approved agreement required';end if;
   if length(btrim(coalesce(p->>'note','')))<10 then raise exception 'Reconfirmation note required';end if;
   update public.outreach_campaign_steps set reconfirmation_required=false,reconfirmed_at=now(),revision=revision+1,updated_at=now() where outreach_campaign_steps.id=s.id;
  else
   if private.outreach_step_state(c,s.step_key) not in ('ready','overdue') then raise exception 'Task prerequisites incomplete';end if;
   if coalesce((s.definition->>'approval_required')::boolean,false) and not manage then raise exception 'Task requires manager approval' using errcode='42501';end if;
   if s.definition->>'completion_rule'='approved_agreement' and not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Approved agreement required';end if;
   if s.definition->>'completion_rule'='assigned_training_complete' and coalesce(x.settings->>'training_gate','required')='required' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c and required) or exists(select 1 from public.outreach_campaign_training where campaign_id=c and required and state<>'completed')) then raise exception 'Required training incomplete';end if;
   if s.definition->>'completion_rule'='packet_generated' and not exists(select 1 from public.outreach_campaign_packets where campaign_id=c and campaign_revision=x.revision) then raise exception 'Current packet required';end if;
   if s.definition->>'completion_rule'='final_readiness' and jsonb_array_length(private.phasef_blockers(c))>0 then raise exception 'Readiness blockers remain';end if;
   for k in select jsonb_array_elements_text(coalesce(s.definition->'required_documents','[]')) loop if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and category=k and status='approved' and (expires_at is null or expires_at>coalesce(x.event_start,now()))) then raise exception 'Approved document required: %',k;end if;end loop;
   for k in select jsonb_array_elements_text(coalesce(s.definition->'required_fields','[]')) loop if coalesce(x.settings->'workflow_inputs'->>k,x.venue->>k,to_jsonb(x)->>k,'')='' or (k in ('personnel_final','inventory_confirmed') and x.settings->'workflow_inputs'->>k is distinct from 'true') then raise exception 'Required field: %',k;end if;end loop;
   update public.outreach_campaign_steps set status='completed',completed_by=auth.uid(),completed_at=now(),completion_note=coalesce(p->>'note',''),updated_at=now(),revision=revision+1 where outreach_campaign_steps.id=s.id;
   perform private.outreach_event(c,'workflow.step_completed',s.id,'f-complete:'||s.id||':'||(s.revision+1));
  end if;
  if action in ('step_reopen','step_reconfirm') then update public.outreach_campaigns set revision=revision+1 where outreach_campaigns.id=c;end if;
  perform private.outreach_event(c,'outreach.final_readiness.changed',s.id,'f-readiness:'||s.id||':'||action||':'||(s.revision+1));
  perform private.outreach_audit(c,x.organization_id,'outreach.task.'||action,s.id,jsonb_build_object('revision',s.revision+1));return jsonb_build_object('saved',true);
 end if;
 if action='host_information' then
  if not private.phasef_can(c,'host.respond') then raise exception 'Host response required' using errcode='42501';end if;
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['revision','venue','registration_start','event_end','setup_arrival','workflow_inputs'])) or jsonb_typeof(p->'venue') is distinct from 'object' or exists(select 1 from jsonb_each(p->'venue') z where z.key<>all(array['site_name','address','load_in_route','parking_notes']) or jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>2000) or jsonb_typeof(p->'workflow_inputs') is distinct from 'object' or exists(select 1 from jsonb_object_keys(p->'workflow_inputs') k where k<>all(array['flyers','bikes_enabled','tablets_enabled','bikes_quantity','tablets_quantity','bikes_responsibility','tablets_responsibility','permits_required','insurance_required','semi_parking','box_truck_parking','bus_rv_staging'])) then raise exception 'Only host event responses permitted';end if;
  if not exists(select 1 from public.outreach_campaign_agreements where campaign_id=c and agreement_version_id=(x.settings->>'agreement_version_id')::uuid and status='approved') then raise exception 'Approved agreement required before event responses';end if;
  p:=p||jsonb_build_object('workflow_inputs',coalesce(x.settings->'workflow_inputs','{}')||(p->'workflow_inputs'),'venue',x.venue||(p->'venue'));host_request:=true;action:='configure';
 end if;
 if not manage and not host_request then raise exception 'Pre-event management required' using errcode='42501';end if;
 if action='agreement_review' then
  select * into a from public.outreach_campaign_agreements where campaign_id=c and outreach_campaign_agreements.id=(p->>'id')::uuid;
  if not found or a.revision is distinct from (p->>'revision')::int or a.status<>'submitted' then raise exception 'Agreement review changed';end if;
  if p->>'status' not in ('approved','rejected','needs_changes') or (p->>'status'<>'approved' and length(btrim(coalesce(p->>'note','')))<3) then raise exception 'Review reason required';end if;
  update public.outreach_campaign_agreements set status=p->>'status',reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p->>'note',''),revision=revision+1 where outreach_campaign_agreements.id=a.id returning * into a;
  perform private.outreach_audit(c,x.organization_id,'outreach.agreement.reviewed',a.id,jsonb_build_object('status',a.status));
  if a.status='approved' then perform private.outreach_event(c,'outreach.agreement.completed',a.id,'f-agreement-approved:'||a.id);end if;return to_jsonb(a);
 elsif action='configure' then
  if exists(select 1 from jsonb_object_keys(p) k where k<>all(array['revision','workflow_inputs','venue','event_start','event_end','registration_start','public_registration_url','training_gate','packet_due_days','details_due_days','agreement_version_id','production_notes','setup_arrival','flyer','qr_request_state'])) then raise exception 'Unsupported configuration';end if;
  if x.revision is distinct from (p->>'revision')::int then raise exception 'Campaign changed';end if;
  value:=coalesce(p->'workflow_inputs',x.settings->'workflow_inputs','{}');
  if private.phasef_inputs_valid(value) is distinct from true then raise exception 'Invalid operational inputs';end if;
  if p ? 'public_registration_url' and p->>'public_registration_url'<>'' and p->>'public_registration_url' !~ '^https://[^[:space:]@]+$' then raise exception 'HTTPS registration URL required';end if;
  if p ? 'agreement_version_id' and not exists(select 1 from public.outreach_agreement_versions where organization_id=x.organization_id and outreach_agreement_versions.id=(p->>'agreement_version_id')::uuid) then raise exception 'Agreement outside organization';end if;
  if p ? 'training_gate' and p->>'training_gate' not in ('required','warning') then raise exception 'Invalid training gate';end if;
  if p ? 'packet_due_days' and (p->>'packet_due_days')::int not between 1 and 365 then raise exception 'Invalid packet deadline';end if;
  if p ? 'details_due_days' and (p->>'details_due_days')::int not between 1 and 365 then raise exception 'Invalid detail deadline';end if;
  if p ? 'agreement_version_id' and p->>'agreement_version_id' is distinct from x.settings->>'agreement_version_id' then update public.outreach_campaign_steps set reconfirmation_required=true,revision=revision+1 where campaign_id=c and status='completed' and definition->>'completion_rule'='approved_agreement';end if;
  update public.outreach_campaigns set settings=settings||jsonb_build_object('workflow_inputs',value)|| (p-array['revision','workflow_inputs','venue','event_start','event_end','registration_start','status']),
  venue=coalesce(p->'venue',venue),event_start=case when p ? 'event_start' then (p->>'event_start')::timestamptz else event_start end,event_end=case when p ? 'event_end' then (p->>'event_end')::timestamptz else event_end end,registration_start=case when p ? 'registration_start' then (p->>'registration_start')::timestamptz else registration_start end,revision=revision+1 where outreach_campaigns.id=c returning * into x;
  for k in select unnest(array['bikes','tablets']) loop
   if value->>(k||'_responsibility')='champion_sowgo' and coalesce((value->>(k||'_enabled'))::boolean,false) then
    perform private.outreach_event(c,'outreach.cost_impact_detected',c,c||':cost:'||k||':'||x.revision);
    insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) select c,s.id,auth.uid(),initcap(k)||' purchase/transport requires coordinator action. Quantity: '||coalesce(value->>(k||'_quantity'),'unknown')||'. Cost impact: unknown; resolution pending.' from public.outreach_campaign_steps s where s.campaign_id=c and s.step_key='procurement';
   end if;
  end loop;
  if length(coalesce(x.settings->>'public_registration_url',''))>0 and x.registration_start is not null and length(coalesce(x.venue->>'site_name',''))>0 then perform private.outreach_event(c,'outreach.registration.qr_requested',c,c||':qr:'||x.revision);end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.pre_event.configured',c);return to_jsonb(x);
 elsif action in ('reschedule','postpone') then
  if x.revision is distinct from (p->>'revision')::int or length(btrim(coalesce(p->>'reason','')))<3 then raise exception 'Current revision and reason required';end if;
  if action='reschedule' and p->>'event_start' is null then raise exception 'New date required';end if;
  update public.outreach_campaigns set status=case when action='postpone' then 'postponed' else 'rescheduled' end,event_start=case when action='reschedule' then (p->>'event_start')::timestamptz else event_start end,event_end=case when action='reschedule' then (p->>'event_end')::timestamptz else event_end end,registration_start=case when action='reschedule' then (p->>'registration_start')::timestamptz else registration_start end,settings=settings||jsonb_build_object('schedule_reason',p->>'reason','postpone_reason_kind',coalesce(p->>'reason_kind','other')),revision=revision+1 where outreach_campaigns.id=c returning * into x;
  if action='postpone' then perform private.outreach_event(c,'outreach.campaign.postponed',c,c||':postponed:'||x.revision);end if;
  perform private.outreach_audit(c,x.organization_id,'outreach.campaign.'||action,c);perform private.phasef_reminders(c);return to_jsonb(x);
 elsif action='host_profile_save' then
  update public.outreach_host_profiles set address=coalesce(p->>'address',address),phone=coalesce(p->>'phone',phone),website=nullif(p->>'website',''),reviewed_by=auth.uid(),reviewed_at=now(),revision=revision+1 where owner_organization_id=x.organization_id and host_organization_id=x.host_organization_id and revision=(p->>'revision')::int;
  if not found then raise exception 'Host profile changed';end if;perform private.outreach_audit(c,x.organization_id,'outreach.host.reviewed',x.host_organization_id);return jsonb_build_object('saved',true);
 elsif action='reminders' then return private.phasef_reminders(c);
 elsif action='reminder_acknowledge' then
  update public.outreach_task_reminders set state='acknowledged' where campaign_id=c and outreach_task_reminders.id=(p->>'id')::uuid and state='pending' returning outreach_task_reminders.id into id;
  if id is not null then perform private.outreach_audit(c,x.organization_id,'outreach.reminder.acknowledged',id);end if;return jsonb_build_object('saved',id is not null);
 elsif action='step_assign' then
  if p->>'user_id' is not null and not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'user_id')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) then raise exception 'Assignee outside campaign';end if;
  update public.outreach_campaign_steps set assigned_user_id=(p->>'user_id')::uuid,priority=coalesce(p->>'priority','normal'),revision=revision+1,updated_at=now() where campaign_id=c and outreach_campaign_steps.id=(p->>'id')::uuid and revision=(p->>'revision')::int;
  if not found then raise exception 'Task changed';end if;perform private.outreach_audit(c,x.organization_id,'outreach.task.assigned',(p->>'id')::uuid);return jsonb_build_object('saved',true);
 elsif action='document_request' then
  if p->>'requested_from' is not null and not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'requested_from')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) then raise exception 'Requested account outside campaign';end if;
  if p->>'visibility'='restricted' and not private.outreach_admin(x.organization_id,true) then raise exception 'Restricted document requires administrator';end if;
  id:=gen_random_uuid();
  if p->>'replaces_id' is not null then select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'replaces_id')::uuid; if not found or not private.phasef_doc_visible(c,d.id) then raise exception 'Prior version outside campaign';end if;end if;
  insert into public.outreach_campaign_documents(id,campaign_id,category,title,requested_from,due_at,visibility,replaces_id,version,object_path,phase_f,instructions,expires_at) values(id,c,p->>'category',p->>'title',(p->>'requested_from')::uuid,(p->>'due_at')::timestamptz,coalesce(d.visibility,p->>'visibility','host_church'),d.id,coalesce(d.version+1,1),c||'/'||id||'/file',true,coalesce(p->>'instructions',''),(p->>'expires_at')::timestamptz) returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.requested',id);perform private.outreach_event(c,'outreach.document.requested',id,'f-doc-request:'||id);return to_jsonb(d);
 elsif action='document_review' then
  select * into d from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'id')::uuid;
  if not found or not d.phase_f or not private.phasef_doc_visible(c,d.id) or d.status<>'uploaded' or d.revision is distinct from (p->>'revision')::int then raise exception 'Document review changed';end if;
  if p->>'status' not in ('approved','rejected','needs_changes') or (p->>'status'<>'approved' and length(btrim(coalesce(p->>'note','')))<3) then raise exception 'Review reason required';end if;
  update public.outreach_campaign_documents set status=p->>'status',reviewed_by=auth.uid(),reviewed_at=now(),review_note=coalesce(p->>'note',''),revision=revision+1 where outreach_campaign_documents.id=d.id returning * into d;
  perform private.outreach_audit(c,x.organization_id,'outreach.document.reviewed',d.id,jsonb_build_object('status',d.status));if d.status='approved' then perform private.outreach_event(c,'outreach.document.approved',d.id,'f-doc-approved:'||d.id);end if;return to_jsonb(d);
 elsif action='training_assign' then
  if not exists(select 1 from public.outreach_campaign_assignments where campaign_id=c and user_id=(p->>'user_id')::uuid and active and effective_at<=now() and (expires_at is null or expires_at>now()) and private.outreach_verified(user_id)) or not exists(select 1 from public.outreach_campaign_resources where campaign_id=c and outreach_campaign_resources.id=(p->>'resource_id')::uuid and resource_type in ('training','packet') and capture_state='available') then raise exception 'Resource or assignee outside campaign';end if;
  insert into public.outreach_campaign_training(campaign_id,resource_id,assigned_user_id,assigned_role,required) values(c,(p->>'resource_id')::uuid,(p->>'user_id')::uuid,p->>'role',coalesce((p->>'required')::boolean,true)) on conflict(resource_id,assigned_user_id) do nothing returning outreach_campaign_training.id into id;
  if id is not null then perform private.outreach_event(c,'outreach.training.assigned',id,'f-training-assigned:'||id);perform private.outreach_audit(c,x.organization_id,'outreach.training.assigned',id);end if;return jsonb_build_object('saved',true);
 elsif action='resource_save' then
  if p->>'source_url' is not null and p->>'source_url' !~ '^https://[^[:space:]@]+$' then raise exception 'HTTPS resource required';end if;
  if p->>'document_id' is not null and not exists(select 1 from public.outreach_campaign_documents where campaign_id=c and outreach_campaign_documents.id=(p->>'document_id')::uuid and status='approved') then raise exception 'Approved campaign document required';end if;
  insert into public.outreach_campaign_resources(campaign_id,resource_key,title,resource_type,source_url,document_id,capture_state,visibility,version) values(c,p->>'resource_key',p->>'title',p->>'resource_type',p->>'source_url',(p->>'document_id')::uuid,'available',coalesce(p->>'visibility','host_church'),coalesce((p->>'version')::int,1)) returning outreach_campaign_resources.id into id;
  perform private.outreach_audit(c,x.organization_id,'outreach.resource.published',id);return jsonb_build_object('id',id);
 elsif action='packet_generate' then
  select * into packet from public.outreach_campaign_packets where campaign_id=c and generation_key=(p->>'generation_key')::uuid;
  if found then return jsonb_build_object('id',packet.id,'version',packet.version,'generated_at',packet.generated_at);end if;
  b:=private.phasef_blockers(c);if jsonb_array_length(b)>0 then raise exception 'Packet blocked: %',b;end if;
  insert into public.outreach_campaign_packets(campaign_id,generation_key,version,campaign_revision,state,snapshot,host_snapshot,generated_by) values(c,(p->>'generation_key')::uuid,coalesce((select max(version)+1 from public.outreach_campaign_packets where campaign_id=c),1),x.revision,case when exists(select 1 from public.outreach_campaign_packets where campaign_id=c) then 'updated' else 'final' end,private.phasef_packet(c,false),private.phasef_packet(c,true),auth.uid()) returning * into packet;
  perform private.outreach_audit(c,x.organization_id,'outreach.packet.generated',packet.id,jsonb_build_object('version',packet.version));perform private.outreach_event(c,'outreach.packet.ready',packet.id,'f-packet-ready:'||packet.id);perform private.outreach_event(c,'outreach.packet.generated',packet.id,'f-packet:'||packet.id);return jsonb_build_object('id',packet.id,'version',packet.version,'generated_at',packet.generated_at);
 end if;
 raise exception 'Unsupported pre-event action';end$$;
create function public.outreach_pre_event_workspace(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.phasef_workspace(p_action,p_campaign,p_payload)$$;

-- Route Phase F snapshots through the stronger completion gates, retaining legacy v1 behavior.
alter function private.outreach_workflow(text,uuid,jsonb) rename to phasef_previous_workflow;
create function private.outreach_workflow(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_action in ('complete','reopen','comment','assign') and exists(select 1 from public.outreach_campaign_steps where campaign_id=p_campaign and id=(p_payload->>'id')::uuid and definition->>'phase_f'='true') then
  return private.phasef_workspace(case p_action when 'complete' then 'step_complete' when 'reopen' then 'step_reopen' when 'comment' then 'step_comment' else 'step_assign' end,p_campaign,p_payload);
 end if;return private.phasef_previous_workflow(p_action,p_campaign,p_payload);end$$;
alter function private.outreach_core(text,uuid,jsonb) rename to phasef_previous_core;
create function private.outreach_core(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$begin
 if p_action='configure' and exists(select 1 from public.outreach_campaigns where id=p_campaign and settings->>'phase_f'='true') then return private.phasef_workspace('configure',p_campaign,coalesce(p_payload->'settings','{}')||(p_payload-'settings'));end if;
 if p_action='approve' and (exists(select 1 from public.outreach_workflow_templates where id=(p_payload->>'template_id')::uuid and steps->0->>'phase_f'='true') or exists(select 1 from public.outreach_campaigns where opportunity_id=(p_payload->>'id')::uuid and settings->>'phase_f'='true')) then
  return private.phasef_workspace('convert',null,p_payload);
 end if;
 return private.phasef_previous_core(p_action,p_campaign,p_payload);end$$;
-- Revoke renamed entry points: callers cannot sidestep native gates.
revoke all on function private.phasef_previous_core(text,uuid,jsonb),private.phasef_previous_workflow(text,uuid,jsonb) from public,anon,authenticated;
-- RLS and RPC-only relations; all signatures default-denied, then narrow grants.
do $$declare n text;r record;begin
 foreach n in array array['outreach_host_profiles','outreach_agreement_versions','outreach_campaign_agreements','outreach_task_reminders','outreach_campaign_packets','outreach_interest_channels'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
 for r in select p.oid::regprocedure fn from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname like 'phasef_%' loop execute format('revoke all on function %s from public,anon,authenticated',r.fn);end loop;
end$$;
revoke all on function public.outreach_interest_gateway(text,jsonb,text,text,text),public.outreach_pre_event_workspace(text,uuid,jsonb),private.outreach_core(text,uuid,jsonb),private.outreach_workflow(text,uuid,jsonb),private.outreach_template_valid(jsonb) from public,anon,authenticated;
grant execute on function private.phasef_workspace(text,uuid,jsonb),public.outreach_pre_event_workspace(text,uuid,jsonb),private.outreach_core(text,uuid,jsonb),private.outreach_workflow(text,uuid,jsonb) to authenticated;
grant execute on function private.phasef_interest_gateway(text,jsonb,text,text,text),public.outreach_interest_gateway(text,jsonb,text,text,text) to service_role;
-- Two configured consumers, disabled until separately approved deployment/abuse-control acceptance.
insert into public.outreach_interest_channels(slug,organization_id,source_website) select slug,id,case slug when 'sowgo' then 'https://sowgo.org' else 'https://championlifefwb.com' end from public.organizations where slug in ('champion-life','sowgo');

-- Immutable source-informed version 2. Existing campaign snapshots/seeds are untouched.
insert into public.outreach_workflow_templates(template_key,version,title,steps) values('outreach_source_workflow',2,'SowGo / Champion Life Pre-Event Workflow','[{"key": "host_setup", "title": "Host Church Contact Setup", "category": "host_setup", "role": "local_coordinator", "order": 10, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Host Church Contact Setup. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false}, {"key": "welcome", "title": "Welcome / Portal Access", "category": "welcome", "role": "outreach_coordinator", "order": 20, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Welcome / Portal Access. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["host_setup"]}, {"key": "agreement", "title": "Outreach Agreement & Pre-Checklist", "category": "agreement", "role": "host_pastor", "order": 30, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Outreach Agreement & Pre-Checklist. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["welcome"], "completion_rule": "approved_agreement", "approval_required": true, "required_form": "agreement", "signature_required": true}, {"key": "procurement", "title": "Cost / Procurement Decisions", "category": "procurement", "role": "outreach_coordinator", "order": 40, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Cost / Procurement Decisions. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"]}, {"key": "production", "title": "Production Packet", "category": "production", "role": "local_coordinator", "order": 50, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Production Packet. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"], "required_documents": ["production_packet"]}, {"key": "training", "title": "Training", "category": "training", "role": "host_pastor", "order": 60, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Training. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -45, "reconfirm_on_change": false, "depends_on": ["agreement"], "completion_rule": "assigned_training_complete"}, {"key": "event_details", "title": "Event Details", "category": "event_details", "role": "local_coordinator", "order": 70, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Event Details. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "venue", "title": "Venue / Site Information", "category": "venue", "role": "local_coordinator", "order": 80, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Venue / Site Information. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "required_documents": ["site_layout"], "required_fields": ["site_name", "address"]}, {"key": "permits", "title": "Permits", "category": "permits", "role": "local_coordinator", "order": 90, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Permits. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "permits_required", "equals": "yes"}, "required_documents": ["permits"]}, {"key": "insurance", "title": "Insurance", "category": "insurance", "role": "local_coordinator", "order": 100, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Insurance. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "insurance_required", "equals": "yes"}, "required_documents": ["insurance"]}, {"key": "flyers", "title": "Promotion / Flyers", "category": "promotion", "role": "local_coordinator", "order": 110, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Promotion / Flyers. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "condition": {"field": "flyers", "equals": true}, "required_documents": ["flyers"]}, {"key": "registration_qr", "title": "Public Registration / QR", "category": "registration", "role": "outreach_coordinator", "order": 120, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Public Registration / QR. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "team_travel", "title": "Team Signup / Travel", "category": "team", "role": "logistics_lead", "order": 130, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Team Signup / Travel. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"]}, {"key": "personnel_inventory", "title": "Personnel / Inventory", "category": "inventory", "role": "logistics_lead", "order": 140, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Personnel / Inventory. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -30, "reconfirm_on_change": true, "depends_on": ["agreement"], "required_fields": ["personnel_final", "inventory_confirmed"]}, {"key": "final_packet", "title": "Final Event Information Packet", "category": "final_packet", "role": "outreach_coordinator", "order": 150, "active": true, "required": true, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Final Event Information Packet. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -14, "reconfirm_on_change": true, "depends_on": ["event_details", "venue", "permits", "insurance", "personnel_inventory"], "completion_rule": "packet_generated"}, {"key": "final_readiness", "title": "Final Readiness", "category": "final_readiness", "role": "outreach_coordinator", "order": 160, "active": true, "required": true, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Final Readiness. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": -14, "reconfirm_on_change": true, "depends_on": ["final_packet"], "completion_rule": "final_readiness"}, {"key": "event_day", "title": "Event Day", "category": "event_day", "role": "internal_team", "order": 170, "active": true, "required": false, "phase_f": true, "visibility": "internal", "instructions": "Confirm and complete Event Day. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": 0, "reconfirm_on_change": false, "depends_on": ["final_readiness"]}, {"key": "post_event", "title": "Post-Event Follow-Up", "category": "post_event", "role": "local_coordinator", "order": 180, "active": true, "required": false, "phase_f": true, "visibility": "host_church", "instructions": "Confirm and complete Post-Event Follow-Up. Preserve canonical source history; contact the coordinator if information is missing.", "reminder_offsets": [14, 7, 3, 1, 0, -1, -7], "escalations": [{"after_days": 3, "roles": ["host_pastor", "outreach_coordinator"]}, {"after_days": 7, "roles": ["pastor_roddy", "internal_team"]}], "due_days": 0, "reconfirm_on_change": false, "depends_on": ["event_day"]}]'::jsonb);

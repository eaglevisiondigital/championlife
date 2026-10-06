-- Configurable snapshots and private document delivery; no scheduler/provider sends.
alter table public.outreach_workflow_templates add column organization_id uuid references public.organizations(id);
alter table public.outreach_workflow_templates drop constraint outreach_workflow_templates_template_key_version_key;
create unique index outreach_template_org_version_idx on public.outreach_workflow_templates(organization_id,template_key,version) where organization_id is not null;
create unique index outreach_template_global_version_idx on public.outreach_workflow_templates(template_key,version) where organization_id is null;
create table public.outreach_campaign_steps (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 step_key text not null, definition jsonb not null, position integer not null, status text not null default 'pending' check(status in ('pending','completed','reopened')),
 assigned_user_id uuid references auth.users(id), assigned_role text, due_at timestamptz,
 completion_note text not null default '' check(length(completion_note)<=2000), completed_at timestamptz, completed_by uuid references auth.users(id),
 revision integer not null default 1, unique(campaign_id,step_key), unique(campaign_id,id)
);
create index outreach_step_due_idx on public.outreach_campaign_steps(campaign_id,status,due_at);
create table public.outreach_campaign_step_comments (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, step_id uuid not null, actor_user_id uuid not null references auth.users(id),
 body text not null check(length(btrim(body)) between 1 and 2000), created_at timestamptz not null default now(),
 foreign key(campaign_id,step_id) references public.outreach_campaign_steps(campaign_id,id)
);
create table public.outreach_campaign_documents (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 category text not null check(category in ('agreements','production_packet','event_packet','flyers','qr_graphics','site_layout','venue_map','permits','insurance','lodging','transportation','personnel','inventory','training','photos','videos','other')),
 title text not null check(length(btrim(title)) between 1 and 160), requested_from uuid references auth.users(id), due_at timestamptz,
 visibility text not null default 'restricted' check(visibility in ('restricted','internal','public')),
 status text not null default 'requested' check(status in ('requested','uploaded')), replaces_id uuid, version integer not null default 1,
 object_path text unique not null, mime_type text, byte_size bigint check(byte_size between 1 and 10485760),
 created_at timestamptz not null default now(), uploaded_at timestamptz,
 unique(campaign_id,id), unique(replaces_id), foreign key(campaign_id,replaces_id) references public.outreach_campaign_documents(campaign_id,id)
);
create index outreach_document_campaign_idx on public.outreach_campaign_documents(campaign_id,visibility,status);
create table public.outreach_campaign_resources (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null references public.outreach_campaigns(id),
 resource_key text not null, title text not null, resource_type text not null check(resource_type in ('training','book','form','packet')),
 source_url text check(source_url ~ '^https://[^\s]+$'), document_id uuid, capture_state text not null check(capture_state in ('available','pending_field_capture','pending_asset')),
 field_schema jsonb, attribution text, unique(campaign_id,resource_key), unique(campaign_id,id),
 foreign key(campaign_id,document_id) references public.outreach_campaign_documents(campaign_id,id),
 check(capture_state<>'available' or source_url is not null or document_id is not null)
);
create table public.outreach_campaign_training (
 id uuid primary key default gen_random_uuid(), campaign_id uuid not null, resource_id uuid not null, assigned_user_id uuid not null references auth.users(id),
 state text not null default 'assigned' check(state in ('assigned','viewed','completed')), viewed_at timestamptz, completed_at timestamptz,
 foreign key(campaign_id,resource_id) references public.outreach_campaign_resources(campaign_id,id), unique(resource_id,assigned_user_id)
);
create function private.outreach_template_valid(p jsonb) returns boolean language plpgsql set search_path='' as $$
declare s jsonb; d text; seen text[]:='{}'; previous integer:=-1;
begin
 if jsonb_typeof(p)<>'array' or jsonb_array_length(p) not between 1 and 100 or octet_length(p::text)>100000 then return false;end if;
 for s in select value from jsonb_array_elements(p) loop
  if jsonb_typeof(s)<>'object' or coalesce(s->>'key','') !~ '^[a-z0-9_]{1,80}$' or s->>'key'=any(seen) or length(coalesce(s->>'title','')) not between 1 and 160 or length(coalesce(s->>'instructions',''))>6000 or coalesce((s->>'order')::int,-1)<=previous then return false;end if;
  if coalesce(s->>'role','other')<>all(array['host_pastor','local_coordinator','outreach_coordinator','pastor_roddy','internal_team','logistics_lead','local_leader','other']) then return false;end if;
  if exists(select 1 from jsonb_each(s) x where x.key in ('active','required','signature_required','approval_required') and jsonb_typeof(x.value)<>'boolean') then return false;end if;
  if s ? 'completion_rule' and s->>'completion_rule' not in ('manual','assigned_training_complete') then return false;end if;
  if s ? 'due_days' and (s->>'due_days')::int not between -3650 and 3650 then return false;end if;
  if s ? 'reminder_days' and (s->>'reminder_days')::int not between 1 and 365 then return false;end if;
  if s ? 'depends_on' and jsonb_typeof(s->'depends_on')<>'array' then return false;end if;
  for d in select jsonb_array_elements_text(coalesce(s->'depends_on','[]')) loop if not d=any(seen) then return false;end if;end loop;
  if s ? 'condition' and (jsonb_typeof(s->'condition')<>'object' or coalesce(s->'condition'->>'field','') !~ '^[a-z0-9_]{1,80}$' or not (s->'condition' ? 'equals')) then return false;end if;
  previous:=(s->>'order')::int;seen:=array_append(seen,s->>'key');
 end loop;return true;
 exception when others then return false;
end $$;
create function private.outreach_template_guard() returns trigger language plpgsql set search_path='' as $$
 begin if not private.outreach_template_valid(new.steps) then raise exception 'Invalid ordered workflow definition';end if;return new;end
$$;
create trigger outreach_template_valid before insert on public.outreach_workflow_templates for each row execute function private.outreach_template_guard();
-- Persist due times from the campaign's explicit instant, not browser/local timezone.
create function private.outreach_snapshot() returns trigger language plpgsql security definer set search_path='' as $$
declare t public.outreach_workflow_templates; s jsonb;
begin
 if not exists(select 1 from pg_catalog.pg_timezone_names where name=new.timezone) then raise exception 'Unknown timezone';end if;
 select * into t from public.outreach_workflow_templates where id=new.template_id;
 if t.organization_id is not null and t.organization_id<>new.organization_id then raise exception 'Template outside organization' using errcode='42501';end if;
 for s in select value from jsonb_array_elements(t.steps) loop
  insert into public.outreach_campaign_steps(campaign_id,step_key,definition,position,assigned_role,due_at)
  values(new.id,s->>'key',s,(s->>'order')::int,s->>'role',new.event_start+make_interval(days=>coalesce((s->>'due_days')::int,0)));
 end loop;
 perform private.outreach_audit(new.id,new.organization_id,'campaign.created',new.id,jsonb_build_object('template_id',t.id,'template_version',t.version));
 perform private.outreach_event(new.id,'campaign.created',new.id,new.id||':created');
 return new;
end $$;
create trigger outreach_campaign_snapshot after insert on public.outreach_campaigns for each row execute function private.outreach_snapshot();
create function private.outreach_campaign_guard() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 if new.organization_id<>old.organization_id or new.id<>old.id or new.code<>old.code or new.template_id<>old.template_id or new.opportunity_id is distinct from old.opportunity_id then raise exception 'Campaign identity and workflow snapshot cannot change';end if;
 if new.event_start is distinct from old.event_start then
  update public.outreach_campaign_steps set due_at=new.event_start+make_interval(days=>coalesce((definition->>'due_days')::int,0)),revision=revision+1 where campaign_id=old.id and status<>'completed';
 end if;return new;
 end
$$;
create trigger outreach_campaign_identity before update on public.outreach_campaigns for each row execute function private.outreach_campaign_guard();
create function private.outreach_step_guard() returns trigger language plpgsql set search_path='' as $$
 begin if new.campaign_id<>old.campaign_id or new.step_key<>old.step_key or new.definition<>old.definition or new.position<>old.position then raise exception 'Workflow snapshot is immutable';end if;return new;end
$$;
create trigger outreach_step_snapshot_guard before update on public.outreach_campaign_steps for each row execute function private.outreach_step_guard();
create trigger outreach_step_history_immutable before update or delete on public.outreach_campaign_step_comments for each row execute function private.outreach_immutable();
create function private.outreach_step_state(p_campaign uuid,p_key text) returns text language plpgsql stable security definer set search_path='' as $$
declare s public.outreach_campaign_steps; c public.outreach_campaigns; dep text; value jsonb;
begin
 select * into s from public.outreach_campaign_steps where campaign_id=p_campaign and step_key=p_key;
 if not found then return 'blocked';end if;
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
create function private.outreach_bridge() returns trigger language plpgsql security definer set search_path='' as $$
 begin
 insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,registered_at)
 select c.id,c.organization_id,new.id,new.created_at from public.outreach_campaign_sources s join public.outreach_campaigns c on c.id=s.campaign_id where s.source=new.source
 on conflict(legacy_registration_id) do nothing;return new;
 end
$$;
create trigger outreach_registration_campaign_bridge after insert on public.outreach_registrations for each row execute function private.outreach_bridge();
create function private.outreach_workflow(p_action text,p_campaign uuid,p_payload jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare c public.outreach_campaigns; s public.outreach_campaign_steps; doc public.outreach_campaign_documents; previous_doc public.outreach_campaign_documents;
 target_id uuid; item jsonb; dep text; missing integer; step_state text; result jsonb; t public.outreach_workflow_templates;
begin
 if not private.outreach_verified(auth.uid()) then raise exception 'Verified identity required' using errcode='42501';end if;
 if jsonb_typeof(p_payload)<>'object' or octet_length(p_payload::text)>125000 then raise exception 'Invalid request';end if;
 if p_action in ('templates','template_publish') then
  if not private.outreach_admin((p_payload->>'organization_id')::uuid,p_action='template_publish') then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if p_action='templates' then return coalesce((select jsonb_agg(to_jsonb(x) order by template_key,version) from public.outreach_workflow_templates x where x.organization_id is null or x.organization_id=(p_payload->>'organization_id')::uuid),'[]');end if;
  insert into public.outreach_workflow_templates(organization_id,template_key,version,title,steps) values((p_payload->>'organization_id')::uuid,p_payload->>'template_key',(p_payload->>'version')::int,p_payload->>'title',p_payload->'steps') returning * into t;return to_jsonb(t);
 end if;
 select * into c from public.outreach_campaigns where outreach_campaigns.id=p_campaign;
 if not found or not private.outreach_can(c.id) then raise exception 'Campaign access denied' using errcode='42501';end if;
 if p_action='list' then
  return jsonb_build_object('assignees',case when private.outreach_can(c.id,'workflow') then (select coalesce(jsonb_agg(jsonb_build_object('user_id',a.user_id,'email',u.email,'role',a.role_key)),'[]') from public.outreach_campaign_assignments a join auth.users u on u.id=a.user_id where a.campaign_id=c.id and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) else '[]'::jsonb end, 'comments',(select coalesce(jsonb_agg(jsonb_build_object('step_id',step_id,'body',body,'created_at',created_at) order by created_at),'[]') from public.outreach_campaign_step_comments where campaign_id=c.id and private.outreach_can(c.id,'workflow')), 'steps',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('state',private.outreach_step_state(c.id,x.step_key)) order by position),'[]') from public.outreach_campaign_steps x where campaign_id=c.id),
   'resources',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.outreach_campaign_resources x where campaign_id=c.id),
   'documents',(select coalesce(jsonb_agg(to_jsonb(x) order by created_at),'[]') from public.outreach_campaign_documents x where campaign_id=c.id and private.outreach_can(c.id,'documents') and (visibility<>'restricted' or private.outreach_admin(c.organization_id,true))),
   'training',(select coalesce(jsonb_agg(to_jsonb(x)),'[]') from public.outreach_campaign_training x where campaign_id=c.id and (assigned_user_id=auth.uid() or private.outreach_can(c.id,'workflow'))),
   'events',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'kind',kind,'delivery_state',delivery_state,'created_at',created_at,'acknowledged_at',acknowledged_at)),'[]') from public.outreach_campaign_events where campaign_id=c.id and private.outreach_can(c.id,'workflow')));
 elsif p_action='document_request' then
  if not private.outreach_can(c.id,'documents') then raise exception 'Document access denied' using errcode='42501';end if;
  if coalesce(p_payload->>'visibility','restricted')='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Restricted document requires administrator' using errcode='42501';end if;
  if p_payload->>'requested_from' is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'requested_from')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Requested account outside campaign';end if;
  target_id:=gen_random_uuid();
  if p_payload->>'replaces_id' is not null then select * into previous_doc from public.outreach_campaign_documents where campaign_id=c.id and outreach_campaign_documents.id=(p_payload->>'replaces_id')::uuid;
   if not found or previous_doc.visibility='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Prior version unavailable';end if;
  end if;
  insert into public.outreach_campaign_documents(id,campaign_id,category,title,requested_from,due_at,visibility,replaces_id,version,object_path)
  values(target_id,c.id,p_payload->>'category',p_payload->>'title',(p_payload->>'requested_from')::uuid,(p_payload->>'due_at')::timestamptz,coalesce(previous_doc.visibility,p_payload->>'visibility','restricted'),previous_doc.id,coalesce(previous_doc.version+1,1),c.id||'/'||target_id||'/file') returning * into doc;
  perform private.outreach_audit(c.id,c.organization_id,'document.requested',target_id);perform private.outreach_event(c.id,'document.requested',target_id,'document:'||target_id||':requested');return to_jsonb(doc);
 elsif p_action='document_uploaded' then
  if not private.outreach_can(c.id,'documents') then raise exception 'Document access denied' using errcode='42501';end if;
  select * into doc from public.outreach_campaign_documents where campaign_id=c.id and outreach_campaign_documents.id=(p_payload->>'id')::uuid for update;
  if not found or doc.visibility='restricted' and not private.outreach_admin(c.organization_id,true) then raise exception 'Document access denied' using errcode='42501';end if;
  -- Storage metadata is trusted only after the independently authorized object INSERT.
  select metadata into item from storage.objects where bucket_id='outreach-campaign-documents' and name=doc.object_path;
  if item is null or coalesce((item->>'size')::bigint,0) not between 1 and 10485760 or coalesce(item->>'mimetype','')<>all(array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']) then raise exception 'Uploaded file unavailable or invalid';end if;
  if doc.status='uploaded' then return to_jsonb(doc);end if;
  update public.outreach_campaign_documents set status='uploaded',byte_size=(item->>'size')::bigint,mime_type=item->>'mimetype',uploaded_at=now() where outreach_campaign_documents.id=doc.id returning * into doc;
  perform private.outreach_audit(c.id,c.organization_id,'document.uploaded',doc.id);perform private.outreach_event(c.id,'document.uploaded',doc.id,'document:'||doc.id||':uploaded');return to_jsonb(doc);
 elsif p_action in ('training_assign','training_status') then
  if p_action='training_assign' then
   if not private.outreach_can(c.id,'workflow') then raise exception 'Workflow access denied' using errcode='42501';end if;
   if not exists(select 1 from public.outreach_campaign_resources x where x.campaign_id=c.id and x.id=(p_payload->>'resource_id')::uuid and x.resource_type='training' and x.capture_state='available') or not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'user_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Training resource or assignee unavailable';end if;
   insert into public.outreach_campaign_training(campaign_id,resource_id,assigned_user_id) values(c.id,(p_payload->>'resource_id')::uuid,(p_payload->>'user_id')::uuid) on conflict(resource_id,assigned_user_id) do nothing returning outreach_campaign_training.id into target_id;
   if target_id is not null then perform private.outreach_event(c.id,'training.assigned',target_id,'training:'||target_id||':assigned');end if;return jsonb_build_object('saved',true);
  end if;
  if p_payload->>'state' not in ('viewed','completed') then raise exception 'Invalid training state';end if;
  update public.outreach_campaign_training set state=p_payload->>'state',viewed_at=coalesce(viewed_at,now()),completed_at=case when p_payload->>'state'='completed' then now() else completed_at end where campaign_id=c.id and outreach_campaign_training.id=(p_payload->>'id')::uuid and assigned_user_id=auth.uid() and state<>'completed' returning outreach_campaign_training.id into target_id;
  if target_id is null then raise exception 'Training assignment unavailable';end if;
  perform private.outreach_audit(c.id,c.organization_id,'training.'||(p_payload->>'state'),target_id);
  if p_payload->>'state'='completed' then perform private.outreach_event(c.id,'training.completed',target_id,'training:'||target_id||':completed');end if;return jsonb_build_object('saved',true);
 end if;
 if not private.outreach_can(c.id,'workflow') then raise exception 'Workflow access denied' using errcode='42501';end if;
 if p_action='reminders' then
  for s in select * from public.outreach_campaign_steps where campaign_id=c.id and status<>'completed' and due_at<=now() loop
   step_state:=private.outreach_step_state(c.id,s.step_key);
   if step_state='overdue' then perform private.outreach_event(c.id,'workflow.step_overdue',s.id,'overdue:'||s.id||':'||floor(extract(epoch from(now()-s.due_at))/(86400*coalesce((s.definition->>'reminder_days')::int,7)))||':'||s.revision);end if;
  end loop;
  for s in select * from public.outreach_campaign_steps where campaign_id=c.id and status<>'completed' and due_at between now() and now()+interval '1 day' loop
   if private.outreach_step_state(c.id,s.step_key)='ready' then perform private.outreach_event(c.id,'workflow.step_due',s.id,'due:'||s.id||':'||s.revision);end if;
  end loop;return jsonb_build_object('state','held','provider_connected',false);
 elsif p_action='acknowledge' then
  update public.outreach_campaign_events set acknowledged_at=now() where campaign_id=c.id and outreach_campaign_events.id=(p_payload->>'id')::uuid;return jsonb_build_object('saved',found);
 end if;
 perform 1 from public.outreach_campaigns where outreach_campaigns.id=c.id for update;
 select * into s from public.outreach_campaign_steps where campaign_id=c.id and outreach_campaign_steps.id=(p_payload->>'id')::uuid for update;
 if not found or s.revision is distinct from (p_payload->>'revision')::int then raise exception 'Step changed or unavailable';end if;
 if p_action='comment' then
  insert into public.outreach_campaign_step_comments(campaign_id,step_id,actor_user_id,body) values(c.id,s.id,auth.uid(),p_payload->>'body');
 elsif p_action='assign' then
  if p_payload->>'user_id' is not null and not exists(select 1 from public.outreach_campaign_assignments a where a.campaign_id=c.id and a.user_id=(p_payload->>'user_id')::uuid and a.active and a.effective_at<=now() and (a.expires_at is null or a.expires_at>now()) and private.outreach_verified(a.user_id)) then raise exception 'Assignee outside campaign';end if;
  update public.outreach_campaign_steps set assigned_user_id=(p_payload->>'user_id')::uuid,assigned_role=coalesce(p_payload->>'role',assigned_role),revision=revision+1 where outreach_campaign_steps.id=s.id;
 elsif p_action='complete' then
  -- Serialize configuration/dependency changes with completion of the campaign.
  perform 1 from public.outreach_campaigns where outreach_campaigns.id=c.id for update;
  step_state:=private.outreach_step_state(c.id,s.step_key);
  if step_state not in ('ready','overdue') then raise exception 'Prerequisite or condition not satisfied';end if;
  if coalesce((s.definition->>'approval_required')::boolean,false) and not private.outreach_admin(c.organization_id,true) then raise exception 'Administrator approval required' using errcode='42501';end if;
  if coalesce((s.definition->>'signature_required')::boolean,false) and (length(btrim(coalesce(p_payload->>'note','')))<10 or not exists(select 1 from public.outreach_campaign_documents where campaign_id=c.id and category='agreements' and status='uploaded')) then raise exception 'Signed external agreement and review attestation required';end if;
  for dep in select jsonb_array_elements_text(coalesce(s.definition->'required_documents','[]')) loop
   if not exists(select 1 from public.outreach_campaign_documents where campaign_id=c.id and category=dep and status='uploaded') then raise exception 'Required document missing: %',dep;end if;
  end loop;
  if s.definition->>'completion_rule'='assigned_training_complete' and (not exists(select 1 from public.outreach_campaign_training where campaign_id=c.id) or exists(select 1 from public.outreach_campaign_training where campaign_id=c.id and state<>'completed')) then raise exception 'Assigned training is incomplete';end if;
  update public.outreach_campaign_steps set status='completed',completed_at=now(),completed_by=auth.uid(),completion_note=coalesce(p_payload->>'note',''),revision=revision+1 where outreach_campaign_steps.id=s.id;
  perform private.outreach_event(c.id,'workflow.step_completed',s.id,'completed:'||s.id||':'||(s.revision+1));
  if s.definition->>'category'='agreement' then perform private.outreach_event(c.id,'agreement.completed',s.id,'agreement:'||s.id||':'||(s.revision+1));end if;
 elsif p_action='reopen' then
  if length(btrim(coalesce(p_payload->>'note','')))<10 then raise exception 'Reopen reason required';end if;
  update public.outreach_campaign_steps set status='reopened',completed_at=null,completed_by=null,completion_note='',revision=revision+1 where outreach_campaign_steps.id=s.id;
 else raise exception 'Unsupported workflow action';end if;
 perform private.outreach_audit(c.id,c.organization_id,'workflow.'||p_action,s.id,jsonb_build_object('revision',s.revision+1));return jsonb_build_object('saved',true);
end $$;
create function public.outreach_campaign_workflow(p_action text,p_campaign uuid default null,p_payload jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_workflow(p_action,p_campaign,p_payload)$$;
-- Private bucket, prescribed paths, no overwrite/delete by clients. New version = new path.
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types) values('outreach-campaign-documents','outreach-campaign-documents',false,10485760,array['application/pdf','image/png','image/jpeg','text/plain','application/vnd.openxmlformats-officedocument.wordprocessingml.document']);
create function private.outreach_document_can(p_name text,p_write boolean) returns boolean language sql stable security definer set search_path='' as $$
 select exists(select 1 from public.outreach_campaign_documents d join public.outreach_campaigns c on c.id=d.campaign_id where d.object_path=p_name and private.outreach_can(c.id,'documents') and (d.visibility<>'restricted' or private.outreach_admin(c.organization_id,true)) and (not p_write or d.status='requested'))
$$;
create policy outreach_document_insert on storage.objects for insert to authenticated with check(bucket_id='outreach-campaign-documents' and private.outreach_document_can(name,true));
create policy outreach_document_read on storage.objects for select to authenticated using(bucket_id='outreach-campaign-documents' and private.outreach_document_can(name,false));
do $$declare n text;begin
 foreach n in array array['outreach_campaign_steps','outreach_campaign_step_comments','outreach_campaign_documents','outreach_campaign_resources','outreach_campaign_training'] loop
 execute format('alter table public.%I enable row level security',n);execute format('revoke all on public.%I from public,anon,authenticated',n);execute format('grant all on public.%I to service_role',n);end loop;
end $$;
revoke all on function private.outreach_template_valid(jsonb),private.outreach_template_guard(),private.outreach_snapshot(),private.outreach_campaign_guard(),private.outreach_step_guard(),private.outreach_step_state(uuid,text),private.outreach_bridge(),private.outreach_workflow(text,uuid,jsonb),private.outreach_document_can(text,boolean),public.outreach_campaign_workflow(text,uuid,jsonb) from public,anon,authenticated;
grant execute on function private.outreach_workflow(text,uuid,jsonb),private.outreach_document_can(text,boolean),public.outreach_campaign_workflow(text,uuid,jsonb) to authenticated;
-- Six source-informed stages plus conditional preparations. Exact JotForm fields pending.
insert into public.outreach_workflow_templates(template_key,version,title,steps) values('outreach_source_workflow',1,'Outreach Website Flow',
'[
 {"key":"host_setup","title":"Host Church Contact Information","instructions":"Confirm church, pastor, address, phone, outreach contact and event details. Link reviewed canonical contacts; never merge by email.","category":"host_setup","order":10,"role":"local_coordinator","required":true},
 {"key":"welcome","title":"Welcome / Outreach Coordinator Contact","instructions":"Provide the welcome/sign link and Champion Life outreach coordinator contact.","category":"welcome","order":20,"role":"outreach_coordinator","required":true,"depends_on":["host_setup"]},
 {"key":"agreement","title":"Outreach Agreement and Pre-Checklist","instructions":"Exact JotForm fields await capture. Review an externally completed, signed agreement before dependent preparation. Record flyer choice and bike/tablet quantity/purchase/transport decisions in campaign configuration; time/cost decisions require coordinator review.","category":"agreement","order":30,"role":"host_pastor","required":true,"depends_on":["welcome"],"signature_required":true,"approval_required":true,"required_documents":["agreements"],"required_form":"agreement"},
 {"key":"flyers","title":"Flyer Packet / Design Options","instructions":"Prepare flyer packet/design options only when flyers are requested.","category":"promotion","order":40,"role":"outreach_coordinator","required":true,"depends_on":["agreement"],"condition":{"field":"flyers","equals":true},"required_documents":["flyers"]},
 {"key":"production","title":"Event Production Packet / General Setup Instructions","instructions":"Provide source production packet; confirm bicycles/tablets purchase and transportation responsibilities with coordinator. No native team/travel or inventory operations in Phase A.","category":"production","order":50,"role":"logistics_lead","required":true,"depends_on":["agreement"],"required_documents":["production_packet"]},
 {"key":"training","title":"Outreach Training Videos","instructions":"Assign the existing playlist. Confirm all entered/acquired information before progressing to final event information. Completion is manually acknowledged, not LMS watch telemetry.","category":"training","order":60,"role":"internal_team","required":true,"depends_on":["production"],"completion_rule":"assigned_training_complete"},
 {"key":"event_information","title":"Final Event Information / 30-Day Readiness","instructions":"Confirm site/address, registration/start/estimated end, QR, setup map, permits, semi parking/access, insurance, personnel, inventory, meetup times/locations, lodging and directions. Team/travel details remain a later phase.","category":"event_information","order":70,"role":"outreach_coordinator","required":true,"depends_on":["training"],"due_days":-30,"reminder_days":7,"escalation_role":"outreach_coordinator"},
 {"key":"final_packet","title":"Final Event Information Packet","instructions":"Provide event-specific packet at least 14 days before the outreach. Include confirmed event information, map, permits/insurance and final personnel/inventory/travel references.","category":"final_packet","order":80,"role":"outreach_coordinator","required":true,"depends_on":["event_information"],"due_days":-14,"reminder_days":3,"required_documents":["event_packet"],"approval_required":true}
]'::jsonb);
-- Existing outreach ownership remains SowGo. Import facts only; unknown dates/hosts remain null.
insert into public.outreach_campaigns(organization_id,code,name,public_slug,city,state_province,country,timezone,template_id,status,public_page,settings)
select o.id,x.code,x.name,x.slug,x.city,'AL','US','America/Chicago',t.id,x.status,x.page,
 jsonb_build_object('decision_types',jsonb_build_array('salvation','rededication','healing','prayer_followup','learn_more'),'preregistration_state',x.registration,'team_signup_open_days_before',60,'king_kind_state','pending_asset','source_import',true)
from public.organizations o cross join public.outreach_workflow_templates t cross join(values
 ('bessemer_al_2026','Bessemer 2026','bessemer','Bessemer','registration_open','/bessemer','existing'),
 ('huntsville_al_2026','Huntsville 2026','huntsville','Huntsville','draft',null,'pending_field_capture')) x(code,name,slug,city,status,page,registration)
where o.slug='sowgo' and t.template_key='outreach_source_workflow' and t.version=1;
insert into public.outreach_campaign_sources(source,campaign_id) select code,id from public.outreach_campaigns where code='bessemer_al_2026';
insert into public.outreach_campaign_registrants(campaign_id,organization_id,legacy_registration_id,registered_at)
select c.id,c.organization_id,r.id,r.created_at from public.outreach_registrations r join public.outreach_campaign_sources s on s.source=r.source join public.outreach_campaigns c on c.id=s.campaign_id on conflict(legacy_registration_id) do nothing;
create function private.outreach_seed_resources(p_campaign uuid) returns void language sql security definer set search_path='' as $$
insert into public.outreach_campaign_resources(campaign_id,resource_key,title,resource_type,source_url,capture_state,attribution)
select p_campaign,x.key,x.title,x.type,x.url,x.state,x.attribution from (select 1) c cross join(values
 ('training','Outreach Training Videos Playlist','training','https://youtube.com/playlist?list=PLdk3bsaqcsSk&si=OKTS4IFfsmduegfz','available','Champion Life'),
 ('agreement','Outreach Agreement and Pre-Checklist','form','https://form.jotform.com/261614615089157','pending_field_capture','Champion Life'),
 ('preregistration','Outreach Preregistration','form','https://form.jotform.com/team/223471619444054/preregistration-form-outreach','pending_field_capture','Champion Life'),
 ('team_signup','Join an Outreach Team','form','https://form.jotform.com/241095919780163','pending_field_capture','Champion Life'),
 ('king_kind','King Kind','book',null,'pending_asset','Pastor Roddy Shaffer')) x(key,title,type,url,state,attribution);

$$;
revoke all on function private.outreach_seed_resources(uuid) from public,anon,authenticated;
select private.outreach_seed_resources(id) from public.outreach_campaigns;
create function private.outreach_resource_snapshot() returns trigger language plpgsql security definer set search_path='' as $$begin perform private.outreach_seed_resources(new.id);return new;end$$;
revoke all on function private.outreach_resource_snapshot() from public,anon,authenticated;
create trigger outreach_campaign_resource_snapshot after insert on public.outreach_campaigns for each row execute function private.outreach_resource_snapshot();

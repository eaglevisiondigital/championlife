-- Local release candidate only. No campaign, legal version or public ingress is activated.
-- Extend Phase C records; immutable signature triggers and RPC-only RLS remain in force.
alter table public.outreach_registration_settings
 add column structured_address boolean not null default false,
 add column emergency_phone_required boolean not null default false,
 add column event_profile jsonb not null default '{}' check(jsonb_typeof(event_profile)='object' and octet_length(event_profile::text)<=6000);
alter table public.outreach_event_registrations
 add column address_details jsonb not null default '{}' check(jsonb_typeof(address_details)='object' and octet_length(address_details::text)<=2000),
 add column emergency_phone text not null default '' check(emergency_phone='' or (length(emergency_phone)<=40 and emergency_phone ~ '^[+0-9(). -]+$' and length(regexp_replace(emergency_phone,'[^0-9]','','g')) between 7 and 15));
alter table public.outreach_waiver_versions
 add column media_text_snapshot text not null default '' check(length(media_text_snapshot)<=10000),
 add column media_required boolean not null default false,
 add column media_initials_required boolean not null default false,
 add constraint outreach_media_version_text check(not(media_required or media_initials_required) or length(btrim(media_text_snapshot))>=10);
alter table public.outreach_waiver_signatures
 add column media_text_snapshot text not null default '',
 add column media_consent boolean not null default false,
 add column media_initials text not null default '' check(length(media_initials)<=20);

create function private.outreach_registration_address(p jsonb,required boolean) returns text
language plpgsql immutable set search_path='' as $$
declare k text;begin
 if jsonb_typeof(p) is distinct from 'object' or octet_length(p::text)>2000 then raise exception 'Invalid address';end if;
 if exists(select 1 from jsonb_each(p) z where z.key not in ('street','line2','city','state','postal') or jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>150) then raise exception 'Invalid address field';end if;
 if required then foreach k in array array['street','city','state','postal'] loop
  if length(btrim(coalesce(p->>k,'')))=0 then raise exception 'Complete address required';end if;
 end loop;end if;
 return concat_ws(', ',nullif(btrim(p->>'street'),''),nullif(btrim(p->>'line2'),''),nullif(btrim(p->>'city'),''),nullif(btrim(p->>'state'),''),nullif(btrim(p->>'postal'),''));
end $$;
revoke all on function private.outreach_registration_address(jsonb,boolean) from public,anon,authenticated;

create or replace function private.outreach_registration_config(c uuid) returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object('name',coalesce(nullif(s.event_profile->>'public_name',''),x.name),'event_profile',s.event_profile,'structured_address',s.structured_address,'emergency_phone_required',s.emergency_phone_required,'organization_name',o.name,'logo_asset',case o.slug when 'champion-life' then 'assets/images/logo-gold.png' when 'sowgo' then 'assets/images/sowgo-logo-light.png' else null end,'slug',s.public_slug,'event_start',x.event_start,'event_end',x.event_end,'timezone',x.timezone,'venue',jsonb_build_object('name',x.venue->>'name','address',x.venue->>'address'),'address_required',s.address_required,'waiver_required',s.waiver_required,'instructions',s.instructions,'prize_choices',s.prize_choices,'extra_fields',s.extra_fields,
 'waiver',(select jsonb_build_object('id',v.id,'version',v.version,'text',v.text_snapshot,'media_text',v.media_text_snapshot,'media_required',v.media_required,'media_initials_required',v.media_initials_required) from public.outreach_waiver_versions v where v.campaign_id=c and v.effective_at<=now() order by v.effective_at desc,v.version desc limit 1))
 from public.outreach_campaigns x join public.outreach_registration_settings s on s.campaign_id=x.id join public.organizations o on o.id=x.organization_id where x.id=c
$$;

create or replace function private.outreach_registration_sign(c uuid,r uuid,p jsonb) returns uuid language plpgsql security definer set search_path='' as $$
 declare w public.outreach_waiver_versions;old public.outreach_waiver_signatures;covered jsonb;sig uuid;media boolean;initials text;begin
 select * into w from public.outreach_waiver_versions where campaign_id=c and id=(p->>'version_id')::uuid and effective_at<=now();
 if not found or (p->>'acknowledged')::boolean is distinct from true or (p->>'authority_acknowledged')::boolean is distinct from true or jsonb_typeof(p->'covered_keys')<>'array' then raise exception 'Waiver, acknowledgment and signer authority required';end if;
 -- Legacy versions had no signed media clause; keep their signatures/retries unchanged.
 media:=case when w.media_text_snapshot='' then false else coalesce((p->>'media_consent')::boolean,false) end;initials:=btrim(coalesce(p->>'media_initials',''));
 if w.media_text_snapshot<>'' and media is distinct from coalesce((select (consents->>'media')::boolean from public.outreach_event_registrations where id=r and campaign_id=c),false) then raise exception 'Media choice must match household consent';end if;
 if w.media_required and not media or media and length(w.media_text_snapshot)>0 and w.media_initials_required and (length(initials)<1 or length(initials)>20) then raise exception 'Separate media consent and initials required';end if;
 if not media and initials<>'' then raise exception 'Initials require media consent';end if;
 select coalesce(jsonb_agg(jsonb_build_object('id',m.id,'first_name',m.first_name,'last_name',m.last_name,'age',m.age,'relationship',m.relationship,'guardian_relationship',m.guardian_relationship) order by m.id),'[]') into covered from public.outreach_event_attendees m where m.campaign_id=c and m.registration_id=r and m.active and (p->'covered_keys') ? m.client_key::text;
 if jsonb_array_length(covered)=0 or jsonb_array_length(covered)<>jsonb_array_length(p->'covered_keys') then raise exception 'Explicit household coverage required';end if;
 if exists(select 1 from jsonb_array_elements(covered) m where (m->>'age')::int<18) and p->>'signer_relationship' not in ('parent','legal_guardian') then raise exception 'Minor requires parent or legal guardian';end if;
 select * into old from public.outreach_waiver_signatures where registration_id=r and request_key=(p->>'request_key')::uuid;
 if found then
  if old.version_id is distinct from w.id or old.signer_name is distinct from btrim(p->>'signer_name') or old.signer_relationship is distinct from p->>'signer_relationship' or old.coverage_snapshot is distinct from covered or old.media_consent is distinct from media or old.media_initials is distinct from initials then raise exception 'Signature retry changed';end if;
  return old.id;
 end if;
 if w.id is distinct from (select id from public.outreach_waiver_versions where campaign_id=c and effective_at<=now() order by effective_at desc,version desc limit 1) then raise exception 'Current waiver version required';end if;
 if p->>'signer_relationship'='self' and (jsonb_array_length(covered)<>1 or lower(btrim(p->>'signer_name')) is distinct from lower((covered->0->>'first_name')||' '||(covered->0->>'last_name'))) then raise exception 'Self signature covers only the signer';end if;
 insert into public.outreach_waiver_signatures(campaign_id,registration_id,request_key,version_id,version,text_snapshot,signer_name,signer_relationship,authority_acknowledged,acknowledged,coverage_snapshot,recorded_by,media_text_snapshot,media_consent,media_initials)
 values(c,r,(p->>'request_key')::uuid,w.id,w.version,w.text_snapshot,btrim(p->>'signer_name'),p->>'signer_relationship',true,true,covered,auth.uid(),w.media_text_snapshot,media,initials) returning id into sig;
 perform private.outreach_audit(c,(select organization_id from public.outreach_campaigns where id=c),'waiver.signed',sig,jsonb_build_object('covered_count',jsonb_array_length(covered),'version',w.version));
 perform private.outreach_event(c,'outreach.waiver.signed',sig,'waiver:'||sig);return sig;end $$;

create or replace function private.outreach_registration_submit(c uuid,p jsonb,mode text) returns jsonb language plpgsql security definer set search_path='' as $$
 declare s public.outreach_registration_settings;x public.outreach_campaigns;r public.outreach_event_registrations;v jsonb;a jsonb;key uuid;begin
 select * into x from public.outreach_campaigns where id=c for update;
 if not found then raise exception 'Registration unavailable';end if;
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if not found or (mode='public' and not private.outreach_registration_open(c)) or x.status in ('closed','cancelled','completed','draft') then raise exception 'Registration unavailable';end if;
 if mode='walkup' and not private.outreach_registration_can(c,'registration.manage') then raise exception 'Registration access denied' using errcode='42501';end if;
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>60000 or jsonb_typeof(p->'attendees')<>'array' or jsonb_array_length(p->'attendees') not between 1 and 30 then raise exception 'Invalid household';end if;
 if exists(select 1 from jsonb_object_keys(p) k where k not in ('request_key','first_name','last_name','email','phone','address','attendees','consents','waiver','address_details','emergency_phone')) then raise exception 'Unknown registration field';end if;
 key:=(p->>'request_key')::uuid;if key is null then raise exception 'Request key required';end if;
 select * into r from public.outreach_event_registrations where campaign_id=c and request_key=key;
 if found then if r.request_snapshot is distinct from p or r.source<>mode then raise exception 'Submission retry changed';end if;return jsonb_build_object('accepted',true,'reference',r.reference,'attendee_count',jsonb_array_length(p->'attendees'));end if;
 if p ? 'address_details' then perform private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required);elsif s.structured_address then raise exception 'Structured address required';end if;
 if s.emergency_phone_required and length(btrim(coalesce(p->>'emergency_phone','')))=0 then raise exception 'Emergency telephone required';end if;
 if s.address_required and not s.structured_address and length(btrim(coalesce(p->>'address','')))=0 then raise exception 'Address required';end if;
 if s.household_limit is not null and (select count(*) from public.outreach_event_registrations where campaign_id=c and status not in ('cancelled','closed'))>=s.household_limit then raise exception 'Registration capacity reached';end if;
 if jsonb_typeof(coalesce(p->'consents','{}'))<>'object' or exists(select 1 from jsonb_each(coalesce(p->'consents','{}')) z where z.key not in ('ministry_followup','communications','marketing','media') or jsonb_typeof(z.value)<>'boolean') then raise exception 'Separate explicit consent choices required';end if;
 insert into public.outreach_event_registrations(campaign_id,organization_id,request_key,request_snapshot,first_name,last_name,email,phone,address,source,consents,address_details,emergency_phone)
 values(c,x.organization_id,key,p,btrim(p->>'first_name'),btrim(p->>'last_name'),lower(btrim(p->>'email')),btrim(p->>'phone'),case when p ? 'address_details' then private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required) else coalesce(p->>'address','') end,mode,coalesce(p->'consents','{}'),coalesce(p->'address_details','{}'),btrim(coalesce(p->>'emergency_phone',''))) returning * into r;
 for a in select value from jsonb_array_elements(p->'attendees') loop perform private.outreach_registration_attendee(c,r.id,a);end loop;
 if (select count(*) from public.outreach_event_attendees where registration_id=r.id)<>jsonb_array_length(p->'attendees') then raise exception 'Duplicate attendee keys';end if;
 if p->'waiver' is not null and p->'waiver'<>'null'::jsonb then
  if exists(select 1 from jsonb_object_keys(p->'waiver') k where k not in ('request_key','version_id','signer_name','signer_relationship','acknowledged','authority_acknowledged','covered_keys','media_consent','media_initials')) then raise exception 'Unknown waiver field';end if;
  perform private.outreach_registration_sign(c,r.id,p->'waiver');end if;
 if s.waiver_required and exists(select 1 from public.outreach_event_attendees m where m.registration_id=r.id and m.attending and not private.outreach_registration_coverage(c,m.id)) then raise exception 'Required waiver must cover attending members';end if;
 perform private.outreach_audit(c,x.organization_id,'registration.submitted',r.id,jsonb_build_object('source',mode,'attendees',jsonb_array_length(p->'attendees')));
 perform private.outreach_event(c,'outreach.registration.submitted',r.id,'registration:'||r.id);
 if mode='walkup' then perform private.outreach_event(c,'outreach.walkup.registered',r.id,'walkup:'||r.id);end if;
 return jsonb_build_object('accepted',true,'reference',r.reference,'attendee_count',jsonb_array_length(p->'attendees'));end $$;

create or replace function private.outreach_registration_workspace(action text,c uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
 declare x public.outreach_campaigns;s public.outreach_registration_settings;r public.outreach_event_registrations;m public.outreach_event_attendees;id uuid;row jsonb;result jsonb;cap text;csv text;begin
 if jsonb_typeof(p)<>'object' or octet_length(p::text)>60000 then raise exception 'Invalid request';end if;
 if action='campaigns' then return coalesce((select jsonb_agg(jsonb_build_object('id',z.id,'name',z.name)) from public.outreach_campaigns z where private.outreach_registration_can(z.id,'registration.view')),'[]');end if;
 cap:=case when action in ('list','detail','context') then 'registration.view' when action='csv' then 'registration.export' when action in ('checkin','reverse') then 'checkin.manage' else 'registration.manage' end;
 if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;
 if action not in ('list','detail','context','csv') then perform 1 from public.outreach_campaigns where outreach_campaigns.id=c for update;
  if not private.outreach_registration_can(c,cap) then raise exception 'Registration access denied' using errcode='42501';end if;end if;
 select * into x from public.outreach_campaigns where outreach_campaigns.id=c;
 select * into s from public.outreach_registration_settings where campaign_id=c;
 if action='context' then return jsonb_build_object('name',x.name,'config',private.outreach_registration_config(c),'settings',case when private.outreach_admin(x.organization_id,true) then to_jsonb(s) else null end,'admin',private.outreach_admin(x.organization_id,true),'capabilities',(select jsonb_agg(k) from unnest(array['registration.view','registration.manage','registration.export','checkin.manage']) k where private.outreach_registration_can(c,k)));end if;
 if action='configure' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if coalesce(s.revision,0) is distinct from (p->>'revision')::int then raise exception 'Configuration changed';end if;
  for row in select value from jsonb_array_elements(coalesce(p->'prize_choices','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 100 or length(coalesce(row->>'guidance',''))>500 then raise exception 'Invalid prize choice';end if;end loop;
  for row in select value from jsonb_array_elements(coalesce(p->'extra_fields','[]')) loop
   if (row->>'id' ~ '^[a-z0-9_-]{1,60}$') is distinct from true or length(coalesce(row->>'label','')) not between 1 and 160 or (row->>'type' in ('text','boolean','choice')) is distinct from true or jsonb_typeof(row->'required') is distinct from 'boolean' or (row->>'type'='choice' and (jsonb_typeof(row->'options') is distinct from 'array' or jsonb_array_length(row->'options')=0)) then raise exception 'Invalid mapped field';end if;end loop;
  if (select count(*) from jsonb_array_elements(coalesce(p->'prize_choices','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'prize_choices','[]')) z) or (select count(*) from jsonb_array_elements(coalesce(p->'extra_fields','[]')))<>(select count(distinct z->>'id') from jsonb_array_elements(coalesce(p->'extra_fields','[]')) z) then raise exception 'Duplicate configured choices';end if;
  if p ? 'event_profile' and (jsonb_typeof(p->'event_profile')<>'object' or exists(select 1 from jsonb_each(p->'event_profile') z where z.key not in ('public_name','on_site_registration_at','confirmation_message','highlights') or jsonb_typeof(z.value)<>'string' or length(z.value#>>'{}')>2000)) then raise exception 'Invalid public event profile';end if;
  if nullif(p->'event_profile'->>'on_site_registration_at','') is not null then perform (p->'event_profile'->>'on_site_registration_at')::timestamptz;end if;
  insert into public.outreach_registration_settings(campaign_id,public_slug,enabled,opens_at,closes_at,address_required,waiver_required,household_limit,instructions,prize_choices,extra_fields,structured_address,emergency_phone_required,event_profile)
  values(c,p->>'public_slug',coalesce((p->>'enabled')::boolean,false),(p->>'opens_at')::timestamptz,(p->>'closes_at')::timestamptz,coalesce((p->>'address_required')::boolean,false),coalesce((p->>'waiver_required')::boolean,true),(p->>'household_limit')::int,coalesce(p->>'instructions',''),coalesce(p->'prize_choices','[]'),coalesce(p->'extra_fields','[]'),coalesce((p->>'structured_address')::boolean,s.structured_address,false),coalesce((p->>'emergency_phone_required')::boolean,s.emergency_phone_required,false),coalesce(p->'event_profile',s.event_profile,'{}'))
  on conflict(campaign_id) do update set public_slug=excluded.public_slug,enabled=excluded.enabled,opens_at=excluded.opens_at,closes_at=excluded.closes_at,address_required=excluded.address_required,waiver_required=excluded.waiver_required,household_limit=excluded.household_limit,instructions=excluded.instructions,prize_choices=excluded.prize_choices,extra_fields=excluded.extra_fields,structured_address=excluded.structured_address,emergency_phone_required=excluded.emergency_phone_required,event_profile=excluded.event_profile,revision=outreach_registration_settings.revision+1;
  perform private.outreach_audit(c,x.organization_id,'registration.configured',c);return jsonb_build_object('saved',true);
 elsif action='waiver_publish' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  insert into public.outreach_waiver_versions(campaign_id,template_key,version,effective_at,text_snapshot,created_by,media_text_snapshot,media_required,media_initials_required) values(c,p->>'template_key',(p->>'version')::int,(p->>'effective_at')::timestamptz,p->>'text',auth.uid(),coalesce(p->>'media_text',''),coalesce((p->>'media_required')::boolean,false),coalesce((p->>'media_initials_required')::boolean,false)) returning outreach_waiver_versions.id into id;
  perform private.outreach_audit(c,x.organization_id,'waiver.published',id);return jsonb_build_object('id',id);
 elsif action='access' then
  if not private.outreach_admin(x.organization_id,true) then raise exception 'Campaign administrator required' using errcode='42501';end if;
  if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Review reason required';end if;
  if exists(select 1 from jsonb_array_elements_text(p->'capabilities') k where k not in ('registration.view','registration.manage','registration.export','checkin.manage')) then raise exception 'Only registration capabilities permitted';end if;
  update public.outreach_campaign_assignments set capabilities=array(select distinct k from unnest(capabilities||array(select jsonb_array_elements_text(p->'capabilities'))) k where k not in ('registration.view','registration.manage','registration.export','checkin.manage') or (p->'capabilities') ? k),revision=revision+1,reason=p->>'reason' where campaign_id=c and user_id=(p->>'user_id')::uuid and revision=(p->>'revision')::int;
  if not found then raise exception 'Assignment changed';end if;perform private.outreach_audit(c,x.organization_id,'registration.access_changed',(p->>'user_id')::uuid);return jsonb_build_object('saved',true);
 elsif action='walkup' then return private.outreach_registration_submit(c,p,'walkup');
 elsif action='list' then
  return jsonb_build_object('registrations',(select coalesce(jsonb_agg(jsonb_build_object('id',z.id,'reference',z.reference,'name',z.first_name||' '||z.last_name,'phone',z.phone,'email',z.email,'source',z.source,'status',z.status,'attendees',(select count(*) from public.outreach_event_attendees a where a.registration_id=z.id and a.active)) order by z.submitted_at desc),'[]') from public.outreach_event_registrations z where z.campaign_id=c and (coalesce(p->>'search','')='' or concat_ws(' ',z.reference,z.first_name,z.last_name,z.phone,z.email) ilike '%'||replace(replace(p->>'search','%','\%'),'_','\_')||'%')),
   'summary',(select jsonb_build_object(
    'households',count(distinct z.id),
    'attendees',count(a.id), 'adults',count(a.id) filter(where a.age>=18), 'minors',count(a.id) filter(where a.age<18),
    'waivers_complete',count(a.id) filter(where private.outreach_registration_coverage(c,a.id)),
    'waivers_missing',count(a.id) filter(where not private.outreach_registration_coverage(c,a.id)),
    'checked_in',count(a.id) filter(where a.checked_in_at is not null),
    'checked_in_adults',count(a.id) filter(where a.checked_in_at is not null and a.age>=18),
    'checked_in_minors',count(a.id) filter(where a.checked_in_at is not null and a.age<18),
    'not_checked_in',count(a.id) filter(where a.checked_in_at is null),
    'walkups',count(distinct z.id) filter(where z.source='walkup'))
    from public.outreach_event_registrations z left join public.outreach_event_attendees a on a.registration_id=z.id and a.campaign_id=c and a.active and a.attending
    where z.campaign_id=c and z.status in ('submitted','confirmed','checked_in')));
 elsif action='csv' then
  csv:='Registration Reference,Registration Date/Time,Primary First Name,Primary Last Name,Phone,Email,Address,City,State,ZIP,Attendee Name,Adult/Minor,Age,Relationship,Guardian,Emergency Phone,Waiver Status,Media Consent,Check-In Status,Source' || E'\r\n';
  -- Same canonical active population as headline totals, independent of table search.
  -- A household without an attending member retains one blank attendee row for household reconciliation.
  for row in select jsonb_build_array(z.reference,to_char(z.submitted_at at time zone x.timezone,'YYYY-MM-DD HH24:MI:SS')||' '||x.timezone,z.first_name,z.last_name,z.phone,z.email,coalesce(nullif(concat_ws(' ',z.address_details->>'street',z.address_details->>'line2'),''),z.address),z.address_details->>'city',z.address_details->>'state',z.address_details->>'postal',concat_ws(' ',a.first_name,a.last_name),case when a.id is null then '' when a.age<18 then 'Minor' else 'Adult' end,a.age::text,a.relationship,a.guardian_relationship,z.emergency_phone,case when a.id is null then '' when private.outreach_registration_coverage(c,a.id) then 'Covered' else 'Missing' end,case when coalesce((z.consents->>'media')::boolean,false) then 'Yes' else 'No' end,case when a.id is null then '' when a.checked_in_at is null then 'Not checked in' else 'Checked in' end,z.source)
  from public.outreach_event_registrations z left join public.outreach_event_attendees a on a.registration_id=z.id and a.campaign_id=c and a.active and a.attending
  where z.campaign_id=c and z.status in ('submitted','confirmed','checked_in') order by z.submitted_at,z.id,a.id loop
   csv:=csv||(select string_agg(private.outreach_csv_cell(value),',' order by n) from jsonb_array_elements_text(row) with ordinality t(value,n))||E'\r\n';end loop;
  perform private.outreach_audit(c,x.organization_id,'registration.exported',c);return jsonb_build_object('csv',csv,'filename',x.code||'-registration-roster.csv');
 end if;
 select * into r from public.outreach_event_registrations where campaign_id=c and outreach_event_registrations.id=(p->>'registration_id')::uuid;
 if not found then raise exception 'Household outside campaign' using errcode='42501';end if;
 if action='detail' then return private.outreach_registration_detail(c,r.id);end if;
 if action='update' then
  if r.revision is distinct from (p->>'revision')::int then raise exception 'Registration changed';end if;
  if p->>'status'='checked_in' and not exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Record individual attendee check-in first';end if;
  if p->>'status' in ('cancelled','no_show','closed') and exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Reverse check-ins before closing registration';end if;
  if p ? 'address_details' then perform private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required);end if;
  if s.structured_address and p ? 'address' and not (p ? 'address_details') then raise exception 'Use structured address fields';end if;
  if s.emergency_phone_required and p ? 'emergency_phone' and length(btrim(coalesce(p->>'emergency_phone','')))=0 then raise exception 'Emergency telephone required';end if;
  update public.outreach_event_registrations set first_name=coalesce(p->>'first_name',first_name),last_name=coalesce(p->>'last_name',last_name),email=coalesce(p->>'email',email),phone=coalesce(p->>'phone',phone),address=case when p ? 'address_details' then private.outreach_registration_address(p->'address_details',s.structured_address and s.address_required) else coalesce(p->>'address',address) end,address_details=coalesce(p->'address_details',address_details),emergency_phone=coalesce(p->>'emergency_phone',emergency_phone),notes=coalesce(p->>'notes',notes),status=case when exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then 'checked_in' else coalesce(p->>'status',status) end,revision=revision+1 where outreach_event_registrations.id=r.id;
 elsif action='sign' then id:=private.outreach_registration_sign(c,r.id,p);return jsonb_build_object('id',id);
 elsif action='waiver_correct' then
  if not exists(select 1 from public.outreach_waiver_signatures where registration_id=r.id and outreach_waiver_signatures.id=(p->>'signature_id')::uuid) then raise exception 'Signature outside household' using errcode='42501';end if;
  if exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then raise exception 'Reverse check-ins before correcting waiver';end if;
  insert into public.outreach_waiver_corrections values((p->>'signature_id')::uuid,p->>'reason',auth.uid(),now());perform private.outreach_audit(c,x.organization_id,'waiver.corrected',(p->>'signature_id')::uuid);return jsonb_build_object('saved',true);
 elsif action='attendee_add' then id:=private.outreach_registration_attendee(c,r.id,p);return jsonb_build_object('id',id);
 else
  select * into m from public.outreach_event_attendees where campaign_id=c and registration_id=r.id and outreach_event_attendees.id=(p->>'attendee_id')::uuid;
  if not found then raise exception 'Attendee outside household' using errcode='42501';end if;
  if action in ('checkin','reverse') then
   if action='checkin' then
    if not m.active or not m.attending or r.status in ('cancelled','no_show','closed') or (s.waiver_required and not private.outreach_registration_coverage(c,m.id)) then raise exception 'Active attendee and valid waiver coverage required';end if;
    if m.checked_in_at is not null then return jsonb_build_object('saved',true,'already_checked_in',true);end if;
    update public.outreach_event_attendees set checked_in_at=clock_timestamp(),checked_in_by=auth.uid(),wristband=coalesce(p->>'wristband',wristband),revision=revision+1 where outreach_event_attendees.id=m.id;
    insert into public.outreach_prize_participants(campaign_id,attendee_id,checked_in_at,active) select c,m.id,checked_in_at,m.prize_participation from public.outreach_event_attendees where outreach_event_attendees.id=m.id on conflict(campaign_id,attendee_id) where attendee_id is not null do update set checked_in_at=excluded.checked_in_at,active=excluded.active;
    update public.outreach_event_registrations set status='checked_in',revision=revision+1 where outreach_event_registrations.id=r.id;
   else
    if length(btrim(coalesce(p->>'reason','')))<10 then raise exception 'Correction reason required';end if;
    if m.checked_in_at is null then return jsonb_build_object('saved',true,'already_reversed',true);end if;
    update public.outreach_event_attendees set checked_in_at=null,checked_in_by=null,revision=revision+1 where outreach_event_attendees.id=m.id;
    update public.outreach_prize_participants set checked_in_at=null,active=false where attendee_id=m.id;
    update public.outreach_event_registrations set status=case when exists(select 1 from public.outreach_event_attendees where registration_id=r.id and checked_in_at is not null) then 'checked_in' else 'confirmed' end,revision=revision+1 where outreach_event_registrations.id=r.id;
   end if;
   perform private.outreach_audit(c,x.organization_id,case when action='checkin' then 'attendee.checked_in' else 'attendee.checkin_reversed' end,m.id,jsonb_build_object('reason',case when action='reverse' then p->>'reason' else null end));
   perform private.outreach_event(c,case when action='checkin' then 'outreach.attendee.checked_in' else 'outreach.attendee.checkin_reversed' end,m.id,action||':'||m.id||':'||(m.revision+1));return jsonb_build_object('saved',true);
  elsif action='attendee_update' then
   if m.revision is distinct from (p->>'revision')::int then raise exception 'Attendee changed';end if;
   if m.checked_in_at is not null then raise exception 'Reverse check-in before editing attendee';end if;
   perform private.outreach_registration_answers(c,coalesce(p->'answers',m.answers));
   if p->>'prize_choice' is not null and not exists(select 1 from jsonb_array_elements(s.prize_choices) ch where ch->>'id'=p->>'prize_choice') then raise exception 'Prize choice not configured';end if;
   update public.outreach_event_attendees set prize_participation=coalesce((p->>'prize_participation')::boolean,prize_participation),bike_interest=coalesce((p->>'bike_interest')::boolean,bike_interest),tablet_only=coalesce((p->>'tablet_only')::boolean,tablet_only),prize_choice=case when p ? 'prize_choice' then p->>'prize_choice' else prize_choice end,answers=coalesce(p->'answers',answers),first_name=coalesce(p->>'first_name',first_name),last_name=coalesce(p->>'last_name',last_name),age=coalesce((p->>'age')::int,age),guardian_relationship=coalesce(p->>'guardian_relationship',guardian_relationship),attending=coalesce((p->>'attending')::boolean,attending),active=coalesce((p->>'active')::boolean,active),notes=coalesce(p->>'notes',notes),wristband=coalesce(p->>'wristband',wristband),revision=revision+1 where outreach_event_attendees.id=m.id;
   perform private.outreach_audit(c,x.organization_id,case when p->>'active'='false' then 'attendee.removed' else 'attendee.updated' end,m.id);
  else raise exception 'Unsupported registration action';end if;
 end if;
 perform private.outreach_audit(c,x.organization_id,'registration.updated',r.id);perform private.outreach_event(c,'outreach.registration.updated',r.id,'registration-update:'||gen_random_uuid());
 if action='update' and p->>'status'='confirmed' and r.status<>'confirmed' then perform private.outreach_event(c,'outreach.registration.confirmed',r.id,'registration-confirmed:'||r.id);end if;
 return jsonb_build_object('saved',true);end $$;


-- Prepare only the existing unused Huntsville draft; fail closed if its state changed.
-- Registration stays disabled and no waiver is published by this migration.
do $$
declare c uuid;o uuid;begin
 select x.id,x.organization_id into c,o from public.outreach_campaigns x
 join public.organizations z on z.id=x.organization_id
 where x.code='huntsville_al_2026' and z.slug='sowgo' and x.status='draft' for update of x;
 if c is null or exists(select 1 from public.outreach_event_registrations where campaign_id=c)
 or exists(select 1 from public.outreach_registration_settings where campaign_id=c) then
  raise exception 'Huntsville draft has changed; review configuration before applying';
 end if;
 update public.outreach_campaigns set name='Huntsville Outreach / City Hangout',public_slug='huntsville-2026',city='Madison',state_province='AL',country='US',timezone='America/Chicago',
 event_start='2026-10-24T14:00:00-05:00'::timestamptz,event_end='2026-10-24T16:00:00-05:00'::timestamptz,registration_start='2026-10-24T13:00:00-05:00'::timestamptz,
 venue='{"name": "Cornerstone Word of Life Church", "address": "3783 Sullivan St, Madison, AL 35758"}'::jsonb,revision=revision+1 where id=c;
 insert into public.outreach_registration_settings(campaign_id,public_slug,enabled,address_required,structured_address,emergency_phone_required,waiver_required,instructions,event_profile)
 values(c,'huntsville-2026',false,true,true,true,true,'Please complete registration and check in before the giveaway eligibility cutoff announced by the event team. All ticket holders must be present to win. Giveaways are subject to eligibility and availability; preregistration does not guarantee a bicycle or tablet.','{"public_name": "CITY HANGOUT", "on_site_registration_at": "2026-10-24T13:00:00-05:00", "confirmation_message": "Thank you for registering for City Hangout. We look forward to seeing you Saturday, October 24 at Cornerstone Word of Life Church.", "highlights": "Music \u00b7 Games \u00b7 Inflatables \u00b7 Giveaways \u00b7 Free Bicycles \u00b7 Free Tablets \u00b7 All Free"}'::jsonb);
 perform private.outreach_audit(c,o,'registration.draft_prepared',c,jsonb_build_object('enabled',false));
end $$;

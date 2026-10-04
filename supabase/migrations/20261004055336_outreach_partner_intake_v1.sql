-- Guest-origin intent, not identity, consent or payment authority.
create table public.outreach_partner_intakes (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id),
 source_site text not null check(source_site in ('champion_life','sowgo')),
 source_path text not null,
 raw_submission jsonb not null,
 email_normalized text not null, phone_normalized text not null,
 commitment_amount numeric(12,2) not null check(commitment_amount>=1),
 commitment_frequency text not null check(commitment_frequency in ('Weekly','Bi-weekly','Monthly')),
 request_key uuid not null unique, payload_hash text not null,
 status text not null default 'new' check(status in ('new','reviewed','linked')),
 person_id uuid, followup_task_id uuid references public.followup_tasks(id),
 submitted_at timestamptz not null default now(), reviewed_at timestamptz, linked_at timestamptz,
 updated_at timestamptz not null default now(), revision integer not null default 1,
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id)
);
create index outreach_intake_queue on public.outreach_partner_intakes(organization_id,submitted_at desc);
create index outreach_intake_email_rate on public.outreach_partner_intakes(email_normalized,submitted_at desc);
create index outreach_intake_person on public.outreach_partner_intakes(organization_id,person_id);
create index outreach_intake_followup on public.outreach_partner_intakes(followup_task_id);
create table private.outreach_partner_audit (
 id uuid primary key default gen_random_uuid(), intake_id uuid not null references public.outreach_partner_intakes(id),
 actor_id uuid not null references auth.users(id), action text not null, occurred_at timestamptz not null default now(), person_id uuid
);
alter table public.outreach_partner_intakes enable row level security;
alter table private.outreach_partner_audit enable row level security;
revoke all on public.outreach_partner_intakes,private.outreach_partner_audit from public,anon,authenticated,service_role;

create function private.outreach_partner_submit(p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare org uuid; key uuid; digest text; prior public.outreach_partner_intakes; fields jsonb; k text; v text; maxlen integer; email text; phone text; amount numeric;
begin
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>12000 or
 (p_data - array['brand','source_path','request_key','bot_field','fields'])<>'{}'::jsonb then raise exception 'Unsupported submission' using errcode='22023'; end if;
 if coalesce(p_data->>'brand','') not in ('champion-life','sowgo') then raise exception 'Unknown presentation'; end if;
 if coalesce(p_data->>'bot_field','')<>'' then return jsonb_build_object('accepted',true); end if;
 if coalesce(p_data->>'source_path','') !~ '^/[^?#]*$' or length(p_data->>'source_path')>500 then raise exception 'Invalid source path'; end if;
 fields:=p_data->'fields';
 if fields is null or jsonb_typeof(fields)<>'object' or (fields-array['first-name','last-name','email','address-line-1','address-line-2','city','state-province','postal-code','phone','commitment-amount','commitment-frequency'])<>'{}'::jsonb then raise exception 'Unsupported fields'; end if;
 foreach k in array array['first-name','last-name','email','address-line-1','address-line-2','city','state-province','postal-code','phone','commitment-amount','commitment-frequency'] loop
  v:=fields->>k; maxlen:=case when k='email' then 254 when k like 'address%' then 250 when k='phone' then 60 when k='postal-code' then 30 when k='commitment-amount' then 20 else 100 end;
  if (k<>'address-line-2' and (v is null or btrim(v)='')) or (fields ? k and jsonb_typeof(fields->k)<>'string') or length(v)>maxlen or v ~ '[[:cntrl:]]' then raise exception 'Invalid field: %',k; end if;
 end loop;
 email:=lower(btrim(fields->>'email')); phone:=regexp_replace(fields->>'phone','[^0-9+]','','g');
 if email !~ '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' or length(regexp_replace(phone,'[^0-9]','','g')) not between 7 and 20 then raise exception 'Invalid contact information'; end if;
 if fields->>'commitment-amount' !~ '^[0-9]+(\.[0-9]{1,2})?$' then raise exception 'Invalid amount'; end if;
 amount:=(fields->>'commitment-amount')::numeric;
 if amount<1 or amount>9999999999.99 or coalesce(fields->>'commitment-frequency','') not in ('Weekly','Bi-weekly','Monthly') then raise exception 'Invalid commitment'; end if;
 key:=(p_data->>'request_key')::uuid; if key is null then raise exception 'Request key required'; end if;
 select id into org from public.organizations where slug='sowgo'; if org is null then raise exception 'Intake unavailable'; end if;
 -- Serialize replay and rate checks; raw input is never used as identity evidence.
 perform pg_advisory_xact_lock(hashtextextended('outreach-partner-intake',0));
 digest:=encode(sha256(convert_to((p_data-'request_key'-'bot_field')::text,'UTF8')),'hex');
 select * into prior from public.outreach_partner_intakes where request_key=key;
 if found then
  if prior.payload_hash<>digest then raise exception 'Request changed; begin a new submission'; end if;
  return jsonb_build_object('accepted',true);
 end if;
 if (select count(*) from public.outreach_partner_intakes where submitted_at>now()-interval '1 hour')>=100 or
 (select count(*) from public.outreach_partner_intakes where email_normalized=email and submitted_at>now()-interval '1 hour')>=5 then raise exception 'Please wait before submitting again' using errcode='P0001'; end if;
 insert into public.outreach_partner_intakes(organization_id,source_site,source_path,raw_submission,email_normalized,phone_normalized,commitment_amount,commitment_frequency,request_key,payload_hash)
 values(org,case p_data->>'brand' when 'sowgo' then 'sowgo' else 'champion_life' end,p_data->>'source_path',fields,email,phone,amount,fields->>'commitment-frequency',key,digest);
 return jsonb_build_object('accepted',true);
end $$;
create function public.outreach_partner_submit(p_data jsonb) returns jsonb language sql security invoker set search_path='' as $$select private.outreach_partner_submit(p_data)$$;

create function private.outreach_partner_workspace(p_org uuid,p_action text,p_data jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
declare r public.outreach_partner_intakes; person uuid; task uuid; result jsonb; fields jsonb;
begin
 if not private.has_staff_permission(p_org,'outreach.view') then raise exception 'Outreach view permission required' using errcode='42501'; end if;
 if p_data is null or jsonb_typeof(p_data)<>'object' or octet_length(p_data::text)>2000 or (p_data-array['id','revision','person_id','search','offset'])<>'{}'::jsonb then raise exception 'Unsupported request'; end if;
 if p_action='list' then
  select coalesce(jsonb_agg(to_jsonb(x)),'[]') into result from (
   select i.id,i.source_site,i.submitted_at,i.status,i.person_id,i.commitment_amount,i.commitment_frequency,
    i.raw_submission->>'first-name' first_name,i.raw_submission->>'last-name' last_name,i.raw_submission->>'email' email,i.raw_submission->>'phone' phone,
    case when private.has_staff_permission(p_org,'followup.read') and private.has_staff_permission(p_org,'people.read') then t.status else null end followup_status
   from public.outreach_partner_intakes i left join public.followup_tasks t on t.id=i.followup_task_id
   where i.organization_id=p_org order by i.submitted_at desc,i.id limit 50 offset greatest(0,least(coalesce((p_data->>'offset')::int,0),100000))
  )x; return result;
 end if;
 select * into r from public.outreach_partner_intakes where organization_id=p_org and id=(p_data->>'id')::uuid for update;
 if not found then raise exception 'Intake unavailable'; end if;
 if p_action='detail' then
  return (to_jsonb(r)-'request_key'-'payload_hash'-'email_normalized'-'phone_normalized') || jsonb_build_object('history',(select coalesce(jsonb_agg(jsonb_build_object('action',action,'occurred_at',occurred_at) order by occurred_at),'[]') from private.outreach_partner_audit where intake_id=r.id));
 end if;
 if not private.has_staff_permission(p_org,'outreach.manage') then raise exception 'Outreach management required' using errcode='42501'; end if;
 if (p_data->>'revision')::int is distinct from r.revision then raise exception 'Intake changed; reload' using errcode='40001'; end if;
 if p_action='review' then
  update public.outreach_partner_intakes set status=case when person_id is null then 'reviewed' else 'linked' end,reviewed_at=coalesce(reviewed_at,now()),updated_at=now(),revision=revision+1 where id=r.id;
 elsif p_action in ('link','create_contact') then
  if r.person_id is not null then raise exception 'Intake already linked'; end if;
  if not(private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'people.update')) then raise exception 'Organization contact review permission required' using errcode='42501'; end if;
  perform pg_advisory_xact_lock(hashtextextended('outreach-contact:'||p_org::text,0));
  fields:=r.raw_submission;
  if p_action='create_contact' then
   if not private.has_staff_permission(p_org,'people.create') then raise exception 'Contact creation denied' using errcode='42501'; end if;
   if exists(select 1 from public.organization_people p where p.organization_id=p_org and (lower(btrim(p.email))=r.email_normalized or regexp_replace(p.phone,'[^0-9+]','','g')=r.phone_normalized or (lower(p.first_name)=lower(btrim(fields->>'first-name')) and lower(p.last_name)=lower(btrim(fields->>'last-name'))))) then raise exception 'Possible existing contact; search and review before linking'; end if;
   insert into public.organization_people(organization_id,first_name,last_name,email,phone) values(p_org,fields->>'first-name',fields->>'last-name',r.email_normalized,fields->>'phone') returning id into person;
  else person:=(p_data->>'person_id')::uuid;
  end if;
  if not exists(select 1 from public.organization_people where organization_id=p_org and id=person) then raise exception 'Contact unavailable'; end if;
  if not exists(select 1 from public.person_organization_relationships where organization_id=p_org and person_id=person and relationship='partner' and active and effective_at<=now() and (expires_at is null or expires_at>now())) then
   perform private.people_workspace(p_org,'relationship',jsonb_build_object('person_id',person,'relationship','partner'));
  end if;
  update public.outreach_partner_intakes set person_id=person,status='linked',reviewed_at=coalesce(reviewed_at,now()),linked_at=now(),updated_at=now(),revision=revision+1 where id=r.id;
 elsif p_action='followup' then
  if r.person_id is null then raise exception 'Review and link a contact first'; end if;
  if not(private.has_staff_permission(p_org,'people.read') and private.has_staff_permission(p_org,'followup.read') and private.has_staff_permission(p_org,'followup.manage')) then raise exception 'Follow-up permission required' using errcode='42501'; end if;
  if r.followup_task_id is not null then return jsonb_build_object('saved',true); end if;
  insert into public.followup_tasks(organization_id,person_id,title) values(p_org,r.person_id,'Follow up on outreach partnership commitment') returning id into task;
  update public.outreach_partner_intakes set followup_task_id=task,updated_at=now(),revision=revision+1 where id=r.id;
 else raise exception 'Unsupported action'; end if;
 insert into private.outreach_partner_audit(intake_id,actor_id,action,person_id) values(r.id,auth.uid(),p_action,coalesce(person,r.person_id));
 return jsonb_build_object('saved',true);
end $$;
create function public.outreach_partner_workspace(p_org uuid,p_action text,p_data jsonb default '{}') returns jsonb language sql security invoker set search_path='' as $$select private.outreach_partner_workspace(p_org,p_action,p_data)$$;
revoke all on function private.outreach_partner_submit(jsonb),public.outreach_partner_submit(jsonb),private.outreach_partner_workspace(uuid,text,jsonb),public.outreach_partner_workspace(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function private.outreach_partner_submit(jsonb),public.outreach_partner_submit(jsonb) to anon,authenticated;
grant execute on function private.outreach_partner_workspace(uuid,text,jsonb),public.outreach_partner_workspace(uuid,text,jsonb) to authenticated;

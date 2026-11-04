-- Canonical GIV-2C private nonfinancial draft core. No seeded users/grants.
-- Exact original source/transforms verified by tools/forms-core. Never replay old Forms installer.
do $$begin
 if current_user<>'postgres'then raise exception 'Exact reviewed postgres installation owner required';end if;
 if to_regclass('public.platform_forms') is not null or to_regprocedure('public.forms_workspace(text,uuid,jsonb)') is not null then raise exception 'Forms exists: exact composition review required';end if;
 if to_regprocedure('private.outreach_verified(uuid)') is null or to_regprocedure('private.has_staff_permission(uuid,text,uuid)') is null then raise exception 'Canonical authority unavailable';end if;
 if md5(pg_get_functiondef('private.has_staff_permission(uuid,text,uuid)'::regprocedure))<>'d9dd9b23e1eddefe8b0e6d863c149677' or (select proowner::regrole::text from pg_proc where oid='private.has_staff_permission(uuid,text,uuid)'::regprocedure)<>'postgres' then raise exception 'Canonical authority definition/owner drift: has_staff_permission';end if;
 if md5(pg_get_functiondef('private.staff_assignment_active(uuid,uuid)'::regprocedure))<>'05149569926640f4d39bca2eda70169d' or (select proowner::regrole::text from pg_proc where oid='private.staff_assignment_active(uuid,uuid)'::regprocedure)<>'postgres' then raise exception 'Canonical authority definition/owner drift: staff_assignment_active';end if;
 if md5(pg_get_functiondef('private.outreach_verified(uuid)'::regprocedure))<>'24578afbb6043b94775a556517b0ad45' or (select proowner::regrole::text from pg_proc where oid='private.outreach_verified(uuid)'::regprocedure)<>'postgres' then raise exception 'Canonical authority definition/owner drift: outreach_verified';end if;
 if coalesce((select array_agg(k order by k) from unnest(private.staff_permission_keys())k),array[]::text[]) not in ((select array_agg(k order by k) from unnest(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send']::text[])k),(select array_agg(k order by k) from unnest(array['people.read','people.create','people.update','people.export','people.notes.view','people.notes.manage','staff.view','staff.manage','finance.read','finance.configure','care.read','discipleship.read','followup.read','followup.manage','households.read','households.manage','tags.read','tags.manage','portal.manage','events.view','events.manage','registrations.view','registrations.manage','outreach.view','outreach.manage','courses.manage','forms.view','forms.manage','communications.send','dream_team.application.read','dream_team.application.restricted']::text[])k)) then raise exception 'Unreviewed permission registry composition';end if;
 if exists(select 1 from pg_tables where schemaname in('public','private')and tablename like 'platform_form%') or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')and p.proname like 'forms_%')then raise exception 'Partial Forms installation requires exact upgrade review';end if;
end$$;
create function private.forms_permissions() returns text[] language sql immutable set search_path='' as $$select array['forms.read','forms.create','forms.edit']::text[]$$;
do $$declare keys text[];begin
 keys:=private.staff_permission_keys()||private.forms_permissions();
 alter table public.organization_staff_permissions drop constraint organization_staff_permissions_permission_check;
 execute format('alter table public.organization_staff_permissions add constraint organization_staff_permissions_permission_check check(permission=any(%L::text[]))',keys);
 execute format('create or replace function private.staff_permission_keys() returns text[] language sql immutable set search_path='''' as %L','select '||quote_literal(keys)||'::text[]');
end$$;

create table public.platform_forms(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),
 name text not null check(length(btrim(name)) between 1 and 160),type text not null check(type in('giving','pledge','event','registration','application','survey','outreach','general','custom')),
 slug text not null check(slug ~ '^[a-z0-9][a-z0-9-]{2,79}$'),description text not null default '' check(length(description)<=2000),
 status text not null default 'draft' check(status in('draft','published','paused','archived')),
 campaign_id uuid,event_reference text check(length(event_reference)<=100),created_by uuid references auth.users(id),
 created_at timestamptz not null default now(),updated_at timestamptz not null default now(),
 unique(organization_id,id),unique(organization_id,slug),foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);

create table public.platform_form_versions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,form_id uuid not null,version int not null check(version>0),
 state text not null default 'draft' check(state in('draft','published')),revision int not null default 1 check(revision>0),
 definition jsonb not null check(jsonb_typeof(definition)='object' and octet_length(definition::text)<=120000),
 name_snapshot text,type_snapshot text,description_snapshot text,published_at timestamptz,created_at timestamptz not null default now(),
 foreign key(organization_id,form_id) references public.platform_forms(organization_id,id),unique(organization_id,id),unique(organization_id,form_id,id),unique(form_id,version)
);

create table public.platform_form_sections(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.platform_form_versions(id),
 section_key text not null,title text not null,position int not null,config jsonb not null,unique(version_id,section_key),unique(version_id,id)
);

create table public.platform_form_fields(
 id uuid primary key default gen_random_uuid(),version_id uuid not null,section_id uuid not null,
 field_key text not null check(field_key ~ '^[a-z][a-z0-9_]{0,63}$'),type text not null,label text not null,position int not null,config jsonb not null,
 foreign key(version_id,section_id) references public.platform_form_sections(version_id,id),unique(version_id,field_key),unique(version_id,id)
);

create table public.platform_form_conditions(
 id uuid primary key default gen_random_uuid(),version_id uuid not null references public.platform_form_versions(id),
 source_key text not null,target_key text not null,operator text not null,operand jsonb,action text not null,position int not null,
 unique(version_id,target_key,action)
);

create table public.platform_form_payments(
 version_id uuid primary key references public.platform_form_versions(id),config jsonb not null,
 classification text not null check(classification in('donation','event_fee','registration_fee','deposit','purchase')),enabled boolean not null default false,
 live_enabled boolean not null default false check(not live_enabled)
);

create table public.platform_form_instances(
 form_id uuid primary key,organization_id uuid not null,version_id uuid not null,
 public_available boolean not null default false,published_at timestamptz not null default now(),
 foreign key(organization_id,form_id) references public.platform_forms(organization_id,id),foreign key(organization_id,version_id) references public.platform_form_versions(organization_id,id),foreign key(organization_id,form_id,version_id) references public.platform_form_versions(organization_id,form_id,id)
);

create table private.platform_form_grants(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,user_id uuid not null references auth.users(id),form_id uuid,campaign_id uuid,
 permissions text[] not null check(cardinality(permissions)>0 and permissions <@ array['forms.read','forms.edit','forms.publish','forms.archive','forms.submissions.read','forms.submissions.export']::text[]),
 active boolean not null default true,effective_at timestamptz not null default now(),expires_at timestamptz,
 check((form_id is null)<>(campaign_id is null)),check(expires_at is null or expires_at>effective_at),
 foreign key(organization_id,form_id) references public.platform_forms(organization_id,id),foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id)
);

create table public.platform_form_audit(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),form_id uuid not null references public.platform_forms(id),
 actor_user_id uuid references auth.users(id),action text not null,subject_id uuid,created_at timestamptz not null default now()
);

create unique index platform_form_one_draft on public.platform_form_versions(form_id) where state='draft';
create index platform_form_grant_user on private.platform_form_grants(user_id,organization_id);
create index platform_form_audit_form on public.platform_form_audit(form_id,created_at,id);

create function private.forms_lock(o uuid) returns void language sql volatile set search_path='' as $$select pg_advisory_xact_lock(hashtextextended('forms:'||o::text,0))$$;

create function private.forms_can(o uuid,k text,f uuid default null) returns boolean language sql volatile security definer set search_path='' as $$
 select private.outreach_verified(auth.uid()) and (private.has_staff_permission(o,k) or (k<>'forms.payment.configure' and exists(
 select 1 from private.platform_form_grants g join public.platform_forms x on x.organization_id=g.organization_id and x.id=f
 where g.organization_id=o and g.user_id=auth.uid() and g.active and g.effective_at<=now() and (g.expires_at is null or g.expires_at>now()) and k=any(g.permissions)
 and (g.form_id=f or g.campaign_id=x.campaign_id))))
$$;

create function private.forms_audit(o uuid,f uuid,a text,s uuid default null) returns void language sql security definer set search_path='' as $$
 insert into public.platform_form_audit(organization_id,form_id,actor_user_id,action,subject_id)values(o,f,auth.uid(),a,s)
$$;

create function private.forms_frozen() returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare v uuid;begin
 if tg_table_name='platform_form_versions' then if old.state='published' then raise exception 'Published version is immutable' using errcode='42501';end if;
 else v:=case when tg_op='DELETE' then old.version_id else new.version_id end;
 if exists(select 1 from public.platform_form_versions where id=v and state='published') or (tg_op='UPDATE' and exists(select 1 from public.platform_form_versions where id=old.version_id and state='published')) then raise exception 'Published definition is immutable' using errcode='42501';end if;end if;
 if tg_op='DELETE' then return old;end if;return new;
end$$;

create function private.forms_shape(p jsonb,keys text[],max_bytes int default 120000) returns void language plpgsql set search_path='' as $$begin
 if p is null or jsonb_typeof(p)<>'object' or octet_length(p::text)>max_bytes or exists(select 1 from jsonb_object_keys(p) k where not k=any(keys))then raise exception 'Unsupported form fields' using errcode='22023';end if;
end$$;

create function private.forms_safe_link(v text) returns boolean language sql immutable set search_path='' as $$
 select v is null or v='' or v ~ '^/[a-zA-Z0-9][a-zA-Z0-9/_-]*(\.html)?$'
$$;

create function private.forms_instant(value text,zone text)returns timestamptz language plpgsql stable set search_path='' as $$begin
 if value is null or value=''then return null;end if;
 if value!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}[T ][0-9]{2}:[0-9]{2}(:[0-9]{2})?(Z|[+-][0-9]{2}:[0-9]{2})?$'then raise exception 'Use an ISO date/time';end if;
 if value~'(Z|[+-][0-9]{2}:[0-9]{2})$'then return value::timestamptz;end if;
 return value::timestamp at time zone zone;
end$$;

create function private.forms_compile(v uuid,d jsonb)returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare s jsonb;f jsonb;c jsonb;sid uuid;sp int:=0;fp int;cp int:=0;begin
 delete from public.platform_form_conditions where version_id=v;delete from public.platform_form_fields where version_id=v;delete from public.platform_form_sections where version_id=v;delete from public.platform_form_payments where version_id=v;
 for s in select value from jsonb_array_elements(d->'sections')loop
 insert into public.platform_form_sections(version_id,section_key,title,position,config)values(v,s->>'key',coalesce(s->>'title',''),sp,s-'fields')returning id into sid;sp:=sp+1;fp:=0;
 for f in select value from jsonb_array_elements(s->'fields')loop
 insert into public.platform_form_fields(version_id,section_id,field_key,type,label,position,config)values(v,sid,f->>'key',f->>'type',coalesce(f->>'label',''),fp,f);fp:=fp+1;end loop;end loop;
 for c in select value from jsonb_array_elements(coalesce(d->'conditions','[]'))loop
 insert into public.platform_form_conditions(version_id,source_key,target_key,operator,operand,action,position)values(v,c->>'source',c->>'target',c->>'operator',c->'value',c->>'action',cp);cp:=cp+1;end loop;
 if coalesce((d#>>'{payment,enabled}')::boolean,false)then insert into public.platform_form_payments values(v,d->'payment',d#>>'{payment,classification}',true,false);end if;
end$$;

create function private.forms_value(f jsonb,v jsonb,required boolean)returns void language plpgsql set search_path='' as $$
#variable_conflict use_column
declare typ text:=f->>'type';t text:=v#>>'{}';minv numeric;maxv numeric;item jsonb;begin
 if required and (v is null or v='null' or v='""' or v='[]' or typ in('consent','checkbox')and v<>'true')then raise exception 'Required field: %',f->>'key'using errcode='22023';end if;
 if v is null or v='null' or v='""'then return;end if;
 if octet_length(v::text)>12000 then raise exception 'Answer too large';end if;
 if typ in('number','currency','gift_amount')then
 if t!~'^-?[0-9]{1,12}(\.[0-9]{1,4})?$'or (typ in('currency','gift_amount')and t!~'^[0-9]{1,13}$')then raise exception 'Invalid number/minor units';end if;
 minv:=(f#>>'{validation,min}')::numeric;maxv:=(f#>>'{validation,max}')::numeric;
 if typ='gift_amount' and t::bigint<coalesce((f#>>'{amount,minimum_minor}')::bigint,1)then raise exception 'Gift amount below field minimum';end if;
 if(minv is not null and t::numeric<minv)or(maxv is not null and t::numeric>maxv)then raise exception 'Number out of range';end if;
 elsif typ in('checkbox','consent','yes_no')then if jsonb_typeof(v)<>'boolean'then raise exception 'Boolean required';end if;
 elsif typ='date'then if t!~'^[0-9]{4}-[0-9]{2}-[0-9]{2}$'then raise exception 'Date required';end if;perform t::date;if (f#>>'{validation,min}'is not null and t::date<(f#>>'{validation,min}')::date)or(f#>>'{validation,max}'is not null and t::date>(f#>>'{validation,max}')::date)then raise exception 'Date outside allowed range';end if;
 elsif typ='time'then if t!~'^([01][0-9]|2[0-3]):[0-5][0-9]$'then raise exception 'Time required';end if;if(f#>>'{validation,min}'is not null and t::time<(f#>>'{validation,min}')::time)or(f#>>'{validation,max}'is not null and t::time>(f#>>'{validation,max}')::time)then raise exception 'Time outside allowed range';end if;
 elsif typ='address'then perform private.forms_shape(v,array['line1','line2','city','region','postal_code','country'],3000);if required and coalesce(v->>'line1','')=''then raise exception 'Address required';end if;
 elsif typ='fund'and coalesce((f->>'multiple')::boolean,false)then
 if jsonb_typeof(v)<>'array'or jsonb_array_length(v) not between 1 and 30 then raise exception 'Fund lines required';end if;
 for item in select value from jsonb_array_elements(v)loop perform private.forms_shape(item,array['fund_id','amount_minor']);if coalesce(item->>'amount_minor','')!~'^[0-9]{1,13}$'or (item->>'amount_minor')::bigint<1 then raise exception 'Invalid line amount';end if;perform (item->>'fund_id')::uuid;end loop;
 elsif typ='file'then if jsonb_typeof(v)<>'string'then raise exception 'File reference required';end if;perform t::uuid;
 elsif typ in('dropdown','multiple_choice','radio_group','checkbox_group')then
 if typ='checkbox_group'then if jsonb_typeof(v)<>'array' then raise exception 'Choices required';end if;
 for item in select value from jsonb_array_elements(v)loop if not exists(select 1 from jsonb_array_elements(coalesce(f->'options','[]'))opt where coalesce((opt->>'active')::boolean,true)and opt->>'value'=item#>>'{}')then raise exception 'Unknown choice';end if;end loop;
 elsif not exists(select 1 from jsonb_array_elements(coalesce(f->'options','[]'))opt where coalesce((opt->>'active')::boolean,true)and opt->>'value'=t)then raise exception 'Unknown choice';end if;
 else
 if jsonb_typeof(v)<>'string' or length(t)>coalesce((f#>>'{validation,max_length}')::int,4000)or length(t)<coalesce((f#>>'{validation,min_length}')::int,0)then raise exception 'Invalid text length/type';end if;
 if typ='email'and (length(t)>254 or t!~'^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$')then raise exception 'Invalid email';end if;
 if typ='phone'and (t!~'^\+?[0-9 ()-]{7,25}$'or length(regexp_replace(t,'[^0-9]','','g'))not between 7 and 15)then raise exception 'Invalid phone';end if;
 if f#>>'{validation,pattern}'='alphanumeric'and t!~'^[a-zA-Z0-9 _-]+$'then raise exception 'Invalid alphanumeric value';end if;
 if f#>>'{validation,pattern}'='postal_code'and t!~'^[a-zA-Z0-9 -]{2,12}$'then raise exception 'Invalid postal code';end if;end if;
end$$;

create function private.forms_private_definition(d jsonb) returns void language plpgsql set search_path='' as $$begin
 if d is null or jsonb_typeof(d)<>'object' or d->'payment' is distinct from '{}'::jsonb or d#>'{settings,public_available}' is distinct from 'false'::jsonb then raise exception 'Only private nonfinancial definitions are available' using errcode='22023';end if;
 if exists(select 1 from jsonb_array_elements(d->'sections') s cross join lateral jsonb_array_elements(s->'fields') f where f->>'type' in ('currency','fund','gift_amount','payment'))then raise exception 'Financial fields unavailable in private draft core' using errcode='22023';end if;
end$$;

create function private.forms_validate(o uuid,d jsonb,publish boolean default false) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare s jsonb;f jsonb;c jsonb;opt jsonb;keys text[]:='{}';sections text[]:='{}';allkeys text[];st jsonb;pay jsonb;typ text;fund text;cycle boolean;begin
 perform private.forms_private_definition(d);
 perform private.forms_shape(d,array['sections','conditions','settings','payment']);st:=coalesce(d->'settings','{}');pay:=coalesce(d->'payment','{}');
 perform private.forms_shape(st,array['branding','public_available','starts_at','ends_at','timezone','max_submissions','success_message','redirect','next_link','notification_hook','step_hook']);
 perform private.forms_shape(pay,array['enabled','required','classification','currency','fixed_minor','minimum_minor','amount_key','fund_key','lines_key','allowed_funds','default_fund','multiple_lines','recurring_key','frequencies','anonymous_key','receipt_key','fee_option','destination_override','pledge_key','pledge_start_key','pledge_end_key']);
 if not private.forms_safe_link(st->>'redirect') or not private.forms_safe_link(st->>'next_link') or length(coalesce(st->>'success_message',''))>1000 or coalesce(st->>'branding','champion-life')<>'champion-life' then raise exception 'Unsafe form settings';end if;
 if st ? 'timezone' and not exists(select 1 from pg_timezone_names where name=st->>'timezone')then raise exception 'Unknown timezone';end if;
 perform private.forms_instant(st->>'starts_at',coalesce(st->>'timezone','UTC'));perform private.forms_instant(st->>'ends_at',coalesce(st->>'timezone','UTC'));
 if nullif(st->>'max_submissions','') is not null and (st->>'max_submissions')::int not between 1 and 1000000 then raise exception 'Invalid submission limit';end if;
 if nullif(st->>'starts_at','') is not null and nullif(st->>'ends_at','') is not null and private.forms_instant(st->>'starts_at',coalesce(st->>'timezone','UTC')) >= private.forms_instant(st->>'ends_at',coalesce(st->>'timezone','UTC')) then raise exception 'Invalid availability dates';end if;
 if jsonb_typeof(d->'sections')<>'array' or jsonb_array_length(d->'sections') not between 1 and 30 or jsonb_typeof(coalesce(d->'conditions','[]'))<>'array' or jsonb_array_length(coalesce(d->'conditions','[]'))>200 then raise exception 'Sections required';end if;
 for s in select value from jsonb_array_elements(d->'sections')loop
 perform private.forms_shape(s,array['key','title','description','columns','hidden','grouping','step','fields']);
 if coalesce(s->>'key','')!~'^[a-z][a-z0-9_]{0,63}$' or s->>'key'=any(sections) or coalesce(s->>'columns','1') not in('1','2','3') or length(coalesce(s->>'title',''))>160 or length(coalesce(s->>'description',''))>2000 or jsonb_typeof(s->'fields')<>'array' then raise exception 'Invalid section';end if;
 sections:=array_append(sections,s->>'key');
 for f in select value from jsonb_array_elements(s->'fields')loop
 perform private.forms_shape(f,array['key','type','label','help','placeholder','required','default','width','hidden','readonly','description','options','validation','file','agreement','amount','multiple','mobile_width','format']);
 typ:=f->>'type';
 if coalesce(f->>'key','')!~'^[a-z][a-z0-9_]{0,63}$' or f->>'key'=any(keys) or f->>'key'=any(sections) or typ is null or typ not in('heading','paragraph','divider','spacer','name','email','phone','address','short_text','long_text','number','currency','date','time','dropdown','multiple_choice','checkbox','checkbox_group','radio_group','yes_no','file','signature','hidden','fund','gift_amount','payment','submit','consent') then raise exception 'Invalid or duplicate field key/type' using errcode='23505';end if;
 if length(coalesce(f->>'label',''))>160 or length(coalesce(f->>'description',''))>4000 or length(coalesce(f->>'help',''))>1000 or (publish and typ not in('divider','spacer','hidden') and btrim(coalesce(f->>'label',''))='') or coalesce(f->>'width','full') not in('full','half','third','two_thirds') or coalesce(f->>'mobile_width','full')<>'full' then raise exception 'Field label/layout invalid';end if;
 if coalesce(f->>'format','plain')not in('plain','bold','italic','bullet_list')then raise exception 'Unsupported text formatting';end if;
 keys:=array_append(keys,f->>'key');
 perform private.forms_shape(coalesce(f->'validation','{}'),array['min','max','min_length','max_length','pattern']);
 if coalesce(f#>>'{validation,pattern}','') not in('','alphanumeric','postal_code') then raise exception 'Unsupported safe pattern';end if;
 if f#>>'{validation,min}' is not null and f#>>'{validation,max}' is not null then
 if (case typ when 'date'then (f#>>'{validation,min}')::date>(f#>>'{validation,max}')::date when 'time'then (f#>>'{validation,min}')::time>(f#>>'{validation,max}')::time else (f#>>'{validation,min}')::numeric>(f#>>'{validation,max}')::numeric end) then raise exception 'Invalid bounds';end if;end if;
 if coalesce((f#>>'{validation,min_length}')::int,0)<0 or coalesce((f#>>'{validation,max_length}')::int,4000) not between 1 and 4000 then raise exception 'Invalid text bounds';end if;
 if f ? 'options' then
 if jsonb_typeof(f->'options')<>'array' or jsonb_array_length(f->'options')>100 or exists(select 1 from jsonb_array_elements(f->'options') x group by x->>'value' having count(*)>1)then raise exception 'Invalid choices';end if;
 for opt in select value from jsonb_array_elements(f->'options')loop
 perform private.forms_shape(opt,array['label','value','active','metadata']);if btrim(coalesce(opt->>'label',''))='' or coalesce(opt->>'value','')='' or length(opt->>'value')>100 or length(opt->>'label')>160 then raise exception 'Invalid choice';end if;end loop;end if;
 if typ='file' then
 perform private.forms_shape(coalesce(f->'file','{}'),array['types','max_bytes','visibility']);
 if coalesce(f#>>'{file,visibility}','private') not in('private','public') or coalesce((f#>>'{file,max_bytes}')::bigint,10485760) not between 1 and 10485760 or jsonb_typeof(f#>'{file,types}')<>'array' or exists(select 1 from jsonb_array_elements_text(f#>'{file,types}')t where t not in('image/png','image/jpeg','application/pdf','text/plain'))then raise exception 'Invalid file policy';end if;end if;
 if typ='consent'and f->'default'='true'::jsonb then raise exception 'Consent must default off';end if;
 if typ='signature'and coalesce(f->>'default','')<>''then raise exception 'Signature requires explicit signer input';end if;
 if f ? 'default'then perform private.forms_value(f,f->'default',false);end if;
 if typ in('signature','consent') then
 perform private.forms_shape(coalesce(f->'agreement','{}'),array['text','version','purpose']);if publish and (coalesce(f#>>'{agreement,text}','')='' or coalesce(f#>>'{agreement,version}','')='' or coalesce(f#>>'{agreement,purpose}','')='')then raise exception 'Explicit agreement context required';end if;end if;
 if f ? 'amount' then perform private.forms_shape(f->'amount',array['suggested','minimum_minor','default_minor']);end if;
 end loop;end loop;
 if cardinality(keys)>200 or exists(select 1 from unnest(keys)k where k=any(sections))then raise exception 'Invalid field count/section collision';end if;
 allkeys:=keys||sections;
 for c in select value from jsonb_array_elements(coalesce(d->'conditions','[]'))loop
 perform private.forms_shape(c,array['source','operator','value','action','target']);
 if not coalesce(c->>'source'=any(keys),false) or not coalesce(c->>'target'=any(allkeys),false) or c->>'source'=c->>'target' or coalesce(c->>'operator','') not in('equals','not_equals','contains','not_contains','is_empty','is_not_empty','greater_than','less_than') or coalesce(c->>'action','') not in('show','hide','require','disable')then raise exception 'Invalid condition reference';end if;
 select x->>'type' into typ from jsonb_array_elements(d->'sections')z cross join lateral jsonb_array_elements(z->'fields')x where x->>'key'=c->>'source';
 if c->>'operator' in('greater_than','less_than') and typ not in('number','currency','gift_amount')then raise exception 'Operator incompatible with source';end if;
 end loop;
 if exists(select 1 from jsonb_array_elements(coalesce(d->'conditions','[]')) c group by c->>'target',c->>'action' having count(*)>1)then raise exception 'Ambiguous condition actions';end if;
 with recursive edges as(
 select c->>'source' a,c->>'target' b from jsonb_array_elements(coalesce(d->'conditions','[]'))c
 union all select s->>'key',f->>'key' from jsonb_array_elements(d->'sections')s cross join lateral jsonb_array_elements(s->'fields')f
 ), reach(a,b)as(select a,b from edges union select r.a,e.b from reach r join edges e on e.a=r.b)
 select exists(select 1 from reach where a=b) into cycle;if cycle then raise exception 'Conditional cycle';end if;
end$$;

-- Same unconditional append-only behavior as original giving_immutable; no Giving imports.
create function private.forms_history_immutable() returns trigger language plpgsql set search_path='' as $$begin raise exception 'Forms history is append-only' using errcode='42501';end$$;
create trigger forms_version_frozen before update or delete on public.platform_form_versions for each row execute function private.forms_frozen();
do $$declare t text;begin
 foreach t in array array['platform_form_sections','platform_form_fields','platform_form_conditions','platform_form_payments']loop
 execute format('create trigger forms_child_frozen before insert or update or delete on public.%I for each row execute function private.forms_frozen()',t);end loop;
end$$;
create trigger forms_history_immutable before update or delete on public.platform_form_audit for each row execute function private.forms_history_immutable();

-- Wall-clock checks supplement, never replace, existing canonical authority semantics.
create function private.forms_authorized(o uuid,k text,f uuid default null) returns boolean language sql volatile security definer set search_path='' as $$
 select k=any(private.forms_permissions()) and private.forms_can(o,k,f) and (
 exists(select 1 from public.organization_staff_directory d join public.organization_staff_permissions p on p.organization_id=d.organization_id and p.user_id=d.user_id
 where d.organization_id=o and d.user_id=auth.uid() and d.active and d.effective_at<=clock_timestamp() and (d.expires_at is null or d.expires_at>clock_timestamp())
 and p.permission=k and p.department_ids is null and p.revoked_at is null and p.effective_at<=clock_timestamp() and (p.expires_at is null or p.expires_at>clock_timestamp())
 and(d.person_id is null or exists(select 1 from public.portal_account_links l where l.organization_id=o and l.person_id=d.person_id and l.user_id=d.user_id and l.active)))
 or exists(select 1 from private.platform_form_grants g join public.platform_forms x on x.organization_id=g.organization_id and x.id=f
 where g.organization_id=o and g.user_id=auth.uid() and g.active and g.effective_at<=clock_timestamp() and(g.expires_at is null or g.expires_at>clock_timestamp())and k=any(g.permissions)and(g.form_id=f or g.campaign_id=x.campaign_id)))
$$;
create function private.forms_lock_authority(o uuid,k text,f uuid default null) returns void language plpgsql security definer set search_path='' as $$begin
 -- Compatible with existing staff and portal writers; then deterministic row locks.
 perform pg_advisory_xact_lock_shared(hashtextextended(o::text,0));
 perform pg_advisory_xact_lock_shared(hashtextextended(o::text||':portal',0));
 perform private.forms_lock(o);
 if f is not null then
 perform 1 from public.platform_forms where organization_id=o and id=f for update;
 perform 1 from public.platform_form_versions where organization_id=o and form_id=f and state='draft' order by id for update;
 end if;
 -- Managed target must support these exact owner privileges; no Auth ACL modification.
 perform 1 from auth.users where id=auth.uid() for share;
 perform 1 from public.organization_staff_directory where organization_id=o and user_id=auth.uid() for share;
 perform 1 from public.organization_staff_permissions where organization_id=o and user_id=auth.uid() order by permission for share;
 perform 1 from public.portal_account_links where organization_id=o and user_id=auth.uid() order by person_id for share;
 perform 1 from private.platform_form_grants where organization_id=o and user_id=auth.uid() order by id for share;
 if not private.forms_authorized(o,k,f)then raise exception 'Forms access denied' using errcode='42501';end if;
end$$;

create function private.forms_workspace(a text,o uuid,p jsonb) returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f public.platform_forms;v public.platform_form_versions;d jsonb;required_permission text;caps jsonb:=jsonb_build_object('profile','private_draft_v1','actions',jsonb_build_array('context','list','create','get','draft','save'),'submissions',false,'publication',false,'financial',false);begin
 if not private.outreach_verified(auth.uid())then raise exception 'Verified staff identity required' using errcode='42501';end if;
 if a is null or not a=any(array['context','list','create','get','draft','save'])then raise exception 'Forms capability unavailable in private draft core' using errcode='0A000';end if;
 if a='context'then return jsonb_build_object('capabilities',caps,'organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select coalesce(jsonb_agg(k),'[]')from unnest(private.forms_permissions())k where private.forms_authorized(x.id,k)),'scoped_forms',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_authorized(x.id,k,t.id)))),'[]')from public.platform_forms t where t.organization_id=x.id and exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(x.id,k,t.id))))),'[]')from public.organizations x where exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(x.id,k))or exists(select 1 from public.platform_forms t where t.organization_id=x.id and exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(x.id,k,t.id)))));end if;
 perform private.forms_shape(p,array['id','name','type','slug','description','campaign_id','event_reference','revision','definition','status']);
 required_permission:=case when a='create'then 'forms.create'when a in('save','draft')then 'forms.edit'else 'forms.read'end;
 if a not in('create','list')then select * into f from public.platform_forms where organization_id=o and id=(p->>'id')::uuid;if f.id is null then raise exception 'Form unavailable' using errcode='42501';end if;end if;
 if a in('create','draft','save')then perform private.forms_lock_authority(o,required_permission,f.id);
 elsif a<>'list'and not private.forms_authorized(o,required_permission,f.id)then raise exception 'Forms access denied' using errcode='42501';end if;
 if a='list'then
 if not exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(o,k))and not exists(select 1 from public.platform_forms x where x.organization_id=o and exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(o,k,x.id)))then raise exception 'Forms access denied'using errcode='42501';end if;
 return jsonb_build_object('capabilities',caps,'forms',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_authorized(o,k,x.id)),'published_version',null,'last_published',null,'payment_enabled',false,'submission_count',null)order by x.updated_at desc),'[]')from public.platform_forms x where x.organization_id=o and exists(select 1 from unnest(private.forms_permissions())k where private.forms_authorized(o,k,x.id))));
 elsif a='create'then
 if p->>'type' is null or p->>'type' in('giving','pledge')then raise exception 'Only nonfinancial form intent is available'using errcode='22023';end if;
 d:=p->'definition';perform private.forms_validate(o,d);
 -- Natural unique slug is a bounded retry identity; never reuse another creator's form.
 select * into f from public.platform_forms where organization_id=o and slug=p->>'slug';
 if f.id is not null then
 select * into v from public.platform_form_versions where form_id=f.id and state='draft';
 if f.created_by=auth.uid() and f.status='draft' and v.version=1 and v.revision=1 and v.definition=d and f.name=p->>'name' and f.type=p->>'type' and f.description=coalesce(p->>'description','') and f.campaign_id is not distinct from (p->>'campaign_id')::uuid and f.event_reference is not distinct from p->>'event_reference' then
 return jsonb_build_object('form',to_jsonb(f),'version',to_jsonb(v),'permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_authorized(o,k,f.id)),'capabilities',caps);
 end if;raise exception 'Form slug already exists; reload before retrying'using errcode='PT409';end if;
 insert into public.platform_forms(organization_id,name,type,slug,description,campaign_id,event_reference,created_by)values(o,p->>'name',p->>'type',p->>'slug',coalesce(p->>'description',''),(p->>'campaign_id')::uuid,p->>'event_reference',auth.uid())returning * into f;
 insert into public.platform_form_versions(organization_id,form_id,version,definition)values(o,f.id,1,d)returning * into v;perform private.forms_compile(v.id,d);perform private.forms_audit(o,f.id,'form.created',v.id);
 elsif a in('get','draft')then
 select * into v from public.platform_form_versions where form_id=f.id and state='draft';
 if v.id is null then raise exception 'Draft unavailable; exact module composition review required'using errcode='42501';end if;
 elsif a='save'then
 select * into v from public.platform_form_versions where form_id=f.id and state='draft' for update;
 if not private.forms_authorized(o,required_permission,f.id)then raise exception 'Forms access expired'using errcode='42501';end if;
 if jsonb_typeof(p->'revision') is distinct from 'number' or (p->>'revision')!~'^[1-9][0-9]*$' or v.id is null or v.revision is distinct from (p->>'revision')::int then raise exception 'Draft changed. Reload before saving.' using errcode='PT409';end if;
 if p->>'type' in('giving','pledge')then raise exception 'Financial form intent unavailable'using errcode='22023';end if;
 d:=p->'definition';perform private.forms_validate(o,d);perform private.forms_compile(v.id,d);
 update public.platform_form_versions set definition=d,revision=revision+1 where id=v.id returning * into v;
 update public.platform_forms set name=coalesce(p->>'name',name),type=coalesce(p->>'type',type),description=coalesce(p->>'description',description),updated_at=now()where id=f.id returning * into f;perform private.forms_audit(o,f.id,'draft.saved',v.id);
 end if;
 return jsonb_build_object('form',to_jsonb(f),'version',to_jsonb(v),'permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_authorized(o,k,f.id)),'capabilities',caps);
end$$;
create function public.forms_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.forms_workspace(p_action,p_org,p_payload)$$;
-- Explicitly deny inherited raw privileges; no installation creates users, staff grants or issuer.
do $$declare r record;begin
 for r in select schemaname,tablename from pg_tables where schemaname in('public','private')and tablename like 'platform_form%'loop
 execute format('alter table %I.%I enable row level security',r.schemaname,r.tablename);
 execute format('revoke all on %I.%I from public,anon,authenticated,service_role',r.schemaname,r.tablename);end loop;
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'forms_%'loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;
end$$;
revoke all on function public.forms_workspace(text,uuid,jsonb)from public,anon,authenticated,service_role;
grant execute on function public.forms_workspace(text,uuid,jsonb),private.forms_workspace(text,uuid,jsonb)to authenticated;

-- GIV-2C BUILD ONLY. No live checkout, delivery, grants, or existing form migration.
create function private.forms_permissions() returns text[] language sql immutable set search_path='' as $$
 select array['forms.read','forms.create','forms.edit','forms.publish','forms.archive','forms.submissions.read','forms.submissions.export','forms.payment.configure']::text[]
$$;
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
create unique index platform_form_one_draft on public.platform_form_versions(form_id) where state='draft';
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
create index platform_form_grant_user on private.platform_form_grants(user_id,organization_id);
create table public.platform_form_submissions(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,form_id uuid not null,version_id uuid not null,request_key uuid not null,
 reference text not null unique default ('F-'||upper(replace(gen_random_uuid()::text,'-',''))),
 status text not null default 'received' check(status in('received','needs_review','reviewed','cancelled')),
 link_status text not null default 'unmatched' check(link_status in('unmatched','reviewed_match','linked')),person_id uuid,household_id uuid,
 giving_session_id uuid,pledge_id uuid,payment_status text not null default 'none' check(payment_status in('none','provider_not_configured','pending','completed','failed')),
 payload_digest text not null,source text not null default 'public_form',submitted_at timestamptz not null default now(),revision int not null default 1,
 foreign key(organization_id,form_id) references public.platform_forms(organization_id,id),foreign key(organization_id,version_id) references public.platform_form_versions(organization_id,id),foreign key(organization_id,form_id,version_id) references public.platform_form_versions(organization_id,form_id,id),
 foreign key(organization_id,person_id) references public.organization_people(organization_id,id),foreign key(organization_id,household_id) references public.households(organization_id,id),
 foreign key(organization_id,giving_session_id) references public.giving_sessions(organization_id,id),foreign key(organization_id,pledge_id) references public.giving_pledges(organization_id,id),
 unique(form_id,request_key),unique(organization_id,id),unique(id,version_id)
);
create index platform_form_submitted on public.platform_form_submissions(form_id,submitted_at,id);
create index platform_form_person on public.platform_form_submissions(organization_id,person_id);
create index platform_form_household on public.platform_form_submissions(organization_id,household_id);
create index platform_form_session on public.platform_form_submissions(organization_id,giving_session_id);
create index platform_form_pledge on public.platform_form_submissions(organization_id,pledge_id);
create table public.platform_form_answers(
 submission_id uuid not null,version_id uuid not null,field_id uuid not null,field_key text not null,label_snapshot text not null,type text not null,
 submitted_value jsonb not null,text_value text,number_value numeric(30,4),boolean_value boolean,date_value date,structured_value jsonb,
 foreign key(submission_id,version_id) references public.platform_form_submissions(id,version_id),foreign key(version_id,field_id) references public.platform_form_fields(version_id,id),
 primary key(submission_id,field_key)
);
create index platform_form_answer_field on public.platform_form_answers(version_id,field_id);
create table public.platform_form_agreements(
 id uuid primary key default gen_random_uuid(),submission_id uuid not null references public.platform_form_submissions(id),field_key text not null,
 kind text not null check(kind in('signature','consent')),signer text,agreement_text text not null,agreement_version text not null,purpose text not null,
 checked boolean not null,recorded_at timestamptz not null default now(),unique(submission_id,field_key)
);
create table private.platform_form_files(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null,form_id uuid not null,version_id uuid not null,request_key uuid not null,
 field_key text not null,object_path text not null unique,filename text not null,mime text not null,size_bytes bigint not null check(size_bytes between 1 and 10485760),
 visibility text not null check(visibility in('private','public')),expires_at timestamptz not null default (now()+interval '15 minutes'),submission_id uuid,
 foreign key(organization_id,form_id) references public.platform_forms(organization_id,id),foreign key(organization_id,version_id) references public.platform_form_versions(organization_id,id),foreign key(organization_id,form_id,version_id) references public.platform_form_versions(organization_id,form_id,id),
 foreign key(organization_id,submission_id) references public.platform_form_submissions(organization_id,id)
);
create index platform_form_file_submission on private.platform_form_files(submission_id);
create table public.platform_form_audit(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),form_id uuid not null references public.platform_forms(id),
 actor_user_id uuid references auth.users(id),action text not null,subject_id uuid,created_at timestamptz not null default now()
);
create index platform_form_audit_form on public.platform_form_audit(form_id,created_at,id);
create table public.platform_form_events(
 id uuid primary key default gen_random_uuid(),organization_id uuid not null references public.organizations(id),submission_id uuid not null references public.platform_form_submissions(id),
 kind text not null check(kind in('form.submitted','form.needs_review','form.payment_completed')),delivery_state text not null default 'held' check(delivery_state='held'),
 created_at timestamptz not null default now(),unique(submission_id,kind)
);
create table private.platform_form_rate(network text not null,form_id uuid not null references public.platform_forms(id),window_at timestamptz not null,count int not null,primary key(network,form_id,window_at));
insert into storage.buckets(id,name,public,file_size_limit,allowed_mime_types)values('platform-form-files','platform-form-files',false,10485760,array['image/png','image/jpeg','application/pdf','text/plain']);

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
create trigger forms_version_frozen before update or delete on public.platform_form_versions for each row execute function private.forms_frozen();
do $$declare t text;begin
 foreach t in array array['platform_form_sections','platform_form_fields','platform_form_conditions','platform_form_payments']loop
 execute format('create trigger forms_child_frozen before insert or update or delete on public.%I for each row execute function private.forms_frozen()',t);end loop;
 foreach t in array array['platform_form_answers','platform_form_agreements','platform_form_audit','platform_form_events']loop
 execute format('create trigger forms_history_immutable before update or delete on public.%I for each row execute function private.giving_immutable()',t);end loop;
 foreach t in array array['platform_forms','platform_form_versions','platform_form_sections','platform_form_fields','platform_form_conditions','platform_form_payments','platform_form_instances','platform_form_submissions','platform_form_answers','platform_form_agreements','platform_form_audit','platform_form_events']loop
 execute format('alter table public.%I enable row level security',t);execute format('revoke all on public.%I from public,anon,authenticated,service_role',t);end loop;
 foreach t in array array['platform_form_grants','platform_form_files','platform_form_rate']loop
 execute format('alter table private.%I enable row level security',t);execute format('revoke all on private.%I from public,anon,authenticated,service_role',t);end loop;
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
create function private.forms_validate(o uuid,d jsonb,publish boolean default false) returns void language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare s jsonb;f jsonb;c jsonb;opt jsonb;keys text[]:='{}';sections text[]:='{}';allkeys text[];st jsonb;pay jsonb;typ text;fund text;cycle boolean;begin
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
 if coalesce((pay->>'enabled')::boolean,false) then
 if coalesce(pay->>'classification','') not in('donation','event_fee','registration_fee','deposit','purchase') or not exists(select 1 from public.giving_organization_config where organization_id=o and currency=pay->>'currency')then raise exception 'Invalid payment classification/currency';end if;
 if jsonb_typeof(pay->'allowed_funds')<>'array' or jsonb_array_length(pay->'allowed_funds') not between 1 and 30 then raise exception 'Canonical funds required';end if;
 for fund in select value from jsonb_array_elements_text(pay->'allowed_funds')loop
 if not exists(select 1 from public.giving_funds where organization_id=o and id=fund::uuid and status='active' and is_public)then raise exception 'Public fund unavailable';end if;
 if pay ? 'destination_override' then perform private.giving_route(o,fund::uuid,(pay->>'destination_override')::uuid);end if;end loop;
 if pay ? 'default_fund' and not pay->'allowed_funds' ? (pay->>'default_fund')then raise exception 'Invalid default fund';end if;
 if nullif(pay->>'fixed_minor','') is not null and ((pay->>'fixed_minor')::bigint not between 1 and 1000000000000)then raise exception 'Invalid fixed amount';end if;
 foreach fund in array array['amount_key','fund_key','lines_key','recurring_key','anonymous_key','receipt_key','pledge_key','pledge_start_key','pledge_end_key']loop
 if pay ? fund and not pay->>fund=any(keys)then raise exception 'Broken payment field reference';end if;end loop;
 if publish and not exists(select 1 from jsonb_array_elements(d->'sections')s cross join lateral jsonb_array_elements(s->'fields')f where f->>'type'='payment')then raise exception 'Payment element required';end if;
 elsif exists(select 1 from jsonb_array_elements(d->'sections')s cross join lateral jsonb_array_elements(s->'fields')f where f->>'type'='payment') and publish then raise exception 'Payment configuration required';end if;
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

create function private.forms_condition(op text,v jsonb,w jsonb)returns boolean language plpgsql immutable set search_path='' as $$begin
 return case op when 'equals' then coalesce(v=w,false)when 'not_equals' then not coalesce(v=w,false)
 when 'is_empty' then v is null or v='null' or v='""' or v='[]'
 when 'is_not_empty' then not(v is null or v='null' or v='""' or v='[]')
 when 'contains' then case when jsonb_typeof(v)='array' then v @> jsonb_build_array(w)else position(coalesce(w#>>'{}','')in coalesce(v#>>'{}',''))>0 end
 when 'not_contains' then not private.forms_condition('contains',v,w)
 when 'greater_than' then coalesce((v#>>'{}')::numeric>(w#>>'{}')::numeric,false)
 when 'less_than' then coalesce((v#>>'{}')::numeric<(w#>>'{}')::numeric,false)else false end;
end$$;
create function private.forms_state(d jsonb,answers jsonb)returns jsonb language plpgsql immutable set search_path='' as $$
#variable_conflict use_column
declare state jsonb:='{}';base jsonb;prior jsonb;s jsonb;f jsonb;c jsonb;x jsonb;v jsonb;pass int;test boolean;begin
 for s in select value from jsonb_array_elements(d->'sections')loop
 state:=state||jsonb_build_object(s->>'key',jsonb_build_object('hidden',coalesce((s->>'hidden')::boolean,false),'required',false,'disabled',false));
 for f in select value from jsonb_array_elements(s->'fields')loop
 state:=state||jsonb_build_object(f->>'key',jsonb_build_object('hidden',coalesce((f->>'hidden')::boolean,false)or f->>'type'='hidden','required',coalesce((f->>'required')::boolean,false),'disabled',coalesce((f->>'readonly')::boolean,false)));end loop;end loop;
 base:=state;
 for pass in 1..201 loop prior:=state;state:=base;
 for c in select value from jsonb_array_elements(coalesce(d->'conditions','[]'))loop
 v:=answers->(c->>'source');if coalesce((prior#>>array[c->>'source','hidden'])::boolean,false)or coalesce((prior#>>array[c->>'source','disabled'])::boolean,false)then v:=null;end if;
 test:=private.forms_condition(c->>'operator',v,c->'value');x:=state->(c->>'target');
 if c->>'action'='show' then x:=jsonb_set(x,'{hidden}',to_jsonb(not test));elsif c->>'action'='hide' then x:=jsonb_set(x,'{hidden}',to_jsonb(test));elsif c->>'action'='require'then x:=jsonb_set(x,'{required}',to_jsonb(test));else x:=jsonb_set(x,'{disabled}',to_jsonb(test));end if;state:=jsonb_set(state,array[c->>'target'],x);
 end loop;
 for s in select value from jsonb_array_elements(d->'sections')loop
 for f in select value from jsonb_array_elements(s->'fields')loop
 if (state#>>array[s->>'key','hidden'])::boolean or f->>'type'='hidden'then state:=jsonb_set(state,array[f->>'key','hidden'],'true');end if;
 if (state#>>array[s->>'key','disabled'])::boolean or coalesce((f->>'readonly')::boolean,false)then state:=jsonb_set(state,array[f->>'key','disabled'],'true');end if;
 if (state#>>array[s->>'key','required'])::boolean then state:=jsonb_set(state,array[f->>'key','required'],'true');end if;
 end loop;end loop;
 if state=prior then return state;end if;end loop;raise exception 'Unstable conditional state';
end$$;

create function private.forms_workspace(a text,o uuid,p jsonb)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f public.platform_forms;v public.platform_form_versions;d jsonb;answer jsonb;key text;required_permission text;newid uuid;sub public.platform_form_submissions;begin
 if not private.outreach_verified(auth.uid())then raise exception 'Verified staff identity required' using errcode='42501';end if;
 if a='context' then return jsonb_build_object('organizations',(select coalesce(jsonb_agg(jsonb_build_object('id',x.id,'name',x.name,'permissions',(select coalesce(jsonb_agg(k),'[]') from unnest(private.forms_permissions())k where private.forms_can(x.id,k)),'scoped_forms',(select coalesce(jsonb_agg(jsonb_build_object('id',t.id,'name',t.name,'permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_can(x.id,k,t.id)))),'[]')from public.platform_forms t where t.organization_id=x.id and exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(x.id,k,t.id))))),'[]')from public.organizations x where exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(x.id,k))or exists(select 1 from public.platform_forms t where t.organization_id=x.id and exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(x.id,k,t.id)))));end if;
 perform private.forms_shape(p,array['id','name','type','slug','description','campaign_id','event_reference','revision','definition','version_id','submission_id','status','from','to','payment','link_status','person_id','household_id','reviewed','file_id','request_key']);
 required_permission:=case when a='create'then 'forms.create'when a in('save','draft','duplicate')then 'forms.edit'when a in('publish','pause','resume')then 'forms.publish'when a='archive'then 'forms.archive'when a in('submissions','detail','file_authorize')then 'forms.submissions.read'when a='export'then 'forms.submissions.export'when a in('link','pledge','recurring')then 'forms.submissions.read'else 'forms.read'end;
 if a not in('create','list','funds')then
 select * into f from public.platform_forms where organization_id=o and id=(p->>'id')::uuid;
 if f.id is null then raise exception 'Form unavailable' using errcode='42501';end if;end if;
 if a='funds'then
 if p ? 'id'then select * into f from public.platform_forms where organization_id=o and id=(p->>'id')::uuid;if f.id is null then raise exception 'Form unavailable'using errcode='42501';end if;end if;
 required_permission:=case when private.forms_can(o,'forms.read',f.id)then 'forms.read'when private.forms_can(o,'forms.edit',f.id)then 'forms.edit'when private.forms_can(o,'forms.create')then 'forms.create'else 'forms.payment.configure'end;
 end if;
 if not private.forms_can(o,required_permission,f.id) and a<>'list' then raise exception 'Forms access denied' using errcode='42501';end if;
 if a='list' then
 if not exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(o,k))and not exists(select 1 from public.platform_forms x where x.organization_id=o and exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(o,k,x.id)))then raise exception 'Forms access denied' using errcode='42501';end if;
 return jsonb_build_object('forms',(select coalesce(jsonb_agg(to_jsonb(x)||jsonb_build_object('permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_can(o,k,x.id)),'published_version',(select version from public.platform_form_versions v join public.platform_form_instances i on i.version_id=v.id where i.form_id=x.id),'last_published',(select published_at from public.platform_form_instances i where i.form_id=x.id),'payment_enabled',exists(select 1 from public.platform_form_payments pay join public.platform_form_versions v on v.id=pay.version_id where v.form_id=x.id and pay.enabled),'submission_count',(select count(*)from public.platform_form_submissions s where s.form_id=x.id))order by x.updated_at desc),'[]')from public.platform_forms x where x.organization_id=o and exists(select 1 from unnest(private.forms_permissions())k where private.forms_can(o,k,x.id))and (p->>'status'='archived' or x.status<>'archived')));
 elsif a='funds' then
 return jsonb_build_object('funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'parent_id',parent_id,'parent_name',(select p.name from public.giving_funds p where p.id=giving_funds.parent_id and p.organization_id=o),'display_order',display_order)order by display_order,name),'[]')from public.giving_funds where organization_id=o and status='active' and is_public),'currency',(select currency from public.giving_organization_config where organization_id=o),'minor_unit_scale',(select minor_unit_scale from public.giving_organization_config where organization_id=o),'destinations',case when private.forms_can(o,'forms.payment.configure')and private.has_staff_permission(o,'finance.merchant.configure')then (select coalesce(jsonb_agg(jsonb_build_object('id',id,'label',merchant_label)),'[]')from public.giving_destinations where organization_id=o and active)else '[]'::jsonb end);
 elsif a='create' then
 perform private.forms_lock(o);insert into public.platform_forms(organization_id,name,type,slug,description,campaign_id,event_reference,created_by)values(o,p->>'name',p->>'type',p->>'slug',coalesce(p->>'description',''),(p->>'campaign_id')::uuid,p->>'event_reference',auth.uid())returning * into f;
 d:=coalesce(p->'definition',jsonb_build_object('sections',jsonb_build_array(jsonb_build_object('key','main','title','Your information','columns',1,'fields','[]'::jsonb)),'conditions','[]'::jsonb,'settings',jsonb_build_object('public_available',false,'branding','champion-life','timezone','UTC','success_message','Thank you. Your response has been received.'),'payment','{}'::jsonb));
 if coalesce((d#>>'{payment,enabled}')::boolean,false) and not private.forms_can(o,'forms.payment.configure')then raise exception 'Payment configuration access required' using errcode='42501';end if;
 if d#>>'{payment,destination_override}'is not null and not private.has_staff_permission(o,'finance.merchant.configure')then raise exception 'Merchant override authority required'using errcode='42501';end if;
 perform private.forms_validate(o,d);insert into public.platform_form_versions(organization_id,form_id,version,definition)values(o,f.id,1,d)returning * into v;perform private.forms_compile(v.id,d);perform private.forms_audit(o,f.id,'form.created',v.id);
 elsif a in('get','draft')then
 if a='draft'then perform private.forms_lock(o);end if;
 select * into v from public.platform_form_versions where form_id=f.id and state='draft';
 if v.id is null then
 select * into v from public.platform_form_versions where form_id=f.id order by version desc limit 1;
 if a='draft'then d:=v.definition;insert into public.platform_form_versions(organization_id,form_id,version,definition)values(o,f.id,v.version+1,d)returning * into v;perform private.forms_compile(v.id,d);perform private.forms_audit(o,f.id,'draft.created',v.id);end if;end if;
 elsif a='save'then
 perform private.forms_lock(o);select * into v from public.platform_form_versions where form_id=f.id and state='draft' for update;
 if v.id is null or v.revision is distinct from (p->>'revision')::int then raise exception 'Draft changed. Reload before saving.' using errcode='40001';end if;
 d:=p->'definition';if coalesce(d->'payment','{}')<>coalesce(v.definition->'payment','{}') and not private.forms_can(o,'forms.payment.configure')then raise exception 'Payment configuration access required' using errcode='42501';end if;
 if (d#>>'{payment,destination_override}')is distinct from (v.definition#>>'{payment,destination_override}')and d#>>'{payment,destination_override}'is not null and not private.has_staff_permission(o,'finance.merchant.configure')then raise exception 'Merchant override authority required'using errcode='42501';end if;
 perform private.forms_validate(o,d);perform private.forms_compile(v.id,d);
 update public.platform_form_versions set definition=d,revision=revision+1 where id=v.id returning * into v;
 update public.platform_forms set name=coalesce(p->>'name',name),type=coalesce(p->>'type',type),description=coalesce(p->>'description',description),updated_at=now()where id=f.id returning * into f;perform private.forms_audit(o,f.id,'draft.saved',v.id);
 elsif a='publish'then
 perform private.forms_lock(o);select * into v from public.platform_form_versions where form_id=f.id and id=(p->>'version_id')::uuid for update;
 if v.id is null then raise exception 'Draft unavailable';end if;
 -- Identical publish retries return the frozen canonical version; edits cannot be silently published.
 if v.state='draft'then
 if v.revision is distinct from (p->>'revision')::int then raise exception 'Draft revision conflict' using errcode='40001';end if;perform private.forms_validate(o,v.definition,true);
 update public.platform_form_versions set state='published',name_snapshot=f.name,type_snapshot=f.type,description_snapshot=f.description,published_at=now()where id=v.id returning * into v;
 insert into public.platform_form_instances(form_id,organization_id,version_id,public_available)values(f.id,o,v.id,coalesce((v.definition#>>'{settings,public_available}')::boolean,false))on conflict(form_id)do update set version_id=excluded.version_id,public_available=excluded.public_available,published_at=now();
 update public.platform_forms set status='published',updated_at=now()where id=f.id returning * into f;perform private.forms_audit(o,f.id,'version.published',v.id);
 elsif not exists(select 1 from public.platform_form_instances where form_id=f.id and version_id=v.id)then raise exception 'A newer version is published' using errcode='40001';end if;
 elsif a='duplicate'then
 if not private.forms_can(o,'forms.create')then raise exception 'Create access required' using errcode='42501';end if;
 select * into v from public.platform_form_versions where form_id=f.id order by (state='draft')desc,version desc limit 1;d:=v.definition;
 d:=jsonb_set(d,'{settings,public_available}','false');
 if coalesce((d#>>'{payment,enabled}')::boolean,false) and not private.forms_can(o,'forms.payment.configure')then raise exception 'Payment configuration access required' using errcode='42501';end if;
 return private.forms_workspace('create',o,jsonb_build_object('name',coalesce(p->>'name',f.name||' copy'),'type',f.type,'slug',coalesce(p->>'slug',f.slug||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8)),'description',f.description,'definition',d));
 elsif a in('pause','resume','archive')then
 perform private.forms_lock(o);if a='resume'and not exists(select 1 from public.platform_form_instances where form_id=f.id)then raise exception 'Publish a version first';end if;
 update public.platform_forms set status=case a when 'pause'then 'paused'when 'archive'then 'archived'else 'published'end,updated_at=now()where id=f.id returning * into f;perform private.forms_audit(o,f.id,'form.'||a);return to_jsonb(f);
 elsif a in('submissions','export')then
 if a='export' and not private.forms_can(o,'forms.submissions.read',f.id)then raise exception 'Submission read required'using errcode='42501';end if;
 if nullif(p->>'from','')is not null and nullif(p->>'to','')is not null and (p->>'from')::date>(p->>'to')::date then raise exception 'Invalid date filter';end if;
 if a='export'then perform private.forms_audit(o,f.id,'submissions.exported');end if;
 return jsonb_build_object('submissions',(select coalesce(jsonb_agg(to_jsonb(s)||jsonb_build_object('version',v.version,'submitter',(select text_value from public.platform_form_answers where submission_id=s.id and type='name' limit 1),'answers',case when a='export'then (select jsonb_agg(to_jsonb(x))from public.platform_form_answers x where x.submission_id=s.id)else null end)order by s.submitted_at desc),'[]')from public.platform_form_submissions s join public.platform_form_versions v on v.id=s.version_id where s.form_id=f.id
 and (nullif(p->>'from','')is null or s.submitted_at>=(p->>'from')::date)and(nullif(p->>'to','')is null or s.submitted_at<(p->>'to')::date+interval '1 day')
 and(nullif(p->>'status','')is null or s.status=p->>'status')and(nullif(p->>'version_id','')is null or s.version_id=(p->>'version_id')::uuid)and(nullif(p->>'payment','')is null or s.payment_status=p->>'payment')and(nullif(p->>'link_status','')is null or s.link_status=p->>'link_status')),
 'metrics',jsonb_build_object('count',(select count(*)from public.platform_form_submissions where form_id=f.id),'status',(select jsonb_object_agg(status,n)from(select status,count(*)n from public.platform_form_submissions where form_id=f.id group by status)x),'trend',(select jsonb_agg(to_jsonb(x))from(select submitted_at::date as report_day,count(*)count from public.platform_form_submissions where form_id=f.id group by submitted_at::date order by report_day)x),'collected_by_currency',(select jsonb_agg(to_jsonb(x))from(select l.currency,sum(l.amount_minor)::text amount_minor from public.giving_ledger l join public.platform_form_submissions s on s.giving_session_id=l.session_id where s.form_id=f.id group by l.currency)x),'conversion_rate',null));
 elsif a in('detail','link','file_authorize','pledge','recurring')then
 if a in('link','pledge','recurring')then perform private.forms_lock(o);end if;
 select * into sub from public.platform_form_submissions where organization_id=o and form_id=f.id and id=(p->>'submission_id')::uuid;
 if sub.id is null then raise exception 'Submission unavailable'using errcode='42501';end if;
 if a='file_authorize'then
 select jsonb_build_object('bucket','platform-form-files','path',object_path,'filename',filename,'mime',mime)into answer from private.platform_form_files where id=(p->>'file_id')::uuid and submission_id=sub.id;
 if answer is null then raise exception 'File unavailable'using errcode='42501';end if;perform private.forms_audit(o,f.id,'file.authorized',sub.id);return answer;
 elsif a='link'then
 if not private.forms_can(o,'forms.edit',f.id)or not private.has_staff_permission(o,'people.update')or coalesce((p->>'reviewed')::boolean,false)<>true or p->>'person_id'is null then raise exception 'Explicit reviewed People authority required'using errcode='42501';end if;
 perform private.giving_identity(o,(p->>'person_id')::uuid,(p->>'household_id')::uuid);
 update public.platform_form_submissions set person_id=(p->>'person_id')::uuid,household_id=(p->>'household_id')::uuid,link_status='linked',status='reviewed',revision=revision+1 where id=sub.id and revision=(p->>'revision')::int returning * into sub;
 if sub.id is null then raise exception 'Submission revision conflict'using errcode='40001';end if;perform private.forms_audit(o,f.id,'submission.linked',sub.id);end if;
 if a in('pledge','recurring')then
 if sub.link_status<>'linked' or sub.person_id is null or not private.forms_can(o,'forms.payment.configure')then raise exception 'Reviewed identity and payment configuration authority required'using errcode='42501';end if;
 select definition into d from public.platform_form_versions where id=sub.version_id;
 select coalesce(jsonb_object_agg(field_key,submitted_value),'{}')into answer from public.platform_form_answers where submission_id=sub.id;
 if a='pledge'then
 if sub.pledge_id is not null then return jsonb_build_object('id',sub.pledge_id);end if;
 if d#>>'{payment,pledge_key}'is null then raise exception 'Pledge field hook not configured';end if;
 answer:=private.giving_workspace('pledge_create',o,jsonb_build_object('request_key',(p->>'request_key')::uuid,'person_id',sub.person_id,'household_id',sub.household_id,'fund_id',coalesce(answer->>(d#>>'{payment,fund_key}'),d#>>'{payment,default_fund}'),'amount_minor',answer->>(d#>>'{payment,pledge_key}'),'currency',d#>>'{payment,currency}','starts_on',coalesce(answer->>(d#>>'{payment,pledge_start_key}'),current_date::text),'ends_on',answer->>(d#>>'{payment,pledge_end_key}'),'frequency',coalesce(answer->>(d#>>'{payment,recurring_key}'),'monthly'),'notes','Reviewed Forms pledge'));
 update public.platform_form_submissions set pledge_id=(answer->>'id')::uuid where id=sub.id;
 else
 if sub.recurring_id is not null then return jsonb_build_object('id',sub.recurring_id);end if;
 if sub.giving_session_id is null or d#>>'{payment,recurring_key}'is null then raise exception 'Held recurring hook not configured';end if;
 answer:=private.giving_workspace('recurring_create',o,jsonb_build_object('request_key',(p->>'request_key')::uuid,'person_id',sub.person_id,'household_id',sub.household_id,'currency',d#>>'{payment,currency}','frequency',answer->>(d#>>'{payment,recurring_key}'),'starts_on',current_date,'next_run_at',now()+interval '1 month','lines',(select jsonb_agg(jsonb_build_object('fund_id',fund_id,'amount_minor',amount_minor::text))from public.giving_session_lines where session_id=sub.giving_session_id)));
 update public.platform_form_submissions set recurring_id=(answer->>'id')::uuid where id=sub.id;
 end if;perform private.forms_audit(o,f.id,'submission.'||a,sub.id);return answer;
 end if;
 perform private.forms_audit(o,f.id,'submission.viewed',sub.id);
 return jsonb_build_object('form_name',(select name_snapshot from public.platform_form_versions where id=sub.version_id),'version',(select version from public.platform_form_versions where id=sub.version_id),'submission',to_jsonb(sub),'answers',(select jsonb_agg(to_jsonb(x))from public.platform_form_answers x where submission_id=sub.id),'agreements',(select jsonb_agg(to_jsonb(x))from public.platform_form_agreements x where submission_id=sub.id),'files',(select jsonb_agg(jsonb_build_object('id',id,'field_key',field_key,'filename',filename,'visibility',visibility))from private.platform_form_files where submission_id=sub.id),'audit',(select jsonb_agg(to_jsonb(x))from public.platform_form_audit x where form_id=f.id and subject_id=sub.id));
 else raise exception 'Unsupported Forms action';end if;
 return jsonb_build_object('form',to_jsonb(f),'version',to_jsonb(v),'permissions',(select jsonb_agg(k)from unnest(private.forms_permissions())k where private.forms_can(o,k,f.id)));
end$$;

create function private.forms_public(o uuid,slug text)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f public.platform_forms;v public.platform_form_versions;st jsonb;pay jsonb;begin
 select x.* into f from public.platform_forms x join public.platform_form_instances i on i.form_id=x.id where x.organization_id=o and x.slug=forms_public.slug and x.status='published' and i.public_available;
 if f.id is null then return jsonb_build_object('available',false);end if;
 select x.* into v from public.platform_form_versions x join public.platform_form_instances i on i.version_id=x.id where i.form_id=f.id and x.state='published';st:=v.definition->'settings';pay:=coalesce(v.definition->'payment','{}');
 if (nullif(st->>'starts_at','')is not null and now()<private.forms_instant(st->>'starts_at',coalesce(st->>'timezone','UTC')))or(nullif(st->>'ends_at','')is not null and now()>=private.forms_instant(st->>'ends_at',coalesce(st->>'timezone','UTC')))or(nullif(st->>'max_submissions','')is not null and (select count(*)from public.platform_form_submissions where form_id=f.id)>=(st->>'max_submissions')::int)then return jsonb_build_object('available',false);end if;
 -- Configuration only. No donor, submission, route, processor or internal assignment data.
 return jsonb_build_object('available',true,'name',v.name_snapshot,'description',v.description_snapshot,'type',v.type_snapshot,'version_id',v.id,'version',v.version,'definition',v.definition-'payment'||jsonb_build_object('payment',pay-array['destination_override']),
 'funds',(select coalesce(jsonb_agg(jsonb_build_object('id',id,'name',name,'parent_id',parent_id,'parent_name',(select p.name from public.giving_funds p where p.id=giving_funds.parent_id and p.organization_id=o),'display_order',display_order)order by display_order,name),'[]')from public.giving_funds where organization_id=o and status='active' and is_public and (not coalesce((pay->>'enabled')::boolean,false)or pay->'allowed_funds' ? id::text)),
 'minor_unit_scale',coalesce((select minor_unit_scale from public.giving_organization_config where organization_id=o),2),'payment_execution','PROVIDER_NOT_CONFIGURED');
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

create function private.forms_gateway(a text,o uuid,slug text,p jsonb,network text)returns jsonb language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare f public.platform_forms;v public.platform_form_versions;s public.platform_form_submissions;field public.platform_form_fields;file private.platform_form_files;
 st jsonb;pay jsonb;answers jsonb;states jsonb;val jsonb;k text;countv int;identifier uuid;session uuid;lines jsonb:='[]';line jsonb;total bigint:=0;cur text;result jsonb;digestv text;begin
 if network!~'^[a-f0-9]{64}$'then raise exception 'Trusted network fingerprint required';end if;
 select * into f from public.platform_forms where organization_id=o and platform_forms.slug=forms_gateway.slug;
 if f.id is null then return jsonb_build_object('accepted',false);end if;
 perform private.forms_lock(o);
 if a='rate'then
 perform private.forms_shape(p,array[]::text[]);
 insert into private.platform_form_rate values(network,f.id,date_trunc('hour',now()),1)on conflict(network,form_id,window_at)do update set count=platform_form_rate.count+1 returning count into countv;
 return jsonb_build_object('accepted',countv<=120,'reason',case when countv>120 then 'rate' end);end if;
 perform private.forms_shape(p,case when a='reserve_file'then array['request_key','version_id','field_key','filename','mime','size_bytes']else array['request_key','version_id','answers']end);
 -- Immutable retry result is available even after capacity is filled; it carries no submitted PII.
 digestv:=md5(p::text);
 if a='submit'then select * into s from public.platform_form_submissions where form_id=f.id and request_key=(p->>'request_key')::uuid;
 if s.id is not null then if s.payload_digest<>digestv then raise exception 'Request key content differs';end if;return jsonb_build_object('accepted',true,'reference',s.reference,'payment_status',s.payment_status);end if;end if;
 if not coalesce((private.forms_public(o,slug)->>'available')::boolean,false)then return jsonb_build_object('accepted',false);end if;
 select x.* into v from public.platform_form_versions x join public.platform_form_instances i on i.version_id=x.id where i.form_id=f.id and x.id=(p->>'version_id')::uuid;
 if v.id is null then raise exception 'Published version changed. Reload form.';end if;pay:=coalesce(v.definition->'payment','{}');
 if a='reserve_file'then
 select * into field from public.platform_form_fields where version_id=v.id and field_key=p->>'field_key'and type='file';
 if field.id is null or not field.config#>'{file,types}' ? (p->>'mime')or (p->>'size_bytes')::bigint>coalesce((field.config#>>'{file,max_bytes}')::bigint,10485760) or coalesce(p->>'filename','')!~'^[a-zA-Z0-9][a-zA-Z0-9 ._-]{0,149}$'then raise exception 'File policy rejected';end if;
 identifier:=gen_random_uuid();insert into private.platform_form_files(id,organization_id,form_id,version_id,request_key,field_key,object_path,filename,mime,size_bytes,visibility)values(identifier,o,f.id,v.id,(p->>'request_key')::uuid,field.field_key,o::text||'/'||identifier::text,p->>'filename',p->>'mime',(p->>'size_bytes')::bigint,coalesce(field.config#>>'{file,visibility}','private'));
 return jsonb_build_object('accepted',true,'id',identifier,'bucket','platform-form-files','path',o::text||'/'||identifier::text);end if;
 if a<>'submit'then raise exception 'Unsupported public action';end if;
 answers:=p->'answers';perform private.forms_shape(answers,(select array_agg(field_key)from public.platform_form_fields where version_id=v.id));
 -- Default values are canonical. Hidden/read-only content never takes client input.
 for field in select * from public.platform_form_fields where version_id=v.id loop
 if field.config ? 'default'and not answers ? field.field_key then answers:=answers||jsonb_build_object(field.field_key,field.config->'default');end if;end loop;
 states:=private.forms_state(v.definition,answers);
 for field in select * from public.platform_form_fields where version_id=v.id loop
 val:=answers->field.field_key;st:=states->field.field_key;
 if (field.type='hidden'or coalesce((field.config->>'readonly')::boolean,false))and p->'answers' ? field.field_key then raise exception 'Canonical hidden/read-only value cannot be overridden';end if;
 if field.type in('heading','paragraph','divider','spacer','payment','submit')then if p->'answers' ? field.field_key then raise exception 'Display element cannot receive answer';end if;continue;end if;
 if (st->>'hidden')::boolean or (st->>'disabled')::boolean then
 if p->'answers' ? field.field_key then raise exception 'Hidden or read-only answer rejected';end if;
 if field.type<>'hidden'and not coalesce((field.config->>'readonly')::boolean,false)then continue;end if;val:=field.config->'default';end if;
 if field.type='fund'and val is not null and val<>'null'and val<>'""'then
 if jsonb_typeof(val)='array'then for line in select value from jsonb_array_elements(val)loop if not exists(select 1 from public.giving_funds where organization_id=o and id=(line->>'fund_id')::uuid and status='active'and is_public)then raise exception 'Public fund unavailable';end if;end loop;
 elsif not exists(select 1 from public.giving_funds where organization_id=o and id=(val#>>'{}')::uuid and status='active'and is_public)then raise exception 'Public fund unavailable';end if;end if;
 perform private.forms_value(field.config,val,(st->>'required')::boolean and not(st->>'hidden')::boolean and not(st->>'disabled')::boolean);
 if field.type='file'and val is not null and val<>'null'then
 select * into file from private.platform_form_files where id=(val#>>'{}')::uuid and form_id=f.id and version_id=v.id and request_key=(p->>'request_key')::uuid and field_key=field.field_key and submission_id is null and expires_at>now();
 if file.id is null or not exists(select 1 from storage.objects where bucket_id='platform-form-files'and name=file.object_path and(metadata->>'size')::bigint=file.size_bytes and metadata->>'mimetype'=file.mime)then raise exception 'Authorized uploaded file required';end if;end if;
 end loop;
 if coalesce((pay->>'enabled')::boolean,false)and (coalesce((pay->>'required')::boolean,false)or answers ? (pay->>'amount_key')or answers ? (pay->>'lines_key')or pay ? 'fixed_minor')then
 if pay ? 'lines_key'then lines:=answers->(pay->>'lines_key');else
 total:=coalesce(nullif(pay->>'fixed_minor','')::bigint,(answers->>(pay->>'amount_key'))::bigint);
 lines:=jsonb_build_array(jsonb_build_object('fund_id',coalesce(answers->>(pay->>'fund_key'),pay->>'default_fund'),'amount_minor',total));end if;
 total:=0;
 if jsonb_typeof(lines)<>'array'or jsonb_array_length(lines)not between 1 and 30 then raise exception 'Gift lines required';end if;
 for line in select value from jsonb_array_elements(lines)loop
 if not pay->'allowed_funds' ? (line->>'fund_id') or not exists(select 1 from public.giving_funds where organization_id=o and id=(line->>'fund_id')::uuid and status='active'and is_public)then raise exception 'Fund unavailable';end if;
 if (line->>'amount_minor')::bigint<greatest(coalesce((pay->>'minimum_minor')::bigint,1),1)then raise exception 'Amount below minimum';end if;total:=total+(line->>'amount_minor')::bigint;end loop;
 if not coalesce((pay->>'multiple_lines')::boolean,false)and jsonb_array_length(lines)>1 then raise exception 'Single fund required';end if;
 if pay ? 'recurring_key'and coalesce(answers->>(pay->>'recurring_key'),'one_time')<>'one_time'and not coalesce(pay->'frequencies','[]') ? (answers->>(pay->>'recurring_key'))then raise exception 'Recurring frequency unavailable';end if;
 cur:=pay->>'currency';perform private.giving_lock(o);
 if pay ? 'destination_override'then select jsonb_agg(x||jsonb_build_object('destination_override_id',pay->>'destination_override'))into lines from jsonb_array_elements(lines)x;end if;
 result:=private.giving_create_session(o,jsonb_build_object('request_key',(p->>'request_key')::uuid,'guest_reference','form:'||f.id::text,'currency',cur,'intended_minor',total::text,'source','platform_form','anonymous_public',coalesce((answers->>(pay->>'anonymous_key'))::boolean,false),'campaign_reference',f.campaign_id,'event_reference',f.event_reference,'lines',lines));session:=(result->>'id')::uuid;
 -- Prevent fee/deposit/purchase rows from ever becoming tax eligible in canonical finance reports.
 -- Classification is frozen by the insert trigger; historical Giving lines are never updated.
 end if;
 insert into public.platform_form_submissions(organization_id,form_id,version_id,request_key,payload_digest,giving_session_id,payment_status,status)values(o,f.id,v.id,(p->>'request_key')::uuid,digestv,session,case when session is null then 'none'else 'provider_not_configured'end,'needs_review')returning * into s;
 for field in select * from public.platform_form_fields where version_id=v.id loop
 val:=answers->field.field_key;st:=states->field.field_key;
 if field.type in('heading','paragraph','divider','spacer','payment','submit')or ((st->>'hidden')::boolean or(st->>'disabled')::boolean)and field.type<>'hidden'and not coalesce((field.config->>'readonly')::boolean,false)or val is null or val='null'then continue;end if;
 insert into public.platform_form_answers(submission_id,version_id,field_id,field_key,label_snapshot,type,submitted_value,text_value,number_value,boolean_value,date_value,structured_value)values(s.id,v.id,field.id,field.field_key,field.label,field.type,val,
 case when jsonb_typeof(val)='string'then val#>>'{}'end,case when field.type in('number','currency','gift_amount')then (val#>>'{}')::numeric end,case when field.type in('checkbox','consent','yes_no')then(val#>>'{}')::boolean end,case when field.type='date'then(val#>>'{}')::date end,case when jsonb_typeof(val)in('array','object')then val end);
 if field.type in('signature','consent')then insert into public.platform_form_agreements(submission_id,field_key,kind,signer,agreement_text,agreement_version,purpose,checked)values(s.id,field.field_key,field.type,case when field.type='signature'then val#>>'{}'end,field.config#>>'{agreement,text}',field.config#>>'{agreement,version}',field.config#>>'{agreement,purpose}',case when field.type='signature'then coalesce(val#>>'{}','')<>''else(val#>>'{}')::boolean end);end if;
 if field.type='file'then update private.platform_form_files set submission_id=s.id where id=(val#>>'{}')::uuid;end if;end loop;
 insert into public.platform_form_events(organization_id,submission_id,kind)values(o,s.id,'form.submitted'),(o,s.id,'form.needs_review');perform private.forms_audit(o,f.id,'submission.received',s.id);
 return jsonb_build_object('accepted',true,'reference',s.reference,'payment_status',s.payment_status);
end$$;

create function public.forms_workspace(p_action text,p_org uuid default null,p_payload jsonb default '{}')returns jsonb language sql security invoker set search_path='' as $$select private.forms_workspace(p_action,p_org,p_payload)$$;
create function public.forms_public(p_org uuid,p_slug text)returns jsonb language sql security definer set search_path='' as $$select private.forms_public(p_org,p_slug)$$;
create function public.forms_gateway(p_action text,p_org uuid,p_slug text,p_payload jsonb,p_network text)returns jsonb language sql security invoker set search_path='' as $$select private.forms_gateway(p_action,p_org,p_slug,p_payload,p_network)$$;
-- All internal helpers are denied, including service callers; wrappers grant only narrow entry points.
do $$declare r record;begin
 for r in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private'and p.proname like 'forms_%'loop
 execute format('revoke all on function %s from public,anon,authenticated,service_role',r.signature);end loop;
end$$;
revoke all on function public.forms_workspace(text,uuid,jsonb),public.forms_public(uuid,text),public.forms_gateway(text,uuid,text,jsonb,text)from public,anon,authenticated,service_role;
grant execute on function public.forms_workspace(text,uuid,jsonb),private.forms_workspace(text,uuid,jsonb)to authenticated;
grant execute on function public.forms_public(uuid,text)to anon,authenticated,service_role;
grant execute on function public.forms_gateway(text,uuid,text,jsonb,text),private.forms_gateway(text,uuid,text,jsonb,text)to service_role;

-- Additive classification hook; preserve Giving Core immutable-line rules.
create function private.forms_giving_classification()returns trigger language plpgsql security definer set search_path='' as $$
#variable_conflict use_column
declare classification text;begin
 select pay.classification into classification from public.giving_sessions gs
 join public.platform_forms f on gs.guest_reference='form:'||f.id::text and f.organization_id=gs.organization_id
 join public.platform_form_instances i on i.form_id=f.id join public.platform_form_payments pay on pay.version_id=i.version_id
 where gs.id=new.session_id and gs.source='platform_form';
 if classification is not null and classification<>'donation'then new.tax_eligible:=false;end if;return new;
end$$;
revoke all on function private.forms_giving_classification()from public,anon,authenticated,service_role;
create trigger forms_giving_classification before insert on public.giving_session_lines for each row execute function private.forms_giving_classification();

alter table public.platform_form_submissions add column recurring_id uuid,add foreign key(organization_id,recurring_id)references public.giving_recurring_instructions(organization_id,id);
create index platform_form_recurring on public.platform_form_submissions(organization_id,recurring_id);
create function private.forms_submission_history()returns trigger language plpgsql set search_path='' as $$begin
 if tg_op='DELETE' or (to_jsonb(new)-array['status','link_status','person_id','household_id','revision','pledge_id','recurring_id'])<>(to_jsonb(old)-array['status','link_status','person_id','household_id','revision','pledge_id','recurring_id'])then raise exception 'Submission history is immutable'using errcode='42501';end if;return new;
end$$;
revoke all on function private.forms_submission_history()from public,anon,authenticated,service_role;
create trigger forms_submission_history before update or delete on public.platform_form_submissions for each row execute function private.forms_submission_history();

-- Public visibility is an explicit published field policy; the bucket itself remains private.
create function private.forms_public_file(o uuid,slug text,file_id uuid)returns jsonb language plpgsql security definer set search_path='' as $$
declare result jsonb;begin
 if not coalesce((private.forms_public(o,slug)->>'available')::boolean,false)then raise exception 'File unavailable'using errcode='42501';end if;
 select jsonb_build_object('bucket','platform-form-files','path',x.object_path,'filename',x.filename)into result
 from private.platform_form_files x join public.platform_forms f on f.id=x.form_id join public.platform_form_instances i on i.form_id=f.id and i.version_id=x.version_id
 where x.id=file_id and x.organization_id=o and f.slug=forms_public_file.slug and x.visibility='public'and x.submission_id is not null;
 if result is null then raise exception 'File unavailable'using errcode='42501';end if;return result;
end$$;
create function public.forms_public_file(p_org uuid,p_slug text,p_file uuid)returns jsonb language sql security definer set search_path='' as $$select private.forms_public_file(p_org,p_slug,p_file)$$;
revoke all on function private.forms_public_file(uuid,text,uuid),public.forms_public_file(uuid,text,uuid)from public,anon,authenticated,service_role;
grant execute on function public.forms_public_file(uuid,text,uuid)to anon,authenticated;

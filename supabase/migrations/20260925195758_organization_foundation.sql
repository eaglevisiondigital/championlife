-- Additive foundation. Existing learner tables and routes remain unchanged.
create table public.organizations (
 id uuid primary key default gen_random_uuid(),
 slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
 name text not null check (length(btrim(name)) between 1 and 150),
 kind text not null check (kind in ('church','ministry')),
 created_at timestamptz not null default now()
);
create table public.organization_affiliations (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 affiliation text not null check (affiliation in ('participant','church_member','outreach_participant','partner','volunteer')),
 created_at timestamptz not null default now(),
 primary key (organization_id,user_id,affiliation)
);
create index organization_affiliations_user_idx on public.organization_affiliations(user_id,organization_id);
create table public.organization_staff_permissions (
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 permission text not null check (permission in ('people.read','people.update','people.export','staff.manage','finance.read','care.read','discipleship.read')),
 granted_at timestamptz not null default now(),
 revoked_at timestamptz,
 primary key (organization_id,user_id,permission)
);
create index organization_staff_permissions_user_idx on public.organization_staff_permissions(user_id,organization_id) where revoked_at is null;
create table public.organization_people (
 id uuid primary key default gen_random_uuid(),
 organization_id uuid not null references public.organizations(id) on delete cascade,
 user_id uuid references auth.users(id) on delete set null,
 first_name text not null check (length(btrim(first_name)) between 1 and 100),
 last_name text not null check (length(btrim(last_name)) between 1 and 100),
 email text check (email is null or length(email) <= 320),
 phone text check (phone is null or length(phone) <= 40),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 unique (organization_id,user_id)
);
create index organization_people_user_idx on public.organization_people(user_id);

alter table public.organizations enable row level security;
alter table public.organization_affiliations enable row level security;
alter table public.organization_staff_permissions enable row level security;
alter table public.organization_people enable row level security;
revoke all on public.organizations, public.organization_affiliations, public.organization_staff_permissions, public.organization_people from public, anon, authenticated;
grant select on public.organizations, public.organization_affiliations, public.organization_staff_permissions, public.organization_people to authenticated;
grant update (first_name,last_name,email,phone,updated_at) on public.organization_people to authenticated;
grant all on public.organizations, public.organization_affiliations, public.organization_staff_permissions, public.organization_people to service_role;

-- Permission provisioning remains server-only. An affiliation never grants staff access.
create policy affiliations_read_own on public.organization_affiliations for select to authenticated using (user_id=(select auth.uid()));
create policy staff_permissions_read_own on public.organization_staff_permissions for select to authenticated using (user_id=(select auth.uid()) and revoked_at is null);
create policy organizations_read_related on public.organizations for select to authenticated using (
 exists(select 1 from public.organization_affiliations a where a.organization_id=id and a.user_id=(select auth.uid()))
 or exists(select 1 from public.organization_staff_permissions p where p.organization_id=id and p.user_id=(select auth.uid()) and p.revoked_at is null)
);
create policy organization_people_read on public.organization_people for select to authenticated using (
 user_id=(select auth.uid()) or exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission='people.read' and p.revoked_at is null)
);
create policy organization_people_update on public.organization_people for update to authenticated using (
 exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission='people.read' and p.revoked_at is null)
 and exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission='people.update' and p.revoked_at is null)
) with check (
 exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission='people.read' and p.revoked_at is null)
 and exists(select 1 from public.organization_staff_permissions p where p.organization_id=organization_people.organization_id and p.user_id=(select auth.uid()) and p.permission='people.update' and p.revoked_at is null)
);

insert into public.organizations(slug,name,kind) values ('champion-life','Champion Life Church','church'),('sowgo','SowGo','ministry');
-- No existing learner is automatically classified as church member, partner, or staff.

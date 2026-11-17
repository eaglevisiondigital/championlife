-- Synthetic structural stand-in for the concurrent P0 migration, never hosted.
-- Set MINDEN_P0_MIGRATION to the actual P0 SQL for integrated acceptance.
create table public.outreach_volunteer_applications(
 id uuid primary key default gen_random_uuid(),campaign_id uuid not null,organization_id uuid not null,
 request_key uuid not null default gen_random_uuid(),request_snapshot jsonb not null default '{}',
 reference text not null default 'V-SYNTHETIC',first_name text not null,last_name text not null,email text not null,
 phone text not null default '',attendance text,rv_experience text,travel_choice text,passenger_names text not null default '',additional_information text not null default '',
 status text not null default 'pending',review_note text not null default '',revision integer not null default 1,submitted_at timestamptz not null default now(),
 unique(campaign_id,id),foreign key(organization_id,campaign_id) references public.outreach_campaigns(organization_id,id));
alter table public.outreach_volunteer_applications enable row level security;
revoke all on public.outreach_volunteer_applications from public,anon,authenticated;

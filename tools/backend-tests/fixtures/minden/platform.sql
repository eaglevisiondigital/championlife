-- LOCAL TEST ONLY. Extracted from reviewed schema-reproducibility-2026-10-31/replay.mjs.
-- These managed-platform stand-ins are not application or hosted installation SQL.
alter default privileges in schema public grant truncate,references,trigger,maintain on tables to anon,authenticated,service_role;
alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;
create schema storage;
grant usage on schema storage to authenticated,anon;
create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);
alter table storage.objects enable row level security;
grant select on storage.objects to authenticated,anon;

-- Exact fictional Auth extension from PR75 tools/partner-platform/assigned-backend.native.mjs.
-- This is not the provider managed Auth definition or a hosted authorization proof.
alter table auth.users add column deleted_at timestamptz,add column banned_until timestamptz;create table auth.sessions(id uuid primary key,user_id uuid references auth.users(id),not_after timestamptz);create function auth.jwt()returns jsonb language sql stable as $$select coalesce(nullif(current_setting('request.jwt.claims',true),''),'{}')::jsonb$$;grant execute on function auth.jwt() to authenticated;

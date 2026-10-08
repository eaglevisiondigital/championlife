-- Preserve monotonic template versions when an organization clones the global standard.
-- The global V1 template has no owner_organization_id, so the original owner-scoped
-- max(version) query alone would otherwise produce another V1.

create function private.outreach_ops_template_insert_version()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  next_version integer;
begin
  if new.status = 'draft' and new.owner_organization_id is not null then
    perform pg_catalog.pg_advisory_xact_lock(
      pg_catalog.hashtextextended(new.owner_organization_id::text || ':' || new.name, 0)
    );
    select coalesce(max(t.version), 0) + 1
      into next_version
      from public.outreach_ops_templates t
     where t.name = new.name
       and (t.owner_organization_id is null or t.owner_organization_id = new.owner_organization_id);
    new.version := greatest(new.version, next_version);
  end if;
  return new;
end
$$;

create trigger outreach_ops_template_insert_version
before insert on public.outreach_ops_templates
for each row execute function private.outreach_ops_template_insert_version();

revoke all on function private.outreach_ops_template_insert_version() from public, anon, authenticated;

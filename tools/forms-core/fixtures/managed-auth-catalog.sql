-- READ-ONLY CATALOG PROPOSAL. No Auth rows, RPC invocation, locks or privilege changes.
-- The uninstalled Forms migration requires this planned owner; installed owners are listed separately.
with requested as (select 'postgres'::text requested_role),
actor as (select r.* from pg_roles r join requested x on r.rolname=x.requested_role),
relation as (select c.oid,c.relowner,c.relacl,c.relrowsecurity,c.relforcerowsecurity from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname='auth' and c.relname='users'),
columns as (select a.attname from pg_attribute a join relation t on t.oid=a.attrelid where a.attnum>0 and not a.attisdropped)
select jsonb_build_object(
 'planned_execution_role',(select requested_role from requested),
 'role_exists',exists(select 1 from actor),
 'superuser',(select rolsuper from actor),
 'bypass_rls',(select rolbypassrls from actor),
 'auth_users_exists',exists(select 1 from relation),
 'auth_users_owner',(select pg_get_userbyid(relowner) from relation),
 'auth_users_acl',(select relacl::text from relation),
 'auth_users_rls',(select relrowsecurity from relation),
 'auth_users_forced_rls',(select relforcerowsecurity from relation),
 'auth_schema_usage',(select has_schema_privilege(a.oid,'auth','USAGE') from actor a),
 'required_columns',(select jsonb_object_agg(k,jsonb_build_object('exists',exists(select 1 from columns c where c.attname=k),'select',(select case when exists(select 1 from columns c where c.attname=k) then has_column_privilege(a.oid,t.oid,k,'SELECT') else false end from actor a cross join relation t))) from unnest(array['id','email_confirmed_at','is_anonymous'])k),
 'table_update',(select has_table_privilege(a.oid,t.oid,'UPDATE') from actor a cross join relation t),
 'any_column_update',case when exists(select 1 from actor) and exists(select 1 from relation) then (select coalesce(bool_or(has_column_privilege(a.oid,t.oid,c.attname,'UPDATE')),false) from actor a cross join relation t cross join columns c) else null end,
 'installed_sensitive_owners',(select coalesce(jsonb_agg(jsonb_build_object('signature',p.oid::regprocedure::text,'owner',pg_get_userbyid(p.proowner),'security_definer',p.prosecdef,'settings',p.proconfig,'acl',p.proacl::text) order by p.proname),'[]'::jsonb) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and p.proname in('forms_workspace','forms_lock_authority','forms_authorized','outreach_verified'))
) evidence;

select jsonb_build_object(
'collected_at',clock_timestamp(),'target','exdocjbmylgxssanymjk',
'migrations',(select jsonb_agg(jsonb_build_object('version',version,'name',name,'statements_hash',md5(statements::text)) order by version) from supabase_migrations.schema_migrations),
'functions',(select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)||coalesce(p.proacl::text,'')||pg_get_userbyid(p.proowner))) from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','app_private') and p.prokind='f'),
'table_policies',(select jsonb_object_agg(key,hash) from(select schemaname||'.'||tablename||'.'||policyname key,md5(roles::text||cmd||permissive||coalesce(qual,'')||coalesce(with_check,'')) hash from pg_policies where schemaname in('public','private','app_private','storage'))x),
'tables',(select jsonb_object_agg(n.nspname||'.'||c.relname,md5(jsonb_build_object(
'owner',pg_get_userbyid(c.relowner),'acl',c.relacl::text,'rls',c.relrowsecurity,'force_rls',c.relforcerowsecurity,
'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text,a.attidentity,a.attgenerated,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum) from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by k.conname) from pg_constraint k where k.conrelid=c.oid),
'triggers',(select jsonb_agg(jsonb_build_array(t.tgenabled,pg_get_triggerdef(t.oid)) order by t.tgname) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal)
)::text)) from pg_class c join pg_namespace n on n.oid=c.relnamespace where c.relkind in('r','p') and (n.nspname in('public','private','app_private') or(n.nspname='auth' and c.relname in('users','sessions')) or(n.nspname='storage' and c.relname in('objects','buckets'))))
) catalog;

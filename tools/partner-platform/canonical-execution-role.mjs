// SOURCE-ONLY, fixed execution profile. Does not create roles, install credentials,
// issue grants, change the old NOLOGIN/no-membership profile or mount a host.
export const CANONICAL_EXECUTION_LOGIN='partner_identity_host_login';
const reader='partner_canonical_reader';
const unavailable=()=>{throw Error('Canonical identity unavailable')};
export async function verifyCanonicalExecutionRole(c){
 const identity=(await c.query(`select session_user::text login,current_user::text reader,
  has_database_privilege(session_user,current_database(),'CONNECT') connect,
  has_database_privilege(session_user,current_database(),'CREATE') can_create,
  has_database_privilege(session_user,current_database(),'TEMP') temp`)).rows[0];
 if(JSON.stringify(identity)!==JSON.stringify({login:CANONICAL_EXECUTION_LOGIN,reader,connect:true,can_create:false,temp:false}))unavailable();
 const roles=(await c.query(`select rolname name,rolcanlogin login,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,
  rolconfig is not null configured,rolvaliduntil is not null and rolvaliduntil<=clock_timestamp() expired
  from pg_roles where rolname in ($1,$2) order by rolname`,[reader,CANONICAL_EXECUTION_LOGIN])).rows;
 if(roles.length!==2||roles.some(r=>r.login!==(r.name===CANONICAL_EXECUTION_LOGIN)||Object.entries(r).some(([key,value])=>!['name','login'].includes(key)&&value!==false)))unavailable();
 // One fixed SET-only edge. Both incoming and outgoing edges are checked: a
 // hidden role chain, inherited privileges, ADMIN option or delegation denies.
 const members=(await c.query(`select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,
  pg_get_userbyid(grantor) grantor,admin_option admin,inherit_option inherit,set_option can_set
  from pg_auth_members where roleid in(select oid from pg_roles where rolname in($1,$2))
  or member in(select oid from pg_roles where rolname in($1,$2))`,[reader,CANONICAL_EXECUTION_LOGIN])).rows;
 if(JSON.stringify(members)!==JSON.stringify([{role:reader,member:CANONICAL_EXECUTION_LOGIN,grantor:'postgres',admin:false,inherit:false,can_set:true}]))unavailable();
 // Evaluate effective privileges including PUBLIC, not merely explicit ACLs.
 // Check every non-system schema so finance/extension/other-app objects cannot
 // be reached by RESET ROLE or an accidental grant outside the pinned catalogs.
 const broad=(await c.query(`with roles as(select oid,rolname from pg_roles where rolname in($1,$2)),
 namespaces as(select oid,nspname,nspowner from pg_namespace where nspname not like 'pg_%' and nspname<>'information_schema')
 select 1 from roles r where
 exists(select 1 from pg_database where datdba=r.oid)
 or has_database_privilege(r.oid,current_database(),'CREATE,TEMP')
 or exists(select 1 from namespaces n where n.nspowner=r.oid or has_schema_privilege(r.oid,n.oid,'CREATE'))
 or exists(select 1 from pg_class t join namespaces n on n.oid=t.relnamespace where t.relowner=r.oid or
  (t.relkind='S' and has_sequence_privilege(r.oid,t.oid,'USAGE,SELECT,UPDATE')) or
  (t.relkind in('r','p','v','m','f') and (has_table_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or has_any_column_privilege(r.oid,t.oid,'SELECT,INSERT,UPDATE,REFERENCES'))))
 or exists(select 1 from pg_proc p join namespaces n on n.oid=p.pronamespace where p.proowner=r.oid or
  (has_schema_privilege(r.oid,n.oid,'USAGE') and p.prosecdef and has_function_privilege(r.oid,p.oid,'EXECUTE')
   and not(r.rolname=$1 and p.oid=to_regprocedure('partner_identity_host.current_snapshot(uuid,uuid,uuid,uuid,uuid)'))))`,[reader,CANONICAL_EXECUTION_LOGIN])).rows;
 if(broad.length)unavailable();
}

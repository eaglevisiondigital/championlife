// The separate host envelope never changes the accepted Issue50/catalog pins.
// Its dedicated caller has no application-table privilege or role membership.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const sql=readFileSync(new URL('./canonical-host-envelope.sql',import.meta.url),'utf8');
const body=sql.split('$envelope$')[1];
const digest=createHash('sha256').update(body).digest('hex');
export const CANONICAL_HOST_ROLE='partner_canonical_reader';
export const CANONICAL_HOST_SIGNATURE='partner_identity_host.current_snapshot(uuid,uuid,uuid,uuid,uuid)';
const unavailable=()=>{throw Error('Canonical identity unavailable')};
export async function verifyCanonicalHostEnvelope(c){
 const {rows}=await c.query(`select encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') hash,
  p.prosecdef definer,p.provolatile volatility,p.proconfig config,l.lanname language,
  pg_get_userbyid(p.proowner) owner,p.proretset returns_set,p.prorettype::regtype::text result,
  (select jsonb_agg(jsonb_build_array(case when x.grantee=0 then 'PUBLIC' else pg_get_userbyid(x.grantee) end,x.privilege_type,x.is_grantable) order by x.grantee,x.privilege_type) from aclexplode(p.proacl) x) acl
  from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure($1)`,[CANONICAL_HOST_SIGNATURE]);
 const f=rows[0];
 if(rows.length!==1||f.hash!==digest||f.definer!==true||f.volatility!=='v'||JSON.stringify(f.config)!=='["search_path=\\"\\""]'||f.language!=='plpgsql'||f.owner!=='postgres'||f.returns_set!==true||f.result!=='jsonb')unavailable();
 if(JSON.stringify(f.acl)!==JSON.stringify([['postgres','EXECUTE',false],[CANONICAL_HOST_ROLE,'EXECUTE',false]]))unavailable();
 const role=(await c.query(`select current_user name,rolcanlogin,rolsuper,rolcreatedb,rolcreaterole,rolinherit,rolreplication,rolbypassrls,
  exists(select 1 from pg_auth_members where member=r.oid or roleid=r.oid) membership
  from pg_roles r where rolname=$1`,[CANONICAL_HOST_ROLE])).rows[0];
 if(!role||role.name!==CANONICAL_HOST_ROLE||Object.entries(role).some(([key,value])=>key!=='name'&&value!==false))unavailable();
 const {rows:excess}=await c.query(`select c.oid from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private','auth','partner_identity_host') and c.relkind in ('r','p','v','m','S','f') and
  (case when c.relkind='S' then has_sequence_privilege($1,c.oid,'USAGE,SELECT,UPDATE') else
   has_table_privilege($1,c.oid,'SELECT,INSERT,UPDATE,DELETE,TRUNCATE,REFERENCES,TRIGGER') or
   has_any_column_privilege($1,c.oid,'SELECT,INSERT,UPDATE,REFERENCES') end)`,[CANONICAL_HOST_ROLE]);
 if(excess.length)unavailable();
 const exposed=(await c.query(`select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private','auth','partner_identity_host') and p.prosecdef and p.oid<>to_regprocedure($2) and has_function_privilege($1,p.oid,'EXECUTE')`,[CANONICAL_HOST_ROLE,CANONICAL_HOST_SIGNATURE])).rows;
 if(exposed.length)unavailable();
 const writableSchemas=(await c.query(`select oid from pg_namespace where nspname in ('public','private','auth','partner_identity_host') and has_schema_privilege($1,oid,'CREATE')`,[CANONICAL_HOST_ROLE])).rows;
 if(writableSchemas.length)unavailable();
 const schema=(await c.query(`select pg_get_userbyid(nspowner) owner,
  has_schema_privilege($1,oid,'USAGE') usage,has_schema_privilege($1,oid,'CREATE') can_create,
  (select count(*)::int from aclexplode(nspacl) a where a.grantee not in ((select oid from pg_roles where rolname='postgres'),(select oid from pg_roles where rolname=$1))) other_acl
  from pg_namespace where nspname='partner_identity_host'`,[CANONICAL_HOST_ROLE])).rows[0];
 if(!schema||schema.owner!=='postgres'||schema.usage!==true||schema.can_create!==false||schema.other_acl!==0)unavailable();
}

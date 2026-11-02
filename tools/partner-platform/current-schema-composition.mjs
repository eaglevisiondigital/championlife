// TEST-ONLY current-base composition. Not a migration, host or credential API.
// Call solely on an exclusively owned disposable fictional test connection.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=name=>readFileSync(new URL(name,import.meta.url),'utf8');
const digest=value=>createHash('sha256').update(typeof value==='string'?value:JSON.stringify(value)).digest('hex');
const sourceHash='b1785df783554eb27a9160a941c2599f4e9ec515839f4857d8deebb3fdb0f4e3';
export const compositionRelations=Object.freeze([
 'public.outreach_campaign_sources','public.outreach_campaign_followups',
 'private.city_identity_requests','private.city_identity_reviews',
 'private.city_care_requests','private.city_followup_events'
]);
export const compositionFunctions=Object.freeze([
 'private.city_decision_project(uuid)','private.city_decision_reconcile_a(uuid,jsonb)',
 'private.city_roster_can(uuid,text)','private.city_followup_assignee(uuid,uuid)',
 'private.city_care_assigned(uuid)','private.city_source_visible(uuid,uuid)',
 'private.city_identity_admin(uuid)','private.city_decision_reconcile(uuid,jsonb)',
 'private.city_care_workspace(uuid,text,jsonb)','private.city_decision_ingress()'
]);

// Semantic catalog snapshot for this new test-only preflight. PostgreSQL 18 adds
// separate NOT NULL constraint rows; attnotnull already records the same rule.
// This is NOT the canonical runtime verifier and does not modify its PG18 pins.
export async function captureCompositionCatalog(db){
 const functions=(await db.query(`select n.nspname||'.'||p.proname||'('||pg_get_function_identity_arguments(p.oid)||')' name,
  pg_get_functiondef(p.oid) definition,p.proacl::text acl,pg_get_userbyid(p.proowner) owner
  from pg_proc p join pg_namespace n on n.oid=p.pronamespace
  where n.nspname in ('public','private','auth','app_private','storage') and p.prokind='f' order by 1`)).rows;
 const relations=(await db.query(`select n.nspname||'.'||c.relname name,c.relkind::text kind,
  c.relrowsecurity rls,c.relforcerowsecurity force_rls,c.relacl::text acl,pg_get_userbyid(c.relowner) owner,
  (select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text,a.attidentity,pg_get_expr(d.adbin,d.adrelid)) order by a.attnum)
   from pg_attribute a left join pg_attrdef d on d.adrelid=a.attrelid and d.adnum=a.attnum where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped) columns,
  (select jsonb_agg(pg_get_constraintdef(k.oid) order by pg_get_constraintdef(k.oid)) from pg_constraint k where k.conrelid=c.oid and k.contype<>'n') constraints,
  (select jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) order by pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=c.oid) indexes,
  (select jsonb_agg(jsonb_build_array(pg_get_triggerdef(t.oid),t.tgenabled) order by pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal) triggers,
  (select jsonb_agg(jsonb_build_array(polname,polpermissive,polcmd,
   (select jsonb_agg(case when r=0 then 'PUBLIC' else pg_get_userbyid(r) end order by r) from unnest(polroles) r),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) order by polname) from pg_policy where polrelid=c.oid) policies
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname in ('public','private','auth','app_private','storage') and c.relkind in ('r','p','v','S') order by 1`)).rows;
 const defaults=(await db.query(`select pg_get_userbyid(d.defaclrole) owner,coalesce(n.nspname,'') schema,d.defaclobjtype::text type,d.defaclacl::text acl
  from pg_default_acl d left join pg_namespace n on n.oid=d.defaclnamespace order by 1,2,3`)).rows;
 const schemas=(await db.query(`select nspname name,pg_get_userbyid(nspowner) owner,nspacl::text acl from pg_namespace where nspname in ('public','private','auth','app_private','storage') order by 1`)).rows;
 const roles=(await db.query(`select rolname name,rolsuper,rolinherit,rolcreaterole,rolcreatedb,rolcanlogin,rolreplication,rolbypassrls,rolconfig from pg_roles where rolname in ('postgres','anon','authenticated','service_role') order by 1`)).rows;
 const memberships=(await db.query(`select pg_get_userbyid(roleid) role,pg_get_userbyid(member) member,admin_option,inherit_option,set_option from pg_auth_members where pg_get_userbyid(roleid) in ('postgres','anon','authenticated','service_role') or pg_get_userbyid(member) in ('postgres','anon','authenticated','service_role') order by 1,2`)).rows;
 return {functions,relations,defaults,schemas,roles,memberships};
}

export function composeCurrentSchemaSql(){
 let sql=read('./fixtures/issue50-identity-source.sql');
 if(digest(sql)!==sourceHash)throw Error('Sealed Issue50 source mismatch');
 // Retain exact writer bodies and constraints. The ONLY omissions from the
 // accepted subset are these two caller grants. Never run them even briefly.
 for(const signature of ['private.city_decision_reconcile(uuid,jsonb)','private.city_care_workspace(uuid,text,jsonb)']){
  const grant=`grant execute on function ${signature} to authenticated;`;
  if(sql.split(grant).length!==2)throw Error('Unexpected Issue50 grant contract');
  sql=sql.replace(grant,'-- Omitted: application writer authority is not installed by this test candidate.');
 }
 if(/\bgrant\s/i.test(sql.replace(/--[^\n]*/g,'')))throw Error('Unexpected grant in narrow composition');
 // Close inherited/default service and sequence privileges as well. No host
 // caller, role membership, account, assignment or public wrapper is created.
 sql+='\nrevoke all on function '+compositionFunctions.join(',')+' from public,anon,authenticated,service_role;\n';
 sql+='revoke all on table '+compositionRelations.join(',')+' from public,anon,authenticated,service_role;\n';
 sql+='revoke all on sequence private.city_followup_events_id_seq from public,anon,authenticated,service_role;\n';
 return sql;
}

export async function installCurrentSchemaComposition(db){
 const expected=JSON.parse(read('./fixtures/current-schema-baseline.json'));
 await db.query('begin');
 try{
  await db.query('set local search_path=pg_catalog,public');
  const before=await captureCompositionCatalog(db);
  if(digest(before)!==expected.catalogSha256)throw Error('Unreviewed current Partner schema baseline');
  await db.exec(composeCurrentSchemaSql());
  const after=await captureCompositionCatalog(db);
  // All prior function bodies, ACLs, public wrappers and operations security
  // stay identical. Only the reviewed campaign assignment shape may change.
  for(const fn of before.functions)if(JSON.stringify(after.functions.find(x=>x.name===fn.name))!==JSON.stringify(fn))throw Error('Existing function changed');
  for(const relation of before.relations){
   const next=after.relations.find(x=>x.name===relation.name);
   if(relation.name==='public.outreach_campaign_assignments'){
    if(digest(next)!==expected.assignmentAfterSha256)throw Error('Unexpected assignment shape');
   }else if(JSON.stringify(next)!==JSON.stringify(relation))throw Error('Existing relation changed');
  }
  for(const key of ['defaults','schemas','roles','memberships'])if(JSON.stringify(after[key])!==JSON.stringify(before[key]))throw Error('Existing privilege boundary changed');
  await db.query('commit');
 }catch(error){await db.query('rollback');throw error}
}

// SERVER-ONLY, UNMOUNTED source candidate. No connection, role or RPC is installed.
// acquire() must return an exclusively owned, idle database connection from trusted
// server configuration. Browser values may never supply a connection or principal.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {verifyCanonicalHostEnvelope,verifyCanonicalExecutionHostEnvelope} from './canonical-host-envelope.mjs';
import {IDENTITY_SOURCE_HASHES} from './canonical-identity-boundary.mjs';
const provenanceBytes=readFileSync(new URL('./fixtures/issue50-installed-provenance.json',import.meta.url));
const expected=JSON.parse(provenanceBytes);
const restrictedProfile=JSON.parse(readFileSync(new URL('./fixtures/restricted-canonical-profile.json',import.meta.url),'utf8'));
if(createHash('sha256').update(provenanceBytes).digest('hex')!==restrictedProfile.historicalManifestSha256)throw Error('Restricted profile historical source changed');
const restrictedExpected=structuredClone(expected);
// Source-selected profile only: no request/configuration may supply pins or ACLs.
for(const signature of restrictedProfile.withheldAuthenticatedExecution){
 if(JSON.stringify(expected.functions[signature]?.privileges)!=='[false,true,false]')throw Error('Restricted profile source privileges changed');
 restrictedExpected.functions[signature].privileges=[false,false,false];
}
const sql=readFileSync(new URL('./canonical-repository.sql',import.meta.url),'utf8');
const uuid=x=>typeof x==='string'&&x.length===36&&/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/.test(x);
const fields=['organizationId','campaignId','assignmentId','userId','sessionId'];
const unavailable=()=>{throw Error('Canonical identity unavailable')};
// No caller-provided fingerprints. This manifest derives from the selected
// accepted definitions and existing canonical schema, never a client snapshot.
function provenanceVerifier(expected){return async function verifyCanonicalRepositoryProvenance(connection){
 for(const [signature,definition] of Object.entries(expected.functions)){
  const {rows}=await connection.query(`select encode(sha256(convert_to(p.prosrc,'UTF8')),'hex') hash,
   p.prosecdef definer,p.provolatile volatility,p.proconfig config,l.lanname language,pg_get_userbyid(p.proowner) owner, jsonb_build_array(has_function_privilege('anon',p.oid,'execute'),has_function_privilege('authenticated',p.oid,'execute'),has_function_privilege('service_role',p.oid,'execute')) privileges
   from pg_proc p join pg_language l on l.oid=p.prolang where p.oid=to_regprocedure($1)`,[signature]);
  if(rows.length!==1||JSON.stringify(rows[0])!==JSON.stringify(definition))unavailable();
 }
 for(const [relation,definition] of Object.entries(expected.relations)){
  const {rows}=await connection.query(`select jsonb_build_object(
   'columns',(select jsonb_agg(jsonb_build_array(a.attname,format_type(a.atttypid,a.atttypmod),a.attnotnull,a.attacl::text) order by a.attnum) from pg_attribute a where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),
   'constraints',(select jsonb_agg(pg_get_constraintdef(k.oid) order by pg_get_constraintdef(k.oid)) from pg_constraint k where k.conrelid=c.oid),
   'indexes',(select jsonb_agg(jsonb_build_array(pg_get_indexdef(i.indexrelid),i.indisvalid,i.indisready) order by pg_get_indexdef(i.indexrelid)) from pg_index i where i.indrelid=c.oid),
   'triggers',(select jsonb_agg(pg_get_triggerdef(t.oid) order by pg_get_triggerdef(t.oid)) from pg_trigger t where t.tgrelid=c.oid and not t.tgisinternal and t.tgenabled='O'),
   'policies',(select jsonb_agg(jsonb_build_array(polname,polpermissive,polcmd,(select jsonb_agg(case when role_oid=0 then 'PUBLIC' else pg_get_userbyid(role_oid) end order by role_oid) from unnest(polroles) role_oid),pg_get_expr(polqual,polrelid),pg_get_expr(polwithcheck,polrelid)) order by polname) from pg_policy where polrelid=c.oid),'privileges', (select jsonb_agg(jsonb_build_array(role_name, privilege_name,has_table_privilege(role_name,c.oid,privilege_name)) order by role_name,privilege_name) from unnest(array['anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER']) privilege_name), 'columnPrivileges',(select jsonb_agg(jsonb_build_array(a.attname,role_name,privilege_name,has_column_privilege(role_name,c.oid,a.attnum,privilege_name)) order by a.attnum,role_name,privilege_name) from pg_attribute a cross join unnest(array['anon','authenticated','service_role']) role_name cross join unnest(array['SELECT','INSERT','UPDATE','REFERENCES']) privilege_name where a.attrelid=c.oid and a.attnum>0 and not a.attisdropped),'owner',pg_get_userbyid(c.relowner),'rls',c.relrowsecurity) definition from pg_class c where c.oid=to_regclass($1)`,[relation]);
  if(rows.length!==1||createHash('sha256').update(JSON.stringify(rows[0].definition)).digest('hex')!==definition)unavailable();
 }
}
}
export const verifyCanonicalRepositoryProvenance=provenanceVerifier(expected);
export const verifyRestrictedCanonicalRepositoryProvenance=provenanceVerifier(restrictedExpected);
export function createExecutionCanonicalPartnerRoutineRepository({acquire}){return repositoryFor(acquire,true,verifyRestrictedCanonicalRepositoryProvenance,verifyCanonicalExecutionHostEnvelope)}
export function createRestrictedCanonicalPartnerRoutineRepository({acquire}){return repositoryFor(acquire,true,verifyRestrictedCanonicalRepositoryProvenance)}
export function createCanonicalPartnerRepository({acquire}){return repositoryFor(acquire,false)}
export function createCanonicalPartnerRoutineRepository({acquire}){return repositoryFor(acquire,true)}
function repositoryFor(acquire,routine,verifyProvenance=verifyCanonicalRepositoryProvenance,verifyEnvelope=verifyCanonicalHostEnvelope){
 if(typeof acquire!=='function')throw TypeError('Trusted private database connection required');
 return Object.freeze({sourceHashes:IDENTITY_SOURCE_HASHES,async withCurrentIdentity(request,consume){
  if(!request||Object.getPrototypeOf(request)!==Object.prototype||Reflect.ownKeys(request).length!==fields.length||!fields.every(k=>uuid(request[k]))||typeof consume!=='function')unavailable();
  const c=await acquire();let transaction=false,committed=false;
  try{
   await c.query('begin isolation level read committed');transaction=true;
   await c.query('set local search_path=pg_catalog,public');
   await c.query("set local lock_timeout='750ms'");await c.query("set local statement_timeout='3s'");
   await c.query("select set_config('request.jwt.claim.sub',$1,true),set_config('request.jwt.claims',$2,true)",[request.userId,JSON.stringify({session_id:request.sessionId})]);
   await verifyProvenance(c);
   // Reuse exact accepted Partner authorization/locks before reading identity.
   if(routine)await verifyEnvelope(c);
   if(!routine){
   const metadata=(await c.query('select private.partner_assigned_metadata($1,$2) value',[request.campaignId,request.assignmentId])).rows[0]?.value;
   if(metadata?.length!==1||metadata[0].organizationId!==request.organizationId||metadata[0].status!=='active')unavailable();
   }
   const {rows}=await c.query(routine?'select snapshot from partner_identity_host.current_snapshot($1,$2,$3,$4,$5)':sql,fields.map(k=>request[k]));
   if(rows.length!==1)unavailable();
   // Catalog definition changes deny; normal application writers cannot alter
   // schema/functions. DDL owners are a trusted maintenance boundary, not users.
   await verifyProvenance(c);
   if(routine)await verifyEnvelope(c);
   const returned=consume(rows[0].snapshot);
   if(returned&&typeof returned.then==='function')unavailable();
   await c.query('commit');committed=true;
  }finally{
   if(transaction&&!committed)try{await c.query('rollback')}catch{}
   // Discard failed connections: a rollback error must never recycle open locks
   // or transaction-local identity settings into another request.
   await c.release(!committed);
  }
 }});
}

// Regenerate only against owned disposable native PostgreSQL. Never accepts a hosted target.
import fs from 'node:fs';import assert from 'node:assert/strict';import{fixture,forms,dream,historical,sha}from'./source.mjs';import{dependencies,eventRelations,helpers,events,relationCatalog,functionCatalog,registryCatalog,digest,eventTriggerCatalog,existingCatalog,preservedCatalog,anonymousExposure}from'./catalog.mjs';
const migration='20261104171549_events_guarded_forward.sql',f=await fixture(),registry=[];let base,post;const schemaQuery="select jsonb_agg(jsonb_build_object('name',nspname,'owner',nspowner::regrole::text,'acl',nspacl::text)order by nspname)from pg_namespace where nspname in('public','private')";
try{for(const order of[['forms','dream'],['dream','forms']]){const db=await f.nativeDatabase();try{await f.baseline(db);await db.exec('set search_path=pg_catalog');base={relations:await digest(db,relationCatalog(dependencies,true)),helpers:await digest(db,functionCatalog(helpers)),schemas:await digest(db,schemaQuery),ddlTriggers:await digest(db,eventTriggerCatalog)};registry.push(await digest(db,registryCatalog));for(const mod of order){await db.exec(mod==='forms'?forms():dream());registry.push(await digest(db,registryCatalog))}await db.exec(historical());post={schemas:await digest(db,schemaQuery),relations:await digest(db,relationCatalog(eventRelations)),functions:await digest(db,functionCatalog(events))};}finally{await db.close()}}}finally{f.cleanup()}
const unique=[...new Set(registry)];assert.equal(unique.length,5,'Five known registry definitions/constraint pairs');
const check=(query,hash,message)=>`if encode(sha256(convert_to((${query})::text,'UTF8')),'hex') is distinct from '${hash}'then raise exception '${message}';end if;`;
const body=historical();
const pre=`-- SOURCE-ONLY guarded Events forward installer. Exact target approval and genuine acceptance remain required.
-- Reviewed Events body SHA256 ${sha(historical())}; unchanged body. Exact historical anon schema USAGE is permitted only after zero existing exposure proof.
-- CLI2.81.3 generated filename. No other historical module, registry or course-policy replay.
begin;
set local search_path=pg_catalog;
set local lock_timeout='5s';
set local statement_timeout='60s';
do $preflight$
begin
 if current_user<>'postgres'then raise exception 'Reviewed postgres installation owner required';end if;
 perform pg_advisory_xact_lock(hashtextextended('championlife:events:forward:v1',0));
 if exists(select 1 from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')and(left(c.relname,6)='event_'or left(c.relname,7)='events_'))or exists(select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private')and(left(p.proname,6)='event_'or left(p.proname,7)='events_'))then raise exception 'Events exists or is partial: separate exact-target upgrade review required';end if;
 ${check(relationCatalog(dependencies,true),base.relations,'Canonical Events dependency relation/ACL/RLS/constraint/trigger drift')}
 ${check(functionCatalog(helpers),base.helpers,'Canonical Events authority definition/owner/ACL drift')}
 ${check(schemaQuery,base.schemas,'Reviewed schema owner/ACL drift')}
 ${check(eventTriggerCatalog,base.ddlTriggers,'Unreviewed DDL event-trigger composition')}
 perform set_config('championlife.events_existing_catalog',encode(sha256(convert_to((${preservedCatalog})::text,'UTF8')),'hex'),true);
 if encode(sha256(convert_to((${registryCatalog})::text,'UTF8')),'hex')not in(${unique.map(x=>"'"+x+"'").join(',')})then raise exception 'Unreviewed registry/constraint pair';end if;
 -- No managed Auth grants, rewrites or invented provider function definitions.
 if to_regprocedure('auth.uid()')is null or not exists(select 1 from pg_proc where oid=to_regprocedure('auth.uid()')and prorettype='uuid'::regtype)or not has_function_privilege(current_user,'auth.uid()','EXECUTE')then raise exception 'Required managed Auth uid capability unavailable';end if;
 if to_regclass('auth.users')is null or not has_schema_privilege(current_user,'auth','USAGE')then raise exception 'Managed Auth users capability unavailable';end if;
 if (select count(*)from pg_attribute where attrelid='auth.users'::regclass and not attisdropped and ((attname='id'and atttypid='uuid'::regtype)or(attname='email_confirmed_at'and atttypid='timestamptz'::regtype)or(attname='is_anonymous'and atttypid='boolean'::regtype)))<>3 then raise exception 'Managed Auth verified identity shape unavailable';end if;
 if not has_column_privilege(current_user,'auth.users','id','SELECT')or not has_column_privilege(current_user,'auth.users','email_confirmed_at','SELECT')or not has_column_privilege(current_user,'auth.users','is_anonymous','SELECT')then raise exception 'Managed Auth verified identity read capability unavailable';end if;
 if not has_schema_privilege('authenticated','private','USAGE')then raise exception 'Existing authenticated private usage required';end if;
 if exists(select 1 from pg_roles where rolname='anon'and(rolsuper or rolbypassrls))or has_schema_privilege('anon','private','CREATE')then raise exception 'Anonymous role exceeds reviewed boundary';end if;
 if (${anonymousExposure})is distinct from '{\"functions\":[],\"relations\":[],\"sequences\":[]}'::jsonb then raise exception 'Existing anonymous private capability would be newly exposed';end if;
 if exists(select 1 from pg_operator o join pg_namespace n on n.oid=o.oprnamespace where n.nspname='private')or exists(select 1 from pg_conversion c join pg_namespace n on n.oid=c.connamespace where n.nspname='private')then raise exception 'Unreviewed private operator/conversion surface';end if;
end;
$preflight$;
`;
const after=`
do $postflight$begin
 ${check(relationCatalog(eventRelations),post.relations,'Events post-install table/view/ACL/RLS/constraint mismatch')}
 ${check(functionCatalog(events),post.functions,'Events post-install function owner/ACL/definition mismatch')}
 ${check(relationCatalog(dependencies,true),base.relations,'Existing canonical dependencies changed')}
 ${check(functionCatalog(helpers),base.helpers,'Existing canonical authority changed')}
 ${check(schemaQuery,post.schemas,'Unexpected schema privilege change beyond reviewed anon usage')}
 if encode(sha256(convert_to((${preservedCatalog})::text,'UTF8')),'hex')is distinct from current_setting('championlife.events_existing_catalog',true)then raise exception 'Existing application catalog changed during Events installation';end if;
end;$postflight$;
commit;
`;
const sql=pre+body+after;const target=new URL('../../supabase/migrations/'+migration,import.meta.url);if(process.argv.includes('--check'))assert.equal(fs.readFileSync(target,'utf8'),sql,'Guarded migration reproducibility');else fs.writeFileSync(target,sql);
const proof={migration,bodySHA256:sha(historical()),guardedSHA256:sha(sql),base,post,acceptedRegistryPairs:unique};console.log(JSON.stringify(proof,null,2));

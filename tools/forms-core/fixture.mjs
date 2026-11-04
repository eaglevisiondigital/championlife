import {readFileSync} from 'node:fs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
export const migration='20261104042117_forms_private_draft_core.sql';
export const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
export const id=n=>`76000000-0000-4000-8000-${String(n).padStart(12,'0')}`;
export async function baseline(db){
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(`alter default privileges in schema public grant truncate,references,trigger,maintain on tables to anon,authenticated,service_role;alter default privileges in schema public revoke execute on functions from public,anon,authenticated,service_role;create schema storage;grant usage on schema storage to anon,authenticated;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to anon,authenticated;`);
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const file of migrationOrder)await db.exec(read('supabase/migrations/'+file));
 await db.exec(read('tools/forms-core/fixtures/accepted-reader-baseline.sql'));
}
export async function seed(db){
 const org=(await db.query("select id from organizations where slug='champion-life'")).rows[0].id;
 const other=(await db.query("select id from organizations where slug='sowgo'")).rows[0].id;
 for(let n=1;n<=4;n++){
 await db.query('insert into auth.users(id,email,email_confirmed_at) values($1,$2,$3)',[id(n),`forms-${n}@example.test`,n===4?null:new Date().toISOString()]);
 await db.query("insert into organization_staff_directory(organization_id,user_id,display_name) values($1,$2,'Synthetic Forms')",[org,id(n)]);
 }
 for(const n of [1,2,4])for(const key of ['forms.read','forms.create','forms.edit'])await db.query('insert into organization_staff_permissions(organization_id,user_id,permission) values($1,$2,$3)',[org,id(n),key]);
 return {org,other};
}
export async function as(db,n=1,role='authenticated'){await db.exec('reset role');await db.query("select set_config('request.jwt.claim.sub',$1,false)",[n?id(n):'']);await db.exec('set role '+role);}
export async function call(db,org,action,payload={}){return(await db.query('select public.forms_workspace($1,$2,$3) v',[action,org,JSON.stringify(payload)])).rows[0].v;}
export const definition=()=>({sections:[{key:'main',title:'Existing private source',columns:1,fields:[{key:'name',type:'name',label:'Name',required:true}]}],conditions:[],settings:{public_available:false,branding:'champion-life',timezone:'UTC'},payment:{}});
export const create=(slug='private-test')=>({name:'Private draft',type:'registration',slug,definition:definition()});
export async function catalog(db){return(await db.query(`select jsonb_build_object('tables',(select jsonb_agg(to_jsonb(x)order by schema,name)from(select n.nspname schema,c.relname name,c.relrowsecurity rls,c.relowner::regrole::text owner,c.relacl::text acl from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in('public','private')and c.relkind='r')x),'functions',(select jsonb_agg(to_jsonb(x)order by schema,name,args)from(select n.nspname schema,p.proname name,pg_get_function_identity_arguments(p.oid) args,pg_get_functiondef(p.oid) definition,p.proowner::regrole::text owner,p.proacl::text acl from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in('public','private','app_private')and p.prokind='f')x),'policies',(select jsonb_agg(to_jsonb(x)order by schemaname,tablename,policyname)from pg_policies x where schemaname in('public','private','storage'))) v`)).rows[0].v;}

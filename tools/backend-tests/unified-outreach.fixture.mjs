import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {localPostgres} from './local-postgres.mjs';
const root=new URL('../../',import.meta.url);
export const files=readdirSync(new URL('supabase/migrations/',root)).filter(x=>x.endsWith('.sql')).sort();
export const read=p=>readFileSync(new URL(p,root),'utf8');
export async function database(beforeCandidate){
 const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite();
 try {
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(`create schema storage;create table storage.buckets(id text primary key,name text not null,public boolean not null default false,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text references storage.buckets(id),name text not null,metadata jsonb,unique(bucket_id,name));alter table storage.objects enable row level security;grant usage on schema storage to anon,authenticated,service_role;grant select,insert,update,delete on storage.objects to anon,authenticated,service_role;`);
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 let captured=false;
 for(const file of files){
  if(!captured&&file>'20261018121900_allow_huntsville_decision_registrations.sql'){captured=true;if(beforeCandidate)await beforeCandidate(db);}
  try{await db.exec(read('supabase/migrations/'+file));}catch(e){throw new Error(file+': '+e.message+' '+(e.where||''),{cause:e});}
 }
 return db;
 }catch(e){await db.close();throw e;}
}

// Disposable fictional platform only. These Storage/Auth stand-ins MUST NOT be
// applied to Supabase. The existing 26 SQL files plus this exact released reader
// account for the 27 persistent current-main application sources; historical
// migration aliases and the three removed installers are not replayed here.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {installCurrentSchemaComposition} from './current-schema-composition.mjs';
export async function installCurrentReaderPrerequisite(db){
 const sql=readFileSync(new URL('../../supabase/release/king-kind-reader-private-storage-candidate.sql',import.meta.url),'utf8');
 if(createHash('sha256').update(sql).digest('hex')!=='aac5ec4ee74a8b59b8b8bb1bd5ec1f4254fd6f0585fcc2fe1f63942c8dce4fb1')throw Error('Released reader source changed');
 await db.exec(`create schema storage;
  create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);
  create table storage.objects(id uuid primary key,bucket_id text references storage.buckets(id),name text);
  alter table storage.buckets enable row level security;
  alter table storage.objects enable row level security;`);
 await db.exec(sql);
}
export async function currentSchemaSourceFixture(db){
 return canonicalSourceFixture(db,{installIssue50:async connection=>{
  await installCurrentReaderPrerequisite(connection);
  await installCurrentSchemaComposition(connection);
 }});
}

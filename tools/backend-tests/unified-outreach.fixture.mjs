import {PGlite} from '@electric-sql/pglite';
import {readFileSync,readdirSync} from 'node:fs';
import {localPostgres} from './local-postgres.mjs';
const root=new URL('../../',import.meta.url);
export const files=readdirSync(new URL('supabase/migrations/',root)).filter(x=>x.endsWith('.sql')).sort();
export const read=p=>readFileSync(new URL(p,root),'utf8');
export async function database(beforeCandidate){
 const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite();
 try {
 await db.exec(read('tools/backend-tests/fixtures/unified-bootstrap.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 let captured=false;
 for(const file of files){
  if(!captured&&file>'20261018121900_allow_huntsville_decision_registrations.sql'){captured=true;if(beforeCandidate)await beforeCandidate(db);}
  try{await db.exec(read('supabase/migrations/'+file));}catch(e){throw new Error(file+': '+e.message+' '+(e.where||''),{cause:e});}
 }
 return db;
 }catch(e){await db.close();throw e;}
}

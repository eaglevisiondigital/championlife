// Native disposable PostgreSQL only. Existing migration bytes are verified before execution.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read = path => readFileSync(new URL('../../'+path,import.meta.url),'utf8');
export async function installCampaignBaseline(db) {
 const manifest=JSON.parse(read('tools/outreach/campaign-foundation-baseline.json'));
 const verified=new Map(manifest.files.map(entry=>{
  const sql=read(entry.path);
  assert.equal(createHash('sha256').update(sql).digest('hex'),entry.sha256,entry.path+' reviewed source hash');
  if(entry.reviewed_production_sha256) assert.equal(createHash('sha256').update(entry.production_omits_final_lf?sql.replace(/\n$/,''):sql).digest('hex'),entry.reviewed_production_sha256,'reviewed production SQL (explicit trailing LF alias only)');
  return [entry.path,sql];
 }));
 await db.exec(verified.get('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('tools/outreach/campaign-foundation-fixture.sql'));
 await db.exec(verified.get('supabase/bootstrap/automatic-rls.sql'));
 const entries=manifest.files.filter(entry=>entry.production_path);
 assert.equal(entries.length,27);
 for (const entry of entries) await db.exec(verified.get(entry.path));
 const tables=(await db.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace and relkind='r'")).rows[0].n;
 assert.equal(tables,49,'reviewed baseline public table count');
 assert.equal((await db.query('select count(*)::int n from auth.users')).rows[0].n,0,'baseline creates no users');
 assert.equal((await db.query("select to_regprocedure('public.outreach_decision_workspace(text,uuid,jsonb)') p")).rows[0].p,null,'historical decision function is absent from baseline');
 return {persistentMigrations:entries.length,publicTables:tables};
}

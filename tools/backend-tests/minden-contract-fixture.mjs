// Source-pinned LOCAL fixture; no remote endpoint, real identities or grants.
import {readFileSync} from 'node:fs';import {createHash} from 'node:crypto';import assert from 'node:assert/strict';
import {migrationOrder} from './migration-order.mjs';
export const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
function verifyFixtures(){
 const manifest=JSON.parse(read('tools/backend-tests/fixtures/minden/source.json'));
 for(const entry of manifest.files){const text=read(entry.path);assert.equal(createHash('sha256').update(text).digest('hex'),entry.sha256,'pinned '+entry.path);}
}
export async function installMindenBaseline(db){
 verifyFixtures();
 await db.exec(read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));
 await db.exec(read('tools/backend-tests/fixtures/minden/platform.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const file of migrationOrder)await db.exec(read('supabase/migrations/'+file));
 await db.exec(read('supabase/release/king-kind-reader-private-storage-candidate.sql'));
 await db.exec(read('supabase/migrations/20261112120000_minden_family_fun_day_draft.sql'));
 await db.exec(read('supabase/migrations/20261112120001_minden_decision_followup_view.sql'));
}
export async function installApprovedDecisionFoundation(db){
 verifyFixtures();
 await db.exec(read('tools/backend-tests/fixtures/minden/campaign-foundation.sql'));
}
export const correction='supabase/migrations/20261113120000_minden_decision_authority_correction.sql';

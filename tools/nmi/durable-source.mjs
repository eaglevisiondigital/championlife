// Exact current-main + reviewed NMI SQL, loaded locally from Git objects. No remote fallback.
import {execFileSync} from 'node:child_process';
import {readFileSync,mkdtempSync,writeFileSync,rmSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {tmpdir} from 'node:os';
import {join,dirname} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const main='bfb7af214707db73a3a3164bc96ccafae7de8ccf',nmi='84b2d9ab398bb8046570019da26a5db67fe77467';
export function verifiedDurableSources() {
 const pin=JSON.parse(readFileSync(new URL('./durable-source-pin.json',import.meta.url)));
 if(pin.productionMain!==main||pin.reviewedNmi!==nmi||pin.files.length!==43)throw Error('UNREVIEWED_COMPOSITION');
 const seen=new Set(),rows=pin.files.map(row=>{
  if(![main,nmi].includes(row.commit)||seen.has(row.path)||!/^((supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql)|(supabase\/bootstrap\/automatic-rls\.sql)|(tools\/backend-tests\/(fixtures\/supabase-test-bootstrap\.sql|giving-fixture\.mjs|payments-fixture\.mjs)))$/.test(row.path))throw Error('UNREVIEWED_SOURCE');
  seen.add(row.path);const bytes=execFileSync('git',['show',`${row.commit}:${row.path}`],{cwd:dirname(fileURLToPath(import.meta.url)),stdio:['ignore','pipe','pipe'],maxBuffer:2_000_000});
  if(createHash('sha256').update(bytes).digest('hex')!==row.sha256)throw Error('SOURCE_HASH_MISMATCH');
  return {...row,sql:bytes.toString('utf8')};
 });
 const expected=execFileSync('git',['ls-tree','--full-tree','-r','--name-only',main,'supabase/migrations'],{cwd:dirname(fileURLToPath(import.meta.url)),encoding:'utf8'}).trim().split('\n');
 const baseline=rows.filter(r=>r.kind==='current-main');
 if(baseline.length!==26||JSON.stringify(baseline.map(r=>r.path))!==JSON.stringify(expected)||baseline.some(r=>r.commit!==main)||rows.filter(r=>r.kind==='reviewed-nmi-gate0').length!==13)throw Error('INCOMPLETE_BASELINE');
 return Object.freeze(rows);
}
export async function pinnedFinancialFixtures(rows=verifiedDurableSources()) {
 const folder=mkdtempSync(join(tmpdir(),'nmi-fixture-source-'));
 try {
  for(const name of ['giving-fixture.mjs','payments-fixture.mjs']){
   const row=rows.find(r=>r.path===`tools/backend-tests/${name}`);writeFileSync(join(folder,name),row.sql,{mode:0o600});
  }
  return await import(pathToFileURL(join(folder,'payments-fixture.mjs')).href);
 }finally{rmSync(folder,{recursive:true,force:true});}
}

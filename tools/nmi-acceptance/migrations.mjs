// Offline planning only. Preserve reported applied versions in a disposable package;
// never rename repository files, repair a hosted ledger or apply SQL.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {productionOrder,givingOrder,integrationOrder,executionOrder} from '../backend-tests/migration-order.mjs';
export async function planAcceptanceMigrations(root,baseline){
  const expected=JSON.parse(await readFile(join(root,'docs/NMI-CUTOVER-PROTECTED-FILES.json'),'utf8')).production_commit;
  if(baseline.productionCommit!==expected)throw Error('Production baseline commit mismatch.');
  const rows=baseline.migrations;
  if(!Array.isArray(rows)||rows.length!==productionOrder.length||new Set(rows.map(x=>x.sourceFile)).size!==productionOrder.length||rows.some(x=>!productionOrder.includes(x.sourceFile)))throw Error('Expected exact production source-file inventory.');
  const staged=[];
  for(const row of rows){
    if(!/^\d{14}$/.test(row.version)||!/^[a-z0-9_]+$/.test(row.name)||!['none','trim-final-newline'].includes(row.sourceNormalization))throw Error('Invalid production version metadata.');
    let sql=await readFile(join(root,'supabase/migrations',row.sourceFile),'utf8');
    if(row.sourceNormalization==='trim-final-newline')sql=sql.replace(/\n$/,'');
    if(createHash('md5').update(sql).digest('hex')!==row.sql_md5)throw Error('Production SQL hash mismatch: '+row.sourceFile);
    staged.push({file:row.version+'_'+row.name+'.sql',source:row.sourceFile,sql,kind:'production_baseline'});
  }
  const last=staged.at(-1).file.slice(0,14);
  for(const file of [...givingOrder,...integrationOrder,...executionOrder]){
    if(file.slice(0,14)<=last)throw Error('Candidate migration is not forward-only.');
    staged.push({file,source:file,sql:await readFile(join(root,'supabase/migrations',file),'utf8'),kind:'giving_candidate'});
  }
  const versions=staged.map(x=>x.file.slice(0,14));
  if(new Set(versions).size!==versions.length||versions.some((x,i)=>i&&x<=versions[i-1]))throw Error('Migration versions must be unique and strictly ordered.');
  return staged;
}

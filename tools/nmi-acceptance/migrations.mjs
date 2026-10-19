// Offline planning only. Preserve reported applied versions in a disposable package;
// never rename repository files, repair a hosted ledger or apply SQL.
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {createHash} from 'node:crypto';
import {productionOrder,givingOrder,integrationOrder,executionOrder,gate0Order} from '../backend-tests/migration-order.mjs';
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
  const dependency=JSON.parse(await readFile(join(root,'docs/NMI-CUTOVER-GATE0-DEPENDENCY.json'),'utf8'));
  if(dependency.nmi_source_checkpoint!=='d82ed7fdb049389ae43d50a2ceb1ac300665a7cc'||
     !/^[a-f0-9]{40}$/.test(dependency.gate0_authoritative_commit||'')||
     dependency.status!=='REVIEWED_PRIMARY_FOLLOWUP'||
     gate0Order.length!==1||dependency.migration!==gate0Order[0]||
     !/^[a-f0-9]{64}$/.test(dependency.sha256||''))throw Error('Gate0 dependency is not pinned to the reviewed primary follow-up.');
  const groups=[['giving_candidate',[...givingOrder,...integrationOrder,...executionOrder]],['shared_platform_gate0',gate0Order]];
  for(const[kind,files]of groups)for(const file of files){
    if(file.slice(0,14)<=last)throw Error('Candidate migration is not forward-only.');
    const sql=await readFile(join(root,'supabase/migrations',file),'utf8');
    if(kind==='shared_platform_gate0'&&createHash('sha256').update(sql).digest('hex')!==dependency.sha256)throw Error('Gate0 SQL hash mismatch.');
    staged.push({file,source:file,sql,kind});
  }
  const versions=staged.map(x=>x.file.slice(0,14));
  if(new Set(versions).size!==versions.length||versions.some((x,i)=>i&&x<=versions[i-1]))throw Error('Migration versions must be unique and strictly ordered.');
  return staged;
}

// Offline source/hash worksheet only. Requires the exact reviewed primary dependency.
import {readFile,writeFile} from 'node:fs/promises';
import {resolve,dirname,join} from 'node:path';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {planAcceptanceMigrations} from './migrations.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const baseline=JSON.parse(await readFile(join(root,'docs/NMI-CUTOVER-PRODUCTION-BASELINE.json'),'utf8'));
const dependency=JSON.parse(await readFile(join(root,'docs/NMI-CUTOVER-GATE0-DEPENDENCY.json'),'utf8'));
const plan=await planAcceptanceMigrations(root,baseline);
const hash=(bytes,algorithm='sha256')=>createHash(algorithm).update(bytes).digest('hex');
const order=await Promise.all(plan.map(async(item,index)=>({order:index+1,kind:item.kind,source:item.source,staged:item.file,
 source_sha256:hash(await readFile(join(root,'supabase/migrations',item.source))),staged_sha256:hash(item.sql),staged_sql_md5:hash(item.sql,'md5')})));
const worksheet={production_base:baseline.productionCommit,baseline_confirmation:baseline.provenance.primary_confirmation,
 nmi_source_checkpoint:dependency.nmi_source_checkpoint,gate0_dependency:dependency,
 baseline_count:25,giving_forward_count:12,gate0_count:1,forward_count:13,order};
if(plan.length!==38||plan.filter(x=>x.kind==='giving_candidate').length!==12||plan.filter(x=>x.kind==='shared_platform_gate0').length!==1)throw Error('Expected exact 25 + 12 + 1 migration composition.');
await writeFile(join(root,'docs/NMI-CUTOVER-ACCEPTANCE-MIGRATIONS.json'),JSON.stringify(worksheet,null,2)+'\n');
console.log('Updated reviewed offline worksheet: 25 confirmed baseline + 12 Giving + 1 Gate0, all source/staged hashes. No hosted action.');

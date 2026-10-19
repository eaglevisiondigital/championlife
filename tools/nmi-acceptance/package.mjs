// Offline packaging only. Does not provision, link, deploy or contact any service.
import {mkdtemp,mkdir,copyFile,readFile,writeFile,readdir} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,dirname,resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {buildSite} from '../site-build/build.mjs';
import {migrationOrder} from '../backend-tests/migration-order.mjs';
import {planAcceptanceMigrations} from './migrations.mjs';
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
if(execFileSync('git',['status','--porcelain'],{cwd:root,encoding:'utf8'}).trim())throw Error('Commit the reviewed candidate before packaging.');
const sha=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
const result=await buildSite({root,env:{CONTEXT:'deploy-preview'}});
if(result.backend!=='blocked')throw Error('Default acceptance artifact must fail closed.');
const baseline=JSON.parse(await readFile(join(root,'docs/NMI-CUTOVER-PRODUCTION-BASELINE.json'),'utf8'));
const staged=await planAcceptanceMigrations(root,baseline);
const output=await mkdtemp(join(tmpdir(),'champion-nmi-acceptance-'));
const records=[];
const copy=async(src,dst)=>{const data=await readFile(join(root,src));await mkdir(dirname(join(output,dst)),{recursive:true});await copyFile(join(root,src),join(output,dst));records.push({path:dst,sha256:createHash('sha256').update(data).digest('hex')});};
const walk=async(dir)=>{for(const item of await readdir(join(root,dir),{withFileTypes:true})){const name=dir+'/'+item.name;if(item.isDirectory())await walk(name);else if(item.isFile())await copy(name,'preview/'+name.slice(5));else throw Error('Unexpected symlink');}};
await walk('dist');
await copy('supabase/bootstrap/automatic-rls.sql','supabase/bootstrap/automatic-rls.sql');
for(const item of staged){
  const dst='supabase/migrations/'+item.file;await mkdir(dirname(join(output,dst)),{recursive:true});await writeFile(join(output,dst),item.sql);
  records.push({path:dst,source:item.source,kind:item.kind,sha256:createHash('sha256').update(item.sql).digest('hex')});
}
const functions=execFileSync('git',['ls-files','supabase/functions'],{cwd:root,encoding:'utf8'}).trim().split('\n');
for(const name of functions){if(!/\.(?:ts|mjs)$/.test(name))throw Error('Unexpected function artifact');await copy(name,name);}
for(const name of execFileSync('git',['ls-files','docs/NMI-CUTOVER-*','docs/NMI-GIVING-CUTOVER-2026-10-23.md','docs/CHAMPION-LIFE-UNIFIED-PLATFORM-COMMAND.md'],{cwd:root,encoding:'utf8'}).trim().split('\n'))await copy(name,name);
await writeFile(join(output,'MANIFEST.json'),JSON.stringify({candidate:sha,production_baseline:'e3157f0afa3f563ab6560ca64c9049448f02c806',status:'PREPARED_NOT_HOSTED',preview_backend:'BLOCKED',migration_order:staged.map(x=>x.file),repository_migration_order:migrationOrder,production_ledger_confirmation:baseline.provenance.primary_confirmation,files:records},null,2)+'\n');
await writeFile(join(output,'README.txt'),'PREPARED ONLY. No secrets, target, hosted writes or release approval. Candidate '+sha+'\nRead docs/NMI-CUTOVER-HOSTED-ACCEPTANCE.md before provisioning or configuration. Preview intentionally disables all database access. Exact new project/origin pinning, primary shared integration and real provider acceptance remain gates. The attributed live baseline mapping is primary-confirmed. Repository filenames remain unchanged; staged baseline names follow the attributed ledger evidence. Never deploy this package root: only preview/ is a static site artifact. supabase/ and docs/ must remain private.\n');
console.log(JSON.stringify({candidate:sha,output,files:records.length,hosted:'NOT RUN',backend:'BLOCKED'}));

// Run only AFTER the Gate0 commit is cherry-picked into one reviewed child.
// Rebuild public/test manifests for installed module SOURCES, never infer access.
import {readFileSync,writeFileSync,existsSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {execFileSync} from 'node:child_process';
export function reconcile(root,requested,sourceRoot=root){
if(!requested?.length||requested.some(m=>!['nmi','outreach'].includes(m)))throw Error('Explicit nmi, outreach, or nmi,outreach required');
const read=p=>JSON.parse(readFileSync(path.join(root,p))),pins=read('config/platform/gate0-sources.json');
const base=JSON.parse(execFileSync('git',['show',pins.production+':tools/site-build/public-files.json'],{cwd:sourceRoot,encoding:'utf8'}));
const candidates=read('config/platform/public-module-files.json');
const files=[...new Set([...base,'assets/js/staff-workspace.js','assets/css/staff-workspace.css',...requested.flatMap(m=>candidates[m])])].sort();
for(const p of files)if(!existsSync(path.join(root,p)))throw Error('Missing reviewed public file: '+p);
const contracts=read('config/platform/test-package-contract.json'),pkg=read('config/platform/gate0-package.json');
for(const m of requested){Object.assign(pkg.devDependencies,contracts[m].devDependencies);for(const[k,v]of Object.entries(contracts[m].scripts)){if(k==='test')pkg.scripts['test:frozen:'+m]=v;else if(!Object.hasOwn(pkg.scripts,k))pkg.scripts[k]=v;else if(pkg.scripts[k]!==v)throw Error('Review script conflict '+k);}}
writeFileSync(path.join(root,'tools/site-build/public-files.json'),JSON.stringify(files,null,2)+'\n');writeFileSync(path.join(root,'tools/backend-tests/package.json'),JSON.stringify(pkg,null,2)+'\n');
console.log('Reconciled explicit '+requested.join('+')+' public/test manifests. Regenerate the lockfile with npm install --package-lock-only --ignore-scripts; then run the complete module and Gate0 regressions. No release authorized.');
}
if(process.argv[1]===fileURLToPath(import.meta.url)){
 const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..'),modules=process.argv[2]?.split(','),pins=JSON.parse(readFileSync(path.join(root,'config/platform/gate0-sources.json')));
 const head=execFileSync('git',['rev-parse','HEAD'],{cwd:root,encoding:'utf8'}).trim();
 if(!modules||modules.length!==1||!['nmi','outreach'].includes(modules[0])||head!==pins[modules[0]])throw Error('STOP: adoption requires the exact frozen child HEAD before cherry-pick commit. Review later deltas before regenerating manifests.');
 reconcile(root,modules);
}

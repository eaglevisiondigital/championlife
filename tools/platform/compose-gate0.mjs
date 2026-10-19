// Materialize reviewed frozen source only in a fresh disposable directory.
// Does not merge branches, change historical SQL, or deploy anything.
import {execFileSync} from 'node:child_process';import {readFileSync,writeFileSync,mkdirSync,existsSync,unlinkSync} from 'node:fs';import path from 'node:path';import {fileURLToPath} from 'node:url';import {createHash} from 'node:crypto';
const workspaceRoot=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'../..');
export const overlap=['ARCHITECTURE.md','CURRENT_BUILD_STATE.md','DECISIONS.md','SECURITY_MODEL.md','assets/css/staff-workspace.css','assets/js/staff-workspace.js','docs/CHAMPION-LIFE-UNIFIED-PLATFORM-COMMAND.md','tools/backend-tests/package.json','tools/site-build/build.mjs','tools/site-build/public-files.json'];
export function compose(output,modules=['nmi','outreach'],root=workspaceRoot,repository=root){
 output=path.resolve(output);if(!/^\/(?:private\/)?tmp\/gate0-[A-Za-z0-9_-]+$/.test(output)||existsSync(output))throw Error('Fresh /tmp/gate0-* output required');
 if(!modules.length||new Set(modules).size!==modules.length||modules.some(m=>!['nmi','outreach'].includes(m)))throw Error('Unknown module selection');
 const pins=JSON.parse(readFileSync(path.join(root,'config/platform/gate0-sources.json')));
 const git=(...args)=>execFileSync('git',args,{cwd:repository,maxBuffer:80*1024*1024});const put=(p,b)=>{mkdirSync(path.dirname(path.join(output,p)),{recursive:true});writeFileSync(path.join(output,p),b);};
 mkdirSync(output);const archive=path.join(output,'gate0-baseline.tar');git('archive','--output',archive,pins.production);execFileSync('tar',['-xf',archive,'-C',output]);unlinkSync(archive);
 for(const m of modules)for(const[p,h]of Object.entries(pins.sources[m])){if(overlap.includes(p))continue;const bytes=git('show',pins[m]+':'+p);if(createHash('sha256').update(bytes).digest('hex')!==h)throw Error('Frozen hash mismatch: '+p);put(p,bytes);}
 // Explicit primary-owned overlay only. An adopted child is never a Gate0 delta.
 const owned=JSON.parse(readFileSync(path.join(root,'config/platform/gate0-owned-files.json')));
 for(const p of owned){if(p.includes('..')||path.isAbsolute(p))throw Error('Invalid owned path');put(p,readFileSync(path.join(root,p)));}
 const base=[...JSON.parse(git('show',pins.production+':tools/site-build/public-files.json')),'assets/js/staff-workspace.js','assets/css/staff-workspace.css'],moduleFiles=JSON.parse(readFileSync(path.join(root,'config/platform/public-module-files.json')));
 put('tools/site-build/public-files.json',JSON.stringify([...new Set([...base,...modules.flatMap(m=>moduleFiles[m])])].sort(),null,2)+'\n');
 const pkg=JSON.parse(readFileSync(path.join(root,'config/platform/gate0-package.json'))),contracts=JSON.parse(readFileSync(path.join(root,'config/platform/test-package-contract.json')));
 for(const m of modules){Object.assign(pkg.devDependencies,contracts[m].devDependencies);for(const[k,v]of Object.entries(contracts[m].scripts)){if(k==='test')pkg.scripts['test:frozen:'+m]=v;else if(!Object.hasOwn(pkg.scripts,k))pkg.scripts[k]=v;else if(pkg.scripts[k]!==v&& !['test:gate0'].includes(k))throw Error('Test script conflict '+k);}}
 put('tools/backend-tests/package.json',JSON.stringify(pkg,null,2)+'\n');
 // Explicit test-artifact identity; never an implicit opt-out from module guards.
 put('config/platform/composition.json',JSON.stringify({schema:1,production:pins.production,modules,sourceHeads:Object.fromEntries(modules.map(m=>[m,pins[m]]))},null,2)+'\n');
 // Exact accepted lock matches dependency union (NMI subset of Outreach).
 if(modules.includes('outreach'))put('tools/backend-tests/package-lock.json',git('show',pins.outreach+':tools/backend-tests/package-lock.json'));
 return{output,modules,sourceHeads:modules.map(m=>pins[m]),sharedAuthority:'Gate0',production:pins.production};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){console.log(JSON.stringify(compose(process.argv[2],process.argv[3]?.split(',')||['nmi','outreach'])));}

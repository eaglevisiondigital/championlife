// Actual-runtime provenance, not a claim of installed SQL or hosted acceptance.
import assert from 'node:assert/strict';import fs from 'node:fs';import path from 'node:path';import {execFileSync} from 'node:child_process';import {createHash} from 'node:crypto';import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const manifest=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url)));
export const pins=Object.freeze({partner:'c170b0442b8015d9a8de9c7baa311754af95b484',outreach:'91ebfeea001babf5851690076e9ef6d71e91b19a',ancestor:'f2f518fbed16ed5e1d4a38a790cd95965fc1c635',priorComposition:'87fe9ab073f4f58415ef5522f6f7d3a0b1d59818',priorOutreach:'4e29de51bbff57e4e3b3ccbdc750bd0edb960443'});
export const digest=b=>createHash('sha256').update(b).digest('hex');
const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:root,maxBuffer:128*1024*1024});
export function tree(ref){return Object.fromEntries(git('ls-tree','-rz',ref).toString().split('\0').filter(Boolean).map(r=>{const[meta,p]=r.split('\t'),[mode,type,blob]=meta.split(' ');assert.equal(type,'blob');assert.ok(['100644','100755'].includes(mode));return[p,{mode,type,blob}]}));}
const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
export const overridePaths=Object.freeze(['assets/js/staff-outreach-partners.js','staff-outreach-partners.html','.github/workflows/outreach-summary-review.yml']);
// Reviewed candidate overrides are fixed independently of the editable manifest.
export const reviewedOverrides=Object.freeze({"assets/js/staff-outreach-partners.js":"882353144889d444f3bf146980a3faf2c43a760c5c1012738d972597f6adb897","staff-outreach-partners.html":"4c348261b8e3df59339ae9f35455ce052ffae9910c2796ce80e504129e12380f",".github/workflows/outreach-summary-review.yml":"ea6ad4570d1d1f4d28561c538a014e6cc34a8e1749d63004d06d4fc81800c3fe"});
export const newPaths=Object.freeze(['.github/workflows/partner-runtime-cycle14.yml','docs/PARTNER-RUNTIME-COMPOSITION-20261106.md','tools/partner-runtime-cycle14/manifest.json','tools/partner-runtime-cycle14/verify.mjs','tools/partner-runtime-cycle14/verify.test.mjs','tools/partner-runtime-cycle14/partner-lifecycle.browser.mjs','tools/partner-runtime-cycle14/partner-lifecycle-independent.browser.mjs']);
export function plan(m=manifest){
 for(const[k,v]of Object.entries(pins))assert.equal(m[k],v,'immutable source '+k);
 const P=tree(pins.partner),O=tree(pins.outreach),A=tree(pins.ancestor),overlay=[],conflicts=[];
 assert.equal(git('merge-base',pins.partner,pins.outreach).toString().trim(),pins.ancestor);
 for(const p of [...new Set([...Object.keys(P),...Object.keys(O),...Object.keys(A)])].sort()){
  if(same(O[p],A[p]))continue;
  if(!same(P[p],A[p])&&!same(P[p],O[p])){assert.ok(['.github/workflows/outreach-summary-review.yml','ARCHITECTURE.md','CURRENT_BUILD_STATE.md','SECURITY_MODEL.md'].includes(p),'unreviewed conflict '+p);const selected=p.startsWith('.github')?'outreach':'partner';conflicts.push({path:p,selected,partner:P[p],outreach:O[p]});if(selected==='partner')continue;}
  assert.ok(O[p],'unapproved source deletion');overlay.push({path:p,...O[p],sha256:digest(git('cat-file','blob',O[p].blob))});
 }
 assert.deepEqual(m.overlay,overlay,'all45 exact current People overlays');assert.deepEqual(m.conflicts,conflicts,'four exact conflicts');
 assert.deepEqual(Object.keys(m.runtimeOverrides).sort(),[...overridePaths].sort(),'bounded runtime/workflow override paths');assert.deepEqual(m.newPaths,newPaths,'bounded new test/document paths');assert.deepEqual(m.runtimeOverrides,reviewedOverrides,'exact reviewed override source hashes');
 const expected={...P};for(const e of overlay)expected[e.path]={mode:e.mode,type:e.type,blob:e.blob};
 for(const p of overridePaths){assert.match(m.runtimeOverrides[p],/^[a-f0-9]{64}$/);expected[p]={mode:'100644',sha256:m.runtimeOverrides[p]};}
 return expected;
}
const generated=new Set(['.git','dist','tools/backend-tests/node_modules','tools/partner-platform/node_modules']);
function files(dir,rel=''){let out=[];for(const e of fs.readdirSync(path.join(dir,rel),{withFileTypes:true})){const p=rel?rel+'/'+e.name:e.name;if(generated.has(p))continue;if(e.isDirectory())out.push(...files(dir,p));else out.push(p);}return out.sort();}
export function verify(dir=root,m=manifest){const expected=plan(m),all=files(dir);assert.deepEqual(all,[...Object.keys(expected),...newPaths].sort(),'complete actual candidate inventory');
 const blobs=[...new Set(Object.values(expected).filter(e=>e.blob).map(e=>e.blob))],hashes={};const bytes=execFileSync('git',['--no-replace-objects','cat-file','--batch'],{cwd:root,input:blobs.join('\n')+'\n',maxBuffer:512*1024*1024});let at=0;for(const b of blobs){const end=bytes.indexOf(10,at),[actual,type,size]=bytes.subarray(at,end).toString().split(' ');assert.equal(actual,b);assert.equal(type,'blob');at=end+1;hashes[b]=digest(bytes.subarray(at,at+Number(size)));at+=Number(size)+1;}
 for(const p of all){const st=fs.lstatSync(path.join(dir,p));assert.ok(st.isFile(),'regular non-symlink '+p);const e=expected[p];if(!e)continue;assert.equal(!!(st.mode&0o111),e.mode==='100755',p+'mode');assert.equal(digest(fs.readFileSync(path.join(dir,p))),e.sha256||hashes[e.blob],p+'source');}
 return{partner:pins.partner,outreach:pins.outreach,files:all.length,overlays:m.overlay.length,overrides:overridePaths,sourceOnly:true};}
export function checkpoint(dir){assert.ok(!fs.existsSync(dir),'checkpoint target must not exist');execFileSync('git',['clone','--shared','--no-checkout',root,dir],{stdio:'pipe'});execFileSync('git',['checkout','--detach',pins.outreach],{cwd:dir,stdio:'pipe'});assert.equal(execFileSync('git',['rev-parse','HEAD'],{cwd:dir}).toString().trim(),pins.outreach);return dir;}
export async function verifyBuild(){
 verify();const {buildSite}=await import('../site-build/build.mjs');const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json'))),original=tree(pins.partner);
 const inventory=()=>Object.fromEntries(paths.map(p=>[p,digest(fs.readFileSync(path.join(root,'dist',p)))]));
 await buildSite({root,env:{}});const a=inventory();await buildSite({root,env:{}});const b=inventory();assert.deepEqual(a,b,'reproducible public output');
 const allowed=new Set([...manifest.overlay.map(e=>e.path),...overridePaths]),changes=[];
 for(const p of paths){assert.equal(b[p],digest(fs.readFileSync(path.join(root,p))),'source-bound public output '+p);const old=digest(git('cat-file','blob',original[p].blob));if(old!==b[p]){assert.ok(allowed.has(p),'unapproved public output '+p);changes.push(p);}}
 assert.deepEqual(files(path.join(root,'dist')),paths.slice().sort(),'no extra public artifacts');return{files:paths.length,changedPublic:changes,unchangedPublic:paths.length-changes.length,sha256:digest(JSON.stringify(b)),reproducible:true};
}
if(process.argv[1]===fileURLToPath(import.meta.url)){console.log(JSON.stringify(verify(),null,2));if(process.argv.includes('--build'))console.log(JSON.stringify(await verifyBuild(),null,2));const i=process.argv.indexOf('--checkpoint');if(i>=0)console.log(checkpoint(path.resolve(process.argv[i+1])));}

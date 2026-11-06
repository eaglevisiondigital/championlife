// Test-only composition of two reviewed source checkpoints. No git merge or runtime rewrite.
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const manifest=JSON.parse(fs.readFileSync(new URL('./manifest.json',import.meta.url)));
export const pins=Object.freeze({partner:'6af774d5adcdd3c20f65930d5dd485f35466cca8',outreach:'bf4cf916f176ae8c1e86401c64306c56cfca6a35',ancestor:'f2f518fbed16ed5e1d4a38a790cd95965fc1c635'});
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const git=(...args)=>execFileSync('git',args,{cwd:root,maxBuffer:64*1024*1024});
export function tree(ref){
 const result={};
 for(const row of git('ls-tree','-rz',ref).toString().split('\0').filter(Boolean)){
  const [meta,p]=row.split('\t'),[mode,type,blob]=meta.split(' ');
  assert.equal(type,'blob',`unsupported source type: ${p}`);
  assert.ok(['100644','100755'].includes(mode),`unsupported source mode: ${p}`);
  result[p]={mode,blob};
 }
 return result;
}
export function plan(m=manifest){
 for(const [key,value]of Object.entries(pins))assert.equal(m[key],value,`immutable ${key}`);
 const partner=tree(pins.partner),outreach=tree(pins.outreach),ancestor=tree(pins.ancestor),overlay=[],conflicts=[];
 const same=(a,b)=>JSON.stringify(a)===JSON.stringify(b);
 for(const p of [...new Set([...Object.keys(partner),...Object.keys(outreach),...Object.keys(ancestor)])].sort()){
  if(same(outreach[p],ancestor[p]))continue;
  if(!same(partner[p],ancestor[p])&&!same(partner[p],outreach[p])){
   conflicts.push({path:p,selected:'partner',partner:partner[p],outreach:outreach[p],reason:'Preserve source-branch continuity; current Outreach continuity remains in immutable checkpoint.'});continue;
  }
  assert.ok(outreach[p],`deletion requires review: ${p}`);
  overlay.push({path:p,...outreach[p],sha256:sha(git('show',pins.outreach+':'+p))});
 }
 assert.deepEqual(m.conflicts,conflicts,'exact reviewed conflicts');
 assert.deepEqual(m.outreachOverlay,overlay,'complete exact Outreach overlay');
 const commands=git('show',pins.outreach+':.github/workflows/outreach-summary-review.yml').toString().split('\n').map(s=>s.trim()).filter(s=>s.startsWith('- run: ')).map(s=>s.slice(7));
 assert.deepEqual(m.summaryCommands,commands.map(command=>({command,target:command.includes('people-followup-pagination-integrity.mjs')?'outreach':'composition'})),'all accepted workflow commands retained');
 const composition={...partner};for(const entry of overlay)composition[entry.path]={mode:entry.mode,blob:entry.blob};
 return {partner,outreach,composition};
}
// Only generated test dependencies/build outputs and repository metadata are excluded.
// Every source path, including ignored/untracked files elsewhere, is checked.
const generated=new Set(['.git','dist','tools/backend-tests/node_modules','tools/partner-platform/node_modules']);
function files(dir,prefix=''){
 const out=[];
 for(const e of fs.readdirSync(dir,{withFileTypes:true})){
  const p=prefix?prefix+'/'+e.name:e.name;if(generated.has(p))continue;
  if(e.isDirectory())out.push(...files(path.join(dir,e.name),p));else out.push(p);
 }
 return out.sort();
}
const blobHashes=new Map();
function preloadBlobs(expected){
 const missing=[...new Set(Object.values(expected).map(e=>e.blob))].filter(b=>!blobHashes.has(b));if(!missing.length)return;
 const bytes=execFileSync('git',['cat-file','--batch'],{cwd:root,input:missing.join('\n')+'\n',maxBuffer:512*1024*1024});let at=0;
 for(const blob of missing){const end=bytes.indexOf(10,at),[actual,type,size]=bytes.subarray(at,end).toString().split(' ');assert.equal(actual,blob);assert.equal(type,'blob');at=end+1;const count=Number(size);blobHashes.set(blob,sha(bytes.subarray(at,at+count)));at+=count+1;}
 assert.equal(at,bytes.length);
}

const blobSha=blob=>{if(!blobHashes.has(blob))blobHashes.set(blob,sha(git('cat-file','blob',blob)));return blobHashes.get(blob);};
export function verifyInventory(dir,expected){
 preloadBlobs(expected);
 assert.deepEqual(files(dir),Object.keys(expected).sort(),'exact source inventory, including unexpected files');
 for(const [p,entry]of Object.entries(expected)){
  const full=path.join(dir,p),st=fs.lstatSync(full);assert.ok(st.isFile(),`regular file required: ${p}`);
  assert.equal((st.mode&0o111)!==0,entry.mode==='100755',`source mode: ${p}`);
  assert.equal(sha(fs.readFileSync(full)),blobSha(entry.blob),`source bytes: ${p}`);
 }
 return {files:Object.keys(expected).length,inventorySha256:sha(JSON.stringify(Object.entries(expected).sort()))};
}
export const successorPaths=Object.freeze([
 '.github/workflows/outreach-summary-review.yml',
 'tools/partner-integration-cycle12/manifest.json',
 'tools/partner-integration-cycle12/composition.mjs',
 'tools/partner-integration-cycle12/compose.mjs',
 'tools/partner-integration-cycle12/verify.mjs',
 'tools/partner-integration-cycle12/composition.test.mjs',
 'tools/partner-integration-cycle12/composition.independent.test.mjs',
 'tools/partner-integration-cycle12/README.md'
]);
export function verifySuccessor(){
 const expected=tree(pins.partner),current=tree('HEAD');preloadBlobs(expected);
 const changed=git('diff','--name-only',pins.partner,'HEAD').toString().trim().split('\n').filter(Boolean);
 assert.ok(changed.every(p=>successorPaths.includes(p)),'source branch changes exceed reviewed test-only paths');
 for(const [p,e]of Object.entries(expected))if(!successorPaths.includes(p))assert.deepEqual(current[p],e,`protected branch source: ${p}`);
 // Working tree also must preserve every historical source; new artifacts have exact path ownership.
 const disk=files(root).filter(p=>!successorPaths.includes(p));
 assert.deepEqual(disk,Object.keys(expected).filter(p=>!successorPaths.includes(p)).sort(),'source branch added/deleted files');
 for(const [p,e]of Object.entries(expected))if(!successorPaths.includes(p)){
  const st=fs.lstatSync(path.join(root,p));assert.ok(st.isFile(),p);assert.equal((st.mode&0o111)!==0,e.mode==='100755',p);
  assert.equal(sha(fs.readFileSync(path.join(root,p))),blobSha(e.blob),p);
 }
 return {head:git('rev-parse','HEAD').toString().trim(),partner:pins.partner,changed};
}
export function materialize(dir){
 const plans=plan();assert.ok(!fs.existsSync(dir),'destination must not exist');fs.mkdirSync(dir,{recursive:true});
 for(const name of ['partner','outreach','composition']){
  const dst=path.join(dir,name);execFileSync('git',['clone','--shared','--no-checkout',root,dst],{stdio:'pipe'});
  execFileSync('git',['checkout','--detach',pins[name==='outreach'?'outreach':'partner']],{cwd:dst,stdio:'pipe'});
  if(name==='composition')for(const entry of manifest.outreachOverlay){const full=path.join(dst,entry.path);fs.mkdirSync(path.dirname(full),{recursive:true});fs.writeFileSync(full,git('cat-file','blob',entry.blob));fs.chmodSync(full,entry.mode==='100755'?0o755:0o644);}
  verifyInventory(dst,plans[name]);
 }
 return plans;
}

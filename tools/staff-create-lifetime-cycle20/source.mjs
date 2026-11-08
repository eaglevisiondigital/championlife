// Verify the actual121-derived source before any immutable historical projection.
import assert from 'node:assert/strict';
import {additions as cycle22Additions} from '../partner-home-cycle22/source.mjs';
import {checkpointReader as cycle21CheckpointReader,verifyActual as verifyCycle21,additions as cycle21Additions} from '../staff-financial-navigation-cycle21/source.mjs';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=new URL('../../',import.meta.url);
export const base='4a7a04c3bb5f38c3e7571b42a3be6401d0a0bdf1';
export const runtime='assets/js/outreach-people.js';
export const hash=b=>createHash('sha256').update(b).digest('hex');
let cycle21Read;export const current=p=>(cycle21Read ||= cycle21CheckpointReader())(p);
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(p))}
export function helper(bytes){const text=bytes.toString(),start=' function addTaskEditor(',end=' function addTaskHistory(';assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);return text.slice(text.indexOf(start),text.indexOf(end))}
export const derivationSHA256='68649cfcc070f8f5f66f08de6ae93008ae3a7236e8f97426dce85049ccb77445';
const recipeBytes=readFileSync(new URL('tools/staff-create-lifetime-cycle20/derivations.json',root));assert.equal(hash(recipeBytes),derivationSHA256,'Exact reviewed create lifetime and router derivations');
const derivations=JSON.parse(recipeBytes);
export const modified=Object.keys(derivations);
export function expectedRouter(p){let text=original(p).toString();for(const[a,b]of derivations[p]){assert.equal(text.split(a).length,2,'Single exact router marker '+p);text=text.replace(a,b)}return Buffer.from(text)}
export function expectedRuntime(){const prior=original(runtime),expected=expectedRouter(runtime);assert.equal(hash(prior),'bedf79f60cf8539de790832d87778361e930a6df18873cb1700960b50744bf8f');assert.equal(hash(expected),'e3f6de7931bb5a11795eeb85c0db79ba15e45c95e949904e92450b84c03ebc34');assert.deepEqual(Buffer.from(expected.toString().replace(helper(expected),helper(prior))),prior,'Only create helper changes');return expected}
export const additions=[
 'tools/staff-create-lifetime-cycle20/source.mjs','tools/staff-create-lifetime-cycle20/source.test.mjs','tools/staff-create-lifetime-cycle20/build.mjs','tools/staff-create-lifetime-cycle20/derivations.json','tools/staff-create-lifetime-cycle20/README.md','tools/staff-create-lifetime-cycle20/create-lifetime.test.mjs',
 'tools/staff-create-lifetime-cycle20/create-lifetime-independent.browser.mjs',
 '.github/workflows/staff-create-lifetime-cycle20.yml'
];
export const reviewedHashes={
  "tools/staff-create-lifetime-cycle20/source.test.mjs": "a6f89d0c8bf8604c746f16c77fae3f4280385049fa3f5ea5d6399d0f05d0e825",
  "tools/staff-create-lifetime-cycle20/build.mjs": "360290f9f785ecb4b2859b4705e48603fc4ff2fe530a9f41f68f9eeb84ec1f87",
  "tools/staff-create-lifetime-cycle20/derivations.json": "68649cfcc070f8f5f66f08de6ae93008ae3a7236e8f97426dce85049ccb77445",
  "tools/staff-create-lifetime-cycle20/README.md": "bec79b69183dc26483dd8c24087213698d87b41e548485afcf794625957d5bef",
  "tools/staff-create-lifetime-cycle20/create-lifetime.test.mjs": "36038734a8fb4d9d5b62b846097eebf0e51f8993cfbd76501eeb32a04a2065ec",
  "tools/staff-create-lifetime-cycle20/create-lifetime-independent.browser.mjs": "bd9a3db7b5299cfa1ade4ed27b95ddbd1b688af1a3eb3f33e139d6e99966b253",
  ".github/workflows/staff-create-lifetime-cycle20.yml": "2ed0ebb8f566494bb6b14631200f5dfdb9cd42e8a57279a297168e2cb711fbfa"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 verifyCycle21();
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact121 source outside create lifetime and bounded routers: '+p)}
 const allowed=new Set([...tracked,...additions]);
 const present=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(p=>!cycle21Additions.includes(p)&&!cycle22Additions.includes(p));
 for(const p of present)assert(allowed.has(p),'Unlisted composition file '+p);
 for(const p of additions){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular bounded addition '+p)}
 for(const [p,digest]of Object.entries(reviewedHashes))assert.equal(hash(read(p)),digest,'Independent reviewed addition '+p);
 assert.deepEqual(Object.keys(reviewedHashes).sort(),additions.filter(p=>p!=='tools/staff-create-lifetime-cycle20/source.mjs').sort(),'All additions independently bound');
 for(const prefix of ['assets','supabase','netlify']){function walk(p){if(!existsSync(new URL(p,root)))return;const s=lstatSync(new URL(p,root));assert(!s.isSymbolicLink(),'No protected backend/config symlink; No protected symlink '+p);if(s.isDirectory())for(const n of readdirSync(new URL(p,root)))walk(p+'/'+n);else assert(tracked.includes(p),'No backend/config addition or removal; No protected addition '+p)}walk(prefix)}
 for(const n of readdirSync(root))if(n.endsWith('.html'))assert(tracked.includes(n),'No public HTML addition '+n);
 return{base,runtimeSHA256:hash(read(runtime)),tracked:tracked.length,modified,additions,hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return p=>modified.includes(p)?original(p):current(p)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));

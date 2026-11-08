// Actual117 source plus only the independently reviewed119 lifetime helper.
import {checkpointReader as cycle20CheckpointReader,verifyActual as verifyCycle20,additions as cycle20Additions} from '../staff-create-lifetime-cycle20/source.mjs';
import assert from 'node:assert/strict';
import {additions as cycle22Additions} from '../partner-home-cycle22/source.mjs';
import {additions as cycle21Additions} from '../staff-financial-navigation-cycle21/source.mjs';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {acceptedTaskActions} from './helper.mjs';
export const root=new URL('../../',import.meta.url);
export const base='a9bfe0db67cbc50a603d07e321f4f2672433424f';
export const people='c31cc8809eee24868fb1e654982f4efed5d8915e';
export const runtime='assets/js/outreach-people.js';
export const hash=b=>createHash('sha256').update(b).digest('hex');
let cycle20Read;export const current=p=>(cycle20Read ||= cycle20CheckpointReader())(p);
const cache=new Map();
export function original(p,commit=base){const key=commit+':'+p;if(!cache.has(key))cache.set(key,execFileSync('git',['--no-replace-objects','show',key],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(key))}
export function helper(bytes){const text=bytes.toString(),start=' function addTaskActions(',end=' async function detail(';assert.equal(text.split(start).length,2);assert.equal(text.split(end).length,2);return text.slice(text.indexOf(start),text.indexOf(end))}
export function expectedRuntime(){
 const prior=original(runtime),reviewed=original(runtime,people);
 assert.equal(hash(prior),'40aa0967529d0c0184b52866bdfa0861504b2339c11297b318d582d3706d7bc5');
 assert.equal(hash(reviewed),'e79384d5e770bf784f74b0ade0d57695e7218e993735b0cf91b2105b09baf9c7');
 assert.equal(acceptedTaskActions(helper(reviewed)),helper(prior),'Exact reversible119 lifetime delta only');
 const expected=Buffer.from(prior.toString().replace(helper(prior),helper(reviewed)));
 assert.equal(hash(expected),'bedf79f60cf8539de790832d87778361e930a6df18873cb1700960b50744bf8f');return expected;
}
// Fixed recipe bytes are reviewed separately from source payloads; never self-authorize hashes.
export const derivationSHA256='8c80cf7bf5f044276bcc03579412fc9f00a6cb6bc080d5557be943e3148ee51b';
const recipeBytes=readFileSync(new URL('tools/staff-lifetime-cycle19/derivations.json',root));assert.equal(hash(recipeBytes),derivationSHA256,'Exact reviewed historical router derivations');
const derivations=JSON.parse(recipeBytes);
export const modified=[runtime,...Object.keys(derivations)];
export function expectedRouter(p){let text=original(p).toString();for(const[a,b]of derivations[p]){assert.equal(text.split(a).length,2,'Single exact router marker '+p);text=text.replace(a,b)}return Buffer.from(text)}
export const additions=[
 'tools/staff-lifetime-cycle19/source.mjs','tools/staff-lifetime-cycle19/source.test.mjs','tools/staff-lifetime-cycle19/build.mjs','tools/staff-lifetime-cycle19/helper.mjs','tools/staff-lifetime-cycle19/derivations.json','tools/staff-lifetime-cycle19/README.md',
 'tools/staff-lifetime-cycle19/staff-task-request-fence-independent.browser.mjs',
 'tools/staff-lifetime-cycle19/people-task-lifetime.test.mjs','tools/staff-lifetime-cycle19/people-task-lifetime-independent.browser.mjs',
 '.github/workflows/staff-lifetime-cycle19.yml'
];
export const reviewedHashes={
  "tools/staff-lifetime-cycle19/staff-task-request-fence-independent.browser.mjs": "1e186136c23a0e8b0ff982bca25dfdcf5b07f1bf42eca391ad4bd942c8a36959",
  "tools/staff-lifetime-cycle19/helper.mjs": "9416a950309fdfc154691b300e17c75b0da269f48787b9027f4b0436cf84c9bd",
  "tools/staff-lifetime-cycle19/people-task-lifetime.test.mjs": "8a59189b4d779b57c00607e177ace527acbf74aa1a7e9c3253aa31bfef34024e",
  "tools/staff-lifetime-cycle19/people-task-lifetime-independent.browser.mjs": "ea93ea2c0b9d940d2279872e22194b82d3da09348499f42b848c8557c08ad563",
  "tools/staff-lifetime-cycle19/source.test.mjs": "beec97546496a0a86fc72f2cb3c0275a1d279c7ed24869a373cf0a21f0f87e26",
  "tools/staff-lifetime-cycle19/README.md": "a0a8ae62d9f599556e5b412b8d5a218d160f39d0b54e6d6294a9a5067078d705",
  "tools/staff-lifetime-cycle19/build.mjs": "85beda6f1ccc3b5a1158e03f98ed2df427bf1e5de487d671b6ab6b0c57e13484",
  "tools/staff-lifetime-cycle19/derivations.json": "8c80cf7bf5f044276bcc03579412fc9f00a6cb6bc080d5557be943e3148ee51b",
  ".github/workflows/staff-lifetime-cycle19.yml": "dd03bf29a13ace9df6d2356509b8235d43ad2f3cc60c9265125eea0c7d0e5850"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 verifyCycle20();
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact117 source outside reviewed119 helper and bounded routers: '+p)}
 const allowed=new Set([...tracked,...additions]);
 const present=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean).filter(p=>!cycle20Additions.includes(p)&&!cycle21Additions.includes(p)&&!cycle22Additions.includes(p));
 for(const p of present)assert(allowed.has(p),'Unlisted composition file '+p);
 for(const p of additions){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular bounded addition '+p)}
 for(const [p,digest]of Object.entries(reviewedHashes))assert.equal(hash(read(p)),digest,'Independent reviewed addition '+p);
 assert.deepEqual(Object.keys(reviewedHashes).sort(),additions.filter(p=>p!=='tools/staff-lifetime-cycle19/source.mjs').sort(),'All additions independently bound');
 // Inspect ignored/untracked protected paths too: git ignore cannot conceal a public/backend addition.
 for(const prefix of ['assets','supabase','netlify']){function walk(p){if(!existsSync(new URL(p,root)))return;const s=lstatSync(new URL(p,root));assert(!s.isSymbolicLink(),'No protected backend/config symlink; No protected symlink '+p);if(s.isDirectory())for(const n of readdirSync(new URL(p,root)))walk(p+'/'+n);else assert(tracked.includes(p),'No backend/config addition or removal; No protected addition '+p)}walk(prefix)}
 for(const n of readdirSync(root))if(n.endsWith('.html'))assert(tracked.includes(n),'No public HTML addition '+n);
 return{base,people,runtimeSHA256:hash(read(runtime)),tracked:tracked.length,modified,additions,hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return p=>modified.includes(p)?original(p):current(p)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));

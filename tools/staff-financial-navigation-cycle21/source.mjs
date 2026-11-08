// Verify actual122-derived financial navigation before immutable historical projections.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=new URL('../../',import.meta.url);
export const base='0b7af2b1bed98a3944fdd714f21b9017cf0d1d0b';
export const runtime='assets/js/staff-workspace.js';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const current=p=>readFileSync(new URL(p,root));
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(p))}
export const derivationSHA256='021c04201c7e798ba056d8235731baac9c4dc6c3b84278abbe38a7f1f4cd6932';
const recipeBytes=current('tools/staff-financial-navigation-cycle21/derivations.json');assert.equal(hash(recipeBytes),derivationSHA256,'Exact reviewed financial navigation and router derivations');
const derivations=JSON.parse(recipeBytes);
export const modified=Object.keys(derivations);
export function expectedRouter(p){let text=original(p).toString();for(const[a,b]of derivations[p]){assert.equal(text.split(a).length,2,'Single exact router marker '+p);text=text.replace(a,b)}return Buffer.from(text)}
export function expectedRuntime(){assert.equal(hash(original(runtime)),'8bb03001599c3c9980c97ef4e71373474cec8248a8bf258fba87e7ba4d5c6127');const expected=expectedRouter(runtime);assert.equal(hash(expected),'76bd2f1912d18627e0c1b77ec64c0b6de6ca812fe597bdaf5d65676b4ca2bbe2');return expected}
export const additions=[
  "tools/staff-financial-navigation-cycle21/source.mjs",
  "tools/staff-financial-navigation-cycle21/source.test.mjs",
  "tools/staff-financial-navigation-cycle21/build.mjs",
  "tools/staff-financial-navigation-cycle21/derivations.json",
  "tools/staff-financial-navigation-cycle21/README.md",
  "tools/staff-financial-navigation-cycle21/financial-navigation.browser.mjs",
  ".github/workflows/staff-financial-navigation-cycle21.yml"
];
export const reviewedHashes={
  "tools/staff-financial-navigation-cycle21/source.test.mjs": "2da8aaf18e6ce1f6fbe8c6d8b453c902f927aafc26b91db8afb7783ef0627e60",
  "tools/staff-financial-navigation-cycle21/build.mjs": "e36081b2bf04ad9919848ab65ed7c233fece0bde6a5ff9f4e59dcffa951e71ff",
  "tools/staff-financial-navigation-cycle21/derivations.json": "021c04201c7e798ba056d8235731baac9c4dc6c3b84278abbe38a7f1f4cd6932",
  "tools/staff-financial-navigation-cycle21/README.md": "c5331c463c1b5ac765474883a94c278b7626273194ee29e8cd07cde89d91a2aa",
  "tools/staff-financial-navigation-cycle21/financial-navigation.browser.mjs": "e8a70c83b1ae5c457da7a87ccc70e30af01a303cb707a557ff88ff37cd8da1ae",
  ".github/workflows/staff-financial-navigation-cycle21.yml": "19bb2712de8a897c54e3246db22b5b69f134697c15572b8e423959147a400dbb"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact122 source outside financial navigation and bounded routers: '+p)}
 const allowed=new Set([...tracked,...additions]);
 const present=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const p of present)assert(allowed.has(p),'Unlisted composition file '+p);
 for(const p of additions){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular bounded addition '+p)}
 for(const [p,digest]of Object.entries(reviewedHashes))assert.equal(hash(read(p)),digest,'Independent reviewed addition '+p);
 assert.deepEqual(Object.keys(reviewedHashes).sort(),additions.filter(p=>p!=='tools/staff-financial-navigation-cycle21/source.mjs').sort(),'All additions independently bound');
 for(const prefix of ['assets','supabase','netlify']){function walk(p){if(!existsSync(new URL(p,root)))return;const s=lstatSync(new URL(p,root));assert(!s.isSymbolicLink(),'No protected backend/config symlink; No protected symlink '+p);if(s.isDirectory())for(const n of readdirSync(new URL(p,root)))walk(p+'/'+n);else assert(tracked.includes(p),'No backend/config addition or removal; No protected addition '+p)}walk(prefix)}
 for(const n of readdirSync(root))if(n.endsWith('.html'))assert(tracked.includes(n),'No public HTML addition '+n);
 return{base,runtimeSHA256:hash(read(runtime)),tracked:tracked.length,modified,additions,hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return p=>modified.includes(p)?original(p):current(p)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));

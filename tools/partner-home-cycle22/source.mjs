// Verify actual123-derived Partner home return before immutable historical projections.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=new URL('../../',import.meta.url);
export const base='bdecc592d1a0544330934ef2fc5a254a9b54d3d3';
export const runtime='assets/js/staff-outreach-partners.js';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const current=p=>readFileSync(new URL(p,root));
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(p))}
export const derivationSHA256='8bb3723106e71839b621bc33d90a00d7c55eb850d9717c4060676bec63ce8da5';
const recipeBytes=current('tools/partner-home-cycle22/derivations.json');assert.equal(hash(recipeBytes),derivationSHA256,'Exact reviewed home return and router derivations');
const derivations=JSON.parse(recipeBytes);
export const modified=Object.keys(derivations);
export function expectedRouter(p){let text=original(p).toString();for(const[a,b]of derivations[p]){assert.equal(text.split(a).length,2,'Single exact router marker '+p);text=text.replace(a,b)}return Buffer.from(text)}
export function expectedRuntime(){assert.equal(hash(original(runtime)),'eecb6f91abaa892eb9ce905aa104c80624c70a716b122e50d62ba084bd88e46e');const expected=expectedRouter(runtime);assert.equal(hash(expected),'eabe66f96f2188817df6752bc1017bff1c5fa3e4d570b5d63d5305d4f8705e38');return expected}
export const additions=[
  "tools/partner-home-cycle22/source.mjs",
  "tools/partner-home-cycle22/source.test.mjs",
  "tools/partner-home-cycle22/build.mjs",
  "tools/partner-home-cycle22/derivations.json",
  "tools/partner-home-cycle22/README.md",
  "tools/partner-home-cycle22/home-return.browser.mjs",
  ".github/workflows/partner-home-cycle22.yml"
];
export const reviewedHashes={
  "tools/partner-home-cycle22/source.test.mjs": "9878e9ab0b90f87a2883025ada350dbde65821d1d6e890e42859d89886563f71",
  "tools/partner-home-cycle22/build.mjs": "4fded3ecd31cd707a2e61cf2a3f4f810b707bbed07f72b5a0e894cd3af50a4a3",
  "tools/partner-home-cycle22/derivations.json": "8bb3723106e71839b621bc33d90a00d7c55eb850d9717c4060676bec63ce8da5",
  "tools/partner-home-cycle22/README.md": "9dc27e04814bae2560acac696f8d3b128f05e3c0ef0e7a2a568b584b8e80f201",
  "tools/partner-home-cycle22/home-return.browser.mjs": "f610b31cada708adb84693dc40fc9aa20b3833e223c0c9fb9cb59c7e45263d05",
  ".github/workflows/partner-home-cycle22.yml": "5390c1fd904ecefac0e32e7fa06541bb165c4e545fb42f2b5957a20a4d3b1f51"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact123 source outside home return and bounded routers: '+p)}
 const allowed=new Set([...tracked,...additions]);
 const present=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const p of present)assert(allowed.has(p),'Unlisted composition file '+p);
 for(const p of additions){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular bounded addition '+p)}
 for(const [p,digest]of Object.entries(reviewedHashes))assert.equal(hash(read(p)),digest,'Independent reviewed addition '+p);
 assert.deepEqual(Object.keys(reviewedHashes).sort(),additions.filter(p=>p!=='tools/partner-home-cycle22/source.mjs').sort(),'All additions independently bound');
 for(const prefix of ['assets','supabase','netlify']){function walk(p){if(!existsSync(new URL(p,root)))return;const s=lstatSync(new URL(p,root));assert(!s.isSymbolicLink(),'No protected backend/config symlink; No protected symlink '+p);if(s.isDirectory())for(const n of readdirSync(new URL(p,root)))walk(p+'/'+n);else assert(tracked.includes(p),'No backend/config addition or removal; No protected addition '+p)}walk(prefix)}
 for(const n of readdirSync(root))if(n.endsWith('.html'))assert(tracked.includes(n),'No public HTML addition '+n);
 return{base,runtimeSHA256:hash(read(runtime)),tracked:tracked.length,modified,additions,hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return p=>modified.includes(p)?original(p):current(p)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));

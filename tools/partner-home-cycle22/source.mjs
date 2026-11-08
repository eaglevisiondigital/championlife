// Verify actual123-derived Partner home return before immutable historical projections.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
export const root=new URL('../../',import.meta.url);
export const base='bdecc592d1a0544330934ef2fc5a254a9b54d3d3';
export const runtime='assets/js/staff-outreach-partners.js';
export const registrationRuntime='assets/js/outreach-registration-staff.js';
export function expectedRegistrationRuntime(){assert.equal(hash(original(registrationRuntime)),'665236df4f5eb52f25e4bcc5560a0e8fda4feae139b4f0b17265d10964ca4f2a');const value=expectedRouter(registrationRuntime);assert.equal(hash(value),'cab69837156279bf24bd790115c24e2368f1dd87a094e79c79ff389b9a4cf81e','Exact reviewed PR134 runtime');return value}
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const current=p=>readFileSync(new URL(p,root));
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(p))}
export const derivationSHA256='1e90df6126927b20ad84a80bfce9ea81fbb8bdb97cb1d26f55a57b0a2fc775fe';
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
  ".github/workflows/partner-home-cycle22.yml",
  "tools/partner-home-cycle22/registration-host.browser.mjs",
  "tools/partner-home-cycle22/registration-checkin-journey.browser.mjs",
  "tools/partner-home-cycle22/registration-checkin-status.native.mjs"
];
export const reviewedHashes={
  "tools/partner-home-cycle22/source.test.mjs": "589d035e2626134cda515affe23a657fdf5e6ba43c6f0390877ccd705818617c",
  "tools/partner-home-cycle22/build.mjs": "debff032e9b7211a2ef4bdf3a68ad3c07949243e31ccda10de6c92b04d924578",
  "tools/partner-home-cycle22/derivations.json": "1e90df6126927b20ad84a80bfce9ea81fbb8bdb97cb1d26f55a57b0a2fc775fe",
  "tools/partner-home-cycle22/README.md": "73289b8e203e32ea05b594689fcb6b90238e100999b251cd02afefd3b70d1d2e",
  "tools/partner-home-cycle22/home-return.browser.mjs": "f610b31cada708adb84693dc40fc9aa20b3833e223c0c9fb9cb59c7e45263d05",
  ".github/workflows/partner-home-cycle22.yml": "be796c19e42ada5d67ecbc5365f801026610595b44dc9cf32f53a5f375b9e833",
  "tools/partner-home-cycle22/registration-host.browser.mjs": "dd2043d3457b18cd6052df67d0eed0228cd1afbcf49ffc060ca980a4b628dfdc",
  "tools/partner-home-cycle22/registration-checkin-journey.browser.mjs": "5946b1bffe3f0faf00e58695a9a6babd60196dc9740afa503954b3cbe9a4797e",
  "tools/partner-home-cycle22/registration-checkin-status.native.mjs": "f941859a5b2a376b17fc135bcc217f7d8fead492634595d20de04d497c248dfa"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():p===registrationRuntime?expectedRegistrationRuntime():Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact123 source outside home return and bounded routers: '+p)}
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

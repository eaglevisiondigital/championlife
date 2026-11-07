// Verify actual source before allowing immutable historical checkpoint projections.
import assert from 'node:assert/strict';
import {readFileSync,lstatSync,readdirSync,existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {expected as partnerExpected} from '../partner-staff-cycle16/source.mjs';
import {compose as communicationExpected} from '../comms-host-cycle16/source.mjs';
export const root=new URL('../../',import.meta.url);
export const base='7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const current=p=>readFileSync(new URL(p,root));
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:64*1024*1024}));return Buffer.from(cache.get(p))}
export const runtimePaths=['staff-outreach-partners.html','assets/js/staff-outreach-partners.js','assets/js/staff-session.js','assets/js/communications.js'];
export function expected(p){return p==='assets/js/communications.js'?communicationExpected():partnerExpected(p)}
const transforms={
 'tools/staff-runtime-cycle14/source.mjs':[
  ["import {fileURLToPath} from 'node:url';","import {fileURLToPath} from 'node:url';\nimport {checkpointReader as cycle16CheckpointReader,verifyActual as verifyCycle16,additions as cycle16Additions} from '../staff-integration-cycle16/source.mjs';"],
  ["export const current=path=>readFileSync(new URL(path,root));","let cycle16Read;export const current=path=>(cycle16Read ||= cycle16CheckpointReader())(path);"],
  ['export function verifyActual(read=current){','export function verifyActual(read=current){\n verifyCycle16();'],
  [".trim().split('\\n').filter(Boolean);",".trim().split('\\n').filter(Boolean).filter(path=>!cycle16Additions.includes(path));"]
 ],
 'tools/staff-runtime-cycle14/build.mjs':[
  ["import {verifyActual,root,hash,original,runtime} from './source.mjs';","import {verifyActual,root,hash,original,runtime} from './source.mjs';\nimport {expected as cycle16Expected,runtimePaths as cycle16Paths} from '../staff-integration-cycle16/source.mjs';"],
  ['hash(original(path))','hash(cycle16Paths.includes(path)?cycle16Expected(path):original(path))'],
  ['unchangedPublic:first.length-1','unchangedPublic:first.length-1-cycle16Paths.length'],
  ['changedPublic:[runtime]','changedPublic:[runtime,...cycle16Paths]']
 ],
 'tools/staff-cycle9-integrity/integrity.mjs':[
  ["import {current as actualCurrent} from '../staff-runtime-cycle14/source.mjs';","import {current as actualCurrent} from '../staff-integration-cycle16/source.mjs';"]
 ]
};
export function expectedRouter(p){let text=original(p).toString();for(const[a,b]of transforms[p]){assert.equal(text.split(a).length,2,'Unique historical router marker '+p);text=text.replace(a,b)}return Buffer.from(text)}
export const additions=[
 'tools/partner-staff-cycle16/await-controls.browser.mjs','tools/partner-staff-cycle16/login-return.browser.mjs','tools/partner-staff-cycle16/source.test.mjs','tools/partner-staff-cycle16/sdk-sri.browser.mjs','tools/partner-staff-cycle16/README.md','tools/partner-staff-cycle16/source.mjs','tools/partner-staff-cycle16/browser-fixture.mjs','tools/partner-staff-cycle16/journey.browser.mjs','tools/partner-staff-cycle16/independent.browser.mjs',
 'tools/comms-host-cycle16/independent.browser.mjs','tools/comms-host-cycle16/README.md','tools/comms-host-cycle16/source.mjs','tools/comms-host-cycle16/source.test.mjs','tools/comms-host-cycle16/remount.browser.mjs',
 'tools/staff-integration-cycle16/source.mjs','tools/staff-integration-cycle16/source.test.mjs','tools/staff-integration-cycle16/build.mjs','tools/staff-integration-cycle16/README.md','tools/staff-integration-cycle16/provenance.json',
 '.github/workflows/staff-integration-cycle16.yml'
];
// Populated only after independent review of exact new test/workflow bytes.
export const reviewedAdditionHashes={
  "tools/partner-staff-cycle16/await-controls.browser.mjs": "5164c5328a42d79d354d5ea218c67ceb48c16e108404054312b3435acfda7ded",
  "tools/partner-staff-cycle16/login-return.browser.mjs": "ed1c6b798250c0c68e01d7a37dda01a14c9dde30ce6f6799694eb8730379ce99",
  "tools/partner-staff-cycle16/source.test.mjs": "d81d651f374949138eb7ddd540cff32d05331d106f1431087da13d8562f6dc02",
  "tools/partner-staff-cycle16/sdk-sri.browser.mjs": "a1671d4900bb9aee72ffeae303a8b2ba0f7b55fbba643dce3689eb0334a051d5",
  "tools/partner-staff-cycle16/README.md": "a3f010f72c918cd544a9f8bbfaa2b007cdedd29c9a5638c7a0dcdde8998b322a",
  "tools/partner-staff-cycle16/source.mjs": "4c584f996aa6422fae810d3b5bf60ac15cef4f9a72e6f5549e6770fc64d38256",
  "tools/partner-staff-cycle16/browser-fixture.mjs": "e35e106bf68b7430adae7f67fcad86fad31563cbff3aba880318917119e9a134",
  "tools/partner-staff-cycle16/journey.browser.mjs": "b9d5d6580eca8cc1c635315f3cbd8965086fe3cf98f7b47359d4da988eb668b7",
  "tools/partner-staff-cycle16/independent.browser.mjs": "08078fcea8d086c237b95082594a253149ffa099e256e71c17c15e5c3f5ceb02",
  "tools/comms-host-cycle16/independent.browser.mjs": "743f5976dc56b8b220eaf593b21f1fa8086cac4dc20d4cee96be8c7feb85d1bd",
  "tools/comms-host-cycle16/README.md": "0fbdfb980553fac219dd2a6e4740767a5f3730a87a7ee3db299ba3ee7e26234a",
  "tools/comms-host-cycle16/source.mjs": "bcc43250f43fddaeaeeb0bd5b84c0aaad7ad14de508583cd712e1a75ecff986e",
  "tools/comms-host-cycle16/source.test.mjs": "ac1eaf9d7641570d7e9a3f7faa55013122fd1b956d1ece554b7ae9a40c0e40a0",
  "tools/comms-host-cycle16/remount.browser.mjs": "64ca221a426284d1cbb82533803bf725bc0c7fd2b7a0f3a92e8d909adf86f8d3",
  "tools/staff-integration-cycle16/source.test.mjs": "72f5c7dcdc013eb2ba9a9dcfdebd07b3571b8501c83e7a3d0f32995559121cd6",
  "tools/staff-integration-cycle16/build.mjs": "296164199e4e7aec54a78824a2e9111a2e2f4af4dbaae86fa3b9a5e364ec93d2",
  "tools/staff-integration-cycle16/README.md": "629c71f1476a97d2b98cd0a91c77271d062438045d92ae103cfef08c73356454",
  ".github/workflows/staff-integration-cycle16.yml": "ad1c42980e62d59544d7f7051b296a31cd7fba281089a270e51ed47fa837a98c"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 const allowed=new Set([...tracked,...additions]);
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular source '+p);assert.deepEqual(read(p),runtimePaths.includes(p)?expected(p):Object.hasOwn(transforms,p)?expectedRouter(p):original(p),'Exact actual source '+p)}
 for(const p of additions){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),'Regular addition '+p)}
 const present=execFileSync('git',['ls-files','--cached','--others','--exclude-standard'],{cwd:root,encoding:'utf8'}).trim().split('\n').filter(Boolean);
 for(const p of present)assert(allowed.has(p),'Unlisted composition file '+p);
 for(const prefix of ['assets','supabase','netlify']){function walk(p){if(!existsSync(new URL(p,root)))return;const s=lstatSync(new URL(p,root));assert(!s.isSymbolicLink(),'Protected symlink '+p);if(s.isDirectory())for(const n of readdirSync(new URL(p,root)))walk(p+'/'+n);else assert(tracked.includes(p),'Unlisted protected source '+p)}walk(prefix)}
 for(const n of readdirSync(root))if(n.endsWith('.html'))assert(tracked.includes(n),'Unlisted public HTML '+n);
 const provenance=JSON.parse(read('tools/staff-integration-cycle16/provenance.json'));
 assert.equal(provenance.base,base);assert.deepEqual(provenance.runtime,Object.fromEntries(runtimePaths.map(p=>[p,{previous:hash(original(p)),composed:hash(expected(p))}])),'Derived runtime provenance');
 assert.deepEqual(provenance.reviewedAdditions,reviewedAdditionHashes,'Independently reviewed addition hashes cannot be self-approved');
 for(const[p,digest]of Object.entries(reviewedAdditionHashes)){assert(additions.includes(p)&&p!=='tools/staff-integration-cycle16/provenance.json','Reviewed addition scope');assert.equal(hash(read(p)),digest,'Reviewed addition bytes '+p)}
 assert.deepEqual(Object.keys(provenance.reviewedAdditions).sort(),additions.filter(p=>!['tools/staff-integration-cycle16/source.mjs','tools/staff-integration-cycle16/provenance.json'].includes(p)).sort(),'Complete reviewed addition inventory');
 return {base,runtimePaths,tracked:tracked.length,additions:additions.length,hostedAcceptance:false,releaseAuthorized:false};
}
export function checkpointReader(){verifyActual();return p=>runtimePaths.includes(p)||Object.hasOwn(transforms,p)?original(p):current(p)}
if(process.argv[1]===fileURLToPath(import.meta.url))console.log(JSON.stringify(verifyActual()));

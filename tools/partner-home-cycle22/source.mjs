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
export function expectedRegistrationRuntime(){assert.equal(hash(original(registrationRuntime)),'665236df4f5eb52f25e4bcc5560a0e8fda4feae139b4f0b17265d10964ca4f2a');const recipe=derivations[registrationRuntime];assert.equal(hash(recipe[1][0]),'cab69837156279bf24bd790115c24e2368f1dd87a094e79c79ff389b9a4cf81e','Exact preserved PR134/135 input');assert.equal(hash(recipe.at(-8)[0]),'4140e7a9c0dc8fbc0fb5c7883383090526bb5b53ec7936495c5e049d988418ed','Exact preserved PR136 input');assert.equal(hash(recipe.at(-7)[0]),'9b74499a568aca25f2b7fa8b14aab6d96d428c0ebd897b07996c0ef77da2dc61','Exact preserved PR137 input');assert.equal(hash(recipe.at(-6)[0]),'825fab3efa353a8c887d53f15fc35ea1c701444074caf40b50cb476a60ca315b','Exact preserved PR138 input');assert.equal(hash(recipe.at(-5)[0]),'8b0c2291dbca33e00181714b498d6175b816f0020ccda11509f6cca82df8c816','Exact preserved PR139 input');assert.equal(hash(recipe.at(-4)[0]),'66f29250b8d2b8a776bd7b08cdaed1bdb263f31a24330d8eebf0353e40af8799','Exact preserved PR140 input');assert.equal(hash(recipe.at(-3)[0]),'698bf392b618b022dcfe421e2a806fde7cf7b17f3808016d2d3803f7b1885990','Exact preserved PR141 input');assert.equal(hash(recipe.at(-2)[0]),'61b151be0c1b886b382072202e4b06e7601b2a1c9875c7ab6598bf6e4ab3ba77','Exact preserved PR142 input');assert.equal(hash(recipe.at(-1)[0]),'d90e088f474d2c11c11394585f76d5ac346b1540d250f7835f7da92d75f23151','Exact preserved PR143 input');const value=expectedRouter(registrationRuntime);assert.equal(hash(value),'d9e5394e7f13f1b5f16057f03e2f48aed6d95a5b3a5f6a9e2cccf201d4562ef2','Reviewed pre-dispatch correction');return value}
export const dispatchRuntimes=['assets/js/champion-life-auth.js','assets/js/staff-workspace.js'];
export function expectedDispatchRuntime(p){assert(dispatchRuntimes.includes(p));const value=expectedRouter(p);assert.equal(hash(value),{"assets/js/champion-life-auth.js": "46181c731cf1a2bda08b954cb2a4cdc483301ddf3187b017413c5ca856a23dda", "assets/js/staff-workspace.js": "8e87912340592842e7644b20e26fa6ec7f40f7d8f4695bfebddad00f34016508"}[p],'Exact reviewed pre-dispatch transport');return value}
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const current=p=>readFileSync(new URL(p,root));
const cache=new Map();
export function original(p){if(!cache.has(p))cache.set(p,execFileSync('git',['--no-replace-objects','show',base+':'+p],{cwd:root,maxBuffer:80*1024*1024}));return Buffer.from(cache.get(p))}
export const derivationSHA256='7eb92290be245b847b611c54003c0e02d4de9151f852632d22ae4f78081a2891';
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
  "tools/partner-home-cycle22/registration-checkin-status.native.mjs",
  "tools/partner-home-cycle22/registration-predispatch.browser.mjs",
  "tools/partner-home-cycle22/dispatch-transport.test.mjs",
  "tools/partner-home-cycle22/household-predispatch.browser.mjs",
  "tools/partner-home-cycle22/household-native.browser.mjs",
  "tools/partner-home-cycle22/attendee-waiver-predispatch.browser.mjs",
  "tools/partner-home-cycle22/attendee-waiver-native.browser.mjs",
  "tools/partner-home-cycle22/walkup-predispatch.browser.mjs",
  "tools/partner-home-cycle22/walkup-native.browser.mjs",
  "tools/partner-home-cycle22/eventday-export.browser.mjs",
  "tools/partner-home-cycle22/eventday-native.browser.mjs",
  "tools/partner-home-cycle22/attendance-recovery.browser.mjs",
  "tools/partner-home-cycle22/edit-recovery.browser.mjs",
  "tools/partner-home-cycle22/removal-recovery.browser.mjs",
  "tools/partner-home-cycle22/add-recovery.browser.mjs"
];
export const reviewedHashes={
  "tools/partner-home-cycle22/source.test.mjs": "31fb153e0afacb574adf07710d4a3c71338900c245b79b1540adedb3af63a579",
  "tools/partner-home-cycle22/build.mjs": "80bd1e63bbee8cab0403181e81e3adb7ee3a1995e97c3ba485284b76216cab22",
  "tools/partner-home-cycle22/derivations.json": "7eb92290be245b847b611c54003c0e02d4de9151f852632d22ae4f78081a2891",
  "tools/partner-home-cycle22/README.md": "0be7b52633346530e5b555f1d42277280f8264022b52cb056196233a533112e0",
  "tools/partner-home-cycle22/home-return.browser.mjs": "f610b31cada708adb84693dc40fc9aa20b3833e223c0c9fb9cb59c7e45263d05",
  ".github/workflows/partner-home-cycle22.yml": "720ce9e5d3c4e85d442bfa472ea72075ef417c878994740f2e2c00daf7d6272e",
  "tools/partner-home-cycle22/registration-host.browser.mjs": "dd2043d3457b18cd6052df67d0eed0228cd1afbcf49ffc060ca980a4b628dfdc",
  "tools/partner-home-cycle22/registration-checkin-journey.browser.mjs": "5946b1bffe3f0faf00e58695a9a6babd60196dc9740afa503954b3cbe9a4797e",
  "tools/partner-home-cycle22/registration-checkin-status.native.mjs": "f941859a5b2a376b17fc135bcc217f7d8fead492634595d20de04d497c248dfa",
  "tools/partner-home-cycle22/registration-predispatch.browser.mjs": "f0d83d3434431cf99b723144d4349264414e968841382a69681518eebb86c9c2",
  "tools/partner-home-cycle22/dispatch-transport.test.mjs": "9e0948ceed4432452e3a07ef827c2f83cac472909d5fad5259afd241718a761e",
  "tools/partner-home-cycle22/household-predispatch.browser.mjs": "301479b04cae00f22cfa3f0342b87948a2448d2db3d161db4187da093af468da",
  "tools/partner-home-cycle22/household-native.browser.mjs": "bc6dd8e99dc646f1a2a97ebbe85b63dfb04a4ec0f275543eabeb0e3a2e75049d",
  "tools/partner-home-cycle22/attendee-waiver-predispatch.browser.mjs": "59eb3f4844eb6766886c73e70d9e24821e3926a7fde17e8367d63aa9f80a56ce",
  "tools/partner-home-cycle22/attendee-waiver-native.browser.mjs": "d946046d43ff2f151b5122ef24c91305c55984d9e1ffb9dec7dbd3681524fa01",
  "tools/partner-home-cycle22/walkup-predispatch.browser.mjs": "ccf57abcb6b0bf5608ca2bdd5f7a15dc009548d4461f69c45bf853683ed2aea4",
  "tools/partner-home-cycle22/walkup-native.browser.mjs": "fcc99f8e2449531aa8a618c06c4f43145517c4a4607810bfa016f6166240411e",
  "tools/partner-home-cycle22/eventday-export.browser.mjs": "ccd60c3d07b3b42eab9336bf51eb5770a88bd6c7f3cbe1434b1f49688e6f6e88",
  "tools/partner-home-cycle22/eventday-native.browser.mjs": "fe01e336db7301599d5405a4c47c7b2aa7d4cfc59d647c7fa36eef5df2efea69",
  "tools/partner-home-cycle22/attendance-recovery.browser.mjs": "13f68e4028a4128010e535eaaf69f849a02d0e9cef2e67835f265e21b0efcba4",
  "tools/partner-home-cycle22/edit-recovery.browser.mjs": "17f639e4f69387091ea5116eaa2193212c38827afe2434838f502f669c4e5329",
  "tools/partner-home-cycle22/removal-recovery.browser.mjs": "950732f30d15d95ebb8d32e7e324b983ee5c4f812659bcc0c913b2b7237d5802",
  "tools/partner-home-cycle22/add-recovery.browser.mjs": "eb1b6ec2714589f0d6fc74528978d230558cb301acad05631db50a43385da976"
};
const tracked=execFileSync('git',['--no-replace-objects','ls-tree','-r','--name-only',base],{cwd:root,encoding:'utf8'}).trim().split('\n');
export function verifyActual(read=current){
 for(const p of tracked){const s=lstatSync(new URL(p,root));assert(s.isFile()&&!s.isSymbolicLink(),(p.startsWith('netlify')||p.startsWith('supabase')?'No protected backend/config symlink; ':'No public symlink; ')+'Regular exact source '+p);assert.deepEqual(read(p),p===runtime?expectedRuntime():p===registrationRuntime?expectedRegistrationRuntime():dispatchRuntimes.includes(p)?expectedDispatchRuntime(p):Object.hasOwn(derivations,p)?expectedRouter(p):original(p),'Historical guard/build/dependency unchanged; Exact123 source outside home return and bounded routers: '+p)}
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

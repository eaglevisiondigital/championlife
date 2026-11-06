// Additive review layer. Original frozen manifests remain byte-identical.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
const root=new URL('../../',import.meta.url);
export const base='0bee5dc7beef8ad7b88e5aeb9e0567730c82fc53';
const sha=b=>createHash('sha256').update(b).digest('hex');
export const original=path=>execFileSync('git',['--no-replace-objects','show',base+':'+path],{cwd:root,maxBuffer:64*1024*1024});
export const current=path=>readFileSync(new URL(path,root));
export const existing=['assets/js/staff-session.js','assets/js/staff-workspace.js','tools/backend-tests/staff-session.browser.mjs','tools/backend-tests/staff-workspace-discovery.browser.mjs','tools/backend-tests/staff-workspace.browser.mjs','tools/site-build/public-files.json'];
export const additions=['assets/css/communications.css','assets/js/communications.js','staff-campaign-communications.html','staff-communication-activity.html','staff-communication-templates.html','staff-communications.html'];
export const pinnedHelpers=['tools/staff-cycle7/source.mjs','tools/staff-cycle7/sources.json','tools/staff-cycle7/people-registration-fixture.mjs'];
export function verifyHostOverrides(bytes=current('tools/staff-host-cycle8/overrides.json'),read=current){
 assert.equal(sha(bytes),'52ded20d82c213716f796a5a3ee39720a3aa5881d196c9fcbf9b77b6a0d41c80','Exact reviewed Cycle8 override manifest');
 const m=JSON.parse(bytes);assert.equal(m.base,base);assert.deepEqual(Object.keys(m.existing).sort(),existing);assert.deepEqual(Object.keys(m.additions).sort(),additions);
 for(const path of existing){assert.equal(m.existing[path].originalSHA256,sha(original(path)),'Original102 '+path);assert.equal(m.existing[path].reviewedSHA256,sha(read(path)),'Reviewed Cycle8 '+path)}
 for(const path of additions)assert.equal(m.additions[path].reviewedSHA256,sha(read(path)),'Reviewed added source '+path);
 for(const path of ['tools/backoffice-composition/source-manifest.json','tools/staff-module-navigation/source-overrides.json','tools/staff-module-navigation/source-overrides.mjs','tools/site-build/build.mjs','tools/backend-tests/package.json','tools/backend-tests/package-lock.json'])assert.deepEqual(read(path),original(path),'Historical guard/build/dependency unchanged '+path);
 for(const path of pinnedHelpers)assert.deepEqual(read(path),execFileSync('git',['--no-replace-objects','show','f927eb060dce08dfd56f4eff37bc5627e8ed4c6a:'+path],{cwd:root}),'Original Cycle7 helper unchanged '+path);
 const session=execFileSync('git',['--no-replace-objects','show','efcfa3af4b2b7920bf4c357d42deba9aee3cfa4a:assets/js/staff-session.js'],{cwd:root});assert.deepEqual(read('assets/js/staff-session.js'),session,'Exact reviewed shared97 session');
 const before=JSON.parse(original('tools/site-build/public-files.json')),after=JSON.parse(read('tools/site-build/public-files.json'));assert.deepEqual(after,[...before,...additions].sort(),'Only six explicit Communications public assets added');
 return m;
}
// Verify current overrides FIRST, then keep every historical comparison against
// its original reviewed checkpoint. All other files are still current bytes.
export function checkpointReader(){verifyHostOverrides();return path=>existing.includes(path)?original(path):current(path)}

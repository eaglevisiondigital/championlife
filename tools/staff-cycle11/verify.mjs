import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import '../staff-cycle10/verify-legacy.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),head='e8d7481576081a13ee24f1b9e5e6fab7bba60981';
for(const path of ['tools/staff-cycle10/legacy.browser.mjs','tools/staff-cycle10/observer.mjs'])assert.equal(readFileSync(root+path,'utf8'),execFileSync('git',['--no-replace-objects','show',head+':'+path],{cwd:root,encoding:'utf8'}));
assert.equal(readFileSync(new URL('./legacy.browser.mjs',import.meta.url),'utf8'),readFileSync(new URL('../staff-cycle10/legacy.browser.mjs',import.meta.url),'utf8').replace("from './observer.mjs'","from './observe.mjs'").replace('Observation only: no fetch wrapping, request aborting, application source edits,','Cycle11 adds start-only fetch observation; no request aborting, application source edits,'));
console.log('PASS exact PR111 legacy driver copy, existing observer and original predicates unchanged');

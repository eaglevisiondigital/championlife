// Test fixture binding, not an application session adapter.
// Historical97 remains immutable; candidate fixtures serve the actual reviewed bytes.
import assert from 'node:assert/strict';
import {realpathSync,readFileSync} from 'node:fs';
import {resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {root,original,expected,verifyActual} from './source.mjs';
const sessionPath='assets/js/staff-session.js';
export function verifySessionBytes(actual,historical){
 assert.equal(historical,original(sessionPath).toString(),'Historical97 session must equal frozen115 base');
 assert.equal(actual,expected(sessionPath).toString(),'Candidate session must be exact base plus reviewed Partner route only');
 return actual;
}
export function reviewedHostSession(host,historical){
 assert.equal(realpathSync(host),realpathSync(fileURLToPath(root)),'Host must be this exact reviewed source tree');
 verifyActual();
 return verifySessionBytes(readFileSync(resolve(host,sessionPath),'utf8'),historical);
}

import assert from 'node:assert/strict';
import test from 'node:test';
import {execFileSync} from 'node:child_process';
import {current,original,expectedRuntime,requestBlock,runtime,verifyActual,checkpointReader,root} from './source.mjs';
const readWith=(path,bytes)=>p=>p===path?Buffer.from(bytes):current(p);
test('actual latest runtime and all unchanged module dependencies validate before historical projection',()=>{assert.equal(verifyActual().runtimeSHA256,'40aa0967529d0c0184b52866bdfa0861504b2339c11297b318d582d3706d7bc5');assert.deepEqual(current(runtime),expectedRuntime());assert.deepEqual(requestBlock(current(runtime)),requestBlock(original(runtime)));assert.deepEqual(checkpointReader()(runtime),original(runtime))});
test('loss of current-actor guard cannot be concealed by checkpoint reader',()=>{const altered=current(runtime).toString().replace("await verifyCurrent();fenced=true;","fenced=true;");assert.throws(()=>verifyActual(readWith(runtime,altered)),/Exact latest People/) });
test('unreviewed return route or task history mutation is denied',()=>{assert.throws(()=>verifyActual(readWith(runtime,current(runtime).toString().replace('query.limit(51)','query.limit(500)'))),/Exact latest People/) });
test('self-authorized source manifest rejected',()=>{const data=JSON.parse(current('tools/staff-runtime-cycle14/provenance.json'));data.runtimeSHA256='0'.repeat(64);assert.throws(()=>verifyActual(readWith('tools/staff-runtime-cycle14/provenance.json',JSON.stringify(data))),/Exact source-derived provenance/) });
test('router bypass rejected',()=>{const path='tools/staff-cycle9/source.mjs';assert.throws(()=>verifyActual(readWith(path,current(path).toString().replace('const readCheckpoint = checkpointReader();','const readCheckpoint = () => Buffer.alloc(0);'))),/Exact successor router/) });
test('unlisted public dependency and SQL edits rejected',()=>{for(const path of['assets/js/forms-admin.js','assets/js/staff-workspace.js','supabase/bootstrap/automatic-rls.sql'])assert.throws(()=>verifyActual(readWith(path,Buffer.concat([current(path),Buffer.from('\n/* drift */')]))),/Unchanged staff110 dependency/) });
test('unlisted new source file rejected without mutating shared source',()=>{const script=String.raw`
import child from 'node:child_process';import {syncBuiltinESMExports} from 'node:module';import assert from 'node:assert/strict';
const original=child.execFileSync;child.execFileSync=(file,args,options)=>file==='git'&&args[0]==='ls-files'?original(file,args,options)+'tools/staff-runtime-cycle14/unapproved.test-fixture\n':original(file,args,options);syncBuiltinESMExports();
const {verifyActual}=await import('./tools/staff-runtime-cycle14/source.mjs');assert.throws(()=>verifyActual(),/Unlisted composition file/);console.log('EXPECTED_REJECTION');`;
assert.equal(execFileSync(process.execPath,['--input-type=module','-e',script],{cwd:root,encoding:'utf8'}).trim(),'EXPECTED_REJECTION')});

test('reviewed CI cannot omit coverage or alter pinned checkout',()=>{const path='.github/workflows/staff-runtime-cycle14.yml';assert.throws(()=>verifyActual(readWith(path,Buffer.concat([current(path),Buffer.from('\n# unreviewed change')]))),/Exact independently reviewed Cycle14 workflow/)});

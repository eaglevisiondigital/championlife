import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {compose,original,runtime,communications,root} from './source.mjs';
test('exact reviewed lifetime policy composes without replacing shared host authority',()=>{const output=compose().toString();assert(output.includes('const lifetimeObserver=new MutationObserver(observeRemoval)'));assert(output.includes('window.StaffWorkspace.active()'));assert(output.includes("window.addEventListener('staff-protected-clear',()=>retire(undefined,true))"));assert(!output.includes('scopePicker'));assert.deepEqual(readFileSync(new URL(runtime,root)),process.env.ACTUAL_RUNTIME==='1'?compose():original(runtime))});
test('any changed host source fails before composition',()=>assert.throws(()=>compose(Buffer.concat([original(runtime),Buffer.from('\n')]))));
test('any changed incoming policy source fails before composition',()=>assert.throws(()=>compose(original(runtime),Buffer.concat([original(runtime,communications),Buffer.from('\n')]))));
test('shared Auth and host lifecycle remain unchanged outside explicit lifetime boundary',()=>{const before=original(runtime).toString(),after=compose().toString();for(const anchor of [' async function fresh(',' async function request(',' async function render(',' async function start(',' // The verified shared host owns scope']){const section=s=>s.slice(s.indexOf(anchor),s.indexOf('\n',s.indexOf(anchor)));assert.equal(section(after),section(before))}});

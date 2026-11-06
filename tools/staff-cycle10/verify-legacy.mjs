import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
const read=file=>readFileSync(new URL(file,import.meta.url),'utf8'),sha=text=>createHash('sha256').update(text).digest('hex');
const originals={
 '../staff-cycle8/modules.browser.mjs':'f73bba788f3c62301fa4636efae77232ba01cc562d381a7d788103492ea0b80c',
 '../staff-cycle8/modules-source.mjs':'bf5490234ecc4220085c134f6ea05f20fc9ee7f936021e1bff69d5e3de5f66b0',
 '../staff-cycle8/modules-fixture.mjs':'86a221dc9651add7f4dcfd2a7630d3f406b04d11dc20e00b829e0ee9e01231cb',
 '../staff-cycle8/modules-unload.mjs':'e9ae4d73b5cd7f1a199c4894b1c5c084164984219f86932f2dd08bfb41fb2ee5'
};
for(const [file,hash]of Object.entries(originals))assert.equal(sha(read(file)),hash,'original legacy input unchanged '+file);
let expected=read('../staff-cycle8/modules.browser.mjs');
const replacements=[
 ["from './modules-source.mjs'","from '../staff-cycle8/modules-source.mjs'"],
 ["from './modules-fixture.mjs'","from '../staff-cycle8/modules-fixture.mjs'"],
 ["from './modules-unload.mjs'","from '../staff-cycle8/modules-unload.mjs'"],
 ["const {chromium,webkit}=await import('../backend-tests/node_modules/playwright/index.mjs');","import {observe} from './observer.mjs';\nconst {chromium,webkit}=await import(process.env.PLAYWRIGHT_MODULE||'../backend-tests/node_modules/playwright/index.mjs');"],
 ["Object.entries({chromium,webkit})","Object.entries({webkit})"],
 ["for(const width of [390,1440])for(const m of modules)","for(const width of [390])for(const m of modules.filter(m=>m.name==='Forms'))"],
 ["const f=fixture(),context=","const originalFixture=fixture(),context="],
 ["let requestSequence=0;const requestIds=new WeakMap();","const diagnostic=await observe({page,context,fixture:originalFixture,getPhase:()=>phase,backend}),f=diagnostic.fixture;\n  let requestSequence=0;const requestIds=new WeakMap();"]
];
for(const [before,after]of replacements){assert.equal(expected.split(before).length,2,'unique observation insertion');expected=expected.replace(before,after)}
assert.equal(read('./legacy.browser.mjs'),expected,'legacy journey/assertions unchanged except explicit selection/imports/observer');
console.log(JSON.stringify({status:'PASS',legacyInputs:4,explicitDriverAdaptations:replacements.length,classifierChanged:false,assertionsChanged:false,fetchWrapped:false}));

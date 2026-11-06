import {test} from 'node:test';
import assert from 'node:assert/strict';
import {spawnSync} from 'node:child_process';
import {installInitiation} from './initiation.mjs';
const url='https://synthetic-modules.supabase.co/auth/v1/user?access_token=NEVER_RECORD';
test('same promise, this, arguments; no request options or URL secrets recorded',()=>{
 const records=[],promise=Promise.resolve('same'),options={method:'GET',headers:{authorization:'Bearer NEVER_RECORD_HEADER'},body:'NEVER_RECORD_BODY'};let call;
 const target={fetch:function(...args){call={self:this,args};return promise}};
 installInitiation(target,r=>records.push(r),()=>({documentId:'fictional-1',readyState:'complete',formsConnected:false}),{a:'a',b:'b'});
 assert.equal(target.fetch(url,options),promise);assert.equal(call.self,target);assert.equal(call.args[0],url);assert.equal(call.args[1],options);
 assert.equal(records.length,1);assert.equal(records[0].path,'/auth/v1/user');assert.equal(records[0].formsConnected,false);assert(!JSON.stringify(records).includes('NEVER_RECORD'));
});
test('observational errors preserve synchronous throw and do not read method getter',()=>{
 let getterCalls=0;const options={get method(){getterCalls++;return 'GET'}},sentinel=Error('original');
 const target={fetch(){throw sentinel}};installInitiation(target,()=>{throw Error('observer')},()=>({}),{a:'a',b:'b'});
 assert.throws(()=>target.fetch(url,options),e=>e===sentinel);assert.equal(getterCalls,0);
});
test('unwrapped and wrapped rejected promises both reach unhandledRejection unchanged',()=>{
 for(const wrapped of [false,true]){
  const script=`import {installInitiation} from ${JSON.stringify(new URL('./initiation.mjs',import.meta.url).href)};\nlet original;const target={fetch(){return original=Promise.reject(new Error('fictional rejection'))}};\n${wrapped?"installInitiation(target,()=>{},()=>({}),{a:'a',b:'b'});":""}\nlet seen=0;process.on('unhandledRejection',(error,promise)=>{if(promise!==original||error.message!=='fictional rejection')process.exit(2);seen++;});\ntarget.fetch('https://synthetic-modules.supabase.co/auth/v1/user');\nsetTimeout(()=>{process.stdout.write(JSON.stringify({seen}));process.exit(seen===1?0:3)},20);`;
  const result=spawnSync(process.execPath,['--input-type=module','-e',script],{encoding:'utf8'});assert.equal(result.status,0,result.stderr);assert.deepEqual(JSON.parse(result.stdout),{seen:1});
 }
});
test('only fixed synthetic principal labels; no body, header getters or promise methods accessed',()=>{
 const records=[],jwt=sub=>'Bearer x.'+Buffer.from(JSON.stringify({sub,email:'NEVER_RECORD_EMAIL'})).toString('base64url')+'.x';let accessed=0;
 const result={get then(){accessed++;throw Error('never inspect promise')}};
 const target={fetch(){return result}};installInitiation(target,r=>records.push(r),()=>({}),{a:'fixed-a',b:'fixed-b'});
 for(const [sub,label]of [['fixed-a','account-A'],['fixed-b','account-B'],['other-secret','other']]){
  assert.equal(target.fetch(url,{method:'GET',headers:new Headers({authorization:jwt(sub)})}),result);assert.equal(records.at(-1).principal,label);
 }
 const headers={get authorization(){accessed++;throw Error('never access getter')}};target.fetch(url,{headers});
 assert.equal(records.at(-1).principal,'unavailable');assert.equal(accessed,0);assert(!JSON.stringify(records).includes('NEVER_RECORD'));assert(!JSON.stringify(records).includes('other-secret'));
});

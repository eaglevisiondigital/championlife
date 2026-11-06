import test from 'node:test';
import assert from 'node:assert/strict';
import {installNavigationGate} from './gate.mjs';
function harness(){
 const timers=[],clears=[],events=[],target={location:{pathname:'/staff-forms.html'},setTimeout(...args){timers.push({receiver:this,args});return timers.length},clearTimeout(...args){clears.push({receiver:this,args});return 'cleared'}};
 const gate=installNavigationGate(target,e=>events.push(e),()=>harness.stack),run=i=>Reflect.apply(timers[i].args[0],target,timers[i].args.slice(2));
 return {target,timers,clears,events,gate,run};
}
harness.stack='callback@https://module-cycle8.invalid/assets/js/staff-session.js:58:4';
test('gate invokes exact original callback once with receiver/arguments; does not invoke early',()=>{
 const h=harness(),seen=[];function leave(...args){seen.push({self:this,args})}
 const token={};assert.equal(h.target.setTimeout(leave,0,token),1);assert.equal(h.gate.release(),false);
 h.run(0);assert.deepEqual(seen,[]);assert.equal(h.gate.ready,true);assert.equal(h.gate.release(),true);assert.equal(h.gate.release(),false);h.run(2);
 assert.deepEqual(seen,[{self:h.target,args:[token]}]);assert.equal(h.target.clearTimeout(1),'cleared');assert.deepEqual(h.clears[0].args,[1]);
});
test('unrelated name, delay, path and callsite are forwarded unchanged',()=>{
 for(const variation of ['name','delay','path','stack']){
  const h=harness();function leave(){}function refresh(){}
  if(variation==='path')h.target.location.pathname='/staff-events.html';
  if(variation==='stack')harness.stack='callback@https://foreign.invalid/assets/js/staff-session.js:58:4';
  const fn=variation==='name'?refresh:leave,delay=variation==='delay'?1:0,receiver={};
  assert.equal(h.target.setTimeout.call(receiver,fn,delay,'x'),1);assert.equal(h.timers.length,1);assert.deepEqual(h.timers[0],{receiver,args:[fn,delay,'x']});assert.equal(h.gate.ready,false);
  harness.stack='callback@https://module-cycle8.invalid/assets/js/staff-session.js:58:4';
 }
});
test('timeout is explicit failure evidence and releases the original callback for cleanup',()=>{
 const h=harness();let count=0;function leave(){count++}
 h.target.setTimeout(leave,0);h.run(0);h.run(1);assert(h.events.some(e=>e.kind==='gate-timeout'));h.run(2);assert.equal(count,1);
});
test('callback errors remain uncaught; subsequent leave timers are not captured',()=>{
 const h=harness(),error=Error('fictional');function leave(){throw error}
 h.target.setTimeout(leave,0);h.run(0);h.gate.release();assert.throws(()=>h.run(2),e=>e===error);
 const before=h.timers.length;h.target.setTimeout(leave,0);assert.equal(h.timers.length,before+1);assert.equal(h.timers.at(-1).args[0],leave);
});

import {JSDOM} from 'jsdom';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const tick=()=>new Promise(r=>setTimeout(r,10));
for(const mode of ['manage','read-only','revoked','signed-out','wrong-org']){
 const dom=new JSDOM('<main id="outreach-people"></main>',{url:'https://preview.example/staff-people.html?org=org-a&person=11111111-1111-4111-8111-111111111111',runScripts:'outside-only'}),w=dom.window;
 let permissions=['people.read','followup.read',...(mode==='read-only'?[]:['followup.manage'])],writes=[],filters=[],callback;
 const context=()=>({organizations:[{id:'org-a',name:'Synthetic organization'}],grants:permissions.map(permission=>({organization_id:mode==='wrong-org'?'org-b':'org-a',permission,department_ids:null}))});
 let queryResult=[{id:'task-a',title:'Synthetic follow-up',status:'open',due_on:null,revision:2}];
 const client={auth:{onAuthStateChange(fn){callback=fn}},rpc:async(name,p)=>({data:name==='staff_workspace_context'?context():{person:{id:p.p_payload.person_id,first_name:'Synthetic',last_name:'Partner',email:'synthetic@example.test'},relationships:[{relationship:'partner',active:true}]}}),from(table){assert.equal(table,'followup_tasks');const q={select(){return q},eq(k,v){filters.push([k,v]);return q},order(){return q},limit(){return Promise.resolve({data:queryResult})},update(value){writes.push(value);return q},maybeSingle(){return Promise.resolve({data:{id:'task-a'}})}};return q}};
 w.ChampionLifeAuth={client,getUser:async()=>mode==='signed-out'?null:{id:'user-a'},getSession:async()=>({user:{id:'user-a'}})};
 w.eval(read('assets/js/outreach-staff-common.js'));w.eval(read('assets/js/outreach-people.js'));await tick();await tick();
 const button=[...w.document.querySelectorAll('button')].find(b=>b.textContent==='Save task status');
 if(['signed-out','wrong-org'].includes(mode)){assert(!w.document.body.textContent.includes('synthetic@example.test'));assert(!button)}
 else {assert(w.document.body.textContent.includes('Synthetic follow-up'));if(mode==='read-only')assert(!button);else{
  if(mode==='revoked')permissions=[];button.click();await tick();await tick();
  assert.equal(writes.length,mode==='revoked'?0:1);if(mode==='revoked'){assert(!w.document.body.textContent.includes('synthetic@example.test'));assert(w.document.querySelector('[role=alert]'))}
  else {assert(filters.some(([k,v])=>k==='organization_id'&&v==='org-a'));assert(filters.some(([k,v])=>k==='revision'&&v===2))}
 }}
 callback?.('SIGNED_OUT',null);assert(!w.document.body.textContent.includes('synthetic@example.test'));w.close();console.log('PASS People/follow-up DOM '+mode);
}

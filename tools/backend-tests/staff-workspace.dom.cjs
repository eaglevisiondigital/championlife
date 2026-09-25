// Requires jsdom 26.1.0 in the development environment. Synthetic data only.
const {JSDOM}=require('jsdom');
const fs=require('node:fs'),path=require('node:path'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
const dom=new JSDOM(fs.readFileSync(path.join(root,'staff-people.html'),'utf8'),{runScripts:'outside-only',url:'https://workspace.test/staff-people.html'});
const w=dom.window,d=w.document;
w.HTMLDialogElement.prototype.close=function(){this.open=false;};
w.HTMLDialogElement.prototype.showModal=function(){this.open=true;};
const mock=fs.readFileSync(path.join(__dirname,'staff-workspace.browser.cjs'),'utf8').split('body:`')[1].split('`});')[0];
w.eval(mock);w.eval(fs.readFileSync(path.join(root,'assets/js/staff-people.js'),'utf8'));
const wait=()=>new Promise(r=>setTimeout(r,0));
const click=selector=>d.querySelector(selector).click();
(async()=>{
 await wait();assert.equal(d.getElementById('workspace').hidden,false);assert.equal(d.getElementById('view-overview').hidden,false);
 click('.sidebar [data-view="people"]');await wait();assert.match(d.getElementById('people').textContent,/Jane Example/);
 d.getElementById('search-query').value='100%_';d.getElementById('search-form').dispatchEvent(new w.Event('submit',{cancelable:true}));await wait();
 assert.equal(JSON.stringify(w.calls.at(-1)),JSON.stringify(['last_name','%100\\%\\_%']));
 click('#people button');assert.equal(d.getElementById('editor').open,true);click('#cancel');
 const org=d.getElementById('organization');org.value='outreach';org.dispatchEvent(new w.Event('change'));await wait();
 assert.match(d.getElementById('people').textContent,/Sam Example/);assert.doesNotMatch(d.getElementById('people').textContent,/Jane Example/);assert.equal(d.querySelectorAll('#people button').length,0);
 click('.sidebar [data-view="modules"]');assert.equal(d.querySelectorAll('.module-card').length,11);assert.equal(d.getElementById('view-people').hidden,true);
 assert.match(d.getElementById('module-grid').textContent,/Powered by Lockliel/);
 w.changeAccount('SIGNED_OUT',null);assert.equal(d.getElementById('workspace').hidden,true);assert.equal(d.getElementById('people').textContent,'');
 console.log('PASS simulated DOM: view switching, literal search, editor opening, organization isolation in UI, read-only controls, module labels, account-change clearing');
 dom.window.close();
})().catch(e=>{console.error(e);process.exitCode=1;dom.window.close();});

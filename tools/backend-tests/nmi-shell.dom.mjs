import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const files=JSON.parse(read('tools/site-build/public-files.json'));
for(const file of files.filter(f=>/^(?:staff-(?:giving|payment|form)|checkout|form|payment-history).*\.html$/.test(f))){
 const dom=new JSDOM(read(file));
 for(const node of dom.window.document.querySelectorAll('[src],[href]')){
  const path=(node.getAttribute('src')||node.getAttribute('href')).split(/[?#]/)[0];
  if(path&&!/^(?:[a-z]+:|\/)/i.test(path))assert(files.includes(path)&&existsSync(new URL(path,root)),file+' missing public dependency '+path);
 }dom.window.close();
}
let allowed=true;const calls=[];const dom=new JSDOM('<!doctype html><body data-staff-workspace><main><h1>Giving</h1></main></body>',{url:'https://example.test/staff-giving-overview.html',runScripts:'outside-only'}),w=dom.window;
w.matchMedia=()=>({matches:false});
w.ChampionLifeAuth={getUser:async()=>({id:'synthetic-user'}),signOut:async()=>{},client:{auth:{onAuthStateChange:()=>{}},rpc:async(name)=>{calls.push(name);assert(['giving_workspace','forms_workspace','payments_workspace'].includes(name));return {data:{organizations:allowed?[{id:'synthetic-org',name:'Synthetic',permissions:['finance.read','finance.reports.read','finance.gifts.read','payments.view']}]:[]}};}}};
w.eval(read('assets/js/outreach-staff-common.js'));w.eval(read('assets/js/staff-workspace.js'));
try{
 for(let i=0;i<20&&!w.document.querySelector('nav a');i++)await new Promise(r=>setTimeout(r,10));
 const links=[...w.document.querySelectorAll('nav a')];assert(links.length>0);
 for(const link of links)assert(existsSync(new URL(link.getAttribute('href').split('?')[0],root)),link.href);
 assert(!calls.includes('outreach_campaign_workspace'));
 allowed=false;await w.StaffWorkspace.refresh();assert.equal(w.document.querySelectorAll('nav a').length,0);
 console.log('PASS extracted shell: installed local dependencies, Giving-only discovery/navigation and same-session revoked navigation');
}finally{w.close()}

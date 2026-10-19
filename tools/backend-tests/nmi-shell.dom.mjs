import assert from 'node:assert/strict';
import {JSDOM} from 'jsdom';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8');
const files=JSON.parse(read('tools/site-build/public-files.json'));
for(const file of files.filter(f=>/^(?:staff-(?:giving|payment|form|nmi)|nmi-giving|checkout|form|payment-history).*\.html$/.test(f))){
 const dom=new JSDOM(read(file));
 for(const node of dom.window.document.querySelectorAll('[src],[href]')){
  const path=(node.getAttribute('src')||node.getAttribute('href')).split(/[?#]/)[0];
  if(path&&!/^(?:[a-z]+:|\/)/i.test(path))assert(files.includes(path)&&existsSync(new URL(path,root)),file+' missing public dependency '+path);
 }dom.window.close();
}
let allowed=true;const calls=[];const dom=new JSDOM('<!doctype html><body data-staff-workspace><main><h1>SYNTHETIC_GIVING_PROTECTED</h1></main></body>',{url:'https://example.test/staff-giving-overview.html',runScripts:'outside-only'}),w=dom.window;
w.matchMedia=()=>({matches:false});
const org={id:'synthetic-org',name:'Synthetic',slug:'synthetic-church'};
const context=()=>({staff:{organizations:[org],grants:[]},modules:['giving'],
 giving:{organizations:allowed?[{...org,permissions:['finance.read','finance.reports.read','finance.gifts.read']}]:[]},
 payments:{organizations:allowed?[{...org,permissions:['payments.view']}]:[]},forms:{organizations:[]},communications:{organizations:[],campaigns:[]},
 outreach:{contexts:allowed?['champion']:[],campaigns:[],role_label:'Synthetic finance',access_version:allowed?'giving-v1':'revoked-v2'},decisions:[],partners:[]});
w.ChampionLifeAuth={enabled:true,getUser:async()=>({id:'synthetic-user',email:'synthetic@example.test'}),signOut:async()=>{},client:{auth:{onAuthStateChange:()=>{}},rpc:async(name)=>{calls.push(name);assert.equal(name,'shared_platform_context');return {data:context()};}}};
const source=read('assets/js/staff-workspace.js'),marker='/* GATE0_ROUTES */ []';
assert(source.includes(marker),'Shared shell must expose the reviewed build route injection marker');
const routes=files.filter(p=>/^staff-[a-z0-9-]+\.html$/.test(p));
w.eval(read('assets/js/outreach-staff-common.js'));w.eval(source.replace(marker,()=>JSON.stringify(routes)));
try{
 for(let i=0;i<20&&!w.document.querySelector('nav a');i++)await new Promise(r=>setTimeout(r,10));
 const links=[...w.document.querySelectorAll('nav a')];assert(links.length>0);
 for(const link of links){const target=link.getAttribute('href').split('?')[0];assert(files.includes(target)&&existsSync(new URL(target,root)),link.href);assert(!/^staff-outreach|^outreach-/.test(target),'Giving-only profile cannot receive Outreach navigation');}
 for(const link of w.document.querySelectorAll('.staff-shell a[href]')){
  const href=link.getAttribute('href');if(href.startsWith('#'))continue;
  const destination=new URL(href,w.location.href);if(destination.origin!==w.location.origin)continue;
  const target=destination.pathname.replace(/^\//,'');
  assert(files.includes(target)&&existsSync(new URL(target,root)),'Shared chrome destination must be installed: '+target);
 }
 assert(links.some(a=>a.getAttribute('href').startsWith('staff-giving-gifts.html')),'Giving gift authority retained');
 assert(links.some(a=>a.getAttribute('href').startsWith('staff-payment-operations.html')),'Payment navigation authority retained');
 assert(calls.length>0&&calls.every(name=>name==='shared_platform_context'),'One shared context delegates module authorizers server-side');
 allowed=false;await w.StaffWorkspace.refresh();assert.equal(w.document.querySelectorAll('nav a').length,0);
 assert(!w.document.querySelector('main').textContent.includes('SYNTHETIC_GIVING_PROTECTED'),'Same-session revocation clears protected module content');
 console.log('PASS adopted NMI shell: complete installed dependencies, build-injected routes, shared context, Giving-only authority/navigation and same-session revoked navigation/content');
}finally{w.close()}

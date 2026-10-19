// Real local Chromium over actual module hosts/assets. Auth/RPC fixtures are fictional.
// No provider, Supabase, external network, credential or money operation.
import assert from 'node:assert/strict';
import {createServer} from 'node:http';
import {readFileSync,mkdirSync,writeFileSync,existsSync} from 'node:fs';
import {resolve,join,dirname} from 'node:path';
import {fileURLToPath} from 'node:url';
import {sharedShellFixture} from './nmi-shared-shell-fixture.mjs';
const {chromium}=await import(process.env.TEST_PLAYWRIGHT_MODULE||'playwright');
const root=resolve(dirname(fileURLToPath(import.meta.url)),'../..');
const evidence=process.env.EVIDENCE_DIR||'/private/tmp/nmi-module-browser';mkdirSync(evidence,{recursive:true});
const read=path=>readFileSync(join(root,path),'utf8');
const published=JSON.parse(read('tools/site-build/public-files.json'));
const definitions=[
 {file:'staff-giving-overview.html',name:'giving',fixture:'giving',root:'#giving-app',marker:'Foreign Missions',business:['giving-utils.js','giving-management-utils.js','giving-management.js']},
 {file:'staff-giving-summary.html',name:'reports',fixture:'giving',root:'#giving-reports-app',marker:'Missions',business:['giving-utils.js','giving-management-utils.js','giving-reports.js']},
 {file:'staff-payment-providers.html',name:'providers',fixture:'payments',root:'#payments-app',marker:'NMI Gateway',business:['giving-utils.js','payments.js']},
 {file:'staff-nmi-execution.html',name:'execution',fixture:'execution',root:'#nmi-staff-app',marker:'SYNTHETIC EXECUTION ROUTE',business:['giving-utils.js','nmi-giving-client.js','/fixture/execution-client.js','nmi-staff-execution.js']}
];
const executionFixture=`(()=>{const s=window.nmiExecutionFixture={user:{id:'first-synthetic',email:'first@example.test'},deny:false,callbacks:[],calls:[]};
const org={id:'74000000-0000-4000-8000-000000000001',name:'Synthetic Church',permissions:['payments.view','payments.manage','payments.configure','payments.recurring.manage','payments.reconcile']};
window.ChampionLifeAuth={enabled:true,getUser:async()=>s.user,client:{auth:{onAuthStateChange:fn=>s.callbacks.push(fn)},rpc:async(name,args={})=>{s.calls.push({name,args});if(name==='shared_platform_context')return{data:{staff:{organizations:[],grants:[]},giving:{organizations:[]},payments:{organizations:s.deny?[]:[org]},forms:{organizations:[]},outreach:{contexts:s.deny?[]:['champion'],campaigns:[],role_label:'Synthetic finance'},decisions:[],partners:[]}};if(name==='payments_workspace'&&args.p_action==='context')return{data:{organizations:s.deny?[]:[org]}};throw Error('Unexpected synthetic RPC');}}};})();`;
const executionClient=`(()=>{const E=window.NmiGivingClient.element,s=window.nmiExecutionFixture;window.NmiGivingClient={element:E,call:async p=>{if(p.action!=='operations')throw Error('Browser test permits read-only operations only');if(s.deny)throw Error('Finance access denied');return{enabled:false,held_receipts:1,recurring:[],jobs:[],attempts:[{id:'synthetic-attempt',session_id:'synthetic-session',leg_id:'synthetic-leg',operation:'sale',state:'review',amount_minor:'2500',currency:'USD',route_label:'SYNTHETIC EXECUTION ROUTE'}]};}};})();`;
function bootstrap(definition){return `(()=>{const s=window.${definition.fixture==='giving'?'givingFixture':definition.fixture==='payments'?'paymentsFixture':'nmiExecutionFixture'};
const phase=new URLSearchParams(location.search).get('fixture_identity')==='second'?'second':'first';s.user={...s.user,id:phase+'-synthetic',email:phase+'@example.test'};
let hold=false,release=null;const original=window.ChampionLifeAuth.client.rpc;
window.ChampionLifeAuth.client.rpc=async(name,args={})=>{const response=await original(name,args);if(hold&&name==='giving_reports'&&args.p_action==='report'){hold=false;window.__browserHeld=true;await new Promise(r=>release=r);}return response;};
window.__moduleBrowser={revoke(){s.deny=true;window.dispatchEvent(new Event('focus'));},identity(){s.user={...s.user,id:'second-synthetic',email:'second@example.test'};window.dispatchEvent(new Event('focus'));},hold(){hold=true;window.__browserHeld=false;},release(){if(!release)throw Error('No old request held');release();release=null;}};})();`;}
function host(definition){
 let html=read(definition.file).replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi,'');
 const fixtures=definition.fixture==='giving'?['/fixture/giving.js',...(definition.name==='reports'?['/fixture/reports.js']:[])]:definition.fixture==='payments'?['/fixture/payments.js']:['/fixture/execution.js'];
 const scripts=[`<script>window.__PAYMENTS_DOM_TEST__=true;</script>`,...fixtures.map(src=>`<script src="${src}"></script>`),`<script>${bootstrap(definition)}</script>`,
  '<script src="/assets/js/outreach-staff-common.js"></script>','<script src="/assets/js/staff-workspace.js"></script>',
  ...definition.business.map(file=>`<script src="${file.startsWith('/')?file:'/assets/js/'+file}"></script>`)];
 return html.replace('</body>',scripts.join('\n')+'</body>');
}
const aliases={'/fixture/giving.js':'tools/backend-tests/fixtures/giving-browser-fixture.js','/fixture/reports.js':'tools/backend-tests/fixtures/giving-reports-browser-fixture.js','/fixture/payments.js':'tools/backend-tests/fixtures/payments-browser-fixture.js'};
const result={scope:'Actual local Chromium/module HTML/assets; fictional Auth/RPC; no external network or provider acceptance',viewports:[390,1440],checks:[],screenshots:[],page_errors:[],console_errors:[],external_requests:[]};
let browser,server;
const check=(condition,label)=>{assert.ok(condition,label);result.checks.push(label);console.log('PASS '+label);};
const save=()=>writeFileSync(join(evidence,'RESULTS.json'),JSON.stringify(result,null,2)+'\n');
try{
 server=createServer((request,response)=>{try{
  const path=new URL(request.url,'http://127.0.0.1').pathname,definition=definitions.find(x=>'/'+x.file===path);
  if(definition){response.setHeader('Content-Type','text/html');response.end(host(definition));return;}
  if(path==='/favicon.ico'){response.writeHead(204);response.end();return;}
  if(path==='/fixture/execution.js'||path==='/fixture/execution-client.js'){response.setHeader('Content-Type','application/javascript');response.end(path.endsWith('execution-client.js')?executionClient:executionFixture);return;}
  if(aliases[path]){response.setHeader('Content-Type','application/javascript');response.end(read(aliases[path]));return;}
  if(path==='/assets/js/staff-workspace.js'){response.setHeader('Content-Type','application/javascript');response.end(sharedShellFixture());return;}
  const file=path.replace(/^\//,'');if(!published.includes(file)||!existsSync(join(root,file))){response.writeHead(404);response.end('Not a reviewed local test asset');return;}
  const type=/\.css$/.test(file)?'text/css':/\.js$/.test(file)?'application/javascript':/\.png$/.test(file)?'image/png':/\.svg$/.test(file)?'image/svg+xml':/\.webp$/.test(file)?'image/webp':'application/octet-stream';
  response.setHeader('Content-Type',type);response.end(readFileSync(join(root,file)));
 }catch(error){response.writeHead(500);response.end('Local fixture error');result.page_errors.push(error.message);}});
 await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));const base='http://127.0.0.1:'+server.address().port;
 browser=await chromium.launch({headless:true,channel:'chrome'});
 for(const width of result.viewports)for(const definition of definitions){
  const context=await browser.newContext({viewport:{width,height:1000},deviceScaleFactor:1});
  await context.route('**/*',route=>{if(new URL(route.request().url()).origin!==base){result.external_requests.push(route.request().url());return route.abort();}return route.continue();});
  const page=await context.newPage();page.on('pageerror',error=>result.page_errors.push(error.message));page.on('console',message=>{if(message.type()==='error')result.console_errors.push(message.text());});
  const tag=definition.name+'-'+width;
  const shot=async phase=>{const file=tag+'-'+phase+'.png';await page.screenshot({path:join(evidence,file),fullPage:true});result.screenshots.push(file);};
  const loaded=async()=>{await page.locator(definition.root+' h1').waitFor({state:'visible'});await page.waitForFunction(marker=>document.querySelector('#staff-main')?.textContent.includes(marker),definition.marker);};
  const noOverflow=async phase=>check(await page.evaluate(()=>document.documentElement.scrollWidth<=window.innerWidth+1),tag+' '+phase+' has no page overflow');
  const recovery=async phase=>{
   await page.locator('#staff-main > .staff-state[role="status"] h2').filter({hasText:'Access changed'}).waitFor({state:'visible'});
   const status=await page.evaluate(({published,marker})=>{const main=document.querySelector('#staff-main'),card=main.querySelector(':scope > .staff-state[role="status"]'),link=card?.querySelector('a[href]'),url=link?new URL(link.getAttribute('href'),location.href):null;return{attached:!!card&&main.children.length===1,label:card?.querySelector('h2')?.textContent,href:url?.pathname.replace(/^\//,''),sameOrigin:url?.origin===location.origin,noPrivate:!main.textContent.includes(marker),noControls:!main.querySelector('input,select,textarea,form,table,dialog'),published:!!url&&published.includes(url.pathname.replace(/^\//,''))};},{published,marker:definition.marker});
   check(status.attached&&status.label==='Access changed',tag+' '+phase+' has attached accessible recovery');check(status.sameOrigin&&status.published&&existsSync(join(root,status.href)),tag+' '+phase+' recovery points to an installed staff page');check(status.noPrivate&&status.noControls,tag+' '+phase+' removes protected data and controls');await noOverflow(phase);return status.href;
  };
  try{
   await page.goto(base+'/'+definition.file);await loaded();check(true,tag+' actual module renders fictional authorized data');await noOverflow('authorized');
   check(await page.locator('input[name=pan],input[name=cvv],input[name=card_number],input[type=password]').count()===0,tag+' contains no raw financial/credential input');await shot('authorized');
   await page.evaluate(()=>window.__moduleBrowser.identity());const target=await recovery('identity');await shot('identity-recovery');
   const next=new URL(target,base);next.searchParams.set('fixture_identity','second');await page.goto(next.href);await loaded();check((await page.locator('.staff-user').textContent()).includes('second@example.test'),tag+' fresh navigation loads the new authorized identity');await shot('new-identity');
   if(definition.name==='reports'){
    await page.evaluate(()=>window.__moduleBrowser.hold());await page.getByRole('button',{name:'Week',exact:true}).click();await page.waitForFunction(()=>window.__browserHeld===true);check(true,tag+' old successful report response held before revocation');
   }
   await page.evaluate(()=>window.__moduleBrowser.revoke());await recovery('revoked');
   if(definition.name==='reports'){await page.evaluate(()=>window.__moduleBrowser.release());await page.waitForTimeout(80);await recovery('late-response');check(true,tag+' late successful response cannot replace recovery or restore protected data');}
   await shot('revoked-recovery');
  }finally{await context.close();save();}
 }
 check(result.external_requests.length===0,'all module browser requests stayed on the fictional localhost fixture');check(result.page_errors.length===0,'all module pages have zero browser script errors');check(result.console_errors.length===0,'all module pages have zero browser console errors');
 save();console.log(result.checks.length+' module Chromium checks passed; '+result.screenshots.length+' screenshots; no external/provider traffic');
}catch(error){result.failure=error.message;save();throw error;}finally{await browser?.close();if(server)await new Promise(resolve=>server.close(resolve));}

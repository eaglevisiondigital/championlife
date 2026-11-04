import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {resolve,extname} from 'node:path';
import {createServer} from 'node:http';
import {chromium,webkit} from '../backend-tests/node_modules/playwright/index.mjs';
const root=resolve(fileURLToPath(new URL('../..',import.meta.url)));
const fixture=readFileSync(new URL('./browser-fixture.js',import.meta.url),'utf8')+`
(() => {
 const f=window.formsFixture, client=window.ChampionLifeAuth.client, old=client.rpc;
 const ids=['76000000-0000-4000-8000-000000000020','76000000-0000-4000-8000-000000000030'];
 let grants=[0],held=null,holdNext=false,reverse=false,swapped=null,multiple=false;
 const other="76000000-0000-4000-8000-000000000011";
 const rights=n=>swapped===null?["forms.read","forms.edit"]:((swapped?1:0)===n?["forms.read","forms.edit"]:["forms.read"]);
 const record=n=>({id:ids[n],organization_id:f.org,name:'Scoped private '+['A','B'][n],type:'registration',status:'draft',permissions:rights(n),submission_count:null,payment_enabled:false});
 f.scope={set:items=>{grants=items},holdList:()=>{holdNext=true},release:()=>{held?.();held=null},get pending(){return !!held},reverse:()=>{reverse=!reverse},swap:value=>{swapped=value},multiple:()=>{multiple=true}};
 client.rpc=async(name,args)=>{
  if(!['context','list'].includes(args.p_action))return old(name,args);
  f.calls.push({name,args:JSON.parse(JSON.stringify(args)),user:f.A.id});
  const context={capabilities:{profile:'private_draft_v1'},organizations:[{id:f.org,name:'Fictional scoped Church',permissions:[],scoped_forms:grants.map(n=>({id:ids[n],name:record(n).name,permissions:reverse?[...rights(n)].reverse():rights(n)})).sort((a,b)=>reverse?b.id.localeCompare(a.id):a.id.localeCompare(b.id))}]};
  if(multiple)context.organizations.push({...context.organizations[0],id:other,name:'Other fictional Church'});
  const result={data:args.p_action==='context'?context:{forms:grants.map(n=>({...record(n),organization_id:args.p_org,name:(args.p_org===other?'Other organization ':'')+record(n).name}))}};
  if(args.p_action==='list'&&holdNext){holdNext=false;await new Promise(r=>held=r)}
  return result;
 };
})();`;
const server=createServer((req,res)=>{try{const path=resolve(root,'.'+new URL(req.url,'http://localhost').pathname);if(!path.startsWith(root+'/'))throw Error();res.setHeader('Content-Type',extname(path)==='.js'?'text/javascript':extname(path)==='.css'?'text/css':'text/html');res.end(readFileSync(path))}catch{res.writeHead(404);res.end()}});
await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
let checks=0,failures=[];const ok=(value,label)=>{assert.ok(value,label);checks++;console.log('PASS '+label)};
try{for(const [name,engine,path]of[['chromium',chromium,process.env.CHROMIUM_EXECUTABLE],['webkit',webkit,process.env.WEBKIT_EXECUTABLE]])for(const width of[1440,390]){
 const browser=await engine.launch(path?{executablePath:path}:{});const page=await browser.newPage({viewport:{width,height:900}});const label=name+' '+width;const errors=[];page.on('pageerror',e=>errors.push(e.message));
 try{
 await page.route('**/*',async route=>{const u=route.request().url();if(!u.startsWith(base)){await route.fulfill({body:'',contentType:'text/javascript'});return}if(u.endsWith('/assets/js/champion-life-auth.js')){await route.fulfill({body:fixture,contentType:'text/javascript'});return}if(u.endsWith('/assets/js/supabase-config.js')){await route.fulfill({body:'',contentType:'text/javascript'});return}await route.continue()});
 await page.goto(base+'/staff-forms.html');await page.getByText('Scoped private A · registration',{exact:true}).waitFor();
 ok(await page.getByRole('button',{name:'Create form',exact:true}).count()===0,label+' scoped reader gains no organization create');
 await page.evaluate(()=>{window.retainedA=document.querySelector('.forms-list a');formsFixture.scope.set([1]);formsFixture.scope.holdList();return ChampionLifeFormsContext.refresh()});
 // New authority must retire A before the replacement list can finish.
 await page.waitForTimeout(100);
 ok(await page.getByText('Scoped private A · registration',{exact:true}).count()===0,label+' changed record scope immediately retires A');
 ok(await page.evaluate(()=>formsFixture.scope.pending&&!retainedA.isConnected),label+' replacement read pending and old control detached');
 await page.evaluate(()=>formsFixture.scope.release());await page.getByText('Scoped private B · registration',{exact:true}).waitFor();
 ok(await page.getByText('Scoped private A · registration',{exact:true}).count()===0,label+' only B rendered after replacement');
 await page.evaluate(()=>{formsFixture.scope.set([0,1]);return ChampionLifeFormsContext.refresh()});await page.getByText('Scoped private A · registration',{exact:true}).waitFor();
 ok(await page.getByText('Scoped private B · registration',{exact:true}).count()===1,label+' permitted additional record appears');
 const before=await page.evaluate(()=>formsFixture.calls.filter(x=>x.args.p_action==='list').length);
 await page.evaluate(()=>{formsFixture.scope.reverse();return ChampionLifeFormsContext.refresh()});
 ok(await page.evaluate(()=>formsFixture.calls.filter(x=>x.args.p_action==='list').length)===before,label+' equivalent scope ordering preserves same-account list');
 await page.evaluate(()=>{formsFixture.scope.swap(false);return ChampionLifeFormsContext.refresh()});await page.waitForTimeout(50);
 ok(await page.locator('.forms-list tr').filter({hasText:'Scoped private A'}).getByRole('link',{name:'Edit',exact:true}).count()===1&&await page.locator('.forms-list tr').filter({hasText:'Scoped private B'}).getByRole('link',{name:'Edit',exact:true}).count()===0,label+' original exact-record edit authority');
 await page.evaluate(()=>{formsFixture.scope.swap(true);return ChampionLifeFormsContext.refresh()});await page.waitForTimeout(50);
 ok(await page.locator('.forms-list tr').filter({hasText:'Scoped private A'}).getByRole('link',{name:'Edit',exact:true}).count()===0&&await page.locator('.forms-list tr').filter({hasText:'Scoped private B'}).getByRole('link',{name:'Edit',exact:true}).count()===1,label+' same-union per-form permission swap replaces controls');
 await page.evaluate(()=>{formsFixture.scope.multiple();formsFixture.scope.swap(null);return ChampionLifeFormsContext.refresh()});await page.waitForTimeout(50);
 await page.getByLabel('Organization',{exact:true}).selectOption('76000000-0000-4000-8000-000000000011');await page.getByText('Other organization Scoped private B · registration',{exact:true}).waitFor();
 ok(await page.getByText('Scoped private A · registration',{exact:true}).count()===0,label+' same-key organization switch replaces prior records');
 await page.getByLabel('Organization',{exact:true}).selectOption('76000000-0000-4000-8000-000000000010');await page.getByText('Scoped private A · registration',{exact:true}).waitFor();
 ok(await page.getByText('Other organization Scoped private A · registration',{exact:true}).count()===0,label+' organization return loads only authorized current scope');
 await page.evaluate(()=>{formsFixture.scope.set([0]);formsFixture.scope.holdList();return ChampionLifeFormsContext.refresh()});await page.waitForFunction(()=>formsFixture.scope.pending);
 await page.evaluate(()=>{formsFixture.scope.set([1]);return ChampionLifeFormsContext.refresh()});await page.getByText('Scoped private B · registration',{exact:true}).waitFor();await page.evaluate(()=>formsFixture.scope.release());await page.waitForTimeout(60);
 ok(await page.getByText('Scoped private A · registration',{exact:true}).count()===0,label+' delayed removed-scope response cannot restore A');
 await page.evaluate(()=>{formsFixture.scope.set([0,1]);formsFixture.scope.holdList();return ChampionLifeFormsContext.refresh()});await page.waitForFunction(()=>formsFixture.scope.pending);
 const pendingCount=await page.evaluate(()=>formsFixture.calls.filter(x=>x.args.p_action==='list').length);
 await page.evaluate(()=>{formsFixture.scope.reverse();return ChampionLifeFormsContext.refresh()});await page.getByText('Scoped private A · registration',{exact:true}).waitFor();
 ok(await page.evaluate(()=>formsFixture.calls.filter(x=>x.args.p_action==='list').length)===pendingCount+1,label+' equivalent context replaces an invalidated pending read');
 await page.evaluate(()=>formsFixture.scope.release());await page.waitForTimeout(60);
 ok(await page.getByText('Scoped private B · registration',{exact:true}).count()===1,label+' pending-read replacement remains usable after stale completion');
 ok(!await page.locator('.forms-error').innerText(),label+' stale pending read cannot overwrite current status');
 await page.evaluate(()=>{formsFixture.scope.set([]);return ChampionLifeFormsContext.refresh()});
 ok(await page.locator('.forms-list').count()===0,label+' final assignment revocation clears protected list');
 ok(await page.evaluate(()=>formsFixture.calls.every(x=>['context','list'].includes(x.args.p_action))),label+' zero mutation requests throughout scope transition');
 ok(errors.length===0,label+' no runtime errors');
 }catch(e){failures.push(label+': '+e.message);console.error('FAIL '+label+': '+e.message)}finally{await browser.close()}
 }if(failures.length)throw Error(failures.join('\n'));console.log('Forms scoped revocation browser PASS '+checks)}finally{await new Promise(r=>server.close(r))}

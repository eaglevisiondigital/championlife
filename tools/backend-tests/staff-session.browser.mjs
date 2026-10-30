// Real Supabase browser SDK; fictional sessions and fully intercepted local HTTP.
// No actual user, email, token, backend, or provider request.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import * as fixture from './fixtures/outreach-registration-ui.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const sdk=await readFile(path.join(root,'assets/vendor/supabase-js-2.118.0.js'));
assert.equal(createHash('sha256').update(sdk).digest('hex'),'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af');
const origin='https://staff.local.test',backend='https://synthetic-auth.supabase.co',key='sb-synthetic-auth-auth-token';
const evidence=process.env.EVIDENCE_DIR;if(evidence)await mkdir(evidence,{recursive:true});
const identities=[{id:'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',email:'dave@championlifefwb.com'},{id:'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',email:'dave@theboss.biz'}];
const makeSession=user=>{const exp=Math.floor(Date.now()/1000)+3600;return{access_token:[{alg:'HS256',typ:'JWT'},{sub:user.id,exp,aud:'authenticated',role:'authenticated'},'synthetic-signature'].map((x,i)=>i===2?x:Buffer.from(JSON.stringify(x)).toString('base64url')).join('.'),refresh_token:'fictional-refresh-'+user.id,token_type:'bearer',expires_in:3600,expires_at:exp,user:{...user,aud:'authenticated',role:'authenticated',email_confirmed_at:'2026-01-01T00:00:00Z'}}};
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of[390,1440]){
  const ctx=await browser.newContext({viewport:{width,height:1000}}),page=await ctx.newPage(),unexpected=[],errors=[],logoutCalls=[];
  page.on('pageerror',e=>errors.push(e.message));
  await ctx.route('**/*',async route=>{
   const req=route.request(),u=new URL(req.url());
   if(u.origin===backend){
    if(u.pathname==='/auth/v1/logout'&&req.method()==='POST'){logoutCalls.push(u.searchParams.get('scope'));return route.fulfill({status:204,body:''})}
    if(u.pathname.startsWith('/rest/v1/rpc/')&&req.method()==='POST'){
     const payload=req.postDataJSON(),name=u.pathname.split('/').pop();
     const token=req.headers().authorization?.replace('Bearer ','');
     const sessionUser=identities.find(i=>token===makeSession(i).access_token)||identities.find(i=>{try{return JSON.parse(Buffer.from(token.split('.')[1],'base64url').toString()).sub===i.id}catch{return false}});
     if(!sessionUser)return route.fulfill({status:401,json:{message:'No synthetic session'}});
     const permissions=['people.read','followup.read','outreach.view',...(sessionUser.id===identities[1].id?['finance.read']:[])];
     if(name==='staff_workspace_context')return route.fulfill({json:{organizations:[{id:'org',name:'Champion Life · Synthetic preview'}],grants:permissions.map(permission=>({organization_id:'org',permission,department_ids:null}))}});
     if(name==='people_workspace')return route.fulfill({json:payload.p_action==='list'?(payload.p_payload.search==='no-match'?[]:[{id:'11111111-1111-4111-8111-111111111111',first_name:sessionUser.id===identities[0].id?'Church':'Owner',last_name:'Fixture',email:'fixture@example.test',relationships:['volunteer']}]):{person:{first_name:'Synthetic',last_name:'Fixture'},relationships:[]}});
     if(name==='outreach_registration_workspace')return route.fulfill({json:fixture.response(name,payload)});
     if(name==='outreach_partner_workspace')return route.fulfill({json:[]});
    }
    unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort();
   }
   if(u.origin!==origin||req.method()!=='GET'){unexpected.push(req.method()+' '+u.origin+u.pathname);return route.abort()}
   if(u.pathname==='/start'||u.pathname==='/discipleship-login.html')return route.fulfill({contentType:'text/html',body:'<!doctype html><title>Offline staff login</title><h1>Sign in</h1><p>Synthetic local acceptance only.</p>'});
   if(u.pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'synthetic-key-no-authority'})});
   const f=path.resolve(root,'.'+u.pathname);if(!f.startsWith(root))return route.abort();
   try{return route.fulfill({body:await readFile(f),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png'}[path.extname(f)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:'Not found'})}
  });
  await page.goto(origin+'/start');
  await page.evaluate(({key,session})=>{localStorage.setItem(key,JSON.stringify(session));localStorage.setItem('unrelated-setting','preserve');sessionStorage.setItem('unrelated-draft','preserve')},{key,session:makeSession(identities[0])});
  await page.goto(origin+'/staff-people.html');await page.getByText('Church Fixture',{exact:true}).waitFor();
  ok(await page.locator('#staff-session-email').textContent()===identities[0].email,'real SDK current Church email '+engine.name()+' '+width);
  ok(await page.getByRole('button',{name:'Log Out',exact:true}).isVisible(),'visible logout');
  ok(!await page.locator('#financial-outreach-link').isVisible(),'Church fixture has no finance navigation');
  await page.goto(origin+'/staff-outreach-registration.html?campaign='+fixture.campaign);await page.getByText('Household lookup',{exact:true}).waitFor();
  ok(await page.locator('#staff-session-email').textContent()===identities[0].email,'shared registration identity');
  await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-people.html');
  ok(logoutCalls.length===1&&logoutCalls[0]==='local','SDK submits current-session logout only');
  ok(await page.evaluate(key=>localStorage.getItem(key)===null,key),'SDK removes its stored session');
  ok(await page.evaluate(()=>localStorage.getItem('unrelated-setting')==='preserve'&&sessionStorage.getItem('unrelated-draft')==='preserve'),'SDK preserves unrelated local/session storage');
  await page.goBack();await page.getByRole('link',{name:'Sign in to your workspace',exact:true}).waitFor();
  ok(!await page.getByText('Church Fixture',{exact:true}).count(),'browser Back cannot restore protected People data');
  ok(!await page.getByRole('button',{name:'Log Out',exact:true}).isVisible(),'Back cannot restore prior identity header');
  await page.evaluate(({key,session})=>localStorage.setItem(key,JSON.stringify(session)),{key,session:makeSession(identities[1])});
  await page.reload();await page.getByText('Owner Fixture',{exact:true}).waitFor();
  ok(await page.locator('#staff-session-email').textContent()===identities[1].email,'switch to owner session displays owner email');
  ok(!await page.getByText('Church Fixture',{exact:true}).count(),'old account content absent after switch');
  ok(await page.locator('#financial-outreach-link').isVisible(),'new account uses its own permissions');
  ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'account header and content fit viewport');
  if(evidence&&engine.name()==='chromium')await page.screenshot({path:path.join(evidence,'staff-people-'+width+'.png'),fullPage:true});
  await page.getByRole('searchbox',{name:'Search contacts'}).fill('no-match');await page.getByRole('button',{name:'Search',exact:true}).click();await page.getByRole('status').filter({hasText:'No matching contacts.'}).waitFor();
  if(evidence&&engine.name()==='chromium')await page.screenshot({path:path.join(evidence,'staff-empty-'+width+'.png'),fullPage:true});
  await page.goto(origin+'/staff-outreach-partners.html');await page.locator('#staff-session-email').getByText(identities[1].email,{exact:true}).waitFor();
  ok(await page.getByRole('button',{name:'Log Out',exact:true}).isVisible(),'Partner Review shares logout');
  await page.getByRole('button',{name:'Log Out',exact:true}).click();await page.waitForURL('**/discipleship-login.html?next=%2Fstaff-people.html');
  ok(logoutCalls.length===2&&logoutCalls.every(x=>x==='local'),'second account logs out with same supported method');
  ok(errors.length===0,'no browser script errors');ok(unexpected.length===0,'all requests stayed in controlled local fixtures');
  await ctx.close();
 }}finally{await browser.close()}
}
if(evidence)await writeFile(path.join(evidence,'results.json'),JSON.stringify({checks,widths:[390,1440],engines:['Chrome','WebKit'],sdk_sha256:'bee24fc29228ed5a370f76a2ba1ca3c399549edad2fef23453c80148856a49af',sessions:'fictional; actual SDK with stubbed HTTP',production_requests:0},null,2)+'\n');
console.log(checks+' real-SDK staff browser checks passed.');

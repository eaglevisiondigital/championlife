// Run with Playwright installed in the development environment.
const {chromium}=require('playwright');
const fs=require('fs');
const path=require('path');
const assert=require('node:assert/strict');
const root=path.resolve(__dirname,'../..');
(async()=>{
 const browser=await chromium.launch({headless:true});
 const page=await browser.newPage({viewport:{width:1440,height:1000}});
 const errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.route('**/*',async route=>{
   const url=new URL(route.request().url());
   if(url.hostname!=='workspace.test')return route.fulfill({body:''});
   const file=path.join(root,url.pathname);
   if(url.pathname.endsWith('champion-life-auth.js'))return route.fulfill({contentType:'text/javascript',body:`
   window.calls=[]; window.ChampionLifeAuth={getUser:async()=>({id:'staff'}),signOut:async()=>{},client:{auth:{onAuthStateChange(fn){window.changeAccount=fn;}},from(table){let filters={};let result={data:[]};const q={select(){return q},eq(k,v){filters[k]=v;return q},is(){return q},order(){return q},ilike(k,v){window.calls.push([k,v]);return q},range(){return q},then(resolve){
   if(table==='organization_staff_permissions')result.data=[{organization_id:'church',permission:'people.read'},{organization_id:'church',permission:'people.update'},{organization_id:'outreach',permission:'people.read'}];
   if(table==='organizations')result.data=[{id:'church',name:'Champion Life Church'},{id:'outreach',name:'SowGo'}];
   if(table==='organization_people')result.data=[{id:'person',organization_id:filters.organization_id,first_name:filters.organization_id==='church'?'Jane':'Sam',last_name:'Example',email:'sample@example.test',phone:null,updated_at:'2026-01-01'}];
   return Promise.resolve(result).then(resolve);}};return q;}}};`});
   return route.fulfill({body:fs.readFileSync(file),contentType:file.endsWith('.css')?'text/css':file.endsWith('.js')?'text/javascript':'text/html'});
 });
 await page.goto('https://workspace.test/staff-people.html');
 await page.locator('#workspace').waitFor({state:'visible'});
 assert.equal(await page.locator('#view-overview').isVisible(),true);
 await page.locator('.sidebar [data-view="people"]').click();
 await page.getByText('Jane Example',{exact:true}).waitFor();
 await page.locator('#search-query').fill('100%_');await page.locator('#search-form button[type=submit]').click();
 assert.deepEqual(await page.evaluate(()=>window.calls.at(-1)),['last_name','%100\\%\\_%']);
 await page.getByRole('button',{name:'Edit Jane Example',exact:true}).click();
 await page.locator('#cancel').click();
 await page.locator('#organization').selectOption('outreach');
 await page.getByText('Sam Example',{exact:true}).waitFor();
 assert.equal(await page.getByRole('button',{name:'Edit Sam Example',exact:true}).count(),0);
 assert.equal(await page.getByText('Jane Example',{exact:true}).count(),0);
 await page.locator('.sidebar [data-view="modules"]').click();
 assert.equal(await page.locator('.module-card').count(),11);
 await page.locator('.sidebar [data-view="overview"]').click();
 await page.screenshot({path:'/tmp/champion-staff-desktop.png'});
 await page.setViewportSize({width:390,height:844});
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);
 await page.screenshot({path:'/tmp/champion-staff-mobile.png'});
 await page.evaluate(()=>window.changeAccount('SIGNED_OUT',null));
 assert.equal(await page.locator('#workspace').isVisible(),false);
 assert.equal(await page.locator('#people').textContent(),'');
 assert.deepEqual(errors,[]);
 console.log('PASS overview/navigation, search escaping, organization switch, read-only UI, module attribution, mobile width, account-change clearing, no browser errors');
 await browser.close();
})().catch(e=>{console.error(e);process.exitCode=1});

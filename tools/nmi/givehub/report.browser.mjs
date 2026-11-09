import assert from 'node:assert/strict';
import {mkdirSync} from 'node:fs';
import {join} from 'node:path';
import {chromium,webkit} from '../../backend-tests/node_modules/playwright/index.mjs';
import {fixture,authority} from './fixture.mjs';
import {dryRun} from './staging.mjs';
import {html} from './report.mjs';
let checks=0;
for(const[engine,type]of Object.entries({chromium,webkit})){
 const browser=await type.launch({headless:true});try{for(const width of[390,1280]){
 const context=await browser.newContext({viewport:{width,height:900}}),page=await context.newPage(),requests=[],errors=[];
 page.on('pageerror',e=>errors.push(e.message));const report=dryRun(fixture(),authority);report.mappings[0].receipt='<img src="https://untrusted.invalid/" onerror="window.pwned=true">';
 await context.route('**/*',route=>{requests.push(route.request().url());assert.equal(route.request().url(),'https://giving-review.invalid/');return route.fulfill({body:html(report),contentType:'text/html;charset=utf-8'})});
 await page.goto('https://giving-review.invalid/');await page.getByRole('heading',{name:'Giving migration and reconciliation',exact:true}).waitFor();
 for(const text of['Dry-run reconciliation: PASS','Donor identity / consent review','Fund classification / destination review','Statements — preserve, do not resend','Recurring inventory — leave in GiveHub','Five logical routes / four merchant slots']){assert.equal(await page.getByRole('heading',{name:text,exact:true}).count(),1);checks++}
 assert.equal(await page.locator('script,form,input,button').count(),0);checks++;
 assert.equal(await page.evaluate(()=>!!window.pwned),false);checks++;
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);checks++;
 assert.deepEqual(requests,['https://giving-review.invalid/']);checks++;assert.deepEqual(errors,[]);checks++;
 if(process.env.EVIDENCE_DIR){mkdirSync(process.env.EVIDENCE_DIR,{recursive:true});await page.screenshot({path:join(process.env.EVIDENCE_DIR,`report-${engine}-${width}.png`),fullPage:true})}
 console.log('PASS '+engine+'/'+width+' operator report; no network or executable controls');await context.close();
 }}finally{await browser.close()}
}
console.log(JSON.stringify({status:'PASS',checks,providerCalls:0,hosted:false}));

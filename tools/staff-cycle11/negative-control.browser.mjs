// Deterministic observer control, not a reproduction of the historical Auth/unload cause.
import assert from 'node:assert/strict';
import {installInitiation} from './initiation.mjs';
const {webkit}=await import(process.env.PLAYWRIGHT_MODULE||'../backend-tests/node_modules/playwright/index.mjs');
const browser=await webkit.launch(),outcomes=[];let checks=0;
try{
 for(const wrapped of [false,true]){
  const context=await browser.newContext(),page=await context.newPage(),errors=[],failed=[],starts=[];
  page.on('pageerror',e=>errors.push({name:e.name,message:e.message}));page.on('requestfailed',r=>failed.push(r.failure()));
  page.on('console',message=>{if(message.type()==='debug'&&message.text().startsWith('CONTROL '))starts.push(JSON.parse(message.text().slice(8)))});
  if(wrapped)await page.addInitScript({content:`(${installInitiation.toString()})(window,value=>console.debug('CONTROL '+JSON.stringify(value)),()=>({documentId:'control',formsConnected:false}),{a:'a',b:'b'});`});
  await context.route('**/*',route=>route.request().url()==='https://module-cycle8.invalid/control'?route.fulfill({body:'<!doctype html><h1>Fictional control</h1>',contentType:'text/html'}):route.abort('failed'));
  await page.goto('https://module-cycle8.invalid/control');
  const failedEvent=page.waitForEvent('requestfailed'),errorEvent=page.waitForEvent('pageerror');
  // Intentionally unhandled original fetch; no Promise handler is attached by probe or observer.
  await page.evaluate(()=>{window.originalFetchResult=fetch('https://synthetic-modules.supabase.co/auth/v1/user')});
  await Promise.all([failedEvent,errorEvent]);
  assert.equal(errors.length,1);checks++;assert.equal(failed.length,1);checks++;assert.equal(starts.length,wrapped?1:0);checks++;
  outcomes.push({wrapped,errors,failed,starts});await context.close();
 }
 assert.deepEqual(outcomes[0].errors,outcomes[1].errors);checks++;
 console.log(JSON.stringify({status:'PASS',checks,outcomes,qualification:'observer preserves this controlled real-fetch rejection; not original SDK/unload causality'}));
}finally{await browser.close()}

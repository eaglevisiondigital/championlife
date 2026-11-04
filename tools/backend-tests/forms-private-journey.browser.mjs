import assert from 'node:assert/strict';
import {readFileSync,mkdirSync} from 'node:fs';
import {chromium,webkit} from 'playwright';
const asset=n=>readFileSync(new URL('../../assets/js/'+n,import.meta.url),'utf8');
const runtime=process.env.FORMS_RUNTIME?readFileSync(process.env.FORMS_RUNTIME,'utf8'):asset('forms-admin.js');
const css=['forms.css','staff-workspace.css'].map(n=>readFileSync(new URL('../../assets/css/'+n,import.meta.url),'utf8')).join('\n');
let n=0;const ok=(x,label)=>{assert.ok(x,label);n++;};
const out=process.env.FORMS_EVIDENCE_DIR;if(out)mkdirSync(out,{recursive:true});
for(const [engineName,engine] of Object.entries({chromium,webkit}))for(const width of [390,1440]){
 const browser=await engine.launch({headless:true,...(process.env['FORMS_'+engineName.toUpperCase()+'_EXECUTABLE']?{executablePath:process.env['FORMS_'+engineName.toUpperCase()+'_EXECUTABLE']}:{})});
 const page=await browser.newPage({viewport:{width,height:900}});page.setDefaultTimeout(10000);page.on('pageerror',e=>console.error('PAGE ERROR',e));
 await page.route('**/*',r=>r.fulfill({contentType:'text/html',body:`<!doctype html><meta name="viewport" content="width=device-width,initial-scale=1"><style>${css}</style><main id="forms-app" class="forms-app" data-view="builder"></main>`}));
 async function reset(opts={}){
  await page.goto('http://forms.test/staff-form-builder.html?organization=org-a&form=form-a');
  await page.addScriptTag({content:asset('forms-model.js')});await page.addScriptTag({content:asset('forms-renderer.js')});
  await page.evaluate(opts=>{
   window.calls=[];window.currentUser={id:'a'};window.catalogError=opts.catalogError||null;window.held=opts.held||false;window.failSave=false;
   window.per=['forms.read','forms.edit'];if(opts.paymentPermission)per.push('forms.payment.configure');
   const definition=FormsModel.baptismInterest();
   if(opts.financial){definition.sections[0].fields.push({...FormsModel.field('fund'),key:'fund'});definition.payment={enabled:false,allowed_funds:['fund-1'],default_fund:'fund-1'};}
   window.record={form:{id:'form-a',name:'Private baptism draft',type:'registration',status:'draft'},version:{id:'version-a',revision:7,definition},permissions:per};
   window.ChampionLifeAuth={getUser:async()=>currentUser,client:{rpc:async(name,args)=>{
    calls.push(args);if(args.p_action==='funds'){
     if(held)await new Promise(r=>window.release=r);
     if(catalogError)return{error:{code:catalogError,message:'Catalog unavailable'}};
     return{data:{funds:[{id:'fund-1',name:'Approved public fund'}],destinations:[],minor_unit_scale:2}};
    }
    if(args.p_action==='save'){
     if(failSave)return{error:{code:'PT409',message:'conflict'}};
     record={...record,version:{...record.version,revision:record.version.revision+1,definition:args.p_payload.definition}};
    }
    return {data:structuredClone(record)};
   }}};
   window.StaffWorkspace={context:{user:{id:'a'},forms:{organizations:[{id:'org-a',name:'Synthetic Church',permissions:per}]}},refresh:()=>{}};
  },opts);await page.addScriptTag({content:runtime});
 }
 const ready=()=>page.waitForSelector('.forms-library',{state:'attached'});
 await reset({catalogError:'42P01'});
 if(process.env.FORMS_REPRODUCE){await page.waitForTimeout(100);ok(await page.locator('.forms-library').count()===0,'original catalog failure prevents private editor');ok(await page.evaluate(()=>calls.some(x=>x.p_action==='funds')),'original unnecessary funds request reproduced');await browser.close();continue;}
 await ready();ok(await page.evaluate(()=>calls.every(x=>x.p_action!=='funds')),'private editor independent of unavailable catalog');
 await page.evaluate(async()=>{FormsAdmin.add('short_text');await FormsAdmin.save();});
 ok(await page.evaluate(()=>calls.filter(x=>x.p_action==='save').length===1),'private draft successfully saves');
 ok(await page.evaluate(()=>calls.find(x=>x.p_action==='save').p_payload.revision===7),'canonical revision retained');
 ok(await page.evaluate(()=>!FormsAdmin.draft.settings.public_available&&Object.keys(FormsAdmin.draft.payment).length===0),'private and nonfinancial preserved');
 ok(await page.evaluate(()=>calls.every(x=>!['publish','submit'].includes(x.p_action))),'no automatic publication/submission');
 await page.evaluate(async()=>{failSave=true;FormsAdmin.add('short_text');await FormsAdmin.save();});ok(await page.getByText('Conflict — reload required',{exact:true}).count()===1,'failed save explicit conflict');
 // Lazy finance loading keeps ordinary edits usable but does not hide denial.
 await reset();await ready();await page.evaluate(async()=>{await FormsAdmin.add('fund');});
 ok(await page.evaluate(()=>calls.filter(x=>x.p_action==='funds').length===1),'financial field lazily loads existing canonical catalog');
 ok(await page.evaluate(()=>FormsModel.allFields(FormsAdmin.draft).some(f=>f.type==='fund')),'allowed financial field addition retained');
 await reset({catalogError:'42501'});await ready();await page.evaluate(()=>FormsAdmin.add('fund'));await page.waitForFunction(()=>document.body.textContent.includes('no longer available'));
 ok(await page.locator('.forms-library').count()===0,'explicit catalog denial removes editor');
 await page.evaluate(async()=>{await FormsAdmin.add('fund');await FormsAdmin.save();});ok(await page.evaluate(()=>calls.filter(x=>x.p_action==='funds').length===1&&calls.every(x=>x.p_action!=='save')),'retained calls after denial issue no mutations/catalog');
 await reset({catalogError:'42P01'});await ready();await page.evaluate(()=>FormsAdmin.add('fund'));await page.waitForFunction(()=>document.body.textContent.includes('Catalog unavailable'));
 ok(await page.evaluate(()=>FormsModel.allFields(FormsAdmin.draft).every(f=>f.type!=='fund')),'temporary catalog failure does not add incomplete financial field');
 ok(await page.locator('.forms-library').count()===1,'temporary failure retains authorized editor');
 await reset({financial:true});await ready();ok(await page.evaluate(()=>calls.filter(x=>x.p_action==='funds').length===1),'existing financial definition loads catalog');
 await page.evaluate(async()=>{FormsAdmin.add('short_text');await FormsAdmin.save();});ok(await page.evaluate(()=>calls.find(x=>x.p_action==='save').p_payload.definition.payment.allowed_funds[0]==='fund-1'),'existing configured fund preserved through save');
 await reset({paymentPermission:true});await ready();ok(await page.evaluate(()=>calls.some(x=>x.p_action==='funds')),'authorized payment configuration retains catalog');
 await reset({financial:true,catalogError:'42P01'});await page.waitForFunction(()=>document.body.textContent.includes('Catalog unavailable'));ok(await page.locator('.forms-library').count()===0,'financial form fails closed without required catalog');ok(await page.evaluate(()=>FormsAdmin.draft.payment.allowed_funds[0]==='fund-1'&&calls.every(x=>x.p_action!=='save')),'catalog error does not zero or save existing funds');
 for(const change of ['missed-account','logout','organization','auth-replaced','client-replaced','new-generation','missed-account-error']){
  await reset({held:true});await ready();await page.evaluate(()=>{FormsAdmin.add('fund');FormsAdmin.add('fund');});await page.waitForFunction(()=>!!window.release);
  await page.evaluate(change=>{if(change==='missed-account')currentUser={id:'b'};if(change==='missed-account-error'){currentUser={id:'b'};catalogError='42P01';}if(change==='auth-replaced')ChampionLifeAuth={...ChampionLifeAuth};if(change==='client-replaced')ChampionLifeAuth.client={...ChampionLifeAuth.client};if(change==='logout')StaffWorkspace.context={user:null,forms:{organizations:[]}};if(change==='organization')StaffWorkspace.context={user:{id:'a'},forms:{organizations:[{id:'other-org',permissions:per}]}};if(change==='new-generation'){per=[...per,'forms.archive'];StaffWorkspace.context.forms.organizations[0].permissions=per;record.permissions=per;}if(['logout','organization','new-generation'].includes(change))dispatchEvent(new CustomEvent('staff-workspace-context',{detail:StaffWorkspace.context}));release();},change);
  await page.waitForTimeout(50);
  ok(await page.evaluate(()=>!FormsAdmin.draft||FormsModel.allFields(FormsAdmin.draft).every(f=>f.type!=='fund')),change+' old lazy response cannot add field');
  ok(await page.evaluate(()=>calls.every(x=>x.p_action!=='save')&&calls.filter(x=>x.p_action==='funds').length===1),change+' no new mutation or duplicate request');
 }
 await reset();await ready();ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),'responsive private editor width');if(out)await page.screenshot({path:`${out}/private-editor-${engineName}-${width}.png`,fullPage:true});
 console.log(`${engineName} ${width} passed`);await browser.close();
}
console.log(`Forms private journey PASS ${n} assertions`);

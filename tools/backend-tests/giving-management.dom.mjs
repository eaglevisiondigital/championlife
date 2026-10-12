import assert from 'node:assert/strict';import {JSDOM,VirtualConsole}from 'jsdom';import {readFileSync}from 'node:fs';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8'),tick=()=>new Promise(r=>setTimeout(r,35));let n=0;const ok=(v,m)=>{assert.ok(v,m);n++;console.log('PASS '+m)};
const views=['overview','gifts','gift','manual','funds','pledges','pledge','recurring','recurringdetail','batches','batch','merchants','donors','donor'];
async function page(view='overview',permissions,prepare){const errors=[],vc=new VirtualConsole();vc.on('jsdomError',e=>errors.push(e.message));const dom=new JSDOM(read('staff-giving-'+view+'.html'),{url:'https://preview.example/staff-giving-'+view+'.html?id=74000000-0000-4000-8000-000000000091',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc}),w=dom.window;w.matchMedia=()=>({matches:false});w.setInterval=()=>1;w.HTMLDialogElement.prototype.showModal=function(){this.setAttribute('open','')};w.HTMLDialogElement.prototype.close=function(){this.removeAttribute('open');this.dispatchEvent(new w.Event('close'));};for(const p of['tools/backend-tests/fixtures/giving-browser-fixture.js','assets/js/outreach-staff-common.js','assets/js/staff-workspace.js','assets/js/giving-utils.js','assets/js/giving-management-utils.js'])w.eval(read(p));if(permissions)w.givingFixture.permissions=permissions;if(prepare)prepare(w.givingFixture,w);w.eval(read('assets/js/giving-management.js'));await tick();return{w,d:w.document,g:w.givingFixture,errors,close:()=>w.close()};}
const click=(h,text)=>{const b=[...h.d.querySelectorAll('button')].find(b=>b.textContent===text);assert(b,'button '+text);b.click();},input=(h,name,value,form=h.d)=>{const c=form.querySelector('[name='+name+']');assert(c,'input '+name);c.value=value;c.dispatchEvent(new h.w.Event('input',{bubbles:true}));return c;};
for(const view of views){const h=await page(view);ok(h.d.querySelectorAll('.staff-sidebar').length===1,view+' shared Staff Workspace shell');ok(h.d.querySelector('#giving-app h1'),view+' readable headline');ok(!h.d.querySelector('#giving-app').textContent.includes('Checking finance'),view+' loading clears');ok(h.d.querySelector('.staff-sidebar-foot img').alt==='Kingdom Propel by EagleVision',view+' approved platform attribution');for(const control of h.d.querySelectorAll('input,select,textarea'))ok(control.closest('label'),view+' labeled '+control.name);for(const table of h.d.querySelectorAll('table'))ok(table.closest('.giving-table-wrap')?.tabIndex===0,view+' keyboard scrollable table');ok(!h.d.querySelector('input[type=password]'),view+' no credential fields');ok(h.errors.length===0,view+' no console error');h.close();}
{
const h=await page();ok(h.g.calls.find(c=>c.args.p_action==='dashboard').args.p_payload.period==='today','Today default sent');ok(h.d.body.textContent.includes('Today by Fund'),'Today by Fund above reports');const expand=h.d.querySelector('button[aria-controls=children-parent]');ok(expand.getAttribute('aria-expanded')==='false','parent initially collapsed');expand.click();ok(expand.getAttribute('aria-expanded')==='true'&&!h.d.querySelector('#children-parent').hidden,'native button expands children');ok(h.d.body.textContent.includes('USD 575.00'),'parent totals children exactly');ok([...h.d.querySelectorAll('a[href*=staff-giving-funds]')].some(a=>a.textContent==='View All Funds'),'View All Funds link');click(h,'Week');await tick();ok(h.g.calls.some(c=>c.args.p_action==='dashboard'&&c.args.p_payload.period==='week'),'quick period applies canonical payload');ok(h.d.body.textContent.includes('Week by Fund')&&h.d.body.textContent.includes('USD 1,750.00'),'period switches metrics and funds together');click(h,'Custom');input(h,'starts_on','2026-10-01');input(h,'ends_on','2026-10-02');h.d.querySelector('form').requestSubmit();await tick();ok(h.g.calls.some(c=>c.args.p_action==='dashboard'&&c.args.p_payload.starts_on==='2026-10-01'&&c.args.p_payload.ends_on==='2026-10-02'),'custom dates sent as org-local inclusive dates');h.close();
}
{
const h=await page('overview',['finance.reports.read']);ok(h.d.querySelector('.giving-metrics'),'reports-only leadership sees dashboard');ok(!h.d.querySelector('[data-capability=financemerchants]')&&!h.d.querySelector('a[href*=staff-giving-manual]'),'reports-only no merchant/posting controls');ok(h.d.querySelector('a[href*=staff-giving-reports]'),'approved GIV-2B reports nav available to reports-only role');h.close();
}
{
const h=await page('gifts');input(h,'search','Ada');input(h,'donor_search','Ada');input(h,'min','25.01');input(h,'gateway_id','gateway-1');input(h,'parent_id','parent');h.d.querySelector('form').requestSubmit();await tick();const c=h.g.calls.filter(c=>c.args.p_action==='gift_list').at(-1);ok(c.args.p_payload.min_minor==='2501'&&c.args.p_payload.gateway_id==='gateway-1'&&c.args.p_payload.parent_id==='parent'&&c.args.p_payload.search==='Ada'&&c.args.p_payload.donor_search==='Ada','gift filters exact server payload');ok(h.d.body.textContent.includes('Foreign Missions')&&h.d.body.textContent.includes('Synthetic check 1001')===false,'safe gift list contribution fields');h.close();
}
{
const h=await page('manual',['finance.gifts.create']);ok(h.g.calls.some(c=>c.args.p_action==='manual_options')&&!h.g.calls.some(c=>c.args.p_action==='merchants'),'narrow entry options without merchant read');ok(h.d.querySelector('[data-capability=financeentryonly]'),'entry-only operator retains a finance destination');const form=h.d.querySelector('form');input(h,'amount','100.25',form);input(h,'payment_method','check',form);input(h,'external_reference','Synthetic 1001',form);form.requestSubmit();await tick();ok(h.d.querySelector('dialog[open]')&&h.d.activeElement.textContent==='Cancel','safe initial confirmation focus');click(h,'Cancel');ok(h.d.activeElement===form.querySelector('button[type=submit]'),'Cancel returns focus');ok(!h.g.calls.some(c=>c.args.p_action==='manual'),'Cancel creates no record');form.requestSubmit();await tick();h.g.failAction='manual';click(h,'Confirm record');await tick();click(h,'Confirm record');await tick();const attempts=h.g.calls.filter(c=>c.args.p_action==='manual');ok(attempts.length===2&&attempts[0].args.p_payload.request_key===attempts[1].args.p_payload.request_key,'retry stable idempotency');ok(attempts[0].args.p_payload.amount_minor==='10025'&&attempts[0].args.p_payload.gift_local,'manual exact amount/local time');h.close();
}
{
const h=await page('manual');input(h,'row_amount','25');input(h,'expected_total','25');const rapid=h.d.querySelector('[name=expected_total]').closest('form');rapid.requestSubmit();await tick();ok(h.d.querySelector('dialog').textContent.includes('USD 25.00'),'rapid reviewed row total');click(h,'Confirm record');await tick();const c=h.g.calls.find(c=>c.args.p_action==='rapid_post');ok(c.args.p_payload.rows.length===1&&c.args.p_payload.expected_minor==='2500'&&c.args.p_payload.rows[0].request_key,'rapid atomic balance and row keys');h.close();
}
{
const h=await page('donor');input(h,'household','household').dispatchEvent(new h.w.Event('change'));await tick();ok(h.g.calls.some(c=>c.args.p_action==='donor_detail'&&c.args.p_payload.household_id==='household'),'household rollup requested with explicit membership');ok(h.d.body.textContent.includes('individual donor lineage'),'household lineage explanation');h.close();
}
{
const h=await page('funds');click(h,'Edit Missions');await tick();ok(h.d.querySelector('[name=accounting_code]')&&h.d.querySelector('[name=tax_eligible]')&&h.d.querySelector('[name=parent_id]'),'fund editor required management fields');ok(h.d.body.textContent.includes('Move up')&&h.d.body.textContent.includes('Archive Missions'),'accessible reorder/archive controls');h.close();
}
{
const h=await page('recurring');click(h,'Add another fund');const form=h.d.querySelector('form');input(h,'amount','200',form);input(h,'starts_on','2026-10-10',form);input(h,'next_run_at','2026-11-01T09:00',form);input(h,'extra_amount','25',form);form.requestSubmit();await tick();click(h,'Confirm record');await tick();const c=h.g.calls.find(c=>c.args.p_action==='recurring_draft');ok(c.args.p_payload.lines.length===2&&c.args.p_payload.lines[1].amount_minor==='2500'&&c.args.p_payload.next_local==='2026-11-01T09:00','multi-fund recurring one draft and org-local run time');h.close();
}
for(const view of ['overview','gifts','donors','merchants']){const h=await page(view);h.g.deny=true;h.w.dispatchEvent(new h.w.Event('focus'));await tick();ok(h.d.querySelector('#giving-app .staff-state')&&!h.d.querySelector('[data-group=giving]'),view+' current-session revoke clears content/navigation');h.close();}
{
const h=await page('overview',undefined,g=>{g.data.dashboard.funds[0].direct_minor='99';});ok(h.d.querySelector('.staff-state')&&!h.d.querySelector('.giving-fund-total'),'mismatched fund totals fail closed rather than display partial dashboard');h.close();
}
{const h=await page('donor',undefined,g=>{g.data.donor_detail.recurring=[{id:'active',currency:'USD',status:'active'},{id:'cancelled',currency:'USD',status:'cancelled'},{id:'foreign',currency:'CAD',status:'active'}];g.data.donor_detail.recurring_lines=[{instruction_id:'active',amount_minor:'1234'},{instruction_id:'cancelled',amount_minor:'99999'},{instruction_id:'foreign',amount_minor:'55555'}];});ok(h.d.querySelector('.giving-metrics').textContent.includes('USD 12.34'),'donor recurring total excludes cancelled and other currencies');h.close();}
{const h=await page('merchants');ok(h.d.body.textContent.includes('Synthetic Authorize.Net')&&h.d.body.textContent.includes('A single merchant route can receive many fund designations.')&&h.d.body.textContent.includes('Youth MID'),'single merchant and multi-MID multiple-gateway layout');h.close();}
{
let release;
const h=await page('gifts',undefined,(g,w)=>{
 const rpc=w.ChampionLifeAuth.client.rpc;
 w.ChampionLifeAuth.client.rpc=async(name,args={})=>{
  if(name==='giving_workspace'&&args.p_action==='gift_list')await new Promise(r=>release=r);
  return rpc(name,args);
 };
});
ok(Boolean(release),'in-flight gift read is held for refresh race');
h.w.dispatchEvent(new h.w.Event('focus'));await tick();release();await tick();
ok(h.d.querySelector('#giving-app').textContent.includes('Foreign Missions')&&!h.d.querySelector('.giving-error'),'unchanged permission refresh preserves in-flight finance read');h.close();
}
{
let release;
const h=await page('gifts',undefined,(g,w)=>{
 const rpc=w.ChampionLifeAuth.client.rpc;
 w.ChampionLifeAuth.client.rpc=async(name,args={})=>{
  if(name==='giving_workspace'&&args.p_action==='gift_list')await new Promise(r=>release=r);
  return rpc(name,args);
 };
});
h.g.deny=true;h.w.dispatchEvent(new h.w.Event('focus'));await tick();release();await tick();
ok(h.d.querySelector('#giving-app .staff-state')&&!h.d.querySelector('#giving-app table'),'permission revocation during in-flight read keeps protected content cleared');h.close();
}
const css=read('assets/css/giving.css');ok(css.includes('repeat(4,minmax(0,1fr))')&&css.includes('@media(max-width:768px)')&&css.includes('@media(max-width:450px)'),'responsive scoped metric grid breakpoints');ok(css.includes('overscroll-behavior-inline:contain'),'safe narrow table scroll');
console.log(n+' GIV-2A DOM/UX checks passed');

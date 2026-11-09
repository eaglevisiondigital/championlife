// Executes ONLY the existing disposable Unix-socket PostgreSQL helper. No connection input.
import assert from 'node:assert/strict';import {randomUUID} from 'node:crypto';import {readFileSync} from 'node:fs';import {pathToFileURL} from 'node:url';
import {verifiedDurableSources,pinnedFinancialFixtures} from '../durable-source.mjs';import {localPostgres} from '../../backend-tests/local-postgres.mjs';
import {historyFixture,authority} from './history-fixture.mjs';import {historyPlan} from './history-plan.mjs';import {dryRun} from './staging.mjs';
export async function runHistoryDemo({adversarial=false}={}){
 const source=verifiedDurableSources(),{f,fixtureSQL}=await pinnedFinancialFixtures(source),db=await localPostgres();let checks=0;
 const ok=(v,m)=>{assert(v,m);checks++;console.log('PASS '+m)};
 const call=async(type,p,actor=f.admin,org=f.org)=>{const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);if(type==='import')await c.query('set local role authenticated');const r=(await c.query(type==='import'?"select giving_workspace('import',$1,$2) v":'select private.giving_import_history($1,$2) v',[org,p])).rows[0].v;await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{await c.end()}};
 try{
  for(const row of source.filter(r=>r.kind!=='fixture-module')){await db.exec(row.sql);if(row.kind==='local-bootstrap')await db.exec('create schema if not exists storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;');}
  await db.exec(fixtureSQL);await db.exec(readFileSync(new URL('./history.sql',import.meta.url),'utf8'));
  const b=historyFixture(); // Keep the report's fictional recipients; map explicitly to local canonical org fixture.
  // This demo executes the Church and Merchandise subset. SowGo stays separately reconciled, never merged.
  const church=b.funds[0].recipient_organization_id;
  const bundle=structuredClone(b);for(const name of ['funds','donors','transactions','statements','recurring'])bundle[name]=bundle[name].filter(r=>r.recipient_organization_id===church).map(r=>({...r,recipient_organization_id:f.org}));
  bundle.control_totals=bundle.control_totals.filter(r=>r.recipient===church).map(r=>({...r,recipient:f.org}));
  bundle.funds=bundle.funds.map(r=>({...r,canonical_fund_id:r.source_fund_id==='Church'?f.mainFund:f.anFund}));
  const auth={...authority,organizations:[f.org]},bindings=bundle.funds.map(r=>({account:r.source_account_reference,organization:f.org,sourceDonor:'Donor0',sourceFund:r.source_fund_id,fundId:r.canonical_fund_id,batchId:f.batch,personId:f.person,reviewed:true,reviewReference:'FictionalIndependentFinanceReview'}));
  const report=dryRun(bundle,auth),plan=historyPlan(bundle,auth,bindings);ok(plan.status==='PASS','source control and historical plan PASS');
  const originals=new Map(),receipts=[];
  for(const op of plan.operations){const p=op.type==='original'?op.payload:{...op.payload,original_id:originals.get(op.originalSource)};const r=await call(op.type==='original'?'import':'history',p);if(op.type==='original')originals.set(op.source,r.id);receipts.push({source:op.source,type:op.type,payload:p,result:r});}
  const total=(await db.query('select sum(amount_minor)::text net, sum(amount_minor) filter(where tax_eligible)::text tax, sum(amount_minor) filter(where not tax_eligible)::text nontax from giving_ledger')).rows[0];
  ok(total.net==='7250'&&total.tax==='7250'&&total.nontax==='0','canonical net/tax totals reflect multiple partial refunds, full refund and two corrections');
  const count=(await db.query('select count(*)::int n from giving_ledger')).rows[0].n;
  for(const r of receipts)await call(r.type==='original'?'import':'history',r.payload);
  ok((await db.query('select count(*)::int n from giving_ledger')).rows[0].n===count,'entire import replay adds zero gifts or corrections');
  const correction=receipts.find(r=>r.type==='history');
  const duplicate=await call('history',{...correction.payload,request_key:randomUUID()});ok(duplicate.id===correction.result.id,'source replay with a new request key returns exact original receipt');
  ok((await db.query("select count(*)::int n from giving_audit where action='gift.historical_import'")).rows[0].n===5,'exactly one canonical audit per historical correction');
  ok((await db.query("select count(*)::int n from giving_requests where operation='historical_correction' and payload->>'statement_reference'='Statement0' and payload->>'statement_archive_sha256'=$1",['a'.repeat(64)])).rows[0].n===5,'immutable request receipts retain original statement/archive references');
  ok((await db.query("select count(*)::int n from giving_ledger where kind='gift' and amount_minor in(10000,3000) and source='import'")).rows[0].n===2,'original gift values and imported source IDs preserved');
  ok((await db.query("select count(*)::int n from giving_ledger where source='historical_import' and (leg_id is not null or session_id is not null)")).rows[0].n===0,'no provider leg or session fabricated');
  const historyRows=(await db.query("select external_transaction_id source,kind,amount_minor::text amount,currency,tax_eligible,receipt_history_reference receipt from giving_ledger order by gift_at,id")).rows;
  report.blockers=report.blockers.map(x=>x==='HISTORICAL_REFUND_AND_MULTI_CORRECTION_IMPORT_CONTRACT_REQUIRED'?'HISTORICAL_CONTRACT_LOCAL_ONLY_TARGET_ACCEPTANCE_REQUIRED':x);
  report.mappings=report.mappings.map(x=>({...x,canonicalBoundary:x.canonicalBoundary.includes('refund')||x.canonicalBoundary.includes('adjust')?'private.giving_import_history: LOCAL ONLY; hosted execution held':x.canonicalBoundary}));
  report.canonicalHistory={status:'PASS',mode:'DISPOSABLE_LOCAL_POSTGRES_ONLY',providerOperations:0,canExecuteHosted:false,originals:2,corrections:5,replayAdded:0,net:total.net,tax:total.tax,nonTax:total.nontax,rows:historyRows,statementsPreserved:true,held:['REAL_EXPORT_MAPPING','REAL_PERSON_MAPPING','TARGET_INSTALLATION_AND_GENUINE_AUTH','OWNER_PILOT_AUTHORIZATION']};
  if(adversarial){
   const next={...correction.payload,request_key:randomUUID(),source_transaction_id:'NextSynthetic',kind:'correction',direction:'increase',amount_minor:'100',expected_balance_minor:'7250',occurred_at:'2025-12-20T18:00:00Z'};
   const deny=async(p,m,actor=f.admin,org=f.org)=>{const before=(await db.query('select count(*)::int n from giving_ledger')).rows[0].n;await assert.rejects(()=>call('history',p,actor,org));ok((await db.query('select count(*)::int n from giving_ledger')).rows[0].n===before,m);};
   for(const [field,value]of [['person_id',f.secondPerson],['fund_id',f.youthFund],['currency','EUR'],['source_system','GiveHub:Other'],['original_source_transaction_id','Unknown'],['tax_eligible',false],['direction',null],['amount_minor','1.2'],['statement_archive_sha256',null]])await deny({...next,[field]:value},'reject '+field+' drift atomically');
   await deny(next,'ordinary worker denied',f.ordinary);await deny(next,'finance reader cannot import history',f.reader);await deny(next,'cross-recipient denied',f.admin,f.other);
   await deny({...next,expected_balance_minor:'10000'},'stale balance denied');await deny({...next,kind:'refund',direction:'decrease',amount_minor:'7251'},'overrefund denied');
   await deny({...correction.payload,amount_minor:'1'},'changed request key payload denied');await deny({...correction.payload,request_key:randomUUID(),amount_minor:'1'},'changed source content denied');
   await deny({...next,source_transaction_id:'Gift1'},'correction cannot reuse original source ID');
   const originalReceipt=receipts.find(r=>r.type==='original');
   await assert.rejects(()=>call('import',{...originalReceipt.payload,request_key:randomUUID(),external_transaction_id:correction.payload.source_transaction_id,external_reference:correction.payload.source_transaction_id}));ok(true,'existing canonical import cannot reuse historical correction source ID');
   const positive=receipts.find(r=>r.type==='history'&&r.payload.direction==='increase');
   const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[f.admin]);await c.query('set local role authenticated');await assert.rejects(()=>c.query("select giving_workspace('adjust',$1,$2)",[f.org,{request_key:randomUUID(),id:positive.result.id,reason:'Fictional incompatible descendant',replacement_minor:'600'}]));await c.query('rollback');ok(true,'ordinary adjust cannot create uncounted historical descendants');}finally{await c.end()}
   await deny({...next,occurred_at:'2025-12-14T18:00:00.000Z'},'equal historical instant held at SQL boundary');
   await deny({...next,occurred_at:'2025-12-12T18:00:00Z'},'out-of-order correction held at SQL boundary');
   const a=await Promise.allSettled([call('history',next),call('history',{...next,request_key:randomUUID()})]);ok(a.every(x=>x.status==='fulfilled')&&a[0].value.id===a[1].value.id,'concurrent source replay serializes to one append');
   const race={...next,request_key:randomUUID(),source_transaction_id:'Race1',expected_balance_minor:'7350',occurred_at:'2025-12-21T18:00:00Z'};
   const raced=await Promise.allSettled([call('history',race),call('history',{...race,request_key:randomUUID(),source_transaction_id:'Race2'})]);ok(raced.filter(x=>x.status==='fulfilled').length===1,'concurrent distinct corrections require fresh balance');
   await db.exec(`delete from organization_staff_permissions where user_id='${f.admin}' and permission='finance.gifts.adjust'`);await deny(correction.payload,'revoked authority denies even receipt replay');await db.exec(`insert into organization_staff_permissions(organization_id,user_id,permission) values('${f.org}','${f.admin}','finance.gifts.adjust')`);
   await db.exec(`create function private.fail_history_audit() returns trigger language plpgsql as $$begin if new.action='gift.historical_import' then raise exception 'fictional audit failure';end if;return new;end$$; create trigger test_history_audit before insert on giving_audit for each row execute function private.fail_history_audit();`);
   await deny({...next,request_key:randomUUID(),source_transaction_id:'AuditRollback',expected_balance_minor:'7450',occurred_at:'2025-12-22T18:00:00Z'},'audit failure rolls back ledger and receipt');await db.exec('drop trigger test_history_audit on giving_audit');
   await assert.rejects(()=>db.exec(`update giving_ledger set amount_minor=1 where id='${correction.result.id}'`));ok(true,'historical ledger remains immutable');
   await assert.rejects(()=>db.exec("delete from giving_requests where operation='historical_correction'"));ok(true,'source receipts remain immutable');
   ok((await db.query("select has_function_privilege('authenticated','private.giving_import_history(uuid,jsonb)','execute') a,has_function_privilege('anon','private.giving_import_history(uuid,jsonb)','execute') b,has_function_privilege('service_role','private.giving_import_history(uuid,jsonb)','execute') c")).rows.every(r=>!r.a&&!r.b&&!r.c),'no browser or service-role execution grant');
  }
  ok((await db.query('select count(*)::int n from giving_provider_events')).rows[0].n===0,'no provider events');ok((await db.query('select count(*)::int n from giving_recurring_instructions')).rows[0].n===0,'no recurring activation');
  console.log(JSON.stringify({status:'PASS',checks,hosted:false,release:'HOLD'}));return{report,checks};
 }finally{await db.close()}
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href)await runHistoryDemo({adversarial:true});

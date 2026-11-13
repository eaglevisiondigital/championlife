import test from 'node:test';
import assert from 'node:assert/strict';
import {dryRun,digest,importProjection} from './staging.mjs';
import {fixture,authority,organizations} from './fixture.mjs';
import {html} from './report.mjs';
const run=(b=fixture(),p=null)=>dryRun(b,authority,p),mutate=fn=>{const b=fixture();fn(b);return b};
test('connected synthetic review preserves exact totals, noncontributions, refunds and statement history',()=>{
 const r=run();assert.equal(r.localReconciliation,'PASS');assert.equal(r.groups.find(x=>x.fund==='Church').gross,'10000');assert.equal(r.groups.find(x=>x.fund==='Church').refunds,'2000');assert.equal(r.groups.find(x=>x.fund==='Church').adjustments,'500');assert.equal(r.groups.find(x=>x.fund==='Merch').noncontribution,'3000');assert(r.statements.every(s=>s.status==='PASS'&&s.doNotResend));assert.deepEqual(r.statements[0].original,fixture().statements[0]);assert(r.routes.every(x=>x.canSubmit===false));assert(r.recurring.every(x=>x.canActivate===false&&x.transition==='hold_in_GiveHub'));assert.equal(r.release,'HOLD');assert.equal(r.canPostLedger,false);
});
test('idempotent replay retains five distinct staged records and zero new gifts',()=>{const a=run(),b=run(fixture(),a.snapshot);assert.equal(b.counts.added,0);assert.equal(b.counts.replayed,5);assert.deepEqual(b.groups,a.groups);assert.equal(b.snapshot.digest,a.snapshot.digest)});
test('same-key same-content duplicate is deduplicated; changed content excludes key',()=>{
 const b=fixture();b.transactions.push(structuredClone(b.transactions[0]));assert.equal(run(b).counts.distinct,5);b.transactions.at(-1).amount_minor='9000';const r=run(b);assert(r.exceptions.some(e=>e.code==='CONFLICTING_SOURCE_KEY'));assert(!r.snapshot.records.some(x=>x.source_transaction_id==='Gift1'));
});
for(const [label,fn,code]of[
 ['missing transaction identity',b=>delete b.transactions[0].source_transaction_id,'MISSING_ID'],
 ['floating money',b=>b.transactions[0].amount_minor=10.25,'INVALID_MONEY_OR_CURRENCY'],
 ['negative gift',b=>b.transactions[0].amount_minor='-1','INVALID_MONEY_OR_CURRENCY'],
 ['zero gift',b=>b.transactions[0].amount_minor='0','ZERO_GIFT'],
 ['missing timezone',b=>b.transactions[0].source_timezone=null,'MISSING_TIMEZONE'],
 ['invalid calendar date',b=>b.transactions[0].received_at_utc='2025-02-30T12:00:00Z','INVALID_TIMESTAMP'],
 ['missing donor',b=>b.donors=[],'DONOR_MAPPING_HELD'],
 ['ambiguous fund',b=>b.funds.push({...b.funds[0]}),'FUND_MAPPING_HELD'],
 ['missing tax evidence',b=>b.funds[0].tax_classification_evidence=null,'FUND_MAPPING_HELD'],
 ['foreign correction fund',b=>b.transactions[3].source_fund_id='Merch','CORRECTION_PARENT_MISMATCH'],
 ['over refund',b=>b.transactions[3].correction_amount_minor_or_null='999999','CORRECTIONS_EXCEED_GROSS'],
 ['ambiguous adjustment',b=>delete b.transactions[4].adjustment_direction,'AMBIGUOUS_ADJUSTMENT'],
 ['unknown status',b=>b.transactions[0].status='approved','UNMAPPED_STATUS'],
 ['fee/net mismatch',b=>Object.assign(b.transactions[0],{processor_fee_minor_or_null:'100',net_minor_or_null:'100'}),'FEE_NET_MISMATCH'],
 ['raw payment token',b=>b.transactions[0].vault_token='PROHIBITED','UNSUPPORTED_TRANSACTION_FIELDS']
])test(label+' holds rather than silently altering financial data',()=>{const r=run(mutate(fn));assert.equal(r.localReconciliation,'HOLD');assert(r.exceptions.some(e=>e.code===code),JSON.stringify(r.exceptions));assert.equal(r.canCharge,false)});
test('authority is external to input; absent/revoked/wrong-org denied before producing report',()=>{for(const a of[null,{...authority,current:false},{...authority,permissions:['outreach.view']},{...authority,organizations:[organizations[0]]}])assert.throws(()=>dryRun(fixture(),a),/FINANCIAL/)});
test('prior snapshot cannot bypass scope or mappings',()=>{const r=run();const b=fixture();b.funds=[];assert.equal(run(b,r.snapshot).localReconciliation,'HOLD');r.snapshot.records[0].amount_minor='99';assert.throws(()=>run(fixture(),r.snapshot),/INVALID_STAGING/)});
test('recurring unknown next date and duplicate schedules remain held',()=>{for(const fn of[b=>b.recurring[0].next_charge_at_or_null=null,b=>b.recurring.push({...b.recurring[0]})]){const r=run(mutate(fn));assert.equal(r.localReconciliation,'HOLD');assert(r.recurring.some(x=>!x.inventoryValid));assert(r.recurring.every(x=>!x.canActivate))}});
test('statement disagreement held, original classification/version preserved',()=>{const b=fixture();b.statements[0].contribution_minor='999';b.statements[0].version=2;const r=run(b);assert.equal(r.statements[0].status,'HOLD');assert.equal(r.statements[0].original.contribution_minor,'999');assert.equal(r.statements[0].sourceVersion,2)});
test('same source ID in different recipient/account never merges',()=>{const b=fixture();b.transactions[1].source_transaction_id='Gift1';const r=run(b);assert.equal(r.counts.distinct,5);assert.equal(r.groups.find(x=>x.fund==='SoulFuel').gross,'2500')});
test('calendar year respects provided source timezone',()=>{const b=fixture();b.transactions[1].received_at_utc='2026-01-01T01:00:00Z';assert.equal(run(b).groups.find(x=>x.fund==='SoulFuel').year,'2025')});
test('review-only canonical projection needs verified Person and refuses corrections/UNKNOWN',()=>{const b=fixture(),m={fundId:b.funds[0].canonical_fund_id,batchId:'66666666-6666-4666-8666-666666666666'};assert.throws(()=>importProjection(b.transactions[0],m),/VERIFIED_PERSON/);const p=importProjection(b.transactions[0],{...m,personId:'77777777-7777-4777-8777-777777777777',identityReviewed:true});assert.equal(p.canPost,false);assert.equal(p.payload.source_system,'GiveHub:SyntheticAccount0');assert.equal(p.payload.payment_method,'external');assert.throws(()=>importProjection(b.transactions[3],m),/NOT_SUPPORTED/)});
test('HTML report escapes untrusted references and cannot execute script or submit',()=>{const r=run();r.mappings[0].receipt='<script>fetch("https://example.test")</script>';const out=html(r);assert(!out.includes('<script>'));assert(out.includes('&lt;script&gt;'));assert(out.includes("form-action &#39;none&#39;")||out.includes("form-action 'none'"));assert(!out.includes('<form'))});
test('source export control count or amount disagreement is HOLD',()=>{for(const fn of[b=>b.control_totals[0].gifts=99,b=>b.control_totals[0].gross='10001',b=>b.control_totals=[]]){const r=run(mutate(fn));assert.equal(r.localReconciliation,'HOLD');assert(r.sourceControlReviews.some(c=>c.status==='HOLD'))}});
test('no implicit settlement of pending/failed/UNKNOWN records',()=>{for(const status of['pending','failed','unknown']){const b=fixture();b.transactions[1].status=status;const r=run(b);assert.equal(r.localReconciliation,'HOLD');assert(r.exceptions.some(e=>e.code==='NOT_CONFIRMED_GIFT'));assert.equal(r.canPostLedger,false)}});
test('missing statement archive and duplicate statement identity hold without reissue',()=>{for(const fn of[b=>b.statements[0].private_archive_sha256=null,b=>b.statements.push({...b.statements[0]}),b=>b.transactions[0].source_statement_reference_or_null='MissingStatement']){const r=run(mutate(fn));assert.equal(r.localReconciliation,'HOLD');assert(r.statements.every(s=>s.doNotResend))}});
test('future observation or unmapped recurrence cannot be marked valid',()=>{for(const fn of[b=>b.recurring[0].frequency='invented',b=>b.recurring[0].inventory_observed_at='2099-01-01T00:00:00Z']){const r=run(mutate(fn));assert.equal(r.recurring[0].inventoryValid,false);assert.equal(r.localReconciliation,'HOLD')}});

test('reconciliation scope alone cannot reveal gift mappings',()=>{assert.throws(()=>dryRun(fixture(),{...authority,permissions:['finance.read','finance.reconciliation.read']}),/FINANCIAL_ACCESS_DENIED/)});
test('conflicting principal and correction amounts are held',()=>{const b=fixture();b.transactions[3].amount_minor='2000';assert(run(b).exceptions.some(e=>e.code==='AMBIGUOUS_CORRECTION_AMOUNT'))});

test('recurring readiness shows actionable held evidence without changing schedules',()=>{
 const cases=[
  ['INVALID_CURRENCY',r=>r.currency='NOT-MONEY'],
  ['INVALID_SOURCE_TIMEZONE',r=>r.source_timezone='not/a/timezone'],
  ['INVALID_START_DATE',r=>r.starts_at='not-a-date'],
  ['INVALID_END_DATE',r=>r.ends_at_or_null='2026-02-30T18:00:00Z'],
  ['INVALID_LAST_CHARGE_DATE',r=>r.last_charge_at_or_null='yesterday'],
  ['END_BEFORE_START',r=>r.ends_at_or_null='2024-01-01T18:00:00Z'],
  ['NEXT_BEFORE_START',r=>r.next_charge_at_or_null='2020-01-01T18:00:00Z'],
  ['NEXT_AFTER_END',r=>r.ends_at_or_null='2026-11-30T18:00:00Z'],
  ['LAST_BEFORE_START',r=>r.last_charge_at_or_null='2024-12-31T18:00:00Z'],
  ['LAST_AFTER_OBSERVATION',r=>r.last_charge_at_or_null='2026-11-10T18:00:00Z'],
  ['NEXT_NOT_AFTER_LAST',r=>r.next_charge_at_or_null=r.last_charge_at_or_null],
  ['INVALID_OBSERVATION_OR_VERIFICATION',r=>r.next_date_verified_at_or_null='2099-01-01T00:00:00Z']
 ];
 for(const[reason,change]of cases){const b=fixture();change(b.recurring[0]);const original=structuredClone(b.recurring),r=run(b);assert.equal(r.localReconciliation,'HOLD',reason);assert.equal(r.recurring[0].inventoryValid,false,reason);assert(r.recurring[0].holdReasons.includes(reason),reason);assert.equal(r.recurring[1].inventoryValid,true,'unrelated recipient unchanged');assert.deepEqual(b.recurring,original);assert.equal(r.recurring[0].canActivate,false);assert.equal(r.canCharge,false);assert(html(r).includes(reason));}
});
test('valid recurring source facts remain visible with exact timestamps and no activation',()=>{
 const b=fixture();b.recurring[0].ends_at_or_null='2027-01-01T18:00:00Z';b.recurring[0].next_date_verified_at_or_null='2026-11-09T12:00:00.000Z';const r=run(b),s=r.recurring[0];assert.equal(r.localReconciliation,'PASS');assert.equal(s.inventoryValid,true);assert.deepEqual(s.holdReasons,[]);assert.equal(s.sourceTimezone,'America/Chicago');assert.equal(s.startsAt,b.recurring[0].starts_at);assert.equal(s.endsAt,b.recurring[0].ends_at_or_null);assert.equal(s.lastCharge,b.recurring[0].last_charge_at_or_null);assert.equal(s.nextDateVerifiedAt,b.recurring[0].next_date_verified_at_or_null);assert.equal(s.canActivate,false);assert.equal(s.portability,'UNVERIFIED');
});
test('held recurring text remains escaped and unauthorized reports stay denied',()=>{
 const b=fixture();b.recurring[0].source_timezone='<img src=x onerror=alert(1)>';const output=html(run(b));assert(!output.includes('<img'));assert(output.includes('&lt;img'));assert(output.includes('INVALID_SOURCE_TIMEZONE'));assert.throws(()=>dryRun(b,{...authority,current:false}),/FINANCIAL_ACCESS_DENIED/);assert.throws(()=>dryRun(b,{...authority,organizations:[organizations[1]]}),/FINANCIAL_SCOPE_DENIED/);
});

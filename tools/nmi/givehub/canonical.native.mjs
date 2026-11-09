// Local canonical ledger acceptance. Never a production import executor.
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {verifiedDurableSources,pinnedFinancialFixtures} from '../durable-source.mjs';
import {localPostgres} from '../../backend-tests/local-postgres.mjs';
import {importProjection} from './staging.mjs';
import {fixture} from './fixture.mjs';
const source=verifiedDurableSources(),{f,fixtureSQL}=await pinnedFinancialFixtures(source),db=await localPostgres();let checks=0;
const ok=(v,m)=>{assert(v,m);checks++;console.log('PASS '+m)};
const call=async(action,payload,actor=f.admin,org=f.org)=>{const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[actor]);await c.query('set local role authenticated');const r=(await c.query('select giving_workspace($1,$2,$3) v',[action,org,payload])).rows[0].v;await c.query('commit');return r;}catch(e){await c.query('rollback');throw e;}finally{await c.end()}};
try{
 for(const row of source.filter(r=>r.kind!=='fixture-module')){await db.exec(row.sql);if(row.kind==='local-bootstrap')await db.exec('create schema if not exists storage; create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]); create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text); alter table storage.objects enable row level security;');}
 await db.exec(fixtureSQL);
 const original={...fixture().transactions[0],recipient_organization_id:f.org};
 const projection=importProjection(original,{fundId:f.mainFund,batchId:f.batch,personId:f.person,identityReviewed:true});
 const first=await call(projection.action,projection.payload),second=await call(projection.action,projection.payload);
 ok(first.id===second.id,'same canonical request returns same gift');
 const duplicate=await call('import',{...projection.payload,request_key:randomUUID()});ok(duplicate.duplicate===true&&duplicate.id===first.id,'new request key still respects external source identity');
 await assert.rejects(()=>call('import',{...projection.payload,request_key:randomUUID(),amount_minor:'9999'}));ok(true,'same source different amount rejected');
 const before=(await db.query('select count(*)::int n from giving_ledger')).rows[0].n;
 for(const [actor,org,payload]of[[f.ordinary,f.org,projection.payload],[f.reader,f.org,projection.payload],[f.admin,f.other,projection.payload],[f.admin,f.org,{...projection.payload,request_key:randomUUID(),person_id:f.foreignPerson}]]){await assert.rejects(()=>call('import',payload,actor,org));ok(true,'canonical financial/person/recipient isolation denies');}
 ok((await db.query('select count(*)::int n from giving_ledger')).rows[0].n===before,'denials add no ledger rows');
 const concurrent={...projection.payload,external_transaction_id:'ConcurrentSynthetic',external_reference:'ConcurrentSynthetic',request_key:randomUUID()};
 const outcomes=await Promise.allSettled([call('import',concurrent),call('import',{...concurrent,request_key:randomUUID()})]);
 ok(outcomes.some(x=>x.status==='fulfilled'),'at least one concurrent import committed locally');
 ok((await db.query("select count(*)::int n from giving_ledger where external_transaction_id='ConcurrentSynthetic'")).rows[0].n===1,'concurrent external key creates one canonical gift');
 ok((await db.query("select count(*)::int n from giving_audit where action='gift.manual' and subject_id=$1",[first.id])).rows[0].n===1,'idempotent import emits one canonical audit event');
 const row=(await db.query('select * from giving_ledger where id=$1',[first.id])).rows[0];ok(row.source==='import'&&row.source_system==='GiveHub:SyntheticAccount0'&&row.receipt_history_reference===original.source_receipt_reference_or_null&&row.tax_eligible===true,'canonical imported source receipt and fund tax preserved');
 const adjustment=await call('adjust',{request_key:randomUUID(),id:first.id,reason:'Synthetic historical correction review',replacement_minor:'10500'});
 ok(!!adjustment.reversal_id&&!!adjustment.replacement_id,'canonical adjustment appends reversal and replacement, never rewrites gift');
 ok(String((await db.query('select sum(amount_minor)::text n from giving_ledger where id=$1 or original_id=$1',[first.id])).rows[0].n)==='10500','canonical replacement total exact');
 await assert.rejects(()=>call('adjust',{request_key:randomUUID(),id:first.id,reason:'Synthetic repeat prohibited',replacement_minor:'11000'}));ok(true,'repeated adjustment of original held');
 await assert.rejects(()=>call('refund_request',{request_key:randomUUID(),leg_id:randomUUID(),amount_minor:'2000',kind:'refund',reason:'No provider leg for historical manual import'}));ok(true,'historical refund cannot invent provider transaction authority');
 await assert.rejects(()=>db.query('update giving_ledger set amount_minor=1 where id=$1',[first.id]));ok(true,'original ledger immutable');
 ok((await db.query('select count(*)::int n from giving_recurring_instructions')).rows[0].n===0,'no recurring instructions created');
 ok((await db.query('select count(*)::int n from giving_provider_events')).rows[0].n===0,'no provider events or calls');
 console.log(JSON.stringify({status:'PASS',checks,localPostgres:true,hosted:false,providerCalls:0,release:'HOLD'}));
}finally{await db.close()}

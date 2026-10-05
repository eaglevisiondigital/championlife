// Disposable local PostgreSQL only. Never accepts a remote connection string.
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync,execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {migrationOrder} from './migration-order.mjs';
const bin=process.env.TEST_POSTGRES_BIN || '',path=n=>bin?join(bin,n):n;
const root=mkdtempSync(join(tmpdir(),'outreach-pg-')),data=join(root,'data'),socket=join(root,'socket');mkdirSync(socket,{mode:0o700});
const args=['-h',socket,'-p','55482','-U','postgres','-d','postgres','-X','-qAt','-v','ON_ERROR_STOP=1'];
const sql=s=>execFileSync(path('psql'),args,{input:s,encoding:'utf8',maxBuffer:8e6});
const run=promisify(execFile),quote=v=>"'"+v.replaceAll("'","''")+"'";
const fp=v=>createHash('sha256').update(v).digest('hex');
const payload=n=>({brand:'sowgo',source_path:'/outreach-partner.html',request_key:randomUUID(),fields:{'first-name':'Synthetic','last-name':'Concurrency',email:`parallel-${n}@example.test`,'address-line-1':'1 Example','address-line-2':'',city:'Example','state-province':'FL','postal-code':'32548',phone:String(15550000000+n),'commitment-amount':'25','commitment-frequency':'Monthly'}});
const send=async(p,network)=>JSON.parse((await run(path('psql'),[...args,'-c',`set role service_role;select public.outreach_partner_gateway(${quote(JSON.stringify(p))}::jsonb,${quote(fp(network))});`],{maxBuffer:1e6})).stdout.trim());
let started=false;
try{
 execFileSync(path('initdb'),['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'inherit'});
 execFileSync(path('pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p 55482 -c listen_addresses=''`,'-w','start'],{stdio:'inherit'});started=true;
 sql(readFileSync(new URL('fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));
 sql(readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql',import.meta.url),'utf8'));
 for(const name of migrationOrder)sql(readFileSync(new URL('../../supabase/migrations/'+name,import.meta.url),'utf8'));
 // Approach the limit, then cross it concurrently without exhausting connection slots.
 for(let n=0;n<95;n++)assert((await send(payload(n),'one-network')).accepted);
 let results=await Promise.all(Array.from({length:40},(_,n)=>send(payload(95+n),'one-network')));
 assert.equal(results.filter(r=>r.accepted).length,25);assert.equal(results.filter(r=>r.reason==='rate').length,15);
 assert.equal(Number(sql("select attempts from private.outreach_abuse_windows where dimension='network'")),135);
 assert.equal(Number(sql('select count(*) from outreach_partner_intakes')),120);
 console.log('PASS 95 accepted + 40 concurrent changing-email/phone requests: exactly 120 total accepted, 15 counted rejections');
 sql('delete from private.outreach_abuse_windows');const same=payload(1000);
 results=await Promise.all(Array.from({length:20},()=>send(same,'replay')));assert(results.every(r=>r.accepted));
 assert.equal(Number(sql(`select count(*) from outreach_partner_intakes where request_key=${quote(same.request_key)}`)),1);
 assert.equal(Number(sql('select sum(attempts) from private.outreach_abuse_windows')),3);
 console.log('PASS 20 concurrent identical retries: one intake, one increment per dimension');
 sql('delete from private.outreach_abuse_windows');
 results=await Promise.all(Array.from({length:12},(_,n)=>{const p=payload(2000+n);p.fields.email='shared@example.test';return send(p,'email-'+n)}));
 assert.equal(results.filter(r=>r.accepted).length,5);assert.equal(results.filter(r=>r.reason==='rate').length,7);
 console.log('PASS concurrent normalized email cap across independent networks');
 sql('delete from private.outreach_abuse_windows');
 results=await Promise.all(Array.from({length:12},(_,n)=>{const p=payload(3000+n);p.fields.phone='15558889999';return send(p,'phone-'+n)}));
 assert.equal(results.filter(r=>r.accepted).length,5);assert.equal(results.filter(r=>r.reason==='rate').length,7);
 console.log('PASS concurrent normalized phone cap across independent networks');
} finally {
 if(started)execFileSync(path('pg_ctl'),['-D',data,'-m','fast','-w','stop'],{stdio:'ignore'});
 rmSync(root,{recursive:true,force:true});
}

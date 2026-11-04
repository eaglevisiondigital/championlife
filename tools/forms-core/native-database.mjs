// Explicitly isolated CI container only; no remote URL or production database accepted.
import assert from 'node:assert/strict';
import pg from '../backend-tests/node_modules/pg/lib/index.js';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
export async function nativeDatabase(){
 if(!process.env.TEST_DATABASE_URL)return localPostgres();
 const url=new URL(process.env.TEST_DATABASE_URL);
 assert.ok(['127.0.0.1','localhost'].includes(url.hostname)&&url.pathname==='/forms_core_test'&&url.username==='postgres','Requires explicitly named disposable loopback forms_core_test');
 const clients=[];async function connect(){const c=new pg.Client({connectionString:url.toString(),query_timeout:30000});await c.connect();clients.push(c);return c}
 const owner=await connect();assert.equal((await owner.query("select count(*)::int n from pg_class where relnamespace='public'::regnamespace")).rows[0].n,0,'Disposable database must be empty');
 return {query:(...args)=>owner.query(...args),exec:s=>owner.query(s),connect,close:async()=>{for(const c of clients)await c.end()}};
}

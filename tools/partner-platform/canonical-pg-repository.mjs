// UNMOUNTED, DISPOSABLE LOCAL ACCEPTANCE ONLY. No environment-variable connection,
// URL, TCP host, password, caller-owned client or pool is accepted. Runtime grants
// and a genuine provider least-privilege binding remain separately held.
import {createRequire} from 'node:module';
import {realpathSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {basename,dirname,isAbsolute,join} from 'node:path';
import {createCanonicalPartnerRepository} from './canonical-repository.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {Client}=require('pg');
const unavailable=()=>{throw Error('Canonical identity unavailable')};
export function createCanonicalPartnerPgRepository(options){
 if(require('pg/package.json').version!=='8.23.1')unavailable();
 if(!options||Object.getPrototypeOf(options)!==Object.prototype||Reflect.ownKeys(options).length!==2||!Object.hasOwn(options,'socketDirectory')||!Object.hasOwn(options,'signal'))unavailable();
 const {socketDirectory,signal}=options;
 if(typeof socketDirectory!=='string'||!isAbsolute(socketDirectory)||!(signal instanceof AbortSignal))unavailable();
 let host;
 try{
  host=realpathSync(socketDirectory);
  if(host!==join(realpathSync(tmpdir()),basename(dirname(host)),'socket')||!/^huntsville-minimal-pg-[A-Za-z0-9]+$/.test(basename(dirname(host))))unavailable();
 }catch{unavailable()}
 const repo=createCanonicalPartnerRepository({acquire:async()=>{
  if(signal.aborted)unavailable();
  // A fresh constructor for EVERY read makes pre-existing transactions and pool
  // identity reuse impossible. The raw client is never returned to the caller.
  const client=new Client({host,port:55488,database:'postgres',user:'postgres',
   password:()=>'',ssl:false,pipeline:false,connectionTimeoutMillis:1500,
   query_timeout:4000,application_name:'partner_canonical_disposable',
   options:'-c search_path=pg_catalog -c statement_timeout=3000 -c lock_timeout=750'});
  let closed=false,busy=false,closing;
  const close=()=>{
   closed=true;
   return closing??=(async()=>{try{await client.end()}finally{signal.removeEventListener('abort',abort)}})();
  };
  const abort=()=>{void close().catch(()=>{})};
  // A socket error must not become an unhandled EventEmitter exception or permit
  // a later result to escape; the owning operation always returns unavailable.
  client.on('error',abort);signal.addEventListener('abort',abort,{once:true});
  try{
   await client.connect();
   if(closed||signal.aborted||client.getTransactionStatus()!=='I')unavailable();
   return Object.freeze({
    async query(text,values){
     if(closed||signal.aborted||busy)unavailable();
     busy=true;
     try{const result=await client.query(text,values);if(closed||signal.aborted)unavailable();return result}
     finally{busy=false}
    },
    async release(){await close()}
   });
  }catch{await close().catch(()=>{});unavailable()}
 }});
 return Object.freeze({sourceHashes:repo.sourceHashes,async withCurrentIdentity(request,consume){
  if(signal.aborted)unavailable();
  try{await repo.withCurrentIdentity(request,consume);if(signal.aborted)unavailable()}
  catch{unavailable()}
 }});
}

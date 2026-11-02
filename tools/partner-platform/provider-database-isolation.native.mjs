// Disposable native cluster, no application data, credentials or hosted URLs.
// Tests database PUBLIC semantics only; NOT managed Auth compatibility.
import assert from 'node:assert/strict';import {createRequire} from 'node:module';
import {localPostgres} from '../backend-tests/local-postgres.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url)),{Client}=require('pg');
const db=await localPostgres(),clients=[];let checks=0;
const eq=(a,b,label)=>{assert.deepEqual(a,b);checks++;console.log('PASS '+label)};
try{
 const owner=await db.connect();await db.exec('create role fictional_host login noinherit nosuperuser nocreatedb nocreaterole nobypassrls noreplication password null; create schema auth;create table auth.sessions(id uuid primary key);');
 const temp=database=>db.query("select has_database_privilege('fictional_host',$1,'TEMP') allowed",[database]).then(r=>r.rows[0].allowed);
 eq(await temp('postgres'),true,'default PUBLIC TEMP inherited by minimal login');
 await db.exec('revoke temporary on database postgres from fictional_host');eq(await temp('postgres'),true,'per-login REVOKE cannot negate PUBLIC');
 await db.exec('create database fictional_execution template template0');await db.exec('revoke temporary on database fictional_execution from public');
 eq(await temp('fictional_execution'),false,'isolated database PUBLIC TEMP can be restricted');eq(await temp('postgres'),true,'other database PUBLIC privilege unchanged');
 for(const name of ['postgres','fictional_execution']){
  const c=new Client({host:owner.connectionParameters.host,port:55488,database:name,user:'fictional_host',password:()=>'',connectionTimeoutMillis:1000});await c.connect();clients.push(c);
  if(name==='fictional_execution'){await assert.rejects(()=>c.query('create temp table proof(id int)'),e=>e.code==='42501');checks++;console.log('PASS actual isolated login cannot create temp');eq((await c.query("select to_regclass('auth.sessions') value")).rows[0].value,null,'separate database does not acquire authoritative Auth relations');}
  else{await c.query('create temp table proof(id int)');checks++;console.log('PASS existing database behavior preserved');}
 }
 console.log(JSON.stringify({status:'PASS',checks,hosted:false,providerAuthAcceptance:false}));
}finally{for(const c of clients)try{await c.end()}catch{}await db.close()}

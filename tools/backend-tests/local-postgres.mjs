// Disposable Unix-socket PostgreSQL ONLY. Never accepts a remote URL/host/password.
import pg from 'pg';
import {mkdtempSync,mkdirSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {execFileSync} from 'node:child_process';
pg.types.setTypeParser(20,Number);
export async function localPostgres(){
 const root=mkdtempSync(join(tmpdir(),'huntsville-minimal-pg-')),data=join(root,'data'),socket=join(root,'socket'),bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';mkdirSync(socket);
 const exe=n=>join(bin,n);let started=false;const clients=[];
 async function close(){for(const c of clients)try{await c.end()}catch{};if(started)execFileSync(exe('pg_ctl'),['-D',data,'-m','immediate','-w','stop'],{stdio:'pipe'});rmSync(root,{recursive:true,force:true});}
 try{
  execFileSync(exe('initdb'),['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8'],{stdio:'pipe'});
  execFileSync(exe('pg_ctl'),['-D',data,'-l',join(root,'server.log'),'-o',`-k ${socket} -p 55488 -c listen_addresses=''`,'-w','start'],{stdio:'pipe'});started=true;
  async function connect(){const c=new pg.Client({host:socket,port:55488,database:'postgres',user:'postgres',connectionTimeoutMillis:10000,query_timeout:30000});await c.connect();clients.push(c);return c;}
  const client=await connect();return{query:(...a)=>client.query(...a),exec:s=>client.query(s),connect,close};
 }catch(e){await close();throw e;}
}

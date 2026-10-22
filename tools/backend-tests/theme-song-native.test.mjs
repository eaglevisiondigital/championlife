// Dedicated disposable Unix-socket PostgreSQL only. No connection URL accepted.
import {mkdtempSync,mkdirSync,readFileSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';import {join} from 'node:path';import {execFileSync} from 'node:child_process';import {randomUUID,createHash} from 'node:crypto';
import assert from 'node:assert/strict';import pg from 'pg';import {CounterStore} from '../../netlify/lib/theme-song-store.mjs';
const bin=process.env.TEST_POSTGRES_BIN||'/opt/homebrew/opt/postgresql@17/bin';
const dir=mkdtempSync(join(tmpdir(),'cl-song-')),socket=join(dir,'s'),data=join(dir,'db');mkdirSync(socket,{mode:0o700});
const command=(name,args)=>execFileSync(join(bin,name),args,{stdio:'pipe'});
let started=false,admin,pool;let n=0;const ok=(v,l)=>{assert.ok(v,l);n++;console.log('PASS '+l)};
const installation=randomUUID(),network=s=>createHash('sha256').update(s).digest('hex');
try{
 command('initdb',['-D',data,'-U','postgres','--auth=trust','--no-locale','--encoding=UTF8']);
 command('pg_ctl',['-D',data,'-l',join(dir,'server.log'),'-o',`-k ${socket} -p 55491 -c listen_addresses='' -c shared_memory_type=mmap -c max_connections=40 -c shared_buffers=12MB`,'-w','start']);started=true;
 admin=new pg.Pool({host:socket,port:55491,user:'postgres',database:'postgres'});
 await admin.query(readFileSync(new URL('../theme-song/schema.sql',import.meta.url),'utf8'));
 await admin.query("CREATE ROLE song_test LOGIN INHERIT; GRANT theme_song_counter TO song_test");
 await admin.query('INSERT INTO theme_song.installation(id,environment,enabled) VALUES ($1,\'deploy-preview\',true)',[installation]);
 pool=new pg.Pool({host:socket,port:55491,user:'song_test',database:'postgres',max:20});const store=new CounterStore(pool,installation,'deploy-preview');
 ok((await store.run()).plays==='0','new storage has a real zero');
 await assert.rejects(new CounterStore(pool,randomUUID(),'deploy-preview').run(),e=>e.status===503);ok(true,'wrong installation denied');
 await assert.rejects(new CounterStore(pool,installation,'production').run(),e=>e.status===503);ok(true,'wrong deployment scope denied');
 await assert.rejects(pool.query('UPDATE theme_song.installation SET enabled=false'),e=>e.code==='42501');ok(true,'runtime cannot enable/disable configuration');
 await assert.rejects(pool.query('CREATE TABLE theme_song.unauthorized(x int)'),e=>e.code==='42501');ok(true,'runtime cannot change schema');
 const one=await store.run('start',null,network('one'));
 await assert.rejects(store.run('play',one.session,network('one')),e=>e.status===425);ok(true,'server enforces minimum five seconds');
 ok((await store.run('start',one.session,network('one'))).session===one.session,'refresh resumes same listening session');
 // Local-only aging avoids sleeping; the production runtime has no session UPDATE privilege.
 await admin.query("UPDATE theme_song.sessions SET started_at=clock_timestamp()-interval '6 seconds' WHERE id=$1",[one.session]);
 const duplicates=await Promise.all(Array.from({length:20},()=>store.run('play',one.session,network('one'))));
 ok(duplicates.every(r=>r.plays==='1'),'twenty concurrent duplicate events count exactly once');
 ok((await new CounterStore(pool,installation,'deploy-preview').run()).plays==='1','new function instance/redeploy retains total');
 await store.run('download',one.session,network('one'));await store.run('giving',one.session,network('one'));await store.run('download',one.session,network('one'));
 const totals=await admin.query('SELECT kind,total::int FROM theme_song.totals ORDER BY kind');assert.deepEqual(totals.rows,[{kind:'download',total:1},{kind:'giving',total:1},{kind:'play',total:1}]);ok(true,'download/giving separate and deduplicated');
 const listeners=await Promise.all(Array.from({length:16},(_,i)=>store.run('start',null,network('different-'+i))));
 await admin.query("UPDATE theme_song.sessions SET started_at=clock_timestamp()-interval '6 seconds'");
 await Promise.all(listeners.map((s,i)=>store.run('play',s.session,network('different-'+i))));ok((await store.run()).plays==='17','sixteen simultaneous distinct sessions: no lost increments');
 const limits=await Promise.allSettled(Array.from({length:25},()=>store.run('start',null,network('rate'))));ok(limits.filter(x=>x.status==='fulfilled').length===20&&limits.filter(x=>x.reason?.status===429).length===5,'concurrent per-network session rate bound');
 await admin.query("UPDATE theme_song.sessions SET expires_at=clock_timestamp()-interval '1 second' WHERE id=$1",[one.session]);
 await assert.rejects(store.run('play',one.session,network('one')),e=>e.status===401);ok(true,'expired session rejected');
 const replacement=await store.run('start',one.session,network('one'));ok(replacement.session!==one.session,'new listening session after two-hour lifetime');
 ok((await store.run()).plays==='17','ephemeral session cleanup preserves aggregate history');
 await assert.rejects(store.run('play',randomUUID(),network('absent')),e=>e.status===401);ok(true,'unissued session rejected');
 await admin.query('UPDATE theme_song.installation SET enabled=false');await assert.rejects(store.run('start',null,network('disabled')),e=>e.status===503);ok(true,'database emergency-disable prevents new work');
 ok((await admin.query("SELECT count(*)::int n FROM pg_class c JOIN pg_namespace ns ON ns.oid=c.relnamespace WHERE ns.nspname='theme_song' AND c.relkind='r' AND c.relrowsecurity")).rows[0].n===5,'all five private tables RLS enabled');
 console.log(`PASS ${n} native PostgreSQL counter checks; local disposable cluster only`);
}finally{await pool?.end();await admin?.end();if(started)command('pg_ctl',['-D',data,'-m','immediate','-w','stop']);rmSync(dir,{recursive:true,force:true});}

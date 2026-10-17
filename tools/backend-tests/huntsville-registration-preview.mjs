// Disposable, localhost-only browser fixture. No secrets, outbound calls or published files.
import http from 'node:http';
import {readFileSync} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {join} from 'node:path';
import {PGlite} from '@electric-sql/pglite';
import {randomUUID} from 'node:crypto';
import {migrationOrder} from './migration-order.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),files=new Set(JSON.parse(readFileSync(join(root,'tools/site-build/public-files.json')))),definition=JSON.parse(readFileSync(join(root,'config/outreach/huntsville-2026.json')));
const db=new PGlite(),q=(s,p=[])=>db.query(s,p),user=randomUUID();
await db.exec(readFileSync(new URL('fixtures/supabase-test-bootstrap.sql',import.meta.url),'utf8'));await db.exec(readFileSync(join(root,'supabase/bootstrap/automatic-rls.sql'),'utf8'));
for(const f of migrationOrder)await db.exec(readFileSync(join(root,'supabase/migrations',f),'utf8'));
const {id:campaign,organization_id:org}=(await q("select id,organization_id from outreach_campaigns where code='huntsville_al_2026'")).rows[0];
await q('insert into auth.users(id,email,email_confirmed_at) values($1,$2,now())',[user,'synthetic@example.test']);
await q("insert into organization_staff_directory(organization_id,user_id,display_name)values($1,$2,'SYNTHETIC LOCAL operator')",[org,user]);
await q("insert into outreach_campaign_admins(organization_id,user_id,capability,reason)values($1,$2,'manage','Disposable localhost testing only')",[org,user]);
await q("update outreach_campaigns set status='approved' where id=$1",[campaign]);
await q("select set_config('request.jwt.claim.sub',$1,false)",[user]);await db.exec('set role authenticated');
const registration=(action,p={})=>q('select outreach_registration_workspace($1,$2,$3) v',[action,campaign,p]).then(r=>r.rows[0].v);
await registration('configure',{...definition.registration,revision:1,enabled:true});await registration('waiver_publish',{...definition.waiver,effective_at:'2026-01-01T00:00:00Z'});
const shim=`
const localRpc=async(name,p={})=>{const r=await fetch('/__rpc',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({name,p})});return r.json()};
window.ChampionLifeAuth={getUser:async()=>({id:'${user}'}),getSession:async()=>({user:{id:'${user}'}}),client:{auth:{onAuthStateChange:()=>{}},rpc:localRpc}};
window.CHAMPION_LIFE_SUPABASE={url:location.origin,publishableKey:'SYNTHETIC_LOCAL',outreachSiteKey:'SYNTHETIC_LOCAL'};
window.supabase={createClient:()=>({rpc:localRpc})};window.turnstile={render:(el,o)=>{el.textContent='LOCAL TEST ONLY — simulated security challenge';o.callback('LOCAL_TEST');return 1},reset:()=>{},remove:()=>{}};
`;
let chain=Promise.resolve();const server=http.createServer((req,res)=>{chain=chain.then(async()=>{
 res.setHeader('Cache-Control','no-store');res.setHeader('Content-Security-Policy',"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; object-src 'none'");
 const u=new URL(req.url,'http://127.0.0.1:8793');try{
 if(req.method==='POST'){
  let body='';for await(const chunk of req){body+=chunk;if(body.length>70000)throw Error('Request too large')}
  const b=JSON.parse(body);let data;
  await db.exec('reset role');await q("select set_config('request.jwt.claim.sub',$1,false)",[user]);
  if(u.pathname==='/functions/v1/outreach-registration-submit'){
   await db.exec('set role service_role');data=(await q('select outreach_registration_gateway($1,$2,$3) v',[b.slug,b.payload,'c'.repeat(64)])).rows[0].v;
  }else if(u.pathname==='/__rpc'){
   await db.exec('set role authenticated');const {name,p}=b;
   if(name==='outreach_registration_workspace')data=(await q('select outreach_registration_workspace($1,$2,$3) v',[p.p_action,p.p_campaign,p.p_payload])).rows[0].v;
   else if(name==='outreach_registration_config'){await db.exec('set role anon');data=(await q('select outreach_registration_config($1) v',[p.p_slug])).rows[0].v;}
   else if(name==='outreach_campaign_workspace')data=p.p_action==='context'?{organizations:[]}:[];
   else if(name==='staff_workspace_context')data={grants:[],organizations:[]};else data=[];
   data={data};
  }else throw Error('Unknown local endpoint');
  res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data));return;
 }
 if(u.pathname==='/local-test'){res.setHeader('Content-Type','text/html');res.end(`<h1>Disposable Huntsville test database</h1><p>No real records, agreements, messages or hosted connections.</p><a href='/outreach-register.html?campaign=huntsville-2026'>Public form</a><p><a href='/staff-outreach-registration.html?campaign=${campaign}'>Staff registration</a></p>`);return;}
 if(u.pathname==='/favicon.ico'){res.writeHead(204).end();return;}
 const name=u.pathname.slice(1);if(!files.has(name)){res.writeHead(404).end();return;}
 let bytes=readFileSync(join(root,name));if(name.endsWith('.html'))bytes=Buffer.from(bytes.toString().replace(/<script src="(?:https:[^"]+|assets\/js\/(?:supabase-config|champion-life-auth)\.js)"[^>]*><\/script>/g,'').replace(/<body([^>]*)>/,'<body$1><script>'+shim+'</script><p style="background:#f9e9b9;color:#222;padding:8px;text-align:center">LOCAL TEST ONLY · Synthetic data · No binding agreement</p>'));
 res.setHeader('Content-Type',({html:'text/html',js:'text/javascript',css:'text/css',png:'image/png',jpg:'image/jpeg',svg:'image/svg+xml'})[name.split('.').pop()]||'application/octet-stream');res.end(bytes);
 }catch(e){res.setHeader('Content-Type','application/json');res.end(JSON.stringify({error:{code:e.code||'LOCAL_TEST_ERROR',message:e.message}}));}
 }).catch(()=>res.end());});
server.listen(8793,'127.0.0.1',()=>console.log('LOCAL_ONLY_READY http://127.0.0.1:8793/local-test'));
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(async()=>{await db.close();process.exit(0)}));

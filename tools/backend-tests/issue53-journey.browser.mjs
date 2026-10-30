// Local-only integrated acceptance: real SDK + PDF.js + native PostgreSQL RLS.
// Auth and Storage transport are fictional adapters; no provider execution or email.
import {chromium,webkit} from 'playwright';
import {readFile,mkdir,writeFile} from 'node:fs/promises';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
import {localPostgres} from './local-postgres.mjs';
import {migrationOrder} from './migration-order.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url)),origin='https://journey.local.test',backend='https://synthetic-auth.supabase.co';
const evidence=process.env.EVIDENCE_DIR;if(!evidence||!process.env.TEST_PDF_ZIP||!process.env.TEST_PDFJS_DIR)throw Error('Private local inputs required');
await mkdir(evidence,{recursive:true});
const read=p=>readFile(path.join(root,p),'utf8'),sha=b=>createHash('sha256').update(b).digest('hex');
const pdf=execFileSync('python3',['-c','import zipfile,sys;sys.stdout.buffer.write(zipfile.ZipFile(sys.argv[1]).read("King_Kind_Approved_Personal_Use.pdf"))',process.env.TEST_PDF_ZIP],{maxBuffer:30000000});
const pdfHash='417f9faa7ff3945fdf4ff62931a233739856d03221c8429e21b768b221b94a54';assert.equal(sha(pdf),pdfHash);
const rendererHashes={'pdf.mjs':'a209a2124baa35cbb9015b809926f1bcec9dd1c247296290e205dd9d76cb9128','pdf.worker.mjs':'7c237f83fa56bce645d8af51d183c9c56ba7b2d2928ff42754dc7020bea36323'};
const users=['a','b'].map(x=>({id:x.repeat(8)+'-'+x.repeat(4)+'-4'+x.repeat(3)+'-8'+x.repeat(3)+'-'+x.repeat(12),email:x+'@example.test',email_confirmed_at:'2026-01-01T00:00:00Z',is_anonymous:false,aud:'authenticated',role:'authenticated'}));
const session=u=>{const exp=Math.floor(Date.now()/1000)+3600;return{user:u,expires_at:exp,expires_in:3600,token_type:'bearer',refresh_token:'fictional-only-'+u.id,access_token:[{alg:'HS256',typ:'JWT'},{sub:u.id,exp,aud:'authenticated',role:'authenticated'},'fictional'].map((v,i)=>Buffer.from(i===2?v:JSON.stringify(v)).toString('base64url')).join('.')}};
let checks=0;const results=[];const ok=(v,m)=>{assert.ok(v,m);checks++;console.log('PASS '+m)};
for(const[engine,options]of[[chromium,{channel:'chrome'}],[webkit,{}]]){
 const browser=await engine.launch({headless:true,...options});
 try{for(const width of[390,1440]){
  const db=await localPostgres();let context;
  try{
   await db.exec(await read('tools/backend-tests/fixtures/supabase-test-bootstrap.sql'));await db.exec(await read('supabase/bootstrap/automatic-rls.sql'));
   for(const f of migrationOrder)await db.exec(await read('supabase/migrations/'+f));
   await db.exec(`create schema storage;grant usage on schema storage to authenticated,anon;create table storage.buckets(id text primary key,name text,public boolean,file_size_limit bigint,allowed_mime_types text[]);create table storage.objects(id uuid primary key default gen_random_uuid(),bucket_id text,name text);alter table storage.objects enable row level security;grant select on storage.objects to authenticated,anon;`);
   await db.exec(await read('supabase/release/king-kind-reader-private-storage-candidate.sql'));await db.exec(await read('supabase/release/general-king-kind-resources-candidate.sql'));
   await db.query("insert into storage.objects(bucket_id,name)values('king-kind-books','king-kind/king-kind-english.pdf'),('king-kind-books','unrelated.pdf')");
   for(const u of users)await db.query('insert into auth.users(id,email,email_confirmed_at)values($1,$2,now())',[u.id,u.email]);
   // Each transport request gets its own SQL transaction/role. Synthetic token sub is
   // captured from that request, never inferred from mutable browser active-account state.
   const withUser=async(id,fn)=>{const c=await db.connect();try{await c.query('begin');await c.query("select set_config('request.jwt.claim.sub',$1,true)",[id||'']);await c.query('set local role '+(id?'authenticated':'anon'));const v=await fn(c);await c.query('commit');return v}catch(e){await c.query('rollback');throw e}finally{await c.end()}};
   const getSubject=req=>{try{return JSON.parse(Buffer.from(req.headers().authorization.split('.')[1],'base64url')).sub}catch{return null}};
   const count=async t=>(await db.query('select count(*)::int n from '+t)).rows[0].n;
   let otp=0,lost=false;const mutations=[],unexpected=[],errors=[];
   context=await browser.newContext({viewport:{width,height:950},acceptDownloads:true});const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
   await context.route('**/*',async route=>{
    const req=route.request(),u=new URL(req.url());
    try{
     if(u.origin===backend){
      const id=getSubject(req),user=users.find(x=>x.id===id);
      if(u.pathname==='/auth/v1/otp'){otp++;return route.fulfill({json:{}})}
      if(u.pathname==='/auth/v1/verify'){const p=req.postDataJSON(),v=users.find(x=>x.email===p.email);return p.token==='12345678'&&v?route.fulfill({json:session(v)}):route.fulfill({status:403,json:{error_code:'otp_expired',msg:'Fictional invalid/expired code'}})}
      if(u.pathname==='/auth/v1/user')return user?route.fulfill({json:user}):route.fulfill({status:401,json:{message:'Invalid fictional session'}});
      if(u.pathname==='/auth/v1/logout')return route.fulfill({status:204,body:''});
      if(u.pathname==='/rest/v1/rpc/general_resource_registration'){
       const p=req.postDataJSON();if(p.action==='register')mutations.push({kind:'register',id,payload:p.payload});
       const v=await withUser(id,async c=>(await c.query('select public.general_resource_registration($1,$2) v',[p.action,p.payload])).rows[0].v);
       if(lost&&p.action==='register'){lost=false;return route.abort('connectionfailed')}
       return route.fulfill({json:v});
      }
      if(u.pathname==='/rest/v1/rpc/claim_st_lucia_registration')return route.fulfill({json:await withUser(id,async c=>(await c.query('select public.claim_st_lucia_registration() v')).rows[0].v)});
      if(u.pathname.startsWith('/storage/v1/object/sign/')){
       const object=u.pathname.slice('/storage/v1/object/sign/'.length),[bucket,...parts]=object.split('/');
       if(req.method()==='POST'){
        const allowed=await withUser(id,async c=>(await c.query('select name from storage.objects where bucket_id=$1 and name=$2',[bucket,parts.join('/')])).rows.length===1);
        if(!allowed)return route.fulfill({status:403,json:{statusCode:'403',message:'RLS denied',error:'Unauthorized'}});
        return route.fulfill({json:{signedURL:'/object/sign/'+object+'?token=fictional-only'}});
       }
       if(req.method()==='GET'&&object==='king-kind-books/king-kind/king-kind-english.pdf'&&u.searchParams.get('token')==='fictional-only')return route.fulfill({body:pdf,contentType:'application/pdf'});
      }
      const table=u.pathname.slice('/rest/v1/'.length),tables=['courses','profiles','course_enrollments','lesson_progress','lesson_answers','outreach_registrations'];
      if(u.pathname.startsWith('/rest/v1/')&&tables.includes(table)){
       const identifier=s=>{if(!/^[a-z_]+$/.test(s))throw Error('Unsupported fixture identifier');return '"'+s+'"'};
       let rows=await withUser(id,async c=>{
        if(req.method()==='GET'){
         let sql='select '+(u.searchParams.get('select')||'*').split(',').map(s=>s==='*'?'*':identifier(s)).join(',')+' from public.'+identifier(table),args=[],clauses=[];
         for(const[k,v]of u.searchParams){if(['select','order','limit'].includes(k))continue;if(!v.startsWith('eq.'))throw Error('Unsupported fixture filter');args.push(v.slice(3));clauses.push(identifier(k)+'=$'+args.length)}
         if(clauses.length)sql+=' where '+clauses.join(' and ');if(u.searchParams.has('order'))sql+=' order by '+u.searchParams.get('order').split(',').map(v=>{const[k,d]=v.split('.');return identifier(k)+(d==='desc'?' desc':' asc')}).join(',');
         if(u.searchParams.has('limit')){assert.match(u.searchParams.get('limit'),/^\d+$/);sql+=' limit '+u.searchParams.get('limit')}
         return(await c.query(sql,args)).rows;
        }
        if(req.method()!=='POST'||!['profiles','course_enrollments','lesson_progress','lesson_answers'].includes(table))throw Error('Unexpected fixture mutation');
        const input=req.postDataJSON(),payload=Array.isArray(input)?input:[input],out=[];mutations.push({kind:table,id,payload});
        for(const item of payload){const keys=Object.keys(item),args=Object.values(item),conflict=(u.searchParams.get('on_conflict')||'user_id').split(',');
         const updates=keys.map(k=>identifier(k)+'=excluded.'+identifier(k));
         out.push(...(await c.query('insert into public.'+identifier(table)+'('+keys.map(identifier).join(',')+')values('+args.map((_,i)=>'$'+(i+1)).join(',')+') on conflict('+conflict.map(identifier).join(',')+') '+(updates.length?'do update set '+updates.join(','):'do nothing')+' returning *',args)).rows);
        }return out;
       });
       if(req.headers().accept?.includes('vnd.pgrst.object')){if(rows.length!==1)return route.fulfill({status:406,json:{code:'PGRST116',details:'The result contains '+rows.length+' rows',message:'Cannot coerce'}});rows=rows[0]}
       return route.fulfill({json:rows});
      }
      unexpected.push(req.method()+' '+u.pathname);return route.abort();
     }
     if(u.origin==='https://cdn.jsdelivr.net'&&u.pathname.startsWith('/npm/pdfjs-dist@4.10.38/build/')){const n=path.basename(u.pathname);assert.ok(rendererHashes[n]);const body=await readFile(path.join(process.env.TEST_PDFJS_DIR,n));assert.equal(sha(body),rendererHashes[n]);return route.fulfill({body,contentType:'text/javascript',headers:{'access-control-allow-origin':'*'}})}
     if(u.origin==='https://www.youtube.com'||u.origin==='https://fonts.googleapis.com'||u.origin==='https://fonts.gstatic.com')return route.fulfill({body:'',status:200});
     let pathname=u.pathname;if(u.href==='https://championlifefwb.com/assets/images/king-kind-cover.svg')pathname='/assets/images/king-kind-cover.svg';else if(u.origin!==origin){unexpected.push(u.origin+u.pathname);return route.abort()}
     if(req.method()==='POST'&&u.pathname==='/'){mutations.push({kind:'fictional-form-delivery'});return route.fulfill({status:200,body:'Fictional form receipt, no delivery'})}
     if(req.method()!=='GET'){unexpected.push(req.method()+u.pathname);return route.abort()}
     if(pathname==='/assets/js/supabase-config.js')return route.fulfill({contentType:'text/javascript',body:'window.CHAMPION_LIFE_SUPABASE='+JSON.stringify({url:backend,publishableKey:'fictional-not-a-credential'})});
     if(pathname==='/king-kind/')pathname='/king-kind/index.html';const file=path.resolve(root,'.'+pathname);assert.ok(file.startsWith(root));
     try{return route.fulfill({body:await readFile(file),contentType:{'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.webp':'image/webp','.svg':'image/svg+xml','.pdf':'application/pdf'}[path.extname(file)]||'application/octet-stream'})}catch{return route.fulfill({status:404,body:''})}
    }catch(e){if(e.code)return route.fulfill({status:403,json:{code:e.code,message:'Local PostgreSQL denied'}});unexpected.push(String(e));return route.abort()}
   });
   const fill=async()=>{await page.locator('#resource-name').fill('Fictional Reader A');await page.locator('#resource-email').fill(users[0].email);await page.locator('#resource-consent').check()};
   await page.goto(origin+'/king-kind/');await fill();await page.locator('#resource-submit').click();await page.locator('#resource-verification').waitFor({state:'visible'});ok(otp===1&&await count('app_private.general_resource_registrations')===0,'email request is not resource registration');
   await page.locator('#resource-code').fill('00000000');await page.locator('#resource-code-form button').click();await page.getByText('That code is invalid or expired.',{exact:false}).waitFor();ok(await count('app_private.general_resource_registrations')===0,'rejected code cannot register');
   if(width===390){await page.locator('#resource-code').fill('12345678');lost=true;await page.locator('#resource-code-form button').click();await page.getByText('Registration could not be confirmed.',{exact:false}).waitFor();ok(!await page.locator('.bes-registration-success').isVisible(),'uncertain committed response not shown as success');await page.locator('#resource-submit').click();}
   else{const s=session(users[0]);await page.goto('about:blank');await page.goto(origin+'/king-kind/#'+new URLSearchParams({access_token:s.access_token,refresh_token:s.refresh_token,expires_in:'3600',token_type:'bearer',type:'signup'}));await page.locator('#resource-account-email').waitFor({state:'visible'});ok(!page.url().includes('access_token'),'fictional email link scrubbed');await fill();await page.locator('#resource-submit').click()}
   await page.locator('#generalResourceCard.registered').waitFor();ok(await count('app_private.general_resource_registrations')===1&&await count('app_private.general_resource_audit')===1,'one registration and immutable audit after retry/link');
   ok(await count('course_enrollments')===0&&await count('lesson_progress')===0,'resource signup creates no implied enrollment or completion');
   await page.reload();await page.locator('#generalResourceCard.registered').waitFor();ok(true,'returning verified registrant resumes');
   await page.goto(origin+'/king-kind-reader.html');await page.waitForFunction(()=>!document.querySelector('#book-license-ack').disabled);ok(await page.locator('#download-book').isDisabled(),'actual database eligible reader requires license acknowledgment');
   ok(await page.evaluate(()=>document.querySelector('#page-canvas').width>0),'real PDF.js rendered authorized book');await page.locator('#book-license-ack').check();const downloaded=page.waitForEvent('download');await page.locator('#download-book').click();ok(sha(await readFile(await(await downloaded).path()))===pdfHash,'private download exact approved PDF');
   await page.goto(origin+'/my-discipleship.html');await page.locator('#dashLessons:not([hidden])').waitFor();ok(await page.locator('.dash-lesson').count()===13,'native-backed dashboard lists 13 lesson routes');ok((await page.locator('#dashProgressText').innerText()).includes('0 of 13'),'no invented course progress');
   const lessons=[];
   for(let n=1;n<=13;n++){
    await page.goto(origin+'/getting-a-grip-'+n+'.html');const field=page.locator(n<=4?'[name=q1]':'[data-grip-notes-lesson]');await page.waitForFunction(sel=>!document.querySelector(sel)?.disabled,n<=4?'[name=q1]':'[data-grip-notes-lesson]');await field.fill('A PRIVATE LESSON '+n);
    if(n<=4){await page.waitForFunction(()=>document.querySelector('[data-grip-save-status]').textContent.includes('Cloud saved'));const v=await db.query('select answer from lesson_answers where user_id=$1 and lesson_number=$2 and question_number=1',[users[0].id,n]);ok(v.rows[0]?.answer==='A PRIVATE LESSON '+n,'lesson '+n+' cloud save under authenticated owner');}
    else ok(await page.evaluate(n=>Object.keys(localStorage).some(k=>k.includes('aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa')&&k.endsWith('lesson:'+n)),n),'lesson '+n+' private owned device note');
    lessons.push(n);
   }
   ok(await count('course_enrollments')===1,'first worksheet creates exactly one own-account enrollment');ok(await count('lesson_progress')===4,'only four actually started cloud worksheets counted');
   await page.goto(origin+'/my-discipleship.html');await page.locator('#dashLessons:not([hidden])').waitFor();ok((await page.locator('#dashProgressText').innerText()).includes('0 of 13'),'draft answers do not imply completion');
   await page.goto(origin+'/getting-a-grip-1.html');await page.waitForFunction(()=>document.querySelector('[name=q1]').value==='A PRIVATE LESSON 1');
   // Observe the pre-existing progress-policy gap without implementing a new policy.
   const next=page.locator('a[href="getting-a-grip-2.html"]').first();
   ok(await next.count()===1,'existing next-lesson link is available without verified watch state (documented release gap)');
   await page.locator('[name="first-name"]').fill('Fictional');await page.locator('[name="last-name"]').fill('Reader');await page.locator('[name="phone"]').fill('5555550100');
   for(let q=1;q<=20;q++)await page.locator('[name=q'+q+']').fill('Fictional answer '+q);
   await page.locator('.grip-course-form button[type=submit]').click();
   await page.waitForFunction(()=>document.querySelector('.grip-form-card')?.classList.contains('completed'));
   ok((await db.query('select status from lesson_progress where user_id=$1 and lesson_number=1',[users[0].id])).rows[0].status==='completed','fully answered lesson completes in own account after fictional form receipt');

   await page.evaluate(s=>ChampionLifeAuth.client.auth.setSession(s),session(users[1]));await page.waitForFunction(()=>!document.querySelector('[name=q1]').disabled&&document.querySelector('[name=q1]').value==='');ok(true,'A to B native-backed worksheet reveals no A answers');
   const mutationDenial=await page.evaluate(async id=>(await ChampionLifeAuth.client.from('lesson_answers').upsert({user_id:id,course_id:1,lesson_number:1,question_number:1,answer:'forbidden'},{onConflict:'user_id,course_id,lesson_number,question_number'})).error?.code,users[0].id);ok(mutationDenial==='42501','native RLS denies B mutation of A answers');
   const denied=await withUser(users[1].id,c=>c.query('select answer from lesson_answers where user_id=$1',[users[0].id]));ok(denied.rows.length===0,'native RLS denies B read of A answers');
   await page.goto(origin+'/getting-a-grip-13.html');await page.waitForFunction(()=>!document.querySelector('[data-grip-notes-lesson]').disabled);ok(await page.locator('[data-grip-notes-lesson]').inputValue()==='','B cannot inherit A device note');
   await page.goto(origin+'/king-kind-reader.html');await page.locator('#access-error').waitFor({state:'visible'});ok(await page.locator('#download-book').isDisabled(),'unregistered B denied by actual Storage RLS');
   await page.goto(origin+'/king-kind/');await fill();const before=mutations.length;await page.locator('#resource-submit').click();await page.locator('#resource-switch').waitFor({state:'visible'});ok(mutations.length===before,'wrong signed-in account sends no registration mutation');
   await page.evaluate(s=>ChampionLifeAuth.client.auth.setSession(s),session(users[0]));await page.reload();await page.locator('#generalResourceCard.registered').waitFor();
   await page.goto(origin+'/getting-a-grip-13.html');await page.waitForFunction(()=>document.querySelector('[data-grip-notes-lesson]').value==='A PRIVATE LESSON 13');ok(true,'A to B to A preserves A own notes');
   await db.query('update app_private.general_resource_registrations set revoked_at=now() where user_id=$1',[users[0].id]);
   await page.goto(origin+'/king-kind-reader.html');await page.locator('#access-error').waitFor({state:'visible'});ok(await page.locator('#download-book').isDisabled(),'revoked general eligibility denies fresh book access');
   await page.goto(origin+'/king-kind/');await fill();await page.locator('#resource-submit').click();await page.getByText('Registration could not be confirmed.',{exact:false}).waitFor();ok(await count('app_private.general_resource_registrations')===1&&await count('app_private.general_resource_audit')===1,'retry cannot resurrect revoked registration');
   await page.goto('about:blank');await page.goto(origin+'/king-kind/#error=access_denied&error_code=otp_expired');await page.getByText('That verification link is invalid',{exact:false}).waitFor();ok(!await page.locator('.bes-registration-success').isVisible(),'expired link cannot borrow existing A session');
   await page.evaluate(()=>ChampionLifeAuth.client.auth.signOut({scope:'local'}));await page.goto(origin+'/getting-a-grip-13.html');ok(await page.locator('[data-grip-notes-lesson]').isDisabled()&&await page.locator('[data-grip-notes-lesson]').inputValue()==='','anonymous notes remain locked');
   ok(await count('outreach_registrations')===0,'no fabricated outreach decisions');ok(await count('course_enrollments')===1&&await count('lesson_answers')===23,'revocation/logout preserve legitimate cloud state');
   ok(unexpected.length===0,'zero unhandled/external requests '+unexpected.join(','));ok(errors.length===0,'zero browser exceptions '+errors.join(','));
   await page.goto(origin+'/king-kind/');await page.screenshot({path:path.join(evidence,engine.name()+'-'+width+'.png'),fullPage:true});
   results.push({browser:engine.name(),width,lessonRoutes:lessons,registrationRows:1,auditRows:1,enrollments:1,cloudAnswers:23,externalRequests:0,provider:'fictional',database:'native PostgreSQL',pdfHash});
  }finally{await context?.close();await db.close()}
 }}finally{await browser.close()}
}
await writeFile(path.join(evidence,'journey-results.json'),JSON.stringify({checks,results,genuineProviderAcceptance:'UNTESTED'},null,2));console.log(checks+' integrated journey assertions passed; fictional Auth and Storage transport, actual native RLS/SDK/PDF.js.');

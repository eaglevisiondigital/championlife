import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import vm from 'node:vm';
import {JSDOM} from 'jsdom';
const read=p=>readFileSync(new URL('../../'+p,import.meta.url),'utf8');
const source=read('assets/js/staff-session.js');
let checks=0;const ok=(v,m)=>{assert.ok(v,m);checks++};
const tick=()=>new Promise(r=>setTimeout(r,10));
for(const page of ['staff-people.html','staff-outreach-registration.html','staff-outreach-partners.html']){
 for(const email of ['dave@championlifefwb.com','dave@theboss.biz']){
  for(const mode of ['success','failure','session-remains','external-signout','switch','back','late-initial']){
   const dom=new JSDOM(read(page),{url:'https://staff.local.test/'+page,runScripts:'outside-only'}),w=dom.window,d=w.document;
   const user={id:'synthetic-'+email,email};let session={user},callback,finishInitial,signoutCalls=0,redirects=[],reloads=0,finishSignout;
   w.localStorage.setItem('unrelated-setting','preserve');w.sessionStorage.setItem('unrelated-draft','preserve');w.sessionStorage.setItem('championlife-auth-next','/staff-people.html');
   w.ChampionLifeAuth={getUser:()=>mode==='late-initial'?new Promise(r=>finishInitial=r):Promise.resolve(user),getSession:async()=>session,client:{auth:{
    onAuthStateChange:fn=>callback=fn,
    signOut:async opts=>{ok(opts.scope==='local','only current auth session');signoutCalls++;await new Promise(r=>finishSignout=r);
     if(mode==='failure')return{error:{message:'private backend error must not be shown'}};
     if(mode!=='session-remains')session=null;callback('SIGNED_OUT',session);return{error:null};
    }
   }}};
   const main=d.querySelector('#staff-main'),mount=d.createElement('div');mount.textContent='Synthetic protected record';main.append(mount);
   vm.runInNewContext(source,{window:w,document:d,location:{replace:u=>redirects.push(u),reload:()=>reloads++},sessionStorage:w.sessionStorage,setTimeout,console});
   await tick();
   if(mode==='late-initial'){
    callback('SIGNED_OUT',null);finishInitial(user);await tick();ok(d.querySelector('#staff-session').hidden,'late initial user cannot restore header');
   }else{
    ok(d.querySelector('#staff-session-email').textContent===email,'correct current account email');
    if(mode==='external-signout'||mode==='switch'){callback(mode==='switch'?'SIGNED_IN':'SIGNED_OUT',mode==='switch'?{user:{id:'another-synthetic',email:'other@example.test'}}:null);await tick();ok(redirects.length===1,'external signout/account change redirects once')}
    else if(mode==='back'){w.dispatchEvent(new w.PageTransitionEvent('pagehide',{persisted:true}));mount.textContent='Late protected response';ok(!main.textContent&&main.hidden,'pagehide detaches protected snapshot');w.dispatchEvent(new w.PageTransitionEvent('pageshow',{persisted:true}));ok(reloads===1&&main.hidden,'BFCache restore reloads while protected content stays hidden')}
    else{
     d.querySelector('#staff-logout').click();d.querySelector('#staff-logout').click();ok(signoutCalls===1,'double-click cannot duplicate signout');ok(!main.textContent,'protected content cleared before network response');mount.textContent='Late protected response';ok(!main.textContent,'late response remains detached');finishSignout();await tick();await tick();
     if(mode==='failure'||mode==='session-remains'){ok(!redirects.length,'failed signout cannot claim completion');ok(!d.querySelector('#staff-logout').disabled,'failure supports retry');ok(d.querySelector('#staff-session-message').textContent.includes('could not be completed'),'safe error visible');ok(!d.body.textContent.includes('private backend'),'no backend detail leakage')}
     else{ok(redirects[0]==='discipleship-login.html?next=%2Fstaff-people.html','fixed staff login destination');ok(!w.sessionStorage.getItem('championlife-auth-next'),'only app return hint removed')}
    }
   }
   ok(w.localStorage.getItem('unrelated-setting')==='preserve'&&w.sessionStorage.getItem('unrelated-draft')==='preserve','unrelated browser information preserved');
   ok(!main.textContent.includes('Synthetic protected record'),'no protected record remains after leaving');
   w.close();
  }
 }
}
console.log(checks+' staff session and account-switch assertions passed (synthetic identities; no hosted login).');

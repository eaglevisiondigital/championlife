// Execute the real global routing code with no network, payments or submissions.
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {JSDOM} from 'jsdom';
const root=new URL('../../',import.meta.url),read=p=>readFileSync(new URL(p,root),'utf8'),base='d6a97b1fc9ebbeddc8f2b1922b33dbe3934368ab';
let checks=0;const check=(v,m)=>{assert(v,m);checks++};
for(const path of ['outreach.html','outreach-theme-song.html','give.html']){
 const dom=new JSDOM(read(path),{url:'https://championlifefwb.com/'+path,runScripts:'outside-only'}),w=dom.window;
 w.IntersectionObserver=class{observe(){}};let opens=0;w.OutreachPartner={open(){opens++}};w.eval(read('assets/js/site.js'));
 for(const a of w.document.querySelectorAll('a')){
  check(!/outreach-giving|outreach-partner(?:\.html)?(?:\?|$)/.test(a.getAttribute('href')||''),'no old public outreach destination');
  if(a.href==='https://sowgo.org/partner/'||a.href==='https://sowgo.org/sow/'){
   const event=new w.MouseEvent('click',{bubbles:true,cancelable:true});a.dispatchEvent(event);check(!event.defaultPrevented,'normal verified destination navigation');
  }
 }
 check(opens===0,'old modal not opened');
 if(path==='outreach.html'){
  const logo=w.document.querySelector('.outreach-sowgo-brand');check(logo.href==='https://sowgo.org/','approved logo home link');check(logo.querySelector('img').alt.includes('SowGo'),'logo alternative text');
  const old=new JSDOM(execFileSync('git',['show',base+':outreach.html'],{cwd:root,encoding:'utf8'}));
  const photos=d=>[...d.querySelectorAll('img:not(.outreach-sowgo-brand img)')].map(el=>el.outerHTML);
  assert.deepEqual(photos(w.document),photos(old.window.document));checks++;
  assert.deepEqual([...w.document.querySelectorAll('.outreach-event h3')].map(el=>el.textContent),[...old.window.document.querySelectorAll('.outreach-event h3')].map(el=>el.textContent));checks++;
  check(w.document.querySelector('a[href="https://championlifefwb.com/minden-serve"]'),'live Minden volunteer path retained');old.window.close();
 }
 if(path==='give.html'){
  check(w.document.querySelector('a[href="giving-portal.html"]'),'ordinary giving unchanged');check(w.document.querySelector('#manageGivingAccount').getAttribute('href')==='giving-dashboard.html?v=20260924-1','account management unchanged');
 }
 const dynamic=w.document.createElement('a');dynamic.href='/outreach-partner?brand=champion-life';dynamic.textContent='Get Connected';w.document.body.append(dynamic);const click=new w.MouseEvent('click',{bubbles:true,cancelable:true});dynamic.dispatchEvent(click);check(!click.defaultPrevented&&dynamic.href==='https://sowgo.org/partner/','later-inserted legacy partner link uses SowGo');check(opens===0,'dynamic entry does not load modal');
 dom.window.close();
}
const redirects=read('_redirects');
for(const [kind,target] of [['partner','partner'],['giving','sow']])for(const suffix of ['', '/', '.html'])check(redirects.includes('/outreach-'+kind+suffix+' https://sowgo.org/'+target+'/ 302!'),'explicit legacy redirect');
check(!/\/giving-(portal|dashboard).*sowgo/.test(redirects),'church giving has no SowGo redirect');
console.log('PASS '+checks+' outreach routing, genuine click-interceptor, logo, content and ordinary-giving preservation checks');

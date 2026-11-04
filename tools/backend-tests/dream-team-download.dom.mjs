import {JSDOM} from 'jsdom';import fs from 'node:fs';import assert from 'node:assert/strict';
const source=fs.readFileSync(new URL('../../assets/js/dream-team-common.js',import.meta.url),'utf8');let count=0;
const check=(v,label)=>{assert.ok(v,label);count++;console.log('PASS '+label)};
async function run(stage){const dom=new JSDOM('<main></main>',{runScripts:'outside-only'}),w=dom.window;let active=true,account='A',release,created=0,revoked=0,clicked=0,requested=0;
 w.DreamTrack={el:(tag,t,attrs)=>{const n=w.document.createElement(tag);for(const[k,v]of Object.entries(attrs))n.setAttribute(k,v);n.click=()=>clicked++;return n}};
 w.ChampionLifeAuth={getSession:async()=>({user:{id:account},access_token:'synthetic'})};w.CHAMPION_LIFE_SUPABASE={url:'https://fictional.test',publishableKey:'fictional'};
 w.fetch=async()=>{requested++;if(stage==='fetch')await new Promise(r=>release=r);return{ok:stage!=='denied',status:stage==='denied'?403:200,blob:async()=>{if(stage==='blob'||stage==='account')await new Promise(r=>release=r);return new w.Blob(['fictional'])}}};
 w.URL.createObjectURL=()=>{created++;return'blob:fictional'};w.URL.revokeObjectURL=()=>revoked++;
 w.eval(source);const promise=w.DreamTeam.documentDownload('synthetic','A',()=>active);promise.catch(()=>{});await new Promise(r=>setTimeout(r,0));if(stage==='account')account='B';else if(['fetch','blob'].includes(stage))active=false;release?.();
 if(stage==='denied'){await assert.rejects(promise,e=>e.status===403);check(created===0&&clicked===0,'explicit document denial retains structured status without download')}
 else{await promise;check(requested===1,'one protected document request '+stage);check(created===(stage==='normal'?1:0)&&clicked===(stage==='normal'?1:0),'no stale document URL/click '+stage);check(revoked===created,'all created URLs revoked '+stage)}dom.window.close();}
for(const stage of ['normal','fetch','blob','account','denied'])await run(stage);console.log(`PASS ${count} Dream Team protected-download checks`);

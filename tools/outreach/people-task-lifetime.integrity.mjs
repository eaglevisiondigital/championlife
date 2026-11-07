import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import {fileURLToPath} from 'node:url';
import {buildSite} from '../site-build/build.mjs';
const root=fileURLToPath(new URL('../../',import.meta.url));
const base='91ebfeea001babf5851690076e9ef6d71e91b19a';
const sha=value=>createHash('sha256').update(value).digest('hex');
// Exact reversible lifetime additions only. Preserve original accepted helper assertion.
const changes=[
  [
    "  let pending=false,retired=false;\n",
    "  let pending=false,retired=false,reviewOnly=false;\n  const inputs=[select,due,saveStatus,saveDue,clearDue],owners=[card,controls];\n  // Capture ownership before card insertion; additions are not retirement.\n  for(let node=content;node;node=node.parentNode)owners.push(node);\n  let members=[statusLabel,dueLabel,...inputs];\n  const retire=()=>{if(retired)return;retired=true;observer.disconnect();select.value='';due.value='';due.defaultValue='';for(const option of select.options)option.defaultSelected=false;for(const control of inputs)control.disabled=true};\n  const removed=records=>{if(records.some(record=>Array.from(record.removedNodes).some(node=>[...owners,...members].some(owned=>node===owned||node.contains?.(owned)))))retire()};\n  const observer=new MutationObserver(removed);observer.observe(document,{childList:true,subtree:true});\n"
  ],
  [
    "   if(!retired&&(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth)){retired=true;select.value='';due.value='';if(g===generation&&root.contains(card))card.replaceChildren(el('p','Task editor closed because the staff connection changed. Reload to verify access.'))}\n",
    "   removed(observer.takeRecords());\n   if(!retired&&(window.ChampionLifeAuth!==auth||auth.client!==client||client.auth!==clientAuth)){retire();if(g===generation&&root.contains(card))card.replaceChildren(el('p','Task editor closed because the staff connection changed. Reload to verify access.'))}\n"
  ],
  [
    "   controls.replaceChildren(el('p',message),button('Refresh follow-up tasks',()=>{if(current())return detail(personId,taskCursors,taskStatus)}));\n",
    "   // Retire mutation intent, but retain the existing read-only reconciliation action.\n   reviewOnly=true;select.value='';due.value='';due.defaultValue='';\n   const refresh=button('Refresh follow-up tasks',()=>{if(current())return detail(personId,taskCursors,taskStatus)});\n   members=[refresh];controls.replaceChildren(el('p',message),refresh);\n"
  ],
  [
    "   if(pending||!current())return;\n",
    "   if(reviewOnly||pending||!current())return;\n"
  ],
  [
    "  saveStatus.onclick=()=>save('status');saveDue.onclick=()=>save('due_on');clearDue.onclick=()=>{if(pending||!current())return;due.value='';return save('due_on',true)};\n",
    "  saveStatus.onclick=()=>save('status');saveDue.onclick=()=>save('due_on');clearDue.onclick=()=>{if(reviewOnly||pending||!current())return;due.value='';return save('due_on',true)};\n"
  ]
];
export function acceptedTaskActions(helper){
 assert.equal(sha(helper),'3543002a6bbc531392978bc36af39f9995e2520257dcb995ee482d23c8fa950b','reviewed lifetime helper');
 for(const [before,after] of changes){assert.equal(helper.split(after).length-1,1,'single exact lifetime derivation');helper=helper.replace(after,before)}
 assert.equal(sha(helper),'504d0dc7d783ba5051ff200f08c813fedaa33ada3bac6473cc568cab34bf8b84','unchanged accepted72 helper after bounded lifetime derivation');return helper;
}
const modified={
  "assets/js/outreach-people.js": "e79384d5e770bf784f74b0ade0d57695e7218e993735b0cf91b2105b09baf9c7",
  ".github/workflows/outreach-summary-review.yml": "a7715da0c44c8cb6fec4d133660ed51c9f5ac4b06c3a9ec199613782de6720d1",
  "tools/outreach/people-followup-composition.browser.mjs": "0be1e57d6fb6c712c127127199408da645a9d0043d353d5879326f255f7eb409",
  "tools/outreach/people-followup-pagination-integrity.mjs": "0b124390347ec3ed1b9d37a0e437f624a18c8477a5c7e1ae994bed69a52007c4"
};
export const additions=['tools/outreach/people-task-lifetime.test.mjs','tools/outreach/people-task-lifetime.integrity.mjs','tools/outreach/people-task-lifetime.integrity.test.mjs','tools/outreach/people-task-lifetime-independent.browser.mjs','docs/PEOPLE-TASK-LIFETIME-20261107.md'];
export function verifySource(directory=root){
 const git=(...args)=>execFileSync('git',['--no-replace-objects',...args],{cwd:directory,maxBuffer:80*1024*1024});
 const baseline=git('ls-tree','-r','--name-only',base).toString().trim().split('\n');
 for(const name of baseline){const actual=fs.readFileSync(path.join(directory,name));if(modified[name])assert.equal(sha(actual),modified[name],name+' reviewed change');else assert.deepEqual(actual,git('show',base+':'+name),name+' protected baseline')}
 const names=new Set([...git('ls-files').toString().trim().split('\n'),...git('ls-files','--others','--exclude-standard').toString().trim().split('\n')].filter(Boolean));
 for(const name of names)assert.ok(baseline.includes(name)||additions.includes(name),'unlisted source '+name);
 for(const name of additions)assert.ok(fs.statSync(path.join(directory,name)).isFile(),'missing bounded source '+name);
 const source=fs.readFileSync(path.join(directory,'assets/js/outreach-people.js'),'utf8');acceptedTaskActions(source.slice(source.indexOf(' function addTaskActions('),source.indexOf(' async function detail(')));
 return{baseline:base,files:baseline.length,unchanged:baseline.length-Object.keys(modified).length,additions:additions.length};
}
async function main(){
 const result=verifySource();if(process.argv.includes('--source-only')){console.log(JSON.stringify({status:'PASS',...result}));return}
 const paths=JSON.parse(fs.readFileSync(path.join(root,'tools/site-build/public-files.json'))),git=(...args)=>execFileSync('git',['show',base+':'+args[0]],{cwd:root,maxBuffer:80*1024*1024});
 for(const p of paths)if(p!=='assets/js/outreach-people.js')assert.deepEqual(fs.readFileSync(path.join(root,p)),git(p),p+' unchanged public output');
 const build=async()=>{await buildSite({root,env:{}});return Object.fromEntries(paths.map(p=>[p,sha(fs.readFileSync(path.join(root,'dist',p)))]))};
 const first=await build(),second=await build();assert.deepEqual(first,second,'reproducible actual candidate build');
 for(const p of paths)assert.equal(first[p],sha(fs.readFileSync(path.join(root,p))),p+' source/build binding');
 console.log(JSON.stringify({status:'PASS',...result,publicFiles:paths.length,unchangedPublic:paths.length-1,buildInventorySHA256:sha(JSON.stringify(first)),hostedAcceptance:false}));
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url))await main();

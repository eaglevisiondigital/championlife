import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const sha=value=>createHash('sha256').update(value).digest('hex');
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

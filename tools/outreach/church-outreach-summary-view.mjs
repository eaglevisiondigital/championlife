// Source-only browser renderer for the PR68 trusted authentication binding.
// Not shipped in public-files.json and not mounted in PR61's staff shell.
// The renderer has no credential, RPC, authorization, export or write capability.
import {createChurchOutreachAuthBinding} from './church-outreach-auth-binding.mjs';

const FULL_UUID=/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const METRICS=Object.freeze([
 ['households','Registered households'],['adults','Adults'],
 ['minors','Children'],['attendees','Total attending'],['checked_in','Checked in']
]);

export function mountChurchOutreachSummaryView({
 root,auth,workspace,eventTarget,getAllowedCampaigns
}={}){
 if(!root||typeof root.replaceChildren!=='function'||typeof root.ownerDocument?.createElement!=='function')
  throw new TypeError('A trusted DOM root is required');
 const doc=root.ownerDocument;
 const element=(tag,text)=>{const e=doc.createElement(tag);if(text!==undefined)e.textContent=text;return e};
 let closed=false,selected=null,version=0,binding;
 // Construct with textContent only; never render untrusted HTML.
 const section=element('section'),title=element('h2','Outreach registration overview'),
  status=element('p','Choose an authorized campaign to view totals.'),
  totals=element('dl'),button=element('button','Refresh totals');
 section.setAttribute('aria-label','Campaign registration summary');
 status.setAttribute('role','status');status.setAttribute('aria-live','polite');
 totals.hidden=true;
 button.type='button';button.disabled=true;
 section.append(title,status,totals,button);
 root.replaceChildren(section);

 const hide=(message='Totals unavailable. Verify access again.')=>{
  totals.replaceChildren();totals.hidden=true;status.textContent=message;
 };
 const accept=value=>{
  if(closed)return;
  if(!value){button.disabled=true;hide('Totals cleared. Verify campaign access.');return}
  if(!selected||value.campaignId!==selected||value.kind!=='event-registration-summary'){
   hide();return;
  }
  const counts=value.counts,valid=counts && METRICS.every(([key])=>Number.isSafeInteger(counts[key])&&counts[key]>=0);
  if(!valid||counts.adults+counts.minors!==counts.attendees||counts.checked_in>counts.attendees){
   hide();return;
  }
  const fragment=doc.createDocumentFragment();
  for(const [key,label] of METRICS){
   const row=element('div'),term=element('dt',label),number=element('dd',String(counts[key]));
   number.setAttribute('data-summary-metric',key);row.append(term,number);fragment.append(row);
  }
  totals.replaceChildren(fragment);totals.hidden=false;button.disabled=false;
  status.textContent='Authorized campaign totals';
 };
 try {
  binding=createChurchOutreachAuthBinding({
   auth,workspace,eventTarget,getAllowedCampaigns,onSnapshot:accept
  });
 }catch(error){root.replaceChildren();throw error}
 const reject=code=>Object.assign(new Error(code),{code});
 const ensure=()=>{
  if(closed)throw reject('VIEW_CLOSED');
 };
 const select=campaignId=>{
  ensure();version++;selected=null;
  hide('Checking selected campaign…');button.disabled=true;
  if(typeof campaignId!=='string'||!FULL_UUID.test(campaignId)){
   binding.revoke();hide();throw reject('CAMPAIGN_NOT_ALLOWED');
  }
  try{
   binding.select(campaignId);
   selected=campaignId;button.disabled=false;
  }catch{
   binding.revoke();hide();throw reject('CAMPAIGN_NOT_ALLOWED');
  }
 };
 const refresh=async()=>{
  ensure();
  if(!selected){hide();throw reject('CAMPAIGN_NOT_ALLOWED')}
  const own=++version,id=selected;
  hide('Verifying campaign access…');button.disabled=true;
  try{
   const result=await binding.refresh();
   if(closed||own!==version||selected!==id)throw reject('STALE_SCOPE');
   // Binding's onSnapshot already rendered the verified counts.
   if(totals.hidden)throw reject('SUMMARY_REJECTED');
   return result;
  }catch{
   if(!closed&&own===version){selected=null;binding.revoke();hide()}
   throw reject('SUMMARY_UNAVAILABLE');
  }finally{
   if(!closed&&own===version)button.disabled=selected===null;
  }
 };
 const revoke=()=>{
  if(closed)return;
  version++;selected=null;button.disabled=true;
  hide();binding.revoke();
 };
 const close=()=>{
  if(closed)return;
  closed=true;version++;selected=null;button.disabled=true;
  try{binding.close()}finally{root.replaceChildren()}
 };
 button.addEventListener('click',()=>{refresh().catch(()=>{})});
 return Object.freeze({select,refresh,revoke,close});
}

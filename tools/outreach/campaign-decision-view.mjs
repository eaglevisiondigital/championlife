// Source-only staff panel. No public mount, login, contact, export or communications.
import {createCampaignDecisionAdapter} from './campaign-decision-adapter.mjs';
const STATUSES=['new','needs_contact','attempted','connected','in_progress','completed','declined'];
export function mountCampaignDecisionView({root,...bindings}){
 if(typeof root?.replaceChildren!=='function')throw new TypeError('DOM root required');
 const doc=root.ownerDocument;let adapter,closed=false;
 const el=(tag,label)=>{const node=doc.createElement(tag);if(label!==undefined)node.textContent=label;return node};
 const button=(label,handler)=>{const b=el('button',label);b.type='button';b.className='btn';b.addEventListener('click',()=>{Promise.resolve().then(handler).catch(()=>{})});return b};
 const render=s=>{
  root.replaceChildren();if(closed||!s)return;
  const section=el('section');section.className='panel';section.setAttribute('aria-label','Assigned decision registrations');
  const heading=el('h2','Assigned decisions and free-book requests'),notice=el('p','Contact, export and messaging are unavailable. Book use and course completion are not verified by this workspace.');
  const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(heading,notice,status);root.append(section);
  if(s.state==='list'){
   status.textContent=s.rows.length?'Your assigned decision registrations':'No assigned decision registrations on this page.';
   const list=el('ul');for(const r of s.rows){const item=el('li'),open=button(r.name,()=>{if(adapter.snapshot()===s)return adapter.detail(r.registrationId)});open.dataset.registrationId=r.registrationId;item.append(open,el('span',` — ${r.status.replaceAll('_',' ')}`));list.append(item)}section.append(list);const paging=el('nav');paging.setAttribute('aria-label','Assigned registration pages');const previous=button('Previous page',()=>{if(adapter.snapshot()===s&&s.page>0)return adapter.list(s.page-1)}),next=button('Next page',()=>{if(adapter.snapshot()===s&&s.rows.length===50&&s.page<9999)return adapter.list(s.page+1)});previous.disabled=s.page===0;next.disabled=s.rows.length<50||s.page>=9999;paging.append(previous,el('span',` Page ${s.page+1} `),next);section.append(paging);return;
  }
  if(s.state!=='detail'){status.textContent=s.message??(s.state==='saving'?'Saving follow-up state…':'Verifying campaign access…');return}
  status.textContent='Authorized assigned record';const record=s.record;
  section.append(el('h3',record.name),el('p',record.identityStatus==='reviewed_existing_account_link'?'Existing reviewed People relationship':'No verified People relationship available'));
  const back=button('Back to assigned list',()=>{if(adapter.snapshot()===s)return adapter.list()});section.append(back);
  if(!s.canSave){section.append(el('p','Follow-up updates are unavailable for this record.'));return}
  const form=el('form'),label=el('label','Follow-up status'),select=el('select');select.name='status';select.setAttribute('aria-label','Follow-up status');
  for(const value of STATUSES){const option=el('option',value.replaceAll('_',' '));option.value=value;option.selected=value===record.status;select.append(option)}label.append(select);
  const dateLabel=el('label','Next review date'),date=el('input');date.type='date';date.name='nextContactOn';date.value=record.nextContactOn??'';date.setAttribute('aria-label','Next review date');dateLabel.append(date);
  const save=el('button','Save follow-up state');save.type='submit';save.className='btn';form.append(label,dateLabel,save);
  // The exact immutable ticket is checked by the adapter, even for detached forms.
  form.addEventListener('submit',event=>{event.preventDefault();adapter.save(s.ticket,{status:select.value,nextContactOn:date.value||null}).catch(()=>{})});section.append(form);
 };
 adapter=createCampaignDecisionAdapter({...bindings,onSnapshot:render});
 return Object.freeze({select:(...args)=>adapter.select(...args),list:(...args)=>adapter.list(...args),detail:(...args)=>adapter.detail(...args),revoke:()=>adapter.revoke(),snapshot:()=>adapter.snapshot(),close(){closed=true;adapter.close();root.replaceChildren()}});
}

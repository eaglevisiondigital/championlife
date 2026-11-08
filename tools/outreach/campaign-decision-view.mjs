// Source-only staff panel. No public mount, login, contact, export or communications.
import {createCampaignDecisionAdapter} from './campaign-decision-adapter.mjs';
const STATUSES=['new','needs_contact','attempted','connected','in_progress','completed','declined'];
export function mountCampaignDecisionView({root,...bindings}){
 if(typeof root?.replaceChildren!=='function')throw new TypeError('DOM root required');
 const doc=root.ownerDocument;let retireForm=()=>{};let adapter,closed=false,filters={query:'',status:'',consent:''};
 const el=(tag,label)=>{const node=doc.createElement(tag);if(label!==undefined)node.textContent=label;return node};
 const button=(label,handler)=>{const b=el('button',label);b.type='button';b.className='btn';b.addEventListener('click',()=>{Promise.resolve().then(handler).catch(()=>{})});return b};
 const render=s=>{
  retireForm();root.replaceChildren();if(!s||s.state==='unavailable')filters={query:'',status:'',consent:''};if(closed||!s)return;
  const section=el('section');section.className='panel';section.setAttribute('aria-label','Assigned decision registrations');
  const heading=el('h2','Assigned decisions and free-book requests'),notice=el('p','Decision/free-book records only. Event registrations and check-in are separate. Contact details, export and messaging are unavailable. Book use is not instrumented. Discipleship status is unavailable; follow-up status is not course completion.');
  const status=el('p');status.setAttribute('role','status');status.setAttribute('aria-live','polite');section.append(heading,notice,status);root.append(section);
  if(s.state==='list'){
   // Filter only the existing assigned page, after a fresh scoped read. No server search or total is implied.
   const controls=el('fieldset'),legend=el('legend','Filter this page'),query=el('input'),state=el('select'),consent=el('select');
   query.type='search';query.name='rosterSearch';query.maxLength=100;query.value=filters.query;
   state.name='rosterStatus';consent.name='rosterConsent';
   for(const value of ['',...STATUSES]){const option=el('option',value?value.replaceAll('_',' '):'All follow-up statuses');option.value=value;option.selected=value===filters.status;state.append(option)}
   for(const [value,label]of [['','All consent states'],['yes','Ministry follow-up consent given'],['no','Withdrawn or not given']]){const option=el('option',label);option.value=value;option.selected=value===filters.consent;consent.append(option)}
   controls.append(legend);for(const [name,node]of [['Name on this page',query],['Follow-up status on this page',state],['Ministry follow-up consent',consent]]){const label=el('label',name);label.append(node);controls.append(label)}
   const apply=()=>{if(adapter.snapshot()!==s)return;const next={query:query.value.trim().slice(0,100),status:state.value,consent:consent.value};if(!['',...STATUSES].includes(next.status)||!['','yes','no'].includes(next.consent)||adapter.snapshot()!==s)return;filters=next;return adapter.list(s.page)};
   controls.append(button('Apply filters',apply),button('Clear filters',()=>{if(adapter.snapshot()!==s)return;filters={query:'',status:'',consent:''};return adapter.list(s.page)}),button('Refresh this page',()=>{if(adapter.snapshot()===s)return adapter.list(s.page)}));
   query.addEventListener('keydown',event=>{if(event.key==='Enter'){event.preventDefault();Promise.resolve().then(apply).catch(()=>{})}});
   section.append(controls,el('p','Filters apply only to this loaded page, not all campaign signups. Use Previous/Next to review other assigned pages.'));
   const rows=s.rows.filter(r=>(!filters.query||r.name.toLocaleLowerCase().includes(filters.query.toLocaleLowerCase()))&&(!filters.status||r.status===filters.status)&&(!filters.consent||r.consent===(filters.consent==='yes')));
   status.textContent=`${rows.length} of ${s.rows.length} assigned records on this page.`;
   const list=el('ul');for(const r of rows){const item=el('li'),open=button(r.name,()=>{if(adapter.snapshot()===s)return adapter.detail(r.registrationId)});open.dataset.registrationId=r.registrationId;item.append(open,el('p',`Follow-up: ${r.status.replaceAll('_',' ')} · Next review: ${r.nextContactOn??'Not scheduled'}`),el('p',r.consent?'Follow-up consent: given':'Follow-up consent: withdrawn or not given'));list.append(item)}section.append(list);
   if(!rows.length)section.append(el('p',s.rows.length?'No matches on this page. Clear filters or review another assigned page.':'No assigned decision registrations on this page.'));const paging=el('nav');paging.setAttribute('aria-label','Assigned registration pages');const previous=button('Previous page',()=>{if(adapter.snapshot()===s&&s.page>0)return adapter.list(s.page-1)}),next=button('Next page',()=>{if(adapter.snapshot()===s&&s.rows.length===50&&s.page<9999)return adapter.list(s.page+1)});previous.disabled=s.page===0;next.disabled=s.rows.length<50||s.page>=9999;paging.append(previous,el('span',` Page ${s.page+1} `),next);section.append(paging);return;
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
  section.append(form);
  // A removed/reinserted form or descendant never regains authority from its old ticket.
  // Normal saving intentionally replaces the view; retirement here does not cancel an already initiated intent.
  const Observer=doc.defaultView?.MutationObserver;let retired=false,observer;
  const nodes=new Set([form,...form.querySelectorAll('*')]);for(let node=form.parentNode;node;node=node.parentNode)nodes.add(node);
  retireForm=()=>{retired=true;observer?.disconnect()};
  const invalidate=()=>{if(retired)return;retireForm();adapter.revoke()};
  const inspect=records=>{if(records.some(record=>[...record.removedNodes].some(node=>[...nodes].some(bound=>node===bound||node.contains?.(bound)))))invalidate()};
  if(typeof Observer==='function'&&doc.documentElement){observer=new Observer(inspect);observer.observe(doc.documentElement,{childList:true,subtree:true})}else retired=true;
  form.addEventListener('submit',event=>{event.preventDefault();inspect(observer?.takeRecords()??[]);if(retired)return;if(!form.isConnected||!root.contains(form)){invalidate();return}if(adapter.snapshot()!==s)return;adapter.save(s.ticket,{status:select.value,nextContactOn:date.value||null}).catch(()=>{})});
 };
 adapter=createCampaignDecisionAdapter({...bindings,onSnapshot:render});
 return Object.freeze({select:(...args)=>{filters={query:'',status:'',consent:''};return adapter.select(...args)},list:(...args)=>adapter.list(...args),detail:(...args)=>adapter.detail(...args),revoke:()=>adapter.revoke(),snapshot:()=>adapter.snapshot(),close(){closed=true;adapter.close();root.replaceChildren()}});
}

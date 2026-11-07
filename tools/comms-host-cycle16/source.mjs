// Test-only exact-source composition. No runtime mounting or alternate Auth client.
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
export const root=new URL('../../',import.meta.url);
export const host='7fde897cdbb6ae423cfdeec434a3b548fbc5aa4d',communications='d88f8382e8fe0b5c4fbd40da254f9d6caf4a60d9';
export const runtime='assets/js/communications.js';
export const hash=b=>createHash('sha256').update(b).digest('hex');
export const original=(path,commit=host)=>execFileSync('git',['--no-replace-objects','show',commit+':'+path],{cwd:root,maxBuffer:64*1024*1024});
const pins={host:'19afae3ebec9a058ef35a1fce1625b77d674a53a2ae398c431fdd7ed8fdab4f3',communications:'9e7a7698d7da191e2f9c0ca34e707abfea19978948b1c3d71a1df164ff3780dc'};
export function compose(prior=original(runtime),latest=original(runtime,communications)){
 assert.equal(hash(prior),pins.host,'Exact existing Staff115 runtime');assert.equal(hash(latest),pins.communications,'Exact reviewed Communications77 runtime');
 let text=prior.toString();const incoming=latest.toString();
 const replace=(before,after)=>{assert.equal(text.split(before).length,2,'Unique existing host boundary');text=text.replace(before,after)};
 const start=' // A removed control is a retired intent, even if the same node is reinserted',end='\n function retire(';
 assert.equal(incoming.split(start).length,2);assert.equal(incoming.split(end).length,2);
 const lifetime=incoming.slice(incoming.indexOf(start),incoming.indexOf(end));
 replace(end,'\n'+lifetime+end);
 replace('retired=retired||permanent;root.replaceChildren();','retired=retired||permanent;if(retired)lifetimeObserver.disconnect();root.replaceChildren();');
 replace('function attached(){if(window.ChampionLifeAuth','function attached(){if(!mounted())return false;if(window.ChampionLifeAuth');
 replace('(!b.control||root.contains(b.control))','(!b.control||(!removedControls.has(b.control)&&root.contains(b.control)))');
 // Preserve selected host-owned scope, lifecycle, authority and denial contract.
 assert(text.includes('window.StaffWorkspace.active()'));assert(text.includes("window.dispatchEvent(new Event('staff-access-denied'))"));
 assert(!text.includes('function scopePicker'));assert(!text.includes('StaffWorkspace.state('));assert(!text.includes('createClient('));
 return Buffer.from(text);
}

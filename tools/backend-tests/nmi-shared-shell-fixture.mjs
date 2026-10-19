// Module-owned DOM fixtures use the same explicit route injection as the build.
import assert from 'node:assert/strict';
import {readFileSync,existsSync} from 'node:fs';
const root=new URL('../../',import.meta.url);
export function sharedShellFixture(){
 const source=readFileSync(new URL('assets/js/staff-workspace.js',root),'utf8');
 const files=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root),'utf8'));
 const marker='/* GATE0_ROUTES */ []';
 assert.equal(source.split(marker).length,2,'Exactly one reviewed build-injection marker');
 return source.replace(marker,()=>JSON.stringify(files.filter(p=>/^staff-[a-z0-9-]+\.html$/.test(p))));
}
export function hasAccessibleLabel(control){
 if(control.getAttribute('aria-label')?.trim())return true;
 const ids=control.getAttribute('aria-labelledby')?.trim().split(/\s+/);
 if(ids?.length&&ids.every(id=>control.ownerDocument.getElementById(id)?.textContent.trim()))return true;
 return [...(control.labels||[])].some(label=>label.textContent.trim());
}
export function hasSharedRecovery(document){
 const main=document.querySelector('#staff-main'),card=main?.querySelector(':scope > .staff-state[role="status"]');
 if(!card||main.children.length!==1||card.querySelector('h2')?.textContent!=='Access changed')return false;
 const link=card.querySelector('a[href]');if(!link?.textContent.trim())return false;
 const target=new URL(link.getAttribute('href'),document.baseURI),local=new URL(document.baseURI);
 if(target.origin!==local.origin)return false;
 const file=target.pathname.replace(/^\/+/,''),files=JSON.parse(readFileSync(new URL('tools/site-build/public-files.json',root),'utf8'));
 return /^staff-[a-z0-9-]+\.html$/.test(file)&&files.includes(file)&&existsSync(new URL(file,root))&&!main.querySelector('table,form,input,select,textarea,dialog');
}

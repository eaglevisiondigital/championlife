// No Auth implementation fork: the inline script and equivalent DOM suite are
// mechanically derived from reviewed canonical source with bounded substitutions.
import {readFile,writeFile} from 'node:fs/promises';
import {fileURLToPath} from 'node:url';
import path from 'node:path';
import assert from 'node:assert/strict';
export const root=fileURLToPath(new URL('../../',import.meta.url));
export const context=Object.freeze({callback:'/outreach-login.html',fallback:'/outreach.html',storage:'championlife-outreach-auth-next'});
export const preservedHashes=Object.freeze({
 'discipleship-login.html':'7e783b81c580aad730c0ddceed5ef045d56e958d0192bffa2c58b0fb9b0d994b',
 'assets/js/champion-life-auth.js':'f1d277ea1cb5cf608de471b0a62f6ae41c9ecdc3b675960628083ee4e1df3cb4',
 'assets/js/staff-session.js':'3cdb0357988d022bd8f9a9ad8fb95f8ff3d44841444993b7f20eb2193e3656a4',
 'assets/images/sowgo-logo.png':'3cddfc935317290967f98e7697cee625756141706e7b46c72d96fba3af4d219c'
});
function replaceExact(source,from,to,count){assert.equal(source.split(from).length-1,count,'review changed canonical context occurrence: '+from);return source.replaceAll(from,to)}
export function inline(html){const matches=[...html.matchAll(/<script>\n([\s\S]*?)<\/script>/g)];assert.equal(matches.length,1,'exactly one canonical inline script');return matches[0][1]}
export function adaptScript(source){
 let result=replaceExact(source,"const fallback = '/my-discipleship.html';",`const fallback = '${context.fallback}';`,1);
 result=replaceExact(result,"new URL('/discipleship-login.html', location.origin)",`new URL('${context.callback}', location.origin)`,1);
 return replaceExact(result,'championlife-auth-next',context.storage,3);
}
export function adaptSuite(source){
 let result=replaceExact(source,'discipleship-login.html','outreach-login.html',5);
 result=replaceExact(result,"const fallback = '/my-discipleship.html';",`const fallback = '${context.fallback}';`,1);
 result=replaceExact(result,'championlife-auth-next',context.storage,2);
 result=replaceExact(result,'focused login scenarios','focused Outreach login scenarios',1);
 return '// Generated from login.dom.mjs by ../outreach-login/generate.mjs; synthetic Auth only.\n'+result;
}
export function adaptStaffSession(source){
 let result=replaceExact(source,"const login='discipleship-login.html?next=%2Fstaff-people.html';","const login='outreach-login.html?next='+encodeURIComponent(location.pathname+location.search);",1);
 return replaceExact(result,'championlife-auth-next',context.storage,1);
}
export function adaptStaffSuite(source){
 let result=replaceExact(source,'assets/js/staff-session.js','assets/js/outreach-staff-session.js',1);
 result=replaceExact(result,"['staff-people.html','staff-outreach-registration.html','staff-outreach-partners.html']","['staff-outreach-team-travel.html']",1);
 result=replaceExact(result,'championlife-auth-next',context.storage,2);
 result=replaceExact(result,"location:{replace:","location:{pathname:'/'+page,search:'',replace:",1);
 result=replaceExact(result,'discipleship-login.html?next=%2Fstaff-people.html','outreach-login.html?next=%2Fstaff-outreach-team-travel.html',1);
 result=replaceExact(result,'staff session and account-switch assertions','Outreach staff session and account-switch assertions',1);
 return '// Generated from staff-session.dom.mjs by ../outreach-login/generate.mjs; synthetic Auth only.\n'+result;
}
export async function verifyGenerated({write=false}={}){
 const canonical=await readFile(path.join(root,'discipleship-login.html'),'utf8'),targetPath=path.join(root,'outreach-login.html');
 const target=await readFile(targetPath,'utf8'),script=adaptScript(inline(canonical));
 const suite=adaptSuite(await readFile(path.join(root,'tools/backend-tests/login.dom.mjs'),'utf8')),suitePath=path.join(root,'tools/backend-tests/outreach-login.dom.mjs');
 const staff=adaptStaffSession(await readFile(path.join(root,'assets/js/staff-session.js'),'utf8')),staffPath=path.join(root,'assets/js/outreach-staff-session.js');
 const staffSuite=adaptStaffSuite(await readFile(path.join(root,'tools/backend-tests/staff-session.dom.mjs'),'utf8')),staffSuitePath=path.join(root,'tools/backend-tests/outreach-staff-session.dom.mjs');
 if(write){inline(target);await writeFile(targetPath,target.replace(/<script>\n[\s\S]*?<\/script>/,()=>'<script>\n'+script+'</script>'));await writeFile(suitePath,suite);await writeFile(staffPath,staff);await writeFile(staffSuitePath,staffSuite)}
 else{assert.equal(inline(target),script,'Outreach inline Auth may differ only in the reviewed context');assert.equal(await readFile(suitePath,'utf8'),suite,'Outreach security matrix must remain equivalent to canonical login tests')}
 if(!write){assert.equal(await readFile(staffPath,'utf8'),staff,'P1 staff session must retain canonical clearing behavior');assert.equal(await readFile(staffSuitePath,'utf8'),staffSuite,'P1 staff session security matrix must remain equivalent')}
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 await verifyGenerated({write:process.argv.includes('--write')});
 console.log('Outreach login '+(process.argv.includes('--write')?'generated':'verified')+' from canonical source; callback/fallback/storage context only');
}

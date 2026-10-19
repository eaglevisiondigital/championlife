// Test-artifact inventory only. Never used to authorize a deployment or payment.
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {createHash} from 'node:crypto';
export const compositionPins=Object.freeze({
 production:'e3157f0afa3f563ab6560ca64c9049448f02c806',
 nmi:'d82ed7fdb049389ae43d50a2ceb1ac300665a7cc',
 outreach:'bff9612ac9385cf963c5e7e41f9091da7af86cf0'
});
export const outreachPageHashes=Object.freeze({
 'staff-outreach-registration.html':'f7184d91c934bdd5d3b6fceed38354a658b01ffaedc7571e845d123b72e0343c',
 'staff-people.html':'ab681be65a6898af1c8b1a96c26caa372200b50ec5077f7d70aa56ec20041098'
});
export const outreachSQLHashes=Object.freeze({
 '20261019004611_unified_outreach_staff_partner.sql':'418862e6e22a5c3280958253ade398a7f9e362f039c312a971d9d063e692749f',
 '20261019004612_unified_outreach_workflow_foundation.sql':'3ba064f7900624ca32faa95befa1d1de702ce3e428cc74131aac737581bff0f2',
 '20261019004613_unified_outreach_operations.sql':'e6ebf423e395f65cac1d0e60913c6877c78bfdbbd193b714e7d9d56dc870ddfb',
 '20261019004614_unified_outreach_security.sql':'a361cff97ec94cad6994d23529d89990f71d772dc2341caa64f63673f9d92030'
});
const sha256=b=>createHash('sha256').update(b).digest('hex');
const blob=b=>createHash('sha1').update(Buffer.from('blob '+b.length+'\0')).update(b).digest('hex');
export function diskInventory(root){
 return {read:name=>readFileSync(new URL(name,root)),files:()=>readdirSync(new URL('supabase/migrations/',root)).filter(x=>x.endsWith('.sql'))};
}
function combinedComposition(read){
 let marker,hasMarker=false;
 try{marker=JSON.parse(read('config/platform/composition.json'));hasMarker=true;}
 catch(error){if(error.code!=='ENOENT')throw error;}
 let combined=false;
 if(hasMarker){
  assert(marker&&typeof marker==='object'&&!Array.isArray(marker),'Invalid composition identity');
  const modules=marker.modules;
  assert(modules?.join(',')==='nmi'||modules?.join(',')==='nmi,outreach','Only explicit NMI or NMI+Outreach composition');
  assert.deepEqual(marker,{schema:1,production:compositionPins.production,modules,sourceHeads:Object.fromEntries(modules.map(m=>[m,compositionPins[m]]))},'Exact composition identity');
  const pins=JSON.parse(read('config/platform/gate0-sources.json'));
  for(const [key,value]of Object.entries(compositionPins))assert.equal(pins[key],value,'Gate0 source pin: '+key);
  combined=modules.length===2;
  if(combined)for(const [name,hash]of Object.entries({...outreachPageHashes,...Object.fromEntries(Object.entries(outreachSQLHashes).map(([n,h])=>['supabase/migrations/'+n,h]))})){
   assert.equal(pins.sources?.outreach?.[name],hash,'Pinned Outreach source inventory: '+name);
  }
 }
 return combined;
}
export function selectIntegrationMigrationOrder({read,files,nmiOrder}){
 const combined=combinedComposition(read);
 const migrationOrder=[...nmiOrder,...(combined?Object.keys(outreachSQLHashes):[])].sort();
 // Validate all physical files and hashes before any fixture receives the order.
 verifyIntegrationInventory({read,files,nmiOrder,migrationOrder});
 return Object.freeze(migrationOrder);
}
export function verifyIntegrationInventory({read,files,nmiOrder,migrationOrder}){
 const protectedFiles=JSON.parse(read('docs/NMI-CUTOVER-PROTECTED-FILES.json'));
 assert.equal(protectedFiles.production_commit,compositionPins.production,'Protected production base');
 assert.equal(Object.keys(protectedFiles.files).length,449,'All 449 protected paths remain checked');
 assert.equal(nmiOrder.length,38,'Dedicated NMI inventory remains 38');
 const combined=combinedComposition(read);
 // A malformed/present identity must fail; only ENOENT selects standalone mode.
 const expected=[...nmiOrder,...(combined?Object.keys(outreachSQLHashes):[])].sort();
 assert.deepEqual(migrationOrder,expected,'Exact selected migration order');
 assert.deepEqual(files().sort(),expected,'Exact physical SQL inventory');
 for(const [name,hash]of Object.entries(protectedFiles.files)){
  const content=read(name);
  if(combined&&Object.hasOwn(outreachPageHashes,name))assert.equal(sha256(content),outreachPageHashes[name],'Frozen Outreach staff file: '+name);
  else assert.equal(blob(content),hash,'Protected production file: '+name);
 }
 if(combined)for(const [name,hash]of Object.entries(outreachSQLHashes))assert.equal(sha256(read('supabase/migrations/'+name)),hash,'Frozen Outreach SQL: '+name);
 return {mode:combined?'nmi+outreach':'nmi',protectedCount:449,migrationCount:expected.length};
}

// Disposable read overlays exercise fail-closed guards without changing source files.
import assert from 'node:assert/strict';
import {diskInventory,verifyIntegrationInventory,compositionPins,outreachPageHashes,outreachSQLHashes,selectIntegrationMigrationOrder} from './nmi-integration-inventory.mjs';
import {productionOrder,givingOrder,integrationOrder,executionOrder,gate0Order,migrationOrder} from './migration-order.mjs';
const root=new URL('../../',import.meta.url),source=diskInventory(root);
const nmiOrder=[...productionOrder,...givingOrder,...integrationOrder,...executionOrder,...gate0Order];
const base={...source,nmiOrder,migrationOrder};
export const integrationInventory=verifyIntegrationInventory(base);
assert.deepEqual(selectIntegrationMigrationOrder(base),migrationOrder);
let checks=2;
const reject=(overlays,expected,options={})=>{
 const read=name=>Object.hasOwn(overlays,name)?Buffer.from(overlays[name]):source.read(name);
 assert.throws(()=>verifyIntegrationInventory({...base,...options,read}),expected);checks++;
};
const marker=modules=>({schema:1,production:compositionPins.production,modules,sourceHeads:Object.fromEntries(modules.map(m=>[m,compositionPins[m]]))});
const combined=marker(['nmi','outreach']);
const markerOverlay=x=>({'config/platform/composition.json':JSON.stringify(x)});
for(const value of [null,false,[],{},marker(['outreach']),{...combined,schema:2},{...combined,production:'0'.repeat(40)},{...combined,unexpected:true},{...combined,sourceHeads:{...combined.sourceHeads,outreach:'0'.repeat(40)}}])reject(markerOverlay(value),/composition|Composition/);
reject({'config/platform/composition.json':'{'},SyntaxError);
const pins=JSON.parse(source.read('config/platform/gate0-sources.json'));
reject({...markerOverlay(combined),'config/platform/gate0-sources.json':JSON.stringify({...pins,outreach:'0'.repeat(40)})},/Gate0 source pin: outreach/);
for(const path of ['staff-people.html','supabase/migrations/'+Object.keys(outreachSQLHashes)[0]]){
 const modified=structuredClone(pins);modified.sources.outreach[path]='0'.repeat(64);
 reject({...markerOverlay(combined),'config/platform/gate0-sources.json':JSON.stringify(modified)},/Pinned Outreach source inventory/);
}
reject({},/Exact physical SQL inventory/,{files:()=>[...source.files(),'20990101000000_unreviewed.sql']});
reject({},/Exact selected migration order/,{migrationOrder:[...migrationOrder].reverse()});
reject({'index.html':'changed protected page'},/Protected production file: index.html/);
if(integrationInventory.mode==='nmi+outreach'){
 for(const path of Object.keys(outreachPageHashes)){reject({[path]:'changed sibling page'},new RegExp('Frozen Outreach staff file: '+path));assert.throws(()=>selectIntegrationMigrationOrder({...base,read:name=>name===path?Buffer.from('changed'):source.read(name)}),/Frozen Outreach staff file/);checks++;}
 for(const path of Object.keys(outreachSQLHashes)){const file='supabase/migrations/'+path;reject({[file]:'changed sibling SQL'},new RegExp('Frozen Outreach SQL: '+path));assert.throws(()=>selectIntegrationMigrationOrder({...base,read:name=>name===file?Buffer.from('changed'):source.read(name)}),/Frozen Outreach SQL/);checks++;}
 reject({},/Exact physical SQL inventory/,{files:()=>source.files().filter(x=>x!==Object.keys(outreachSQLHashes)[0])});
}else{
 // Removing the marker never admits sibling inventory, even with correct source pins.
 reject({},/Exact physical SQL inventory/,{files:()=>[...source.files(),...Object.keys(outreachSQLHashes)]});
}
console.log(`PASS NMI inventory guards: ${checks} checks; ${integrationInventory.mode}; ${integrationInventory.protectedCount} protected paths; ${integrationInventory.migrationCount} exact SQL; malformed/wrong pins, changed files and extra SQL rejected`);

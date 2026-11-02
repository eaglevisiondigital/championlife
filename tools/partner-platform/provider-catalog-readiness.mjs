// OFFLINE READ-ONLY ASSESSMENT. No connector, environment, SQL execution, pin
// replacement, role installation or ability to authorize/mount a provider host.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {pathToFileURL} from 'node:url';
const local=JSON.parse(readFileSync(new URL('./fixtures/auth-local-catalog.json',import.meta.url),'utf8'));
const pins=JSON.parse(readFileSync(new URL('./fixtures/issue50-installed-provenance.json',import.meta.url),'utf8'));
const names=['auth.users','auth.sessions'];
const fields=['columns','constraints','indexes','policies','owner','rls'];
const hash=x=>createHash('sha256').update(JSON.stringify(x)).digest('hex');
const canonical=x=>Array.isArray(x)?x.map(canonical):x&&typeof x==='object'?Object.fromEntries(Object.keys(x).sort().map(k=>[k,canonical(x[k])])):x;
const record=x=>x!==null&&typeof x==='object'&&!Array.isArray(x)&&Object.getPrototypeOf(x)===Object.prototype;
const exact=(x,keys)=>record(x)&&Object.keys(x).length===keys.length&&keys.every(k=>Object.hasOwn(x,k));
for(const name of names)if(hash(local.definitions[name])!==pins.relations[name])throw Error('Frozen local Auth definition does not match original pin');
export function assessPartnerProviderCatalog(input){
 const result={readiness:'NO_GO',mayMount:false,mayInstall:false,sampledFieldsMatchFixture:false,
  authRelations:[],databasePublicPrivilegeConflict:null,unresolved:[
   'Full 23-function / 17-relation runtime provenance has not been captured by this two-table assessment.',
   'Provider Auth migration lineage, live session retirement and row-lock behavior require separate reviewed evidence.',
   'Credential custody, dedicated execution identity, independent recovery/cleanup and genuine acceptance remain required.'
  ]};
 if(!exact(input,['serverVersion','serverVersionNumber','publicDatabasePrivileges','relations'])||
  typeof input.serverVersion!=='string'||input.serverVersion.length>100||!/^\d{5,6}$/.test(input.serverVersionNumber)||
  !exact(input.publicDatabasePrivileges,['CREATE','TEMPORARY'])||Object.values(input.publicDatabasePrivileges).some(v=>typeof v!=='boolean')||
  !exact(input.relations,names))return{...result,invalidMetadata:true};
 result.databasePublicPrivilegeConflict=input.publicDatabasePrivileges.CREATE||input.publicDatabasePrivileges.TEMPORARY;
 for(const name of names){
  const actual=input.relations[name],expected=local.definitions[name];
  if(!exact(actual,['owner','rls','forceRls','acl','columns','constraints','indexes','policies'])||
   typeof actual.owner!=='string'||typeof actual.rls!=='boolean'||typeof actual.forceRls!=='boolean'||
   !(actual.acl===null||typeof actual.acl==='string')||!Array.isArray(actual.columns)||
   actual.columns.some(c=>!Array.isArray(c)||c.length!==4||typeof c[0]!=='string'||typeof c[1]!=='string'||typeof c[2]!=='boolean'||!(c[3]===null||typeof c[3]==='string'))||
   ['constraints','indexes','policies'].some(k=>!(actual[k]===null||Array.isArray(actual[k])))){
   result.authRelations.push({name,invalidMetadata:true});continue;
  }
  // Do not publish column names, policy expressions or ACLs. This projection
  // exposes structural differences and hashes only; raw capture stays private.
  result.authRelations.push({name,localColumns:expected.columns.length,observedColumns:actual.columns.length,
   originalRuntimePin:pins.relations[name],observedMetadataSha256:hash(canonical(actual)),
   differingFields:fields.filter(k=>hash(actual[k])!==hash(expected[k])),
   coverage:'Partial catalog only: capture omits triggers and effective caller privileges.'});
 }
 result.sampledFieldsMatchFixture=result.authRelations.every(r=>!r.invalidMetadata&&r.differingFields.length===0);
 if(result.databasePublicPrivilegeConflict)result.unresolved.unshift('Effective PUBLIC CREATE/TEMP cannot be denied for one login; shared production ACL changes are not authorized.');
 if(!result.sampledFieldsMatchFixture)result.unresolved.unshift('Observed managed Auth catalog does not match frozen fictional Auth pins. Preserve originals; a separate exact provider profile requires independent review.');
 return result;
}
if(process.argv[1]&&import.meta.url===pathToFileURL(process.argv[1]).href){
 if(process.argv.length!==3)throw Error('Supply one private catalog JSON path; no connection or URL accepted.');
 const report=assessPartnerProviderCatalog(JSON.parse(readFileSync(process.argv[2],'utf8')));
 process.stdout.write(JSON.stringify(report,null,2)+'\n');
}

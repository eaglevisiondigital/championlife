// TEST ONLY. Called solely after disposable canonicalSourceFixture setup.
// Reads catalog metadata, never identity/source/account rows. Does not alter pins.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {createRequire} from 'node:module';
import {canonicalSourceFixture} from './canonical-source-fixture.mjs';
import {verifyCanonicalRepositoryProvenance} from './canonical-repository.mjs';
const require=createRequire(new URL('../backend-tests/package.json',import.meta.url));
const {PGlite}=require('@electric-sql/pglite');
const expected=JSON.parse(readFileSync(new URL('./fixtures/issue50-installed-provenance.json',import.meta.url),'utf8'));
// Extract only the two literal catalog SELECTs, so diagnostics cannot quietly
// diverge from the unchanged runtime verifier. Fail if its query shape changes.
const queries=[...verifyCanonicalRepositoryProvenance.toString().matchAll(/connection\.query\(`([\s\S]*?)`,\[(signature|relation)\]\)/g)];
if(queries.length!==2||queries[0][2]!=='signature'||queries[1][2]!=='relation')throw Error('Catalog diagnostic query contract changed');
const hash=value=>createHash('sha256').update(JSON.stringify(value)).digest('hex');
export async function captureCanonicalCatalog(connection){
 const catalog={version:null,functions:{},relations:{}};
 await connection.query('begin');
 try{
  await connection.query('set local search_path=pg_catalog,public');
  catalog.version=(await connection.query("select current_setting('server_version') version,current_setting('server_version_num') version_num")).rows[0];
  for(const signature of Object.keys(expected.functions))catalog.functions[signature]=(await connection.query(queries[0][1],[signature])).rows;
  for(const relation of Object.keys(expected.relations))catalog.relations[relation]=(await connection.query(queries[1][1],[relation])).rows.map(row=>row.definition);
 }finally{await connection.query('rollback')}
 return catalog;
}
export function compareCanonicalCatalog(actual,baseline){
 const mismatches=[];
 for(const kind of ['functions','relations'])for(const name of Object.keys(expected[kind])){
  const rows=actual[kind][name],reference=baseline[kind][name];
  if(rows?.length!==1||reference?.length!==1){mismatches.push({kind,name,actualRows:rows?.length??null,baselineRows:reference?.length??null});continue}
  const valid=kind==='functions'?JSON.stringify(rows[0])===JSON.stringify(expected.functions[name]):hash(rows[0])===expected.relations[name];
  if(valid)continue;
  const fields=[...new Set([...Object.keys(reference[0]),...Object.keys(rows[0])])].filter(key=>JSON.stringify(rows[0][key])!==JSON.stringify(reference[0][key]));
  mismatches.push({kind,name,expectedHash:kind==='functions'?hash(expected.functions[name]):expected.relations[name],actualHash:hash(rows[0]),fields:fields.map(field=>({field,expected:reference[0][field],actual:rows[0][field]}))});
 }
 return {baselineVersion:baseline.version,actualVersion:actual.version,mismatches};
}
export async function diagnoseCanonicalFixtureCatalog(nativeConnection){
 const db=new PGlite();
 try{
  await canonicalSourceFixture(db);
  const baseline=await captureCanonicalCatalog(db);
  const baselineReport=compareCanonicalCatalog(baseline,baseline);
  if(baselineReport.mismatches.length)throw Error('Accepted PGlite fixture no longer matches committed pins');
  const actual=await captureCanonicalCatalog(nativeConnection);
  return compareCanonicalCatalog(actual,baseline);
 }finally{await db.close()}
}

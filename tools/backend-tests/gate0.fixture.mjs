import {execFileSync} from 'node:child_process';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import assert from 'node:assert/strict';
import {PGlite} from '@electric-sql/pglite';
import {localPostgres} from './local-postgres.mjs';
export const root=new URL('../../',import.meta.url);
export const read=p=>readFileSync(new URL(p,root),'utf8');
export const pins=JSON.parse(read('config/platform/gate0-sources.json'));
export const registry=JSON.parse(read('config/platform/capabilities.json'));
export const git=(...args)=>execFileSync('git',args,{cwd:root,encoding:'utf8',maxBuffer:20*1024*1024});
export function source(ref,p){const s=git('show',ref+':'+p),track=Object.keys(pins.sources).find(k=>pins[k]===ref);if(track&&pins.sources[track][p])assert.equal(createHash('sha256').update(s).digest('hex'),pins.sources[track][p]);return s;}
export const baseline=git('ls-tree','-r','--name-only',pins.production,'supabase/migrations').trim().split('\n').sort();
export const paths=track=>Object.keys(pins.sources[track]).filter(p=>p.startsWith('supabase/migrations/')).sort();
export const gatePath='supabase/migrations/20261019012735_shared_platform_gate0.sql';
export async function apply(db,track){
 for(const p of paths(track)){
  const before=(await db.query('select private.staff_permission_keys() k')).rows[0].k;
  await db.exec(source(pins[track],p));
  const after=(await db.query('select private.staff_permission_keys() k')).rows[0].k;
  assert.ok(before.every(k=>after.includes(k)),p+' destructively narrows installed capabilities');
 }
}
export async function database(){
 const db=process.env.TEST_NATIVE_PG==='1'?await localPostgres():new PGlite();
 await db.exec(source(pins.outreach,'tools/backend-tests/fixtures/unified-bootstrap.sql'));
 await db.exec(read('supabase/bootstrap/automatic-rls.sql'));
 for(const p of baseline)await db.exec(source(pins.production,p));
 return db;
}

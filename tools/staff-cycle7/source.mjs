// TEST-ONLY Git blob reader. No fetch, file materialization, SQL installation or host mount.
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
const root=new URL('../../',import.meta.url);
const sha=bytes=>createHash('sha256').update(bytes).digest('hex');
const manifestBytes=readFileSync(new URL('./sources.json',import.meta.url));
const expectedManifest='cdf357bda500b0648dcf592c4461d0a6c8f93ef8b6beeeebab216b47714822b8';
if(sha(manifestBytes)!==expectedManifest)throw Error('UNREVIEWED_SOURCE_MANIFEST');
const manifest=JSON.parse(manifestBytes);
const freeze=value=>{if(value&&typeof value==='object'){for(const child of Object.values(value))freeze(child);Object.freeze(value)}return value};
const ids=new Set();
for(const row of manifest.sources){
 if(!/^[a-zA-Z][a-zA-Z0-9]+$/.test(row.id)||ids.has(row.id)||manifest.heads[row.source]!==row.commit||!/^[0-9a-f]{40}$/.test(row.commit)||!/^[0-9a-f]{64}$/.test(row.sha256)||!Number.isSafeInteger(row.bytes)||row.bytes<1||row.bytes>8*1024*1024||row.path.includes('..')||! /^(?:assets\/(?:js|css)\/[a-z0-9-]+\.(?:js|css)|staff-[a-z0-9-]+\.html|tools\/(?:site-build|backend-tests)\/[a-z0-9.-]+\.(?:mjs|json)|tools\/(?:backend-tests|forms-core)\/fixtures\/[a-z0-9-]+\.sql|supabase\/(?:bootstrap|migrations)\/[a-z0-9_-]+\.sql)$/.test(row.path))throw Error('INVALID_SOURCE_ENTRY');
 ids.add(row.id);
}
freeze(manifest);
export const sourceManifest=manifest;
function rowFor(id){if(typeof id!=='string'||!ids.has(id))throw Error('SOURCE_ID_NOT_ALLOWLISTED');return manifest.sources.find(row=>row.id===id)}
export function loadSource(id){
 const row=rowFor(id);
 // Disable Git replacement refs. Only exact regular blob paths can be read;
 // no branch resolution, executable filters, symlink following or remote fallback.
 const tree=execFileSync('git',['--no-replace-objects','ls-tree',row.commit,'--',row.path],{cwd:root,encoding:'utf8',stdio:['ignore','pipe','pipe']});
 if(!/^100644 blob [0-9a-f]{40}\t/.test(tree)||tree.trim().split('\t')[1]!==row.path)throw Error('SOURCE_NOT_REGULAR_BLOB');
 const bytes=execFileSync('git',['--no-replace-objects','show',`${row.commit}:${row.path}`],{cwd:root,maxBuffer:8*1024*1024,stdio:['ignore','pipe','pipe']});
 if(bytes.length!==row.bytes||sha(bytes)!==row.sha256)throw Error('SOURCE_BYTES_MISMATCH');
 return new TextDecoder('utf-8',{fatal:true}).decode(bytes);
}
export function verifySources(){for(const row of manifest.sources)loadSource(row.id);return manifest.sources}
export function loadSources(){return Object.freeze(Object.fromEntries(manifest.sources.map(row=>[row.id,loadSource(row.id)])))}

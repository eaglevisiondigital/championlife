// Independent guard review. No shared-worktree mutations or application execution.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {fileURLToPath} from 'node:url';
import {verifyComposition, checkpointReader, current, original, root} from './overrides.mjs';

const bytes = current('tools/staff-cycle9-integrity/overrides.json');
const append = value => Buffer.concat([value, Buffer.from('\n/* independent tamper */')]);
test('actual source is verified before the historical checkpoint is projected', () => {
  verifyComposition();
  const read = checkpointReader();
  assert.deepEqual(read('assets/js/communications.js'), current('assets/js/communications.js'));
  assert.deepEqual(read('assets/js/outreach-people.js'), original('assets/js/outreach-people.js'));
});
for (const path of ['baptism-interest.html', 'give.html', 'assets/js/champion-life-auth.js', 'assets/js/staff-session.js', 'assets/js/outreach-people.js', 'assets/js/forms-admin.js']) {
  test('actual read rejects independent mutation: ' + path, () => {
    assert.throws(() => verifyComposition(bytes, p => p === path ? append(current(p)) : current(p)), /Protected actual public source|Reviewed Cycle9/);
  });
}
test('unreviewed manifest cannot bless a changed public source', () => {
  const m = JSON.parse(bytes); m.existing['give.html'] = {originalSHA256: '0'.repeat(64), reviewedSHA256: '0'.repeat(64)};
  assert.throws(() => verifyComposition(Buffer.from(JSON.stringify(m))), /Exact independently reviewed Cycle9 manifest/);
});
for (const mutation of ['add private input', 'remove current page', 'duplicate page', 'reorder union']) {
  test('public manifest refuses ' + mutation, () => {
    const files = JSON.parse(current('tools/site-build/public-files.json'));
    if (mutation === 'add private input') files.push('audit/private.txt');
    if (mutation === 'remove current page') files.splice(files.indexOf('give.html'), 1);
    if (mutation === 'duplicate page') files.push('give.html');
    if (mutation === 'reorder union') files.reverse();
    assert.throws(() => verifyComposition(bytes, p => p === 'tools/site-build/public-files.json' ? Buffer.from(JSON.stringify(files)) : current(p)), /Reviewed Cycle9/);
  });
}
for (const path of ['tools/staff-host-cycle8/overrides.json', 'tools/staff-host-cycle8/overrides.mjs', 'tools/backoffice-composition/source-manifest.json', 'tools/staff-module-navigation/source-overrides.json', 'tools/staff-module-navigation/source-overrides.mjs', 'tools/staff-cycle7/source.mjs', 'tools/staff-cycle7/sources.json']) {
  test('historical guard/source pin is byte-identical to exact109: ' + path, () => assert.deepEqual(current(path), original(path)));
}

// A separate process injects only filesystem observations, never rewrites source.
// This exercises real inventory traversal and wrapper imports without creating
// SQL/config/symlink files in the shared candidate or altering its Git state.
const child = String.raw`
import fs from 'node:fs';import {syncBuiltinESMExports} from 'node:module';
import {fileURLToPath} from 'node:url';import assert from 'node:assert/strict';
const [root,mode,target,entry]=JSON.parse(process.argv[1]);
const path=x=>x instanceof URL?fileURLToPath(x):String(x);
const absolute=root+target,parent=absolute.slice(0,absolute.lastIndexOf('/')),name=absolute.slice(absolute.lastIndexOf('/')+1);
const originals={read:fs.readFileSync,list:fs.readdirSync,exists:fs.existsSync,stat:fs.lstatSync};
if(mode==='add'||mode==='remove'){
 fs.readdirSync=(p,...args)=>{const values=originals.list(p,...args);return path(p)===parent?(mode==='add'?[...values,name]:values.filter(x=>x!==name)):values;};
 if(mode==='add'){fs.existsSync=p=>path(p)===absolute||originals.exists(p);fs.lstatSync=(p,...args)=>path(p)===absolute?{isSymbolicLink:()=>false,isDirectory:()=>false,isFile:()=>true}:originals.stat(p,...args);}
}
if(mode==='bytes')fs.readFileSync=(p,...args)=>path(p)===absolute?Buffer.concat([originals.read(p),Buffer.from('\n/* independent tamper */')]):originals.read(p,...args);
if(mode==='symlink')fs.lstatSync=(p,...args)=>path(p)===absolute?{isSymbolicLink:()=>true,isDirectory:()=>false,isFile:()=>false}:originals.stat(p,...args);
syncBuiltinESMExports();
await assert.rejects(async()=>{const m=await import(entry);if(m.verifyComposition)m.verifyComposition();else m.verifyHostOverrides();},/No backend\/config addition or removal|No protected backend\/config symlink|No public symlink|Reviewed Cycle9|Exact reviewed Cycle8 override manifest|Historical guard\/build\/dependency unchanged/);
console.log('EXPECTED_REJECTION');
`;
const guard = new URL('./overrides.mjs', import.meta.url).href;
const wrapper = new URL('./historical.mjs', import.meta.url).href;
for (const [mode,path,entry] of [
  ['add','supabase/migrations/20990101000000_unreviewed.sql',guard],
  ['add','netlify/functions/unreviewed.js',guard],
  ['remove','netlify/functions/youtube-live.js',guard],
  ['symlink','netlify.toml',guard],
  ['symlink','give.html',guard],
  ['bytes','assets/js/outreach-people.js',wrapper],
  ['bytes','tools/staff-host-cycle8/overrides.json',wrapper],
  ['bytes','tools/staff-module-navigation/source-overrides.json',wrapper],
]) {
  test('isolated actual traversal rejects ' + mode + ' ' + path, () => {
    const result = execFileSync(process.execPath, ['--input-type=module','-e',child,JSON.stringify([fileURLToPath(root),mode,path,entry])], {cwd:root,encoding:'utf8'});
    assert.equal(result.trim(), 'EXPECTED_REJECTION');
  });
}

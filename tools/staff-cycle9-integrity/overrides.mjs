// Validate the actual composition before consulting any historical checkpoint.
// Historical manifests and their exact reviewed comparisons remain unchanged.
import assert from 'node:assert/strict';
import {readFileSync, lstatSync, readdirSync, existsSync} from 'node:fs';
import {execFileSync} from 'node:child_process';
import {createHash} from 'node:crypto';
import * as cycle8 from '../staff-host-cycle8/overrides.mjs';
import {checkpointReader as successorCheckpointReader,verifyActual} from '../staff-runtime-cycle14/source.mjs';

export const base = 'e75fdf884e6880f69920521e74ff7d3a82c3397f';
export const root = new URL('../../', import.meta.url);
export const sha = bytes => createHash('sha256').update(bytes).digest('hex');
export const current = successorCheckpointReader();
const cache = new Map();
export function original(path) {
  if (!cache.has(path)) cache.set(path, execFileSync('git', ['--no-replace-objects', 'show', base + ':' + path], {cwd: root, maxBuffer: 64 * 1024 * 1024}));
  return Buffer.from(cache.get(path));
}
// Replaced only after independent review of the complete exact-file inventory.
export const manifestSHA256 = '060db602f97a6f56a39b0a2a37301cd74c41e47949e4578c3406134670b2ebfc';
export function verifyComposition(bytes = current('tools/staff-cycle9-integrity/overrides.json'), read = current) {
  verifyActual();
  assert.equal(sha(bytes), manifestSHA256, 'Exact independently reviewed Cycle9 manifest');
  const manifest = JSON.parse(bytes);
  assert.equal(manifest.base, base, 'Exact reviewed109 base');
  assert.deepEqual(Object.keys(manifest).sort(), ['additions', 'base', 'existing', 'provenance']);
  assert.deepEqual(Object.keys(manifest.provenance).sort(), ['tools/staff-cycle9/source.mjs', 'tools/staff-cycle9/sources.json']);
  for (const [path, digest] of Object.entries(manifest.provenance)) assert.equal(sha(read(path)), digest, 'Reviewed Cycle9 provenance ' + path);
  const before = JSON.parse(original('tools/site-build/public-files.json'));
  for (const [path, binding] of Object.entries(manifest.existing)) {
    assert.equal(sha(original(path)), binding.originalSHA256, 'Original109 ' + path);
    assert.equal(sha(read(path)), binding.reviewedSHA256, 'Reviewed Cycle9 ' + path);
  }
  for (const [path, binding] of Object.entries(manifest.additions)) {
    assert(!before.includes(path), 'Addition cannot replace an existing public path');
    assert.equal(sha(read(path)), binding.reviewedSHA256, 'Reviewed Cycle9 addition ' + path);
  }
  const after = JSON.parse(read('tools/site-build/public-files.json'));
  assert.deepEqual(after, [...before, ...Object.keys(manifest.additions)].sort(), 'Exact allowlisted public union');
  for (const path of after) {
    assert((!path.includes('..') && /^(assets\/|staff-[a-z0-9-]+\.html$)/.test(path)) || before.includes(path), 'No private path publication');
    assert(!lstatSync(new URL(path, root)).isSymbolicLink(), 'No public symlink ' + path);
    if (!Object.hasOwn(manifest.existing, path) && !Object.hasOwn(manifest.additions, path)) assert.deepEqual(read(path), original(path), 'Protected actual public source ' + path);
  }
  // Source-proven backend, config and deployment files cannot be silently added,
  // removed or changed by this website composition.
  const protectedPaths = execFileSync('git', ['--no-replace-objects', 'ls-tree', '-r', '--name-only', base, '--', 'supabase', 'netlify.toml', 'netlify', '_headers', '_redirects', 'tools/site-build/build.mjs'], {cwd: root, encoding: 'utf8'}).trim().split('\n').filter(Boolean);
  function walk(path) {
    const absolute = new URL(path, root);
    if (!existsSync(absolute)) return [];
    assert(!lstatSync(absolute).isSymbolicLink(), 'No protected backend/config symlink');
    return lstatSync(absolute).isDirectory() ? readdirSync(absolute).flatMap(name => walk(path + '/' + name)) : [path];
  }
  const actualPaths = ['supabase', 'netlify.toml', 'netlify', '_headers', '_redirects', 'tools/site-build/build.mjs'].flatMap(walk).sort();
  assert.deepEqual(actualPaths, [...protectedPaths].sort(), 'No backend/config addition or removal');
  for (const path of protectedPaths) assert.deepEqual(read(path), original(path), 'Protected backend/config ' + path);
  return manifest;
}
export function cycle8Reader() {
  const manifest = verifyComposition();
  return path => Object.hasOwn(manifest.existing, path) ? original(path) : current(path);
}
export function checkpointReader() {
  const read = cycle8Reader();
  cycle8.verifyHostOverrides(undefined, read);
  return path => cycle8.existing.includes(path) ? cycle8.original(path) : read(path);
}

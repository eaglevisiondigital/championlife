import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildSite, previewConfiguration, previewScript } from '../site-build/build.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const configPath = 'assets/js/supabase-config.js';
const source = await readFile(path.join(root, configPath), 'utf8');
const original = { window: {} };
vm.runInNewContext(source, original);
const production = original.window.CHAMPION_LIFE_SUPABASE;
assert.equal(production.url, 'https://exdocjbmylgxssanymjk.supabase.co');
assert.equal(production.publishableKey, 'sb_publishable_h2U_5DLZ0dtRi2QwwD_8Kw_nJ-qhYhu');
const valid = { CHAMPION_PREVIEW_SUPABASE_URL: 'https://abcdefghijklmnopqrst.supabase.co', CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_only' };
for (const env of [{}, { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: production.url },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: production.publishableKey },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_for_browser' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.invalid' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: 'https://exdocjbmylgxssanymjk.supabase.co@evil.example' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: 'https://custom-alias.example' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: valid.CHAMPION_PREVIEW_SUPABASE_URL + '/rest/v1' }]) assert.equal(previewConfiguration(env, production), null);
assert.equal(previewConfiguration(valid, production).url, valid.CHAMPION_PREVIEW_SUPABASE_URL);

// Browser behavior: blocked config must visibly explain the failure and create no client.
const auth = await readFile(path.join(root, 'assets/js/champion-life-auth.js'), 'utf8');
for (const cfg of [null, previewConfiguration(valid, production)]) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://deploy-preview-1--example.netlify.app' });
  let calls = 0;
  dom.window.supabase = { createClient(url, key) { calls++; assert.equal(url, valid.CHAMPION_PREVIEW_SUPABASE_URL); assert.equal(key, valid.CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY); return {}; } };
  dom.window.console.warn = () => {};
  dom.window.eval(previewScript(cfg));
  dom.window.eval(auth);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.equal(calls, cfg ? 1 : 0);
  assert.equal(Boolean(dom.window.document.querySelector('[role=alert]')), !cfg);
  dom.window.close();
}

// Existing callback stays on the actual origin; no production redirect is injected.
const login = await readFile(path.join(root, 'discipleship-login.html'), 'utf8');
const callback = login.match(/const redirect = ([^;]+);/)[1];
for (const origin of ['https://championlifefwb.com', 'https://deploy-preview-12--championlifechurch.netlify.app']) {
  assert.equal(vm.runInNewContext(callback, { location: { origin }, next: '/my-discipleship.html' }), origin + '/discipleship-login.html');
  assert.equal(vm.runInNewContext(callback, { location: { origin }, next: '/dream-track-invite.html' }), origin + '/discipleship-login.html?next=%2Fdream-track-invite.html');
}

// Real production artifact preserves every explicitly public file byte-for-byte.
const manifest = JSON.parse(await readFile(path.join(root, 'tools/site-build/public-files.json')));
await buildSite({ root, env: { CONTEXT: 'production', ...valid } });
for (const file of manifest) assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, file)), file);
async function inventory(dir, prefix = '') {
  const result = [];
  for (const item of await readdir(dir, { withFileTypes: true })) {
    const relative = prefix + item.name;
    if (item.isDirectory()) result.push(...await inventory(path.join(dir, item.name), relative + '/'));
    else result.push(relative);
  }
  return result.sort();
}
assert.deepEqual(await inventory(path.join(root, 'dist')), [...manifest].sort());
await buildSite({ root, env: { CONTEXT: 'deploy-preview' } });
assert.deepEqual(await inventory(path.join(root, 'dist')), [...manifest, '_headers', 'robots.txt'].sort());
const blocked = await readFile(path.join(root, 'dist', configPath), 'utf8');
assert(!blocked.includes(production.url));
assert(!blocked.includes(production.publishableKey));
assert(blocked.includes('window.CHAMPION_LIFE_SUPABASE = null'));
for (const file of await inventory(path.join(root, 'dist'))) {
  assert(!/(?:^|\/)(?:docs|audit|tools|supabase|netlify|HANDOFFS)(?:\/|$)|\.(?:md|sql|map|log|pem|key|toml)$/i.test(file), file);
  if (/\.(?:js|html|css)$/.test(file)) {
    const text = await readFile(path.join(root, 'dist', file), 'utf8');
    assert(!text.includes(production.url), 'Production backend reference in preview: ' + file);
    assert(!/sb_secret_|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), 'Privileged credential pattern in ' + file);
  }
}

// Hostile/unlisted files stay out, invalid manifests and symlinks cannot escape the root.
const fixture = await mkdtemp(path.join(os.tmpdir(), 'champion-site-build-'));
try {
  await mkdir(path.join(fixture, 'tools/site-build'), { recursive: true });
  await mkdir(path.join(fixture, 'assets/js'), { recursive: true });
  await writeFile(path.join(fixture, configPath), source);
  await writeFile(path.join(fixture, '.env'), 'PRIVATE_SENTINEL');
  const manifestFile = path.join(fixture, 'tools/site-build/public-files.json');
  await writeFile(manifestFile, JSON.stringify([configPath]));
  for (const context of ['deploy-preview', 'branch-deploy']) {
    const result = await buildSite({ root: fixture, env: { CONTEXT: context, ...valid } });
    assert.equal(result.backend, 'isolated-preview');
    assert(!(await readFile(path.join(fixture, 'dist', configPath), 'utf8')).includes(production.url));
  }
  await assert.rejects(buildSite({ root: fixture, env: { NETLIFY: 'true' } }), /context/);
  await assert.rejects(buildSite({ root: fixture, env: { CONTEXT: 'typo' } }), /context/);
  for (const file of ['../outside.js', 'docs/private.html', 'assets/.env', 'assets/debug.js.map']) {
    await writeFile(manifestFile, JSON.stringify([configPath, file]));
    await assert.rejects(buildSite({ root: fixture, env: {} }), /Non-public/);
  }
  await symlink(path.join(fixture, '.env'), path.join(fixture, 'assets/leak.js'));
  await writeFile(manifestFile, JSON.stringify([configPath, 'assets/leak.js']));
  await assert.rejects(buildSite({ root: fixture, env: {} }), /Symlinks/);
} finally { await rm(fixture, { recursive: true, force: true }); }
console.log('PASS site build: public artifact equality/exclusions, production defaults, preview isolation, unsafe keys/hosts, visible blocked state, no-client guard and symlink rejection');

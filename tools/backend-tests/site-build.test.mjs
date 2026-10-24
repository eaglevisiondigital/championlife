import assert from 'node:assert/strict';
import { readFile, readdir, mkdtemp, mkdir, writeFile, rm, symlink } from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { JSDOM } from 'jsdom';
import { buildSite, previewConfiguration, previewScript, defaultHeaders } from '../site-build/build.mjs';
import { productionOnlyFiles, activationHeaders } from '../site-build/production-activation.mjs';
const root = fileURLToPath(new URL('../../', import.meta.url));
const configPath = 'assets/js/supabase-config.js';
const source = await readFile(path.join(root, configPath), 'utf8');
const original = { window: {} };
vm.runInNewContext(source, original);
const production = original.window.CHAMPION_LIFE_SUPABASE;
assert.equal(production.url, 'https://exdocjbmylgxssanymjk.supabase.co');
assert.equal(production.publishableKey, 'sb_publishable_h2U_5DLZ0dtRi2QwwD_8Kw_nJ-qhYhu');
const valid = { CHAMPION_PREVIEW_SUPABASE_URL: 'https://bkbmjisprwmkptywtmih.supabase.co', CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'sb_publishable_synthetic_only' };
for (const env of [{}, { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: production.url },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: production.publishableKey },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'sb_secret_not_for_browser' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY: 'eyJhbGciOiJIUzI1NiJ9.eyJyb2xlIjoic2VydmljZV9yb2xlIn0.invalid' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: 'https://exdocjbmylgxssanymjk.supabase.co@evil.example' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: 'https://custom-alias.example' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: 'https://aaaaaaaaaaaaaaaaaaaa.supabase.co' },
  { ...valid, CHAMPION_PREVIEW_SUPABASE_URL: valid.CHAMPION_PREVIEW_SUPABASE_URL + '/rest/v1' }]) assert.equal(previewConfiguration(env, production), null);
assert.equal(previewConfiguration(valid, production).url, valid.CHAMPION_PREVIEW_SUPABASE_URL);
const minimal = {...valid,CHAMPION_PREVIEW_SUPABASE_URL:'https://niyovbgoalulzkhbvebt.supabase.co'};
assert.equal(previewConfiguration(minimal,production).url,minimal.CHAMPION_PREVIEW_SUPABASE_URL);

// Browser behavior: blocked config must visibly explain the failure and create no client.
const auth = await readFile(path.join(root, 'assets/js/champion-life-auth.js'), 'utf8');
for (const cfg of [null, previewConfiguration(valid, production),previewConfiguration(minimal,production)]) {
  const dom = new JSDOM('<!doctype html><body></body>', { runScripts: 'outside-only', url: 'https://deploy-preview-1--example.netlify.app' });
  let calls = 0;
  dom.window.supabase = { createClient(url, key) { calls++; assert.equal(url, cfg.url); assert.equal(key, valid.CHAMPION_PREVIEW_SUPABASE_PUBLISHABLE_KEY); return {}; } };
  dom.window.console.warn = () => {};
  dom.window.eval(previewScript(cfg));
  dom.window.eval(auth);
  dom.window.document.dispatchEvent(new dom.window.Event('DOMContentLoaded'));
  assert.equal(calls, cfg ? 1 : 0);
  assert.equal(Boolean(dom.window.document.querySelector('[role=alert]')), !cfg);
  dom.window.close();
}

// Real production artifact preserves every explicitly public file byte-for-byte.
const manifest = JSON.parse(await readFile(path.join(root, 'tools/site-build/public-files.json')));
// Released main pages must survive the development branch's explicit publish allowlist.
for (const file of ['christmas-dinner-2026.html', 'assets/css/christmas-dinner-2026.css',
  'assets/js/christmas-dinner-2026.js', 'bessemer/index.html', 'assets/images/bessemer-qr.svg']) assert(manifest.includes(file), file);
const events = new JSDOM(await readFile(path.join(root, 'events.html'), 'utf8'));
assert.equal(events.window.document.querySelectorAll('#events-app').length, 0);
assert.equal(events.window.document.querySelectorAll('.christmas-feature').length, 1);
assert.equal(events.window.document.querySelector('[data-registration-cta]').getAttribute('href'), '/christmas-dinner-2026.html');
for (const script of ['site.js', 'christmas-dinner-2026.js'])
  assert.equal(events.window.document.querySelectorAll(`script[src="assets/js/${script}"]`).length, 1, script);
events.window.close();
const forms = new JSDOM(await readFile(path.join(root, 'netlify-forms.html'), 'utf8'));
assert.equal(forms.window.document.querySelectorAll('form[name="christmas-dinner-2026"]').length, 1);
assert.equal(forms.window.document.querySelectorAll('form[name="outreach-partner"]').length, 0, 'No parallel outreach capture');
forms.window.close();
await buildSite({ root, env: { CONTEXT: 'production', ...minimal } });
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
assert.deepEqual(await inventory(path.join(root, 'dist')), [...manifest, '_headers'].sort());
assert.equal(await readFile(path.join(root, 'dist/_headers'), 'utf8'), defaultHeaders + activationHeaders);
const previewManifest = manifest.filter(file => !productionOnlyFiles.includes(file));
await buildSite({ root, env: { CONTEXT: 'deploy-preview' } });
assert.deepEqual(await inventory(path.join(root, 'dist')), [...previewManifest, '_headers', 'robots.txt'].sort());
const blocked = await readFile(path.join(root, 'dist', configPath), 'utf8');
assert(!blocked.includes(production.url));
assert(!blocked.includes(production.publishableKey));
assert(blocked.includes('window.CHAMPION_LIFE_SUPABASE = null'));
for (const file of await inventory(path.join(root, 'dist'))) {
  assert(!/(?:^|\/)(?:docs|audit|tools|supabase|netlify|HANDOFFS)(?:\/|$)|\.(?:md|sql|map|log|pem|key|toml)$/i.test(file), file);
  if (/\.(?:js|html|css|txt)$/.test(file) || file.startsWith('_')) {
    const text = await readFile(path.join(root, 'dist', file), 'utf8');
    assert(!text.includes(production.publishableKey), 'Production key in preview: ' + file);
    assert(!text.includes('provision_huntsville_staff_20261023'), 'Activation RPC in preview: ' + file);
    assert(!text.includes('staff-huntsville-activation'), 'Activation reference in preview: ' + file);
    assert(!text.includes(production.url), 'Production backend reference in preview: ' + file);
    assert(!/sb_secret_|-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/.test(text), 'Privileged credential pattern in ' + file);
  }
}

// Both actual preview contexts, with each allowed target and missing config, exclude
// the complete mechanism. Production-to-preview transitions must remove stale files.
for (const context of ['deploy-preview', 'branch-deploy']) for (const accepted of [{}, valid, minimal]) {
  await buildSite({ root, env: { CONTEXT: context, ...accepted } });
  assert.deepEqual(await inventory(path.join(root, 'dist')), [...previewManifest, '_headers', 'robots.txt'].sort());
  for (const file of previewManifest.filter(file => file !== configPath)) {
    assert.deepEqual(await readFile(path.join(root, 'dist', file)), await readFile(path.join(root, file)), file);
  }
  const headers = await readFile(path.join(root, 'dist/_headers'), 'utf8');
  assert(!headers.includes(production.url) && !headers.includes('activation'));
}
// Local/default/dev builds cannot accidentally publish the temporary production UI.
for (const env of [{}, { CONTEXT: 'dev' }]) {
  await buildSite({ root, env });
  assert.deepEqual(await inventory(path.join(root, 'dist')), [...previewManifest, '_headers'].sort());
}
const toml = await readFile(path.join(root, 'netlify.toml'), 'utf8');
assert(!toml.includes(production.url) && !toml.includes('staff-huntsville-activation'), 'No global production activation headers');

// Hostile/unlisted files stay out, invalid manifests and symlinks cannot escape the root.
const fixture = await mkdtemp(path.join(os.tmpdir(), 'champion-site-build-'));
try {
  await mkdir(path.join(fixture, 'tools/site-build'), { recursive: true });
  await mkdir(path.join(fixture, 'assets/js'), { recursive: true });
  await writeFile(path.join(fixture, configPath), source);
  await writeFile(path.join(fixture, '.env'), 'PRIVATE_SENTINEL');
  const manifestFile = path.join(fixture, 'tools/site-build/public-files.json');
  await writeFile(manifestFile, JSON.stringify([configPath]));
  for (const context of ['deploy-preview', 'branch-deploy']) for(const accepted of [valid,minimal]) {
    const result = await buildSite({ root: fixture, env: { CONTEXT: context, ...accepted } });
    assert.equal(result.backend, 'isolated-preview');
    assert(!(await readFile(path.join(fixture, 'dist', configPath), 'utf8')).includes(production.url));
  }
  await writeFile(path.join(fixture, 'staff-huntsville-activation.html'), '<!doctype html>');
  await writeFile(manifestFile, JSON.stringify([configPath, productionOnlyFiles[0]]));
  await assert.rejects(buildSite({ root: fixture, env: { CONTEXT: 'production' } }), /Incomplete/);
  await writeFile(manifestFile, JSON.stringify([configPath]));
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

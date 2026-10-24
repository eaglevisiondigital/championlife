import assert from 'node:assert/strict';
import { HeadersHandler } from '@netlify/headers';
import { readFile, writeFile, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath } from 'node:url';
import { buildSite } from '../site-build/build.mjs';
import { activationHeaders } from '../site-build/production-activation.mjs';
import { activationPaths, verifyActivationResponse, verifyAnonymousEndpoint } from '../site-build/activation-response-contract.mjs';

const root = fileURLToPath(new URL('../../', import.meta.url));
const temp = await mkdtemp(path.join(os.tmpdir(), 'champion-header-engine-'));
const logger = { error(message) { throw new Error(message); } };
let checks = 0;
function ok(value, message) { assert(value, message); checks++; }
const globals = '[[headers]]\nfor = "/*"\n[headers.values]\nX-Frame-Options = "SAMEORIGIN"\nX-Content-Type-Options = "nosniff"\nReferrer-Policy = "strict-origin-when-cross-origin"\n';
try {
  await mkdir(path.join(temp, 'tools/site-build'), { recursive: true });
  await mkdir(path.join(temp, 'assets/js'), { recursive: true });
  const files = ['index.html', 'assets/js/supabase-config.js', 'staff-huntsville-activation.html', 'assets/js/staff-huntsville-activation.js'];
  await writeFile(path.join(temp, 'tools/site-build/public-files.json'), JSON.stringify(files));
  for (const f of files) await writeFile(path.join(temp, f), await readFile(path.join(root, f)));
  await writeFile(path.join(temp, 'netlify.toml'), await readFile(path.join(root, 'netlify.toml')));
  await buildSite({ root: temp, env: { CONTEXT: 'production' } });
  const corrected = await readFile(path.join(temp, 'dist/_headers'), 'utf8');
  await writeFile(path.join(temp, 'old.toml'), globals);
  const old = new HeadersHandler({ projectDir: temp, publishDir: 'dist', configPath: path.join(temp, 'old.toml'), logger });
  await writeFile(path.join(temp, 'dist/_headers'), activationHeaders);
  const oldResponse = new Response('', { status: 200, headers: { 'Content-Type': 'text/html' } });
  await old.apply(new Request('https://championlifefwb.com/staff-huntsville-activation.html'), oldResponse);
  ok(oldResponse.headers.get('x-frame-options') === 'SAMEORIGIN', 'Vendor engine reproduces deployed frame-header mismatch');
  ok(oldResponse.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', 'Vendor engine reproduces deployed referrer mismatch');
  assert.throws(() => verifyActivationResponse(activationPaths[0], oldResponse, 'installed'), /X-Frame-Options/); checks++;
  await writeFile(path.join(temp, 'dist/_headers'), corrected);
  const handler = new HeadersHandler({ projectDir: temp, publishDir: 'dist', configPath: path.join(temp, 'netlify.toml'), logger });
  // Exercise real local HTTP GET/HEAD responses through Netlify's own engine.
  const server = createServer(async (req, res) => {
    try {
      const pathname = new URL(req.url, 'http://localhost').pathname;
      const file = pathname === '/staff-huntsville-activation' ? 'staff-huntsville-activation.html' : pathname.slice(1);
      let body; try { body = await readFile(path.join(temp, 'dist', file)); } catch { res.statusCode = 404; body = Buffer.from('Not found'); }
      res.setHeader('Content-Type', file.endsWith('.js') ? 'text/javascript; charset=UTF-8' : 'text/html; charset=UTF-8');
      await handler.apply(new Request('https://championlifefwb.com' + pathname), undefined, (k, v) => res.setHeader(k, v));
      res.end(req.method === 'HEAD' ? undefined : body);
    } catch { res.statusCode = 500; res.end('Local header test failed'); }
  });
  server.listen(0, '127.0.0.1'); await once(server, 'listening');
  const origin = `http://127.0.0.1:${server.address().port}`;
  try {
    for (const p of activationPaths) for (const method of ['GET', 'HEAD']) {
      const response = await fetch(origin + p, { method, redirect: 'manual' });
      verifyActivationResponse(p, response, 'installed'); checks++;
    }
    for (const context of ['production', 'deploy-preview', 'branch-deploy', 'dev', '']) {
      await buildSite({ root: temp, env: context ? { CONTEXT: context } : {} });
      const response = await fetch(origin + '/index.html');
      ok(response.headers.get('x-frame-options') === 'SAMEORIGIN', context + ' ordinary page frame unchanged');
      ok(response.headers.get('referrer-policy') === 'strict-origin-when-cross-origin', context + ' ordinary page referrer unchanged');
      ok(response.headers.get('x-content-type-options') === 'nosniff', context + ' nosniff unchanged');
      if (context !== 'production') {
        for (const p of activationPaths) { verifyActivationResponse(p, await fetch(origin + p), 'removed'); checks++; }
        const headerFile = await readFile(path.join(temp, 'dist/_headers'), 'utf8');
        ok(!/provision_|exdocjbmylgxssanymjk|staff-huntsville-activation/.test(headerFile), 'No production activation configuration outside production');
      }
    }
  } finally { await new Promise(resolve => server.close(resolve)); }
  // The hosted gate must not equate errors, redirects or a missing RPC with success.
  for (const status of [200, 302, 400, 403, 404, 500]) if (status !== 401) {
    assert.throws(() => verifyAnonymousEndpoint({ status, code: '42501' }, 'installed')); checks++;
  }
  verifyAnonymousEndpoint({ status: 401, code: '42501' }, 'installed'); checks++;
  verifyAnonymousEndpoint({ status: 404, code: 'PGRST202' }, 'removed'); checks++;
  for (const key of ['x-frame-options', 'referrer-policy', 'cache-control', 'content-security-policy', 'x-robots-tag']) {
    const good = new Response('', { headers: oldResponse.headers });
    good.headers.set('x-frame-options', 'DENY'); good.headers.set('referrer-policy', 'no-referrer');
    good.headers.delete(key);
    assert.throws(() => verifyActivationResponse(activationPaths[0], good, 'installed')); checks++;
  }
  console.log(`PASS ${checks} Netlify header-engine, HTTP lifecycle, isolation and fail-closed contract checks`);
} finally { await rm(temp, { recursive: true, force: true }); }

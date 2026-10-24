import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';

// Only the two complete byte representations reviewed in the production stop
// evidence are accepted. This is deliberately NOT an HTML parser, whitespace
// normalizer, URL canonicalizer, or arbitrary replacement of response content.
export const activationHtmlHashes = Object.freeze({
  source: 'b3923bd5c2963179e291aaacc3adb680d16e5c12b31dc01aedb3431d94864385',
  netlifyPrettyUrls: '4d74a60ddf4e64e9c831c1a12dd94618853597cbf479eeab7f72b32a01e56f42',
});
const reviewedLinkRewrites = Object.freeze([
  ['<a href="/staff-people.html">', "<a href='/staff-people'>"],
  ['<a id="activation-login" href="/discipleship-login.html?next=%2Fstaff-huntsville-activation.html" hidden>', "<a hidden href='/discipleship-login?next=%2Fstaff-huntsville-activation.html' id='activation-login'>"],
]);
const digest = bytes => createHash('sha256').update(bytes).digest('hex');
export function reviewedPrettyHtml(source) {
  assert.equal(digest(source), activationHtmlHashes.source, 'Unreviewed activation HTML source');
  let text = Buffer.from(source).toString('utf8');
  for (const [before, after] of reviewedLinkRewrites) {
    assert.equal(text.split(before).length, 2, 'Reviewed link must occur exactly once');
    text = text.replace(before, after);
  }
  const result = Buffer.from(text);
  assert.equal(digest(result), activationHtmlHashes.netlifyPrettyUrls, 'Unreviewed HTML transformation');
  return result;
}
export function verifyActivationBody(path, actual, sealedSource) {
  assert(activationPaths.includes(path), 'Unreviewed activation path');
  assert(Buffer.isBuffer(actual) && Buffer.isBuffer(sealedSource), 'Byte buffers required');
  if (path.endsWith('.js')) {
    assert(actual.equals(sealedSource), 'Deployed activation script source mismatch');
    return 'exact-source';
  }
  const transformed = reviewedPrettyHtml(sealedSource);
  if (actual.equals(sealedSource)) return 'exact-source';
  assert(actual.equals(transformed), 'Deployed activation HTML integrity mismatch');
  return 'reviewed-netlify-pretty-urls';
}

export const activationPaths = Object.freeze([
  '/staff-huntsville-activation.html',
  '/staff-huntsville-activation',
  '/assets/js/staff-huntsville-activation.js',
]);
export const activationCsp = "default-src 'none'; script-src 'self' https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2; style-src 'self'; img-src 'self'; connect-src https://exdocjbmylgxssanymjk.supabase.co; frame-ancestors 'none'; base-uri 'none'; form-action 'none'; object-src 'none'";

// Shared by the local vendor-engine regression and the private hosted gate.
// Errors identify only the contract field, never response bodies or credentials.
export function verifyActivationResponse(path, response, state) {
  assert(activationPaths.includes(path), 'Unreviewed activation path');
  assert(['installed', 'removed'].includes(state), 'Unreviewed verification state');
  assert.equal(response.status, state === 'installed' ? 200 : 404, `HTTP status: ${path}`);
  if (state === 'removed') return;
  const h = new Headers(response.headers);
  assert.equal(h.get('cache-control'), 'no-store', `Cache-Control: ${path}`);
  assert.equal(h.get('x-content-type-options'), 'nosniff', `X-Content-Type-Options: ${path}`);
  if (path.endsWith('.js')) {
    assert.match(h.get('content-type') || '', /^(?:text|application)\/javascript(?:;|$)/i, 'Script Content-Type');
    assert.equal(h.get('x-frame-options'), 'SAMEORIGIN', 'Script baseline X-Frame-Options');
    assert.equal(h.get('referrer-policy'), 'strict-origin-when-cross-origin', 'Script baseline Referrer-Policy');
  } else {
    assert.match(h.get('content-type') || '', /^text\/html(?:;|$)/i, 'HTML Content-Type');
    assert.equal(h.get('x-frame-options'), 'DENY', `X-Frame-Options: ${path}`);
    assert.equal(h.get('referrer-policy'), 'no-referrer', `Referrer-Policy: ${path}`);
    assert.equal(h.get('x-robots-tag'), 'noindex, nofollow, noarchive', `X-Robots-Tag: ${path}`);
    assert.equal(h.get('content-security-policy'), activationCsp, `Content-Security-Policy: ${path}`);
  }
}

export function verifyAnonymousEndpoint(response, state) {
  assert(['installed', 'removed'].includes(state), 'Unreviewed verification state');
  assert.equal(response.status, state === 'installed' ? 401 : 404, 'Anonymous RPC status');
  assert.equal(response.code, state === 'installed' ? '42501' : 'PGRST202', 'Anonymous RPC error contract');
}

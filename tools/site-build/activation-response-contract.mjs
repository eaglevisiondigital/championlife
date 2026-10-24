import assert from 'node:assert/strict';

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

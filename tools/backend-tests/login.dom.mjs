import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { JSDOM } from 'jsdom';

const html = readFileSync(new URL('../../discipleship-login.html', import.meta.url), 'utf8');
const parsed = new JSDOM(html);
const script = parsed.window.document.querySelector('script:not([src])').textContent;
const input = parsed.window.document.querySelector('#loginCode');
assert.equal(input.maxLength, 8);
assert.equal(input.getAttribute('inputmode'), 'numeric');
assert.equal(input.autocomplete, 'one-time-code');
assert.equal(input.closest('label').textContent, 'Sign-In Code');
assert.equal(parsed.window.document.querySelector('#codeHelp').textContent, 'Enter the 6- or 8-digit code from your email.');
parsed.window.close();
new vm.Script(script); // Syntax-check the actual inline application script.
const flush = () => new Promise(resolve => setImmediate(resolve));
const origin = 'https://deploy-preview-4--championlifechurch.netlify.app';
const fallback = '/my-discipleship.html';
let scenarios = 0;

async function harness({ next, search, stored, blockedStorage = false, initialSession = false, siteOrigin = origin, verifyError = false } = {}) {
  const dom = new JSDOM(html, { url: siteOrigin + '/discipleship-login.html' });
  const calls = { sends: [], verifies: [], navigations: [], stored: [] };
  const storage = new Map(stored === undefined ? [] : [['championlife-auth-next', stored]]);
  let onAuth;
  const location = {
    origin: siteOrigin,
    search: search ?? (next === undefined ? '' : '?next=' + encodeURIComponent(next)),
    set href(value) { calls.navigations.push(value); }
  };
  const context = {
    document: dom.window.document, location, URL, URLSearchParams,
    setTimeout: fn => { fn(); },
    sessionStorage: {
      getItem: key => { if (blockedStorage) throw Error('Storage unavailable'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blockedStorage) throw Error('Storage unavailable'); calls.stored.push(value); storage.set(key, value); },
      removeItem: key => { if (blockedStorage) throw Error('Storage unavailable'); storage.delete(key); }
    },
    window: { ChampionLifeAuth: {
      getSession: async () => initialSession ? { user: { id: 'synthetic' } } : null,
      client: { auth: {
        onAuthStateChange: fn => { onAuth = fn; },
        signInWithOtp: async args => { calls.sends.push(args); return {}; },
        verifyOtp: async args => {
          calls.verifies.push(args);
          return verifyError ? { error: Error('Verification rejected') } : { data: { session: { user: { id: 'synthetic' } } } };
        }
      } }
    } }
  };
  vm.runInNewContext(script, context);
  await flush();
  return {
    calls, storage, dom,
    authEvent(session = { user: { id: 'synthetic' } }) { onAuth('SIGNED_IN', session); },
    async click(id) { dom.window.document.getElementById(id).click(); await flush(); },
    async send() { dom.window.document.querySelector('#loginEmail').value = 'synthetic@example.test'; await this.click('sendCodeBtn'); },
    async verify(code) { dom.window.document.querySelector('#loginCode').value = code; await this.click('verifyCodeBtn'); },
    close() { dom.window.close(); scenarios++; }
  };
}

// Synthetic values only; no email, OTP verification or session is sent to a server.
for (const code of ['123456', '12345678', '12345', '1234567', '123456789', 'abcdef', '1234a678', '123 56', ' 123456', '123456 ', '１２３４５６', '']) {
  const h = await harness({ next: '/staff-outreach-partners.html' });
  await h.send();
  await h.verify(code);
  const valid = code === '123456' || code === '12345678';
  assert.equal(h.calls.verifies.length, valid ? 1 : 0);
  assert.equal(h.calls.navigations.length, valid ? 1 : 0);
  if (valid) {
    assert.equal(h.calls.verifies[0].type, 'email');
    assert.equal(h.calls.verifies[0].token.length, code.length);
    assert.equal(h.calls.navigations[0], '/staff-outreach-partners.html');
  } else assert.equal(h.dom.window.document.querySelector('#authMessage').textContent, 'Enter the 6- or 8-digit code from your email.');
  h.close();
}

const safe = [
  ['/staff-outreach-partners.html', '/staff-outreach-partners.html'],
  ['/staff-people.html', '/staff-people.html'],
  ['/staff-people.html?person=synthetic&org=test#details', '/staff-people.html?person=synthetic&org=test#details'],
  ['/my-discipleship.html?q=kids%20youth#progress', '/my-discipleship.html?q=kids%20youth#progress'],
  ['/folder/../staff-people.html', '/staff-people.html']
];
const unsafe = ['', 'https://evil.example', origin + '/staff-people.html', '//evil.example', '///evil.example',
  'javascript:alert(1)', 'data:text/html,test', 'staff-people.html', '/\\evil.example', '\\evil.example',
  '/%5cevil.example', '/%2fevil.example', '/%252fevil.example', '/%255cevil.example', '/ok%00', '/ok%0a',
  '/%GG', '/%E0%A4', '/ok\n', '/ok\t', '/ok\u007f', ' /staff-people.html', '/staff-people.html ',
  '/folder/..//evil.example', '/%2e%2e//evil.example', '/' + 'a'.repeat(2048)];
for (const [next, expected] of [...safe, ...unsafe.map(value => [value, fallback])]) {
  for (const fromStorage of [false, true]) {
    const h = await harness(fromStorage ? { stored: next } : { next, stored: '/staff-people.html' });
    assert.equal(h.calls.stored[0], expected, 'only sanitized values enter storage');
    await h.send();
    const callback = new URL(h.calls.sends[0].options.emailRedirectTo);
    assert.equal(callback.origin, origin);
    assert.equal(callback.pathname, '/discipleship-login.html');
    assert.equal(callback.searchParams.get('next'), expected);
    h.authEvent(null);
    assert.equal(h.calls.navigations.length, 0);
    h.storage.set('championlife-auth-next', '//evil.example');
    h.authEvent();
    assert.equal(h.calls.navigations.at(-1), expected, 'auth event ignores later poisoned storage');
    assert.equal(new URL(h.calls.navigations.at(-1), origin).origin, origin);
    h.close();
  }
}

// Email round trip into a fresh context, no shared storage, multiple site origins.
for (const siteOrigin of [origin, 'https://deploy-preview-27--championlifechurch.netlify.app', 'https://championlifefwb.com']) {
  const h = await harness({ siteOrigin, next: '/staff-outreach-partners.html', blockedStorage: true });
  await h.send();
  const callback = new URL(h.calls.sends[0].options.emailRedirectTo);
  assert.equal(callback.origin, siteOrigin);
  assert.equal(callback.search, '?next=%2Fstaff-outreach-partners.html');
  const returned = await harness({ siteOrigin, search: callback.search, blockedStorage: true, initialSession: true });
  assert.deepEqual(returned.calls.navigations, ['/staff-outreach-partners.html']);
  returned.authEvent();
  assert.equal(returned.calls.navigations.at(-1), '/staff-outreach-partners.html');
  returned.close(); h.close();
}
for (const options of [
  { next: '/staff-people.html' }, { stored: '/staff-people.html' }, { next: '//evil.example' },
  { stored: 'https://evil.example' }, {}, { blockedStorage: true }
]) {
  const h = await harness({ ...options, initialSession: true });
  assert.equal(h.calls.navigations[0], options.next === '/staff-people.html' || options.stored === '/staff-people.html' ? '/staff-people.html' : fallback);
  h.close();
}
{
  const h = await harness({ next: '/staff-people.html', verifyError: true });
  await h.send(); await h.verify('12345678');
  assert.equal(h.calls.navigations.length, 0, 'failed verification cannot redirect');
  assert.equal(h.dom.window.document.querySelector('#verifyCodeBtn').disabled, false);
  h.close();
}
// Retain the existing SDK session restoration contract; no new token parser or auth mechanism.
const authSource = readFileSync(new URL('../../assets/js/champion-life-auth.js', import.meta.url), 'utf8');
let clientOptions;
const sandbox = { window: { CHAMPION_LIFE_SUPABASE: { url: 'https://synthetic.example', publishableKey: 'synthetic' },
  supabase: { createClient(_url, _key, options) { clientOptions = options; return { auth: { getSession: async () => ({ data: { session: { restored: true } } }) } }; } }
} };
vm.runInNewContext(authSource, sandbox);
assert.equal(clientOptions.auth.detectSessionInUrl, true);
assert.equal(clientOptions.auth.persistSession, true);
assert.equal((await sandbox.window.ChampionLifeAuth.getSession()).restored, true);
assert(!/deploy-preview-\d+--/.test(script), 'no hardcoded preview in login');
console.log(`PASS ${scenarios} focused login scenarios: OTP lengths, redirect rejection, callback round trips, blocked storage, initial/auth-event sessions; existing SDK URL-session contract and inline syntax`);

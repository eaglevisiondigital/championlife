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

async function harness({ next, search, stored, blockedStorage = false, initialSession = false, siteOrigin = origin, verifyError = false, linkVerifyError = false, hash = '', sessionError = false, initError = false, authDuringVerify = false, authDuringRestore = false, missingSession = false, deferredSession = false } = {}) {
  const dom = new JSDOM(html, { url: siteOrigin + '/discipleship-login.html' });
  const calls = { sends: [], verifies: [], navigations: [], stored: [], replaced: [], order: [], initializations: 0 };
  const storage = new Map(stored === undefined ? [] : [['championlife-auth-next', stored]]);
  let onAuth;
  const effectiveSearch = search ?? (next === undefined ? '' : '?next=' + encodeURIComponent(next));
  const location = {
    origin: siteOrigin,
    pathname: '/discipleship-login.html',
    search: effectiveSearch,
    hash,
    get href() { return siteOrigin + this.pathname + this.search + this.hash; },
    set href(value) { calls.navigations.push(value); calls.order.push('navigate'); }
  };
  let finishSession;
  const context = {
    document: dom.window.document, location, URL, URLSearchParams,
    history: { replaceState(_a,_b,value) { calls.replaced.push(value); calls.order.push('scrub'); } },
    setTimeout: fn => { fn(); },
    sessionStorage: {
      getItem: key => { if (blockedStorage) throw Error('Storage unavailable'); return storage.get(key) ?? null; },
      setItem: (key, value) => { if (blockedStorage) throw Error('Storage unavailable'); calls.stored.push(value); storage.set(key, value); },
      removeItem: key => { if (blockedStorage) throw Error('Storage unavailable'); storage.delete(key); }
    },
    window: { ChampionLifeAuth: {
      getSession: async () => {
        if(deferredSession) await new Promise(resolve=>{finishSession=resolve});
        if(authDuringRestore) onAuth('SIGNED_IN', {user:{id:'synthetic'}});
        if(sessionError) throw Error('SDK failure containing synthetic-secret');
        return initialSession ? { user: { id: 'synthetic' } } : null;
      },
      client: { auth: {
        initialize: async () => { calls.initializations++; return {error:initError ? Error('SDK URL initialization failed') : null}; },
        onAuthStateChange: fn => { onAuth = fn; },
        signInWithOtp: async args => { calls.sends.push(args); return {}; },
        verifyOtp: async args => {
          calls.verifies.push(args);
          if(authDuringVerify) onAuth('SIGNED_IN', {user:{id:'synthetic'}});
          const isLink = Object.prototype.hasOwnProperty.call(args,'token_hash');
          return (isLink ? linkVerifyError : verifyError) ? { error: Error('Verification rejected') } : { data: { session: missingSession ? null : { user: { id: 'synthetic' } } } };
        }
      } }
    } }
  };
  vm.runInNewContext(script, context);
  await flush();
  return {
    calls, storage, dom,
    async finishRestore() { finishSession(); await flush(); },
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

// Direct email-link callback: verify token hash once and go straight to the intended staff page.
{
  const tokenHash='a'.repeat(64);
  const h=await harness({ search:'?next=%2Fstaff-outreach-registration.html&token_hash='+tokenHash+'&type=email' });
  await flush();
  assert.equal(h.calls.verifies.length,1);
  assert.equal(h.calls.verifies[0].token_hash,tokenHash);
  assert.equal(h.calls.verifies[0].type,'email');
  assert.deepEqual(h.calls.navigations,['/staff-outreach-registration.html']);
  assert.equal(h.calls.replaced.length,1);
  assert(!h.calls.replaced[0].includes('token_hash='));
  h.close();
}
{
  const h=await harness({ search:'?next=%2Fstaff-outreach-registration.html&token_hash='+('b'.repeat(64))+'&type=magiclink' });
  await flush();
  assert.equal(h.calls.verifies.length,1);
  assert.equal(h.calls.verifies[0].type,'magiclink');
  assert.deepEqual(h.calls.navigations,['/staff-outreach-registration.html']);
  h.close();
}
for (const search of [
  '?next=%2Fstaff-outreach-registration.html&token_hash=short&type=email',
  '?next=%2Fstaff-outreach-registration.html&token_hash='+('c'.repeat(64))+'&type=recovery'
]) {
  const h=await harness({ search });
  await flush();
  assert.equal(h.calls.verifies.length,0);
  assert.equal(h.calls.navigations.length,0);
  assert.match(h.dom.window.document.querySelector('#authMessage').textContent,/invalid or incomplete/i);
  h.close();
}
{
  const h=await harness({ search:'?next=%2Fstaff-outreach-registration.html&token_hash='+('d'.repeat(64))+'&type=email', linkVerifyError:true });
  await flush();
  assert.equal(h.calls.navigations.length,0);
  assert.match(h.dom.window.document.querySelector('#authMessage').textContent,/expired, was already used/);
  h.close();
}

// Observed acceptance template: ConfirmationURL -> /auth/v1/verify?token=...&type=magiclink
// -> intended login URL with an implicit session fragment. Fictional tokens only.
const implicitHash='#access_token=synthetic-access&refresh_token=synthetic-refresh&expires_in=3600&token_type=bearer&type=magiclink';
for(const opts of [{}, {blockedStorage:true}, {authDuringRestore:true}]) {
  const h=await harness({next:'/staff-outreach-registration.html',hash:implicitHash,initialSession:true,...opts});
  assert.deepEqual(h.calls.navigations,['/staff-outreach-registration.html']);
  assert.equal(h.calls.initializations,1);
  assert.equal(h.calls.verifies.length,0,'SDK owns fragment verification, no second verifyOtp');
  assert.equal(h.calls.sends.length,0,'no second email/code request');
  assert.deepEqual(h.calls.order,['scrub','navigate']);
  assert.equal(h.calls.replaced[0],'/discipleship-login.html?next=%2Fstaff-outreach-registration.html');
  h.authEvent();
  assert.equal(h.calls.navigations.length,1,'auth event cannot cause a second redirect');
  h.close();
}
{
  const h=await harness({next:'/staff-outreach-registration.html',hash:implicitHash,initialSession:true,deferredSession:true});
  assert(!h.dom.window.document.querySelector('#emailStep').classList.contains('active'),'do not ask for email while SDK restores callback');
  assert(h.dom.window.document.querySelector('#sendCodeBtn').disabled);
  h.authEvent();
  assert.equal(h.calls.navigations.length,0,'wait for SDK initialization/session result');
  await h.finishRestore();
  assert.deepEqual(h.calls.order,['scrub','navigate']);
  h.close();
}
for(const opts of [
  {hash:'#error=access_denied&error_code=otp_expired&error_description=Email+link+is+invalid+or+has+expired&sb=',initialSession:true},
  {hash:implicitHash,initError:true,initialSession:true},
  {hash:implicitHash,sessionError:true},
  {hash:implicitHash,initialSession:false},
  {hash:'#refresh_token=synthetic-refresh',initialSession:true},
  {hash:implicitHash+'&access_token=duplicate',initialSession:true},
  {hash:implicitHash.replace('magiclink','recovery'),initialSession:true},
  {search:'?code=unsupported-pkce',initialSession:true},
  {search:'?token_hash=&type=email',initialSession:true},
  {search:'?token_hash='+('a'.repeat(64))+'&token_hash='+('b'.repeat(64))+'&type=email'},
  {search:'?token_hash='+('a'.repeat(64))+'&type=email&type=magiclink'},
  {search:'?token_hash='+('a'.repeat(64))+'&type=email',hash:implicitHash},
  {search:'?token_hash='+('a'.repeat(64))+'&type=email',missingSession:true},
  {search:'?token_hash='+('a'.repeat(64))+'&type=email',linkVerifyError:true,authDuringVerify:true}
]) {
  const h=await harness(opts);
  h.authEvent();
  assert.equal(h.calls.navigations.length,0,'invalid callback must not fall through to older session/events');
  assert.equal(h.calls.sends.length,0);
  assert.equal(h.calls.replaced.length,1,'credentials scrubbed even on failure');
  const message=h.dom.window.document.querySelector('#authMessage');
  assert(message.classList.contains('error'));
  assert.match(message.textContent,/sign-in link/);
  assert(!message.textContent.includes('synthetic-secret'));
  h.close();
}
// Callback errors do not prevent a subsequent explicitly requested OTP login.
{
  const h=await harness({hash:'#error_code=otp_expired'});
  await h.send();await h.verify('12345678');
  assert.deepEqual(h.calls.navigations,[fallback]);
  h.close();
}
for(const target of unsafe) {
  for(const callback of [{hash:implicitHash,initialSession:true}, {search:'?token_hash='+('a'.repeat(64))+'&type=email&next='+encodeURIComponent(target)}]) {
    const h=await harness({next:target,stored:'//poison.example',...callback});
    assert.deepEqual(h.calls.navigations,[fallback]);
    assert.deepEqual(h.calls.order,['scrub','navigate']);
    h.close();
  }
}
{
  const h=await harness({search:'?token_hash='+('a'.repeat(64))+'&type=email&next=%2Fstaff-outreach-registration.html',authDuringVerify:true});
  assert.deepEqual(h.calls.order,['scrub','navigate'],'verifyOtp events must not race URL cleanup');
  assert.equal(h.calls.sends.length,0);
  h.close();
}
{
  const h=await harness({verifyError:true,authDuringVerify:true});
  await h.send();await h.verify('12345678');
  assert.equal(h.calls.navigations.length,0,'failed OTP must not redirect from an early auth event');
  h.close();
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

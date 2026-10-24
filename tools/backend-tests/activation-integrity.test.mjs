import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { createServer } from 'node:http';
import { once } from 'node:events';
import { JSDOM } from 'jsdom';
import { activationCsp, activationPaths, reviewedPrettyHtml, verifyActivationBody, verifyActivationResponse } from '../site-build/activation-response-contract.mjs';

const source = await readFile(new URL('../../staff-huntsville-activation.html', import.meta.url));
const captured = await readFile(new URL('fixtures/activation-netlify-served.html', import.meta.url));
const script = await readFile(new URL('../../assets/js/staff-huntsville-activation.js', import.meta.url));
let checks = 0;
const check = fn => { fn(); checks++; };
check(() => assert.deepEqual(reviewedPrettyHtml(source), captured));
for (const p of activationPaths.slice(0, 2)) {
  check(() => assert.equal(verifyActivationBody(p, source, source), 'exact-source'));
  check(() => assert.equal(verifyActivationBody(p, captured, source), 'reviewed-netlify-pretty-urls'));
}
check(() => assert.equal(verifyActivationBody(activationPaths[2], script, script), 'exact-source'));
// Every single-byte alteration of either admitted HTML representation must fail.
for (const original of [source, captured]) for (let i = 0; i < original.length; i++) {
  const changed = Buffer.from(original); changed[i] ^= 1;
  check(() => assert.throws(() => verifyActivationBody(activationPaths[0], changed, source)));
}
const text = captured.toString();
for (const changed of [
  text + '<script src="https://evil.invalid/x.js"></script>',
  text.replace('</main>', '<a href="https://evil.invalid">Injected</a></main>'),
  text.replace("href='/staff-people'", "href='//evil.invalid/staff-people'"),
  text.replace("href='/discipleship-login?", "href='http://championlifefwb.com/discipleship-login?"),
  text.replace('%2Fstaff-huntsville-activation.html', '%2Ffinancial-admin'),
  text.replace("id='activation-login'", "id='activation-login' onclick='evil()'"),
  text.replace(' hidden ', ' '),
  text.replace(' disabled>', '>'),
  text.replace('e251f6d2-d760-478f-acfa-526823ad1eb7', 'eae35d7d-2283-434d-8134-f8f12d404572'),
  text.replace("default-src 'none'", "default-src *"),
  text.replace('/assets/js/staff-huntsville-activation.js', '/assets/js/other.js'),
  text.replace("href='/staff-people'", 'href="/staff-people.html"'),
  text.replace("href='/staff-people'", "href='/staff-people/'"),
  text.replace('<body ', '<body  '), text.trimEnd(),
]) check(() => assert.throws(() => verifyActivationBody(activationPaths[0], Buffer.from(changed), source)));
check(() => assert.throws(() => verifyActivationBody(activationPaths[2], Buffer.concat([script, Buffer.from('\n')]), script)));
check(() => assert.throws(() => verifyActivationBody('/unexpected', captured, source)));
check(() => assert.throws(() => verifyActivationBody(activationPaths[0], captured, captured)));
check(() => assert.throws(() => verifyActivationBody(activationPaths[0], Buffer.from('<html>error</html>'), source)));

const before = new JSDOM(source.toString()).window.document;
const after = new JSDOM(captured.toString()).window.document;
check(() => assert.deepEqual([...after.querySelectorAll('a')].map(a => a.getAttribute('href')), ['/staff-people', '/discipleship-login?next=%2Fstaff-huntsville-activation.html']));
check(() => assert(after.querySelector('#activation-login').hidden));
for (const selector of ['script', 'meta', 'button', 'link', '#activation-actions'])
  check(() => assert.deepEqual([...before.querySelectorAll(selector)].map(e => e.outerHTML), [...after.querySelectorAll(selector)].map(e => e.outerHTML)));

// Full HTTP response lifecycle combines unchanged header gates with body gates.
const server = createServer((req, res) => {
  res.writeHead(200, { 'Content-Type': 'text/html; charset=UTF-8', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer', 'X-Robots-Tag': 'noindex, nofollow, noarchive', 'Content-Security-Policy': activationCsp });
  res.end(req.method === 'HEAD' ? undefined : captured);
});
server.listen(0, '127.0.0.1'); await once(server, 'listening');
try {
  for (const p of activationPaths.slice(0, 2)) for (const method of ['GET', 'HEAD']) {
    const r = await fetch(`http://127.0.0.1:${server.address().port}${p}`, { method, redirect: 'manual' });
    check(() => verifyActivationResponse(p, r, 'installed'));
    if (method === 'GET') {
      const bytes = Buffer.from(await r.arrayBuffer());
      check(() => assert.equal(verifyActivationBody(p, bytes, source), 'reviewed-netlify-pretty-urls'));
    }
  }
} finally { await new Promise(resolve => server.close(resolve)); }
console.log(`PASS ${checks} exact pretty-URL integrity, injected-content rejection, DOM and HTTP checks`);

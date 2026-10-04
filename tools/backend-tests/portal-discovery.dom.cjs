const { JSDOM } = require('jsdom');
const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const root = path.resolve(__dirname, '../..');
const tick = async () => { await new Promise(r => setTimeout(r, 0)); await new Promise(r => setTimeout(r, 0)); };
const member = '11111111-1111-4111-8111-111111111111', partner = '22222222-2222-4222-8222-222222222222';
const resource = '33333333-3333-4333-8333-333333333333';
const query = '?area=' + partner + '&resource=' + resource;
async function setup({ signedIn = true, suffix = '', unavailable = false } = {}) {
  const dom = new JSDOM(fs.readFileSync(path.join(root, 'my-ministry.html'), 'utf8'), { runScripts: 'outside-only', url: 'https://championlifefwb.com/my-ministry.html' + suffix });
  const w = dom.window, d = w.document, calls = [];
  w.HTMLDialogElement.prototype.close = function () { this.open = false; };
  w.HTMLDialogElement.prototype.showModal = function () { this.open = true; };
  const state = { late: null, copied: '', copyFails: false, unavailable, failList: false };
  Object.defineProperty(w.navigator, 'clipboard', { value: { writeText: async text => { if (state.copyFails) throw Error(); state.copied = text; } } });
  w.ChampionLifeAuth = { getUser: async () => signedIn ? { id: 'one' } : null, signOut: async () => { throw Error('offline'); }, client: {
    auth: { onAuthStateChange(fn) { state.account = fn; } }, from(table) {
      let single = false; const c = { table, filters: {}, range: null };
      const q = { select() { return q; }, order() { return q; }, eq(k, v) { c.filters[k] = v; return q; },
        ilike(k, v) { c.search = [k, v]; return q; }, range(a, b) { c.range = [a, b]; return q; },
        maybeSingle() { single = true; return q; }, then(resolve) {
          calls.push(c);
          if (state.late) return state.late.then(resolve);
          let data;
          if (table === 'portal_areas') data = [
            { id: member, organization_id: 'church', title: 'Members', organization_label: 'Champion Life' },
            { id: partner, organization_id: 'outreach', title: 'Partners', organization_label: 'SowGo' }
          ];
          else if (single) data = state.unavailable ? null : { title: 'Partner update', body: 'Protected content' };
          else data = c.search ? [] : Array.from({ length: c.range[0] ? 1 : 13 }, (_, i) => ({ id: resource, title: 'Resource ' + i, summary: 'Summary' }));
          return Promise.resolve({ data, error: state.failList && !single && table === 'portal_resources' ? {} : null }).then(resolve);
        }
      }; return q;
    }
  } };
  w.eval(fs.readFileSync(path.join(root, 'assets/js/participant-portal.js'), 'utf8')); await tick();
  return { w, d, state, calls, close: () => w.close(), click: id => d.getElementById(id).click(), search(value) {
    d.getElementById('ministry-search').value = value;
    d.getElementById('ministry-search-form').dispatchEvent(new w.Event('submit', { cancelable: true }));
  } };
}
(async () => {
  let t = await setup({ signedIn: false, suffix: query + '&next=//evil.example' });
  assert.equal(new URL(t.d.getElementById('ministry-sign-in').href).searchParams.get('next'), '/my-ministry.html' + query);
  assert.equal(t.calls.length, 0); t.close();
  t = await setup({ suffix: query });
  assert.equal(t.d.getElementById('ministry-area').value, partner);
  assert.equal(t.d.getElementById('ministry-resource-body').textContent, 'Protected content');
  assert.equal(t.calls.at(-1).filters.organization_id, 'outreach');
  assert.equal(t.calls.at(-1).filters.status, 'published');
  t.click('ministry-resource-copy'); await tick();
  assert.equal(t.state.copied, 'https://championlifefwb.com/my-ministry.html' + query);
  t.state.copyFails = true; t.click('ministry-resource-copy'); await tick();
  assert.equal(t.d.getElementById('ministry-resource-link').value, t.state.copied);
  t.click('ministry-resource-close');
  assert.equal(t.d.getElementById('ministry-resource-link').value, '');
  assert.equal(t.d.querySelectorAll('#ministry-resources article').length, 12);
  t.click('ministry-next'); await tick();
  assert.deepEqual(t.calls.at(-1).range, [12, 24]);
  assert.equal(t.d.getElementById('ministry-next').disabled, true);
  t.search('  prayer%_*\\ guide  '); await tick();
  assert.deepEqual(t.calls.at(-1).search, ['title', '%prayer guide%']);
  assert.deepEqual(t.calls.at(-1).range, [0, 12]);
  assert.equal(t.calls.at(-1).filters.area_id, partner);
  assert.match(t.d.getElementById('ministry-status').textContent, /No matching titles/);
  t.click('ministry-search-clear'); await tick();
  assert.equal(t.calls.at(-1).search, undefined);
  let resolve;
  t.state.late = new Promise(r => { resolve = r; });
  t.search('obsolete'); await tick();
  t.state.late = null;
  t.d.getElementById('ministry-area').value = member;
  t.d.getElementById('ministry-area').dispatchEvent(new t.w.Event('change')); await tick();
  resolve({ data: [{ id: resource, title: 'Stale private title' }], error: null }); await tick();
  assert.doesNotMatch(t.d.getElementById('ministry-resources').textContent, /Stale/);
  assert.equal(t.d.getElementById('ministry-search').value, '');
  t.state.failList = true; t.click('ministry-next'); await tick();
  assert.match(t.d.getElementById('ministry-status').textContent, /could not load/);
  assert.equal(t.d.getElementById('ministry-prev').disabled, false);
  t.state.failList = false; t.click('ministry-prev'); await tick();
  t.d.querySelector('#ministry-resources button').click(); await tick();
  t.click('ministry-sign-out'); await tick();
  assert.equal(t.d.getElementById('ministry-resource-body').textContent, '');
  assert.equal(t.d.getElementById('ministry-resources').textContent, '');
  assert.match(t.d.getElementById('ministry-status').textContent, /Sign out could not complete/); t.close();
  t = await setup({ suffix: query, unavailable: true });
  assert.match(t.d.getElementById('ministry-resource-status').textContent, /unavailable/);
  assert.equal(t.d.getElementById('ministry-resource-copy').hidden, true); t.close();
  t = await setup({ suffix: query.replace(partner, '99999999-9999-4999-8999-999999999999') });
  assert.match(t.d.getElementById('ministry-status').textContent, /does not have access/);
  assert.equal(t.calls.some(c => c.filters.id === resource), false); t.close();
  t = await setup();
  t.state.late = new Promise(r => { resolve = r; });
  t.d.querySelector('#ministry-resources button').click(); await tick();
  t.state.account('SIGNED_IN', { user: { id: 'two' } });
  resolve({ data: { title: 'Stale', body: 'Should never display' }, error: null }); await tick();
  assert.equal(t.d.getElementById('ministry-resource-body').textContent, '');
  assert.equal(t.d.getElementById('ministry-resource-copy').hidden, true); t.close();
  console.log('PASS portal discovery: scoped search, paging, deep links, copy fallback, unavailable access, late response isolation and failed sign-out clearing');
})().catch(e => { console.error(e); process.exitCode = 1; });

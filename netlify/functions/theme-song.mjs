import { createHmac, timingSafeEqual } from 'node:crypto';
import pg from 'pg';
import { CounterStore, CounterError } from '../lib/theme-song-store.mjs';

const cookieName = '__Host-cl-song';
const uuid = /^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/;
const response = (status, data, headers = {}) => new Response(JSON.stringify(data), { status, headers: {
  'Content-Type': 'application/json', 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'Referrer-Policy': 'no-referrer', ...headers
} });
const mac = (key, value) => createHmac('sha256', key).update(value).digest('hex');
const sign = (id, key) => `${id}.${mac(key, id)}`;
function sessionID(request, key) {
  const raw = (request.headers.get('cookie') || '').split('; ').find(v => v.startsWith(cookieName + '='))?.slice(cookieName.length + 1) || '';
  const [id, sig, extra] = raw.split('.');
  if (!uuid.test(id || '') || !/^[a-f0-9]{64}$/.test(sig || '') || extra) return null;
  return timingSafeEqual(Buffer.from(sig), Buffer.from(mac(key, id))) ? id : null;
}

export function configuration(get) {
  if (get('THEME_SONG_COUNTER_ENABLED') !== 'true') return null;
  try {
    const origin = get('THEME_SONG_ORIGIN'), url = new URL(origin);
    const database = new URL(get('THEME_SONG_DATABASE_URL'));
    const key = get('THEME_SONG_SESSION_KEY');
    const installation = get('THEME_SONG_INSTALLATION_ID'), site = get('THEME_SONG_SITE_ID');
    const environment = get('THEME_SONG_CONTEXT');
    if (url.protocol !== 'https:' || url.origin !== origin || !/^[a-z0-9.-]+$/.test(url.hostname) || url.username || url.password ||
        !['production','deploy-preview'].includes(environment) || !uuid.test(installation || '') || !uuid.test(site || '') ||
        typeof key !== 'string' || key.length < 43 ||
        !['postgres:','postgresql:'].includes(database.protocol) || !database.username || !database.password ||
        database.search || database.hash || database.hostname !== get('THEME_SONG_DATABASE_HOST') ||
        /supabase/i.test(database.href) || !database.hostname.includes('.') ||
        !['/champion_theme_song','/champion_theme_song_preview'].includes(database.pathname) ||
        (environment === 'production') !== (database.pathname === '/champion_theme_song')) return null;
    return { origin, database, key, installation, site, environment };
  } catch { return null; }
}

export function createHandler(get, makeStore) {
  return async (request, context) => {
    const cfg = configuration(get);
    if (!cfg) return response(503, { error: 'Play count unavailable' });
    if (context.site?.id !== cfg.site || context.deploy?.context !== cfg.environment || new URL(request.url).origin !== cfg.origin ||
        (request.headers.get('origin') && request.headers.get('origin') !== cfg.origin) ||
        ['cross-site','same-site'].includes(request.headers.get('sec-fetch-site'))) return response(403, { error: 'Request not allowed' });
    if (!['GET','POST'].includes(request.method)) return response(405, { error: 'Method not allowed' }, { Allow: 'GET, POST' });
    let kind;
    if (request.method === 'POST') {
      if (request.headers.get('origin') !== cfg.origin || request.headers.get('content-type') !== 'application/json' || !context.ip) return response(403, { error: 'Request not allowed' });
      // Read a bounded stream; never buffer attacker-controlled arbitrarily large bodies.
      const reader = request.body?.getReader(); let chunks = '', bytes = 0;
      if (!reader) return response(400, { error: 'Invalid request' });
      try {
        for (;;) { const { value, done } = await reader.read(); if (done) break; bytes += value.length; if (bytes > 64) { await reader.cancel(); return response(413, { error: 'Request too large' }); } chunks += new TextDecoder().decode(value); }
        const body = JSON.parse(chunks);
        if (!body || Object.keys(body).length !== 1 || !['start','play','download','giving'].includes(body.kind)) throw new Error();
        kind = body.kind;
      } catch { return response(400, { error: 'Invalid request' }); }
    }
    try {
      const result = await makeStore(cfg).run(kind, sessionID(request, cfg.key), mac(cfg.key, `${new Date().toISOString().slice(0,10)}|${context.ip || ''}`));
      const headers = kind === 'start' ? { 'Set-Cookie': `${cookieName}=${sign(result.session, cfg.key)}; Secure; HttpOnly; SameSite=Strict; Path=/; Max-Age=7200` } : {};
      return response(200, { plays: result.plays }, headers);
    } catch (error) {
      const status = error instanceof CounterError ? error.status : 503;
      return response(status, { error: status === 425 ? 'Keep listening' : status === 429 ? 'Please try later' : 'Play count unavailable' }, status === 429 ? { 'Retry-After': '60' } : {});
    }
  };
}

let store;
export default createHandler(name => globalThis.Netlify?.env.get(name), cfg => {
  if (!store) {
    const db = cfg.database;
    const pool = new pg.Pool({ host: db.hostname, port: Number(db.port || 5432), database: db.pathname.slice(1),
      user: decodeURIComponent(db.username), password: decodeURIComponent(db.password),
      ssl: { rejectUnauthorized: true }, max: 2, connectionTimeoutMillis: 3000, idleTimeoutMillis: 10000 });
    // Never log connection strings, request bodies, cookies or driver errors.
    pool.on('error', () => {});
    store = new CounterStore(pool, cfg.installation, cfg.environment);
  }
  return store;
});

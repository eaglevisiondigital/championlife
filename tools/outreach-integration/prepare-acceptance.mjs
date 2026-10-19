// Offline packaging only. No database connection, ledger repair or SQL application.
import { readFileSync, readdirSync, mkdirSync, writeFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('../../', import.meta.url));
const read = p => readFileSync(path.join(root, p));
const json = p => JSON.parse(read(p));
const hash = (bytes, algorithm = 'sha256') => createHash(algorithm).update(bytes).digest('hex');
const git = (...args) => execFileSync('git', args, { cwd: root, maxBuffer: 16 * 1024 * 1024, stdio: ['ignore', 'pipe', 'pipe'] });
const source = (commit, file) => {
  try { return git('show', commit + ':' + file); }
  catch { throw Error('Source provenance unavailable: ' + commit + ':' + file); }
};

const out = process.argv[2];
if (!out || !path.isAbsolute(out) || existsSync(out)) throw Error('Supply a new absolute disposable output directory.');
const baseline = json('docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json');
const plan = json('config/outreach/acceptance-migration-plan.json');
if (plan.version !== 1 || plan.productionCommit !== baseline.productionCommit ||
    baseline.migrations.length !== 25 || plan.expectedBaselineCount !== 25 ||
    plan.expectedForwardCount !== 5 || plan.expectedTotalCount !== 30 || plan.forwardMigrations.length !== 5) {
  throw Error('Expected reviewed 25-baseline + five-forward = 30 migration plan.');
}
for (const commit of [plan.productionCommit, plan.outreachCommit, plan.gate0SqlCommit]) {
  if (!/^[a-f0-9]{40}$/.test(commit) || git('rev-parse', commit + '^{commit}').toString().trim() !== commit) {
    throw Error('Exact immutable source commit required.');
  }
}

const staged = [], reviewed = new Set();
for (const item of baseline.migrations) {
  if (!/^\d{14}_[a-z0-9_]+\.sql$/.test(item.sourceFile)) throw Error('Invalid baseline source path.');
  const file = 'supabase/migrations/' + item.sourceFile, raw = read(file);
  if (!raw.equals(source(plan.productionCommit, file))) throw Error('Production source bytes changed: ' + file);
  const sql = item.sourceNormalization === 'trim-final-newline' ? Buffer.from(raw.toString().replace(/\n$/, '')) : raw;
  if (hash(sql, 'md5') !== item.sql_md5) throw Error('Production baseline SQL mismatch: ' + file);
  reviewed.add(item.sourceFile);
  staged.push({ file: item.version + '_' + item.name + '.sql', bytes: sql, source: item.sourceFile, sourceCommit: plan.productionCommit });
}
let lastVersion = baseline.migrations.at(-1).version;
for (const [i, item] of plan.forwardMigrations.entries()) {
  if (!/^supabase\/migrations\/\d{14}_[a-z0-9_]+\.sql$/.test(item.path) || !/^[a-f0-9]{64}$/.test(item.sha256) ||
      item.sourceCommit !== (i < 4 ? plan.outreachCommit : plan.gate0SqlCommit)) throw Error('Invalid reviewed forward source.');
  const file = path.basename(item.path), version = file.slice(0, 14);
  if (version <= lastVersion || reviewed.has(file)) throw Error('Forward migration order or duplicate invalid.');
  const bytes = read(item.path);
  if (hash(bytes) !== item.sha256 || hash(source(item.sourceCommit, item.path)) !== item.sha256) {
    throw Error('Forward SQL hash/provenance mismatch: ' + item.path);
  }
  reviewed.add(file); lastVersion = version;
  staged.push({ file, bytes, source: file, sourceCommit: item.sourceCommit });
}
const unreviewed = readdirSync(path.join(root, 'supabase/migrations')).filter(f => f.endsWith('.sql') && !reviewed.has(f));
if (unreviewed.length) throw Error('Unreviewed migration requires an explicit plan: ' + unreviewed.join(', '));
if (staged.length !== 30) throw Error('Incomplete reviewed acceptance package.');

const dest = path.join(out, 'supabase/migrations');
mkdirSync(dest, { recursive: true });
for (const f of staged) writeFileSync(path.join(dest, f.file), f.bytes);
writeFileSync(path.join(out, 'PACKAGE.json'), JSON.stringify({
  productionCommit: plan.productionCommit,
  sourceCommits: { outreach: plan.outreachCommit, gate0Sql: plan.gate0SqlCommit },
  candidateCommit: git('rev-parse', 'HEAD').toString().trim(),
  candidateWorktreeClean: !git('status', '--porcelain').toString().trim(),
  files: staged.map(f => ({ file: f.file, source: f.source, sourceCommit: f.sourceCommit, sha256: hash(f.bytes) })),
  applied: false,
  warning: 'ISOLATED ACCEPTANCE ONLY. Verify the exact clean adopted candidate and reviewed plan before use. No credentials or customer data. No automatic application.'
}, null, 2) + '\n');
console.log(JSON.stringify({ output: out, migrations: 30, productionVersions: 25, forwardVersions: 5, applied: false }));

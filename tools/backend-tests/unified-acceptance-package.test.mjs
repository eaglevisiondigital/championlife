// Exercise the real offline CLI in a disposable local clone. No hosted calls.
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync, copyFileSync, rmSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { execFileSync, spawnSync } from 'node:child_process';
import { createHash } from 'node:crypto';
const root = fileURLToPath(new URL('../../', import.meta.url));
const dir = mkdtempSync(path.join(tmpdir(), 'outreach-package-')), fixture = path.join(dir, 'source');
const planPath = 'config/outreach/acceptance-migration-plan.json';
let n = 0;
const ok = (value, message) => { assert.ok(value, message); n++; console.log('PASS ' + message); };
const hash = bytes => createHash('sha256').update(bytes).digest('hex');
const read = file => readFileSync(path.join(root, file));
const baseline = JSON.parse(read('docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json'));
const plan = JSON.parse(read(planPath));
const put = (file, bytes) => { const p = path.join(fixture, file); mkdirSync(path.dirname(p), { recursive: true }); writeFileSync(p, bytes); };
const invoke = name => spawnSync(process.execPath, ['tools/outreach-integration/prepare-acceptance.mjs', path.join(dir, name)], { cwd: fixture, encoding: 'utf8' });
const reject = (name, pattern) => { const r = invoke(name); ok(r.status !== 0 && pattern.test(r.stderr) && !existsSync(path.join(dir, name)), name + ' denied before artifact creation'); };
try {
  execFileSync('git', ['clone', '--quiet', '--shared', '--no-checkout', root, fixture], { stdio: ['ignore', 'pipe', 'pipe'] });
  for (const file of ['tools/outreach-integration/prepare-acceptance.mjs', planPath, 'docs/UNIFIED-OUTREACH-PRODUCTION-BASELINE.json',
    ...baseline.migrations.map(m => 'supabase/migrations/' + m.sourceFile), ...plan.forwardMigrations.map(m => m.path)]) put(file, read(file));
  const result = invoke('exact');
  assert.equal(result.status, 0, result.stderr);
  const packaged = JSON.parse(readFileSync(path.join(dir, 'exact/PACKAGE.json')));
  ok(packaged.files.length === 30 && packaged.applied === false, 'exact 25 baseline + five forward files; never applied');
  ok(packaged.sourceCommits.outreach === 'bff9612ac9385cf963c5e7e41f9091da7af86cf0' &&
    packaged.sourceCommits.gate0Sql === '3439e703ec5186e779f458ab5496afde611cc4aa', 'exact immutable source refs retained');
  ok(packaged.files.at(-1).file === '20261019012735_shared_platform_gate0.sql', 'Gate0 SQL is present after unchanged Outreach migrations');
  for (const entry of packaged.files) assert.equal(hash(readFileSync(path.join(dir, 'exact/supabase/migrations', entry.file))), entry.sha256);
  ok(true, 'every emitted SQL byte matches its recorded hash');
  ok(['20261018113932', '20261018113939', '20261018144843'].every(v => packaged.files.some(f => f.file.startsWith(v + '_'))), 'actual production ledger aliases retained');
  const currentPlan = JSON.stringify(plan, null, 2) + '\n';
  const forward = plan.forwardMigrations[0], raw = read(forward.path);
  put(forward.path, Buffer.concat([raw, Buffer.from('\n-- tampered\n')]));
  reject('changed-forward', /Forward SQL hash\/provenance mismatch/); put(forward.path, raw);
  const gate = plan.forwardMigrations.at(-1); rmSync(path.join(fixture, gate.path));
  reject('missing-gate', /ENOENT/); put(gate.path, read(gate.path));
  put('supabase/migrations/20261020000000_unreviewed.sql', 'select 1;\n');
  reject('unreviewed-sql', /Unreviewed migration/); rmSync(path.join(fixture, 'supabase/migrations/20261020000000_unreviewed.sql'));
  const wrongRef = structuredClone(plan); wrongRef.outreachCommit = 'HEAD'; put(planPath, JSON.stringify(wrongRef));
  reject('moving-source', /Exact immutable source commit/); put(planPath, currentPlan);
  const wrongSource = structuredClone(plan); wrongSource.forwardMigrations[4].sourceCommit = plan.outreachCommit; put(planPath, JSON.stringify(wrongSource));
  reject('wrong-provenance', /Invalid reviewed forward source/); put(planPath, currentPlan);
  const traversal = structuredClone(plan); traversal.forwardMigrations[0].path = '../outside.sql'; put(planPath, JSON.stringify(traversal));
  reject('path-traversal', /Invalid reviewed forward source/); put(planPath, currentPlan);
  const reversed = structuredClone(plan); [reversed.forwardMigrations[0], reversed.forwardMigrations[1]] = [reversed.forwardMigrations[1], reversed.forwardMigrations[0]]; put(planPath, JSON.stringify(reversed));
  reject('reordered-sql', /Forward migration order/); put(planPath, currentPlan);
  const production = 'supabase/migrations/' + baseline.migrations[0].sourceFile;
  put(production, Buffer.concat([read(production), Buffer.from('\n')]));
  reject('changed-production', /Production source bytes changed/); put(production, read(production));
  const retry = invoke('exact');
  ok(retry.status !== 0 && /new absolute disposable output/.test(retry.stderr), 'existing artifact is never overwritten');
  console.log(n + ' offline adopted acceptance package checks passed');
} finally { rmSync(dir, { recursive: true, force: true }); }

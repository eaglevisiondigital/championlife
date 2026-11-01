// Node-only, disconnected source-review loader. Never fetches a remote or reads credentials.
import { readFile, mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let loaded;
function source() { return loaded ??= load().catch(error => { loaded = undefined; throw error; }); }
export async function loadPinnedExecutor() { return (await source()).executeNmiGiving; }
export async function loadPinnedGateway() { return (await source()).createGivingHandler; }
async function load() {
  const pin = JSON.parse(await readFile(new URL('./executor-source-pin.json', import.meta.url), 'utf8'));
  if (pin.commit !== '84b2d9ab398bb8046570019da26a5db67fe77467' ||
      Object.keys(pin.files).sort().join(',') !== 'acceptance-pin.mjs,gateway.mjs,nmi-executor-batch.mjs,nmi-executor.mjs,nmi-query.mjs,nmi.mjs,providers.mjs') throw Error('SOURCE_PIN_INVALID');
  const folder = await mkdtemp(join(tmpdir(), 'nmi-reviewed-source-'));
  try {
    for (const [name, entry] of Object.entries(pin.files)) {
      const expected = name === 'gateway.mjs' ? 'supabase/functions/nmi-giving/gateway.mjs' : `supabase/functions/_shared/payments/${name}`;
      if (entry.path !== expected) throw Error('SOURCE_PATH_INVALID');
      const bytes = execFileSync('git', ['show', `${pin.commit}:${entry.path}`], {
        cwd: dirname(fileURLToPath(import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1048576,
      });
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('SOURCE_HASH_MISMATCH');
      const dest = join(folder,entry.path);await mkdir(dirname(dest),{recursive:true,mode:0o700});
      await writeFile(dest, bytes, { mode: 0o600 });
    }
    const url = path => pathToFileURL(join(folder,'supabase/functions',path)).href;
    // Warm the gateway's lazy batch dependency before removing private temporary source files.
    await import(url('_shared/payments/nmi-executor-batch.mjs'));
    const executor=await import(url('_shared/payments/nmi-executor.mjs'));
    const gateway=await import(url('nmi-giving/gateway.mjs'));
    return {executeNmiGiving:executor.executeNmiGiving,createGivingHandler:gateway.createGivingHandler};
  } finally { await rm(folder, { recursive: true, force: true }); }
}

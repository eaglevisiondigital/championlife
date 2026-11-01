// Node-only, disconnected source-review loader. Never fetches a remote or reads credentials.
import { readFile, mkdtemp, writeFile, rm } from 'node:fs/promises';
import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

let loaded;
export function loadPinnedExecutor() {
  return loaded ??= load().catch(error => { loaded = undefined; throw error; });
}
async function load() {
  const pin = JSON.parse(await readFile(new URL('./executor-source-pin.json', import.meta.url), 'utf8'));
  if (pin.commit !== '4e463f792bf9a2af03345e8854433e2d00863729' ||
      Object.keys(pin.files).sort().join(',') !== 'acceptance-pin.mjs,nmi-executor.mjs,nmi-query.mjs,nmi.mjs,providers.mjs') throw Error('SOURCE_PIN_INVALID');
  const folder = await mkdtemp(join(tmpdir(), 'nmi-reviewed-source-'));
  try {
    for (const [name, entry] of Object.entries(pin.files)) {
      if (entry.path !== `supabase/functions/_shared/payments/${name}`) throw Error('SOURCE_PATH_INVALID');
      const bytes = execFileSync('git', ['show', `${pin.commit}:${entry.path}`], {
        cwd: dirname(fileURLToPath(import.meta.url)), stdio: ['ignore', 'pipe', 'pipe'], maxBuffer: 1048576,
      });
      if (createHash('sha256').update(bytes).digest('hex') !== entry.sha256) throw Error('SOURCE_HASH_MISMATCH');
      await writeFile(join(folder, name), bytes, { mode: 0o600 });
    }
    return (await import(pathToFileURL(join(folder, 'nmi-executor.mjs')).href)).executeNmiGiving;
  } finally { await rm(folder, { recursive: true, force: true }); }
}

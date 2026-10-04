import { readdirSync } from 'node:fs';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
const directory = new URL('../../assets/js/', import.meta.url);
const files = readdirSync(directory).filter(name => name.endsWith('.js')).sort();
for (const file of files) {
  const result = spawnSync(process.execPath, ['--check', fileURLToPath(new URL(file, directory))], {encoding:'utf8'});
  assert.equal(result.status, 0, `${file}: ${result.error || result.stderr}`);
}
console.log(`PASS syntax: ${files.length} application JavaScript files`);

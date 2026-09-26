import { PGlite } from '@electric-sql/pglite';
import { readFileSync, readdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import assert from 'node:assert/strict';

// In-memory only: no connection string, environment credentials or remote services.
const directory = new URL('../../supabase/migrations/', import.meta.url);
const fixture = name => readFileSync(new URL(`fixtures/${name}`, import.meta.url), 'utf8');
const expected = JSON.parse(fixture('migration-baseline.json'));
const hash = text => createHash('sha256').update(text).digest('hex');
const canonical = text => text.replace(/\s+/g, ' ').trim();
const ordered = (rows, key) => [...rows].sort((a, b) => key(a).localeCompare(key(b), 'en'));
const functionKey = f => `${f.schema}.${f.name}(${f.args})`;
const policyKey = p => `${p.schemaname}.${p.tablename}.${p.policyname}`;
const files = readdirSync(directory).filter(name => name.endsWith('.sql')).sort();
assert.deepEqual(files, expected.migrations.map(m => m.file), 'Migration inventory changed: review the full-chain baseline with every new migration');
assert.equal(new Set(files.map(name => name.split('_')[0])).size, files.length, 'Duplicate migration versions');
for (const m of expected.migrations) {
  assert.match(m.file, /^\d{14}_[a-z0-9_]+\.sql$/);
  assert.equal(hash(readFileSync(new URL(m.file, directory))), m.sha256, `Applied historical migration changed: ${m.file}`);
}
const db = new PGlite();
try {
  await db.exec(fixture('supabase-test-bootstrap.sql'));
  for (const file of files) {
    try { await db.exec(readFileSync(new URL(file, directory), 'utf8')); }
    catch (error) { throw new Error(`Migration replay failed: ${file}`, { cause: error }); }
  }
  const tables = (await db.query("select relname,relrowsecurity from pg_class where relnamespace='public'::regnamespace and relkind='r' order by relname")).rows;
  assert.deepEqual(tables, expected.tables, 'Public table inventory / RLS changed');
  assert.ok(tables.every(table => table.relrowsecurity), 'Every public application table requires RLS');
  const policies = (await db.query("select schemaname,tablename,policyname,roles,cmd,qual,with_check from pg_policies where schemaname in ('public','private')")).rows;
  assert.deepEqual(ordered(policies, policyKey), ordered(expected.policies, policyKey), 'Policy inventory or definition changed');
  const functions = (await db.query("select n.nspname as schema,p.proname as name,pg_get_function_identity_arguments(p.oid) as args,pg_get_functiondef(p.oid) as definition from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('public','private') and p.prokind='f'")).rows;
  assert.deepEqual(ordered(functions.map(({definition, ...identity}) => ({...identity, sha256:hash(canonical(definition))})), functionKey), ordered(expected.functions, functionKey), 'Function inventory or definition changed');
  const scalar = async sql => (await db.query(sql)).rows[0].value;
  assert.equal(await scalar("select count(*)::int as value from pg_policies where tablename='organization_staff_directory'"), 0, 'Directory remains RPC-only');
  assert.equal(await scalar("select has_table_privilege('authenticated','public.organization_staff_directory','SELECT') as value"), false, 'No direct directory grant');
  assert.equal(await scalar("select count(*)::int as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='private' and has_function_privilege('anon',p.oid,'EXECUTE')"), 0, 'No anonymous private-function execution');
  assert.equal(await scalar("select count(*)::int as value from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.prosecdef and (has_function_privilege('anon',p.oid,'EXECUTE') or has_function_privilege('authenticated',p.oid,'EXECUTE'))"), 0, 'No client-callable public SECURITY DEFINER functions');
  console.log(`PASS full migration chain: ${files.length} migrations, ${tables.length} RLS tables, ${policies.length} policies, ${functions.length} function definitions; directory/RPC grants verified`);
} finally {
  await db.close();
}

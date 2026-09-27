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
const bootstrap = readFileSync(new URL('../../supabase/bootstrap/automatic-rls.sql', import.meta.url), 'utf8');
// These are managed-platform assumptions, not application objects. The public
// defaults mirror the read-only acceptance catalog (automatic exposure disabled).
const managedDefaults = `
 alter default privileges in schema public grant truncate, references, trigger, maintain on tables to anon, authenticated, service_role;
 alter default privileges in schema public revoke execute on functions from public, anon, authenticated, service_role;
 create schema supabase_migrations;
 create table supabase_migrations.schema_migrations(version text primary key);
`;
for (const mode of ['fresh-explicit-rls', 'managed-failed-prefix']) {
 const db = new PGlite();
 try {
  await db.exec(fixture('supabase-test-bootstrap.sql'));
  await db.exec(managedDefaults);
  assert.equal((await db.query("select to_regprocedure('public.rls_auto_enable()') as helper")).rows[0].helper, null);
  if (mode === 'managed-failed-prefix') {
    await db.exec(readFileSync(new URL(files[0], directory), 'utf8'));
    await db.exec(`insert into supabase_migrations.schema_migrations values ('20260923114743')`);
    await assert.rejects(db.exec(readFileSync(new URL(files[1], directory), 'utf8')), e => e.code === '42883' && e.message.includes('rls_auto_enable'));
  }
  await db.exec(bootstrap);
  await db.exec(bootstrap); // Safe repeat before migration; no duplicate objects.
  for (const role of ['anon', 'authenticated', 'service_role']) {
    assert.equal((await db.query(`select has_function_privilege('${role}','public.rls_auto_enable()','EXECUTE') as allowed`)).rows[0].allowed, false);
  }
  await db.exec('create table public.bootstrap_probe(id integer)');
  assert.equal((await db.query("select relrowsecurity from pg_class where oid='public.bootstrap_probe'::regclass")).rows[0].relrowsecurity, true);
  await db.exec('drop table public.bootstrap_probe');
  // Keep independent proof that every application migration explicitly enables RLS.
  if (mode === 'fresh-explicit-rls') await db.exec('drop event trigger ensure_rls');
  for (const file of (mode === 'managed-failed-prefix' ? files.slice(1) : files)) {
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
  console.log(`PASS ${mode} full migration chain: ${files.length} migrations, ${tables.length} RLS tables, ${policies.length} policies, ${functions.length} function definitions; directory/RPC grants verified`);
  // A deployed database is not eligible for this provisioning operation.
  await assert.rejects(db.exec(bootstrap), /refuses initialized application databases/);
  await db.exec('rollback');
 } finally {
  await db.close();
 }
}
// Refuse unexpected definitions and populated Auth; leave failed transactions clean.
for (const scenario of ['wrong-helper', 'auth-users', 'later-history', 'wrong-trigger']) {
 const db = new PGlite();
 try {
  await db.exec(fixture('supabase-test-bootstrap.sql'));
  await db.exec(managedDefaults);
  if (scenario === 'wrong-helper') await db.exec("create function public.rls_auto_enable() returns event_trigger language plpgsql as $$begin return; end$$");
  if (scenario === 'auth-users') await db.exec("insert into auth.users(id) values ('11111111-1111-4111-8111-111111111111')");
  if (scenario === 'later-history') await db.exec("insert into supabase_migrations.schema_migrations values ('20260923114822')");
  if (scenario === 'wrong-trigger') {
    await db.exec(bootstrap);
    await db.exec('alter event trigger ensure_rls disable');
  }
  await assert.rejects(db.exec(bootstrap), /Unexpected|refuses/);
  await db.exec('rollback');
 } finally { await db.close(); }
}
console.log('PASS bootstrap guards: Auth data, initialized history, helper drift and trigger drift rejected');

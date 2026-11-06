// Fictional disposable database ONLY, not an installer or provider migration.
// No password/token/credential is generated. The local harness uses Unix trust.
export async function executionRoleFixture(db){
 await db.exec(`create role partner_identity_host_login login nosuperuser nocreatedb nocreaterole noinherit noreplication nobypassrls password null;
  grant partner_canonical_reader to partner_identity_host_login with admin false, inherit false, set true;
  revoke temporary on database postgres from public;
  grant connect on database postgres to partner_identity_host_login;`);
}

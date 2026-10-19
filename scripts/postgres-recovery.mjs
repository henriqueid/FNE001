/** Recupera somente o cluster criado pelo runner e compara conteúdo, RLS, ACLs e restrições. */
import { createHash } from "node:crypto";
import { readFile, realpath, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import postgres from "postgres";
const sha = value => createHash("sha256").update(value).digest("hex");
const identifier = value => '"' + value.replaceAll('"', '""') + '"';
export function assertRecoveryMatches(before, after) {
  const names = Object.keys(before.tables).sort(),
    restoredNames = Object.keys(after.tables).sort();
  if (JSON.stringify(names) !== JSON.stringify(restoredNames))
    throw new Error("Restauração não preservou todas as tabelas do manifesto.");
  for (const name of names) {
    const original = before.tables[name],
      restored = after.tables[name];
    if (original.count !== restored.count || original.sha256 !== restored.sha256)
      throw new Error(`Recuperação divergente em ${name}: contagem ou SHA-256 não coincide.`);
  }
  if (before.securitySha256 !== after.securitySha256)
    throw new Error("Restauração diverge em segurança, RLS, ACLs, restrições ou definições do schema.");
}
export async function databaseRecoverySnapshot(sql) {
  const names = await sql.unsafe(
    "select schemaname,tablename from pg_tables where schemaname in ('private','public','auth') order by schemaname,tablename",
  );
  const tables = {};
  for (const { schemaname, tablename } of names) {
    const rows = await sql.unsafe(
      `select to_jsonb(t)::text as body from ${identifier(schemaname)}.${identifier(tablename)} t order by to_jsonb(t)::text`,
    );
    const digest = createHash("sha256");
    for (const row of rows) digest.update(row.body + "\n");
    tables[`${schemaname}.${tablename}`] = { count: rows.length, sha256: digest.digest("hex") };
  }
  const metadata = {};
  const queries = {
    schemas:
      "select n.nspname,pg_get_userbyid(n.nspowner) owner,coalesce((select jsonb_agg(jsonb_build_object('grantor',pg_get_userbyid(a.grantor),'grantee',case when a.grantee=0 then 'PUBLIC' else pg_get_userbyid(a.grantee) end,'privilege',a.privilege_type,'grantable',a.is_grantable) order by a.grantee,a.grantor,a.privilege_type,a.is_grantable) from aclexplode(coalesce(n.nspacl,acldefault('n',n.nspowner))) a),'[]'::jsonb) privileges from pg_namespace n where n.nspname in ('private','public','auth') order by n.nspname",
    relations:
      "select n.nspname,c.relname,c.relkind,c.relrowsecurity,c.relforcerowsecurity,pg_get_userbyid(c.relowner) owner from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','public','auth') order by 1,2",
    policies:
      "select schemaname,tablename,policyname,permissive,roles,cmd,qual,with_check from pg_policies where schemaname in ('private','public','auth') order by 1,2,3",
    grants:
      "select table_schema,table_name,grantor,grantee,privilege_type,is_grantable from information_schema.table_privileges where table_schema in ('private','public','auth') order by 1,2,3,4,5",
    triggers:
      "select n.nspname,c.relname,t.tgname,pg_get_triggerdef(t.oid) definition from pg_trigger t join pg_class c on c.oid=t.tgrelid join pg_namespace n on n.oid=c.relnamespace where not t.tgisinternal and n.nspname in ('private','public','auth') order by 1,2,3",
    constraints:
      "select n.nspname,c.relname,k.conname,pg_get_constraintdef(k.oid) definition from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace where n.nspname in ('private','public','auth') order by 1,2,3",
    functions:
      "select n.nspname,p.proname,pg_get_function_identity_arguments(p.oid) arguments,pg_get_functiondef(p.oid) definition,p.prosecdef,pg_get_userbyid(p.proowner) owner from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname in ('private','public','auth') and p.prokind in ('f','p') order by 1,2,3",
    indexes:
      "select schemaname,tablename,indexname,indexdef from pg_indexes where schemaname in ('private','public','auth') order by 1,2,3",
    sequences:
      "select * from pg_sequences where schemaname in ('private','public','auth') order by schemaname,sequencename",
  };
  for (const [key, query] of Object.entries(queries)) metadata[key] = await sql.unsafe(query);
  return { tables, securitySha256: sha(JSON.stringify(metadata)) };
}
export async function verifyIsolatedPostgresRecovery({ url, directory, binary }) {
  const sourceUrl = new URL(url),
    temp = await realpath(tmpdir()),
    owned = await realpath(directory);
  if (
    sourceUrl.hostname !== "127.0.0.1" ||
    sourceUrl.port === "5432" ||
    sourceUrl.pathname !== "/postgres" ||
    path.dirname(owned) !== temp ||
    !path.basename(owned).startsWith("strato-isolated-pg-") ||
    !/^\d+/.test(await readFile(path.join(owned, "data", "PG_VERSION"), "utf8"))
  )
    throw new Error("Recuperação permitida somente no cluster temporário próprio do runner.");
  const run = (name, args) => {
    if (!["pg_dump", "createdb", "pg_restore"].includes(name))
      throw new Error("Ferramenta de recuperação não permitida.");
    const result = spawnSync(binary(name), args, {
      windowsHide: true,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60000,
    });
    if (result.error || result.status !== 0)
      throw new Error(`Recuperação ${name}: ${result.error?.message ?? result.stderr?.slice(-1600) ?? "falhou"}`);
  };
  const source = postgres(url, { ssl: false, prepare: false, max: 1, onnotice: () => {} });
  let before;
  try {
    before = await databaseRecoverySnapshot(source);
  } finally {
    await source.end();
  }
  const dump = path.join(owned, "database.backup"),
    restoredUrl = new URL(url);
  restoredUrl.pathname = "/strato_restored";
  run("pg_dump", ["--no-password", "--format=custom", "--file", dump, "--dbname", url]);
  run("createdb", [
    "--no-password",
    "--host",
    "127.0.0.1",
    "--port",
    sourceUrl.port,
    "--username",
    "postgres",
    "--template",
    "template0",
    "strato_restored",
  ]);
  run("pg_restore", ["--no-password", "--exit-on-error", "--single-transaction", "--dbname", restoredUrl.href, dump]);
  const restored = postgres(restoredUrl.href, { ssl: false, prepare: false, max: 1, onnotice: () => {} });
  let after;
  try {
    after = await databaseRecoverySnapshot(restored);
    const permissions = await restored.unsafe(
      "select has_table_privilege('anon','private.finance_states','SELECT') anon_finance,has_table_privilege('authenticated','private.finance_states','SELECT') authenticated_finance,has_table_privilege('anon','private.domain_events','SELECT') anon_events,has_table_privilege('authenticated','private.domain_events','SELECT') authenticated_events",
    );
    if (Object.values(permissions[0]).some(Boolean))
      throw new Error("A base restaurada expõe tabelas privadas a roles públicas.");
  } finally {
    await restored.end();
  }
  await writeFile(path.join(owned, "recovery-before.json"), JSON.stringify(before, null, 2), { mode: 0o600 });
  await writeFile(path.join(owned, "recovery-after.json"), JSON.stringify(after, null, 2), { mode: 0o600 });
  assertRecoveryMatches(before, after);
  const backupSha256 = sha(await readFile(dump));
  const summary = {
    verifiedAt: new Date().toISOString(),
    restoredDatabase: "strato_restored",
    tables: Object.keys(before.tables).length,
    rows: Object.values(before.tables).reduce((total, table) => total + table.count, 0),
    backupSha256,
    securitySha256: before.securitySha256,
    checks: [
      "contagens",
      "SHA-256 de todas as linhas",
      "RLS/ACLs/restrições/triggers/funções/índices/sequências",
      "anon/authenticated sem SELECT em estados financeiros ou eventos",
    ],
    primary: Object.fromEntries(
      Object.entries(before.tables).filter(([name]) =>
        [
          "private.finance_states",
          "private.portfolio_states",
          "private.domain_events",
          "private.finance_journal_entries",
          "private.finance_journal_lines",
        ].includes(name),
      ),
    ),
  };
  await writeFile(path.join(owned, "recovery-evidence.json"), JSON.stringify(summary, null, 2), { mode: 0o600 });
  console.log(
    `Recuperação PostgreSQL verificada: ${summary.tables} tabelas/${summary.rows} linhas, hashes e metadados iguais em outra base do cluster descartável.`,
  );
  return summary;
}

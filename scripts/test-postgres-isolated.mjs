/** Inicializa e encerra um cluster PostgreSQL descartável, sem ler DATABASE_URL nem banco existente. */
import { mkdtemp, readFile, readdir } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import { createServer } from "node:net";
import postgres from "postgres";
import { verifyIsolatedPostgresRecovery } from "./postgres-recovery.mjs";
import { prepareRestoredLogin, verifyRestoredHttp } from "./restored-http-validation.mjs";

const binaryDirectory =
  process.env.STRATO_TEST_PG_BIN ??
  (process.platform === "win32" ? "C:/Program Files/PostgreSQL/18/bin" : "/usr/lib/postgresql/18/bin");
const directory = await mkdtemp(path.join(tmpdir(), "strato-isolated-pg-"));
const data = path.join(directory, "data");
const binary = name => path.join(binaryDirectory, `${name}${process.platform === "win32" ? ".exe" : ""}`);
function command(name, args) {
  const result = spawnSync(binary(name), args, {
    windowsHide: true,
    encoding: "utf8",
    stdio: "ignore",
    timeout: 60000,
  });
  if (result.error || result.status !== 0)
    throw new Error(`${name}: ${result.error?.message ?? result.stderr?.slice(-1500) ?? "falha"}`);
}
const server = createServer();
await new Promise((resolve, reject) => {
  server.once("error", reject);
  server.listen(0, "127.0.0.1", resolve);
});
const port = server.address().port;
await new Promise(resolve => server.close(resolve));
let started = false;
let sql;
try {
  command("initdb", ["-D", data, "-U", "postgres", "-A", "trust", "--no-locale", "-E", "UTF8"]);
  command("pg_ctl", [
    "-D",
    data,
    "-l",
    path.join(directory, "postgres.log"),
    "-o",
    `-p ${port} -h 127.0.0.1`,
    "-w",
    "start",
  ]);
  started = true;
  const url = `postgresql://postgres@127.0.0.1:${port}/postgres`;
  sql = postgres(url, { ssl: false, prepare: false, max: 1, onnotice: () => {} });
  // Apenas compatibilidade estrutural das migrações históricas; não simula serviços gerenciados Supabase.
  await sql.unsafe(`create role anon; create role authenticated; create role service_role; create schema auth;
    create table auth.users(id uuid primary key);
    create function auth.uid() returns uuid language sql as 'select null::uuid';
    create function auth.jwt() returns jsonb language sql as 'select ''{}''::jsonb';
    create function public.rls_auto_enable() returns event_trigger language plpgsql as 'begin end';`);
  const migrations = (await readdir("supabase/migrations")).filter(name => name.endsWith(".sql")).sort();
  for (const name of migrations) {
    try {
      await sql.unsafe(await readFile(path.join("supabase/migrations", name), "utf8"));
    } catch (error) {
      throw new Error(`Migração ${name}: ${error.message}`);
    }
  }
  await sql.end();
  sql = undefined;
  console.log(`PostgreSQL isolado: ${migrations.length} migrações executadas; testes de coordenação iniciados.`);
  const allowedTests = [
    "tests/postgres-financial-integration.test.ts",
    "tests/postgres-banking-return.test.ts",
    "tests/postgres-intelligence-budget.test.ts",
    "tests/postgres-approval-evidence.test.ts",
    "tests/postgres-access-lifecycle.test.ts",
    "tests/postgres-registry-integrity.test.ts",
  ];
  const testFiles = process.env.STRATO_TEST_PG_FILES?.split(",") ?? allowedTests;
  if (!testFiles.length || testFiles.some(file => !allowedTests.includes(file)))
    throw new Error("Arquivo de teste PostgreSQL não permitido.");
  const result = spawnSync(process.execPath, ["node_modules/vitest/vitest.mjs", "run", ...testFiles], {
    stdio: "inherit",
    windowsHide: true,
    env: { ...process.env, STRATO_TEST_DATABASE_URL: url, DATABASE_URL: url, DATABASE_SSL: "disable" },
  });
  if (result.status !== 0) process.exitCode = result.status ?? 1;
  else {
    const documents = spawnSync(
      process.execPath,
      ["node_modules/vitest/vitest.mjs", "run", "tests/documents-backup-restore.test.ts"],
      {
        stdio: "inherit",
        windowsHide: true,
        env: { ...process.env, STRATO_RECOVERY_EVIDENCE_DIR: directory },
      },
    );
    if (documents.status !== 0) process.exitCode = documents.status ?? 1;
    else {
      const credentials = await prepareRestoredLogin(url);
      await verifyIsolatedPostgresRecovery({ url, directory, binary });
      await verifyRestoredHttp({ url, directory, credentials });
    }
  }
} finally {
  if (sql) await sql.end();
  if (started) command("pg_ctl", ["-D", data, "-m", "fast", "-w", "stop"]);
  console.log(`Cluster isolado encerrado. Evidências temporárias: ${directory}`);
}

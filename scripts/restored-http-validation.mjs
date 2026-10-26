/** Login HTTP e acesso autenticado exclusivamente na base restaurada do cluster descartável. */
import { pbkdf2Sync, randomBytes } from "node:crypto";
import { writeFile } from "node:fs/promises";
import path from "node:path";
import { createServer } from "node:net";
import { spawn } from "node:child_process";
import { once } from "node:events";
import postgres from "postgres";

function isolatedUrl(url) {
  const value = new URL(url);
  if (value.hostname !== "127.0.0.1" || !value.port || value.port === "5432" || value.pathname !== "/postgres")
    throw new Error("Validação HTTP requer o cluster local novo do runner.");
  return value;
}
export async function prepareRestoredLogin(url) {
  isolatedUrl(url);
  const sql = postgres(url, { ssl: false, prepare: false, max: 1 });
  const password = `Qa-${randomBytes(24).toString("base64url")}9a`;
  const salt = randomBytes(16);
  const hash = [
    "pbkdf2-sha256",
    "210000",
    salt.toString("base64"),
    pbkdf2Sync(password, salt, 210000, 32, "sha256").toString("base64"),
  ].join("$");
  try {
    const [tenant] =
      await sql`select tenant_id from private.finance_states where jsonb_array_length(payload->'titles') > 0 order by tenant_id limit 1`;
    const [user] =
      await sql`select user_id,email from private.access_users where user_id = 'user-henrique-admin' and status = 'active'`;
    if (!tenant || !user) throw new Error("Fixtures de recuperação/login ausentes.");
    await sql`insert into private.tenant_memberships(tenant_id,user_id,company_scopes) values (${tenant.tenant_id},${user.user_id},'["*"]'::jsonb) on conflict do nothing`;
    await sql`insert into private.access_permissions(tenant_id,user_id,permission)
      select ${tenant.tenant_id},user_id,permission from private.access_permissions where tenant_id='strato-demo' and user_id=${user.user_id} on conflict do nothing`;
    await sql`insert into private.access_credentials(user_id,password_hash,status) values (${user.user_id},${hash},'active')
      on conflict(user_id) do update set password_hash=excluded.password_hash,status='active',failed_attempts=0,locked_until=null`;
    return { tenantId: tenant.tenant_id, userId: user.user_id, identifier: user.email, password };
  } finally {
    await sql.end();
  }
}

export async function verifyRestoredHttp({ url, directory, credentials }) {
  const restoredUrl = isolatedUrl(url);
  restoredUrl.pathname = "/strato_restored";
  const socket = createServer();
  await new Promise((resolve, reject) => {
    socket.once("error", reject);
    socket.listen(0, "127.0.0.1", resolve);
  });
  const port = socket.address().port;
  await new Promise(resolve => socket.close(resolve));
  // Importação direta não lê .env nem usa o inicializador configurado da instalação.
  const child = spawn(
    process.execPath,
    [
      "--input-type=module",
      "-e",
      `import path from 'node:path'; import {startProdServer} from 'vinext/server/prod-server'; await startProdServer({host:'127.0.0.1',port:Number(process.env.STRATO_QA_PORT),outDir:path.resolve('dist')});`,
    ],
    {
      windowsHide: true,
      stdio: ["ignore", "pipe", "pipe"],
      env: {
        ...process.env,
        DATABASE_URL: restoredUrl.href,
        DATABASE_SSL: "disable",
        STRATO_QA_PORT: String(port),
        STRATO_OUTBOX_WORKER_ENABLED: "false",
        OPENAI_API_KEY: "",
        NODE_ENV: "production",
      },
    },
  );
  // Logs não incluem cookies, senha temporária ou corpos de autenticação.
  let exited = false;
  child.on("exit", () => {
    exited = true;
  });
  child.stdout.resume();
  child.stderr.resume();
  const base = `http://127.0.0.1:${port}`;
  const tenantHeaders = { "x-strato-tenant-id": credentials.tenantId };
  const check = (condition, message) => {
    if (!condition) throw new Error(message);
  };
  const request = (route, options = {}) => fetch(base + route, { ...options, signal: AbortSignal.timeout(5000) });
  try {
    let ready = false;
    for (let attempt = 0; attempt < 100 && !ready; attempt++) {
      if (exited) throw new Error("Servidor de recuperação encerrou antes da verificação.");
      try {
        ready = (await request("/api/health")).status === 200;
      } catch {
        /* aguarda abertura do servidor próprio */
      }
      if (!ready) await new Promise(resolve => setTimeout(resolve, 100));
    }
    check(ready, "Servidor restaurado não ficou disponível.");
    check(
      (await request("/api/finance", { headers: tenantHeaders })).status === 401,
      "Financeiro restaurado acessível sem sessão.",
    );
    const login = await request("/api/auth/session", {
      method: "POST",
      headers: { ...tenantHeaders, "content-type": "application/json" },
      body: JSON.stringify({ identifier: credentials.identifier, password: credentials.password }),
    });
    check(login.status === 201, "Login HTTP com credencial restaurada não foi aceito.");
    const cookieHeader = login.headers.get("set-cookie") ?? "";
    check(
      /HttpOnly/i.test(cookieHeader) && /SameSite=Strict/i.test(cookieHeader),
      "Atributos do cookie restaurado inválidos.",
    );
    const headers = { ...tenantHeaders, cookie: cookieHeader.split(";")[0] };
    const session = await request("/api/auth/session", { headers });
    check(
      session.status === 200 && (await session.json()).principal?.id === credentials.userId,
      "Sessão restaurada não resolve a identidade esperada.",
    );
    const finance = await request("/api/finance", { headers });
    const state = await finance.json();
    check(finance.status === 200 && state.finance?.titles?.length > 0, "Leitura financeira restaurada falhou.");
    check((await request("/api/operations", { headers })).status === 200, "Leitura de operações restauradas falhou.");
    check(
      (await request("/api/finance", { headers: { ...headers, "x-strato-tenant-id": "qa-not-a-membership" } }))
        .status === 401,
      "Sessão restaurada atravessou tenant sem vínculo.",
    );
    check(
      (await request("/api/auth/session", { method: "DELETE", headers })).status === 200,
      "Logout restaurado falhou.",
    );
    check(
      (await request("/api/finance", { headers })).status === 401,
      "Sessão revogada continuou acessando Financeiro.",
    );
    const evidence = {
      verifiedAt: new Date().toISOString(),
      restoredDatabase: "strato_restored",
      login: true,
      httpOnlyCookie: true,
      sameSiteStrict: true,
      financialTitlesRead: state.finance.titles.length,
      operationRead: true,
      unauthenticatedDenied: true,
      crossTenantDenied: true,
      logoutRevocation: true,
      server: "production build, loopback HTTP",
      limitations: ["sem TLS", "sem navegador", "sem jornada completa da operação", "sem fornecedores externos"],
    };
    await writeFile(path.join(directory, "restored-http-evidence.json"), JSON.stringify(evidence, null, 2), {
      mode: 0o600,
    });
    console.log("HTTP restaurado verificado: login, cookie, APIs autenticadas, isolamento e logout.");
    if (process.env.STRATO_TEST_BROWSER_HOLD === "1") {
      await writeFile(
        path.join(directory, "browser-fixture.json"),
        JSON.stringify({
          origin: base,
          identifier: credentials.identifier,
          password: credentials.password,
          tenantId: "strato-demo",
        }),
        { mode: 0o600 },
      );
      console.log(`Prévia autenticada descartável: ${base}. Fixture privada em ${directory}/browser-fixture.json`);
      await new Promise(resolve => {
        const finish = () => {
          clearTimeout(timer);
          process.off("SIGTERM", finish);
          process.off("SIGINT", finish);
          resolve();
        };
        const timer = setTimeout(finish, 20 * 60_000);
        process.once("SIGTERM", finish);
        process.once("SIGINT", finish);
      });
    }
    return evidence;
  } finally {
    if (!exited) {
      child.kill();
      await once(child, "exit");
    }
  }
}

import { randomUUID, webcrypto } from "node:crypto";
import postgres from "postgres";

const email = process.env.STRATO_BOOTSTRAP_ADMIN_EMAIL?.trim().toLowerCase();
const password = process.env.STRATO_BOOTSTRAP_ADMIN_PASSWORD ?? "";
const connectionString = process.env.DATABASE_URL?.trim();

if (!connectionString) throw new Error("DATABASE_URL não foi configurada.");
if (!email || !/^\S+@\S+\.\S+$/.test(email)) throw new Error("STRATO_BOOTSTRAP_ADMIN_EMAIL é inválido.");
if (password.length < 10 || !/[a-z]/.test(password) || !/[A-Z]/.test(password) || !/\d/.test(password))
  throw new Error("A senha inicial deve ter 10 caracteres, maiúscula, minúscula e número.");

const bytesToBase64 = bytes => Buffer.from(bytes).toString("base64");
const salt = webcrypto.getRandomValues(new Uint8Array(16));
const key = await webcrypto.subtle.importKey("raw", new TextEncoder().encode(password), "PBKDF2", false, [
  "deriveBits",
]);
const bits = await webcrypto.subtle.deriveBits(
  { name: "PBKDF2", hash: "SHA-256", salt, iterations: 210_000 },
  key,
  256,
);
const passwordHash = ["pbkdf2-sha256", "210000", bytesToBase64(salt), bytesToBase64(new Uint8Array(bits))].join("$");

const sql = postgres(connectionString, {
  max: 1,
  prepare: false,
  ssl: process.env.DATABASE_SSL === "disable" ? false : "require",
});

try {
  const result = await sql.begin(async transaction => {
    const existing = await transaction`select count(*)::integer as total from private.access_credentials`;
    if (existing[0].total > 0)
      throw new Error("O bootstrap foi bloqueado porque já existem credenciais. Use a gestão de usuários do STRATO.");

    const users = await transaction`
      select u.user_id, m.tenant_id
      from private.access_users u
      join private.tenant_memberships m on m.user_id = u.user_id
      where lower(u.email) = ${email}
        and u.status = 'active'
        and u.access_level = 'admin'
        and exists (
          select 1 from private.access_permissions p
          where p.tenant_id = m.tenant_id and p.user_id = u.user_id and p.permission = 'users:manage'
        )
      limit 1`;
    const user = users[0];
    if (!user) throw new Error("Não existe administrador ativo com este e-mail.");

    await transaction`
      insert into private.access_credentials
        (user_id, password_hash, status, failed_attempts, locked_until, created_at, updated_at)
      values (${user.user_id}, ${passwordHash}, 'active', 0, null, now(), now())`;
    await transaction`
      insert into private.access_events
        (event_id, tenant_id, actor_id, subject_user_id, event_type, payload, created_at)
      values (
        ${randomUUID()}, ${user.tenant_id}, ${user.user_id}, ${user.user_id},
        'ADMIN_CREDENTIAL_BOOTSTRAPPED', ${JSON.stringify({ email })}::jsonb, now()
      )`;
    return user;
  });
  console.log(`Credencial inicial criada para ${email} no tenant ${result.tenant_id}.`);
  console.log("Remova STRATO_BOOTSTRAP_ADMIN_PASSWORD do ambiente agora.");
} finally {
  await sql.end();
}

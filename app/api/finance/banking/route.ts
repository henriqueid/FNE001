/** API autenticada de arquivos bancários; nunca transmite ao banco. */
import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import {
  BankingError,
  executeBankingCommand,
  downloadBankingRemittance,
  type BankingCommand,
} from "@/src/server/banking/service";
const json = (body: unknown, status = 200) => Response.json(body, { status, headers: { "cache-control": "no-store" } });
async function access(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) throw new BankingError("Empresa não informada.", 400);
  const db = getDatabase(),
    principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) throw new BankingError("Sessão ausente ou expirada.", 401);
  if (!principal.permissions.includes("finance:release"))
    throw new BankingError("Sem permissão para arquivos bancários.", 403);
  return { db, principal };
}
function failure(error: unknown) {
  if (error instanceof BankingError) return json({ error: error.message }, error.status);
  if (error instanceof Error && error.message.startsWith("CNAB400:")) return json({ error: error.message }, 400);
  console.error("banking_command_failed");
  return json(
    { error: "Não foi possível concluir o comando bancário. Atualize os dados e tente novamente com a mesma chave." },
    500,
  );
}
export async function POST(request: Request) {
  try {
    const { db, principal } = await access(request);
    const reader = request.body?.getReader();
    if (!reader) throw new BankingError("Comando vazio.", 400);
    const chunks: Uint8Array[] = [];
    let length = 0;
    while (true) {
      const next = await reader.read();
      if (next.done) break;
      length += next.value.length;
      if (length > 8_500_000) {
        await reader.cancel();
        throw new BankingError("Arquivo excede o limite permitido.", 413);
      }
      chunks.push(next.value);
    }
    const bytes = new Uint8Array(length);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.length;
    }
    let command: BankingCommand;
    try {
      command = JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)) as BankingCommand;
    } catch {
      throw new BankingError("Comando bancário inválido.", 400);
    }
    return json({ result: await executeBankingCommand(db, principal, command) });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const { db, principal } = await access(request),
      url = new URL(request.url),
      accountId = url.searchParams.get("accountId"),
      commandId = url.searchParams.get("commandId");
    if (!accountId || !commandId) throw new BankingError("Informe conta e comando da remessa.", 400);
    return json({ result: await downloadBankingRemittance(db, principal, accountId, commandId) });
  } catch (error) {
    return failure(error);
  }
}

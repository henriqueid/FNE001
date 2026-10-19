/** Cliente dos comandos bancários autenticados; reenvio mantém a mesma chave de idempotência. */
import { getStratoTenantId } from "./tenant";
import type { BankingCommand, BankingResult } from "@/src/server/banking/service";
async function body(response: Response) {
  const payload = (await response.json()) as { result?: BankingResult; error?: string };
  if (!response.ok || !payload.result) throw new Error(payload.error ?? "Falha ao acessar arquivos bancários.");
  return payload.result;
}
export async function submitBankingCommand(command: BankingCommand) {
  const send = () =>
    fetch("/api/finance/banking", {
      method: "POST",
      headers: { "x-strato-tenant-id": getStratoTenantId(), "content-type": "application/json" },
      body: JSON.stringify(command),
    });
  let response: Response;
  try {
    response = await send();
  } catch {
    response = await send();
  }
  return body(response);
}
export async function recoverBankingRemittance(accountId: string, commandId: string) {
  return body(
    await fetch(`/api/finance/banking?${new URLSearchParams({ accountId, commandId })}`, {
      cache: "no-store",
      headers: { "x-strato-tenant-id": getStratoTenantId() },
    }),
  );
}
export function downloadBankingFile(result: BankingResult) {
  if (!result.content || !result.filename) throw new Error("A remessa não contém arquivo para baixar.");
  const bytes = Uint8Array.from(result.content, character => character.charCodeAt(0));
  const url = URL.createObjectURL(new Blob([bytes], { type: "application/octet-stream" })),
    anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = result.filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

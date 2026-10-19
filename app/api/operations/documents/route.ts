/** API autenticada de documentos privados, com autoridade da operação persistida. */
import { sessionPrincipal } from "@/src/server/access/session";
import { operationCompany, principalHasCompanyScope } from "@/src/server/access/scope";
import { getDatabase } from "@/src/server/database/postgres";
import {
  DocumentError,
  MAX_DOCUMENT_BYTES,
  readDocument,
  storeDocument,
  type DocumentAccess,
} from "@/src/server/documents/storage";

async function context(request: Request, write: boolean): Promise<DocumentAccess> {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) throw new DocumentError("Empresa não informada.");
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) throw new DocumentError("Sessão ausente ou expirada.", 401);
  const canWrite = principal.permissions.includes("controlleria:formalize");
  const canRead = canWrite || principal.permissions.includes("operations:view");
  if (!(write ? canWrite : canRead)) throw new DocumentError("Sem permissão para acessar documentos.", 403);
  const operationId = new URL(request.url).searchParams.get("operationId") ?? "";
  if (!operationId || operationId.length > 150 || [...operationId].some(char => char.charCodeAt(0) < 32))
    throw new DocumentError("Operação inválida.");
  const company = await operationCompany(db, principal.tenantId, operationId);
  if (!company || !principalHasCompanyScope(principal, company))
    throw new DocumentError("Operação não encontrada.", 404);
  return { tenantId: principal.tenantId, operationId, company, actorId: principal.id, canRead, canWrite };
}
function failure(error: unknown) {
  return Response.json(
    { error: error instanceof DocumentError ? error.message : "Não foi possível acessar o documento privado." },
    { status: error instanceof DocumentError ? error.status : 500, headers: { "cache-control": "no-store" } },
  );
}
export async function POST(request: Request) {
  try {
    const access = await context(request, true);
    const length = Number(request.headers.get("content-length"));
    if (length > MAX_DOCUMENT_BYTES) throw new DocumentError("O arquivo excede 10 MB.", 413);
    const reader = request.body?.getReader();
    if (!reader) throw new DocumentError("Selecione um arquivo.");
    const chunks: Uint8Array[] = [];
    let size = 0;
    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        size += value.byteLength;
        if (size > MAX_DOCUMENT_BYTES) {
          await reader.cancel();
          throw new DocumentError("O arquivo excede 10 MB.", 413);
        }
        chunks.push(value);
      }
    } finally {
      reader.releaseLock();
    }
    let name: string;
    try {
      name = decodeURIComponent(request.headers.get("x-file-name") ?? "");
    } catch {
      throw new DocumentError("Nome de arquivo inválido.");
    }
    const bytes = Buffer.concat(chunks);
    const document = await storeDocument(access, { name, mime: request.headers.get("content-type") ?? "", bytes });
    return Response.json({ document }, { status: 201, headers: { "cache-control": "no-store" } });
  } catch (error) {
    return failure(error);
  }
}
export async function GET(request: Request) {
  try {
    const access = await context(request, false);
    const id = new URL(request.url).searchParams.get("id") ?? "";
    const { document, bytes } = await readDocument(access, id);
    return new Response(bytes as BodyInit, {
      headers: {
        "content-type": document.mime,
        "content-length": String(document.size),
        "content-disposition": `attachment; filename="documento"; filename*=UTF-8''${encodeURIComponent(document.name).replace(/'/g, "%27")}`,
        "cache-control": "private, no-store",
        "x-content-type-options": "nosniff",
        "content-security-policy": "sandbox",
      },
    });
  } catch (error) {
    return failure(error);
  }
}

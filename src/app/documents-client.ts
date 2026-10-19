/** Upload e recuperação de anexos com a sessão interna do STRATO. */
import { getStratoTenantId } from "./tenant";
export type UploadedDocument = { id: string; name: string; mime: string; size: number; sha256: string };
const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });
export async function uploadOperationDocument(operationId: string, file: File): Promise<UploadedDocument> {
  const response = await fetch(`/api/operations/documents?${new URLSearchParams({ operationId })}`, {
    method: "POST",
    headers: { ...headers(), "content-type": file.type, "x-file-name": encodeURIComponent(file.name) },
    body: file,
  });
  const body = (await response.json()) as { document?: UploadedDocument; error?: string };
  if (!response.ok || !body.document) throw new Error(body.error ?? "Não foi possível preservar o anexo.");
  return body.document;
}
export async function downloadOperationDocument(operationId: string, documentId: string) {
  const response = await fetch(`/api/operations/documents?${new URLSearchParams({ operationId, id: documentId })}`, {
    headers: headers(),
    cache: "no-store",
  });
  if (!response.ok)
    throw new Error("Não foi possível recuperar o anexo. Verifique sua permissão e a integridade do arquivo.");
  return response.blob();
}

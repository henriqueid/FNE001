/** Confere anexos de assinatura contra arquivos privados antes da formalização. */
import type { Operation } from "@/src/domain/core/types";
import { readDocument, DOCUMENT_ID_PATTERN } from "@/src/server/documents/storage";
import { OperationGovernanceError } from "./governance";

export async function assertFormalizationDocuments(operation: Operation, tenantId: string, actorId: string) {
  if (operation.stage < 6) return;
  const signatures = operation.approvalReview?.signatures ?? [];
  if (!signatures.length || signatures.some(signature => signature.status !== "Assinado"))
    throw new OperationGovernanceError("Formalização exige todas as assinaturas concluídas com evidência verificável.");
  for (const signature of signatures) {
    if (
      !signature.attachmentId ||
      !DOCUMENT_ID_PATTERN.test(signature.attachmentId) ||
      !signature.attachmentHash ||
      !/^[a-f0-9]{64}$/.test(signature.attachmentHash)
    )
      throw new OperationGovernanceError("A assinatura exige anexo privado e hash válido.");
    try {
      const { document } = await readDocument(
        { tenantId, operationId: operation.id, company: operation.vehicle, actorId, canRead: true, canWrite: false },
        signature.attachmentId,
      );
      if (
        document.sha256 !== signature.attachmentHash ||
        document.mime !== signature.attachmentMime ||
        document.size !== signature.attachmentSize ||
        document.name !== signature.attachmentName
      )
        throw new Error("attachment_mismatch");
    } catch {
      throw new OperationGovernanceError("O anexo da assinatura não corresponde ao arquivo privado desta operação.");
    }
  }
}

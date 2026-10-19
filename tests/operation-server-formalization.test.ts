/** O avanço exige anexo persistido da operação, com integridade e metadados conferidos. */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { assertFormalizationDocuments } from "@/src/server/operations/formalization-documents";
const { read } = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock("@/src/server/documents/storage", () => ({
  DOCUMENT_ID_PATTERN: /^doc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/,
  readDocument: read,
}));
const signature = {
  id: "signature-1",
  party: "Cedente",
  signer: "Responsável",
  status: "Assinado" as const,
  attachmentId: "doc_a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
  attachmentHash: "a".repeat(64),
  attachmentMime: "application/pdf",
  attachmentSize: 100,
  attachmentName: "cessao.pdf",
};
const operation = {
  ...initialOperations[0],
  stage: 6,
  approvalReview: { status: "Em formalização" as const, signatures: [signature] },
};
beforeEach(() => {
  read.mockReset();
  read.mockResolvedValue({
    document: {
      sha256: signature.attachmentHash,
      mime: signature.attachmentMime,
      size: signature.attachmentSize,
      name: signature.attachmentName,
    },
  });
});
describe("documentos da formalização", () => {
  it("confere anexo usando o tenant, operação e empresa autorizados", async () => {
    await expect(assertFormalizationDocuments(operation, "tenant-1", "checker")).resolves.toBeUndefined();
    expect(read).toHaveBeenCalledWith(
      {
        tenantId: "tenant-1",
        operationId: operation.id,
        company: operation.vehicle,
        actorId: "checker",
        canRead: true,
        canWrite: false,
      },
      signature.attachmentId,
    );
  });
  it("rejeita apenas nome local, conteúdo divergente e arquivo inacessível", async () => {
    await expect(
      assertFormalizationDocuments(
        {
          ...operation,
          approvalReview: { ...operation.approvalReview, signatures: [{ ...signature, attachmentId: undefined }] },
        },
        "tenant-1",
        "checker",
      ),
    ).rejects.toThrow("anexo privado");
    read.mockResolvedValue({ document: { sha256: "b".repeat(64) } });
    await expect(assertFormalizationDocuments(operation, "tenant-1", "checker")).rejects.toThrow("não corresponde");
    read.mockRejectedValue(new Error("outro tenant"));
    await expect(assertFormalizationDocuments(operation, "tenant-1", "checker")).rejects.toThrow("não corresponde");
  });
});

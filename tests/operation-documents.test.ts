/** Armazenamento real em diretório temporário, sem banco nem rede. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { mkdtemp, readdir, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createHash } from "node:crypto";
import { MAX_DOCUMENT_BYTES, readDocument, storeDocument, type DocumentAccess } from "@/src/server/documents/storage";
let root: string;
const access: DocumentAccess = {
  tenantId: "tenant-a",
  operationId: "OP-1",
  company: "Empresa A",
  actorId: "user-a",
  canRead: true,
  canWrite: true,
};
const bytes = new TextEncoder().encode("%PDF-1.7\ncontrato assinado\n%%EOF");
const input = { name: "Contrato.pdf", mime: "application/pdf", bytes };
beforeEach(async () => {
  root = await mkdtemp(join(tmpdir(), "strato-doc-test-"));
});
afterEach(async () => {
  if (root.startsWith(join(tmpdir(), "strato-doc-test-"))) await rm(root, { recursive: true, force: true });
});
describe("documentos privados", () => {
  it("preserva bytes, hash e proveniência com ID opaco", async () => {
    const saved = await storeDocument(access, input, root);
    expect(saved.id).toMatch(/^doc_[0-9a-f-]{36}$/);
    expect(saved).toMatchObject({
      name: input.name,
      mime: input.mime,
      size: bytes.length,
      tenantId: "tenant-a",
      operationId: "OP-1",
      company: "Empresa A",
      createdBy: "user-a",
      sha256: createHash("sha256").update(bytes).digest("hex"),
    });
    expect((await readDocument(access, saved.id, root)).bytes).toEqual(bytes);
    const second = await storeDocument(access, { ...input, bytes: new TextEncoder().encode("%PDF-1.7\noutro") }, root);
    expect(second.id).not.toBe(saved.id);
    expect((await readDocument(access, saved.id, root)).bytes).toEqual(bytes);
  });
  it.each([{ tenantId: "tenant-b" }, { operationId: "OP-2" }, { company: "Empresa B" }, { canRead: false }])(
    "nega acesso fora da autoridade %s",
    async change => {
      const saved = await storeDocument(access, input, root);
      await expect(readDocument({ ...access, ...change }, saved.id, root)).rejects.toThrow();
    },
  );
  it("não grava sem permissão", async () => {
    await expect(storeDocument({ ...access, canWrite: false }, input, root)).rejects.toThrow();
    expect(await readdir(root)).toHaveLength(0);
  });
  it.each(["../segredo", "doc_../../segredo", "C:\\segredo"])("nega travessia %s", async id => {
    await expect(readDocument(access, id, root)).rejects.toThrow();
  });
  it.each([
    { name: "../Contrato.pdf" },
    { mime: "text/html" },
    { bytes: new TextEncoder().encode("<script>evil</script>") },
    { bytes: new Uint8Array(MAX_DOCUMENT_BYTES + 1) },
    { bytes: new Uint8Array() },
  ])("rejeita entrada inválida", async change => {
    await expect(storeDocument(access, { ...input, ...change }, root)).rejects.toThrow();
    expect(await readdir(root)).toHaveLength(0);
  });
  it("detecta ausência e corrupção", async () => {
    const saved = await storeDocument(access, input, root);
    await writeFile(join(root, saved.id, "content"), "alterado");
    await expect(readDocument(access, saved.id, root)).rejects.toThrow();
    await rm(join(root, saved.id, "content"));
    await expect(readDocument(access, saved.id, root)).rejects.toThrow();
    expect(JSON.parse(await readFile(join(root, saved.id, "manifest.json"), "utf8")).sha256).toBe(saved.sha256);
  });
});

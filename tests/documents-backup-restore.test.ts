/** Recuperação real de bytes e manifestos em volume temporário, sem banco ou serviços remotos. */
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { createHash } from "node:crypto";
import { cp, mkdtemp, readFile, readdir, realpath, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { basename, dirname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { readDocument, storeDocument, type DocumentAccess } from "@/src/server/documents/storage";
let root: string, evidenceDirectory: string | undefined;
const authority: DocumentAccess = {
  tenantId: "restore-tenant",
  operationId: "restore-operation",
  company: "Empresa de teste",
  actorId: "restore-user",
  canRead: true,
  canWrite: true,
};
const bytes = new TextEncoder().encode("%PDF-1.7\nfixture local de contrato\n%%EOF");
const input = { name: "Contrato recuperado.pdf", mime: "application/pdf", bytes };
const digest = (value: Uint8Array | string) => createHash("sha256").update(value).digest("hex");
function owned(target: string) {
  const absolute = resolve(target),
    rel = relative(root, absolute);
  if (
    !isAbsolute(root) ||
    !basename(root).startsWith("strato-doc-restore-") ||
    !rel ||
    rel === ".." ||
    rel.startsWith(`..${sep}`) ||
    isAbsolute(rel)
  )
    throw new Error("Alvo fora do volume temporário próprio.");
  return absolute;
}
async function snapshot(directory: string) {
  const files: Record<string, { bytes: number; sha256: string; mode: number }> = {};
  for (const entry of (await readdir(directory, { withFileTypes: true })).sort((a, b) =>
    a.name.localeCompare(b.name),
  )) {
    if (!entry.isDirectory() || entry.isSymbolicLink()) throw new Error("Snapshot contém diretório inesperado.");
    for (const name of (await readdir(join(directory, entry.name))).sort()) {
      if (!["content", "manifest.json"].includes(name)) throw new Error("Snapshot contém arquivo inesperado.");
      const path = join(directory, entry.name, name),
        content = await readFile(path),
        meta = await stat(path);
      files[`${entry.name}/${name}`] = { bytes: content.length, sha256: digest(content), mode: meta.mode & 0o777 };
    }
  }
  return files;
}
beforeEach(async () => {
  evidenceDirectory = process.env.STRATO_RECOVERY_EVIDENCE_DIR;
  if (evidenceDirectory) {
    const actual = await realpath(evidenceDirectory),
      temp = await realpath(tmpdir());
    if (dirname(actual) !== temp || !basename(actual).startsWith("strato-isolated-pg-"))
      throw new Error("Diretório de evidência não pertence ao runner isolado.");
    evidenceDirectory = actual;
  }
  root = await mkdtemp(join(evidenceDirectory ?? (await realpath(tmpdir())), "strato-doc-restore-"));
});
afterEach(async () => {
  if (!evidenceDirectory && root) {
    const canonical = await realpath(root),
      temp = await realpath(tmpdir());
    if (dirname(canonical) !== temp || !basename(canonical).startsWith("strato-doc-restore-"))
      throw new Error("Limpeza fora do temporário próprio recusada.");
    await rm(canonical, { recursive: true, force: false });
  }
});
describe("backup e restauração do volume de documentos", () => {
  it("restaura IDs, bytes, manifestos e autoridade após perda do volume original", async () => {
    const source = owned(join(root, "source")),
      backup = owned(join(root, "backup")),
      restored = owned(join(root, "restored"));
    const first = await storeDocument(authority, input, source),
      second = await storeDocument(
        authority,
        { ...input, name: "Outro contrato.pdf", bytes: new TextEncoder().encode("%PDF-1.7\nsegunda fixture\n%%EOF") },
        source,
      );
    const before = await snapshot(source);
    expect(Object.keys(before)).toHaveLength(4);
    await cp(source, backup, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
    expect(await snapshot(backup)).toEqual(before);
    await writeFile(owned(join(root, "snapshot-manifest.json")), JSON.stringify(before, null, 2), { mode: 0o600 });
    // A exclusão se limita ao subdiretório criado por esta fixture, após conferir o caminho absoluto.
    await rm(owned(source), { recursive: true, force: false });
    await expect(readDocument(authority, first.id, source)).rejects.toThrow();
    await cp(backup, restored, { recursive: true, preserveTimestamps: true, errorOnExist: true, force: false });
    const after = await snapshot(restored);
    expect(after).toEqual(before);
    const recovered = await readDocument(authority, first.id, restored);
    expect(recovered.document).toEqual(first);
    expect(recovered.bytes).toEqual(bytes);
    expect(digest(recovered.bytes)).toBe(first.sha256);
    expect((await readDocument(authority, second.id, restored)).document).toEqual(second);
    for (const change of [
      { tenantId: "other-tenant" },
      { operationId: "other-operation" },
      { company: "Outra empresa" },
      { canRead: false },
    ])
      await expect(readDocument({ ...authority, ...change }, first.id, restored)).rejects.toThrow();
    await expect(storeDocument({ ...authority, canWrite: false }, input, restored)).rejects.toThrow();
    expect(await snapshot(restored)).toEqual(before);
    if (process.platform !== "win32") {
      expect((await stat(restored)).mode & 0o077).toBe(0);
      for (const file of Object.keys(after))
        expect((await stat(join(restored, ...file.split("/")))).mode & 0o077).toBe(0);
    }
    const summary = {
      verifiedAt: new Date().toISOString(),
      documents: 2,
      files: 4,
      manifestSha256: digest(JSON.stringify(before)),
      checks: [
        "IDs e manifestos preservados",
        "bytes/SHA-256 iguais",
        "tenant/operação/empresa divergentes negados",
        "sem permissão de leitura/escrita negado",
      ],
      filesystemPermissions:
        process.platform === "win32"
          ? "ACL Windows não homologada; autorização da API verificada"
          : "modos POSIX privados verificados",
    };
    await writeFile(owned(join(root, "document-recovery-evidence.json")), JSON.stringify(summary, null, 2), {
      mode: 0o600,
    });
    if (evidenceDirectory)
      await writeFile(
        join(evidenceDirectory, "document-recovery-evidence.json"),
        JSON.stringify({ ...summary, fixtureDirectory: root }, null, 2),
        { mode: 0o600 },
      );
  });
  it("recusa bytes ou manifesto adulterados depois da restauração", async () => {
    const source = owned(join(root, "source")),
      restored = owned(join(root, "restored")),
      saved = await storeDocument(authority, input, source);
    await cp(source, restored, { recursive: true, errorOnExist: true, force: false });
    await writeFile(owned(join(restored, saved.id, "content")), new TextEncoder().encode("%PDF-1.7\nconteúdo trocado"));
    await expect(readDocument(authority, saved.id, restored)).rejects.toThrow();
    await writeFile(owned(join(restored, saved.id, "content")), bytes);
    const manifest = JSON.parse(await readFile(join(restored, saved.id, "manifest.json"), "utf8"));
    manifest.tenantId = "other-tenant";
    await writeFile(owned(join(restored, saved.id, "manifest.json")), JSON.stringify(manifest));
    await expect(readDocument(authority, saved.id, restored)).rejects.toThrow();
  });
});

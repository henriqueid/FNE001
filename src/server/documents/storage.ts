/** Arquivos privados de formalização, imutáveis e vinculados à operação. */
import { createHash, randomUUID } from "node:crypto";
import { mkdir, open, readFile, realpath, lstat, rename } from "node:fs/promises";
import { homedir } from "node:os";
import { isAbsolute, join, relative, resolve, sep } from "node:path";

/** Valores de autoridade derivados da sessão e da operação persistida pelo servidor. */
export type DocumentAccess = {
  tenantId: string;
  operationId: string;
  company: string;
  actorId: string;
  canRead: boolean;
  canWrite: boolean;
};
export type StoredDocument = {
  id: string;
  name: string;
  mime: string;
  size: number;
  sha256: string;
  tenantId: string;
  operationId: string;
  company: string;
  createdBy: string;
  createdAt: string;
};
export const MAX_DOCUMENT_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ID_PATTERN = /^doc_[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
export class DocumentError extends Error {
  constructor(
    message: string,
    public status = 400,
  ) {
    super(message);
  }
}
const hash = (bytes: Uint8Array) => createHash("sha256").update(bytes).digest("hex");
const notFound = () => new DocumentError("Documento não encontrado ou indisponível.", 404);

function authorize(access: DocumentAccess, write = false) {
  if (
    !(write ? access.canWrite : access.canRead) ||
    !access.tenantId ||
    !access.operationId ||
    !access.company ||
    !access.actorId
  )
    throw new DocumentError("Sem permissão para acessar documentos desta operação.", 403);
}
function validName(name: string) {
  return (
    name.length > 0 &&
    name.length <= 180 &&
    !/[\\/]/.test(name) &&
    ![...name].some(char => char.charCodeAt(0) < 32 || char.charCodeAt(0) === 127) &&
    name !== "." &&
    name !== ".."
  );
}
function validateInput(input: { name: string; mime: string; bytes: Uint8Array }) {
  if (!validName(input.name)) throw new DocumentError("Nome de arquivo inválido.");
  if (!input.bytes.length || input.bytes.length > MAX_DOCUMENT_BYTES)
    throw new DocumentError("O arquivo deve ter até 10 MB e não pode estar vazio.", 413);
  const bytes = input.bytes;
  const detected =
    Buffer.from(bytes.subarray(0, 5)).toString("ascii") === "%PDF-"
      ? "application/pdf"
      : bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
        ? "image/jpeg"
        : Buffer.from(bytes.subarray(0, 8)).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
          ? "image/png"
          : null;
  if (!detected || input.mime !== detected)
    throw new DocumentError("Formato inválido. Envie PDF, JPEG ou PNG com o tipo correto.");
}
function inside(parent: string, child: string) {
  const rel = relative(parent, child);
  return rel === "" || (!rel.startsWith(`..${sep}`) && rel !== ".." && !isAbsolute(rel));
}
export function documentsDirectory() {
  return process.env.STRATO_DOCUMENTS_DIR || join(homedir(), ".strato", "documents");
}
async function privateRoot(requested: string, create: boolean) {
  if (!isAbsolute(requested)) throw new DocumentError("O diretório privado de documentos deve ser absoluto.", 503);
  const root = resolve(requested);
  if (inside(resolve(process.cwd(), "public"), root))
    throw new DocumentError("Documentos não podem ser armazenados no diretório público.", 503);
  if (create) await mkdir(root, { recursive: true, mode: 0o700 });
  const canonical = await realpath(root);
  if (inside(resolve(process.cwd(), "public"), canonical)) throw new DocumentError("Diretório privado inválido.", 503);
  return canonical;
}
async function writeOnce(path: string, bytes: Uint8Array | string) {
  const handle = await open(path, "wx", 0o600);
  try {
    await handle.writeFile(bytes);
    await handle.sync();
  } finally {
    await handle.close();
  }
}
export async function storeDocument(
  access: DocumentAccess,
  input: { name: string; mime: string; bytes: Uint8Array },
  requestedRoot = documentsDirectory(),
): Promise<StoredDocument> {
  authorize(access, true);
  validateInput(input);
  const root = await privateRoot(requestedRoot, true);
  const id = `doc_${randomUUID()}`;
  const directory = join(root, id);
  await mkdir(directory, { mode: 0o700 });
  const document: StoredDocument = {
    id,
    name: input.name,
    mime: input.mime,
    size: input.bytes.length,
    sha256: hash(input.bytes),
    tenantId: access.tenantId,
    operationId: access.operationId,
    company: access.company,
    createdBy: access.actorId,
    createdAt: new Date().toISOString(),
  };
  // O manifesto é o marcador de publicação: uma falha anterior deixa somente um diretório incompleto e inacessível.
  await writeOnce(join(directory, "content"), input.bytes);
  await writeOnce(join(directory, "manifest.pending"), JSON.stringify(document));
  await rename(join(directory, "manifest.pending"), join(directory, "manifest.json"));
  return document;
}
export async function readDocument(
  access: DocumentAccess,
  id: string,
  requestedRoot = documentsDirectory(),
): Promise<{ document: StoredDocument; bytes: Uint8Array }> {
  authorize(access);
  if (!DOCUMENT_ID_PATTERN.test(id)) throw notFound();
  try {
    const root = await privateRoot(requestedRoot, false);
    const directory = join(root, id);
    if ((await lstat(directory)).isSymbolicLink()) throw notFound();
    for (const name of ["content", "manifest.json"]) {
      const stat = await lstat(join(directory, name));
      if (!stat.isFile() || stat.isSymbolicLink() || stat.size > (name === "content" ? MAX_DOCUMENT_BYTES : 8192))
        throw notFound();
    }
    const manifest = await readFile(join(directory, "manifest.json"), "utf8");
    if (manifest.length > 8192) throw notFound();
    const document = JSON.parse(manifest) as StoredDocument;
    if (
      document.id !== id ||
      document.tenantId !== access.tenantId ||
      document.operationId !== access.operationId ||
      document.company !== access.company ||
      !validName(document.name) ||
      !Number.isInteger(document.size) ||
      document.size < 1 ||
      document.size > MAX_DOCUMENT_BYTES
    )
      throw notFound();
    const bytes = await readFile(join(directory, "content"));
    if (bytes.length !== document.size || hash(bytes) !== document.sha256) throw notFound();
    validateInput({ ...document, bytes });
    return { document, bytes: new Uint8Array(bytes) };
  } catch (error) {
    if (error instanceof DocumentError && error.status === 503) throw error;
    throw notFound();
  }
}

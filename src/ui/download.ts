/**
 * Baixa um arquivo gerado na tela.
 *
 * Num navegador comum usa um link temporário. Quando o protótipo roda como
 * página publicada no claude.ai, o link direto é bloqueado; nesse caso o
 * arquivo é entregue pela capacidade `downloads` da página, que pede a
 * confirmação do usuário antes de salvar.
 */
type DownloadsApi = { save: (request: { filename: string; data: Blob | string }) => Promise<unknown> };
type ClaudeHost = { use: (name: string) => Promise<unknown> };

let hostDownloads: Promise<DownloadsApi | null> | null = null;

function downloadsFromHost(): Promise<DownloadsApi | null> {
  if (hostDownloads) return hostDownloads;
  const host = typeof window !== "undefined" ? (window as unknown as { claude?: ClaudeHost }).claude : undefined;
  hostDownloads = host?.use
    ? host
        .use("downloads")
        .then(api => (api as DownloadsApi | null) ?? null)
        .catch(() => null)
    : Promise.resolve(null);
  return hostDownloads;
}

// Resolve cedo para que o clique não espere a página publicada responder.
if (typeof window !== "undefined") void downloadsFromHost();

function downloadWithLink(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export async function saveFile(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob([content], { type: mime });
  const api = await downloadsFromHost();
  if (!api) {
    downloadWithLink(filename, blob);
    return;
  }
  try {
    await api.save({ filename, data: blob });
  } catch (error) {
    // O usuário recusou ou já existe uma confirmação aberta: nada a fazer.
    const code = (error as { code?: string } | null)?.code;
    if (code === "declined" || code === "rate_limited") return;
    downloadWithLink(filename, blob);
  }
}

/** Falhas HTTP, conteúdo inválido e transporte produzem mensagem legível, sem JSON/HTML bruto. */
import { afterEach, expect, it, vi } from "vitest";
import { syncPublishedNotifications, retryFailedNotifications } from "@/src/app/notification-client";
afterEach(() => vi.unstubAllGlobals());
it.each([
  new Response("<html>Proxy indisponível</html>", { status: 502 }),
  Response.json({ error: { code: "INVALID", details: "detalhes internos" } }, { status: 500 }),
  Response.json({ error: '{"code":"INTERNAL","stack":"trace"}' }, { status: 500 }),
  new Response("não é JSON", { status: 500 }),
])("falha ao processar outbox mostra mensagem sem payload cru", async response => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => response.clone()),
  );
  await expect(syncPublishedNotifications("CHURUME")).rejects.toThrow(
    "Não foi possível processar as notificações pendentes.",
  );
});
it("preserva mensagem humana de autorização recebida da API", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => Response.json({ error: "Sessão expirada. Entre novamente." }, { status: 401 })),
  );
  await expect(syncPublishedNotifications("CHURUME")).rejects.toThrow("Sessão expirada. Entre novamente.");
});
it("JSON inválido depois de processar não vaza erro de parser", async () => {
  const responses = [Response.json({}), new Response("<html>erro</html>", { status: 502 })];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => responses.shift()!),
  );
  await expect(syncPublishedNotifications("CHURUME")).rejects.toThrow(
    "Não foi possível atualizar a Central de Notificações.",
  );
});
it("reprocessamento com resposta inválida não vaza HTML/JSON", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => new Response("<html>erro</html>", { status: 502 })),
  );
  await expect(retryFailedNotifications("CHURUME")).rejects.toThrow("Não foi possível reprocessar a fila de falhas.");
});
it("transporte indisponível recebe mensagem legível", async () => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => {
      throw new TypeError("Failed to fetch");
    }),
  );
  await expect(syncPublishedNotifications("CHURUME")).rejects.toThrow(
    "Não foi possível conectar à Central de Notificações.",
  );
});
it("consulta e reprocessamento válidos preservam resultados", async () => {
  const responses = [
    Response.json({}),
    Response.json({ notifications: [], health: { pending: 1, failed: 0, published: 2 } }),
    Response.json({ health: { pending: 0, failed: 0, published: 3 } }),
  ];
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => responses.shift()!),
  );
  expect(await syncPublishedNotifications("CHURUME")).toEqual({
    notifications: [],
    health: { pending: 1, failed: 0, published: 2 },
  });
  expect(await retryFailedNotifications("CHURUME")).toEqual({ pending: 0, failed: 0, published: 3 });
});

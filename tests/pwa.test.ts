/** Executa o worker real em sandbox local; verifica política de cache sem browser/rede. */
import { describe, expect, it, vi } from "vitest";
import { readFile } from "node:fs/promises";
import { runInNewContext } from "node:vm";
import { resolve } from "node:path";
type WorkerEvent = {
  request?: { url: string; method: string; mode: string };
  waitUntil?: (promise: Promise<unknown>) => void;
  respondWith?: (promise: Promise<Response>) => void;
};
async function worker(online = true) {
  const events = new Map<string, (event: WorkerEvent) => void>();
  const add = vi.fn(async (_path: string) => {}),
    put = vi.fn(async (_path: string) => {}),
    match = vi.fn(
      async (_path: string) => new Response("STRATO sem conexão", { headers: { "content-type": "text/html" } }),
    );
  const remove = vi.fn(async (_key: string) => true),
    fetch = vi.fn(async () => {
      if (!online) throw new Error("offline");
      return new Response("dados financeiros da sessão");
    });
  const cache = { add, put, match };
  const source = await readFile(resolve("public/sw.js"), "utf8");
  runInNewContext(source, {
    self: {
      location: { origin: "https://strato.test" },
      addEventListener: (name: string, handler: (event: WorkerEvent) => void) => events.set(name, handler),
      skipWaiting: async () => {},
      clients: { claim: async () => {} },
    },
    caches: { open: async () => cache, keys: async () => ["strato-offline-v0", "unrelated"], delete: remove, match },
    fetch,
    URL,
    Request,
    Response,
  });
  return { events, add, put, match, remove, fetch };
}
describe("PWA sem dados operacionais offline", () => {
  it("pré-carrega somente o aviso público de desconexão", async () => {
    const w = await worker();
    let promise: Promise<unknown> | undefined;
    expect(w.events.has("install")).toBe(true);
    w.events.get("install")!({
      waitUntil: p => {
        promise = p;
      },
    });
    await promise;
    expect(w.add.mock.calls.map(call => String(call[0]))).toEqual(["/offline.html"]);
    expect(w.put).not.toHaveBeenCalled();
  });
  it.each(["/api/finance", "/api/operations", "/api/portfolio/settlements", "/api/copilot/chat"])(
    "não intercepta API %s",
    async path => {
      const w = await worker();
      const respondWith = vi.fn();
      expect(w.events.has("fetch")).toBe(true);
      w.events.get("fetch")!({
        request: { url: `https://strato.test${path}`, method: "GET", mode: "cors" },
        respondWith,
      });
      expect(respondWith).not.toHaveBeenCalled();
      expect(w.fetch).not.toHaveBeenCalled();
    },
  );
  it("navegação online vem da rede e não é armazenada", async () => {
    const w = await worker();
    let result: Promise<Response> | undefined;
    w.events.get("fetch")!({
      request: { url: "https://strato.test/", method: "GET", mode: "navigate" },
      respondWith: p => {
        result = p;
      },
    });
    expect(await (await result!).text()).toBe("dados financeiros da sessão");
    expect(w.put).not.toHaveBeenCalled();
    expect(w.add).not.toHaveBeenCalled();
  });
  it("offline devolve só o aviso estático e consulta sua chave exata", async () => {
    const w = await worker(false);
    let result: Promise<Response> | undefined;
    w.events.get("fetch")!({
      request: { url: "https://strato.test/finance?tenant=a", method: "GET", mode: "navigate" },
      respondWith: p => {
        result = p;
      },
    });
    expect(await (await result!).text()).toBe("STRATO sem conexão");
    expect(w.match.mock.calls.map(call => call[0])).toEqual(["/offline.html"]);
    expect(w.put).not.toHaveBeenCalled();
  });
  it("manifesto referencia ícones existentes de instalação e inicia online", async () => {
    const manifest = JSON.parse(await readFile(resolve("public/manifest.webmanifest"), "utf8"));
    expect(manifest.display).toBe("standalone");
    expect(manifest.start_url).toBe("/");
    for (const icon of manifest.icons) {
      const bytes = await readFile(resolve("public", icon.src.slice(1)));
      expect(bytes.length).toBeGreaterThan(0);
      const [width, height] = icon.sizes.split("x").map(Number);
      expect(bytes.readUInt32BE(16)).toBe(width);
      expect(bytes.readUInt32BE(20)).toBe(height);
    }
  });
});
it("não intercepta navegação direta para APIs nem comandos POST", async () => {
  const w = await worker();
  const respondWith = vi.fn();
  for (const request of [
    { url: "https://strato.test/api/finance", method: "GET", mode: "navigate" },
    { url: "https://strato.test/api/operations", method: "POST", mode: "navigate" },
  ])
    w.events.get("fetch")!({ request, respondWith });
  expect(respondWith).not.toHaveBeenCalled();
  expect(w.fetch).not.toHaveBeenCalled();
});
it("ativação remove somente versões anteriores do aviso estático", async () => {
  const w = await worker();
  let pending: Promise<unknown> | undefined;
  w.events.get("activate")!({
    waitUntil: p => {
      pending = p;
    },
  });
  await pending;
  expect(w.remove.mock.calls.map(call => call[0])).toEqual(["strato-offline-v0"]);
});

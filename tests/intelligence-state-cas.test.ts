/** Licença de IA obsoleta nunca pode reativar configuração desligada por outro editor. */
import { afterEach, expect, it, vi } from "vitest";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
import { saveIntelligenceState } from "@/src/server/intelligence/repository";
import { persistIntelligenceState } from "@/src/app/intelligence-client";
import { IntelligenceDatabase } from "./helpers/intelligence-database";
afterEach(() => vi.unstubAllGlobals());
const input = (version: number | undefined) => ({
  ...emptyIntelligenceState("tenant-a"),
  contracted: true,
  enabled: true,
  status: "AI_AVAILABLE" as const,
  monthlyTokenBudget: 100,
  persistenceVersion: version,
});
it("editor antigo recebe conflito e licença desligada conserva flags, contador e versão", async () => {
  const db = new IntelligenceDatabase();
  db.row.used_tokens = 32;
  const original = input(1);
  const off = await saveIntelligenceState(db, "tenant-a", "admin-a", {
    ...original,
    contracted: false,
    enabled: false,
    status: "AI_DISABLED",
  });
  expect(off.persistenceVersion).toBe(2);
  await expect(saveIntelligenceState(db, "tenant-a", "admin-b", original)).rejects.toMatchObject({ status: 409 });
  expect(db.row).toMatchObject({ contracted: false, enabled: false, used_tokens: 32, aggregate_version: 2 });
});
it("CAS permite só um dos dois editores da mesma versão", async () => {
  const db = new IntelligenceDatabase();
  const result = await Promise.allSettled([
    saveIntelligenceState(db, "tenant-a", "admin-a", {
      ...input(1),
      contracted: false,
      enabled: false,
      status: "AI_DISABLED",
    }),
    saveIntelligenceState(db, "tenant-a", "admin-b", input(1)),
  ]);
  expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
  expect(result.filter(item => item.status === "rejected")).toHaveLength(1);
  expect(db.row.enabled).toBe(false);
});
it("versão ausente não sobrescreve linha existente e só inicializa tenant novo", async () => {
  const db = new IntelligenceDatabase();
  await expect(saveIntelligenceState(db, "tenant-a", "admin", input(undefined))).rejects.toMatchObject({ status: 409 });
  db.stateExists = false;
  const saved = await saveIntelligenceState(db, "tenant-a", "admin", input(undefined));
  expect(saved.persistenceVersion).toBe(1);
  expect(saved.enabled).toBe(true);
});
it.each([-1, 1.5, NaN, "1", null])("nega versão malformada %s", async version => {
  const db = new IntelligenceDatabase();
  await expect(saveIntelligenceState(db, "tenant-a", "admin", input(version as number))).rejects.toMatchObject({
    status: 400,
  });
  expect(db.row.aggregate_version).toBe(1);
});
it("cliente conserva versão do snapshot e exibe conflito em vez de reenviar licença", async () => {
  const calls: { method?: string; body: { state: { persistenceVersion: number } } }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      calls.push({ method: options.method, body: JSON.parse(String(options.body)) });
      return Response.json({ error: "Configuração alterada. Recarregue antes de salvar." }, { status: 409 });
    }),
  );
  await expect(persistIntelligenceState(input(7))).rejects.toThrow("Recarregue");
  expect(calls).toHaveLength(1);
  expect(calls[0].body.state.persistenceVersion).toBe(7);
});

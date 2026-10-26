import { expect, it } from "vitest";
import { activeUser, authenticatedUser, canAccessView, emptyAccessState } from "@/src/domain/access/model";
it("acesso real sem diretório confirmado permanece vazio e sem módulos", () => {
  const state = emptyAccessState();
  expect(state.users).toEqual([]);
  expect(authenticatedUser(state).status).toBe("suspended");
  expect(canAccessView(activeUser(state), "settings")).toBe(false);
  expect(canAccessView(activeUser(state), "home")).toBe(false);
});
it("falha de transporte do diretório não vira perfil nem erro técnico cru", async () => {
  const { vi } = await import("vitest");
  const { loadAccessDirectory } = await import("@/src/app/access-directory-client");
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 200 })));
  try {
    await expect(loadAccessDirectory("qa")).rejects.toThrow("Não foi possível confirmar seu acesso. Tente novamente.");
  } finally {
    vi.unstubAllGlobals();
  }
});

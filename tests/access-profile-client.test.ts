import { seedAccessState } from "@/src/domain/access/model";
import { saveAccessUser } from "@/src/app/access-directory-client";
import { authenticatedFetch } from "@/src/app/session-client";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/src/app/session-client", () => ({ authenticatedFetch: vi.fn() }));

describe("salvamento de perfil administrativo", () => {
  it("envia somente o usuário editado, sem restaurar acessos antigos de outros usuários", async () => {
    const state = seedAccessState();
    const selected = { ...state.users[1], role: "Analista sênior" };
    const currentServer = {
      ...state,
      users: state.users.map(user =>
        user.id === state.users[2].id ? { ...user, status: "suspended" as const, permissions: [] } : user,
      ),
    };
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(Response.json(currentServer));
    const saved = await saveAccessUser("strato-demo", state, selected);
    const options = vi.mocked(authenticatedFetch).mock.calls.at(-1)![1];
    expect(JSON.parse(options!.body as string).users).toEqual([selected]);
    expect(saved.users[2].status).toBe("suspended");
    expect(saved.users[2].permissions).toEqual([]);
  });

  it("expõe erro do servidor sem retornar sucesso local", async () => {
    const state = seedAccessState();
    vi.mocked(authenticatedFetch).mockResolvedValueOnce(Response.json({ error: "Sem autorização." }, { status: 403 }));
    await expect(saveAccessUser("strato-demo", state, state.users[1])).rejects.toThrow("Sem autorização.");
  });
});

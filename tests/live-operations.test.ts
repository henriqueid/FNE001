import { seedAccessState } from "@/src/domain/access/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { buildLiveOperators, supervisedUsers } from "@/src/domain/live-operations/model";
import { describe, expect, it } from "vitest";

describe("operação ao vivo", () => {
  it("permite ao administrador acompanhar os usuários ativos", () => {
    const state = seedAccessState();
    const admin = state.users.find(user => user.access === "admin")!;
    const visible = supervisedUsers(state.users, admin);
    expect(visible.length).toBe(state.users.filter(user => user.status === "active").length - 1);
    expect(visible.some(user => user.id === admin.id)).toBe(false);
  });

  it("limita o gestor aos subordinados diretos", () => {
    const state = seedAccessState();
    const manager = state.users.find(user => user.id === "user-gestor-ops")!;
    const visible = supervisedUsers(state.users, manager);
    expect(visible.map(user => user.id)).toEqual(["user-marina-ops"]);
  });

  it("projeta atividade operacional sem conteúdo de tela", () => {
    const state = seedAccessState();
    const admin = state.users.find(user => user.access === "admin")!;
    const live = buildLiveOperators(state.users, admin, initialOperations);
    expect(live.length).toBeGreaterThan(0);
    expect(live.every(item => item.screen && item.task && item.result)).toBe(true);
  });

  it("não inventa atividade para usuário sem evidência operacional", () => {
    const state = seedAccessState();
    const admin = state.users.find(user => user.access === "admin")!;
    const userWithoutActivity = {
      ...state.users.find(user => user.id === "user-lucas-risco")!,
      id: "user-deivid",
      name: "Deivid",
    };

    const live = buildLiveOperators([...state.users, userWithoutActivity], admin, initialOperations);

    expect(live.some(item => item.user.id === userWithoutActivity.id)).toBe(false);
  });
});

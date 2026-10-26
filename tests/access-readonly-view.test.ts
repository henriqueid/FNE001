/** Manutenção depende da permissão efetiva, inclusive no painel acessível por outro módulo. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { seedAccessState } from "@/src/domain/access/model";
import { UsersAccessPanel } from "@/src/features/settings/users-access-panel";

function panel(manager: boolean, suspended = false) {
  const state = seedAccessState();
  const selected = state.users.find(user => user.access === "operator")!;
  const actor = {
    ...selected,
    status: suspended ? ("suspended" as const) : ("active" as const),
    permissions: manager ? [...selected.permissions, "users:manage" as const] : selected.permissions,
  };
  return renderToStaticMarkup(
    createElement(UsersAccessPanel, {
      state: {
        ...state,
        authenticatedUserId: actor.id,
        users: state.users.map(user => (user.id === actor.id ? actor : user)),
      },
      onState: vi.fn(),
    }),
  );
}
describe("manutenção de usuários somente com autorização", () => {
  it("consulta mantém editor desabilitado e não oferece criação nem teste de outro usuário", () => {
    const html = panel(false);
    expect(html).toContain('class="access-editor" disabled=""');
    expect(html).not.toContain("+ Adicionar usuário");
    expect(html).not.toContain("Testar visão deste usuário");
    expect(html).toContain("Somente consulta");
  });
  it("gestor autorizado pode manter usuários", () => {
    const html = panel(true);
    expect(html).toContain("+ Adicionar usuário");
    expect(html).toContain('class="access-editor"');
    expect(html).not.toContain('class="access-editor" disabled=""');
  });
  it("permissão cadastrada não libera manutenção a usuário suspenso", () => {
    expect(panel(true, true)).toContain('class="access-editor" disabled=""');
    expect(panel(true, true)).not.toContain("+ Adicionar usuário");
  });
});

import { PolicyApprovalPanel } from "@/src/features/settings/policy-approval-panel";
it("alçadas deixam explícita consulta quando usuário não administra configurações", () => {
  const html = renderToStaticMarkup(
    createElement(PolicyApprovalPanel, {
      companies: ["CHURUME Empresa"],
      actorId: "actor",
      demoMode: false,
      canManage: false,
    }),
  );
  expect(html).toContain("Somente consulta");
});

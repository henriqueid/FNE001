import { listAccessChangeNotifications } from "@/src/server/access/notifications";
import { listPendingAccessChanges } from "@/src/server/access/change-requests";
import { seedAccessState } from "@/src/domain/access/model";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/src/server/access/change-requests", () => ({ listPendingAccessChanges: vi.fn() }));
const admin = {
  ...seedAccessState().users[0],
  functionalAreas: ["Diretoria"],
  tenantId: "tenant-a",
  status: "active",
  authorityIds: [],
} as ServerPrincipal;
const db = {} as DecisionDatabase;
const profile = seedAccessState().users[0];
const pending = {
  id: "pending-self",
  subjectUserId: admin.id,
  previous: profile,
  proposed: profile,
  reason: "Ajuste do meu perfil",
  status: "PENDING" as const,
  requestedById: admin.id,
  requestedBy: "Henrique",
  requestedAt: "2026-10-19T19:04:13Z",
};

describe("notificações de solicitações de acesso", () => {
  beforeEach(() => vi.mocked(listPendingAccessChanges).mockReset());
  it("mostra ao administrador a própria solicitação pendente com link para configurações", async () => {
    vi.mocked(listPendingAccessChanges).mockResolvedValue([pending]);
    const result = await listAccessChangeNotifications(db, "tenant-a", admin);
    expect(listPendingAccessChanges).toHaveBeenCalledWith(db, "tenant-a");
    expect(result).toHaveLength(1);
    expect(result[0]).toMatchObject({
      id: "access-pending-self",
      view: "settings",
      requiredPermission: "users:manage",
    });
    expect(result[0].title).toContain("Henrique");
  });
  it("remove o aviso quando a solicitação deixa de estar pendente", async () => {
    vi.mocked(listPendingAccessChanges).mockResolvedValue([]);
    expect(await listAccessChangeNotifications(db, "tenant-a", admin)).toEqual([]);
  });
  it("não consulta nem expõe pendências a usuário sem gestão de acessos ou tenant diferente", async () => {
    expect(
      await listAccessChangeNotifications(db, "tenant-a", {
        ...admin,
        access: "operator",
        permissions: ["dashboard:view"],
      }),
    ).toEqual([]);
    expect(await listAccessChangeNotifications(db, "tenant-b", admin)).toEqual([]);
    expect(listPendingAccessChanges).not.toHaveBeenCalled();
  });
});

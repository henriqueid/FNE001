import { describe, expect, it } from "vitest";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { emptyProspectDossier } from "@/src/domain/commercial/actions";
import { syncCommercialOnboardingParties } from "@/src/domain/registry/commercial-onboarding";
import { emptyParty } from "@/src/domain/registry/parties";

function fixture() {
  const state = seedCommercial("2026-10-25");
  const document = "99.888.777/0001-00";
  const prospect = {
    ...state.prospects[0],
    id: "churume-onboarding",
    name: "CHURUME",
    convertedAt: "2026-10-25T12:00:00Z",
    dossier: { ...emptyProspectDossier(), document, legalName: "CHURUME", proposedRate: 2.5 },
  };
  state.prospects = [prospect];
  state.links = [{ ...state.links[0], document, approvedLimit: 100_000 }];
  return { state, document };
}

describe("continuidade demonstrativa do onboarding", () => {
  it("gera ficha do cedente convertido com dados e limite do dossiê", () => {
    const { state, document } = fixture();
    const parties = syncCommercialOnboardingParties([], state, "Risco");
    expect(parties).toHaveLength(1);
    expect(parties[0]).toMatchObject({
      document,
      name: "CHURUME",
      roles: ["cedente"],
      roleData: { cedente: { creditLimit: 100_000 } },
    });
    expect(parties[0].history[0].by).toBe("Risco");
  });

  it("repetição e recarga preservam ficha já editada sem duplicar histórico", () => {
    const { state } = fixture();
    const first = syncCommercialOnboardingParties([], state, "Risco");
    const edited = [{ ...first[0], email: "preservar@example.test", notes: "KYC revisado" }];
    const again = syncCommercialOnboardingParties(edited, state, "Outro autor");
    expect(again).toEqual(edited);
    expect(again[0].history).toHaveLength(1);
  });

  it("acrescenta papel cedente sem perder identidade, contatos e papéis anteriores", () => {
    const { state, document } = fixture();
    const existing = { ...emptyParty("sacado"), id: "party-existing", document, email: "preservar@example.test" };
    const parties = syncCommercialOnboardingParties([existing], state, "Risco");
    expect(parties).toHaveLength(1);
    expect(parties[0]).toMatchObject({ id: existing.id, email: existing.email, roles: ["sacado", "cedente"] });
    expect(parties[0].roleData.sacado).toEqual(existing.roleData.sacado);
    expect(parties[0].roleData.cedente?.creditLimit).toBe(100_000);
  });

  it("não gera ficha para prospect ainda não convertido", () => {
    const { state } = fixture();
    state.prospects[0].convertedAt = undefined;
    expect(syncCommercialOnboardingParties([], state, "Risco")).toEqual([]);
  });
});

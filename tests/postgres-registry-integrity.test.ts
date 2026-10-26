/** Autoridade e concorrência cadastral em PostgreSQL descartável, nunca conexão existente. */
import { describe, expect, it } from "vitest";
import { emptyParty } from "@/src/domain/registry/parties";
import { getDatabase } from "@/src/server/database/postgres";
import { executeRegistryPartyCommand } from "@/src/server/registry/party-command";
import { findRegistryPartyById, saveRegistryParty } from "@/src/server/registry/repository";
const isolated = process.env.STRATO_TEST_DATABASE_URL;
const principal = {
  id: "user-henrique-admin",
  name: "CHURUME QA",
  permissions: ["registry:edit" as const],
  authorityIds: [],
  companyScopes: ["*"],
};
async function fixture() {
  const url = new URL(isolated!);
  if (url.hostname !== "127.0.0.1" || !url.port || url.port === "5432" || process.env.DATABASE_URL !== isolated)
    throw new Error("Banco de teste não isolado.");
  const db = getDatabase();
  const tenant = `registry-qa-${crypto.randomUUID()}`;
  await db
    .prepare("insert into private.tenants(tenant_id, legal_name, display_name) values (?, 'CHURUME QA', 'CHURUME QA')")
    .bind(tenant)
    .run();
  const party = await executeRegistryPartyCommand(db, tenant, principal, {
    party: {
      ...emptyParty("fornecedor"),
      id: crypto.randomUUID(),
      name: "CHURUME Fornecedor",
      document: "11.222.333/0001-81",
      history: [{ at: "1900-01-01", by: "forjado", action: "forjado" }],
    },
  });
  return { db, tenant, party };
}
describe.skipIf(!isolated)("histórico cadastral em PostgreSQL isolado", () => {
  it("duas edições concorrentes preservam autoria/histórico e só uma versão vence", async () => {
    const { db, tenant, party } = await fixture();
    expect(party.history).toHaveLength(1);
    expect(party.history[0].by).toBe(principal.name);
    const results = await Promise.allSettled(
      ["A", "B"].map(name =>
        executeRegistryPartyCommand(db, tenant, principal, {
          party: { ...party, name: `CHURUME ${name}`, history: [] },
          reason: "Revisão QA concorrente",
          expectedUpdatedAt: party.updatedAt,
        }),
      ),
    );
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const saved = await findRegistryPartyById(db, tenant, party.id);
    expect(saved?.history).toHaveLength(2);
    expect(saved?.history[0]).toEqual(party.history[0]);
    const events = await db
      .prepare(
        "select count(*)::integer as total from private.registry_party_events where tenant_id = ? and party_id = ?",
      )
      .bind(tenant, party.id)
      .first<{ total: number }>();
    expect(events?.total).toBe(2);
  });
  it("repositório recusa histórico antigo de projeção concorrente", async () => {
    const { db, tenant, party } = await fixture();
    await saveRegistryParty(db, tenant, principal.id, {
      ...party,
      name: "Primeiro",
      history: [...party.history, { at: new Date().toISOString(), by: principal.name, action: "Primeira atualização" }],
    });
    await expect(
      saveRegistryParty(db, tenant, principal.id, {
        ...party,
        name: "Obsoleto",
        history: [
          ...party.history,
          { at: new Date().toISOString(), by: principal.name, action: "Histórico concorrente" },
        ],
      }),
    ).rejects.toThrow(/histórico|cadastro mudou/i);
    expect((await findRegistryPartyById(db, tenant, party.id))?.name).toBe("Primeiro");
  });
});
describe.skipIf(!isolated)("onboarding institucional real", () => {
  it("grava empresa e inclui escopo do administrador na mesma transação", async () => {
    const { db, tenant } = await fixture();
    await db
      .prepare("insert into private.tenant_memberships (tenant_id,user_id,company_scopes) values (?,?,'[]'::jsonb)")
      .bind(tenant, principal.id)
      .run();
    const { saveCompanyProfile, loadCompanyProfile } = await import("@/src/server/registry/repository");
    await saveCompanyProfile(db, tenant, principal.id, {
      institutionType: "Factoring",
      email: "",
      phone: "",
      website: "",
      foundationDate: "",
      address: { zipCode: "", street: "", number: "", complement: "", district: "", city: "", state: "" },
      legalName: "CHURUME QA LTDA",
      tradeName: "CHURUME Institucional",
      document: "11.222.333/0001-81",
    });
    expect((await loadCompanyProfile(db, tenant))?.tradeName).toBe("CHURUME Institucional");
    const membership = await db
      .prepare("select company_scopes from private.tenant_memberships where tenant_id=? and user_id=?")
      .bind(tenant, principal.id)
      .first<{ company_scopes: string[] }>();
    expect(membership?.company_scopes).toContain("CHURUME Institucional");
  });
});

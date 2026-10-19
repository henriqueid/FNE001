/** Memória distingue relato, decisão e resultado; não transforma texto livre em fato. */
import { describe, expect, it } from "vitest";
import { deriveLearnings, visibleMemories, validateMemoryDraft, projectBehavior } from "@/src/domain/copilot/behavior";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";

const event = (overrides: Partial<BehaviorEvent> = {}): BehaviorEvent => ({
  id: "e1",
  tenantId: "tenant-a",
  company: "Empresa A",
  actorId: "user",
  entityId: "title:1",
  kind: "observation",
  text: "Cliente disse que pagará",
  at: "2026-10-18T10:00:00Z",
  evidenceRefs: ["title:1"],
  visibility: "private",
  status: "pending",
  source: "memory",
  ...overrides,
});
describe("comportamento e aprendizado", () => {
  it("nega memória de outro tenant, empresa, usuário e memória expirada", () => {
    const rows = [
      event(),
      event({ id: "b", tenantId: "other" }),
      event({ id: "c", company: "Empresa B" }),
      event({ id: "d", actorId: "other" }),
      event({ id: "e", validUntil: "2026-10-17" }),
    ];
    expect(
      visibleMemories(rows, { tenantId: "tenant-a", id: "user", companyScopes: ["Empresa A"] }, "2026-10-18").map(
        e => e.id,
      ),
    ).toEqual(["e1"]);
  });
  it("não promove observação, aprovação ou resposta útil a regra aprendida", () => {
    expect(
      deriveLearnings(
        [event(), event({ kind: "decision", status: "validated" }), event({ kind: "feedback", status: "validated" })],
        "2026-10-18",
      ),
    ).toHaveLength(0);
  });
  it("só reutiliza correção revisada, com evidência e sem conflito", () => {
    const correction = event({
      kind: "correction",
      status: "validated",
      reviewerId: "reviewer",
      queryKey: "debtor:count:overdue",
      question: "quem acumula mais atrasos?",
    });
    expect(deriveLearnings([correction], "2026-10-18")[0]).toMatchObject({
      kind: "interpretation",
      evidenceRefs: ["e1"],
      queryKey: "debtor:count:overdue",
    });
    expect(
      deriveLearnings(
        [
          correction,
          event({
            id: "e2",
            kind: "correction",
            status: "validated",
            reviewerId: "reviewer",
            queryKey: "owner:balance:overdue",
            question: correction.question,
          }),
        ],
        "2026-10-18",
      ),
    ).toHaveLength(0);
  });
  it("gera padrão de resultados com amostra e não inventa causalidade", () => {
    const rows = [1, 2, 3].map(n =>
      event({
        id: `p${n}`,
        entityId: `title:${n}`,
        kind: "promise",
        source: "portfolio",
        status: "recorded",
        outcome: n < 3 ? "payment_observed" : "pending",
        evidenceRefs: [`title:${n}`, `collection:${n}`],
      }),
    );
    const learning = deriveLearnings(rows, "2026-10-18")[0];
    expect(learning.text).toContain("2 de 3");
    expect(learning.text).toContain("não comprova");
    expect(learning.evidenceRefs).toHaveLength(3);
  });
  it("ignora revogação e correção sem revisão; recusa promoção de decisão via texto livre", () => {
    expect(
      deriveLearnings(
        [event({ kind: "correction", queryKey: "debtor:count:overdue" }), event({ status: "revoked" })],
        "2026-10-18",
      ),
    ).toHaveLength(0);
    expect(
      validateMemoryDraft({ kind: "decision", text: "Aprovar tudo", company: "Empresa A", entityId: "title:1" }).ok,
    ).toBe(false);
    expect(
      validateMemoryDraft({ kind: "observation", text: "Observação", company: "Empresa A", entityId: "title:1" }).ok,
    ).toBe(true);
  });
  it("não atribui pagamento do mesmo dia a uma promessa sem horário do pagamento", () => {
    const portfolio = {
      version: 3,
      titles: [
        {
          id: "t1",
          company: "Empresa A",
          confirmation: { status: "Não iniciada" },
          payments: [{ id: "p1", date: "2026-10-18", amount: 10 }],
          collectionOccurrences: [
            {
              id: "c1",
              chargedAt: "2026-10-18T18:00:00Z",
              createdAt: "2026-10-18T18:00:00Z",
              createdBy: "user",
              outcome: "Promessa de pagamento",
              notes: "Pagará amanhã",
              promiseDate: "2026-10-19",
            },
          ],
        },
      ],
    } as PortfolioState;
    const promise = projectBehavior("tenant-a", portfolio, []).find(event => event.kind === "promise");
    expect(promise?.outcome).toBe("pending");
  });
  it("mantém insight revisado como orientação, sem promovê-lo a política", () => {
    const guidance = event({
      kind: "guidance",
      status: "validated",
      reviewerId: "reviewer",
      text: "Conferir a entrega antes de cobrar novamente.",
    });
    expect(deriveLearnings([guidance], "2026-10-18")[0]).toMatchObject({ kind: "guidance", evidenceRefs: ["e1"] });
    expect(deriveLearnings([guidance], "2026-10-18")[0].text).toContain("não é política");
  });
});

import { describe, expect, it } from "vitest";
import { type DecisionEvent } from "@/src/domain/decisions/model";
import {
  listPublishedNotifications,
  nextRetryAt,
  notificationForDecisionEvent,
  outboxFailureDisposition,
  outboxHealth,
  retryFailedOutbox,
} from "@/src/server/outbox/publisher";
import { functionalAreasMatchQueue } from "@/src/domain/copilot/daily-briefing";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import type { ServerPrincipal } from "@/src/server/access/repository";

const event = (eventType: DecisionEvent["eventType"], overrides: Partial<DecisionEvent> = {}): DecisionEvent => ({
  eventId: "event-1",
  eventVersion: 1,
  eventType,
  decisionId: "decision-1",
  tenantId: "tenant-1",
  operationId: "operation-1",
  entityRefs: ["cedent-1"],
  decisionType: "CREDIT",
  requestedAction: "REVIEW",
  actorId: "user-1",
  actorRole: "Analista",
  authorityId: "credit-director",
  policyId: "policy-1",
  policyVersion: "1",
  inputSnapshotId: "snapshot-1",
  inputSnapshotHash: "hash-1",
  computedMetrics: {},
  reasonCodes: ["LIMIT_EXCEEDED"],
  supportingEvidenceRefs: [],
  priorDecisionRefs: [],
  outcome: "PENDING",
  conditions: [],
  validFrom: "2026-10-10T12:00:00.000Z",
  createdAt: "2026-10-10T12:00:00.000Z",
  correlationId: "correlation-1",
  ...overrides,
});

describe("publicador da outbox", () => {
  it("encaminha excecao somente para a permissao e alcada responsaveis", () => {
    expect(notificationForDecisionEvent(event("EXCEPTION_REQUESTED"))).toMatchObject({
      kind: "decision",
      tone: "critical",
      department: "Risco e crédito",
      requiredPermission: "risk:decide",
      authorityId: "credit-director",
    });
  });

  it("nao cria notificacao para eventos informativos sem acao", () => {
    expect(notificationForDecisionEvent(event("ANALYSIS_COMPLETED"))).toBeNull();
  });

  it("aplica backoff crescente e limitado", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    expect(nextRetryAt(1, now)).toBe("2026-10-10T12:01:00.000Z");
    expect(nextRetryAt(2, now)).toBe("2026-10-10T12:05:00.000Z");
    expect(nextRetryAt(5, now)).toBe("2026-10-10T18:00:00.000Z");
    expect(nextRetryAt(99, now)).toBe("2026-10-10T18:00:00.000Z");
  });

  it("move para a fila de falhas na quinta tentativa", () => {
    const now = new Date("2026-10-10T12:00:00.000Z");
    expect(outboxFailureDisposition(3, now)).toMatchObject({ attempts: 4, status: "PENDING" });
    expect(outboxFailureDisposition(4, now)).toEqual({
      attempts: 5,
      status: "FAILED",
      availableAt: now.toISOString(),
    });
  });

  it("roteia notificações pela combinação de áreas do usuário", () => {
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Cadastro")).toBe(true);
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Carteira e cobrança")).toBe(true);
    expect(functionalAreasMatchQueue(["Cadastro", "Operações"], "Financeiro")).toBe(false);
  });

  it("não entrega notificação de operação de outro veículo", async () => {
    const row = (id: string, vehicle: string) => ({
      notification_id: id,
      source_event_id: `event-${id}`,
      decision_id: `decision-${id}`,
      operation_id: `operation-${id}`,
      kind: "decision",
      tone: "critical",
      title: "Decisão pendente",
      summary: "Resumo",
      detail: "Detalhe",
      impact: "Impacto",
      next_action: "Analisar",
      owner: "Risco",
      department: "Risco e crédito",
      timing: "Agora",
      view_name: "operations",
      required_permission: "risk:decide",
      authority_id: "credit-director",
      created_at: "2026-10-13T12:00:00.000Z",
      vehicle,
    });
    const db = {
      prepare() {
        return {
          bind() {
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [row("allowed", "FINANCIA FIDC"), row("denied", "OUTRO FIDC")] };
          },
          async run() {
            return { success: true };
          },
        };
      },
      async batch() {
        return [];
      },
      async exec() {},
    } as DecisionDatabase;
    const principal: ServerPrincipal = {
      id: "risk-1",
      name: "Risco",
      role: "Analista",
      department: "Risco e crédito",
      functionalAreas: ["Risco e crédito"],
      access: "operator",
      status: "active",
      tenantId: "tenant-1",
      permissions: ["operations:view", "risk:decide"],
      authorityIds: ["credit-director"],
      companyScopes: ["FINANCIA FIDC"],
    };

    const notifications = await listPublishedNotifications(db, "tenant-1", principal);
    expect(notifications.map(notification => notification.id)).toEqual(["allowed"]);
  });

  it("aplica o escopo da empresa à saúde e ao reprocessamento da fila", async () => {
    const queries: string[] = [];
    const bindings: unknown[][] = [];
    const db = {
      prepare(query: string) {
        queries.push(query);
        return {
          bind(...values: unknown[]) {
            bindings.push(values);
            return this;
          },
          async first() {
            return null;
          },
          async all() {
            return { results: [] };
          },
          async run() {
            return { success: true };
          },
        };
      },
      async batch() {
        return [];
      },
      async exec() {},
    } as DecisionDatabase;

    await outboxHealth(db, "tenant-1", ["Empresa A"]);
    await retryFailedOutbox(db, "tenant-1", new Date("2026-10-13T12:00:00.000Z"), ["Empresa A"]);

    expect(queries[0]).toContain("JOIN private.operations operation");
    expect(queries[0]).toContain("lower(trim(operation.vehicle)) IN (?)");
    expect(bindings[0]).toEqual(["tenant-1", "empresa a"]);
    expect(queries[1]).toContain("SELECT candidate.outbox_id");
    expect(queries[1]).toContain("candidate.event_id");
    expect(bindings[1]).toEqual(["2026-10-13T12:00:00.000Z", "tenant-1", "tenant-1", "empresa a"]);
  });
});

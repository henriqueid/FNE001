/** Regra de alçadas exige proposta, outra pessoa, versão e autoridades reais. */
import { beforeEach, describe, expect, it } from "vitest";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";
import {
  configureApprovalPolicy,
  validApprovalSlots,
  type ApprovalPolicyCommand,
} from "@/src/server/operations/approval-policy";

type Event = {
  event_id: string;
  actor_id: string;
  aggregate_version: number;
  event_type: string;
  payload: { company: string; slots: unknown[]; reason: string; proposalId?: string; requestHash: string };
};
let events: Event[];
const db: DecisionDatabase = {
  prepare(query) {
    let values: unknown[] = [];
    const statement: DecisionStatement = {
      bind(...parameters) {
        values = parameters.map(value =>
          value && typeof value === "object" && "__stratoJson" in value
            ? (value as unknown as { value: unknown }).value
            : value,
        );
        return statement;
      },
      first: async <T>() => {
        if (query.includes("company_destinations")) return { destination_id: "company-1" } as T;
        if (query.includes("event_id = ?")) return (events.find(event => event.event_id === values[1]) as T) ?? null;
        if (query.includes("OPERATION_APPROVAL_POLICY_CONFIGURED"))
          return (events.findLast(event => event.event_type === "OPERATION_APPROVAL_POLICY_CONFIGURED") as T) ?? null;
        throw new Error(`Consulta inesperada: ${query}`);
      },
      all: async <T>() => ({
        results: (query.includes("authority_assignments") ? [{ authority_id: "credit-director" }] : events) as T[],
      }),
      run: async () => {
        if (query.includes("insert into private.domain_events"))
          events.push({
            event_id: String(values[1]),
            aggregate_version: Number(values[3]),
            event_type: String(values[4]),
            actor_id: String(values[5]),
            payload: values[7] as Event["payload"],
          });
        return { success: true };
      },
    };
    return statement;
  },
  batch: async () => [],
  exec: async () => undefined,
  transaction: async work => work({ ...db, transaction: undefined }),
};
const principal: ServerPrincipal = {
  id: "maker",
  name: "Proponente",
  tenantId: "tenant-1",
  role: "Admin",
  department: "Diretoria",
  functionalAreas: ["Diretoria"],
  access: "admin",
  status: "active",
  permissions: ["settings:manage"],
  authorityIds: [],
  companyScopes: ["Empresa"],
};
const proposal: ApprovalPolicyCommand = {
  company: "Empresa",
  action: "PROPOR",
  expectedVersion: 0,
  commandId: "a13fe5dd-aaee-4b6d-aabe-2534ae19368b",
  reason: "Regra formal da empresa",
  slots: [{ id: "credit", authorityId: "credit-director", permission: "risk:decide" }],
};
beforeEach(() => {
  events = [];
});
describe("configuração formal das alçadas", () => {
  it("publica somente após aprovação por outra pessoa", async () => {
    const proposed = await configureApprovalPolicy(db, principal, proposal);
    expect(proposed.policy).toBeUndefined();
    expect(proposed.proposals).toHaveLength(1);
    const approval: ApprovalPolicyCommand = {
      company: "Empresa",
      action: "APROVAR",
      expectedVersion: 1,
      commandId: "b13fe5dd-aaee-4b6d-aabe-2534ae19368b",
      reason: "Conferência independente",
      proposalId: proposed.proposals[0].eventId,
    };
    await expect(configureApprovalPolicy(db, principal, approval)).rejects.toThrow("Quem propôs");
    const configured = await configureApprovalPolicy(db, { ...principal, id: "checker" }, approval);
    expect(configured.policy?.slots).toEqual(proposal.slots);
    expect(configured.proposals).toHaveLength(0);
    expect(events.map(event => event.event_type)).toEqual([
      "OPERATION_APPROVAL_POLICY_PROPOSED",
      "OPERATION_APPROVAL_POLICY_CONFIGURED",
    ]);
  });
  it("nega alçada desconhecida, escopo e versão obsoleta", async () => {
    await expect(
      configureApprovalPolicy(db, principal, {
        ...proposal,
        slots: [{ id: "credit", authorityId: "unknown", permission: "risk:decide" }],
      }),
    ).rejects.toThrow("devem existir");
    await expect(configureApprovalPolicy(db, { ...principal, companyScopes: [] }, proposal)).rejects.toThrow(
      "Sem permissão",
    );
    await expect(configureApprovalPolicy(db, principal, { ...proposal, expectedVersion: 3 })).rejects.toThrow(
      "regra foi alterada",
    );
    expect(events).toHaveLength(0);
  });
  it("rejeita slots duplicados e preserva idempotência", async () => {
    expect(validApprovalSlots([...proposal.slots, ...proposal.slots])).toBe(false);
    await configureApprovalPolicy(db, principal, proposal);
    await configureApprovalPolicy(db, principal, proposal);
    expect(events).toHaveLength(1);
    await expect(
      configureApprovalPolicy(db, principal, { ...proposal, reason: "Outra finalidade conflitante" }),
    ).rejects.toThrow("outro conteúdo");
  });
});

/** Regressões da modalidade disponível, consulta sem fornecedor e resumo contextual. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { buildNewOperation } from "@/src/domain/operations/create-operation";
import { assertOperationTransition } from "@/src/server/operations/governance";
import { NewOperationModal } from "@/src/features/operations/new-operation/new-operation-modal";
import { DebtorStatement } from "@/src/features/operations/risk/debtor-statement";
import { IntegrationProvider } from "@/src/app/integration-context";
import type { IntegrationState } from "@/src/domain/integrations/model";
import { OperationSummaryAside } from "@/src/features/operations/workspace/operation-summary-aside";
import { automationFor, summaryFinancialsFor } from "@/src/features/operations/workspace/workspace-model";
import type { Operation } from "@/src/domain/core/types";
vi.mock("@/src/app/company-context", () => ({
  useCompanyDestinations: () => [{ name: "CHURUME veículo", institution: "Factoring" }],
}));
const base = initialOperations.find(item => item.manualEntry?.entries.length)!;
const ccb = { ...base, source: "Crédito estruturado" as const, operationType: "CCB", stage: 1 };
function aside(operation: Operation) {
  return renderToStaticMarkup(
    createElement(OperationSummaryAside, {
      operation,
      cedents: [],
      automation: automationFor(operation),
      open: true,
      onToggleOpen: vi.fn(),
      density: "expanded",
      onDensityChange: vi.fn(),
      pinned: true,
      onTogglePinned: vi.fn(),
      observation: "",
      onObservationChange: vi.fn(),
      onObservationCommit: vi.fn(),
    }),
  );
}
describe("correções Churume operação", () => {
  it("bloqueia origem CCB no seletor com explicação explícita", () => {
    const html = renderToStaticMarkup(
      createElement(NewOperationModal, { onClose: vi.fn(), onCreate: vi.fn(), operations: [], debtors: [] }),
    );
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>(?:(?!<\/button>)[\s\S])*Crédito estruturado/);
    expect(html).toContain("CCB ainda não suportada");
  });
  it("nega criação CCB no construtor, preservando criação manual", () => {
    const request = {
      source: "Crédito estruturado" as const,
      operationType: "CCB",
      destination: { name: base.vehicle, institution: base.institution, detail: "CHURUME" },
      cedent: initialCedents[0],
    };
    expect(() => buildNewOperation(request, [], seedCommercial(), "2026-10-26")).toThrow(/CCB.*não suportada/);
    expect(
      buildNewOperation({ ...request, source: "Digitação manual" }, [], seedCommercial(), "2026-10-26").stage,
    ).toBe(1);
  });
  it("nega CCB nova no servidor e mantém cancelamento legado permitido", () => {
    expect(() => assertOperationTransition(null, ccb)).toThrow(/CCB.*não suportada/);
    expect(() => assertOperationTransition(ccb, { ...ccb, status: "Cancelada" })).not.toThrow();
  });
  it("provedor ATIVA sem endpoint não habilita consulta nem afirma fonte oficial consultada", () => {
    const integrations = {
      version: 1,
      providers: [
        { id: "RECEITA", mode: "ATIVA" },
        { id: "BUREAU", mode: "ATIVA" },
      ],
    } as IntegrationState;
    const html = renderToStaticMarkup(
      createElement(
        IntegrationProvider,
        { value: integrations },
        createElement(DebtorStatement, {
          selectedGroup: { id: "sacado", name: "CHURUME sacado", document: "123", titles: 1, amount: 100 } as never,
          debtorDecisions: {},
          consulted: ["sacado", "bureau-sacado"],
          onOpenDetail: vi.fn(),
          onConsult: vi.fn(),
          onDecide: vi.fn(),
        }),
      ),
    );
    expect(html).not.toContain("fonte oficial ativa");
    expect(html).not.toContain("Consulta atualizada");
    expect(html).not.toContain("Bureau consultado");
    expect(html).toMatch(/<button[^>]*disabled=""[^>]*>Consulta cadastral indisponível/);
    expect(html).toContain("Sem provedor de consulta conectado");
  });
  it("histórico revela registros da própria operação, sem atividade fictícia", () => {
    const html = aside({
      ...base,
      stageCompletions: [{ stageId: 1, completedBy: "CHURUME Analista", completedAt: "26/10/2026 10:00" }],
      approvalReview: {
        status: "Preparação",
        audit: [
          {
            at: "26/10/2026 10:20",
            by: "CHURUME Gestora",
            action: "Retorno solicitado",
            detail: "Revisar lastro CHURUME",
          },
        ],
      },
    });
    expect(html).toMatch(/<details[^>]*>[\s\S]*<summary>Ver linha do tempo completa/);
    expect(html).toContain("CHURUME Analista");
    expect(html).toContain("Revisar lastro CHURUME");
    expect(html).not.toContain("Serasa API");
  });
  it("veículo revela identidade, instituição e contexto persistido do próprio aditivo", () => {
    const html = aside({
      ...base,
      vehicle: "CHURUME veículo específico",
      institution: "FIDC",
      fundClass: "Classe CHURUME",
      participants: ["CHURUME Gestora"],
    });
    expect(html).toMatch(/<details[^>]*>[\s\S]*<summary>Ver estrutura do veículo/);
    expect(html).toContain("Classe CHURUME");
    expect(html).toContain("CHURUME Gestora");
    expect(html).toContain("Estrutura informada nesta operação");
  });
  it("resumo sem condição salva fecha composição simulada e preserva líquido de origem", () => {
    const operation = {
      ...base,
      stage: 1,
      amount: 100,
      netAmount: 100,
      titleCount: 1,
      pricingReview: undefined,
      riskReview: undefined,
      manualEntry: { ...base.manualEntry!, entries: [{ ...base.manualEntry!.entries[0], amount: 100, discount: 0 }] },
    };
    const summary = summaryFinancialsFor(operation, []);
    const deductions =
      summary.calculation.originalDiscount +
      summary.calculation.fees +
      summary.calculation.iof +
      summary.calculation.guarantee +
      summary.pricing.manualRetention +
      summary.offsets;
    expect(summary.net).toBeCloseTo(Math.max(0, summary.face - deductions), 2);
    expect(operation.netAmount).toBe(100);
    expect(aside(operation)).toContain("LÍQUIDO SIMULADO");
    expect(aside(operation)).toContain("Condição comercial ainda não salva");
  });
});

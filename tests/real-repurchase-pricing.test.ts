/** Recompra real: fonte autoritativa, escolha explícita e condição salva. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { cedentPortfolioTitles } from "@/src/domain/core/demo/portfolio";
import { type Operation } from "@/src/domain/core/types";
import { defaultPricing, repurchaseCalculation } from "@/src/domain/operations/pricing";
import { usePricingDraft, type PricingDraftState } from "@/src/features/operations/pricing/use-pricing-draft";
import { RepurchaseOffsetGrid } from "@/src/features/operations/pricing/repurchase-offset-grid";
import { buildOffsetRows } from "@/src/features/operations/pricing/pricing-model";
import { settlementAdjustmentCalculation } from "@/src/domain/operations/pricing";
import { PricingPanel } from "@/src/features/operations/pricing/pricing-panel";
const base = initialOperations.find(item => item.manualEntry?.entries.length)!;
const entries = base.manualEntry!.entries;
const source = {
  ...cedentPortfolioTitles[0],
  id: "real-old-title",
  cedentDocument: base.document,
  groupOwnerDocument: undefined,
  faceAmount: 125.43,
  acquisitionMonthlyRate: 0,
  acquisitionMethod: "Nominal" as const,
};
function operation(choice?: boolean): Operation {
  const pricing = {
    ...defaultPricing(base),
    monthlyRate: 3,
    fundingCostMonthly: 0,
    repurchaseTitleIds: [source.id],
    repurchaseTerms: {
      [source.id]: {
        lateInterestMonthly: 0,
        penaltyPercent: 0,
        action: "Recompra" as const,
        ...(choice === undefined ? {} : { writeOffTitle: choice }),
      },
    },
  };
  return {
    ...base,
    id: "real-new-operation",
    risk: "Baixo",
    riskReview: {
      cedentDecision: "Aprovado",
      titleDecisions: Object.fromEntries(entries.map(title => [title.id, "Aprovado" as const])),
    },
    pricingReview: pricing,
    repurchaseContext: { titles: [source] },
  };
}
function save(input: Operation) {
  let draft!: PricingDraftState;
  let saved: Operation | undefined;
  function Probe() {
    draft = usePricingDraft(input, next => {
      saved = next;
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  draft.savePricing();
  return saved;
}
describe("condição de recompra real", () => {
  it.each([true, false])("desconta principal aberto e salva escolha %s com snapshot", choice => {
    const input = operation(choice);
    const result = repurchaseCalculation(input, input.pricingReview!);
    expect(result.total).toBe(125.43);
    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].terms.writeOffTitle).toBe(choice);
    const saved = save(input);
    expect(saved?.pricingReview?.repurchaseTerms?.[source.id].writeOffTitle).toBe(choice);
    expect(saved?.pricingReview?.repurchaseSourceBalances).toEqual({ [source.id]: 125.43 });
    expect(saved!.netAmount).toBeCloseTo(saved!.pricingReview!.audit!.at(-1)!.commercialNet - 125.43, 2);
  });
  it("impede salvar sem decidir baixar título", () => {
    expect(save(operation())).toBeUndefined();
  });
  it("sem seleção não exige escolha nem desconta saldo", () => {
    const input = operation();
    input.pricingReview!.repurchaseTitleIds = [];
    expect(repurchaseCalculation(input, input.pricingReview!).total).toBe(0);
    expect(save(input)?.pricingReview?.repurchaseSourceBalances).toEqual({});
  });
  it("impede seleção que sumiu da fonte autoritativa", () => {
    const input = operation(true);
    input.repurchaseContext = { titles: [] };
    expect(save(input)).toBeUndefined();
  });
  it("fonte carregada habilita recompra sem oferecer compensação real", () => {
    const html = renderToStaticMarkup(
      createElement(PricingPanel, { operation: operation(), onChange: () => {}, showGuidance: true }),
    );
    expect(html).not.toMatch(/data-testid="open-repurchase" disabled=""/);
    expect(html).toContain("Compensações e créditos reais indisponíveis");
  });
  it("grade real mostra escolha SIM/NAO sem alternativas legadas", () => {
    const input = operation();
    const result = repurchaseCalculation(input, input.pricingReview!);
    const html = renderToStaticMarkup(
      createElement(RepurchaseOffsetGrid, {
        rows: buildOffsetRows(result, settlementAdjustmentCalculation(input, input.pricingReview!)),
        availableCount: 1,
        onToggleTitle: () => {},
        onToggleAdjustment: () => {},
        onUpdateTerms: () => {},
        onRestoreRate: () => {},
        onSelectVisibleOverdue: () => {},
      }),
    );
    expect(html).toContain("Baixar título");
    expect(html).toContain(">SIM<");
    expect(html).toContain(">NÃO<");
    expect(html).not.toContain("Recompra parcial");
    expect(html).not.toContain("Taxa VP");
    expect(html).toContain("Saldo principal aberto");
  });
});

it("condição protegida não salva nem altera escolha por ações indiretas", () => {
  const input = operation(true);
  input.pricingReview!.locked = true;
  let draft!: PricingDraftState;
  let saved: Operation | undefined;
  function Probe() {
    draft = usePricingDraft(input, next => {
      saved = next;
    });
    return null;
  }
  renderToStaticMarkup(createElement(Probe));
  draft.updateRepurchaseTerms(source.id, { writeOffTitle: false });
  draft.setRepurchaseSelection([]);
  draft.savePricing();
  expect(saved).toBeUndefined();
  expect(draft.pricing.repurchaseTerms?.[source.id].writeOffTitle).toBe(true);
});

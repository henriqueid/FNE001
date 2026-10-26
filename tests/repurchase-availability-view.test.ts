/** Indisponibilidade explícita da recompra real, sem ocultar seleções legadas. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { defaultPricing } from "@/src/domain/operations/pricing";
import { PricingPanel } from "@/src/features/operations/pricing/pricing-panel";
const base = initialOperations.find(operation => operation.manualEntry?.entries.length)!;
const render = (operation: typeof base) =>
  renderToStaticMarkup(createElement(PricingPanel, { operation, onChange: () => {}, showGuidance: true }));
it("desabilita ambos atalhos reais com motivo visível", () => {
  const html = render({ ...base, id: "operacao-real" });
  expect(html).toContain("Fonte autoritativa de recompra indisponível");
  expect(html).toMatch(/data-testid="open-repurchase" disabled=""/);
  expect(html).toMatch(/data-testid="launch-repurchase" disabled=""/);
});
it("sinaliza seleção legada real que não entrou no cálculo", () => {
  const html = render({
    ...base,
    id: "operacao-real",
    pricingReview: { ...defaultPricing(base), repurchaseTitleIds: ["legacy-title"] },
  });
  expect(html).toContain("Há seleções de recompra ou compensação sem validação autoritativa");
});
it("identifica recompra demonstrativa como simulação", () => {
  expect(render(base)).toContain("Simulação de recompra e compensações");
});

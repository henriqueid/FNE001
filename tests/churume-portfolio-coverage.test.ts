/** Garante que títulos além da primeira página continuam acessíveis e exportáveis. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import PortfolioModule from "@/src/features/portfolio/portfolio-module";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { RegistryContext } from "@/src/app/registry-context";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { seedPortfolio } from "@/src/domain/portfolio/model";

it("carteira informa todos201 títulos e oferece paginação sem truncar a origem", () => {
  const portfolio = seedPortfolio(initialOperations);
  portfolio.titles = Array.from({ length: 201 }, (_, n) => ({
    ...portfolio.titles[0],
    id: `qa-${n}`,
    documentNumber: `QA-${n}`,
    dueDate: "2026-10-01",
  }));
  const commercial = seedCommercial("2026-10-26");
  const registry = {
    parties: [],
    cedents: [],
    debtors: [],
    commercial,
    saveCommercial: () => {},
    saveParty: () => ({}),
  } as never;
  const html = renderToStaticMarkup(
    createElement(
      RegistryContext.Provider,
      { value: registry },
      createElement(PortfolioModule, {
        portfolio,
        onPortfolio: () => {},
        companyScope: "Consolidado",
        focus: { tab: "titulos" },
        onNavigate: () => {},
        debtors: [],
      }),
    ),
  );
  expect(html).toContain("201 título(s)");
  expect(html).toContain("Próxima página");
  expect(html).toContain("Página 1 de 3");
});

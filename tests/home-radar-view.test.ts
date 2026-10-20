/** Cards usam evidência atual da carteira e distinguem notícia de leitura contextual. */
import { renderToStaticMarkup } from "react-dom/server";
import { createElement } from "react";
import { expect, it, vi } from "vitest";
import { HomeRadar } from "@/src/features/home/home-radar";
import { qualityTrend } from "@/src/domain/risk/quality";
import { demoQualityPolicy } from "@/src/domain/risk/quality-policy";
import { demoCedentHistories } from "@/src/domain/core/demo/quality-history";
import { initialCedents } from "@/src/domain/core/demo/cedents";

it("mostra score ponderado e saldo vencido sem exigir histórico de variação", () => {
  const history = demoCedentHistories(initialCedents, "2026-10-20")[0];
  const score = qualityTrend({ ...history, exposure: 100000, months: history.months.slice(-1) }, demoQualityPolicy);
  const html = renderToStaticMarkup(
    createElement(HomeRadar, {
      mode: "live",
      scores: [score],
      canViewScores: true,
      snapshot: { events: [], market: [], checkedAt: "2026-10-20T12:00:00Z" },
      onRefresh: vi.fn(),
      onAccept: vi.fn(),
      onEvent: vi.fn(),
      onScores: vi.fn(),
    }),
  );
  expect(html).toContain(String(Math.round(score.index)));
  expect(html).toContain("Score da carteira");
  expect(html).toContain("Ponderado pela exposição");
  expect(html).not.toContain("Sem posição de score");
});

import { describe, expect, it } from "vitest";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { filterPortfolioScope, mergePortfolioScope } from "@/src/server/portfolio/access";

describe("escopo de empresa da Carteira", () => {
  const full = seedPortfolio(initialOperations);
  const firstCompany = full.titles.find(title => title.company)?.company ?? "";
  const principal = { companyScopes: [firstCompany] };

  it("não expõe títulos nem contagens de outro veículo", () => {
    const scoped = filterPortfolioScope(principal, full);
    expect(scoped.titles.length).toBeGreaterThan(0);
    expect(scoped.titles.every(title => title.company === firstCompany)).toBe(true);
    expect(scoped.historicalTitleCount).toBe(scoped.titles.length);
  });

  it("preserva títulos fora do escopo ao salvar a parcela visível", () => {
    const scoped = filterPortfolioScope(principal, full);
    const changed = {
      ...scoped,
      titles: scoped.titles.map((title, index) =>
        index === 0 ? { ...title, collectionInstruction: "Cobrar hoje" } : title,
      ),
    };
    const merged = mergePortfolioScope(principal, full, changed);
    expect(merged.error).toBeUndefined();
    expect(merged.state?.titles).toHaveLength(full.titles.length);
    expect(merged.state?.titles.find(title => title.id === changed.titles[0].id)?.collectionInstruction).toBe(
      "Cobrar hoje",
    );
    const unscoped = full.titles.find(title => title.company !== firstCompany)!;
    expect(merged.state?.titles.find(title => title.id === unscoped.id)).toEqual(unscoped);
  });

  it("recusa injeção ou remoção de títulos", () => {
    const scoped = filterPortfolioScope(principal, full);
    const injected = { ...scoped, titles: [...scoped.titles, { ...scoped.titles[0], id: "foreign" }] };
    const removed = { ...scoped, titles: scoped.titles.slice(1) };
    expect(mergePortfolioScope(principal, full, injected).error).toContain("não pertence");
    expect(mergePortfolioScope(principal, full, removed).error).toContain("não pode remover");
  });
});

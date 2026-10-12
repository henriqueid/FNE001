import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";
import { settlementPending } from "@/src/domain/home/metrics";

const root = process.cwd();

const sourceFiles = (directory: string): string[] =>
  readdirSync(directory).flatMap(entry => {
    const path = join(directory, entry);
    return statSync(path).isDirectory() ? sourceFiles(path) : /\.(ts|tsx)$/.test(entry) ? [path] : [];
  });

describe("fronteira entre ambiente real e demonstração", () => {
  it("não permite que telas de negócio importem a lista fixa de empresas demonstrativas", () => {
    const offenders = sourceFiles(join(root, "src", "features"))
      .filter(path => readFileSync(path, "utf8").includes("domain/core/demo/companies"))
      .map(path => relative(root, path));

    expect(offenders).toEqual([]);
  });

  it("não usa uma operação demonstrativa como molde para criar operações reais", () => {
    const source = readFileSync(join(root, "src", "domain", "operations", "create-operation.ts"), "utf8");

    expect(source).not.toContain("domain/core/demo/operations");
    expect(source).not.toContain("...initialOperations");
  });

  it("mantém conta gráfica e pendências zeradas fora da demonstração", () => {
    expect(settlementPending()).toEqual({
      pendingCount: 0,
      pendingAmount: 0,
      creditCount: 0,
      creditAmount: 0,
    });
    expect(settlementPending(true).pendingCount).toBeGreaterThan(0);
  });

  it("não pré-preenche formulários reais com empresas, pessoas ou valores fictícios", () => {
    const repModal = readFileSync(join(root, "src", "features", "commercial", "modals", "rep-modal.tsx"), "utf8");
    const financeImport = readFileSync(
      join(root, "src", "features", "finance", "titles", "import-titles-modal.tsx"),
      "utf8",
    );
    const homeMetrics = readFileSync(join(root, "src", "features", "home", "use-home-metrics.ts"), "utf8");

    expect(repModal).not.toContain("Lastro Fomento Mercantil");
    expect(repModal).not.toContain("monthlyGoal: 30_000");
    expect(financeImport).not.toContain("GZ Transportes");
    expect(financeImport).not.toContain("Órbita");
    expect(homeMetrics).toContain("settlementPending(includeDemoPortfolio)");
  });
});

import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { describe, expect, it } from "vitest";

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
});

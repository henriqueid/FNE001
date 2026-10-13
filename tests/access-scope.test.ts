import { describe, expect, it } from "vitest";
import {
  filterCompanyScope,
  operationCompany,
  operationWriteScopeError,
  principalCanAccessOperation,
  principalHasCompanyScope,
} from "@/src/server/access/scope";
import type { DecisionDatabase, DecisionStatement } from "@/src/server/decisions/repository";

const principal = { tenantId: "tenant-a", companyScopes: ["FINANCIA FIDC"] };

describe("escopo de tenant e empresa", () => {
  it("aceita somente empresas explicitamente atribuídas", () => {
    expect(principalHasCompanyScope(principal, "financia fidc")).toBe(true);
    expect(principalHasCompanyScope(principal, "Outra Securitizadora")).toBe(false);
    expect(principalHasCompanyScope({ companyScopes: ["*"] }, "Qualquer veículo")).toBe(true);
    expect(principalHasCompanyScope({ companyScopes: [] }, "FINANCIA FIDC")).toBe(false);
  });

  it("filtra coleções sem expor registros de outro veículo", () => {
    const operations = [
      { id: "allowed", vehicle: "FINANCIA FIDC" },
      { id: "denied", vehicle: "STRATO SECURITIZADORA" },
    ];
    expect(filterCompanyScope(principal, operations, operation => operation.vehicle)).toEqual([operations[0]]);
  });

  it("impede trazer para o próprio escopo uma operação de outro veículo", () => {
    expect(operationWriteScopeError(principal, "STRATO SECURITIZADORA", "FINANCIA FIDC")).toContain(
      "operação existente",
    );
    expect(operationWriteScopeError(principal, "FINANCIA FIDC", "STRATO SECURITIZADORA")).toContain(
      "fora do seu escopo",
    );
    expect(operationWriteScopeError(principal, "FINANCIA FIDC", "FINANCIA FIDC")).toBeNull();
  });

  it("vincula a consulta de escopo ao tenant autenticado", async () => {
    const bindings: unknown[][] = [];
    const db: DecisionDatabase = {
      prepare() {
        const statement: DecisionStatement = {
          bind(...values) {
            bindings.push(values);
            return this;
          },
          async first<T>() {
            return { vehicle: "FINANCIA FIDC" } as T;
          },
          async all<T>() {
            return { results: [] as T[] };
          },
          async run() {
            return { success: true };
          },
        };
        return statement;
      },
      async batch() {
        return [];
      },
      async exec() {},
    };

    expect(await principalCanAccessOperation(db, principal, "operation-1")).toBe(true);
    expect(bindings[0]).toEqual(["tenant-a", "operation-1"]);
    expect(await operationCompany(db, "tenant-b", "operation-1")).toBe("FINANCIA FIDC");
    expect(bindings[1]).toEqual(["tenant-b", "operation-1"]);
  });
});

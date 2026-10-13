import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { portfolioProjectionFromReceivables } from "@/src/domain/portfolio/model";
import {
  canonicalReceivableKey,
  hydrateOperationReceivables,
  receivableFromOperation,
  receivableIdFor,
  receivablesFromOperation,
  stripReceivablesFromOperation,
  validateReceivable,
} from "@/src/domain/receivables/model";

const operation = initialOperations.find(item => item.manualEntry?.entries.length)!;
const entry = operation.manualEntry!.entries[0];

describe("agregado Receivable", () => {
  it("produz identidade canônica estável apesar de máscaras e caixa", () => {
    const left = canonicalReceivableKey({
      receivableType: "Duplicata",
      ownerDocument: "12.345.678/0001-90",
      debtorDocument: "98.765.432/0001-10",
      documentNumber: " NF-100/01 ",
    });
    const right = canonicalReceivableKey({
      receivableType: "DUPLICATA",
      ownerDocument: "12345678000190",
      debtorDocument: "98765432000110",
      documentNumber: "nf-100/01",
    });
    expect(left).toBe(right);
    expect(receivableIdFor("op-1", "entry-1")).toBe("rcv:op-1:entry-1");
  });

  it("retira títulos do payload da operação e reidrata a leitura pelas entidades persistidas", () => {
    const records = receivablesFromOperation(operation);
    const stripped = stripReceivablesFromOperation(operation);
    const hydrated = hydrateOperationReceivables(stripped, records);

    expect(stripped.manualEntry?.entries).toEqual([]);
    expect(hydrated.manualEntry?.entries).toEqual(operation.manualEntry?.entries);
    expect(hydrated.titleCount).toBe(operation.titleCount);
    expect(hydrated.amount).toBe(operation.amount);
  });

  it("deriva o ciclo do recebível e projeta somente cessões na Carteira", () => {
    const draft = receivableFromOperation({ ...operation, status: "Em andamento" }, entry);
    const rejected = receivableFromOperation(
      {
        ...operation,
        status: "Em andamento",
        riskReview: { titleDecisions: { [entry.id]: "Reprovado" } },
      },
      entry,
    );
    const assigned = receivableFromOperation({ ...operation, status: "Liberada ao financeiro" }, entry);

    expect(draft.lifecycleStatus).toBe("DRAFT");
    expect(rejected.lifecycleStatus).toBe("REJECTED");
    expect(assigned.lifecycleStatus).toBe("ASSIGNED");
    expect(portfolioProjectionFromReceivables([draft, rejected, assigned]).titles).toHaveLength(1);
    expect(portfolioProjectionFromReceivables([assigned]).titles[0]).toMatchObject({
      receivableId: assigned.id,
      operationId: operation.id,
      documentNumber: entry.documentNumber,
    });
  });

  it("valida os campos materiais do ativo", () => {
    const record = receivableFromOperation(operation, entry);
    expect(validateReceivable(record)).toBeNull();
    expect(validateReceivable({ ...record, entry: { ...record.entry, amount: 0 } })).toBe("Valor de face inválido.");
  });
});

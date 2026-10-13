import { describe, expect, it } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import {
  expectedOperationVersion,
  operationPayload,
  validatePersistedOperation,
} from "@/src/domain/operations/persistence";

describe("persistência do agregado Operation", () => {
  it("valida uma operação completa e rejeita estados estruturais inválidos", () => {
    const operation = initialOperations[0];
    expect(validatePersistedOperation(operation)).toBeNull();
    expect(validatePersistedOperation({ ...operation, stage: 7 })).toBe("Etapa da operação inválida.");
    expect(validatePersistedOperation({ ...operation, amount: -1 })).toBe("Valor da operação inválido.");
  });

  it("usa versão zero para criação e preserva a versão recebida do servidor", () => {
    expect(expectedOperationVersion(initialOperations[0])).toBe(0);
    expect(expectedOperationVersion({ ...initialOperations[0], persistenceVersion: 4 })).toBe(4);
  });

  it("não grava a versão técnica dentro do payload de negócio", () => {
    const operation = initialOperations.find(item => item.manualEntry?.entries.length) ?? initialOperations[0];
    const payload = operationPayload({ ...operation, persistenceVersion: 3 });
    expect(payload.persistenceVersion).toBeUndefined();
    expect(payload.id).toBe(operation.id);
    expect(payload.manualEntry?.entries).toEqual([]);
  });
});

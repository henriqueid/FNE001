import {
  migrateOperationalDefaults,
  resolveOperationalParameters,
  seedOperationalDefaults,
} from "@/src/domain/registry/operational-profile";
import { describe, expect, it } from "vitest";

describe("herança dos parâmetros operacionais", () => {
  it("herda o padrão geral quando o cliente não personaliza o campo", () => {
    const defaults = seedOperationalDefaults();
    const resolved = resolveOperationalParameters(defaults, { monthlyRate: 2.15 });
    expect(resolved.monthlyRate).toBe(2.15);
    expect(resolved.minimumConfirmationAmountPercent).toBe(defaults.general.minimumConfirmationAmountPercent);
  });

  it("preserva zero como valor explícito do cliente", () => {
    const defaults = seedOperationalDefaults();
    const resolved = resolveOperationalParameters(defaults, { operationFee: 0, reservePercent: 0 });
    expect(resolved.operationFee).toBe(0);
    expect(resolved.reservePercent).toBe(0);
  });

  it("migra configurações antigas acrescentando novos parâmetros", () => {
    const migrated = migrateOperationalDefaults({ version: 1, general: { monthlyRate: 1.99 } });
    expect(migrated.general.monthlyRate).toBe(1.99);
    expect(migrated.general.minimumConfirmationCountPercent).toBeGreaterThan(0);
    expect(migrated.revenueGoals.consolidated.mes).toBeGreaterThan(0);
  });
});

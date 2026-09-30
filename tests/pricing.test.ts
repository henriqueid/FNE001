import { describe, expect, it } from "vitest";
import { pricingAdjustment } from "@/src/domain/operations/pricing";

describe("deságio por método", () => {
  it("nominal: face × taxa/30 × dias", () => {
    // 10.000 × 3% / 30 = 10,00 por dia × 30 dias
    expect(pricingAdjustment(10_000, 30, 3, "Nominal")).toBe(300);
  });
  it("efetiva: desconto racional composto", () => {
    const v = pricingAdjustment(10_000, 30, 3, "Efetiva");
    expect(v).toBeCloseTo(10_000 - 10_000 / (100 / 97), 2);
  });
  it("mista usa simples a partir de 30 dias e efetiva antes", () => {
    expect(pricingAdjustment(10_000, 45, 2, "Mista")).toBe(300);
    expect(pricingAdjustment(10_000, 15, 2, "Mista")).toBe(pricingAdjustment(10_000, 15, 2, "Efetiva"));
  });
  it("limita a taxa a um intervalo válido", () => {
    expect(pricingAdjustment(1000, 30, -5, "Nominal")).toBe(0);
  });
});

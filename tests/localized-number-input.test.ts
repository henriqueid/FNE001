import { describe, expect, it } from "vitest";
import { formatLocalizedNumber, parseLocalizedNumber } from "@/src/ui/localized-number-input";

describe("máscaras numéricas brasileiras", () => {
  it("lê valores monetários com milhar e vírgula decimal", () => {
    expect(parseLocalizedNumber("R$ 1.234.567,89")).toBe(1234567.89);
    expect(parseLocalizedNumber("2500,50")).toBe(2500.5);
  });

  it("formata com precisão configurável", () => {
    expect(formatLocalizedNumber(1234567.8, 2)).toBe("1.234.567,80");
    expect(formatLocalizedNumber(90, 0)).toBe("90");
  });
});

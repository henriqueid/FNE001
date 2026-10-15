import { describe, expect, it } from "vitest";
import { scoreChipTone, scoreClassification, scoreTone } from "@/src/features/registry/registry-format";

describe("classificação de score nos cadastros", () => {
  it("trata score ausente ou zero como cadastro novo", () => {
    expect(scoreClassification(undefined)).toBe("Novo");
    expect(scoreClassification(0)).toBe("Novo");
    expect(scoreChipTone(0)).toBe("muted");
  });

  it("aplica as faixas operacionais vigentes", () => {
    expect(scoreClassification(599)).toBe("Crítico");
    expect(scoreClassification(600)).toBe("Atenção");
    expect(scoreClassification(699)).toBe("Atenção");
    expect(scoreClassification(700)).toBe("Positivo");
    expect(scoreTone(700)).toBe("good");
  });
});

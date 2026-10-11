import { describe, expect, it } from "vitest";
import { hashPassword, passwordValidationError, verifyPassword } from "@/src/server/access/password";

describe("credenciais internas do STRATO", () => {
  it("gera hash salgado e valida somente a senha correta", async () => {
    const encoded = await hashPassword("SenhaSegura2026");
    expect(encoded).not.toContain("SenhaSegura2026");
    expect(await verifyPassword("SenhaSegura2026", encoded)).toBe(true);
    expect(await verifyPassword("SenhaIncorreta2026", encoded)).toBe(false);
  });

  it("exige uma senha minimamente forte", () => {
    expect(passwordValidationError("curta1A")).toBeTruthy();
    expect(passwordValidationError("somenteletras")).toBeTruthy();
    expect(passwordValidationError("SenhaSegura2026")).toBeUndefined();
  });

  it("recusa hashes corrompidos sem lançar erro", async () => {
    expect(await verifyPassword("SenhaSegura2026", "pbkdf2-sha256$999999999$%%%$%%%")).toBe(false);
  });
});

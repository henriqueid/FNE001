import {
  cpfValidationError,
  formatCpf,
  isValidCpf,
  loginNameValidationError,
  normalizeCpf,
  normalizeLoginName,
} from "@/src/domain/access/identity";
import { describe, expect, it } from "vitest";
import { authenticateCredentials } from "@/src/server/access/repository";
import { hashPassword } from "@/src/server/access/password";
import { type DecisionDatabase } from "@/src/server/decisions/repository";

const credentialDatabase = async () => {
  const passwordHash = await hashPassword("SenhaSegura2026");
  const bindings: unknown[][] = [];
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...input: unknown[]) {
          values = input;
          bindings.push(input);
          return this;
        },
        async first() {
          return query.includes("FROM private.access_credentials")
            ? {
                user_id: "user-1",
                password_hash: passwordHash,
                credential_status: "active",
                user_status: "active",
                locked_until: null,
              }
            : null;
        },
        async all() {
          return { results: [] };
        },
        async run() {
          return { success: true, values };
        },
      };
    },
    async batch() {
      return [];
    },
    async exec() {},
  } as unknown as DecisionDatabase;
  return { db, bindings };
};

describe("identificadores de acesso", () => {
  it("normaliza e valida o login personalizado", () => {
    expect(normalizeLoginName("  Joao.Silva  ")).toBe("joao.silva");
    expect(loginNameValidationError("joao.silva")).toBeUndefined();
    expect(loginNameValidationError("12345678901")).toBeTruthy();
    expect(loginNameValidationError("a@")).toBeTruthy();
  });

  it("normaliza, formata e valida CPF pelos dígitos verificadores", () => {
    expect(normalizeCpf("529.982.247-25")).toBe("52998224725");
    expect(formatCpf("52998224725")).toBe("529.982.247-25");
    expect(isValidCpf("529.982.247-25")).toBe(true);
    expect(cpfValidationError("529.982.247-25")).toBeUndefined();
    expect(isValidCpf("111.111.111-11")).toBe(false);
    expect(isValidCpf("529.982.247-24")).toBe(false);
  });

  it("autentica com login personalizado ou CPF formatado usando a mesma credencial", async () => {
    const byLogin = await credentialDatabase();
    expect(await authenticateCredentials(byLogin.db, "tenant-1", " Joao.Silva ", "SenhaSegura2026")).toBe("user-1");
    expect(byLogin.bindings[0]).toEqual(["tenant-1", "joao.silva", "joao.silva", null]);

    const byCpf = await credentialDatabase();
    expect(await authenticateCredentials(byCpf.db, "tenant-1", "529.982.247-25", "SenhaSegura2026")).toBe("user-1");
    expect(byCpf.bindings[0]).toEqual(["tenant-1", "529.982.247-25", "529.982.247-25", "52998224725"]);
  });
});

it("login textual nunca procura CPF vazio ou dígitos extraídos de letras", async () => {
  for (const identifier of ["login.inexistente", "nome52998224725", "nome123"]) {
    const captured = await credentialDatabase();
    await authenticateCredentials(captured.db, "tenant-1", identifier, "SenhaSegura2026");
    expect(captured.bindings[0][3]).toBeNull();
  }
});

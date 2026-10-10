import { bearerToken } from "@/src/supabase/request";
import { describe, expect, it } from "vitest";

describe("autenticação Supabase nas APIs", () => {
  it("extrai somente um bearer token bem formado", () => {
    expect(bearerToken(new Headers({ authorization: "Bearer token-seguro" }))).toBe("token-seguro");
    expect(bearerToken(new Headers({ authorization: "bearer outro-token" }))).toBe("outro-token");
  });

  it("rejeita cabeçalhos ausentes ou ambíguos", () => {
    expect(bearerToken(new Headers())).toBeUndefined();
    expect(bearerToken(new Headers({ authorization: "Basic credencial" }))).toBeUndefined();
    expect(bearerToken(new Headers({ authorization: "Bearer token extra" }))).toBeUndefined();
  });
});

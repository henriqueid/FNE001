/** E-mail opcional não é identidade vazia compartilhada por todos os usuários sem e-mail. */
import { expect, it } from "vitest";
import { createManagedAccessUser } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

it("omissão de e-mail não consulta igualdade com texto vazio", async () => {
  const queries: Array<{ query: string; values: unknown[] }> = [];
  const db = {
    prepare(query: string) {
      const entry = { query, values: [] as unknown[] };
      queries.push(entry);
      return {
        bind(...values: unknown[]) {
          entry.values = values;
          return this;
        },
        first: async () => null,
        run: async () => ({ success: true }),
        all: async () => ({ results: [] }),
      };
    },
    batch: async () => [],
    exec: async () => undefined,
  } as DecisionDatabase;
  await createManagedAccessUser(db, {
    tenantId: "CHURUME-tenant",
    actorId: "CHURUME-admin",
    name: "CHURUME Usuário",
    loginName: "churume.user",
    cpf: "52998224725",
    department: "Operações",
    passwordHash: "fixture-only",
  });
  expect(queries.find(item => item.query.includes("SELECT user_id FROM private.access_users"))?.values[0]).toBeNull();
});

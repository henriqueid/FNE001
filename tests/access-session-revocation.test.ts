/** Suspensão encerra sessões para que a reativação exija nova autenticação. */
import { expect, it } from "vitest";
import { seedAccessState } from "@/src/domain/access/model";
import { applyAccessUserProfile } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

it("suspensão registra revogação das sessões abertas antes de uma futura reativação", async () => {
  const writes: Array<{ query: string; values: unknown[] }> = [];
  const db = {
    prepare(query: string) {
      let values: unknown[] = [];
      return {
        bind(...input: unknown[]) {
          values = input;
          return this;
        },
        run: async () => {
          writes.push({ query, values });
          return { success: true };
        },
        first: async () => null,
        all: async () => ({ results: [] }),
      };
    },
    batch: async () => [],
    exec: async () => undefined,
  } as DecisionDatabase;
  const user = { ...seedAccessState().users[1], status: "suspended" as const };
  await applyAccessUserProfile(db, "CHURUME-tenant", "CHURUME-admin", user);
  const revoked = writes.find(entry => /UPDATE private.app_sessions SET revoked_at/i.test(entry.query));
  expect(revoked).toBeDefined();
  expect(revoked!.values[1]).toBe(user.id);
});

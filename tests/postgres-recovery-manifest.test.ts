/** Comparação de manifestos de recuperação: perda de linha, conteúdo ou segurança não passa silenciosamente. */
import { describe, it, expect } from "vitest";
import { assertRecoveryMatches } from "../scripts/postgres-recovery.mjs";
const snapshot = {
  tables: {
    "private.finance_states": { count: 1, sha256: "state-a" },
    "private.domain_events": { count: 3, sha256: "events-a" },
    "private.finance_journal_entries": { count: 2, sha256: "journal-a" },
  },
  securitySha256: "security-a",
};
describe("manifesto da restauração PostgreSQL", () => {
  it("aceita conteúdo idêntico com contagens e hashes preservados", () =>
    expect(() => assertRecoveryMatches(snapshot, structuredClone(snapshot))).not.toThrow());
  it.each(["missing", "count", "content", "security"])("recusa restauração divergente %s", kind => {
    const restored = structuredClone(snapshot);
    if (kind === "missing") delete (restored.tables as Record<string, unknown>)["private.domain_events"];
    if (kind === "count") restored.tables["private.finance_states"].count = 0;
    if (kind === "content") restored.tables["private.finance_journal_entries"].sha256 = "corrompido";
    if (kind === "security") restored.securitySha256 = "rls-removida";
    expect(() => assertRecoveryMatches(snapshot, restored)).toThrow(/recuperação|restauração/i);
  });
});

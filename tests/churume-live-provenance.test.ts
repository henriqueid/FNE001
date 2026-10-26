/** Ausência de telemetria não pode virar presença, duração ou eventos inventados. */
import { expect, it } from "vitest";
import { buildLiveOperators } from "@/src/domain/live-operations/model";
import { seedAccessState } from "@/src/domain/access/model";
import { initialOperations } from "@/src/domain/core/demo/operations";

it("sem modo demo apresenta presença desconhecida em vez de sintetizar sessão pelo ID", () => {
  const state = seedAccessState();
  const viewer = state.users.find(user => user.access === "admin")!;
  const rows = buildLiveOperators(state.users, viewer, initialOperations);
  expect(rows.length).toBeGreaterThan(0);
  expect(rows.every(row => row.presence === "unknown" && row.sessionMinutes === 0 && row.activityMinutes === 0)).toBe(
    true,
  );
});
it("ação real vem da operação, sem inferir atividade atual pelo departamento", () => {
  const state = seedAccessState();
  const viewer = state.users.find(user => user.access === "admin")!;
  const operator = {
    ...state.users.find(user => user.id !== viewer.id)!,
    department: "Risco e crédito" as const,
    status: "active" as const,
  };
  const operation = { ...initialOperations[0], owner: operator.name, stage: 1, nextAction: "Conferir Entrada" };
  const [row] = buildLiveOperators([viewer, operator], viewer, [operation]);
  expect(row.task).toBe(operation.nextAction);
  expect(row.screen).not.toBe("Operações · Risco");
});

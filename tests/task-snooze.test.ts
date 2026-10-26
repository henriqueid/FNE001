import { expect, it } from "vitest";
import { taskSnoozeError } from "@/src/domain/tasks/assignment";
const now = "2026-10-26T12:00:00Z";
it.each(["", "invalid", "2026-10-26T11:59:00Z", "2026-10-26T12:00:00Z", "2026-02-30T12:00:00Z"])(
  "I04 rejeita lembrete inválido ou não futuro: %s",
  value => {
    expect(taskSnoozeError(value, now)).not.toBeNull();
  },
);
it("aceita lembrete futuro válido", () => {
  expect(taskSnoozeError("2026-10-27T09:00", now)).toBeNull();
});

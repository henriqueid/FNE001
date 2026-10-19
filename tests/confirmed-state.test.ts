/** O formulário só fecha/limpa após confirmação, inclusive sob rejeição e conflito. */
import { expect, it } from "vitest";
import { confirmStateCommit } from "@/src/ui/confirmed-state";
it("aguarda persistência antes dos efeitos de sucesso", async () => {
  const events: string[] = [];
  let finish!: (value: boolean) => void;
  const pending = new Promise<boolean>(resolve => {
    finish = resolve;
  });
  const result = confirmStateCommit(
    () => pending,
    () => events.push("fechou e limpou"),
  );
  expect(events).toEqual([]);
  finish(true);
  expect(await result).toBe(true);
  expect(events).toEqual(["fechou e limpou"]);
});
it("preserva o formulário quando servidor rejeita ou falha", async () => {
  const events: string[] = [];
  expect(
    await confirmStateCommit(
      async () => false,
      () => events.push("apagou"),
    ),
  ).toBe(false);
  expect(
    await confirmStateCommit(
      async () => {
        throw new Error("conflito");
      },
      () => events.push("apagou"),
    ),
  ).toBe(false);
  expect(events).toEqual([]);
});

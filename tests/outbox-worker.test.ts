/** O processamento agendado é opcional e nunca sobrepõe ciclos no mesmo processo. */
import { afterEach, describe, expect, it, vi } from "vitest";
import { startOutboxWorker, stopOutboxWorker } from "@/src/server/outbox/worker";
describe("processamento de notificações no servidor", () => {
  afterEach(() => {
    stopOutboxWorker();
    vi.useRealTimers();
  });
  it("não inicia nem acessa banco quando desabilitado", () => {
    const run = vi.fn();
    startOutboxWorker({ enabled: false, run });
    expect(run).not.toHaveBeenCalled();
  });
  it("evita ciclos sobrepostos e libera a próxima rodada após conclusão", async () => {
    vi.useFakeTimers();
    let complete!: () => void;
    const run = vi.fn(
      () =>
        new Promise<void>(resolve => {
          complete = resolve;
        }),
    );
    startOutboxWorker({ enabled: true, intervalMs: 1000, run });
    await vi.advanceTimersByTimeAsync(3000);
    expect(run).toHaveBeenCalledTimes(1);
    complete();
    await Promise.resolve();
    await vi.advanceTimersByTimeAsync(1000);
    expect(run).toHaveBeenCalledTimes(2);
  });
  it("retoma após erro sem encerrar o processo", async () => {
    vi.useFakeTimers();
    const run = vi.fn().mockRejectedValueOnce(new Error("Falha temporária")).mockResolvedValue(undefined);
    const onError = vi.fn();
    startOutboxWorker({ enabled: true, intervalMs: 1000, run, onError });
    await vi.advanceTimersByTimeAsync(2000);
    expect(onError).toHaveBeenCalledTimes(1);
    expect(run).toHaveBeenCalledTimes(2);
  });
});

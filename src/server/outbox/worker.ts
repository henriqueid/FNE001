/** Dispara o publicador determinístico periodicamente no Node, sem credenciais no navegador. */
import { getDatabase } from "@/src/server/database/postgres";
import { publishAllDecisionOutboxes } from "./publisher";
type WorkerOptions = { enabled: boolean; intervalMs?: number; run?: () => Promise<unknown>; onError?: () => void };
const runtime = globalThis as typeof globalThis & { __stratoOutboxWorker?: ReturnType<typeof setInterval> };
export function startOutboxWorker(options: WorkerOptions) {
  if (!options.enabled || runtime.__stratoOutboxWorker) return;
  const interval = options.intervalMs ?? 30_000;
  if (!Number.isInteger(interval) || interval < 1000 || interval > 3_600_000)
    throw new Error("Intervalo de notificações inválido.");
  const run = options.run ?? (() => publishAllDecisionOutboxes(getDatabase()));
  let busy = false;
  const timer = setInterval(() => {
    if (busy) return;
    busy = true;
    void Promise.resolve()
      .then(run)
      .catch(() => {
        if (options.onError) options.onError();
        else console.error("outbox_worker_cycle_failed");
      })
      .finally(() => {
        busy = false;
      });
  }, interval);
  timer.unref?.();
  runtime.__stratoOutboxWorker = timer;
}
export function stopOutboxWorker() {
  if (runtime.__stratoOutboxWorker) clearInterval(runtime.__stratoOutboxWorker);
  delete runtime.__stratoOutboxWorker;
}

/** Inicialização do worker Node; ativação explícita pelo ambiente de implantação. */
export async function register() {
  if (process.env.STRATO_OUTBOX_WORKER_ENABLED !== "true") return;
  const { startOutboxWorker } = await import("./src/server/outbox/worker");
  startOutboxWorker({ enabled: true, intervalMs: Number(process.env.STRATO_OUTBOX_INTERVAL_MS ?? 30000) });
}

/** Virada UTC, eventos imutáveis e liquidação persistente de reservas. */
import { afterEach, expect, it, vi } from "vitest";
import {
  reserveIntelligenceTokens,
  settleIntelligenceReservation,
  loadIntelligenceState,
} from "@/src/server/intelligence/repository";
import { IntelligenceDatabase } from "./helpers/intelligence-database";
afterEach(() => vi.useRealTimers());
it("abre mês UTC, renova e não desconta reserva antiga do mês novo", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T23:59:59Z"));
  const db = new IntelligenceDatabase();
  const old = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
  vi.setSystemTime(new Date("2026-11-01T00:00:01Z"));
  await reserveIntelligenceTokens(db, "tenant-a", 50, "actor-a");
  expect(db.row.used_tokens).toBe(50);
  await old.settle(30);
  expect(db.row.used_tokens).toBe(50);
  expect(db.events.filter(event => event.event_type === "AI_BUDGET_MONTH_OPENED")).toHaveLength(2);
});
it("primeira adoção mantém consumo legado e o vincula à competência UTC", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-18T12:00:00Z"));
  const db = new IntelligenceDatabase();
  db.row.used_tokens = 80;
  const state = await loadIntelligenceState(db, "tenant-a", "actor-a");
  expect(state).toMatchObject({ usedTokens: 80, budgetPeriod: "2026-10" });
  expect(db.events[0]).toMatchObject({ actor_id: "actor-a", payload: { carriedTokens: 80, period: "2026-10" } });
});
it("uma falha do evento desfaz também a reserva", async () => {
  const db = new IntelligenceDatabase();
  db.failEvent = true;
  await expect(reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a")).rejects.toThrow();
  expect(db.row.used_tokens).toBe(0);
  expect(db.events).toHaveLength(0);
});
it("reenvio após commit ambíguo liquida uma vez e permite auditoria por chamada", async () => {
  const db = new IntelligenceDatabase();
  const reservation = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
  db.ambiguousCommit = true;
  await expect(reservation.settle(30)).rejects.toThrow();
  await settleIntelligenceReservation(db, "tenant-a", "actor-a", reservation.reservationId, 30);
  expect(db.row.used_tokens).toBe(30);
  expect(db.events.filter(event => event.event_type === "AI_TOKENS_SETTLED")).toHaveLength(1);
});
it("uma falha de liquidação mantém a reserva até reenvio confirmado", async () => {
  const db = new IntelligenceDatabase();
  const reserved = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
  db.failEvent = true;
  await expect(reserved.settle(30)).rejects.toThrow();
  expect(db.row.used_tokens).toBe(70);
  db.failEvent = false;
  await reserved.settle(30);
  expect(db.row.used_tokens).toBe(30);
});
it("contador não torna a virada mensal uma brecha para reservas concorrentes", async () => {
  vi.useFakeTimers();
  vi.setSystemTime(new Date("2026-10-31T23:59:59Z"));
  const db = new IntelligenceDatabase();
  await reserveIntelligenceTokens(db, "tenant-a", 100, "actor-a");
  vi.setSystemTime(new Date("2026-11-01T00:00:01Z"));
  const result = await Promise.allSettled([
    reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a"),
    reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a"),
  ]);
  expect(result.filter(item => item.status === "fulfilled")).toHaveLength(1);
  expect(db.row.used_tokens).toBe(70);
});
it("uso real superior à reserva é contabilizado e impede chamadas adicionais", async () => {
  const db = new IntelligenceDatabase();
  const reserved = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
  await reserved.settle(120);
  expect(db.row.used_tokens).toBe(120);
  await expect(reserveIntelligenceTokens(db, "tenant-a", 1, "actor-a")).rejects.toThrow();
});
it("liquidação exige o tenant e o ator originais e não aceita alterar consumo liquidado", async () => {
  const db = new IntelligenceDatabase();
  const reserved = await reserveIntelligenceTokens(db, "tenant-a", 70, "actor-a");
  await expect(settleIntelligenceReservation(db, "tenant-b", "actor-a", reserved.reservationId, 20)).rejects.toThrow();
  await expect(settleIntelligenceReservation(db, "tenant-a", "actor-b", reserved.reservationId, 20)).rejects.toThrow();
  await reserved.settle(30);
  await expect(reserved.settle(40)).rejects.toThrow();
  expect(db.row.used_tokens).toBe(30);
});
it("reserva recusa adaptador sem transação antes de qualquer chamada ao provedor", async () => {
  const db = new IntelligenceDatabase();
  const scoped = { prepare: db.prepare.bind(db), batch: db.batch.bind(db), exec: db.exec.bind(db) };
  await expect(reserveIntelligenceTokens(scoped, "tenant-a", 70, "actor-a")).rejects.toThrow(/transação/);
  expect(db.row.used_tokens).toBe(0);
});

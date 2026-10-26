import { afterEach, beforeAll, describe, expect, it, vi } from "vitest";
import { getDatabase } from "@/src/server/database/postgres";
import {
  loadIntelligenceState,
  reserveIntelligenceTokens,
  saveIntelligenceState,
  settleIntelligenceReservation,
} from "@/src/server/intelligence/repository";
import { loadIntelligenceBudget, saveIntelligenceBudget } from "@/src/server/intelligence/budget-configuration";
import { jsonParameter } from "@/src/server/database/postgres";
import { emptyIntelligenceState } from "@/src/domain/intelligence/model";
const isolated = process.env.STRATO_TEST_DATABASE_URL,
  actorId = "user-henrique-admin";
afterEach(() => vi.useRealTimers());
describe.skipIf(!isolated)("ledger IA em PostgreSQL novo e descartável", () => {
  beforeAll(() => {
    const url = new URL(isolated!);
    if (url.hostname !== "127.0.0.1" || url.port === "5432" || process.env.DATABASE_URL !== isolated)
      throw new Error("Exige cluster local descartável com porta dedicada.");
  });
  async function fixture() {
    const db = getDatabase(),
      tenantId = `qa-ai-${crypto.randomUUID()}`;
    await db
      .prepare("insert into private.tenants(tenant_id,legal_name,display_name) values (?,'QA IA','QA IA')")
      .bind(tenantId)
      .run();
    await saveIntelligenceState(db, tenantId, actorId, {
      ...emptyIntelligenceState(tenantId),
      contracted: true,
      enabled: true,
      status: "AI_AVAILABLE",
      monthlyTokenBudget: 100,
    });
    return { db, tenantId };
  }
  it("serializa reservas concorrentes e liquidação idempotente após reinício lógico", async () => {
    const { db, tenantId } = await fixture();
    const results = await Promise.allSettled([
      reserveIntelligenceTokens(db, tenantId, 70, actorId),
      reserveIntelligenceTokens(db, tenantId, 70, actorId),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const accepted = results.find(result => result.status === "fulfilled");
    if (accepted?.status !== "fulfilled") throw new Error("Reserva ausente");
    await Promise.all([
      settleIntelligenceReservation(db, tenantId, actorId, accepted.value.reservationId, 30),
      settleIntelligenceReservation(db, tenantId, actorId, accepted.value.reservationId, 30),
    ]);
    expect((await loadIntelligenceState(db, tenantId, actorId))?.usedTokens).toBe(30);
    const events = await db
      .prepare(
        "select event_type, actor_id, payload from private.domain_events where tenant_id = ? and aggregate_type = 'IntelligenceBudgetReservation' order by aggregate_version",
      )
      .bind(tenantId)
      .all<{ event_type: string; actor_id: string; payload: { reservedTokens: number; actualTokens?: number } }>();
    expect(events.results.map(event => event.event_type)).toEqual(["AI_TOKENS_RESERVED", "AI_TOKENS_SETTLED"]);
    expect(events.results.every(event => event.actor_id === actorId)).toBe(true);
    expect(events.results[1].payload.actualTokens).toBe(30);
  });
  it("renova competência UTC sem creditar ao novo mês reserva antiga e conserva legado", async () => {
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-10-31T23:59:59Z"));
    const { db, tenantId } = await fixture();
    await db
      .prepare("update private.intelligence_states set used_tokens = 20 where tenant_id = ?")
      .bind(tenantId)
      .run();
    const old = await reserveIntelligenceTokens(db, tenantId, 70, actorId);
    expect((await loadIntelligenceState(db, tenantId, actorId))?.usedTokens).toBe(90);
    vi.setSystemTime(new Date("2026-11-01T00:00:01Z"));
    await reserveIntelligenceTokens(db, tenantId, 50, actorId);
    await old.settle(30);
    expect(await loadIntelligenceState(db, tenantId, actorId)).toMatchObject({
      budgetPeriod: "2026-11",
      usedTokens: 50,
    });
    const markers = await db
      .prepare(
        "select payload from private.domain_events where tenant_id = ? and aggregate_type = 'IntelligenceBudgetPeriod' order by aggregate_version",
      )
      .bind(tenantId)
      .all<{ payload: { carriedTokens: number; period: string; previousUsedTokens: number } }>();
    expect(markers.results[0].payload).toMatchObject({ period: "2026-10", carriedTokens: 20 });
    expect(markers.results[1].payload).toMatchObject({ period: "2026-11", carriedTokens: 0, previousUsedTokens: 90 });
  });
  it("falha ao gravar evento reverte contador e marcador na mesma transação", async () => {
    const { db, tenantId } = await fixture();
    const suffix = crypto.randomUUID().replaceAll("-", ""),
      name = `qa_ai_fail_${suffix}`;
    await db.exec(
      `create function private.${name}() returns trigger language plpgsql as $$ begin if new.tenant_id = '${tenantId}' and new.event_type = 'AI_TOKENS_RESERVED' then raise exception 'QA evento indisponível'; end if; return new; end $$; create trigger ${name} before insert on private.domain_events for each row execute function private.${name}()`,
    );
    try {
      await expect(reserveIntelligenceTokens(db, tenantId, 70, actorId)).rejects.toThrow("QA evento indisponível");
      const row = await db
        .prepare("select used_tokens from private.intelligence_states where tenant_id = ?")
        .bind(tenantId)
        .first<{ used_tokens: string | number }>();
      expect(Number(row?.used_tokens)).toBe(0);
      const count = await db
        .prepare("select count(*)::integer as total from private.domain_events where tenant_id = ?")
        .bind(tenantId)
        .first<{ total: number }>();
      expect(count?.total).toBe(0);
    } finally {
      await db.exec(`drop trigger ${name} on private.domain_events; drop function private.${name}()`);
    }
  });
  it("cota individual usa última liquidação por reserva e preserva teto ao salvar licença antiga", async () => {
    const { db, tenantId } = await fixture();
    await db
      .prepare("insert into private.tenant_memberships(tenant_id,user_id) values (?,?)")
      .bind(tenantId, actorId)
      .run();
    await saveIntelligenceBudget(db, tenantId, actorId, {
      mode: "allocated",
      version: 0,
      monthlyTokenBudget: 100,
      allocations: [{ userId: actorId, monthlyTokenBudget: 60 }],
    });
    const results = await Promise.allSettled([
      reserveIntelligenceTokens(db, tenantId, 40, actorId),
      reserveIntelligenceTokens(db, tenantId, 40, actorId),
    ]);
    expect(results.filter(result => result.status === "fulfilled")).toHaveLength(1);
    const call = results.find(result => result.status === "fulfilled");
    if (call?.status !== "fulfilled") throw new Error("Reserva ausente");
    await call.value.settle(20);
    await call.value.settle(20);
    await saveIntelligenceState(db, tenantId, actorId, {
      ...emptyIntelligenceState(tenantId),
      contracted: true,
      enabled: true,
      status: "AI_AVAILABLE",
      monthlyTokenBudget: 999,
      persistenceVersion: (await loadIntelligenceState(db, tenantId, actorId))?.persistenceVersion,
    });
    const result = await loadIntelligenceBudget(db, tenantId, actorId);
    expect(result.policy.monthlyTokenBudget).toBe(100);
    expect(result.users.find(user => user.userId === actorId)?.usedTokens).toBe(20);
    expect(result.usedTokens).toBe(20);
  });
  it("save legado iniciado durante primeira política lê estado após adquirir lock", async () => {
    const { db, tenantId } = await fixture();
    const license = await loadIntelligenceState(db, tenantId, actorId);
    let release!: () => void, entered!: () => void;
    const ready = new Promise<void>(resolve => {
        entered = resolve;
      }),
      hold = new Promise<void>(resolve => {
        release = resolve;
      });
    const configuration = db.transaction!(async transaction => {
      await transaction
        .prepare("select tenant_id from private.intelligence_states where tenant_id = ? for update")
        .bind(tenantId)
        .first();
      await transaction
        .prepare("update private.intelligence_states set monthly_token_budget = 60 where tenant_id = ?")
        .bind(tenantId)
        .run();
      await transaction
        .prepare(
          "insert into private.domain_events(tenant_id,event_id,aggregate_type,aggregate_id,aggregate_version,event_type,actor_id,payload) values (?,?, 'IntelligenceBudgetPolicy','monthly',1,'AI_BUDGET_CONFIGURED',?,?)",
        )
        .bind(
          tenantId,
          crypto.randomUUID(),
          actorId,
          jsonParameter({ mode: "allocated", allocations: [{ userId: actorId, monthlyTokenBudget: 60 }] }),
        )
        .run();
      entered();
      await hold;
    });
    await ready;
    let completed = false;
    const legacy = saveIntelligenceState(db, tenantId, actorId, {
      ...emptyIntelligenceState(tenantId),
      monthlyTokenBudget: 999,
      persistenceVersion: license?.persistenceVersion,
    }).then(() => {
      completed = true;
    });
    try {
      await new Promise(resolve => setTimeout(resolve, 30));
      expect(completed).toBe(false);
    } finally {
      release();
      await configuration;
      await legacy;
    }
    expect((await loadIntelligenceBudget(db, tenantId, actorId)).policy.monthlyTokenBudget).toBe(60);
  });
  it("CAS de licença impede snapshot antigo de reativar configuração desligada", async () => {
    const { db, tenantId } = await fixture();
    const before = await loadIntelligenceState(db, tenantId, actorId);
    if (!before) throw new Error("Fixture IA ausente");
    const disabled = await saveIntelligenceState(db, tenantId, actorId, {
      ...before,
      contracted: false,
      enabled: false,
      status: "AI_DISABLED",
    });
    await expect(saveIntelligenceState(db, tenantId, actorId, before)).rejects.toMatchObject({ status: 409 });
    const stored = await db
      .prepare(
        "select contracted, enabled, aggregate_version, used_tokens from private.intelligence_states where tenant_id = ?",
      )
      .bind(tenantId)
      .first<{ contracted: boolean; enabled: boolean; aggregate_version: number; used_tokens: number | string }>();
    expect(stored?.contracted).toBe(false);
    expect(stored?.enabled).toBe(false);
    expect(Number(stored?.aggregate_version)).toBe(disabled.persistenceVersion);
    expect(Number(stored?.used_tokens)).toBe(before.usedTokens);
  });
});

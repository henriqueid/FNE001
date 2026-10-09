/**
 * Extrato bancário e conciliação: leitura de OFX, importação com deduplicação, conciliação automática e manual,
 * lançamento a partir do extrato e da diferença.
 */
import { DAY, type Draft, type Result, hist, nextId, patchMovement, round2, run } from "./ledger";
import { nowStamp, roleLedger, type FinanceState } from "./model";
import { createTitleDraft, settleDraft } from "./titles";

export function toggleReconcile(state: FinanceState, movementId: string, by: string): Result {
  return run(state, d => {
    const m = d.movements.find(x => x.id === movementId);
    if (!m) throw new Error("Movimento não encontrado.");
    patchMovement(
      d,
      movementId,
      { reconciled: !m.reconciled },
      hist(by, m.reconciled ? "Desconciliado" : "Conciliado", "Conferência manual com o extrato"),
    );
    return { message: m.reconciled ? "Movimento desconciliado." : "Movimento conciliado." };
  });
}

export type StatementInput = { fitid: string; date: string; amount: number; memo: string };

export function parseOfx(text: string): {
  lines: StatementInput[];
  bankId?: string;
  accountId?: string;
  ledgerBalance?: number;
} {
  const tag = (block: string, name: string) => block.match(new RegExp(`<${name}>([^<\r\n]*)`, "i"))?.[1]?.trim();
  const toIso = (v?: string) => (v && v.length >= 8 ? `${v.slice(0, 4)}-${v.slice(4, 6)}-${v.slice(6, 8)}` : "");
  const blocks = text
    .split(/<STMTTRN>/i)
    .slice(1)
    .map(b => b.split(/<\/STMTTRN>/i)[0]);
  const lines = blocks
    .map((b, i) => ({
      fitid: tag(b, "FITID") || `SEM-ID-${i + 1}`,
      date: toIso(tag(b, "DTPOSTED")),
      amount: round2(Number((tag(b, "TRNAMT") ?? "0").replace(",", "."))),
      memo: [tag(b, "NAME"), tag(b, "MEMO")].filter(Boolean).join(" · ") || "Sem histórico",
    }))
    .filter(l => l.date && l.amount);
  const bal = tag(text, "BALAMT");
  return {
    lines,
    bankId: tag(text, "BANKID"),
    accountId: tag(text, "ACCTID"),
    ledgerBalance: bal ? Number(bal.replace(",", ".")) : undefined,
  };
}

export function importStatement(
  state: FinanceState,
  accountId: string,
  lines: StatementInput[],
  file: string,
  by: string,
): Result {
  return run(state, d => {
    const account = d.accounts.find(a => a.id === accountId);
    if (!account) throw new Error("Escolha a conta do extrato.");
    d.statement = [...(d.statement ?? [])];
    let added = 0,
      dup = 0;
    lines.forEach(l => {
      if (d.statement.some(x => x.accountId === accountId && x.fitid === l.fitid)) {
        dup++;
        return;
      }
      d.statement.push({
        id: nextId(d, "EX"),
        accountId,
        fitid: l.fitid,
        date: l.date,
        amount: round2(l.amount),
        memo: l.memo,
        status: "Pendente",
        file,
        importedAt: nowStamp(),
        importedBy: by,
      });
      added++;
    });
    if (!added && dup) throw new Error(`Todas as ${dup} linhas deste arquivo já foram importadas (mesmo FITID).`);
    return {
      message: `${added} linha(s) importada(s) para ${account.nickname}${dup ? ` · ${dup} repetida(s) ignorada(s)` : ""}.`,
    };
  });
}

export function markGroup(d: Draft, lineIds: string[], movementIds: string[], by: string, how: string) {
  const group = nextId(d, "CC");
  d.statement = d.statement.map(l => (lineIds.includes(l.id) ? { ...l, status: "Conciliado", matchGroup: group } : l));
  movementIds.forEach(id =>
    patchMovement(
      d,
      id,
      { reconciled: true, matchGroup: group },
      hist(by, "Conciliado", `${how} · ${group}${lineIds.length ? ` · extrato ${lineIds.join(", ")}` : ""}`),
    ),
  );
  return group;
}

export function autoReconcile(
  state: FinanceState,
  accountId: string,
  by: string,
  opts: { toleranceDays?: number; upTo?: string } = {},
): Result {
  const tol = opts.toleranceDays ?? 3;
  return run(state, d => {
    d.statement = [...(d.statement ?? [])];
    let pairs = 0;
    const lines = d.statement
      .filter(l => l.accountId === accountId && l.status === "Pendente" && (!opts.upTo || l.date <= opts.upTo))
      .sort((a, b) => a.date.localeCompare(b.date));
    lines.forEach(line => {
      const candidates = d.movements.filter(
        m =>
          m.accountId === accountId &&
          !m.reconciled &&
          Math.abs(m.amount - line.amount) < 0.005 &&
          Math.abs(daysBetweenIso(m.date, line.date)) <= tol,
      );
      if (!candidates.length) return;
      const best = candidates.sort(
        (a, b) => Math.abs(daysBetweenIso(a.date, line.date)) - Math.abs(daysBetweenIso(b.date, line.date)),
      )[0];
      markGroup(d, [line.id], [best.id], by, "Conciliação automática (valor e data)");
      pairs++;
    });
    return {
      message: pairs
        ? `${pairs} par(es) conciliado(s) automaticamente por valor e data (±${tol} dias).`
        : "Nenhum par novo encontrado. Concilie manualmente o que sobrou.",
    };
  });
}

export function reconcileManual(state: FinanceState, lineIds: string[], movementIds: string[], by: string): Result {
  return run(state, d => {
    d.statement = [...(d.statement ?? [])];
    const lines = d.statement.filter(l => lineIds.includes(l.id));
    const moves = d.movements.filter(m => movementIds.includes(m.id));
    if (!lines.length && !moves.length) throw new Error("Selecione linhas do extrato e lançamentos do sistema.");
    if (lines.some(l => l.status !== "Pendente") || moves.some(m => m.reconciled))
      throw new Error("Algum item selecionado já está conciliado.");
    const accounts = new Set([...lines.map(l => l.accountId), ...moves.map(m => m.accountId)]);
    if (accounts.size > 1) throw new Error("Os itens precisam ser da mesma conta.");
    const bank = round2(lines.reduce((s, l) => s + l.amount, 0)),
      system = round2(moves.reduce((s, m) => s + m.amount, 0));
    if (Math.abs(bank - system) > 0.005)
      throw new Error(
        `A soma não fecha: extrato ${bank.toFixed(2)} × sistema ${system.toFixed(2)} (diferença ${(bank - system).toFixed(2)}). Lance a diferença ou ajuste a seleção.`,
      );
    if (!lines.length && Math.abs(system) > 0.005)
      throw new Error(
        "Sem linha do extrato, só é possível conciliar lançamentos que se anulam (ex.: movimento e seu estorno).",
      );
    const group = markGroup(
      d,
      lineIds,
      movementIds,
      by,
      lines.length && moves.length
        ? `Conciliação manual ${lines.length}×${moves.length}`
        : "Movimento e estorno que se anulam",
    );
    return { message: `Conciliado (${group}).` };
  });
}

export function undoReconcile(state: FinanceState, group: string, by: string): Result {
  return run(state, d => {
    d.statement = (d.statement ?? []).map(l =>
      l.matchGroup === group ? { ...l, status: "Pendente", matchGroup: undefined } : l,
    );
    d.movements
      .filter(m => m.matchGroup === group)
      .forEach(m =>
        patchMovement(d, m.id, { reconciled: false, matchGroup: undefined }, hist(by, "Desconciliado", group)),
      );
    return { message: "Conciliação desfeita. Os dois lados voltaram a pendentes." };
  });
}

export function launchFromStatement(
  state: FinanceState,
  lineId: string,
  input: { mode: "categoria" | "identificar"; categoryId?: string; description: string; counterparty: string },
  by: string,
): Result {
  return run(state, d => {
    const line = (d.statement ?? []).find(l => l.id === lineId);
    if (!line || line.status !== "Pendente") throw new Error("Linha do extrato não encontrada ou já conciliada.");
    const account = d.accounts.find(a => a.id === line.accountId)!;
    const kind = line.amount < 0 ? ("Pagar" as const) : ("Receber" as const);
    const unidentified = input.mode === "identificar";
    const id = createTitleDraft(
      d,
      {
        kind,
        origin: "Manual",
        description: input.description || line.memo,
        counterparty: input.counterparty || (unidentified ? "A identificar" : "Banco"),
        categoryId: unidentified ? undefined : input.categoryId,
        company: account.company,
        competenceDate: line.date,
        dueDate: line.date,
        amount: Math.abs(line.amount),
        settlementLedger: unidentified
          ? kind === "Receber"
            ? roleLedger(d, "refund")
            : roleLedger(d, "recover")
          : undefined,
        skipCompetence: unidentified,
      },
      by,
    );
    const acc = { ...account, usage: { ...account.usage, payments: true, receipts: true } };
    const idx = d.accounts.findIndex(a => a.id === account.id);
    d.accounts[idx] = acc; // débitos e créditos do banco entram mesmo em conta sem essa finalidade
    settleDraft(d, id, { accountId: account.id, date: line.date, method: "Extrato bancário" }, by);
    d.accounts[idx] = account;
    const movementId = d.titles.find(t => t.id === id)!.movementId!;
    markGroup(
      d,
      [line.id],
      [movementId],
      by,
      unidentified ? "Lançado como valor a identificar a partir do extrato" : "Lançado a partir do extrato",
    );
    return { message: `${id} lançado a partir do extrato e conciliado${unidentified ? " (a identificar)" : ""}.` };
  });
}

export function daysBetweenIso(a: string, b: string) {
  return Math.round((new Date(`${b}T12:00:00`).getTime() - new Date(`${a}T12:00:00`).getTime()) / DAY);
}

export function launchDifference(
  state: FinanceState,
  lineIds: string[],
  movementIds: string[],
  input: { categoryId: string; description: string },
  by: string,
): Result {
  return run(state, d => {
    const lines = (d.statement ?? []).filter(l => lineIds.includes(l.id));
    const moves = d.movements.filter(m => movementIds.includes(m.id));
    const accountId = lines[0]?.accountId ?? moves[0]?.accountId;
    const account = d.accounts.find(a => a.id === accountId);
    if (!account) throw new Error("Selecione itens de uma conta.");
    const diff = round2(lines.reduce((s, l) => s + l.amount, 0) - moves.reduce((s, m) => s + m.amount, 0));
    if (Math.abs(diff) < 0.005) throw new Error("Não há diferença para lançar.");
    const date = (lines[0] ?? moves[0]).date;
    const kind = diff < 0 ? ("Pagar" as const) : ("Receber" as const);
    const id = createTitleDraft(
      d,
      {
        kind,
        description: input.description || "Diferença de conciliação",
        counterparty: account.bankName,
        categoryId: input.categoryId,
        company: account.company,
        competenceDate: date,
        dueDate: date,
        amount: Math.abs(diff),
      },
      by,
    );
    const idx = d.accounts.findIndex(a => a.id === account.id);
    d.accounts[idx] = { ...account, usage: { ...account.usage, payments: true, receipts: true } };
    settleDraft(d, id, { accountId: account.id, date, method: "Extrato bancário" }, by);
    d.accounts[idx] = account;
    const movementId = d.titles.find(t => t.id === id)!.movementId!;
    markGroup(d, lineIds, [...movementIds, movementId], by, `Conciliação com diferença lançada em ${id}`);
    return { message: `Diferença de ${Math.abs(diff).toFixed(2)} lançada em ${id} e itens conciliados.` };
  });
}

export function suggestFor(state: FinanceState, lineId: string) {
  const line = (state.statement ?? []).find(l => l.id === lineId);
  if (!line) return [];
  return state.movements
    .filter(m => m.accountId === line.accountId && !m.reconciled)
    .map(m => ({ m, days: Math.abs(daysBetweenIso(m.date, line.date)), diff: round2(line.amount - m.amount) }))
    .filter(
      x =>
        (Math.abs(x.diff) < 0.005 && x.days <= 15) ||
        (Math.sign(x.m.amount) === Math.sign(line.amount) &&
          Math.abs(x.diff) <= Math.max(50, Math.abs(line.amount) * 0.02) &&
          x.days <= 5),
    )
    .sort((a, b) => Math.abs(a.diff) - Math.abs(b.diff) || a.days - b.days)
    .slice(0, 2);
}

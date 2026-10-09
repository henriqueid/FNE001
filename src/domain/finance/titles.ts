/**
 * Ciclo de vida do título a pagar/receber: lançar, baixar (parcial, juros, desconto), excluir, estornar,
 * prorrogar e editar. Nada é apagado: toda mudança gera contrapartida contábil e histórico.
 */
import {
  type Draft,
  type Effect,
  type Result,
  addDays,
  hist,
  nextId,
  patchMovement,
  patchTitle,
  post,
  reverseEntry,
  round2,
  run,
  todayIso,
} from "./ledger";
import { roleLedger, type FinanceState, type FinanceTitle, type JournalLine } from "./model";

export type TitleInput = {
  kind: "Pagar" | "Receber";
  description: string;
  counterparty: string;
  counterpartyDocument?: string;
  categoryId?: string;
  company: string;
  competenceDate: string;
  dueDate: string;
  amount: number;
  origin?: FinanceTitle["origin"];
  settlementLedger?: string;
  skipCompetence?: boolean;
  operationId?: string;
  payableId?: string;
  linkedTitleId?: string;
};

export function createTitleDraft(d: Draft, input: TitleInput, by: string) {
  const amount = round2(input.amount);
  if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
  if (!input.description.trim()) throw new Error("Informe a descrição do lançamento.");
  const id = nextId(d, input.kind === "Pagar" ? "CP" : "CR");
  const settlementLedger =
    input.settlementLedger ?? (input.kind === "Pagar" ? roleLedger(d, "payables") : roleLedger(d, "receivables"));
  let competenceEntryId: string | undefined;
  if (!input.skipCompetence) {
    const category = d.categories.find(c => c.id === input.categoryId);
    if (!category) throw new Error("Escolha a categoria para gerar o lançamento contábil.");
    competenceEntryId = post(
      d,
      {
        date: input.competenceDate,
        company: input.company,
        history: `${input.kind === "Pagar" ? "Despesa" : "Receita"} · ${input.description} · ${input.counterparty}`,
        lines:
          input.kind === "Pagar"
            ? [
                { ledger: category.ledgerCode, debit: amount, credit: 0 },
                { ledger: settlementLedger, debit: 0, credit: amount },
              ]
            : [
                { ledger: settlementLedger, debit: amount, credit: 0 },
                { ledger: category.ledgerCode, debit: 0, credit: amount },
              ],
        origin: { type: "Título", id },
      },
      by,
    );
  }
  d.titles.push({
    id,
    kind: input.kind,
    origin: input.origin ?? "Manual",
    description: input.description.trim(),
    counterparty: input.counterparty.trim(),
    counterpartyDocument: input.counterpartyDocument,
    categoryId: input.categoryId,
    company: input.company,
    competenceDate: input.competenceDate,
    dueDate: input.dueDate,
    amount,
    settlementLedger,
    status: "Em aberto",
    competenceEntryId,
    operationId: input.operationId,
    payableId: input.payableId,
    linkedTitleId: input.linkedTitleId,
    history: [
      hist(
        by,
        "Lançado",
        `${input.kind === "Pagar" ? "A pagar" : "A receber"} ${amount.toFixed(2)} · vencimento ${input.dueDate}${competenceEntryId ? ` · competência ${input.competenceDate} (${competenceEntryId})` : ""}`,
      ),
    ],
  });
  return id;
}

export type SettleOptions = {
  accountId: string;
  date: string;
  method: string;
  amount?: number;
  interest?: number;
  discount?: number;
};

export function settleDraft(d: Draft, titleId: string, opts: SettleOptions, by: string): Effect[] {
  let title = d.titles.find(t => t.id === titleId);
  if (!title) throw new Error("Lançamento não encontrado.");
  if (title.status !== "Em aberto") throw new Error(`${title.id}: só é possível baixar um lançamento em aberto.`);
  const account = d.accounts.find(a => a.id === opts.accountId);
  if (!account || !account.active) throw new Error(`${title.id}: escolha uma conta bancária ativa.`);
  if (account.company !== title.company)
    throw new Error(
      `${title.id}: a conta ${account.nickname} é de ${account.company}, e o lançamento é de ${title.company}.`,
    );
  if (title.kind === "Pagar" && !account.usage.payments)
    throw new Error(`${title.id}: a conta ${account.nickname} não está habilitada para pagamentos.`);
  if (title.kind === "Receber" && !account.usage.receipts)
    throw new Error(`${title.id}: a conta ${account.nickname} não está habilitada para recebimentos.`);
  const principal = round2(opts.amount ?? title.amount);
  const interest = round2(Math.max(0, opts.interest ?? 0)),
    discount = round2(Math.max(0, opts.discount ?? 0));
  if (!(principal > 0) || principal > title.amount + 0.001)
    throw new Error(`${title.id}: o valor a baixar deve ser maior que zero e até ${title.amount.toFixed(2)}.`);
  if (discount >= principal + interest) throw new Error(`${title.id}: o desconto não pode ser maior que o valor.`);
  let partial = false;
  if (principal < title.amount - 0.004) {
    // baixa parcial: o saldo vira um novo lançamento em aberto, ligado ao original
    partial = true;
    const rest = round2(title.amount - principal);
    const restId = createTitleDraft(
      d,
      {
        kind: title.kind,
        origin: title.origin,
        description: `${title.description} · saldo`,
        counterparty: title.counterparty,
        counterpartyDocument: title.counterpartyDocument,
        categoryId: title.categoryId,
        company: title.company,
        competenceDate: title.competenceDate,
        dueDate: title.dueDate,
        amount: rest,
        settlementLedger: title.settlementLedger,
        skipCompetence: true,
        operationId: title.operationId,
        payableId: title.payableId ? `${title.payableId}#saldo-${d.seq}` : undefined,
        linkedTitleId: title.id,
      },
      by,
    );
    patchTitle(
      d,
      title.id,
      { amount: principal },
      hist(by, "Baixa parcial", `Baixado ${principal.toFixed(2)} · saldo de ${rest.toFixed(2)} em ${restId}`),
    );
    title = d.titles.find(t => t.id === titleId)!;
  }
  const net = round2(principal + interest - discount);
  const movementId = nextId(d, "MV");
  const lines: JournalLine[] =
    title.kind === "Pagar"
      ? [
          { ledger: title.settlementLedger, debit: principal, credit: 0 },
          { ledger: roleLedger(d, "interestPaid"), debit: interest, credit: 0 },
          { ledger: account.ledgerCode, debit: 0, credit: net },
          { ledger: roleLedger(d, "discountsObtained"), debit: 0, credit: discount },
        ]
      : [
          { ledger: account.ledgerCode, debit: net, credit: 0 },
          { ledger: roleLedger(d, "discountsGranted"), debit: discount, credit: 0 },
          { ledger: title.settlementLedger, debit: 0, credit: principal },
          { ledger: roleLedger(d, "interestReceived"), debit: 0, credit: interest },
        ];
  const entryId = post(
    d,
    {
      date: opts.date,
      company: title.company,
      history: `${title.kind === "Pagar" ? "Pagamento" : "Recebimento"} · ${title.description} · ${title.counterparty}`,
      lines,
      origin: { type: "Movimento", id: movementId },
    },
    by,
  );
  const extras = [
    interest ? `juros/multa ${interest.toFixed(2)}` : "",
    discount ? `desconto ${discount.toFixed(2)}` : "",
  ]
    .filter(Boolean)
    .join(" · ");
  d.movements.push({
    id: movementId,
    accountId: account.id,
    date: opts.date,
    description: `${title.description} · ${title.counterparty}`,
    amount: title.kind === "Pagar" ? -net : net,
    kind: title.kind === "Pagar" ? "Saída" : "Entrada",
    titleId,
    reconciled: false,
    entryId,
    history: [hist(by, "Movimento gerado", `${opts.method} · ${account.nickname}${extras ? ` · ${extras}` : ""}`)],
  });
  patchTitle(
    d,
    titleId,
    { status: "Baixado", settledAt: opts.date, settledAccountId: account.id, method: opts.method, movementId },
    hist(
      by,
      title.kind === "Pagar" ? "Pago" : "Recebido",
      `${opts.method} · ${account.nickname} · ${opts.date} · ${movementId} · ${net.toFixed(2)}${extras ? ` (${extras})` : ""}`,
    ),
  );
  return title.operationId && title.payableId && !partial && !title.payableId.includes("#saldo")
    ? [{ operationId: title.operationId, payableKey: title.payableId, status: "Pago", paidAt: opts.date }]
    : [];
}

export function createTitle(state: FinanceState, input: TitleInput, by: string, settle?: SettleOptions): Result {
  return run(state, d => {
    const id = createTitleDraft(d, input, by);
    const effects = settle ? settleDraft(d, id, settle, by) : [];
    return {
      message: settle
        ? `${id} lançado e ${input.kind === "Pagar" ? "pago" : "recebido"}.`
        : `${id} lançado ${input.kind === "Pagar" ? "a pagar" : "a receber"}.`,
      effects,
    };
  });
}

export function settleTitle(state: FinanceState, titleId: string, opts: SettleOptions, by: string): Result {
  return run(state, d => ({ effects: settleDraft(d, titleId, opts, by), message: `${titleId} baixado.` }));
}

export function cancelDraft(d: Draft, titleId: string, reason: string, by: string, date: string, internal = false) {
  const title = d.titles.find(t => t.id === titleId);
  if (!title) throw new Error("Lançamento não encontrado.");
  if (title.status !== "Em aberto")
    throw new Error("Só é possível excluir lançamentos em aberto. Para um lançamento baixado, use o estorno.");
  if (!internal && title.origin === "Liberação de operação")
    throw new Error("Liberações de operação só são canceladas devolvendo a operação.");
  const reversal = reverseEntry(d, title.competenceEntryId, date, reason, by);
  patchTitle(
    d,
    titleId,
    { status: "Cancelado" },
    hist(by, "Excluído", `${reason}${reversal ? ` · competência estornada em ${reversal}` : ""}`),
  );
}

export function cancelTitle(state: FinanceState, titleId: string, reason: string, by: string): Result {
  if (!reason.trim()) return { state, error: "Informe o motivo da exclusão." };
  return run(state, d => {
    cancelDraft(d, titleId, reason, by, todayIso());
    return { message: `${titleId} excluído. O lançamento contábil foi estornado e o histórico preservado.` };
  });
}

export function reverseDraft(
  d: Draft,
  titleId: string,
  opts: { reason: string; cashMoved: boolean },
  by: string,
  date: string,
): Effect[] {
  const title = d.titles.find(t => t.id === titleId);
  if (!title) throw new Error("Lançamento não encontrado.");
  if (title.status !== "Baixado" || !title.movementId) throw new Error("Só é possível estornar um lançamento baixado.");
  const movement = d.movements.find(m => m.id === title.movementId);
  if (!movement) throw new Error("Movimento bancário da baixa não encontrado.");
  if (movement.reconciled)
    throw new Error("Este movimento já foi conciliado com o extrato. Desconcilie no extrato antes de estornar.");
  const effects: Effect[] =
    title.operationId && title.payableId
      ? [{ operationId: title.operationId, payableKey: title.payableId, status: "Pendente de pagamento" }]
      : [];
  if (!opts.cashMoved) {
    const reversalId = nextId(d, "MV");
    const entryId = reverseEntry(d, movement.entryId, date, opts.reason, by);
    d.movements.push({
      id: reversalId,
      accountId: movement.accountId,
      date,
      description: `Estorno · ${movement.description}`,
      amount: -movement.amount,
      kind: "Estorno",
      titleId,
      reversalOf: movement.id,
      reconciled: false,
      entryId,
      history: [hist(by, "Estorno", opts.reason)],
    });
    patchMovement(d, movement.id, { reversedBy: reversalId }, hist(by, "Estornado", `${reversalId} · ${opts.reason}`));
    patchTitle(
      d,
      titleId,
      {
        status: "Em aberto",
        settledAt: undefined,
        settledAccountId: undefined,
        method: undefined,
        movementId: undefined,
      },
      hist(by, "Baixa estornada", `Valor não tinha saído/entrado do caixa · movimento ${reversalId} · ${opts.reason}`),
    );
    return effects;
  }
  // O dinheiro já saiu (ou entrou): o banco não muda. O valor vira um direito a recuperar ou uma obrigação de devolver.
  const account = d.accounts.find(a => a.id === movement.accountId);
  const original = d.journal.find(j => j.id === movement.entryId);
  const recoveryLedger = title.kind === "Pagar" ? roleLedger(d, "recover") : roleLedger(d, "refund");
  const cash = Math.abs(movement.amount);
  const lines = (original?.lines ?? []).map(l => ({
    ledger: l.ledger === account?.ledgerCode ? recoveryLedger : l.ledger,
    debit: l.credit,
    credit: l.debit,
  }));
  const entryId = post(
    d,
    {
      date,
      company: title.company,
      history: `Estorno de ${title.kind === "Pagar" ? "pagamento com valor já pago" : "recebimento com valor já recebido"} · ${title.description} · ${opts.reason}`,
      lines,
      origin: { type: "Título", id: title.id },
    },
    by,
  );
  const linkedId = createTitleDraft(
    d,
    title.kind === "Pagar"
      ? {
          kind: "Receber",
          origin: "Recuperação de pagamento",
          description: `Recuperar pagamento · ${title.description}`,
          counterparty: title.counterparty,
          counterpartyDocument: title.counterpartyDocument,
          company: title.company,
          competenceDate: date,
          dueDate: addDays(date, 5),
          amount: cash,
          settlementLedger: recoveryLedger,
          skipCompetence: true,
          linkedTitleId: title.id,
        }
      : {
          kind: "Pagar",
          origin: "Devolução de recebimento",
          description: `Devolver valor recebido · ${title.description}`,
          counterparty: title.counterparty,
          counterpartyDocument: title.counterpartyDocument,
          company: title.company,
          competenceDate: date,
          dueDate: addDays(date, 2),
          amount: cash,
          settlementLedger: recoveryLedger,
          skipCompetence: true,
          linkedTitleId: title.id,
        },
    by,
  );
  patchMovement(
    d,
    movement.id,
    {},
    hist(
      by,
      title.kind === "Pagar"
        ? "Pagamento estornado sem devolução bancária"
        : "Recebimento estornado sem devolução bancária",
      `${linkedId} criado · ${entryId}`,
    ),
  );
  patchTitle(
    d,
    titleId,
    {
      status: "Em aberto",
      settledAt: undefined,
      settledAccountId: undefined,
      method: undefined,
      movementId: undefined,
    },
    hist(
      by,
      "Baixa estornada",
      `Valor já ${title.kind === "Pagar" ? "tinha saído do" : "estava no"} caixa · ${title.kind === "Pagar" ? "recuperação" : "devolução"} em ${linkedId} · ${opts.reason}`,
    ),
  );
  return effects;
}

export function reverseSettlement(
  state: FinanceState,
  titleId: string,
  opts: { reason: string; cashMoved: boolean },
  by: string,
): Result {
  if (!opts.reason.trim()) return { state, error: "Informe o motivo do estorno." };
  return run(state, d => ({
    effects: reverseDraft(d, titleId, opts, by, todayIso()),
    message: opts.cashMoved
      ? `Baixa de ${titleId} estornada. O banco não foi alterado e foi criado um lançamento para ${d.titles.find(t => t.id === titleId)?.kind === "Pagar" ? "recuperar" : "devolver"} o valor.`
      : `Baixa de ${titleId} estornada e movimento bancário revertido.`,
  }));
}

export function rescheduleTitles(
  state: FinanceState,
  ids: string[],
  opts: { newDate?: string; days?: number; reason: string },
  by: string,
): Result {
  if (!opts.reason.trim()) return { state, error: "Informe o motivo da alteração de vencimento." };
  return run(state, d => {
    let n = 0;
    ids.forEach(id => {
      const t = d.titles.find(x => x.id === id);
      if (!t || t.status !== "Em aberto") return;
      const due = opts.newDate || addDays(t.dueDate, opts.days ?? 0);
      patchTitle(d, id, { dueDate: due }, hist(by, "Vencimento alterado", `${t.dueDate} → ${due} · ${opts.reason}`));
      n++;
    });
    if (!n) throw new Error("Nenhum lançamento em aberto selecionado.");
    return { message: `${n} vencimento(s) alterado(s).` };
  });
}

export function editTitle(
  state: FinanceState,
  id: string,
  changes: Partial<
    Pick<
      FinanceTitle,
      "description" | "counterparty" | "counterpartyDocument" | "categoryId" | "competenceDate" | "dueDate" | "amount"
    >
  >,
  reason: string,
  by: string,
): Result {
  if (!reason.trim()) return { state, error: "Informe o motivo da alteração." };
  return run(state, d => {
    const t = d.titles.find(x => x.id === id);
    if (!t) throw new Error("Lançamento não encontrado.");
    if (t.status !== "Em aberto") throw new Error("Só é possível editar lançamentos em aberto. Estorne a baixa antes.");
    if (t.origin === "Liberação de operação" && changes.amount !== undefined && changes.amount !== t.amount)
      throw new Error("O valor de uma liberação só muda devolvendo a operação.");
    const amount = changes.amount !== undefined ? round2(changes.amount) : t.amount;
    if (!(amount > 0)) throw new Error("Informe um valor maior que zero.");
    const accountingChanged =
      t.competenceEntryId &&
      (amount !== t.amount ||
        (changes.categoryId && changes.categoryId !== t.categoryId) ||
        (changes.competenceDate && changes.competenceDate !== t.competenceDate));
    let competenceEntryId = t.competenceEntryId;
    const next = { ...t, ...changes, amount };
    if (accountingChanged) {
      reverseEntry(d, t.competenceEntryId, todayIso(), `Alteração de ${t.id}: ${reason}`, by);
      const category = d.categories.find(c => c.id === next.categoryId);
      if (!category) throw new Error("Escolha a categoria.");
      competenceEntryId = post(
        d,
        {
          date: next.competenceDate,
          company: t.company,
          history: `${t.kind === "Pagar" ? "Despesa" : "Receita"} (alterada) · ${next.description} · ${next.counterparty}`,
          lines:
            t.kind === "Pagar"
              ? [
                  { ledger: category.ledgerCode, debit: amount, credit: 0 },
                  { ledger: t.settlementLedger, debit: 0, credit: amount },
                ]
              : [
                  { ledger: t.settlementLedger, debit: amount, credit: 0 },
                  { ledger: category.ledgerCode, debit: 0, credit: amount },
                ],
          origin: { type: "Título", id: t.id },
        },
        by,
      );
    }
    const changed = (Object.keys(changes) as (keyof typeof changes)[])
      .filter(k => changes[k] !== undefined && changes[k] !== t[k])
      .map(k => `${k}: ${String(t[k] ?? "—")} → ${String(changes[k])}`)
      .join(" · ");
    patchTitle(
      d,
      id,
      { ...changes, amount, competenceEntryId },
      hist(
        by,
        "Alterado",
        `${changed || "sem mudanças"}${accountingChanged ? ` · competência relançada em ${competenceEntryId}` : ""} · ${reason}`,
      ),
    );
    return {
      message: `${id} alterado${accountingChanged ? " e contabilidade ajustada por estorno e novo lançamento" : ""}.`,
    };
  });
}

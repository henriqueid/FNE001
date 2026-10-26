/** Prepara obrigação financeira e fechamento comercial como resultado único. */
import type { FinanceState } from "@/src/domain/finance/model";
import { addCategory, addChartAccount } from "@/src/domain/finance/setup";
import { createTitle } from "@/src/domain/finance/titles";
import { monthEnd, monthLabel, round2, shiftMonth, stamp } from "./calendar";
import type { CommercialState } from "./types";

export function prepareCommissionTransfer(
  finance: FinanceState,
  commercial: CommercialState,
  month: string,
  today: string,
  actor: string,
) {
  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(month)) throw new Error("Competência inválida.");
  const closing = commercial.closings[month];
  if (!closing || closing.month !== month) throw new Error("Feche a competência antes de enviar ao Financeiro.");
  if (closing.status === "Enviada ao financeiro") {
    if (!closing.financeTitles || closing.financeTitles.some(id => !finance.titles.some(title => title.id === id)))
      throw new Error("O fechamento enviado possui vínculo financeiro inconsistente. Solicite revisão.");
    return { finance, commercial, replayed: true };
  }
  if (closing.status !== "Fechada") throw new Error("Situação do fechamento inválida.");
  const seen = new Set<string>();
  for (const line of closing.lines) {
    if (seen.has(line.repId)) throw new Error("Representante duplicado no fechamento.");
    seen.add(line.repId);
    if (
      [
        line.base,
        line.goal,
        line.attainment,
        line.rate,
        line.commission,
        line.bonus,
        line.clawback,
        line.total,
        line.deals,
      ].some(value => !Number.isFinite(value))
    )
      throw new Error("Valor de comissão inválido.");
    if (
      !Array.isArray(line.bonusAccounts) ||
      line.commission !== round2((line.base * line.rate) / 100) ||
      line.bonus !== round2(line.bonusAccounts.length * closing.rules.newAccountBonus) ||
      line.total !== round2(line.commission + line.bonus - line.clawback)
    )
      throw new Error("A memória de cálculo da comissão está inconsistente.");
    if (!commercial.reps.some(rep => rep.id === line.repId)) throw new Error("Representante não encontrado.");
  }
  let next = finance;
  const step = (result: { state: FinanceState; error?: string }) => {
    if (result.error) throw new Error(result.error);
    next = result.state;
  };
  let category = next.categories.find(item => /comiss/i.test(item.name) && item.kind === "Despesa");
  if (!category) {
    let ledger = next.chart.find(item => item.analytic && item.nature === "Despesa" && /comiss/i.test(item.name));
    if (!ledger && next.chartOrigin !== "importado" && !next.chart.some(item => item.code === "5.1.12")) {
      step(addChartAccount(next, { code: "5.1.12", name: "Comissões comerciais", nature: "Despesa" }));
      ledger = next.chart.find(item => item.code === "5.1.12");
    }
    ledger ??=
      next.chart.find(item => item.analytic && item.nature === "Despesa" && /terceiros/i.test(item.name)) ??
      next.chart.find(item => item.analytic && item.nature === "Despesa");
    if (!ledger) throw new Error("O plano de contas não tem conta analítica de despesa para a comissão.");
    step(
      addCategory(next, { name: "Comissões comerciais", kind: "Despesa", ledgerCode: ledger.code, group: "Comercial" }),
    );
    category = next.categories.find(item => item.name === "Comissões comerciais");
  }
  const due = `${shiftMonth(month, 1)}-10`;
  const before = new Set(next.titles.map(title => title.id));
  for (const line of closing.lines.filter(item => item.total > 0)) {
    const rep = commercial.reps.find(item => item.id === line.repId)!;
    step(
      createTitle(
        next,
        {
          kind: "Pagar",
          description: `Comissão ${monthLabel(month)} · ${rep.name}`,
          counterparty: rep.name,
          counterpartyDocument: rep.document,
          categoryId: category!.id,
          company: rep.company,
          competenceDate: monthEnd(month),
          dueDate: due < today ? today : due,
          amount: line.total,
        },
        actor,
      ),
    );
  }
  const ids = next.titles.filter(title => !before.has(title.id)).map(title => title.id);
  return {
    finance: next,
    commercial: {
      ...commercial,
      closings: {
        ...commercial.closings,
        [month]: { ...closing, status: "Enviada ao financeiro" as const, sentAt: stamp(), financeTitles: ids },
      },
    },
    replayed: false,
  };
}

import type { FinanceState } from "./model";

const unique = (values: string[]) => new Set(values).size === values.length;
const money = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;

export function validateFinanceState(state: FinanceState): string | null {
  if (state.version !== 1) return "Versão do estado financeiro não suportada.";
  if (!Number.isInteger(state.seq) || state.seq < 0) return "Sequência financeira inválida.";
  if (!unique(state.chart.map(account => account.code))) return "Há códigos duplicados no plano de contas.";
  if (!unique(state.accounts.map(account => account.id))) return "Há contas bancárias duplicadas.";
  if (!unique(state.categories.map(category => category.id))) return "Há categorias financeiras duplicadas.";
  if (!unique(state.titles.map(title => title.id))) return "Há títulos financeiros duplicados.";
  if (!unique(state.movements.map(movement => movement.id))) return "Há movimentos bancários duplicados.";
  if (!unique(state.journal.map(entry => entry.id))) return "Há lançamentos contábeis duplicados.";
  if (!unique((state.statement ?? []).map(line => line.id))) return "Há linhas de extrato duplicadas.";

  const accountIds = new Set(state.accounts.map(account => account.id));
  const titleIds = new Set(state.titles.map(title => title.id));
  const journalIds = new Set(state.journal.map(entry => entry.id));
  for (const movement of state.movements) {
    if (!accountIds.has(movement.accountId)) return `Conta bancária ausente no movimento ${movement.id}.`;
    if (movement.titleId && !titleIds.has(movement.titleId)) return `Título ausente no movimento ${movement.id}.`;
    if (movement.entryId && !journalIds.has(movement.entryId)) return `Lançamento ausente no movimento ${movement.id}.`;
  }
  for (const line of state.statement ?? [])
    if (!accountIds.has(line.accountId)) return `Conta bancária ausente na linha de extrato ${line.id}.`;

  for (const entry of state.journal) {
    if (entry.lines.length < 2) return `Lançamento ${entry.id} precisa de ao menos duas partidas.`;
    const debit = money(entry.lines.reduce((sum, line) => sum + line.debit, 0));
    const credit = money(entry.lines.reduce((sum, line) => sum + line.credit, 0));
    if (debit !== credit) return `Lançamento ${entry.id} desbalanceado: débito ${debit} × crédito ${credit}.`;
    if (entry.lines.some(line => line.debit < 0 || line.credit < 0 || (line.debit > 0 && line.credit > 0)))
      return `Lançamento ${entry.id} contém partida inválida.`;
    if (entry.reversalOf && !journalIds.has(entry.reversalOf)) return `Origem do estorno ${entry.id} não encontrada.`;
    if (entry.reversedBy && !journalIds.has(entry.reversedBy))
      return `Contrapartida do lançamento ${entry.id} não encontrada.`;
  }
  return null;
}

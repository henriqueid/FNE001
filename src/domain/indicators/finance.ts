/**
 * Indicadores financeiros do mês: DRE gerencial (receitas, despesas, resultado e margem),
 * spread da taxa de compra sobre o custo de captação e giro (volume comprado ÷ saldo médio).
 */
import { type FinanceState } from "@/src/domain/finance/model";
import { incomeStatement } from "@/src/domain/finance/reports";

export function financeIndicators(
  state: FinanceState,
  scope: string,
  from: string,
  to: string,
  purchaseRate: number,
  fundingCostMonthly: number,
  volumeBought: number,
  averageBalance: number,
) {
  const dre = incomeStatement(state, scope, from, to);
  return {
    revenue: dre.totalRevenue,
    expense: dre.totalExpense,
    result: dre.result,
    margin: dre.totalRevenue ? (dre.result / dre.totalRevenue) * 100 : 0,
    topRevenues: [...dre.revenues].sort((a, b) => b.value - a.value).slice(0, 3),
    topExpenses: [...dre.expenses].sort((a, b) => b.value - a.value).slice(0, 3),
    spread: purchaseRate ? purchaseRate - fundingCostMonthly : 0,
    fundingCost: fundingCostMonthly,
    turnover: averageBalance ? volumeBought / averageBalance : 0,
  };
}

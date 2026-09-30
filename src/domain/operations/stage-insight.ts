/**
 * Diagnóstico calculado de cada etapa (o que falta, métricas e resultado) e registro de conclusão das etapas.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { type AutomationBreakdown } from "./automation";
import { operationDateISO } from "./dates";
import { formatFlowMoney } from "./format";
import { lastroAssessmentFor } from "./lastro";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "./pricing";

export function stageInsightFor(operation: Operation, stageId: number, automation: AutomationBreakdown) {
  const entries = operation.manualEntry?.entries ?? [];
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const discount = entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
  const debtorTotals = entries.reduce<Record<string, number>>((totals, entry) => {
    const key = entry.debtorName || "Sem sacado";
    totals[key] = (totals[key] ?? 0) + entry.amount;
    return totals;
  }, {});
  const largestDebtor = Object.entries(debtorTotals).sort((a, b) => b[1] - a[1])[0];
  const concentration = total > 0 && largestDebtor ? (largestDebtor[1] / total) * 100 : 0;
  const evidenceCount = entries.filter(entry =>
    operation.manualEntry?.receivableType === "Duplicata"
      ? Boolean(entry.nfeKey)
      : operation.manualEntry?.receivableType === "Cheque"
        ? Boolean(entry.cmc7)
        : Boolean(entry.documentNumber),
  ).length;
  const averageTerm = entries.length
    ? Math.round(
        entries.reduce((sum, entry) => {
          const start = entry.issueDate ? new Date(`${entry.issueDate}T12:00:00`) : new Date();
          const end = entry.dueDate ? new Date(`${entry.dueDate}T12:00:00`) : start;
          return sum + Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
        }, 0) / entries.length,
      )
    : 0;
  const stageState =
    stageId < operation.stage ? "Concluída" : stageId === operation.stage ? "Etapa atual" : "Prévia calculada";
  const common = {
    state: stageState,
    source: entries.length
      ? `Calculado sobre ${entries.length} título${entries.length === 1 ? "" : "s"} da entrada`
      : "Aguardando títulos na entrada",
  };
  if (stageId === 2)
    return {
      ...common,
      title: "Risco calculado com a carteira digitada",
      description: "Concentração, quantidade de sacados e prazo são recalculados sempre que um título muda.",
      metrics: [
        {
          label: "MAIOR CONCENTRAÇÃO",
          value: entries.length ? `${concentration.toFixed(1).replace(".", ",")}%` : "—",
          detail: largestDebtor?.[0] ?? "Sem sacado",
        },
        {
          label: "SACADOS",
          value: String(Object.keys(debtorTotals).length),
          detail: `${entries.length} recebíveis analisados`,
        },
        { label: "PRAZO MÉDIO", value: entries.length ? `${averageTerm} dias` : "—", detail: "Emissão até vencimento" },
      ],
      result:
        concentration > 20
          ? "Intervenção: concentração acima da referência de 20%."
          : entries.length
            ? "Sem alerta de concentração pela referência atual."
            : "Inclua títulos para calcular o risco.",
      tone: concentration > 20 ? "warning" : "positive",
    };
  if (stageId === 3) {
    const lastro = lastroAssessmentFor(operation);
    return {
      ...common,
      state: !lastro.ready && stageId < operation.stage ? "Revisão necessária" : common.state,
      title: "Lastro, evidências e confirmação",
      description: "A cobertura documental e a amostra de confirmação são recalculadas conforme o risco da operação.",
      metrics: [
        {
          label: "COBERTURA",
          value: entries.length ? `${Math.round((lastro.evidenceValid / entries.length) * 100)}%` : "—",
          detail: `${lastro.evidenceValid} de ${entries.length} evidências validadas`,
        },
        { label: "AMOSTRA", value: String(lastro.sampleSize), detail: `${lastro.confirmed} confirmações positivas` },
        {
          label: "DIVERGÊNCIAS",
          value: String(lastro.divergences),
          detail: lastro.divergences ? "Exigem intervenção" : "Nenhuma divergência registrada",
        },
      ],
      result: lastro.ready
        ? "Lastro concluído e amostra confirmada."
        : "Existem títulos aguardando evidência ou confirmação.",
      tone: lastro.ready ? "positive" : "warning",
    };
  }
  if (stageId === 4) {
    const pricing = normalizedPricing(operation);
    const calculated = pricingCalculation(operation, pricing);
    const repurchase = repurchaseCalculation(operation, pricing);
    const adjustments = settlementAdjustmentCalculation(operation, pricing);
    const offsets = repurchase.total + adjustments.total;
    const finalNet = roundPricing(calculated.net - offsets);
    return {
      ...common,
      state: operation.pricingReview?.status === "Condição salva" ? stageState : "Simulação",
      title: "Preço e estrutura financeira",
      description:
        "Deságio, tarifas, retenções, recompras, compensações e custo de capital calculados sobre o fluxo dos títulos.",
      metrics: [
        {
          label: "VALOR LÍQUIDO",
          value: preciseMoney.format(finalNet),
          detail: offsets
            ? `${formatFlowMoney(-offsets)} de efeito da recompra e compensações`
            : `${entries.length} títulos · ${Math.round(calculated.weightedTerm)} dias médios`,
        },
        {
          label: "TAXA EFETIVA FINAL",
          value: `${calculated.allInMonthly.toFixed(2).replace(".", ",")}% a.m.`,
          detail: `Taxa base ${pricing.monthlyRate.toFixed(2).replace(".", ",")}% a.m.`,
        },
        {
          label: "SPREAD PROJETADO",
          value: `${calculated.spread.toFixed(2).replace(".", ",")}% a.m.`,
          detail: `Custo de capital ${pricing.fundingCostMonthly.toFixed(2).replace(".", ",")}% a.m.`,
        },
      ],
      result:
        operation.pricingReview?.status === "Condição salva"
          ? "Condição comercial salva e disponível para aprovação."
          : "Simulação ainda não salva como condição da operação.",
      tone: operation.pricingReview?.status === "Condição salva" ? "positive" : "warning",
    };
  }
  if (stageId === 5) {
    const ready = [
      entries.length > 0,
      operation.blockers === 0,
      evidenceCount === entries.length,
      automation.score >= 70,
    ];
    const done = ready.filter(Boolean).length;
    return {
      ...common,
      title: "Prontidão para aprovação e formalização",
      description: "A etapa consolida carteira, risco, lastro e automação antes das alçadas.",
      metrics: [
        { label: "REQUISITOS", value: `${done}/4`, detail: "Carteira, bloqueios, lastro e automação" },
        {
          label: "BLOQUEIOS",
          value: String(operation.blockers),
          detail: operation.blockers ? "Exigem decisão" : "Nenhum bloqueio aberto",
        },
        { label: "AUTOMAÇÃO ASSISTIDA", value: `${automation.score}%`, detail: "Não representa avanço da esteira" },
      ],
      result:
        done === 4 ? "Pacote apto para seguir às alçadas e assinaturas." : "Ainda há requisitos anteriores a concluir.",
      tone: done === 4 ? "positive" : "warning",
    };
  }
  if (stageId === 6)
    return {
      ...common,
      title: "Liberação bloqueada até a formalização",
      description: "Favorecidos e envio ao financeiro ficam disponíveis após a aprovação e as assinaturas.",
      metrics: [
        {
          label: "VALOR PROJETADO",
          value: preciseMoney.format(Math.max(0, total - discount)),
          detail: "Antes de tarifas e impostos",
        },
        { label: "RECEBÍVEIS", value: String(entries.length), detail: "Ativos a registrar" },
        {
          label: "STATUS",
          value: operation.stage >= 6 ? "Liberada" : "Aguardando",
          detail: operation.stage >= 6 ? "Formalização concluída" : "Depende das etapas anteriores",
        },
      ],
      result:
        operation.stage >= 6
          ? "Pronta para registro, pagamento e conciliação."
          : "Esta etapa permanece bloqueada até a aprovação e formalização.",
      tone: operation.stage >= 6 ? "positive" : "neutral",
    };
  return {
    ...common,
    title: "Entrada consolidada",
    description: "Os dados digitados alimentam automaticamente as etapas seguintes.",
    metrics: [
      {
        label: "TÍTULOS",
        value: String(entries.length),
        detail: operation.manualEntry?.receivableType ?? "Tipo não definido",
      },
      {
        label: "VALOR DE FACE",
        value: preciseMoney.format(total),
        detail: `${Object.keys(debtorTotals).length} sacados`,
      },
      { label: "AUTOMAÇÃO ASSISTIDA", value: `${automation.score}%`, detail: "Calculada pela qualidade dos dados" },
    ],
    result: entries.length
      ? "Entrada disponível para as análises seguintes."
      : "Inclua títulos para iniciar as análises.",
    tone: entries.length ? "positive" : "neutral",
  };
}

export function stageCompletionFor(operation: Operation, stageId: number) {
  const recorded = operation.stageCompletions?.find(item => item.stageId === stageId);
  if (recorded) return recorded;
  if (stageId >= operation.stage) return undefined;
  const date = new Date(
    `${operationDateISO(operation)}T${String(Math.min(17, 8 + stageId)).padStart(2, "0")}:${String((stageId * 11) % 60).padStart(2, "0")}:00`,
  );
  return {
    stageId,
    completedBy: operation.owner,
    completedAt: new Intl.DateTimeFormat("pt-BR", {
      dateStyle: "short",
      timeStyle: "short",
      timeZone: "America/Sao_Paulo",
    }).format(date),
  };
}

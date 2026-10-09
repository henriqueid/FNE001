import { type Cedent, type Debtor, type ManualEntry, type Operation } from "@/src/domain/core/types";
import { runEligibilityEngine } from "./engine";
import { masterRuleCatalog } from "./master-rule-catalog";
import { demoPoliciesFor } from "./demo-policy";
import { type EligibilityPolicy, type EligibilitySubject } from "./model";
import { resolvePolicyRules } from "./policy-resolver";

const digits = (value: string) => value.replace(/\D/g, "");

function termDays(title: ManualEntry, asOf: string) {
  if (!title.dueDate) return null;
  const due = new Date(`${title.dueDate}T12:00:00`).getTime();
  const base = new Date(`${asOf}T12:00:00`).getTime();
  return Math.ceil((due - base) / 86_400_000);
}

function titleSubjects(
  operation: Operation,
  entries: ManualEntry[],
  debtors: Debtor[],
  asOf: string,
): EligibilitySubject[] {
  const occurrences = entries.reduce<Record<string, number>>((result, title) => {
    const key = title.documentNumber.trim().toLocaleLowerCase();
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  return entries.map(title => {
    const registered = debtors.find(
      item => item.id === title.debtorId || digits(item.document) === digits(title.debtorDocument),
    );
    const confirmation = operation.lastroReview?.items?.[title.id]?.confirmation ?? "Pendente";
    return {
      id: title.id,
      level: "TITULO",
      label: `Título ${title.documentNumber}`,
      facts: {
        faceAmount: title.amount,
        termDays: termDays(title, asOf),
        duplicateInOperation: occurrences[title.documentNumber.trim().toLocaleLowerCase()] > 1,
        hasFiscalEvidence: Boolean(title.nfeKey?.trim()),
        issueDatePresent: Boolean(title.issueDate),
        documentNumberPresent: Boolean(title.documentNumber.trim()),
        debtorDocumentPresent: digits(title.debtorDocument).length >= 11,
        confirmationStatus: confirmation,
        debtorState: title.state || registered?.state || null,
        receivableType: operation.manualEntry?.receivableType ?? null,
      },
      evidence: {
        faceAmount: `Entrada da operação · valor ${title.amount}`,
        termDays: `Vencimento ${title.dueDate || "não informado"} · data-base ${asOf}`,
        duplicateInOperation: `Documento ${title.documentNumber} na carteira disponível da operação`,
        hasFiscalEvidence: title.nfeKey ? `Chave NF-e ${title.nfeKey}` : "Campo de chave NF-e vazio",
        issueDatePresent: title.issueDate ? `Emissão ${title.issueDate}` : "Data de emissão não informada",
        documentNumberPresent: title.documentNumber || "Número do documento não informado",
        debtorDocumentPresent: title.debtorDocument || "CPF/CNPJ do sacado não informado",
        confirmationStatus: `Checagem registrada como ${confirmation}`,
        debtorState: title.state || registered?.state || "UF do sacado não disponível",
        receivableType: operation.manualEntry?.receivableType ?? "Tipo do recebível não informado",
      },
    };
  });
}

function debtorSubjects(operation: Operation, entries: ManualEntry[], debtors: Debtor[]): EligibilitySubject[] {
  const grouped = entries.reduce<Record<string, { id: string; name: string; document: string; amount: number }>>(
    (result, title) => {
      const key = title.debtorId || digits(title.debtorDocument) || title.debtorName;
      const current = result[key] ?? { id: key, name: title.debtorName, document: title.debtorDocument, amount: 0 };
      current.amount += title.amount;
      result[key] = current;
      return result;
    },
    {},
  );
  const currentPortfolio = debtors.reduce((total, debtor) => total + (debtor.portfolioReceivable ?? 0), 0);
  const projectedPortfolio = currentPortfolio + operation.amount;
  const operationByGroup = Object.values(grouped).reduce<Record<string, number>>((result, group) => {
    const registered = debtors.find(item => item.id === group.id || digits(item.document) === digits(group.document));
    const key = registered?.groupName || registered?.id || group.id;
    result[key] = (result[key] ?? 0) + group.amount;
    return result;
  }, {});
  return Object.values(grouped).map(group => {
    const registered = debtors.find(item => item.id === group.id || digits(item.document) === digits(group.document));
    const concentration = operation.amount > 0 ? (group.amount / operation.amount) * 100 : null;
    const projectedExposure = (registered?.portfolioReceivable ?? 0) + group.amount;
    const portfolioConcentration = projectedPortfolio > 0 ? (projectedExposure / projectedPortfolio) * 100 : null;
    const groupKey = registered?.groupName || registered?.id || group.id;
    const projectedGroupExposure =
      (registered?.groupExposure ?? registered?.portfolioReceivable ?? 0) + operationByGroup[groupKey];
    const groupConcentration = projectedPortfolio > 0 ? (projectedGroupExposure / projectedPortfolio) * 100 : null;
    const overduePercent = registered?.portfolioReceivable
      ? ((registered.portfolioOverdue ?? 0) / registered.portfolioReceivable) * 100
      : registered
        ? 0
        : null;
    return {
      id: group.id,
      level: "SACADO",
      label: registered?.name ?? group.name,
      facts: {
        operationConcentrationPercent: concentration,
        portfolioConcentrationPercent: portfolioConcentration,
        groupConcentrationPercent: groupConcentration,
        externalScore: registered?.bureauScore ?? null,
        internalScore: registered?.score ?? null,
        averageDelayDays: registered?.averageDelayDays ?? null,
        overduePercent,
        restrictionCount: registered?.incidents ?? null,
      },
      evidence: {
        operationConcentrationPercent: `${group.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        portfolioConcentrationPercent: `Exposição projetada ${projectedExposure.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira projetada ${projectedPortfolio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        groupConcentrationPercent: `Grupo ${registered?.groupName ?? registered?.name ?? group.name} projetado em ${projectedGroupExposure.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
        externalScore: registered
          ? `Score de bureau ${registered.bureauScore ?? "não disponível"}`
          : "Sacado não localizado",
        internalScore: registered ? `Score interno ${registered.score ?? "não disponível"}` : "Sacado não localizado",
        averageDelayDays: registered
          ? `Atraso médio ${registered.averageDelayDays ?? "não disponível"} dia(s)`
          : "Histórico não localizado",
        overduePercent: registered
          ? `Vencido ${(registered.portfolioOverdue ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira ${(registered.portfolioReceivable ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
          : "Histórico não localizado",
        restrictionCount: registered
          ? `${registered.incidents ?? 0} ocorrência(s) cadastrada(s)`
          : "Bureau não disponível",
      },
    };
  });
}

function cedentSubject(operation: Operation, cedent?: Cedent): EligibilitySubject {
  const projected = cedent?.creditLimit ? ((cedent.usedLimit + operation.amount) / cedent.creditLimit) * 100 : null;
  return {
    id: cedent?.id ?? `cedent:${digits(operation.document)}`,
    level: "CEDENTE",
    label: cedent?.name ?? operation.cedent,
    facts: {
      projectedLimitUsagePercent: projected,
      externalScore: cedent?.bureauScore ?? null,
      internalScore: cedent?.score ?? null,
      averageDelayDays: cedent?.averageDelayDays ?? null,
      repurchasePercent: cedent?.settlements ? (cedent.repurchases / cedent.settlements) * 100 : null,
      restrictionCount: cedent?.incidents ?? null,
    },
    evidence: {
      projectedLimitUsagePercent: cedent
        ? `Utilizado ${cedent.usedLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} + operação ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre limite ${cedent.creditLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cedente não localizado no cadastro atual",
      externalScore: cedent ? `Score de bureau ${cedent.bureauScore ?? "não disponível"}` : "Cedente não localizado",
      internalScore: cedent ? `Score interno ${cedent.score}` : "Cedente não localizado",
      averageDelayDays: cedent ? `Atraso médio ${cedent.averageDelayDays} dia(s)` : "Histórico não localizado",
      repurchasePercent: cedent
        ? `${cedent.repurchases} recompra(s) em ${cedent.settlements} liquidação(ões)`
        : "Histórico não localizado",
      restrictionCount: cedent ? `${cedent.incidents} ocorrência(s) cadastrada(s)` : "Bureau não disponível",
    },
  };
}

function operationSubject(operation: Operation, entries: ManualEntry[], asOf: string): EligibilitySubject {
  const titleTotal = entries.reduce((total, title) => total + title.amount, 0);
  const titlesMatchGrossAmount = entries.length > 0 && Math.abs(titleTotal - operation.amount) < 0.01;
  const netAmountValid = operation.netAmount >= 0 && operation.netAmount <= operation.amount;
  const weightedTerms = entries.reduce(
    (result, title) => {
      const days = termDays(title, asOf);
      return days == null
        ? result
        : { amount: result.amount + title.amount, weighted: result.weighted + title.amount * days };
    },
    { amount: 0, weighted: 0 },
  );
  const weightedAverageTermDays = weightedTerms.amount > 0 ? weightedTerms.weighted / weightedTerms.amount : null;
  return {
    id: operation.id,
    level: "OPERACAO",
    label: `Operação ${operation.aditivoNumber}`,
    facts: {
      titlesMatchGrossAmount,
      netAmountValid,
      grossAmount: operation.amount,
      titleCount: entries.length,
      weightedAverageTermDays,
      monthlyRatePercent:
        operation.pricingReview?.status === "Condição salva" ? operation.pricingReview.monthlyRate : null,
    },
    evidence: {
      titlesMatchGrossAmount: `Soma dos títulos ${titleTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · valor bruto ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      netAmountValid: `Líquido ${operation.netAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · bruto ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      grossAmount: `Valor bruto ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      titleCount: `${entries.length} título(s) normalizado(s)`,
      weightedAverageTermDays:
        weightedAverageTermDays == null
          ? "Fluxo de vencimentos indisponível"
          : `Prazo médio ponderado ${weightedAverageTermDays.toFixed(1)} dia(s)`,
      monthlyRatePercent:
        operation.pricingReview?.status === "Condição salva"
          ? `Condição comercial salva em ${operation.pricingReview.monthlyRate.toLocaleString("pt-BR")}% a.m.`
          : "Condição comercial ainda não salva",
    },
  };
}

function portfolioSubject(
  operation: Operation,
  cedent: Cedent | undefined,
  debtors: Debtor[],
  entries: ManualEntry[],
): EligibilitySubject {
  const overduePercent =
    cedent && cedent.portfolioReceivable > 0 ? (cedent.portfolioOverdue / cedent.portfolioReceivable) * 100 : null;
  const currentPortfolio = debtors.reduce((total, debtor) => total + (debtor.portfolioReceivable ?? 0), 0);
  const currentOverdue = debtors.reduce((total, debtor) => total + (debtor.portfolioOverdue ?? 0), 0);
  const projectedPortfolio = currentPortfolio + operation.amount;
  const operationExposure = entries.reduce<Record<string, number>>((result, title) => {
    const key = digits(title.debtorDocument) || title.debtorId || title.debtorName;
    result[key] = (result[key] ?? 0) + title.amount;
    return result;
  }, {});
  const projectedDebtorExposures = debtors.map(
    debtor =>
      (debtor.portfolioReceivable ?? 0) +
      (operationExposure[digits(debtor.document)] ?? operationExposure[debtor.id] ?? 0),
  );
  const unregisteredExposure = Object.entries(operationExposure)
    .filter(([key]) => !debtors.some(debtor => debtor.id === key || digits(debtor.document) === key))
    .map(([, amount]) => amount);
  const largestDebtorExposure = Math.max(0, ...projectedDebtorExposures, ...unregisteredExposure);
  const largestDebtorConcentrationPercent =
    projectedPortfolio > 0 ? (largestDebtorExposure / projectedPortfolio) * 100 : null;
  const consolidatedOverduePercent = currentPortfolio > 0 ? (currentOverdue / currentPortfolio) * 100 : null;
  return {
    id: `portfolio:${cedent?.id ?? digits(operation.document)}`,
    level: "CARTEIRA",
    label: `Carteira de ${cedent?.name ?? operation.cedent}`,
    facts: {
      cedentOverduePercent: overduePercent,
      largestDebtorConcentrationPercent,
      overduePercent: consolidatedOverduePercent,
      activeDebtorCount: debtors.filter(debtor => (debtor.portfolioReceivable ?? 0) > 0).length,
    },
    evidence: {
      cedentOverduePercent: cedent
        ? `Vencido ${cedent.portfolioOverdue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira ${cedent.portfolioReceivable.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cedente não localizado para composição da carteira",
      largestDebtorConcentrationPercent: `Maior exposição projetada ${largestDebtorExposure.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira projetada ${projectedPortfolio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      overduePercent: `Vencido consolidado ${currentOverdue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira ${currentPortfolio.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      activeDebtorCount: `${debtors.filter(debtor => (debtor.portfolioReceivable ?? 0) > 0).length} sacado(s) com exposição`,
    },
  };
}

function fingerprint(value: unknown) {
  const source = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < source.length; index++) {
    hash ^= source.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return `ef-${(hash >>> 0).toString(36)}`;
}

function structureSubject(operation: Operation): EligibilitySubject {
  return {
    id: `structure:${operation.id}`,
    level: "ESTRUTURA",
    label: `${operation.institution} · ${operation.vehicle || "veículo não informado"}`,
    facts: {
      structureDefined: Boolean(operation.institution && operation.vehicle),
      fundClassPresent: Boolean(operation.fundClass),
    },
    evidence: {
      structureDefined: `Modalidade ${operation.institution} · veículo ${operation.vehicle || "não informado"}`,
      fundClassPresent: operation.fundClass ? `Classe ${operation.fundClass}` : "Classe ou subclasse não informada",
    },
  };
}

export function evaluateOperationEligibility({
  operation,
  debtors,
  cedent,
  asOf = new Date().toISOString().slice(0, 10),
  policies,
}: {
  operation: Operation;
  debtors: Debtor[];
  cedent?: Cedent;
  asOf?: string;
  policies?: EligibilityPolicy[];
}) {
  const entries = operation.manualEntry?.entries ?? [];
  const applicablePolicies = policies ?? demoPoliciesFor(operation);
  const product = operation.policy.replace(/\s+v[\d.]+$/i, "");
  const rules = resolvePolicyRules({
    catalog: masterRuleCatalog,
    policies: applicablePolicies,
    modality: operation.institution,
    product,
    company: operation.vehicle,
    asOf,
  });
  const subjects = [
    ...titleSubjects(operation, entries, debtors, asOf),
    ...debtorSubjects(operation, entries, debtors),
    cedentSubject(operation, cedent),
    operationSubject(operation, entries, asOf),
    portfolioSubject(operation, cedent, debtors, entries),
    structureSubject(operation),
  ];
  const inputFingerprint = fingerprint({
    subjects: subjects.map(subject => ({ id: subject.id, level: subject.level, facts: subject.facts })),
    rules: rules.map(({ rule, binding, policy }) => ({
      ruleId: rule.id,
      operator: binding.operator ?? rule.defaultOperator,
      parameter: binding.parameter,
      failureOutcome: binding.failureOutcome,
      action: binding.action,
      policyId: policy.id,
      policyVersion: policy.version,
    })),
  });
  return runEligibilityEngine({
    runId: `eligibility:${operation.id}:${asOf}:${inputFingerprint}`,
    evaluatedAt: `${asOf}T12:00:00`,
    inputFingerprint,
    subjects,
    rules,
  });
}

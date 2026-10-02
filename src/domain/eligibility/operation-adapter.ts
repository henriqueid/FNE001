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

function titleSubjects(entries: ManualEntry[], asOf: string): EligibilitySubject[] {
  const occurrences = entries.reduce<Record<string, number>>((result, title) => {
    const key = title.documentNumber.trim().toLocaleLowerCase();
    result[key] = (result[key] ?? 0) + 1;
    return result;
  }, {});
  return entries.map(title => ({
    id: title.id,
    level: "TITULO",
    label: `Título ${title.documentNumber}`,
    facts: {
      faceAmount: title.amount,
      termDays: termDays(title, asOf),
      duplicateInOperation: occurrences[title.documentNumber.trim().toLocaleLowerCase()] > 1,
      hasFiscalEvidence: Boolean(title.nfeKey?.trim()),
    },
    evidence: {
      faceAmount: `Entrada da operação · valor ${title.amount}`,
      termDays: `Vencimento ${title.dueDate || "não informado"} · data-base ${asOf}`,
      duplicateInOperation: `Documento ${title.documentNumber} na carteira disponível da operação`,
      hasFiscalEvidence: title.nfeKey ? `Chave NF-e ${title.nfeKey}` : "Campo de chave NF-e vazio",
    },
  }));
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
  return Object.values(grouped).map(group => {
    const registered = debtors.find(item => item.id === group.id || digits(item.document) === digits(group.document));
    const concentration = operation.amount > 0 ? (group.amount / operation.amount) * 100 : null;
    return {
      id: group.id,
      level: "SACADO",
      label: registered?.name ?? group.name,
      facts: { operationConcentrationPercent: concentration },
      evidence: {
        operationConcentrationPercent: `${group.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} de ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
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
    facts: { projectedLimitUsagePercent: projected },
    evidence: {
      projectedLimitUsagePercent: cedent
        ? `Utilizado ${cedent.usedLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} + operação ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre limite ${cedent.creditLimit.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cedente não localizado no cadastro atual",
    },
  };
}

function operationSubject(operation: Operation, entries: ManualEntry[]): EligibilitySubject {
  const titleTotal = entries.reduce((total, title) => total + title.amount, 0);
  const titlesMatchGrossAmount = entries.length > 0 && Math.abs(titleTotal - operation.amount) < 0.01;
  const netAmountValid = operation.netAmount >= 0 && operation.netAmount <= operation.amount;
  return {
    id: operation.id,
    level: "OPERACAO",
    label: `Operação ${operation.aditivoNumber}`,
    facts: { titlesMatchGrossAmount, netAmountValid },
    evidence: {
      titlesMatchGrossAmount: `Soma dos títulos ${titleTotal.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · valor bruto ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
      netAmountValid: `Líquido ${operation.netAmount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} · bruto ${operation.amount.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`,
    },
  };
}

function portfolioSubject(operation: Operation, cedent?: Cedent): EligibilitySubject {
  const overduePercent =
    cedent && cedent.portfolioReceivable > 0 ? (cedent.portfolioOverdue / cedent.portfolioReceivable) * 100 : null;
  return {
    id: `portfolio:${cedent?.id ?? digits(operation.document)}`,
    level: "CARTEIRA",
    label: `Carteira de ${cedent?.name ?? operation.cedent}`,
    facts: { cedentOverduePercent: overduePercent },
    evidence: {
      cedentOverduePercent: cedent
        ? `Vencido ${cedent.portfolioOverdue.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })} sobre carteira ${cedent.portfolioReceivable.toLocaleString("pt-BR", { style: "currency", currency: "BRL" })}`
        : "Cedente não localizado para composição da carteira",
    },
  };
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
  return runEligibilityEngine({
    runId: `eligibility:${operation.id}:${asOf}`,
    evaluatedAt: `${asOf}T12:00:00`,
    subjects: [
      ...titleSubjects(entries, asOf),
      ...debtorSubjects(operation, entries, debtors),
      cedentSubject(operation, cedent),
      operationSubject(operation, entries),
      portfolioSubject(operation, cedent),
      structureSubject(operation),
    ],
    rules,
  });
}

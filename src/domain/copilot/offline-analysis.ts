/**
 * Ponte entre a entrada real de arquivos e o motor determinístico do Copiloto.
 * Não usa IA: normaliza XML/CNAB/CSV, resolve a política vigente e monta o cenário.
 */
import { type Cedent, type Debtor, type EntryIntakeIssue, type OperationSource } from "@/src/domain/core/types";
import { termDays } from "@/src/domain/eligibility/operational-parameters";
import { normalizeOperationIntake } from "@/src/domain/operations/intake";
import { type SystemKnowledge } from "./system-query";
import { type DeskContext, type DeskFile, type DeskPolicy, type DeskTitle } from "./desk-engine";

export type ReadableDeskFile = DeskFile & { content?: string; readError?: string };

const CONCENTRATION_RULE = "DEBTOR-OPERATION-CONCENTRATION-MAX-001";
const layerWeight = { UNIVERSAL: 0, MODALIDADE: 1, INSTITUICAO: 2, PRODUTO: 3, CARTEIRA: 4 } as const;

function sourceFor(file: DeskFile): OperationSource {
  if (file.format === "XML") return "XML NF-e";
  if (file.format === "CNAB") return "CNAB";
  return "Planilha";
}

function policyFor(knowledge: SystemKnowledge, cedent?: Cedent): DeskPolicy {
  const active = knowledge.policies
    .filter(policy => policy.status === "ATIVA" && policy.effectiveFrom <= knowledge.today)
    .filter(policy => !policy.effectiveTo || policy.effectiveTo >= knowledge.today)
    .sort((left, right) => layerWeight[left.layer] - layerWeight[right.layer]);
  const concentration = active
    .flatMap(policy => policy.bindings.map(binding => ({ policy, binding })))
    .filter(item => item.binding.enabled && item.binding.ruleId === CONCENTRATION_RULE)
    .at(-1);
  const score = cedent?.score ?? 0;
  const risk =
    score >= knowledge.parameters.scoreBands.positive
      ? "Baixo"
      : score >= knowledge.parameters.scoreBands.attention
        ? "Médio"
        : "Alto";
  const pricing = knowledge.parameters.pricingDefaults;
  const named = concentration?.policy ?? active.at(-1);
  return {
    name: named?.name ?? "Parâmetros operacionais",
    version: named?.version ?? "vigente",
    concentrationLimit: typeof concentration?.binding.parameter === "number" ? concentration.binding.parameter : 30,
    rateFloor: knowledge.parameters.rateFloorByRisk[risk],
    minDays: knowledge.parameters.minimumTermDays,
    operationFeeCents: Math.round(pricing.operationFee * 100),
    perTitleFeeCents: Math.round(pricing.feePerTitle * 100),
    defaultRate: Math.max(pricing.monthlyRate, knowledge.parameters.rateFloorByRisk[risk]),
    scoreAttention: knowledge.parameters.scoreBands.attention,
    scorePositive: knowledge.parameters.scoreBands.positive,
  };
}

export function buildOfflineDeskContext({
  files,
  knowledge,
  debtors,
  cedentId,
}: {
  files: ReadableDeskFile[];
  knowledge: SystemKnowledge;
  debtors: Debtor[];
  cedentId: string;
}): { context?: DeskContext; issues: EntryIntakeIssue[]; fileErrors: string[]; acceptedRows: number } {
  const issues: EntryIntakeIssue[] = [];
  const fileErrors: string[] = [];
  const titles: DeskTitle[] = [];
  const knownTitles = knowledge.operations.flatMap(operation => operation.manualEntry?.entries ?? []);
  const cedent = knowledge.cedents.find(item => item.id === cedentId);

  files.forEach(file => {
    if (file.readError || file.content == null) {
      fileErrors.push(`${file.name}: ${file.readError ?? "conteúdo não carregado"}`);
      return;
    }
    const normalized = normalizeOperationIntake({
      source: sourceFor(file),
      fileName: file.name,
      text: file.content,
      debtors,
      knownTitles,
      importedAt: `${knowledge.today}T12:00:00Z`,
    });
    issues.push(...normalized.intake.issues.map(item => ({ ...item, id: `${file.name}:${item.id}` })));
    const newDocuments = new Set((normalized.intake.newDebtors ?? []).map(item => item.document.replace(/\D/g, "")));
    normalized.data.entries.forEach(entry => {
      const days = termDays(entry.dueDate, knowledge.today);
      titles.push({
        id: `${file.name}:${entry.id}`,
        document: entry.documentNumber,
        debtor: entry.debtorName,
        amountCents: Math.round(entry.amount * 100),
        days: Math.max(0, days ?? 0),
        source: file.format === "XML" ? "XML" : file.format === "CNAB" ? "CNAB" : "XLS",
        newDebtor: newDocuments.has(entry.debtorDocument.replace(/\D/g, "")),
      });
    });
  });

  if (!titles.length) return { issues, fileErrors, acceptedRows: 0 };
  const policy = policyFor(knowledge, cedent);
  return {
    issues,
    fileErrors,
    acceptedRows: titles.length,
    context: {
      titles,
      policy,
      bureauChecked: false,
      cedent: cedent
        ? {
            name: cedent.name,
            score: cedent.score,
            creditLimitCents: Math.round(cedent.creditLimit * 100),
            usedLimitCents: Math.round(cedent.usedLimit * 100),
          }
        : undefined,
    },
  };
}

import { type CommercialState } from "@/src/domain/commercial/types";
import {
  type Cedent,
  type Debtor,
  type Destination,
  type EntryIntake,
  type ManualEntryData,
  type Operation,
  type OperationSource,
} from "@/src/domain/core/types";
import { stages } from "@/src/domain/core/stages";
import { effectiveRunSummary } from "@/src/domain/eligibility/decision";
import type {
  EligibilityEvaluation,
  EligibilityOutcome,
  EligibilityOverride,
  EligibilityReview,
} from "@/src/domain/eligibility/model";
import { autoAdvanceWithinPolicy } from "@/src/domain/operations/auto-advance";
import { buildNewOperation } from "@/src/domain/operations/create-operation";
import { defaultPricing, pricingCalculation, roundPricing } from "@/src/domain/operations/pricing";
import { type DeskContext, type DeskFile, type DeskFinding, type DeskScenario } from "./desk-engine";

export type CopilotOperationRequest = {
  runId: string;
  cedentId: string;
  scenario: DeskScenario;
  context: DeskContext;
  files: DeskFile[];
  importedData?: ManualEntryData;
  entryIntake?: EntryIntake;
};

const counts = (evaluations: EligibilityEvaluation[]) => {
  const result: Record<EligibilityOutcome, number> = {
    APROVADO: 0,
    ALERTA: 0,
    EXCECAO: 0,
    REPROVADO: 0,
    NAO_AVALIADO: 0,
  };
  evaluations.forEach(evaluation => result[evaluation.outcome]++);
  return result;
};

const outcomeFor = (finding: DeskFinding): EligibilityOutcome =>
  finding.severity === "impedimento" ? "REPROVADO" : finding.severity === "alcada" ? "EXCECAO" : "ALERTA";

export function copilotEligibilityReview(
  scenario: DeskScenario,
  context: DeskContext,
  evaluatedAt: string,
  runId: string,
): EligibilityReview {
  const evaluations: EligibilityEvaluation[] = scenario.result.findings.map((finding, index) => {
    const outcome = outcomeFor(finding);
    return {
      id: `${runId}:${finding.id}:${index}`,
      ruleId: finding.id,
      ruleName: finding.title,
      variable: finding.id,
      subjectId: "copilot-scenario",
      subjectLabel: `Cenário v${scenario.version}`,
      level: finding.id.startsWith("dup-") || finding.id.startsWith("term-") ? "TITULO" : "OPERACAO",
      outcome,
      action: outcome === "REPROVADO" ? "BLOQUEAR" : outcome === "EXCECAO" ? "SOLICITAR_DECISAO" : "SINALIZAR",
      observed: finding.detail,
      parameter: context.policy.name,
      operator: "EQ",
      policyName: context.policy.name,
      policyVersion: context.policy.version,
      overrideAllowed: outcome === "EXCECAO",
      overrideAuthority: outcome === "EXCECAO" ? "credit-director" : undefined,
      technicalMessage: finding.title,
      explanation: finding.detail,
      evidence: finding.evidence,
    };
  });
  const runCounts = counts(evaluations);
  const overallOutcome: EligibilityOutcome = runCounts.REPROVADO
    ? "REPROVADO"
    : runCounts.EXCECAO
      ? "EXCECAO"
      : runCounts.ALERTA
        ? "ALERTA"
        : "APROVADO";
  return {
    run: {
      id: `eligibility-${runId}-v${scenario.version}`,
      evaluatedAt,
      inputFingerprint: `${runId}:${scenario.version}:${scenario.included.join(",")}`,
      overallOutcome,
      policyVersions: [
        {
          id: context.policy.name.toLowerCase().replace(/[^a-z0-9]+/g, "-"),
          name: context.policy.name,
          version: context.policy.version,
        },
      ],
      evaluations,
      counts: runCounts,
    },
    overrides: [],
  };
}

const sourceFor = (request: CopilotOperationRequest): OperationSource => {
  if (request.entryIntake?.source) return request.entryIntake.source;
  const source = request.context.titles.find(title => request.scenario.included.includes(title.id))?.source;
  return source === "XML" ? "XML NF-e" : source === "CNAB" ? "CNAB" : "Planilha";
};

const dateAfter = (today: string, days: number) => {
  const date = new Date(`${today}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
};

function dataFor(request: CopilotOperationRequest, debtors: Debtor[], today: string): ManualEntryData {
  const selected = new Set(request.scenario.included);
  if (request.importedData)
    return { ...request.importedData, entries: request.importedData.entries.filter(entry => selected.has(entry.id)) };
  return {
    receivableType: "Duplicata",
    mode: "individual",
    entries: request.context.titles
      .filter(title => selected.has(title.id))
      .map(title => {
        const debtor = debtors.find(item => item.name.toLocaleLowerCase() === title.debtor.toLocaleLowerCase());
        return {
          id: title.id,
          documentNumber: title.document,
          amount: title.amountCents / 100,
          issueDate: today,
          dueDate: dateAfter(today, title.days),
          debtorId: debtor?.id ?? `copilot-debtor-${title.id}`,
          debtorName: title.debtor,
          debtorDocument: debtor?.document ?? "",
        };
      }),
  };
}

function intakeFor(
  request: CopilotOperationRequest,
  data: ManualEntryData,
  source: OperationSource,
  at: string,
): EntryIntake {
  if (request.entryIntake) return { ...request.entryIntake, acceptedRows: data.entries.length };
  return {
    id: `intake-${request.runId}`,
    source,
    fileName: request.files.map(file => file.name).join(", ") || "Análise do Copiloto",
    fileHash: `${request.runId}:v${request.scenario.version}`,
    importedAt: at,
    format: source === "XML NF-e" ? "XML" : source === "CNAB" ? "CNAB" : "XLSX",
    status: request.scenario.result.blockers.length ? "BLOQUEADO" : "PRONTO",
    originalRows: request.context.titles.length,
    acceptedRows: data.entries.length,
    rejectedRows: request.context.titles.length - data.entries.length,
    matchedDebtors: data.entries.filter(entry => entry.debtorDocument).length,
    issues: [],
  };
}

export function buildCopilotOperation({
  request,
  destination,
  cedent,
  operations,
  commercial,
  debtors,
  actor,
  today,
  at,
}: {
  request: CopilotOperationRequest;
  destination: Destination;
  cedent: Cedent;
  operations: Operation[];
  commercial: CommercialState;
  debtors: Debtor[];
  actor: { name: string; initials?: string };
  today: string;
  at: string;
}): Operation {
  const source = sourceFor(request);
  const importedData = dataFor(request, debtors, today);
  const entryIntake = intakeFor(request, importedData, source, at);
  const created = buildNewOperation(
    {
      source,
      operationType: importedData.receivableType,
      destination,
      cedent,
      importedData,
      entryIntake,
      actor,
    },
    operations,
    commercial,
    today,
  );
  const eligibilityReview = copilotEligibilityReview(request.scenario, request.context, at, request.runId);
  const route = effectiveRunSummary(eligibilityReview.run, eligibilityReview.overrides);
  const basePricing = { ...defaultPricing(created), monthlyRate: request.scenario.ratePercent };
  const calculated = pricingCalculation(created, basePricing);
  const pricingReview: NonNullable<Operation["pricingReview"]> = {
    ...basePricing,
    status: "Condição salva",
    savedAt: at,
    savedBy: "Copiloto STRATO",
    version: request.scenario.version,
    locked: true,
    audit: [
      {
        version: request.scenario.version,
        at,
        by: "Copiloto STRATO",
        action: "Condição salva",
        reason: `Cenário v${request.scenario.version} calculado na análise assistida`,
        face: calculated.face,
        commercialNet: calculated.net,
        repurchaseAndCompensations: 0,
        borderoNet: calculated.net,
        monthlyRate: request.scenario.ratePercent,
        method: basePricing.method,
      },
    ],
  };
  return {
    ...created,
    stage: 2,
    status: route.counts.REPROVADO || route.counts.EXCECAO ? "Em atenção" : "Em andamento",
    blockers: route.counts.REPROVADO + route.counts.EXCECAO,
    alerts: Math.max(created.alerts, route.counts.ALERTA),
    nextAction: route.counts.REPROVADO
      ? "Resolver impedimentos encontrados pelo Copiloto"
      : route.counts.EXCECAO
        ? "Deliberar exceções da análise do Copiloto"
        : "Aprovar o encaminhamento da análise",
    policy: `${request.context.policy.name} v${request.context.policy.version}`,
    amount: calculated.face,
    netAmount: roundPricing(calculated.net),
    pricingReview,
    eligibilityReview,
    stageCompletions: [
      {
        stageId: 1,
        completedBy: "Copiloto STRATO",
        completedAt: at,
        source: "COPILOT",
        scenarioVersion: request.scenario.version,
        policyVersion: request.context.policy.version,
        snapshotId: eligibilityReview.run.id,
        reason: `${importedData.entries.length} título(s) validados e normalizados`,
      },
    ],
    copilotOrigin: {
      runId: request.runId,
      scenarioVersion: request.scenario.version,
      policyName: request.context.policy.name,
      policyVersion: request.context.policy.version,
      generatedAt: at,
      generatedBy: actor.name,
      fileNames: request.files.map(file => file.name),
    },
  };
}

export function approveCopilotOperation(
  operation: Operation,
  {
    actor,
    at,
    debtors,
    authorityApproved = false,
  }: { actor: string; at: string; debtors: Debtor[]; authorityApproved?: boolean },
): Operation {
  if (operation.stage !== 2 || !operation.eligibilityReview) return operation;
  const review = operation.eligibilityReview;
  const summary = effectiveRunSummary(review.run, review.overrides);
  if (summary.counts.REPROVADO || (summary.counts.EXCECAO && !authorityApproved)) return operation;
  const overrides: EligibilityOverride[] = authorityApproved
    ? review.run.evaluations
        .filter(evaluation => evaluation.outcome === "EXCECAO")
        .map(evaluation => ({
          id: `copilot-override-${evaluation.id}`,
          evaluationId: evaluation.id,
          ruleId: evaluation.ruleId,
          subjectId: evaluation.subjectId,
          originalOutcome: evaluation.outcome,
          observed: evaluation.observed,
          parameter: evaluation.parameter,
          decision: "APROVAR_EXCECAO",
          justification: "Aprovada na análise do Copiloto com registro da alçada competente.",
          authority: evaluation.overrideAuthority ?? "credit-director",
          decidedBy: actor,
          decidedAt: at,
          evidence: evaluation.evidence,
        }))
    : review.overrides;
  const entries = operation.manualEntry?.entries ?? [];
  const debtorKeys = [...new Set(entries.map(entry => entry.debtorId || entry.debtorDocument))];
  const routed: Operation = {
    ...operation,
    eligibilityReview: { ...review, overrides },
    riskReview: {
      cedentDecision: "Aprovado",
      debtorDecisions: Object.fromEntries(debtorKeys.map(key => [key, "Aprovado"])),
      titleDecisions: Object.fromEntries(entries.map(entry => [entry.id, "Aprovado"])),
      audit: [
        ...(operation.riskReview?.audit ?? []),
        { entity: "operacao", decision: "Aprovado", by: actor, at, policy: operation.policy },
      ],
    },
    stage: 3,
    status: "Em andamento",
    blockers: 0,
    nextAction: stages[2].description,
    stageCompletions: [
      ...(operation.stageCompletions ?? []).filter(completion => completion.stageId !== 2),
      {
        stageId: 2,
        completedBy: authorityApproved ? actor : "Motor de elegibilidade",
        completedAt: at,
        source: authorityApproved ? "HUMAN" : "ENGINE",
        scenarioVersion: operation.copilotOrigin?.scenarioVersion,
        policyVersion: operation.copilotOrigin?.policyVersion,
        snapshotId: review.run.id,
        reason: authorityApproved ? "Exceções aprovadas pela alçada" : "Cenário integralmente dentro da política",
      },
    ],
  };
  return autoAdvanceWithinPolicy(routed, { debtors, at }).operation;
}

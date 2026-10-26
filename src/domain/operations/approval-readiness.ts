/** Requisitos compartilhados pela prontidão da aprovação e pelo bloqueio do workspace. */
import { type Operation } from "@/src/domain/core/types";
import { eligibilityRouteFor } from "@/src/domain/eligibility/orchestration";
import { operationalParametersFor } from "@/src/domain/eligibility/operational-parameters";
import { manualAutomation, type AutomationBreakdown } from "./automation";
import { type lastroAssessmentFor } from "./lastro";

export type ReadinessItem = { label: string; ok: boolean; detail: string };

export function isRiskApproved(operation: Operation) {
  if (operation.eligibilityReview) return eligibilityRouteFor(operation).canAdvance;
  return (
    operation.riskReview?.cedentDecision === "Aprovado" &&
    (operation.manualEntry?.entries ?? []).every(title => Boolean(operation.riskReview?.titleDecisions?.[title.id])) &&
    (operation.manualEntry?.entries ?? []).some(
      title => operation.riskReview?.titleDecisions?.[title.id] === "Aprovado",
    )
  );
}

/** Requisitos das etapas anteriores que precisam estar concluídos antes das alçadas. */
export function buildReadinessChecklist(
  operation: Operation,
  lastro: ReturnType<typeof lastroAssessmentFor>,
  automation: AutomationBreakdown = operation.source === "Digitação manual"
    ? manualAutomation(operation.manualEntry)
    : { score: operation.automation, items: [] },
): ReadinessItem[] {
  const riskApproved = isRiskApproved(operation);
  const route = operation.eligibilityReview ? eligibilityRouteFor(operation) : undefined;
  const checklist: ReadinessItem[] = [
    {
      label: "Risco e elegibilidade",
      ok: riskApproved,
      detail: route
        ? `${route.label} · ${route.explanation}`
        : riskApproved
          ? "Cedente, sacados e títulos aprovados"
          : "Existem decisões de risco pendentes",
    },
    {
      label: "Parecer de lastro",
      ok: lastro.ready,
      detail: !lastro.required
        ? "Pré-checagem dispensada no cadastro do cedente"
        : lastro.ready
          ? `Parecer ${lastro.status.toLowerCase()} registrado`
          : "Status geral da pré-checagem pendente",
    },
    {
      label: "Condição comercial",
      ok: operation.pricingReview?.status === "Condição salva",
      detail:
        operation.pricingReview?.status === "Condição salva"
          ? `Condição v${operation.pricingReview.version ?? 1} protegida`
          : "A condição ainda não foi salva",
    },
    {
      label: "Bloqueios operacionais",
      ok: operation.blockers === 0,
      detail: operation.blockers ? `${operation.blockers} bloqueio(s) exigem deliberação` : "Nenhum bloqueio aberto",
    },
  ];
  if (operation.source === "Digitação manual") {
    const entries = operation.manualEntry?.entries ?? [];
    const type = operation.manualEntry?.receivableType;
    const missing = entries.filter(
      entry =>
        !(type === "Duplicata"
          ? entry.nfeKey?.trim()
          : type === "Cheque"
            ? entry.cmc7?.trim()
            : entry.documentNumber?.trim()),
    );
    const evidence = type === "Duplicata" ? "chave NF-e" : type === "Cheque" ? "CMC7" : "número do documento";
    checklist.push({
      label: "Evidência documental da entrada",
      ok: entries.length > 0 && missing.length === 0,
      detail: !entries.length
        ? "Inclua ao menos um título na entrada."
        : missing.length
          ? `Informe ${evidence} em ${missing.length} título(s): ${missing.map(entry => entry.documentNumber || entry.id).join(", ")}. A dispensa de pré-checagem não dispensa este requisito documental.`
          : "Identificadores documentais preenchidos; autenticidade depende da validação e formalização.",
    });
    const minimum = operationalParametersFor(operation.institution).readinessMinAutomation;
    checklist.push({
      label: "Automação mínima da entrada",
      ok: automation.score >= minimum,
      detail:
        automation.score >= minimum
          ? `Automação ${automation.score}% atende mínimo de ${minimum}%.`
          : `Complete os dados da entrada: automação ${automation.score}%, mínimo ${minimum}%.`,
    });
  }
  return checklist;
}

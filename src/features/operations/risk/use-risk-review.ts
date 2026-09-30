"use client";
/**
 * Estado e ações da revisão de risco: sacado selecionado, modais abertos, consultas
 * realizadas e registro das decisões (com trilha de auditoria) na operação.
 */
import { useCedents } from "@/src/app/registry-context";
import { type Debtor, type ManualEntry, type Operation } from "@/src/domain/core/types";
import { useState } from "react";
import {
  type RiskDecision,
  type RiskDetailKind,
  type RiskReview,
  eligibleApproval,
  findDebtorProfile,
  groupEntriesByDebtor,
  groupKey,
  titlesOfGroup,
} from "./risk-model";

export function useRiskReview({
  operation,
  debtors,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  onChange: (operation: Operation) => void;
}) {
  const registryCedents = useCedents();
  const entries = operation.manualEntry?.entries ?? [];
  const cedent = registryCedents.find(
    item => item.document.replace(/\D/g, "") === operation.document.replace(/\D/g, ""),
  );
  const grouped = groupEntriesByDebtor(entries);
  const [selectedKey, setSelectedKey] = useState(grouped[0]?.id || grouped[0]?.document || "");
  const [detail, setDetail] = useState<RiskDetailKind | null>(null);
  const [selectedTitle, setSelectedTitle] = useState<ManualEntry | null>(null);
  const [consulted, setConsulted] = useState<string[]>([]);
  const selectedGroup = grouped.find(item => groupKey(item) === selectedKey) ?? grouped[0];
  const selectedDebtor = findDebtorProfile(debtors, selectedGroup);
  const selectedTitles = titlesOfGroup(entries, selectedGroup);
  const debtorDecisions = operation.riskReview?.debtorDecisions ?? {};
  const titleDecisions = operation.riskReview?.titleDecisions ?? {};

  const updateReview = (change: RiskReview) =>
    onChange({ ...operation, riskReview: { ...operation.riskReview, ...change } });
  const auditDecision = (entity: string, decision: RiskDecision) => [
    ...(operation.riskReview?.audit ?? []).filter(item => item.entity !== entity),
    {
      entity,
      decision,
      by: "Henrique",
      at: new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }),
      policy: operation.policy,
    },
  ];
  const decideDebtor = (key: string, decision: RiskDecision) => {
    const review: RiskReview = {
      debtorDecisions: { ...debtorDecisions, [key]: decision },
      audit: auditDecision(`sacado:${key}`, decision),
    };
    if (decision === "Aprovado") {
      const group = grouped.find(item => groupKey(item) === key);
      const approvedTitles = titlesOfGroup(entries, group).reduce(
        (decisions, title) => ({ ...decisions, [title.id]: "Aprovado" as const }),
        { ...titleDecisions },
      );
      review.titleDecisions = approvedTitles;
    }
    updateReview(review);
  };
  const decideTitle = (id: string, decision: RiskDecision) =>
    updateReview({
      titleDecisions: { ...titleDecisions, [id]: decision },
      audit: auditDecision(`titulo:${id}`, decision),
    });
  const rejectOperation = () =>
    updateReview({ cedentDecision: "Reprovado", audit: auditDecision("operacao", "Reprovado") });
  const approveEligible = () =>
    updateReview({
      ...eligibleApproval({ review: operation.riskReview, grouped, entries, debtors, cedentScore: cedent?.score }),
      audit: auditDecision("operacao", "Aprovado"),
    });
  const markConsulted = (key: string) => setConsulted(current => [...new Set([...current, key])]);

  const approvedDebtors = grouped.filter(item => debtorDecisions[groupKey(item)] === "Aprovado").length;
  const rejectedDebtors = grouped.filter(item => debtorDecisions[groupKey(item)] === "Reprovado").length;
  const selectedDecisionAudit = operation.riskReview?.audit?.find(
    item => item.entity === `sacado:${selectedGroup?.id || selectedGroup?.document}`,
  );

  return {
    cedent,
    grouped,
    selectedGroup,
    selectedDebtor,
    selectedTitles,
    debtorDecisions,
    titleDecisions,
    approvedDebtors,
    rejectedDebtors,
    selectedDecisionAudit,
    detail,
    setDetail,
    selectedTitle,
    setSelectedTitle,
    setSelectedKey,
    consulted,
    markConsulted,
    decideDebtor,
    decideTitle,
    rejectOperation,
    approveEligible,
  };
}

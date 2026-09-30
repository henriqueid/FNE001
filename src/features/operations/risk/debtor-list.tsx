"use client";
/**
 * Lista de sacados da operação, com score, posição histórica e decisão de cada um.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Debtor } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { UsersIcon } from "@/src/ui/icons";
import { type DebtorGroup, type RiskDecision, findDebtorProfile, groupKey, scoreLabel, scoreTone } from "./risk-model";

export function DebtorList({
  grouped,
  debtors,
  selectedGroup,
  debtorDecisions,
  onSelect,
}: {
  grouped: DebtorGroup[];
  debtors: Debtor[];
  selectedGroup?: DebtorGroup;
  debtorDecisions: Record<string, RiskDecision>;
  onSelect: (key: string) => void;
}) {
  return (
    <section className="debtor-panel">
      <div className="risk-panel-title">
        <div>
          <span>SACADOS DA OPERAÇÃO</span>
          <strong>Selecione para analisar e decidir</strong>
        </div>
        <small>{grouped.length} sacado(s)</small>
      </div>
      {grouped.length ? (
        <div className="debtor-risk-list">
          {grouped.map(group => {
            const profile = findDebtorProfile(debtors, group);
            const key = groupKey(group);
            const decision = debtorDecisions[key];
            return (
              <button
                className={`debtor-risk-row ${selectedGroup && key === groupKey(selectedGroup) ? "selected" : ""}`}
                key={key}
                onClick={() => onSelect(key)}
              >
                <span className={`score-pill ${scoreTone(profile?.score)}`} title={profile?.scoreReasons?.join(" • ")}>
                  <b>{profile?.score ?? "NOVO"}</b>
                  <small>{scoreLabel(profile?.score)}</small>
                </span>
                <span className="debtor-risk-name">
                  <strong>{group.name}</strong>
                  <small>
                    {group.document} · {group.count} título(s) nesta operação
                  </small>
                </span>
                <span className="historic-position">
                  <b>{preciseMoney.format(profile?.portfolioReceivable ?? 0)}</b>
                  <small>
                    {profile?.score == null
                      ? "Sem carteira anterior"
                      : `${preciseMoney.format(profile.portfolioOverdue ?? 0)} vencido no ambiente`}
                  </small>
                </span>
                {decision ? (
                  <Badge tone={decision === "Aprovado" ? "ready" : "cancelled"}>{decision}</Badge>
                ) : (
                  <Badge tone="waiting">Pendente</Badge>
                )}
              </button>
            );
          })}
        </div>
      ) : (
        <div className="risk-empty">
          <UsersIcon />
          <strong>Nenhum sacado disponível</strong>
          <span>Volte à entrada e vincule os títulos aos sacados.</span>
        </div>
      )}
    </section>
  );
}

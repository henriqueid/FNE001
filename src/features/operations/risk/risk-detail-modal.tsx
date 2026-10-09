"use client";
/**
 * Modal de análise detalhada: carteira completa do cedente, histórico do sacado ou grupo econômico.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { CloseIcon } from "@/src/ui/icons";
import { CedentPortfolioOverview } from "./cedent-portfolio-overview";
import { type DebtorGroup, type RiskDetailKind } from "./risk-model";

function GroupStats({ selectedGroup, selectedDebtor }: { selectedGroup?: DebtorGroup; selectedDebtor?: Debtor }) {
  return (
    <div className="detail-stat-grid">
      <div>
        <span>Empresas relacionadas</span>
        <strong>{selectedDebtor?.groupCompanies ?? 1}</strong>
      </div>
      <div>
        <span>Score do grupo</span>
        <strong>{selectedDebtor?.groupScore ?? "Sem histórico"}</strong>
      </div>
      <div>
        <span>Exposição consolidada</span>
        <strong>
          {preciseMoney.format(selectedDebtor?.groupExposure ?? selectedDebtor?.portfolioReceivable ?? 0)}
        </strong>
      </div>
      <div>
        <span>Vencidos do grupo</span>
        <strong className={(selectedDebtor?.groupOverdue ?? 0) > 0 ? "negative" : "positive"}>
          {preciseMoney.format(selectedDebtor?.groupOverdue ?? 0)}
        </strong>
      </div>
      <div>
        <span>Sacado selecionado</span>
        <strong>{selectedGroup?.name}</strong>
      </div>
      <div>
        <span>Participação na exposição</span>
        <strong>
          {selectedDebtor?.groupExposure
            ? `${Math.round(((selectedDebtor.portfolioReceivable ?? 0) / selectedDebtor.groupExposure) * 100)}%`
            : "100%"}
        </strong>
      </div>
    </div>
  );
}

function DebtorStats({ selectedDebtor }: { selectedDebtor?: Debtor }) {
  return (
    <div className="detail-stat-grid">
      <div>
        <span>Score</span>
        <strong>{selectedDebtor?.score ?? "Sacado novo"}</strong>
      </div>
      <div>
        <span>Carteira a receber</span>
        <strong>{preciseMoney.format(selectedDebtor?.portfolioReceivable ?? 0)}</strong>
      </div>
      <div>
        <span>Carteira vencida</span>
        <strong>{preciseMoney.format(selectedDebtor?.portfolioOverdue ?? 0)}</strong>
      </div>
      <div>
        <span>Liquidações</span>
        <strong>{selectedDebtor?.settlements ?? 0}</strong>
      </div>
      <div>
        <span>Após vencimento</span>
        <strong>{selectedDebtor?.lateSettlements ?? 0}</strong>
      </div>
      <div>
        <span>Recompras</span>
        <strong>{selectedDebtor?.repurchases ?? 0}</strong>
      </div>
    </div>
  );
}

export function RiskDetailModal({
  kind,
  operation,
  cedent,
  selectedGroup,
  selectedDebtor,
  onClose,
}: {
  kind: RiskDetailKind;
  operation: Operation;
  cedent?: Cedent;
  selectedGroup?: DebtorGroup;
  selectedDebtor?: Debtor;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section
        className={`risk-detail-modal ${kind === "cedent" ? "cedent-analysis-modal" : ""}`}
        role="dialog"
        aria-modal="true"
      >
        <div className="modal-head">
          <div>
            <Badge tone="eyebrow">
              {kind === "cedent"
                ? "ANÁLISE DO CEDENTE"
                : kind === "group"
                  ? "GRUPO ECONÔMICO DO SACADO"
                  : "ANÁLISE DO SACADO"}
            </Badge>
            <h2>
              {kind === "cedent"
                ? operation.cedent
                : kind === "group"
                  ? (selectedDebtor?.groupName ?? "Sem grupo econômico identificado")
                  : selectedGroup?.name}
            </h2>
            <p>
              {kind === "group"
                ? "Exposição consolidada das empresas relacionadas ao sacado selecionado."
                : "Cadastro, carteira e comportamento histórico disponíveis no ambiente."}
            </p>
          </div>
          <button onClick={onClose} aria-label="Fechar">
            <CloseIcon />
          </button>
        </div>
        {kind === "cedent" ? (
          <CedentPortfolioOverview cedent={cedent} />
        ) : kind === "group" ? (
          <GroupStats selectedGroup={selectedGroup} selectedDebtor={selectedDebtor} />
        ) : (
          <DebtorStats selectedDebtor={selectedDebtor} />
        )}
        <div className="modal-actions">
          <button className="primary-action" onClick={onClose}>
            Fechar análise
          </button>
        </div>
      </section>
    </div>
  );
}

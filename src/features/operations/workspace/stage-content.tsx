"use client";
/**
 * Área principal do workspace: cabeçalho da etapa selecionada e roteamento
 * para o painel da etapa (entrada, risco, lastro, preço, aprovação, liberação),
 * aviso de etapa bloqueada ou cartão de leitura da etapa.
 */
import { stages } from "@/src/domain/core/stages";
import { type Debtor, type ManualEntryData, type Operation } from "@/src/domain/core/types";
import { ApprovalPanel } from "@/src/features/operations/approval/approval-panel";
import { Badge } from "@/src/features/operations/components/status";
import { EntryRecordPanel } from "@/src/features/operations/entry/entry-record-panel";
import { ManualEntryPanel } from "@/src/features/operations/entry/manual-entry-panel";
import { LastroValidationPanel } from "@/src/features/operations/lastro/lastro-validation-panel";
import { PricingPanel } from "@/src/features/operations/pricing/pricing-panel";
import { ReleasePanel } from "@/src/features/operations/release/release-panel";
import { RiskEligibilityPanel } from "@/src/features/operations/risk/risk-eligibility-panel";
import { AlertIcon, CheckIcon, LockIcon } from "@/src/ui/icons";
import { type StageInsight } from "./workspace-model";

export function StageContent({
  operation,
  active,
  stageInsight,
  stageLocked,
  debtors,
  onRegisterDebtor,
  onSaveManualEntry,
  onChange,
  showGuidance,
  onGoToCurrentStage,
}: {
  operation: Operation;
  active: number;
  stageInsight: StageInsight;
  stageLocked: boolean;
  debtors: Debtor[];
  onRegisterDebtor: (debtor: Debtor) => void;
  onSaveManualEntry: (data: ManualEntryData) => void;
  onChange: (operation: Operation) => void;
  showGuidance: boolean;
  onGoToCurrentStage: () => void;
}) {
  const activeStage = stages[active - 1];
  return (
    <div className="workspace-main">
      <div className="stage-heading">
        <div>
          <span>ETAPA {active} DE 6</span>
          <h2>{activeStage.title}</h2>
          <p>{activeStage.description}</p>
        </div>
        <Badge
          tone={
            stageInsight.tone === "warning"
              ? "attention"
              : active === operation.stage
                ? "current"
                : active < operation.stage
                  ? "live"
                  : "default"
          }
        >
          <i /> {stageInsight.state}
        </Badge>
      </div>
      {active < operation.stage && (
        <div className="historical-stage-banner">
          <CheckIcon />
          <div>
            <strong>Etapa concluída e preservada</strong>
            <span>
              Os dados registrados continuam vinculados a este aditivo para consulta, auditoria e cálculo das etapas
              seguintes.
            </span>
          </div>
          <Badge tone="live">DADOS PRESERVADOS</Badge>
        </div>
      )}
      {active === 1 && operation.stage === 1 && operation.source === "Digitação manual" && (
        <ManualEntryPanel
          operation={operation}
          debtors={debtors}
          onRegisterDebtor={onRegisterDebtor}
          onSave={onSaveManualEntry}
        />
      )}
      {active === 1 && !(operation.stage === 1 && operation.source === "Digitação manual") && (
        <EntryRecordPanel operation={operation} />
      )}
      {stageLocked && (
        <section className="stage-locked-card">
          <LockIcon />
          <div>
            <strong>
              {operation.status === "Cancelada"
                ? "Operação cancelada: etapa somente para consulta"
                : `Etapa bloqueada até concluir ${stages.find(item => item.id === operation.stage)?.short}`}
            </strong>
            <span>
              {operation.status === "Cancelada"
                ? "A memória do cancelamento preserva aditivo, borderô e títulos. Nenhuma decisão pode ser registrada."
                : "As decisões desta etapa dependem do resultado das anteriores. Assim nenhuma aprovação, assinatura ou liberação acontece fora de ordem."}
            </span>
          </div>
          {operation.status !== "Cancelada" && (
            <button className="secondary-action" onClick={onGoToCurrentStage}>
              Ir para a etapa atual
            </button>
          )}
        </section>
      )}
      {!stageLocked && active === 2 && (
        <RiskEligibilityPanel operation={operation} debtors={debtors} onChange={onChange} />
      )}
      {!stageLocked && active === 3 && (
        <LastroValidationPanel operation={operation} debtors={debtors} onChange={onChange} />
      )}
      {!stageLocked && active === 4 && (
        <PricingPanel operation={operation} onChange={onChange} showGuidance={showGuidance} />
      )}
      {!stageLocked && active === 5 && <ApprovalPanel operation={operation} onChange={onChange} />}
      {active === 6 && operation.stage === 6 && <ReleasePanel operation={operation} onChange={onChange} />}
      {!stageLocked &&
        active !== 1 &&
        active !== 2 &&
        active !== 3 &&
        active !== 4 &&
        active !== 5 &&
        !(active === 6 && operation.stage === 6) && <StageInsightCard stageInsight={stageInsight} />}
    </div>
  );
}

function StageInsightCard({ stageInsight }: { stageInsight: StageInsight }) {
  return (
    <section className={`stage-insight-card ${stageInsight.tone}`}>
      <div className="stage-insight-head">
        <div>
          <span>{stageInsight.state}</span>
          <h3>{stageInsight.title}</h3>
          <p>{stageInsight.description}</p>
        </div>
        <small>{stageInsight.source}</small>
      </div>
      <div className="stage-insight-metrics">
        {stageInsight.metrics.map(metric => (
          <div key={metric.label}>
            <span>{metric.label}</span>
            <strong>{metric.value}</strong>
            <small>{metric.detail}</small>
          </div>
        ))}
      </div>
      <div className="stage-insight-result">
        {stageInsight.tone === "warning" ? <AlertIcon /> : <CheckIcon />}
        <span>{stageInsight.result}</span>
      </div>
    </section>
  );
}

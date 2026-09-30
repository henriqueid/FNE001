"use client";

/**
 * Peças visuais comuns das telas de operação: selo, dica, métrica, status e estado da etapa.
 */
import { money } from "@/src/domain/core/format";
import { stages } from "@/src/domain/core/stages";
import { type Operation, type OperationStatus } from "@/src/domain/core/types";
import { ArrowIcon, CheckIcon } from "@/src/ui/icons";

export const statusClass: Record<OperationStatus, string> = {
  "Em andamento": "neutral",
  "Aguardando terceiro": "waiting",
  "Em atenção": "attention",
  "Pronta para formalizar": "formalization",
  "Pronta para liberar": "ready",
  "Liberada ao financeiro": "ready",
  Cancelada: "cancelled",
};

export function Badge({ children, tone = "default" }: { children: React.ReactNode; tone?: string }) {
  return <span className={`badge ${tone}`}>{children}</span>;
}

export function InfoTip({ text }: { text: string }) {
  return (
    <span className="info-tip" role="button" tabIndex={0} aria-label={`Ajuda: ${text}`} data-tooltip={text}>
      i
    </span>
  );
}

export function Metric({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: string }) {
  return (
    <div className="metric-card">
      <span className="metric-label">{label}</span>
      <strong className={tone || ""}>{value}</strong>
      <small>{hint}</small>
    </div>
  );
}

export function StatusBadge({ status }: { status: OperationStatus }) {
  return (
    <Badge tone={statusClass[status]}>
      <i />
      {status}
    </Badge>
  );
}

export function StagePipeline({ operations }: { operations: Operation[] }) {
  const total = operations.reduce((sum, operation) => sum + operation.amount, 0);
  return (
    <section className="pipeline-card" aria-label="Operações por etapa">
      <div className="pipeline-intro">
        <span>FLUXO ATUAL</span>
        <strong>{operations.length} operações</strong>
        <small>{money.format(total)} em processamento</small>
      </div>
      <div className="pipeline-stages">
        {stages.map((stage, index) => {
          const count = operations.filter(op => op.stage === stage.id).length;
          return (
            <div className="pipeline-stage" key={stage.id}>
              <div className="stage-count">
                <strong>{count}</strong>
                <span>{stage.short}</span>
              </div>
              {index < stages.length - 1 && <ArrowIcon />}
            </div>
          );
        })}
      </div>
    </section>
  );
}

export function StepState({ id, current }: { id: number; current: number }) {
  if (id < current)
    return (
      <span className="step-state done">
        <CheckIcon />
      </span>
    );
  if (id === current) return <span className="step-state current">{id}</span>;
  return <span className="step-state">{id}</span>;
}

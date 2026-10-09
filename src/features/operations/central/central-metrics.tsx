"use client";
/**
 * Indicadores da central: resultado financeiro e situação da fila,
 * calculados sobre as operações que passam pelos filtros de tela.
 */
import { money } from "@/src/domain/core/format";
import { Metric } from "@/src/features/operations/components/status";
import { type CentralMetrics as CentralMetricsData } from "./central-model";

export function CentralMetrics({ metrics, filterContext }: { metrics: CentralMetricsData; filterContext: string }) {
  return (
    <div className="metrics-groups">
      <section className="metrics-group" aria-label="Resultado financeiro">
        <header>
          <span>RESULTADO FINANCEIRO</span>
          <small>{filterContext}</small>
        </header>
        <div className="metrics-group-grid three">
          <Metric
            label="VOLUME EM PROCESSAMENTO"
            value={money.format(metrics.total)}
            hint={`${metrics.inProgressOperations.length} em andamento · ${metrics.releasedOperations.length} liberada(s)`}
          />
          <Metric
            label="RECEITA"
            value={money.format(metrics.totalGain)}
            hint={`${metrics.gainPercent.toFixed(2).replace(".", ",")}% sobre a face · inclui liberadas`}
            tone="positive"
          />
          <Metric
            label="TAXA MÉDIA"
            value={`${metrics.averageFinalRate.toFixed(2).replace(".", ",")}% a.m.`}
            hint={`Efetiva · base ${metrics.averageBaseRate.toFixed(2).replace(".", ",")}% a.m.`}
            tone="accent-text"
          />
        </div>
      </section>
      <section className="metrics-group" aria-label="Situação da fila">
        <header>
          <span>SITUAÇÃO DA FILA</span>
          <small>Mesmos filtros</small>
        </header>
        <div className="metrics-group-grid three">
          <Metric
            label="PRONTAS PARA LIBERAR"
            value={money.format(metrics.readyValue)}
            hint={`${metrics.readyCount} operação(ões)`}
            tone="positive"
          />
          <Metric
            label="LIBERADAS"
            value={money.format(metrics.releasedValue)}
            hint={`${metrics.releasedOperations.length} operação(ões) no financeiro`}
            tone="accent-text"
          />
          <Metric
            label="INTERVENÇÕES ABERTAS"
            value={String(metrics.exceptionCount)}
            hint={`${metrics.decisionCount} com decisão pendente`}
            tone="warning-text"
          />
        </div>
      </section>
    </div>
  );
}

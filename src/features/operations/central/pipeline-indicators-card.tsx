"use client";
/**
 * Indicadores da esteira na Central: conversão até a liberação, tempo de ciclo contra o
 * padrão, operações sem intervenção, decisões humanas sobre exceções e as regras do motor
 * que mais param operações.
 */
import { type Operation } from "@/src/domain/core/types";
import { pipelineIndicators } from "@/src/domain/indicators/pipeline";
import { fmtMinutes, fmtPct, IndicatorGrid } from "@/src/features/indicators/indicator-grid";

export function PipelineIndicatorsCard({ operations }: { operations: Operation[] }) {
  const p = pipelineIndicators(operations);
  const slower = p.cycleMinutes > p.standardMinutes;
  return (
    <section className="fn-card lx-ind-card">
      <header className="fn-card-head">
        <div>
          <h2>Indicadores da esteira</h2>
          <p>Operações no recorte da Central · passe o mouse para ver a fonte</p>
        </div>
      </header>
      <IndicatorGrid
        columns={5}
        items={[
          {
            label: "Conversão até liberar",
            value: fmtPct(p.conversion),
            caption: `${p.releasedCount} liberada(s) de ${p.total} · ${p.cancelledCount} cancelada(s)`,
            source: "Operações liberadas ao financeiro ÷ operações não canceladas",
          },
          {
            label: "Tempo de ciclo",
            value: p.cycleMinutes ? fmtMinutes(p.cycleMinutes) : "—",
            caption: p.standardMinutes ? `padrão dos clientes: ${fmtMinutes(p.standardMinutes)}` : "sem histórico",
            tone: p.standardMinutes ? (slower ? "bad" : "good") : "",
            source: "Tempo na etapa atual das operações em andamento × média histórica de cada cliente",
          },
          {
            label: "Sem intervenção",
            value: fmtPct(p.untouchedRate),
            caption: "em andamento sem bloqueio nem alerta relevante",
            source: "Operações em andamento sem bloqueios e com no máximo um alerta",
          },
          {
            label: "Exceções decididas",
            value: String(p.approvedExceptions + p.rejectedExceptions),
            caption: `${p.approvedExceptions} aprovada(s) · ${p.rejectedExceptions} rejeitada(s)`,
            source: "Decisões humanas registradas sobre exceções do motor de elegibilidade",
          },
          {
            label: "Regras avaliadas",
            value: String(p.evaluations),
            caption: p.evaluations
              ? "execuções do motor nas operações"
              : "nenhuma gravada ainda · o motor roda na etapa Risco",
            source: "Avaliações do motor de elegibilidade gravadas nas operações",
          },
        ]}
      />
      {p.topStops.length > 0 && (
        <>
          <p className="lx-note">Regras que mais param operações</p>
          <ul className="lx-ind-list">
            {p.topStops.map(s => (
              <li key={s.rule}>
                <span>{s.rule}</span>
                <b>
                  {s.operations} operação(ões) · {s.count} ocorrência(s)
                </b>
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

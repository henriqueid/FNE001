"use client";

/**
 * Funil de novas contas (Lead → Aprovado) em kanban.
 */
import { dossierReadiness, moveProspect } from "@/src/domain/commercial/actions";
import { daysBetween } from "@/src/domain/commercial/calendar";
import { type CResult, type CommercialState, type Prospect, funnelStages } from "@/src/domain/commercial/types";
import { compact } from "@/src/features/finance/finance-ui";
import { PlusIcon } from "@/src/ui/icons";

export function FunnelTab({
  state,
  repFilter,
  today,
  onApply,
  onNew,
  onLost,
  onOpenDossier,
  onVisit,
  onCommittee,
}: {
  state: CommercialState;
  repFilter: string;
  today: string;
  onApply: (r: CResult) => boolean | Promise<boolean>;
  onNew: () => void;
  onLost: (p: Prospect) => void;
  onOpenDossier: (p: Prospect) => void;
  onVisit: (p: Prospect) => void;
  onCommittee: (p: Prospect) => void;
}) {
  const open = state.prospects.filter(p => !p.lost && (!repFilter || p.repId === repFilter));
  const lost = state.prospects.filter(p => p.lost && (!repFilter || p.repId === repFilter));
  const pipelineValue = open.reduce((sum, prospect) => sum + prospect.potential, 0);
  const readyForCommittee = open.filter(
    prospect => dossierReadiness(prospect).ready && prospect.stage === "Proposta",
  ).length;
  return (
    <>
      <section className="cm-pipeline-overview">
        <div>
          <span>LEADS ATIVOS</span>
          <strong>{open.length}</strong>
          <small>na esteira comercial</small>
        </div>
        <div>
          <span>POTENCIAL</span>
          <strong>{compact(pipelineValue)}</strong>
          <small>limites em avaliação</small>
        </div>
        <div>
          <span>PRONTOS PARA COMITÊ</span>
          <strong>{readyForCommittee}</strong>
          <small>dossiês completos</small>
        </div>
        <div>
          <span>DECISÕES HISTÓRICAS</span>
          <strong>{state.committees.filter(item => item.status !== "Em pauta").length}</strong>
          <small>com trilha auditável</small>
        </div>
      </section>
      <section className="fn-card cm-funnel-card">
        <header className="fn-card-head">
          <div>
            <h2>Esteira de originação</h2>
            <p>Do lead ao cedente · cada oportunidade mantém dossiê, documentos e histórico</p>
          </div>
          <button className="fn-btn primary" onClick={onNew}>
            <PlusIcon /> Nova oportunidade
          </button>
        </header>
        <div className="cm-kanban">
          {funnelStages.map((s, si) => {
            const list = open.filter(p => p.stage === s);
            return (
              <div key={s} className="cm-col">
                <header>
                  <b>{s}</b>
                  <span>
                    {list.length} · {compact(list.reduce((a, p) => a + p.potential, 0))}
                  </span>
                </header>
                {list.map(p => (
                  <article key={p.id} className="cm-lead-card">
                    <button className="cm-lead-title" onClick={async () => onOpenDossier(p)}>
                      <b>{p.name}</b>
                      <span>{p.document || p.dossier?.document || "CNPJ pendente"}</span>
                    </button>
                    <small>
                      {state.reps.find(r => r.id === p.repId)?.name} · {p.source}
                    </small>
                    <p>{p.nextStep}</p>
                    <div className="cm-readiness-row">
                      <span>Dossiê</span>
                      <i>
                        <em style={{ width: `${dossierReadiness(p).percent}%` }} />
                      </i>
                      <b>{dossierReadiness(p).percent}%</b>
                    </div>
                    <div className="cm-card-foot">
                      <span>{compact(p.dossier?.requestedLimit || p.potential)} solicitados</span>
                      <span>{daysBetween(p.updatedAt, today)}d na etapa</span>
                    </div>
                    {(() => {
                      const visits = state.visits.filter(
                        visit => visit.prospectId === p.id || (!visit.prospectId && visit.target === p.name),
                      );
                      const completed = visits.filter(visit => visit.status === "Realizada").length;
                      return (
                        <div className="cm-lead-evidence">
                          <span>{visits.length ? `${visits.length} visita(s)` : "Sem visita"}</span>
                          <span className={completed ? "ready" : "pending"}>
                            {completed ? `${completed} relatório(s)` : "Relatório pendente"}
                          </span>
                        </div>
                      );
                    })()}
                    <div className="cm-card-actions">
                      <button className="fn-btn small ghost" onClick={async () => onOpenDossier(p)}>
                        Proposta e dossiê
                      </button>
                      {si > 0 && (
                        <button
                          className="fn-btn small ghost"
                          onClick={async () => await onApply(moveProspect(state, p.id, funnelStages[si - 1]))}
                          aria-label="Voltar etapa"
                        >
                          ←
                        </button>
                      )}
                      {s === "Lead" ? (
                        <button className="fn-btn small primary" onClick={async () => onVisit(p)}>
                          Agendar visita
                        </button>
                      ) : s === "Visita" ? (
                        <button
                          className="fn-btn small primary"
                          onClick={async () => {
                            const result = moveProspect(state, p.id, "Proposta");
                            if (await onApply(result)) {
                              const updated = result.state.prospects.find(item => item.id === p.id);
                              if (updated) onOpenDossier(updated);
                            }
                          }}
                        >
                          Preparar proposta
                        </button>
                      ) : s === "Proposta" ? (
                        <button
                          className="fn-btn small primary"
                          disabled={!dossierReadiness(p).ready}
                          onClick={async () => onCommittee(p)}
                        >
                          Enviar ao comitê
                        </button>
                      ) : s === "Comitê" ? (
                        <span className="fn-chip warn">Em pauta</span>
                      ) : s === "Aprovado" ? (
                        <span className={`fn-chip ${p.convertedAt ? "ok" : "warn"}`}>
                          {p.convertedAt ? "Cedente criado" : "Cadastro pendente"}
                        </span>
                      ) : null}
                      <button className="fn-btn small link" onClick={async () => onLost(p)}>
                        Perdido
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            );
          })}
        </div>
      </section>
      <section className="fn-card cm-lost-history">
        <header className="fn-card-head">
          <div>
            <h2>Histórico de encerrados e reprovados</h2>
            <p>O registro permanece consultável para futuras análises.</p>
          </div>
          <span className="fn-chip">{lost.length} registro(s)</span>
        </header>
        {lost.length ? (
          <div className="cm-history-grid">
            {lost.map(prospect => (
              <button key={prospect.id} onClick={async () => onOpenDossier(prospect)}>
                <span>
                  <b>{prospect.name}</b>
                  <small>{prospect.rejectedAt ? "Reprovado pelo comitê" : "Oportunidade encerrada"}</small>
                </span>
                <em>{prospect.lost}</em>
              </button>
            ))}
          </div>
        ) : (
          <div className="fn-empty">Nenhum lead encerrado ou reprovado.</div>
        )}
      </section>
    </>
  );
}

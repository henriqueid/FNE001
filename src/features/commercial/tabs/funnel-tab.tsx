"use client";

/**
 * Funil de novas contas (Lead → Aprovado) em kanban.
 */
import { moveProspect } from "@/src/domain/commercial/actions";
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
  onConvert,
  onCommittee,
}: {
  state: CommercialState;
  repFilter: string;
  today: string;
  onApply: (r: CResult) => boolean;
  onNew: () => void;
  onLost: (p: Prospect) => void;
  onConvert: (p: Prospect) => void;
  onCommittee: (p: Prospect) => void;
}) {
  const open = state.prospects.filter(p => !p.lost && (!repFilter || p.repId === repFilter));
  const lost = state.prospects.filter(p => p.lost && (!repFilter || p.repId === repFilter));
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Funil de novas contas</h2>
          <p>Do primeiro contato à conta nova · potencial em volume mensal</p>
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
                <article key={p.id}>
                  <b>{p.name}</b>
                  <small>
                    {state.reps.find(r => r.id === p.repId)?.name} · {p.source}
                  </small>
                  <p>{p.nextStep}</p>
                  <div className="cm-card-foot">
                    <span>{compact(p.potential)}/mês</span>
                    <span>{daysBetween(p.updatedAt, today)}d na etapa</span>
                  </div>
                  <div className="cm-card-actions">
                    {si > 0 && (
                      <button
                        className="fn-btn small ghost"
                        onClick={() => onApply(moveProspect(state, p.id, funnelStages[si - 1]))}
                        aria-label="Voltar etapa"
                      >
                        ←
                      </button>
                    )}
                    {s === "Proposta" ? (
                      <button className="fn-btn small ghost" onClick={() => onCommittee(p)}>
                        Enviar ao comitê
                      </button>
                    ) : s === "Aprovado" ? (
                      <button className="fn-btn small primary" onClick={() => onConvert(p)}>
                        Virar conta nova
                      </button>
                    ) : (
                      s !== "Comitê" && (
                        <button
                          className="fn-btn small ghost"
                          onClick={() => onApply(moveProspect(state, p.id, funnelStages[si + 1]))}
                        >
                          Avançar →
                        </button>
                      )
                    )}
                    <button className="fn-btn small link" onClick={() => onLost(p)}>
                      Perdido
                    </button>
                  </div>
                </article>
              ))}
            </div>
          );
        })}
      </div>
      {lost.length > 0 && <p className="fn-note">Perdidas: {lost.map(p => `${p.name} (${p.lost})`).join(" · ")}</p>}
    </section>
  );
}

"use client";

/**
 * Detalhe da análise na caixa expandida do Copiloto: valores do motor, apontamentos com o tipo de evidência,
 * score do cedente, títulos com inclusão e retirada (cada mudança gera um cenário novo) e histórico de cenários.
 */
import { centsToBRL, type DeskScenario, percentBR } from "@/src/domain/copilot/desk-engine";
import { buildDeskSummary } from "@/src/domain/copilot/desk-summary";
import { type SystemKnowledge } from "@/src/domain/copilot/system-query";
import { type Cedent } from "@/src/domain/core/types";
import { OperationSummary } from "./copilot-summary";
import { DecisionBar, type CopilotOperationActions } from "./copilot-decision-bar";
import { type CopilotDesk } from "./use-copilot-desk";

const severityLabel = { impedimento: "Impedimento", alcada: "Exige alçada", info: "Informação" } as const;

export function DeskMoney({ scenario, compact = false }: { scenario: DeskScenario; compact?: boolean }) {
  const { result } = scenario;
  return (
    <dl className={`cpl-money${compact ? " is-compact" : ""}`}>
      <div className="cpl-money-net">
        <dt>Líquido ao cedente</dt>
        <dd>{centsToBRL(result.netCents)}</dd>
        <small>Custo efetivo {percentBR(result.allInMonthly, 2)} a.m.</small>
      </div>
      <div>
        <dt>Valor de face</dt>
        <dd>{centsToBRL(result.faceCents)}</dd>
      </div>
      <div>
        <dt>Deságio ({percentBR(scenario.ratePercent, 2)} a.m.)</dt>
        <dd>{centsToBRL(result.discountCents)}</dd>
      </div>
      <div>
        <dt>Tarifas</dt>
        <dd>{centsToBRL(result.feesCents)}</dd>
      </div>
      <div>
        <dt>IOF (alíquota de demonstração)</dt>
        <dd>{centsToBRL(result.iofCents)}</dd>
      </div>
      {!compact && (
        <div>
          <dt>Prazo médio</dt>
          <dd>{Math.round(result.averageDays)} dias</dd>
        </div>
      )}
    </dl>
  );
}

export function DeskGate({ scenario }: { scenario: DeskScenario }) {
  const { result } = scenario;
  if (result.fastTrack)
    return (
      <div className="cpl-gate" data-tone="good">
        <b>Aprovação rápida disponível</b>
        <span>Nenhum impedimento e tudo dentro da sua alçada.</span>
      </div>
    );
  const items = result.blockers.length ? result.blockers : result.exceptions;
  return (
    <div className="cpl-gate" data-tone={result.blockers.length ? "bad" : "warn"}>
      <b>{result.blockers.length ? "Aprovação bloqueada" : "Precisa de alçada ou ajuste"}</b>
      <ul>
        {items.map(item => (
          <li key={item.id}>{item.title}</li>
        ))}
      </ul>
    </div>
  );
}

export function CopilotAnalysis({
  desk,
  cedent,
  knowledge,
  operationActions,
}: {
  desk: CopilotDesk;
  cedent?: Cedent;
  knowledge: SystemKnowledge;
  operationActions: CopilotOperationActions;
}) {
  const scenario = desk.scenarios[desk.scenarios.length - 1];
  if (!scenario) return null;
  const { result } = scenario;
  const titles = desk.context.titles;
  const policy = desk.context.policy;
  const summary = buildDeskSummary(scenario, desk.context, cedent, knowledge.titles, knowledge.today);
  return (
    <div className="cpl-analysis">
      <header className="cpl-op-head">
        <div>
          <span>Resumo da operação</span>
          <h2>{cedent?.name ?? "Cedente"}</h2>
          <small>
            {cedent?.document}, cenário v{scenario.version}, política {policy.name} v{policy.version}
          </small>
        </div>
        <div className="cpl-op-net">
          <span>Líquido ao cedente</span>
          <strong>{centsToBRL(result.netCents)}</strong>
        </div>
      </header>
      <DeskGate scenario={scenario} />
      <DecisionBar desk={desk} operationActions={operationActions} />
      <dl className="cpl-kpis">
        <div>
          <dt>Valor de face</dt>
          <dd>{centsToBRL(result.faceCents)}</dd>
        </div>
        <div>
          <dt>Custo efetivo</dt>
          <dd>{percentBR(result.allInMonthly, 2)} a.m.</dd>
        </div>
        <div>
          <dt>Prazo médio</dt>
          <dd>{Math.round(result.averageDays)} dias</dd>
        </div>
        <div>
          <dt>Títulos e sacados</dt>
          <dd>
            {result.count} / {summary.debtors.length}
          </dd>
        </div>
      </dl>

      <OperationSummary
        scenario={scenario}
        summary={summary}
        cedent={cedent}
        bands={knowledge.parameters.scoreBands}
        concentrationLimit={policy.concentrationLimit}
      />

      <section>
        <h3>Apontamentos</h3>
        <ul className="cpl-findings">
          {result.findings.map(finding => (
            <li key={finding.id} data-tone={finding.severity}>
              <span className="cpl-tag">{severityLabel[finding.severity]}</span>
              <div>
                <b>{finding.title}</b>
                <small className="cpl-evidence">
                  {finding.kind} · {finding.evidence}
                </small>
                <p>{finding.detail}</p>
              </div>
              {finding.question && (
                <button
                  type="button"
                  className="cpl-ghost"
                  disabled={desk.locked}
                  onClick={() => desk.ask(finding.question ?? "")}
                >
                  Perguntar
                </button>
              )}
            </li>
          ))}
        </ul>
      </section>

      <section>
        <h3>Títulos</h3>
        <div className="cpl-table">
          <table>
            <thead>
              <tr>
                <th>
                  <span className="cpl-sr">Incluir</span>
                </th>
                <th>Documento</th>
                <th>Sacado</th>
                <th>Origem</th>
                <th className="num">Prazo</th>
                <th className="num">Valor</th>
              </tr>
            </thead>
            <tbody>
              {titles.map(title => {
                const included = scenario.included.includes(title.id);
                return (
                  <tr key={title.id} className={included ? "" : "is-off"}>
                    <td>
                      <input
                        type="checkbox"
                        checked={included}
                        disabled={desk.locked}
                        onChange={() => desk.toggleTitle(title.id)}
                        aria-label={`Incluir ${title.document}`}
                      />
                    </td>
                    <td>
                      {title.document}
                      {title.duplicate && (
                        <span className="cpl-flag" data-tone="bad">
                          Duplicado
                        </span>
                      )}
                      {title.newDebtor && <span className="cpl-flag">Sacado novo</span>}
                      {title.days < policy.minDays && (
                        <span className="cpl-flag" data-tone="warn">
                          Prazo curto
                        </span>
                      )}
                    </td>
                    <td>{title.debtor}</td>
                    <td>{title.source}</td>
                    <td className="num">{title.days} d</td>
                    <td className="num">{centsToBRL(title.amountCents)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>

      <section>
        <h3>Cenários</h3>
        <ol className="cpl-scenarios" reversed>
          {desk.scenarios
            .slice()
            .reverse()
            .map((item, index, list) => {
              const previous = list[index + 1];
              const delta = previous ? item.result.netCents - previous.result.netCents : 0;
              return (
                <li key={item.version}>
                  <b>v{item.version}</b>
                  <span>{item.label}</span>
                  <strong data-tone={delta > 0 ? "good" : delta < 0 ? "bad" : undefined}>
                    {previous
                      ? `${delta >= 0 ? "+" : "−"}${centsToBRL(Math.abs(delta))}`
                      : centsToBRL(item.result.netCents)}
                  </strong>
                </li>
              );
            })}
        </ol>
        <p className="cpl-note">
          Cada mudança cria uma versão nova com autor, política {policy.name} v{policy.version} e diferença no líquido.
          Nenhuma versão é sobrescrita.
        </p>
      </section>

      <section>
        <h3>Trilha de decisão</h3>
        <ol className="cpl-scenarios">
          {desk.decisionLedger.events.map(event => (
            <li key={event.eventId}>
              <b>v{event.eventVersion}</b>
              <span>{event.eventType.replaceAll("_", " ")}</span>
              <strong>{event.outcome}</strong>
            </li>
          ))}
        </ol>
        <p className="cpl-note">
          Registro somente de acréscimo. Correções e revisões entram como novos eventos, sem apagar a decisão anterior.
        </p>
      </section>
    </div>
  );
}

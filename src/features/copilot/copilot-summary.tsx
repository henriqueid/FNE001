"use client";

/**
 * Resumo visual da operação na análise completa do Copiloto: composição do valor, score do cedente (gauge com as
 * faixas da política), posição do cedente (limite e carteira), sacados (participação x limite da política e
 * posição na carteira), prazos e checagem da política. Só desenha o que `buildDeskSummary` calcula.
 */
import { centsToBRL, type DeskScenario, percentBR } from "@/src/domain/copilot/desk-engine";
import { type DeskSummary } from "@/src/domain/copilot/desk-summary";
import { type Cedent } from "@/src/domain/core/types";
import { type OperationalParameters } from "@/src/domain/eligibility/operational-parameters";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";

const share = (part: number, total: number) => (total > 0 ? Math.max(0, Math.min(100, (part / total) * 100)) : 0);

function polar(cx: number, cy: number, r: number, fraction: number) {
  const angle = Math.PI * (1 - fraction);
  return { x: cx + r * Math.cos(angle), y: cy - r * Math.sin(angle) };
}
function arc(cx: number, cy: number, r: number, from: number, to: number) {
  const a = polar(cx, cy, r, from);
  const b = polar(cx, cy, r, to);
  return `M ${a.x.toFixed(2)} ${a.y.toFixed(2)} A ${r} ${r} 0 0 1 ${b.x.toFixed(2)} ${b.y.toFixed(2)}`;
}

function ScoreGauge({ score, bands }: { score: number; bands: OperationalParameters["scoreBands"] }) {
  const value = Math.max(0, Math.min(1000, score)) / 1000;
  const attention = bands.attention / 1000;
  const positive = bands.positive / 1000;
  const marker = polar(100, 96, 78, value);
  const tone = score >= bands.positive ? "good" : score >= bands.attention ? "warn" : "bad";
  const label = tone === "good" ? "Positivo" : tone === "warn" ? "Atenção" : "Crítico";
  return (
    <div className="cpl-gauge" data-tone={tone}>
      <svg viewBox="0 0 200 112" role="img" aria-label={`Score ${score} de 1000, faixa ${label}`}>
        <path d={arc(100, 96, 78, 0, attention)} className="band-bad" />
        <path d={arc(100, 96, 78, attention, positive)} className="band-warn" />
        <path d={arc(100, 96, 78, positive, 1)} className="band-good" />
        <circle cx={marker.x} cy={marker.y} r="9" className="marker" />
        <text x="100" y="84" textAnchor="middle" className="value">
          {score}
        </text>
        <text x="100" y="104" textAnchor="middle" className="caption">
          de 1000
        </text>
      </svg>
      <span className="cpl-gauge-label">{label}</span>
      <small>
        Faixas da política: crítico abaixo de {bands.attention}, positivo a partir de {bands.positive}
      </small>
    </div>
  );
}

export function OperationSummary({
  scenario,
  summary,
  cedent,
  bands,
  concentrationLimit,
}: {
  scenario: DeskScenario;
  summary: DeskSummary;
  cedent?: Cedent;
  bands: OperationalParameters["scoreBands"];
  concentrationLimit: number;
}) {
  const face = scenario.result.faceCents;
  const maxTerm = Math.max(1, ...summary.terms.map(term => term.cents));
  const maxShare = Math.max(concentrationLimit + 10, ...summary.debtors.map(item => item.operationShare));
  return (
    <>
      <div className="cpl-sum-grid">
        <section className="cpl-panel">
          <h3>Composição do valor</h3>
          <ul className="cpl-waterfall">
            {summary.waterfall.map(item => (
              <li key={item.label} data-kind={item.kind}>
                <span>{item.label}</span>
                <i>
                  <b style={{ width: `${Math.max(item.kind === "minus" ? 1.5 : 0, share(item.cents, face))}%` }} />
                </i>
                <strong>
                  {item.kind === "minus" ? "−" : ""}
                  {centsToBRL(item.cents)}
                </strong>
              </li>
            ))}
          </ul>
          <p className="cpl-note">
            Custo efetivo para o cedente: {percentBR(scenario.result.allInMonthly, 2)} a.m. Taxa aplicada{" "}
            {percentBR(scenario.ratePercent, 2)} a.m., método nominal.
          </p>
        </section>

        <section className="cpl-panel">
          <h3>Score do cedente</h3>
          {cedent ? (
            <>
              <ScoreGauge score={cedent.score} bands={bands} />
              {summary.quality && (
                <dl className="cpl-indicators">
                  <div>
                    <dt>Pontualidade</dt>
                    <dd>{percentBR(summary.quality.onTime)}</dd>
                  </div>
                  <div>
                    <dt>Atraso médio</dt>
                    <dd>{summary.quality.averageDelayDays} dias</dd>
                  </div>
                  <div>
                    <dt>Recompras</dt>
                    <dd>{summary.quality.repurchases}</dd>
                  </div>
                  <div>
                    <dt>Ocorrências</dt>
                    <dd>{summary.quality.incidents}</dd>
                  </div>
                </dl>
              )}
            </>
          ) : (
            <p className="cpl-note">Cedente sem cadastro.</p>
          )}
        </section>
      </div>

      {cedent && (
        <section className="cpl-panel">
          <h3>Motivos do score</h3>
          <ul className="cpl-reasons">
            {(cedent.scoreReasons ?? []).map(reason => (
              <li key={reason}>{reason}</li>
            ))}
            {cedent.bureauScore ? <li>Score do birô {cedent.bureauScore}, em campo separado</li> : null}
          </ul>
        </section>
      )}

      {summary.limit && (
        <section className="cpl-panel">
          <div className="cpl-panel-head">
            <h3>Posição do cedente</h3>
            <span data-tone={summary.limit.useAfter > 100 ? "bad" : summary.limit.useAfter > 80 ? "warn" : "good"}>
              {percentBR(summary.limit.useAfter)} do limite após a operação
            </span>
          </div>
          <div className="cpl-limit-bar" aria-label="Uso do limite">
            <i
              className="used"
              style={{ width: `${share(summary.limit.usedCents, summary.limit.limitCents)}%` }}
              title="Já utilizado"
            />
            <i
              className="op"
              style={{
                width: `${Math.min(
                  100 - share(summary.limit.usedCents, summary.limit.limitCents),
                  share(summary.limit.operationCents, summary.limit.limitCents),
                )}%`,
              }}
              title="Esta operação"
            />
          </div>
          <div className="cpl-legend">
            <span>
              <i className="used" /> Já utilizado <b>{centsToBRL(summary.limit.usedCents)}</b>
            </span>
            <span>
              <i className="op" /> Esta operação <b>{centsToBRL(summary.limit.operationCents)}</b>
            </span>
            <span>
              <i className="free" /> Disponível depois{" "}
              <b>{centsToBRL(Math.max(0, summary.limit.availableAfterCents))}</b>
            </span>
          </div>
          {summary.cedentPortfolio && (
            <dl className="cpl-indicators is-row">
              <div>
                <dt>Limite aprovado</dt>
                <dd>{centsToBRL(summary.limit.limitCents)}</dd>
              </div>
              <div>
                <dt>Carteira em aberto</dt>
                <dd>{centsToBRL(summary.cedentPortfolio.openCents)}</dd>
                <small>{summary.cedentPortfolio.titles} títulos</small>
              </div>
              <div>
                <dt>Vencido na carteira</dt>
                <dd data-tone={summary.cedentPortfolio.overdueCents ? "bad" : undefined}>
                  {centsToBRL(summary.cedentPortfolio.overdueCents)}
                </dd>
                <small>{summary.cedentPortfolio.overdueTitles} títulos</small>
              </div>
            </dl>
          )}
        </section>
      )}

      <section className="cpl-panel">
        <div className="cpl-panel-head">
          <h3>Sacados da operação</h3>
          <span>Linha tracejada: limite da política ({concentrationLimit}%)</span>
        </div>
        <ul className="cpl-debtors">
          {summary.debtors.map(item => {
            const over = item.operationShare > concentrationLimit;
            return (
              <li key={item.name}>
                <div className="cpl-debtor-top">
                  <b>{item.name}</b>
                  <strong>{centsToBRL(item.operationCents)}</strong>
                </div>
                <div className="cpl-share-bar" data-over={over || undefined}>
                  <i style={{ width: `${share(item.operationShare, maxShare)}%` }} />
                  <em style={{ left: `${share(concentrationLimit, maxShare)}%` }} />
                </div>
                <div className="cpl-debtor-meta">
                  <span data-tone={over ? "bad" : undefined}>
                    {percentBR(item.operationShare)} da operação, {item.titles} título(s)
                  </span>
                  {item.flags.map(flag => (
                    <span key={flag} className="cpl-flag" data-tone={flag === "Título duplicado" ? "bad" : undefined}>
                      {flag}
                    </span>
                  ))}
                </div>
                <p>
                  {item.portfolioTitles
                    ? `Na carteira: ${centsToBRL(item.portfolioCents)} em ${item.portfolioTitles} título(s)${
                        item.portfolioOverdueCents
                          ? `, ${centsToBRL(item.portfolioOverdueCents)} vencido`
                          : ", nada vencido"
                      }. Depois da operação: ${percentBR(item.portfolioShareAfter)} da carteira.`
                    : `Sem títulos na carteira. Depois da operação: ${percentBR(item.portfolioShareAfter)} da carteira.`}
                </p>
              </li>
            );
          })}
        </ul>
      </section>

      <div className="cpl-sum-grid">
        <section className="cpl-panel">
          <h3>Prazos dos títulos</h3>
          <ul className="cpl-terms">
            {summary.terms.map(term => (
              <li key={term.label}>
                <span>{term.label}</span>
                <i>
                  <b style={{ width: `${share(term.cents, maxTerm)}%` }} />
                </i>
                <strong>{term.titles ? centsToBRL(term.cents) : "—"}</strong>
              </li>
            ))}
          </ul>
          <p className="cpl-note">Prazo médio ponderado: {Math.round(scenario.result.averageDays)} dias.</p>
        </section>

        <section className="cpl-panel">
          <h3>Checagem da política</h3>
          <ul className="cpl-checks">
            {summary.checks.map(check => (
              <li key={check.label} data-ok={check.ok || undefined}>
                <span className="cpl-check-icon">{check.ok ? <CheckIcon /> : <AlertIcon />}</span>
                <div>
                  <b>{check.label}</b>
                  <small>
                    {check.observed}; regra: {check.rule}
                  </small>
                </div>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </>
  );
}

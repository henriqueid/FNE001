"use client";
/**
 * Panorama do cliente (abre ao clicar num cliente do ranking piorando × melhorando):
 * resumo em uma frase, o que moveu o índice (componente a componente, com antes → agora e
 * impacto em pontos), evolução de 6 meses contra o patamar saudável, carteira de hoje por
 * faixa de atraso, maiores títulos em aberto e operações recentes. Setas ← → percorrem o
 * ranking, para apresentar cliente a cliente.
 */
import { type Operation } from "@/src/domain/core/types";
import { daysFrom } from "@/src/domain/indicators/portfolio";
import { bucketLabels } from "@/src/domain/risk/portfolio-dynamics";
import { type ComponentBreakdown, type QualityTrend } from "@/src/domain/risk/quality";
import { type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { compact, pct } from "@/src/features/home/widgets";
import { type AppView } from "@/src/features/shell/shell-context";
import { ArrowIcon, BackIcon, CloseIcon } from "@/src/ui/icons";
import { useEffect } from "react";
import { createPortal } from "react-dom";

type Title = { id: string; reference: string; debtorName: string; ownerName: string; dueDate: string; amount: number };

const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")}`;
const monthName = (m: string) =>
  new Date(`${m}-15T12:00:00`).toLocaleDateString("pt-BR", { month: "short" }).replace(".", "");

function ImpactBars({ rows }: { rows: ComponentBreakdown[] }) {
  const max = Math.max(1, ...rows.map(r => Math.abs(r.impact)));
  return (
    <ul className="cp-impact">
      {rows.map(r => {
        const w = (Math.abs(r.impact) / max) * 50;
        return (
          <li key={r.id}>
            <div className="cp-impact-label">
              <b>{r.label}</b>
              <span>
                {r.beforeText} → <strong>{r.afterText}</strong>
              </span>
            </div>
            <div className="cp-impact-track" aria-hidden="true">
              <i className="mid" />
              {Math.abs(r.impact) >= 0.05 && (
                <i
                  className={r.impact < 0 ? "neg" : "pos"}
                  style={r.impact < 0 ? { right: "50%", width: `${w}%` } : { left: "50%", width: `${w}%` }}
                />
              )}
            </div>
            <em className={r.impact < -0.05 ? "neg" : r.impact > 0.05 ? "pos" : ""}>{pts(r.impact)} pts</em>
          </li>
        );
      })}
    </ul>
  );
}

function IndexChart({ months, values, healthy }: { months: string[]; values: number[]; healthy: number }) {
  const W = 640,
    H = 170,
    L = 30,
    R = 14,
    T = 18,
    B = 24;
  const lo = Math.max(0, Math.floor((Math.min(healthy, ...values) - 10) / 10) * 10);
  const hi = Math.min(100, Math.ceil((Math.max(healthy, ...values) + 8) / 10) * 10);
  const ticks = [lo, Math.round((lo + hi) / 2), hi];
  const x = (i: number) => L + (i / Math.max(1, values.length - 1)) * (W - L - R);
  const y = (v: number) => T + (1 - (v - lo) / Math.max(1, hi - lo)) * (H - T - B);
  const d = values.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  return (
    <svg className="cp-index" viewBox={`0 0 ${W} ${H}`} role="img" aria-label="Índice de qualidade mês a mês">
      {ticks.map(v => (
        <g key={v}>
          <line x1={L} x2={W - R} y1={y(v)} y2={y(v)} className="grid" />
          <text x={L - 6} y={y(v) + 4} textAnchor="end" className="tick">
            {v}
          </text>
        </g>
      ))}
      <line x1={L} x2={W - R} y1={y(healthy)} y2={y(healthy)} className="healthy" />
      <text x={L + 6} y={y(healthy) + 14} className="healthy-label">
        patamar saudável {healthy}
      </text>
      <path d={d} className="ln" />
      {values.map((v, i) => (
        <g key={months[i]}>
          <circle cx={x(i)} cy={y(v)} r={4} className={`pt${v < healthy ? " low" : ""}`} />
          <text x={x(i)} y={y(v) - 9} textAnchor="middle" className="val">
            {Math.round(v)}
          </text>
          <text x={x(i)} y={H - 6} textAnchor="middle" className="tick">
            {monthName(months[i])}
          </text>
        </g>
      ))}
    </svg>
  );
}

export function ClientPanel({
  trend,
  position,
  total,
  policy,
  titles,
  operations,
  today,
  onPrev,
  onNext,
  onClose,
  onNavigate,
  onOpenOperation,
}: {
  trend: QualityTrend;
  position: number;
  total: number;
  policy: QualityPolicy;
  titles: Title[];
  operations: Operation[];
  today: string;
  onPrev?: () => void;
  onNext?: () => void;
  onClose: () => void;
  onNavigate?: (view: AppView) => void;
  onOpenOperation?: (op: Operation) => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose, onPrev, onNext]);

  const t = trend;
  const down = t.delta < 0;
  const latest = t.latest;
  const balance = latest?.openBalance ?? 0;
  const overdue30 = latest?.overdue30 ?? 0;
  const buckets = latest?.buckets ?? [0, 0, 0, 0, 0];
  const bucketTotal = buckets.reduce((s, v) => s + v, 0) || 1;
  const moved = t.components.filter(c => Math.abs(c.impact) >= 0.05);
  const steady = t.components.filter(c => Math.abs(c.impact) < 0.05);
  const topMoved = [...moved].sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact)).slice(0, 4);
  const open = [...titles]
    .map(x => ({ ...x, late: daysFrom(x.dueDate, today) }))
    .sort((a, b) => b.late - a.late || b.amount - a.amount)
    .slice(0, 8);
  const ops = operations.slice(0, 6);
  const cellTone = (c: ComponentBreakdown, v: number) => {
    const score = c.good === c.bad ? 1 : Math.max(0, Math.min(1, (v - c.bad) / (c.good - c.bad)));
    return score >= 0.75 ? "good" : score >= 0.4 ? "mid" : "bad";
  };
  const fmt = (c: ComponentBreakdown, v: number) =>
    c.unit === "%" ? pct(v, v < 10 ? 1 : 0) : c.unit === "dias" ? `${Math.round(v)}d` : `${Math.round(v)}`;

  if (typeof document === "undefined") return null;
  return createPortal(
    <>
      <button type="button" className="cp-scrim" aria-label="Fechar panorama" onClick={onClose} />
      <aside className="cp-panel" role="dialog" aria-modal="true" aria-labelledby="cp-title">
        <header className="cp-head">
          <div className="cp-nav">
            <button
              type="button"
              className="lx-square"
              aria-label="Cliente anterior"
              disabled={!onPrev}
              onClick={onPrev}
            >
              <BackIcon />
            </button>
            <span>
              {position} de {total} · {down ? "piorando" : "melhorando"}
            </span>
            <button
              type="button"
              className="lx-square"
              aria-label="Próximo cliente"
              disabled={!onNext}
              onClick={onNext}
            >
              <ArrowIcon />
            </button>
          </div>
          <button type="button" className="lx-square" aria-label="Fechar" onClick={onClose}>
            <CloseIcon />
          </button>
        </header>

        <div className="cp-title">
          <span className="lx-label">
            {t.kind === "cedente" ? "Cedente" : "Sacado"} · {t.document}
          </span>
          <h2 id="cp-title">{t.name}</h2>
          <p className={`cp-summary ${down ? "down" : "up"}`}>{t.summary}</p>
        </div>

        <div className="cp-kpis">
          <div>
            <span className="lx-label">Índice de qualidade</span>
            <strong>
              {Math.round(t.previousIndex)} → {Math.round(t.index)}
            </strong>
            <em className={`lx-pill ${down ? "down" : "up"}`}>{pts(t.delta)} pts</em>
          </div>
          <div>
            <span className="lx-label">Exposição</span>
            <strong>{compact(t.exposure)}</strong>
            <small>carteira em aberto</small>
          </div>
          <div>
            <span className="lx-label">Vencido &gt; 30 dias</span>
            <strong className={overdue30 > 0 ? "bad" : ""}>{compact(overdue30)}</strong>
            <small>{pct(balance ? (overdue30 / balance) * 100 : 0)} do saldo</small>
          </div>
          <div>
            <span className="lx-label">{t.kind === "cedente" ? "Uso do limite" : "Score de bureau"}</span>
            <strong>
              {t.kind === "cedente" ? pct(latest?.limitUse ?? 0, 0) : Math.round(latest?.bureauScore ?? 0)}
            </strong>
            <small>último fechamento</small>
          </div>
        </div>

        <section className="cp-section">
          <header>
            <h3>O que moveu o índice</h3>
            <small>
              Últimos {policy.windowMonths * 30} dias × {policy.windowMonths * 30} anteriores · impacto em pontos do
              índice
            </small>
          </header>
          <ImpactBars rows={moved.length ? moved : t.components} />
          {steady.length > 0 && moved.length > 0 && (
            <p className="lx-note">Sem variação relevante: {steady.map(c => c.label.toLowerCase()).join(", ")}.</p>
          )}
        </section>

        <section className="cp-section">
          <header>
            <h3>Evolução em 6 meses</h3>
            <small>
              Índice na janela móvel de {policy.windowMonths * 30} dias e, abaixo, cada componente mês a mês (verde
              perto do “bom” da política, vermelho perto do “ruim”)
            </small>
          </header>
          <div className="cp-index-wrap">
            <IndexChart months={t.monthly.map(m => m.month)} values={t.series} healthy={policy.healthyIndex} />
          </div>
          {topMoved.length > 0 && (
            <div className="cp-heat-wrap">
              <table className="cp-heat">
                <thead>
                  <tr>
                    <th>Componente</th>
                    {t.monthly.map(m => (
                      <th key={m.month}>{monthName(m.month)}</th>
                    ))}
                    <th>Bom · ruim</th>
                  </tr>
                </thead>
                <tbody>
                  {topMoved.map(c => (
                    <tr key={c.id}>
                      <th scope="row">{c.label}</th>
                      {t.monthly.map(m => (
                        <td key={m.month} className={cellTone(c, m.values[c.id])}>
                          {fmt(c, m.values[c.id])}
                        </td>
                      ))}
                      <td className="cp-range">
                        {fmt(c, c.good)} · {fmt(c, c.bad)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        <section className="cp-section">
          <header>
            <h3>Carteira hoje</h3>
            <small>Último fechamento por faixa de atraso · {compact(balance)} em aberto</small>
          </header>
          <div className="cp-stack" role="img" aria-label="Saldo por faixa de atraso">
            {buckets.map((v, k) =>
              v > 0 ? (
                <i
                  key={k}
                  className={`b${k}`}
                  style={{ width: `${(v / bucketTotal) * 100}%` }}
                  title={`${bucketLabels[k]}: ${compact(v)}`}
                />
              ) : null,
            )}
          </div>
          <ul className="cp-stack-legend">
            {buckets.map((v, k) => (
              <li key={k}>
                <i className={`b${k}`} />
                {bucketLabels[k]} <b>{compact(v)}</b>
              </li>
            ))}
          </ul>
          {open.length > 0 ? (
            <table className="cp-table">
              <thead>
                <tr>
                  <th>Título</th>
                  <th>{t.kind === "cedente" ? "Sacado" : "Cedente"}</th>
                  <th>Vencimento</th>
                  <th>Valor</th>
                  <th>Situação</th>
                </tr>
              </thead>
              <tbody>
                {open.map(x => (
                  <tr key={x.id}>
                    <td>{x.reference}</td>
                    <td>{t.kind === "cedente" ? x.debtorName : x.ownerName}</td>
                    <td>{x.dueDate.split("-").reverse().join("/")}</td>
                    <td>{compact(x.amount)}</td>
                    <td className={x.late > 30 ? "bad" : x.late > 0 ? "warn" : ""}>
                      {x.late > 0
                        ? `${x.late} dia(s) em atraso`
                        : x.late === 0
                          ? "vence hoje"
                          : `vence em ${-x.late} dia(s)`}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <p className="lx-note">
              Os títulos deste cliente não estão na carteira de demonstração; as faixas acima vêm do último fechamento
              mensal.
            </p>
          )}
        </section>

        {ops.length > 0 && (
          <section className="cp-section">
            <header>
              <h3>Operações</h3>
              <small>Em andamento e liberadas</small>
            </header>
            <ul className="lx-ind-list">
              {ops.map(op => (
                <li key={op.id}>
                  <button type="button" className="cp-op" onClick={() => onOpenOperation?.(op)}>
                    <span>
                      Aditivo {op.aditivoNumber} · {op.status}
                    </span>
                    <b>{compact(op.amount)}</b>
                  </button>
                </li>
              ))}
            </ul>
          </section>
        )}

        <footer className="cp-foot">
          <div>
            <span className="lx-label">Ação sugerida</span>
            <strong>{t.action}</strong>
          </div>
          <div className="cp-actions">
            <button type="button" className="secondary-action" onClick={() => onNavigate?.("portfolio")}>
              Ver na Carteira
            </button>
            <button type="button" className="primary-action" onClick={() => onNavigate?.("registry")}>
              Abrir cadastro
            </button>
          </div>
        </footer>
        <p className="cp-source">
          {policy.name} {policy.version} · pesos e faixas em Critérios · use ← → para passar de cliente
        </p>
      </aside>
    </>,
    document.body,
  );
}

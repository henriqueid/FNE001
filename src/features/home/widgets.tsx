"use client";

/**
 * Peças visuais da Visão geral: KPI, card, variação, segmentado, abas de texto, gauge,
 * botão-ícone quadrado, vazio e dica.
 */
import { money } from "@/src/domain/core/format";
import { ExpandIcon } from "@/src/ui/icons";

export const pct = (value: number, digits = 1) =>
  `${(Number.isFinite(value) ? value : 0).toFixed(digits).replace(".", ",")}%`;

export const int = new Intl.NumberFormat("pt-BR");

export function compact(value: number) {
  const abs = Math.abs(value);
  const sign = value < 0 ? "−" : "";
  if (abs >= 1_000_000) return `${sign}R$ ${(abs / 1_000_000).toFixed(abs >= 10_000_000 ? 1 : 2).replace(".", ",")} mi`;
  if (abs >= 1_000) return `${sign}R$ ${(abs / 1_000).toFixed(abs >= 100_000 ? 0 : 1).replace(".", ",")} mil`;
  return `${sign}${money.format(abs)}`;
}

export function duration(minutes: number) {
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h ? `${h}h${m ? ` ${String(m).padStart(2, "0")}min` : ""}` : `${m} min`;
}

export type Severity = "critical" | "serious" | "watch" | "info";

export const severityOrder: Record<Severity, number> = { critical: 0, serious: 1, watch: 2, info: 3 };

export const severityLabel: Record<Severity, string> = {
  critical: "Crítico",
  serious: "Urgente",
  watch: "Atenção",
  info: "Aviso",
};

export function Delta({
  value,
  previous,
  goodWhenUp = true,
  mode = "percent",
  label,
}: {
  value: number;
  previous: number;
  goodWhenUp?: boolean;
  mode?: "percent" | "points";
  label: string;
}) {
  if (mode === "percent" && previous === 0) {
    return <span className="vg-delta flat">{value === 0 ? `sem movimento ${label}` : `sem base de comparação`}</span>;
  }
  const diff = mode === "percent" ? ((value - previous) / previous) * 100 : value - previous;
  const flat = Math.abs(diff) < 0.05;
  const good = flat ? null : diff > 0 === goodWhenUp;
  return (
    <span className={`vg-delta ${flat ? "flat" : good ? "good" : "bad"}`}>
      <b>
        {flat ? "=" : diff > 0 ? "▲" : "▼"}{" "}
        {flat ? "estável" : `${Math.abs(diff).toFixed(1).replace(".", ",")}${mode === "percent" ? "%" : " p.p."}`}
      </b>{" "}
      {label}
    </span>
  );
}

export type KpiProps = {
  label: string;
  value: string;
  hint?: string;
  delta?: React.ReactNode;
  progress?: { value: number; label: string; tone?: string };
  tone?: string;
  onOpen?: () => void;
};

export function Kpi({ label, value, hint, delta, progress, tone, onOpen }: KpiProps) {
  return (
    <div className={`vg-kpi ${tone ?? ""}`}>
      <header className="vg-kpi-head">
        <span className="vg-kpi-label">{label}</span>
        {onOpen && <IconSquare label={`Abrir ${label.toLowerCase()}`} icon={<ExpandIcon />} onClick={onOpen} />}
      </header>
      <strong>{value}</strong>
      {delta}
      {progress && (
        <div className={`vg-meter ${progress.tone ?? ""}`}>
          <div>
            <i style={{ width: `${Math.min(100, Math.max(0, progress.value))}%` }} />
          </div>
          <small>{progress.label}</small>
        </div>
      )}
      {hint && <small className="vg-kpi-hint">{hint}</small>}
    </div>
  );
}

export function Card({
  title,
  subtitle,
  action,
  children,
  span = 12,
  id,
}: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
  span?: number;
  id?: string;
}) {
  return (
    <section className={`vg-card span-${span}`} id={id}>
      <header className="vg-card-head">
        <div>
          <h2>{title}</h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        {action}
      </header>
      {children}
    </section>
  );
}

export function Segmented<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="vg-seg" role="tablist" aria-label={label}>
      {options.map(o => (
        <button
          key={o.id}
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Empty({ children, action }: { children: React.ReactNode; action?: React.ReactNode }) {
  return (
    <div className="vg-empty">
      <span>{children}</span>
      {action}
    </div>
  );
}

/** Botão quadrado só com ícone (filtros, expandir, navegação). */
export function IconSquare({
  icon,
  label,
  onClick,
  active,
}: {
  icon: React.ReactNode;
  label: string;
  onClick?: () => void;
  active?: boolean;
}) {
  return (
    <button
      type="button"
      className={`lx-square${active ? " is-active" : ""}`}
      aria-label={label}
      title={label}
      onClick={onClick}
    >
      {icon}
    </button>
  );
}

/** Abas de texto com sublinhado (Semana · Mês · Trimestre). */
export function TextTabs<T extends string>({
  value,
  options,
  onChange,
  label,
}: {
  value: T;
  options: { id: T; label: string }[];
  onChange: (v: T) => void;
  label: string;
}) {
  return (
    <div className="lx-tabs" role="tablist" aria-label={label}>
      {options.map(o => (
        <button
          key={o.id}
          type="button"
          role="tab"
          aria-selected={value === o.id}
          className={value === o.id ? "active" : ""}
          onClick={() => onChange(o.id)}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

/** Legenda com bolinhas (cheia = série principal; vazada = secundária). */
export function DotLegend({ items }: { items: { label: string; tone: "ink" | "gray" | "mint" | "ring" }[] }) {
  return (
    <ul className="lx-dots">
      {items.map(i => (
        <li key={i.label}>
          <i className={i.tone} />
          {i.label}
        </li>
      ))}
    </ul>
  );
}

/**
 * Semicírculo: arco preto proporcional a `value / total`, restante em cinza,
 * com os valores nas pontas (esquerda = parte destacada, direita = total ou parte restante).
 */
export function Gauge({
  value,
  total,
  left,
  right,
  center,
  caption,
}: {
  value: number;
  total: number;
  left: string;
  right: string;
  center?: string;
  caption?: string;
}) {
  const ratio = total > 0 ? Math.max(0, Math.min(1, value / total)) : 0;
  const r = 80,
    cx = 100,
    cy = 96;
  const arc = (from: number, to: number) => {
    const a0 = Math.PI * (1 - from),
      a1 = Math.PI * (1 - to);
    const x0 = cx + r * Math.cos(a0),
      y0 = cy - r * Math.sin(a0),
      x1 = cx + r * Math.cos(a1),
      y1 = cy - r * Math.sin(a1);
    return `M${x0.toFixed(2)},${y0.toFixed(2)} A${r},${r} 0 0 1 ${x1.toFixed(2)},${y1.toFixed(2)}`;
  };
  return (
    <figure className="lx-gauge">
      <svg viewBox="0 0 200 104" role="img" aria-label={`${left} de ${right}`}>
        <path d={arc(0, 1)} className="rest" />
        {ratio > 0.002 && <path d={arc(0, ratio)} className="fill" />}
        {center && (
          <text x={cx} y={cy - 18} textAnchor="middle" className="center">
            {center}
          </text>
        )}
      </svg>
      <figcaption>
        <b>{left}</b>
        {caption && <span>{caption}</span>}
        <b>{right}</b>
      </figcaption>
    </figure>
  );
}

/** Tooltip simples posicionado dentro do gráfico. */
export function Tip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className="vg-tip" style={{ left: x, top: y }} role="status">
      {children}
    </div>
  );
}

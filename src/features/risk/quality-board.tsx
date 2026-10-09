"use client";
/**
 * Qualidade dos clientes: lado a lado, os que mais pioraram e os que mais melhoraram na
 * janela recente da política, com score (0–1000) antes → agora, mini gráfico de 6 meses, os motivos
 * e a ação sugerida. Alterna entre cedentes e sacados. Clicar no cliente abre o panorama
 * (`client-panel.tsx`), que explica a variação e mostra carteira e operações.
 */
import { type Operation } from "@/src/domain/core/types";
import { type PortfolioTitle } from "@/src/domain/home/metrics";
import { type QualityTrend, type qualityRankings } from "@/src/domain/risk/quality";
import { ClientPanel } from "./client-panel";
import { type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { compact, IconSquare, TextTabs } from "@/src/features/home/widgets";
import { ShellContext } from "@/src/features/shell/shell-context";
import { SlidersIcon } from "@/src/ui/icons";
import { useContext, useState } from "react";

type Rankings = ReturnType<typeof qualityRankings>;

const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.round(Math.abs(v))} pts`;

function Spark({ values, tone }: { values: number[]; tone: "down" | "up" }) {
  if (values.length < 2) return null;
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = Math.max(40, max - min);
  const W = 84,
    H = 26;
  const d = values
    .map(
      (v, i) =>
        `${i ? "L" : "M"}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - min) / span) * (H - 6)).toFixed(1)}`,
    )
    .join(" ");
  return (
    <svg className={`lx-spark ${tone}`} viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

function TrendRow({
  t,
  rank,
  tone,
  onSelect,
}: {
  t: QualityTrend;
  rank: number;
  tone: "down" | "up";
  onSelect: () => void;
}) {
  return (
    <li className={`lx-q-row ${tone}`}>
      <button type="button" className="lx-q-hit" onClick={onSelect} aria-label={`Ver o panorama de ${t.name}`}>
        <span className="lx-q-rank">{rank}</span>
        <span className="lx-q-main">
          <span className="lx-q-head">
            <strong>{t.name}</strong>
            <span className={`lx-pill ${tone === "down" ? "down" : "up"}`}>{pts(t.delta)}</span>
          </span>
          <span className="lx-q-meta">
            <span>
              Score {Math.round(t.previousIndex)} → <b>{Math.round(t.index)}</b>
            </span>
            <span>Exposição {compact(t.exposure)}</span>
            <Spark values={t.series} tone={tone} />
          </span>
          {t.reasons.length > 0 && (
            <span className="lx-q-reasons">
              {t.reasons.map(r => (
                <span key={r.component}>
                  {r.text} <em>{pts(r.impact)}</em>
                </span>
              ))}
            </span>
          )}
          <span className="lx-q-action">
            {t.action} · <u>ver panorama →</u>
          </span>
        </span>
      </button>
    </li>
  );
}

function Column({
  title,
  list,
  exposure,
  tone,
  empty,
  onSelect,
}: {
  title: string;
  list: QualityTrend[];
  exposure: number;
  tone: "down" | "up";
  empty: string;
  onSelect: (index: number) => void;
}) {
  return (
    <section className={`lx-q-col ${tone}`}>
      <header>
        <span className="lx-label">{title}</span>
        <small>
          {list.length} cliente{list.length === 1 ? "" : "s"} · {compact(exposure)} em exposição
        </small>
      </header>
      {list.length ? (
        <ol>
          {list.map((t, i) => (
            <TrendRow key={t.id} t={t} rank={i + 1} tone={tone} onSelect={() => onSelect(i)} />
          ))}
        </ol>
      ) : (
        <p className="lx-q-empty">{empty}</p>
      )}
    </section>
  );
}

export function QualityBoard({
  cedents,
  debtors,
  policy,
  onEditPolicy,
  titles,
  operations,
  today,
}: {
  cedents: Rankings;
  debtors: Rankings;
  policy: QualityPolicy;
  onEditPolicy: () => void;
  titles: PortfolioTitle[];
  operations: Operation[];
  today: string;
}) {
  const [who, setWho] = useState<"cedentes" | "sacados">("cedentes");
  const [selected, setSelected] = useState<{ list: "worsening" | "improving"; index: number } | null>(null);
  const shell = useContext(ShellContext);
  const r = who === "cedentes" ? cedents : debtors;
  const list = selected ? r[selected.list] : [];
  const current = selected ? list[selected.index] : undefined;
  const digits = (v: string) => v.replace(/\D/g, "");
  const days = policy.windowMonths * 30;
  return (
    <div className="lx-quality">
      <div className="lx-q-tools">
        <TextTabs
          label="Clientes"
          value={who}
          onChange={setWho}
          options={[
            { id: "cedentes", label: `Cedentes (${cedents.trends.length})` },
            { id: "sacados", label: `Sacados (${debtors.trends.length})` },
          ]}
        />
        <small>
          Últimos {days} dias × {days} anteriores · {r.stable} estáve{r.stable === 1 ? "l" : "is"} · {policy.name}{" "}
          {policy.version}
        </small>
        <IconSquare label="Critérios do score de qualidade" icon={<SlidersIcon />} onClick={onEditPolicy} />
      </div>
      <div className="lx-q-grid">
        <Column
          title={`Piorando · top ${policy.rankingSize}`}
          list={r.worsening}
          exposure={r.worseningExposure}
          tone="down"
          empty={`Nenhum ${who === "cedentes" ? "cedente" : "sacado"} caiu mais de ${policy.minDelta} pontos.`}
          onSelect={index => setSelected({ list: "worsening", index })}
        />
        <Column
          title={`Melhorando · top ${policy.rankingSize}`}
          list={r.improving}
          exposure={r.improvingExposure}
          tone="up"
          empty={`Nenhum ${who === "cedentes" ? "cedente" : "sacado"} subiu mais de ${policy.minDelta} pontos.`}
          onSelect={index => setSelected({ list: "improving", index })}
        />
      </div>
      {selected && current && (
        <ClientPanel
          trend={current}
          position={selected.index + 1}
          total={list.length}
          policy={policy}
          today={today}
          titles={titles.filter(t =>
            current.kind === "cedente"
              ? digits(t.ownerDocument) === digits(current.document)
              : digits(t.debtorDocument) === digits(current.document),
          )}
          operations={
            current.kind === "cedente"
              ? operations.filter(op => digits(op.document) === digits(current.document))
              : operations.filter(op =>
                  (op.manualEntry?.entries ?? []).some(
                    e => digits(e.debtorDocument ?? "") === digits(current.document),
                  ),
                )
          }
          onPrev={selected.index > 0 ? () => setSelected({ ...selected, index: selected.index - 1 }) : undefined}
          onNext={
            selected.index < list.length - 1 ? () => setSelected({ ...selected, index: selected.index + 1 }) : undefined
          }
          onClose={() => setSelected(null)}
          onNavigate={view => {
            setSelected(null);
            shell?.navigate(view);
          }}
          onOpenOperation={op => {
            setSelected(null);
            shell?.openOperation(op);
          }}
        />
      )}
    </div>
  );
}

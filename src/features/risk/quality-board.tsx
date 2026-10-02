"use client";
/**
 * Qualidade dos clientes: lado a lado, os que mais pioraram e os que mais melhoraram na
 * janela recente da política, com índice antes → agora, mini gráfico de 6 meses, os motivos
 * e a ação sugerida. Alterna entre cedentes e sacados.
 */
import { type QualityTrend, type qualityRankings } from "@/src/domain/risk/quality";
import { type QualityPolicy } from "@/src/domain/risk/quality-policy";
import { compact, IconSquare, TextTabs } from "@/src/features/home/widgets";
import { ShellContext } from "@/src/features/shell/shell-context";
import { SlidersIcon } from "@/src/ui/icons";
import { useContext, useState } from "react";

type Rankings = ReturnType<typeof qualityRankings>;

const pts = (v: number) => `${v > 0 ? "+" : v < 0 ? "−" : ""}${Math.abs(v).toFixed(1).replace(".", ",")} pts`;

function Spark({ values, tone }: { values: number[]; tone: "down" | "up" }) {
  if (values.length < 2) return null;
  const min = Math.min(...values),
    max = Math.max(...values);
  const span = Math.max(4, max - min);
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
  onOpen,
}: {
  t: QualityTrend;
  rank: number;
  tone: "down" | "up";
  onOpen: () => void;
}) {
  return (
    <li className={`lx-q-row ${tone}`}>
      <span className="lx-q-rank">{rank}</span>
      <div className="lx-q-main">
        <div className="lx-q-head">
          <strong>{t.name}</strong>
          <span className={`lx-pill ${tone === "down" ? "down" : "up"}`}>{pts(t.delta)}</span>
        </div>
        <div className="lx-q-meta">
          <span>
            Índice {Math.round(t.previousIndex)} → <b>{Math.round(t.index)}</b>
          </span>
          <span>Exposição {compact(t.exposure)}</span>
          <Spark values={t.series} tone={tone} />
        </div>
        {t.reasons.length > 0 && (
          <ul className="lx-q-reasons">
            {t.reasons.map(r => (
              <li key={r.component}>
                {r.text} <em>{pts(r.impact)}</em>
              </li>
            ))}
          </ul>
        )}
        <button type="button" className="lx-q-action" onClick={onOpen}>
          {t.action} →
        </button>
      </div>
    </li>
  );
}

function Column({
  title,
  list,
  exposure,
  tone,
  empty,
  onOpen,
}: {
  title: string;
  list: QualityTrend[];
  exposure: number;
  tone: "down" | "up";
  empty: string;
  onOpen: () => void;
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
            <TrendRow key={t.id} t={t} rank={i + 1} tone={tone} onOpen={onOpen} />
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
}: {
  cedents: Rankings;
  debtors: Rankings;
  policy: QualityPolicy;
  onEditPolicy: () => void;
}) {
  const [who, setWho] = useState<"cedentes" | "sacados">("cedentes");
  const shell = useContext(ShellContext);
  const r = who === "cedentes" ? cedents : debtors;
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
        <IconSquare label="Critérios do índice de qualidade" icon={<SlidersIcon />} onClick={onEditPolicy} />
      </div>
      <div className="lx-q-grid">
        <Column
          title={`Piorando · top ${policy.rankingSize}`}
          list={r.worsening}
          exposure={r.worseningExposure}
          tone="down"
          empty={`Nenhum ${who === "cedentes" ? "cedente" : "sacado"} caiu mais de ${policy.minDelta} pontos.`}
          onOpen={() => shell?.navigate("registry")}
        />
        <Column
          title={`Melhorando · top ${policy.rankingSize}`}
          list={r.improving}
          exposure={r.improvingExposure}
          tone="up"
          empty={`Nenhum ${who === "cedentes" ? "cedente" : "sacado"} subiu mais de ${policy.minDelta} pontos.`}
          onOpen={() => shell?.navigate("registry")}
        />
      </div>
    </div>
  );
}

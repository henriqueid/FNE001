import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { appear, Badge, Impact, SceneLabel, Tile } from "../components/ui";

const PURPLE = "#C084FC";
const PRO = ["Inteligência de dados", "Crédito e score", "Prevenção à fraude e compliance", "Soluções de decisão"];
const STR = ["Contexto da operação", "Políticas de cada cliente", "Histórico da carteira", "Execução e auditoria"];
const FLOW = ["Informação", "Decisão", "Operação"];

// Cena 07: duas camadas complementares ligadas por um barramento de APIs (proposta).
export const Scene07Synergy: React.FC = () => {
  const { frame, at } = useNarration("s07");
  const bus = interpolate(frame, [at(2), at(2) + 30], [0, 1], clamp);
  const block = (title: string, sub: string, items: string[], x: number, c: string, from: number, active: boolean) => (
    <Tile
      accent={c}
      style={{
        position: "absolute",
        left: x,
        top: 200,
        width: 560,
        padding: "28px 30px",
        boxShadow: active ? `0 0 0 3px ${c}77, 0 18px 50px rgba(2,6,23,0.45)` : undefined,
        ...appear(frame, from),
      }}
    >
      <div style={{ fontSize: 20, color: c, fontWeight: 700, letterSpacing: "0.12em" }}>{sub}</div>
      <div style={{ fontSize: 50, fontWeight: 800, marginTop: 4 }}>{title}</div>
      <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
        {items.map((it, i) => (
          <div key={it} style={{ fontSize: 24, color: colors.textSoft, ...appear(frame, from + 12 + i * 8, 10, 0) }}>
            <span style={{ color: c }}>●</span> {it}
          </div>
        ))}
      </div>
    </Tile>
  );
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={7} title="Complementaridade" />
      <Badge kind="proposal" from={10} />
      {block("proScore", "INTELIGÊNCIA EXTERNA E DADOS", PRO, 170, PURPLE, at(0), frame >= at(3) && frame < at(4))}
      {block("STRATO", "OPERAÇÃO, POLÍTICAS E EXECUÇÃO", STR, 1190, colors.accent, at(1), frame >= at(4) && frame < at(5))}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={730} y1={430} x2={730 + 460 * bus} y2={430} stroke="rgba(255,255,255,0.35)" strokeWidth={3} strokeDasharray="10 8" />
        {Array.from({ length: 6 }, (_, i) => {
          const p = ((frame / 50 + i / 6) % 1) * bus;
          return <circle key={i} cx={730 + 460 * p} cy={430} r={6} fill={i % 2 ? PURPLE : colors.accent} opacity={bus} />;
        })}
      </svg>
      <div style={{ position: "absolute", left: 760, width: 400, top: 380, textAlign: "center", color: colors.textSoft, fontSize: 20, fontWeight: 700, letterSpacing: "0.12em", opacity: bus }}>
        BARRAMENTO DE APIs
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 700, display: "flex", justifyContent: "center", alignItems: "center", gap: 26 }}>
        {FLOW.map((f, i) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 26, ...appear(frame, at(6) + i * 14) }}>
            <span style={{ padding: "16px 34px", borderRadius: 16, background: "rgba(11,29,79,0.9)", border: `1px solid ${colors.accent}88`, color: colors.white, fontSize: 32, fontWeight: 700 }}>{f}</span>
            {i < FLOW.length - 1 ? <span style={{ color: colors.accent, fontSize: 36 }}>→</span> : null}
          </div>
        ))}
      </div>
      <Impact lines={["Dados que contextualizam.", "Decisões que orientam. Operações que avançam."]} at={at(6) + 75} position="center" />
    </AbsoluteFill>
  );
};

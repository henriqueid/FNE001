import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { Beam, ImpactMoment, Particles, usePop } from "../components/motion";
import { Badge, SceneLabel, Tile } from "../components/ui";

const PURPLE = "#C084FC";
const PRO = ["Inteligência de dados", "Crédito e score", "Prevenção à fraude e compliance", "Soluções de decisão"];
const STR = ["Contexto da operação", "Políticas de cada cliente", "Histórico da carteira", "Execução e auditoria"];
const FLOW = ["Informação", "Decisão", "Operação"];

// Cena 07: duas camadas complementares ligadas por um barramento de APIs (proposta).
export const Scene07Synergy: React.FC = () => {
  const { frame, at } = useNarration("s07");
  const pop = usePop();
  const block = (title: string, sub: string, items: string[], x: number, c: string, from: number, active: boolean, dx: number) => (
    <div style={{ position: "absolute", left: x, top: 210, width: 560, ...pop(from, { dx, dy: 0 }) }}>
      <Tile
        accent={c}
        style={{
          padding: "30px 32px",
          boxShadow: active ? `0 0 0 3px ${c}88, 0 0 60px ${c}55` : "0 18px 50px rgba(2,6,23,0.45)",
          scale: String(active ? 1.03 : 1),
        }}
      >
        <div style={{ fontSize: 20, color: c, fontWeight: 700, letterSpacing: "0.12em" }}>{sub}</div>
        <div style={{ fontSize: 54, fontWeight: 800, marginTop: 4 }}>{title}</div>
        <div style={{ marginTop: 18, display: "flex", flexDirection: "column", gap: 12 }}>
          {items.map((it, i) => (
            <div key={it} style={{ fontSize: 25, color: colors.textSoft, ...pop(from + 14 + i * 7, { dx: dx * 0.3, dy: 0 }) }}>
              <span style={{ color: c }}>●</span> {it}
            </div>
          ))}
        </div>
      </Tile>
    </div>
  );
  const bus = frame >= at(2);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={30} seed="s07" color={PURPLE} />
      <SceneLabel index={7} title="Complementaridade" />
      <Badge kind="proposal" from={10} />
      {block("proScore", "INTELIGÊNCIA EXTERNA E DADOS", PRO, 150, PURPLE, at(0), frame >= at(3) && frame < at(4), -160)}
      {block("STRATO", "OPERAÇÃO, POLÍTICAS E EXECUÇÃO", STR, 1210, colors.accent, at(1), frame >= at(4) && frame < at(5), 160)}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {bus ? (
          <>
            <Beam x1={712} y1={400} x2={1208} y2={400} at={at(2)} color={PURPLE} period={45} width={3} />
            <Beam x1={1208} y1={460} x2={712} y2={460} at={at(2) + 10} color={colors.accent} period={55} width={3} />
          </>
        ) : null}
      </svg>
      <div style={{ position: "absolute", left: 760, width: 400, top: 410, textAlign: "center", color: colors.textSoft, fontSize: 20, fontWeight: 700, letterSpacing: "0.14em", opacity: interpolate(frame, [at(2) + 10, at(2) + 25], [0, 1], clamp) }}>
        BARRAMENTO DE APIs
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 740, display: "flex", justifyContent: "center", alignItems: "center", gap: 30 }}>
        {FLOW.map((f, i) => (
          <div key={f} style={{ display: "flex", alignItems: "center", gap: 30, ...pop(at(6) + i * 12) }}>
            <span style={{ padding: "18px 38px", borderRadius: 18, background: "rgba(11,29,79,0.92)", border: `1.5px solid ${colors.accent}`, color: colors.white, fontSize: 34, fontWeight: 700, boxShadow: `0 0 ${20 + 10 * Math.sin(frame / 8 + i)}px ${colors.accent}55` }}>{f}</span>
            {i < FLOW.length - 1 ? <span style={{ color: colors.accent, fontSize: 40 }}>→</span> : null}
          </div>
        ))}
      </div>
      <ImpactMoment at={at(6) + 80} lines={["Dados que contextualizam.", "Decisões que orientam. Operações que avançam."]} />
    </AbsoluteFill>
  );
};

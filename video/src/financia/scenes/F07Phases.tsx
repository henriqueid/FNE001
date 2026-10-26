import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Particles, usePop } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const PHASES = [
  {
    n: "1",
    t: "Homologação conjunta",
    tag: "≈ 90 dias",
    color: colors.accent,
    s: 1,
    items: [
      { t: "Licença gratuita", s: 2 },
      { t: "Acesso completo a todo o sistema, a qualquer momento", s: 2 },
      { t: "Em paralelo à rotina atual", s: 3 },
      { t: "Equipe aponta · nós ajustamos e concluímos", s: 4 },
    ],
  },
  {
    n: "2",
    t: "Piloto de implantação",
    tag: "produção",
    color: colors.decide,
    s: 5,
    items: [
      { t: "STRATO em produção", s: 6 },
      { t: "Acompanhamento próximo", s: 6 },
      { t: "Indicadores: tempo · retrabalho · controle", s: 6 },
    ],
  },
  {
    n: "3",
    t: "Escala",
    tag: "referência",
    color: "#C084FC",
    s: 7,
    items: [
      { t: "Financia como caso de referência", s: 8 },
      { t: "Experiência e influência", s: 9 },
      { t: "STRATO em outras estruturas", s: 9 },
    ],
  },
];
const COL = 540;
const GAP = 40;
const X0 = (1920 - (3 * COL + 2 * GAP)) / 2;

// Cena 7: linha do tempo das três fases; cada marco abre seus entregáveis conforme a narração.
export const F07Phases: React.FC = () => {
  const { frame, at } = useNarration("f07");
  const pop = usePop();
  const marks = PHASES.map(p => at(p.s));
  // Ponto de progresso que viaja pela linha até a fase narrada.
  const target = PHASES.reduce((x, p, i) => (frame >= marks[i] ? i : x), -1);
  const prog = target < 0 ? 0 : interpolate(frame, [marks[target], marks[target] + 30], [Math.max(0, target - 1), target], { ...clamp, easing: ease.inOut });
  const dotX = X0 + COL / 2 + prog * (COL + GAP);
  const LINE_Y = 300;
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={24} seed="f07" />
      <SceneLabel index={7} title="A proposta em três fases" />
      <Badge kind="offer" from={at(0)} />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: colors.white, fontSize: 46, fontWeight: 700, ...pop(at(0)) }}>
        Homologação <span style={{ color: colors.textFaint }}>→</span> Piloto <span style={{ color: colors.textFaint }}>→</span> Escala
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <line x1={X0 + COL / 2} y1={LINE_Y} x2={X0 + COL / 2 + 2 * (COL + GAP)} y2={LINE_Y} stroke="rgba(255,255,255,0.14)" strokeWidth={4} />
        <line x1={X0 + COL / 2} y1={LINE_Y} x2={dotX} y2={LINE_Y} stroke={colors.accent} strokeWidth={4} />
        {target >= 0 ? <circle cx={dotX} cy={LINE_Y} r={14} fill={colors.white} style={{ filter: `drop-shadow(0 0 14px ${colors.accent})` }} /> : null}
      </svg>
      {PHASES.map((p, i) => {
        const active = i === target;
        const x = X0 + i * (COL + GAP);
        return (
          <div key={p.n}>
            <div style={{ position: "absolute", left: x + COL / 2 - 34, top: LINE_Y - 34, width: 68, height: 68, borderRadius: "50%", display: "grid", placeItems: "center", background: active ? p.color : "rgba(11,29,79,0.95)", border: `3px solid ${p.color}`, color: active ? colors.navy950 : colors.white, fontSize: 32, fontWeight: 800, ...pop(at(0) + 10 + i * 10, { from: 0.4 }) }}>
              {p.n}
            </div>
            <div
              style={{
                position: "absolute",
                left: x,
                top: 370,
                width: COL,
                minHeight: 470,
                padding: "28px 30px",
                borderRadius: 24,
                background: active ? "linear-gradient(180deg, rgba(20,36,92,0.98), rgba(9,20,56,0.96))" : "rgba(9,20,56,0.7)",
                border: `2px solid ${active ? p.color : "rgba(255,255,255,0.1)"}`,
                boxShadow: active ? `0 0 60px ${p.color}44` : "none",
                ...pop(at(p.s) - 4, { dy: 60 }),
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span style={{ color: p.color, fontSize: 20, fontWeight: 800, letterSpacing: "0.14em" }}>FASE {p.n}</span>
                <span style={{ padding: "5px 14px", borderRadius: 999, background: `${p.color}22`, color: p.color, fontSize: 20, fontWeight: 700 }}>{p.tag}</span>
              </div>
              <div style={{ color: colors.white, fontSize: 40, fontWeight: 800, marginTop: 10, lineHeight: 1.1 }}>{p.t}</div>
              <div style={{ marginTop: 22, display: "flex", flexDirection: "column", gap: 14 }}>
                {p.items.map((it, j) => (
                  <div key={it.t} style={{ display: "flex", gap: 12, color: colors.white, fontSize: 26, fontWeight: 600, lineHeight: 1.25, ...pop(at(it.s) + 8 + j * 10, { dx: -30, dy: 0 }) }}>
                    <span style={{ color: p.color }}>●</span>
                    {it.t}
                  </div>
                ))}
              </div>
            </div>
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

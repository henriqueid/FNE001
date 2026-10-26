import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Beam, Particles, usePop } from "../../proscore/components/motion";
import { SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const FORCES = ["Mais rápido", "Mais regulado", "Mais dependente de dados"];
const CHIPS = ["Cadastro", "Lastro", "Formalização", "Liberação", "Carteira", "Cobrança"];
const SCATTER: [number, number][] = [
  [330, 300], [1580, 280], [520, 790], [1420, 780], [960, 210], [1700, 560],
];

// Cena 1: o mercado muda; processos soltos convergem para o STRATO, que convida parceiros.
export const F01Opening: React.FC = () => {
  const { frame, at, fps } = useNarration("f01");
  const pop = usePop();
  const center: [number, number] = [960, 500];
  const join = interpolate(frame, [at(2), at(2) + 40], [0, 1], { ...clamp, easing: ease.inOut });
  const pos = CHIPS.map((_, i) => {
    const a = (i / CHIPS.length) * Math.PI * 2 - Math.PI / 2;
    const ring: [number, number] = [center[0] + Math.cos(a) * 560, center[1] + Math.sin(a) * 300];
    const drift = Math.sin(frame / 30 + i * 1.9) * 16 * (1 - join);
    return [SCATTER[i][0] + (ring[0] - SCATTER[i][0]) * join + drift, SCATTER[i][1] + (ring[1] - SCATTER[i][1]) * join - drift];
  });
  const logo = spring({ frame: frame - at(2) - 20, fps, config: { damping: 12, stiffness: 90 } });
  const partner = spring({ frame: frame - at(3), fps, config: { damping: 14 } });
  const lift = interpolate(partner, [0, 1], [0, -70]);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={36} seed="f01" />
      <SceneLabel index={1} title="Abertura" />
      {/* Forças do mercado: entram e saem antes da convergência. */}
      <div style={{ position: "absolute", top: 420, left: 0, right: 0, display: "flex", justifyContent: "center", gap: 28, opacity: 1 - join }}>
        {FORCES.map((f, i) => (
          <div key={f} style={{ padding: "18px 34px", borderRadius: 20, background: "rgba(59,107,255,0.16)", border: `1.5px solid ${colors.accent}88`, color: colors.white, fontSize: 40, fontWeight: 700, ...pop(at(1) + i * 14) }}>
            {f}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", top: 300, left: 0, right: 0, textAlign: "center", color: colors.textSoft, fontSize: 34, fontWeight: 600, letterSpacing: "0.08em", textTransform: "uppercase", opacity: (1 - join) * interpolate(frame, [at(0), at(0) + 14], [0, 1], clamp) }}>
        Crédito estruturado em transformação
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, translate: `0px ${lift}px` }}>
        {join >= 1
          ? pos.map((p, i) => <Beam key={i} x1={p[0]} y1={p[1]} x2={center[0]} y2={center[1]} at={at(2) + 40 + i * 3} period={50 + i * 6} />)
          : pos.map((p, i) => (
              <line key={i} x1={p[0]} y1={p[1]} x2={p[0] + (center[0] - p[0]) * join} y2={p[1] + (center[1] - p[1]) * join} stroke={colors.accent} strokeWidth={2.5} opacity={join * 0.85} />
            ))}
      </svg>
      <div style={{ position: "absolute", inset: 0, translate: `0px ${lift}px` }}>
        {CHIPS.map((c, i) => (
          <div key={c} style={{ position: "absolute", left: pos[i][0], top: pos[i][1], transform: "translate(-50%, -50%)" }}>
            <div
              style={{
                padding: "14px 28px",
                borderRadius: 16,
                background: "rgba(11,29,79,0.9)",
                border: `1.5px solid ${join > 0.5 ? colors.accent : "rgba(255,255,255,0.2)"}`,
                boxShadow: join > 0.5 ? `0 0 30px ${colors.accent}55` : "0 14px 40px rgba(2,6,23,0.5)",
                color: colors.white,
                fontSize: 30,
                fontWeight: 600,
                opacity: interpolate(frame, [at(0) + 10 + i * 8, at(0) + 24 + i * 8], [0, 0.55], clamp) + join * 0.45,
              }}
            >
              {c}
            </div>
          </div>
        ))}
        <div style={{ position: "absolute", left: center[0], top: center[1], transform: "translate(-50%, -50%)" }}>
          <div style={{ padding: "26px 40px", borderRadius: 26, background: "rgba(4,10,28,0.88)", boxShadow: `0 0 ${60 * logo}px ${colors.accentStrong}`, opacity: logo, scale: String(0.6 + logo * 0.4) }}>
            <Img src={staticFile("strato-logo.png")} style={{ width: 400, display: "block" }} />
          </div>
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 770, textAlign: "center", ...pop(at(3), { dy: 30 }) }}>
        <div style={{ display: "inline-flex", alignItems: "center", gap: 26, padding: "18px 40px", borderRadius: 22, background: "rgba(4,10,28,0.9)", border: `1px solid ${colors.captionBorder}` }}>
          <span style={{ color: colors.textSoft, fontSize: 32, fontWeight: 600 }}>Buscando parceiros</span>
          <span style={{ width: 2, height: 36, background: colors.accent, opacity: 0.6 }} />
          <span style={{ color: colors.white, fontSize: 44, fontWeight: 800, letterSpacing: "-0.01em" }}>
            STRATO <span style={{ color: colors.textFaint, fontWeight: 300 }}>×</span> Financia
          </span>
        </div>
      </div>
    </AbsoluteFill>
  );
};

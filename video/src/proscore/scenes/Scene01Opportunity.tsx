import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { Beam, Particles, usePop } from "../components/motion";
import { SceneLabel } from "../components/ui";

const CONCEPTS = ["Cadastro", "Crédito", "Operações", "Risco", "Carteira", "Cobrança"];
const SCATTER: [number, number][] = [
  [360, 290], [1520, 250], [560, 760], [1400, 730], [900, 200], [1650, 500],
];
const FRICTION = ["Telas diferentes", "Processo manual", "Consulta isolada", "Informação desconectada"];

// Cena 01: processos soltos que tremem e se desencontram até convergirem para o STRATO.
export const Scene01Opportunity: React.FC = () => {
  const { frame, at, fps } = useNarration("s01");
  const pop = usePop();
  const join = interpolate(frame, [at(4), at(4) + 40], [0, 1], { ...clamp, easing: ease.inOut });
  const center: [number, number] = [960, 500];
  const tension = interpolate(frame, [at(2), at(3) + 30], [0, 1], clamp) * (1 - join);

  const pos = CONCEPTS.map((_, i) => {
    const a = (i / CONCEPTS.length) * Math.PI * 2 - Math.PI / 2;
    const ring: [number, number] = [center[0] + Math.cos(a) * 500, center[1] + Math.sin(a) * 290];
    const drift = Math.sin(frame / 34 + i * 1.7) * 18 * (1 - join);
    const jitter = tension * Math.sin(frame * 1.7 + i * 3) * 4;
    return [SCATTER[i][0] + (ring[0] - SCATTER[i][0]) * join + drift + jitter, SCATTER[i][1] + (ring[1] - SCATTER[i][1]) * join - drift];
  });
  const logo = spring({ frame: frame - at(4) - 22, fps, config: { damping: 12, stiffness: 90 } });
  const burst = interpolate(frame, [at(4) + 22, at(4) + 60], [0, 1], clamp);

  return (
    <AbsoluteFill>
      <Background />
      <Particles count={36} seed="s01" />
      <SceneLabel index={1} title="A oportunidade" />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {pos.map((p, i) => {
          const q = pos[(i + 2) % pos.length];
          const show = interpolate(frame, [at(0) + 20 + i * 8, at(0) + 40 + i * 8], [0, 1], clamp);
          const flick = 0.55 + 0.45 * Math.sin(frame / 4 + i * 2) * tension;
          return (
            <line
              key={`b${i}`}
              x1={p[0]}
              y1={p[1]}
              x2={p[0] + (q[0] - p[0]) * 0.38}
              y2={p[1] + (q[1] - p[1]) * 0.38}
              stroke="#F87171"
              strokeOpacity={0.6 * flick}
              strokeWidth={2}
              strokeDasharray="6 10"
              strokeDashoffset={-frame * 0.6}
              opacity={show * (1 - join)}
            />
          );
        })}
        {join >= 1
          ? pos.map((p, i) => <Beam key={`c${i}`} x1={p[0]} y1={p[1]} x2={center[0]} y2={center[1]} at={at(4) + 40 + i * 3} period={50 + i * 6} />)
          : pos.map((p, i) => (
              <line key={`c${i}`} x1={p[0]} y1={p[1]} x2={p[0] + (center[0] - p[0]) * join} y2={p[1] + (center[1] - p[1]) * join} stroke={colors.accent} strokeWidth={2.5} opacity={join * 0.85} />
            ))}
        <circle cx={center[0]} cy={center[1]} r={60 + burst * 520} fill="none" stroke={colors.accent} strokeWidth={3} opacity={frame >= at(4) + 22 ? (1 - burst) * 0.7 : 0} />
      </svg>
      {CONCEPTS.map((c, i) => (
        <div
          key={c}
          style={{
            position: "absolute",
            left: pos[i][0],
            top: pos[i][1],
            transform: "translate(-50%, -50%)",
          }}
        >
          <div
            style={{
              padding: "16px 30px",
              borderRadius: 18,
              background: "rgba(11,29,79,0.88)",
              border: `1.5px solid ${join > 0.5 ? colors.accent : tension > 0.2 ? "rgba(248,113,113,0.6)" : "rgba(255,255,255,0.2)"}`,
              boxShadow: join > 0.5 ? `0 0 30px ${colors.accent}55` : "0 14px 40px rgba(2,6,23,0.5)",
              color: colors.white,
              fontSize: 32,
              fontWeight: 600,
              ...pop(at(0) + 8 + i * 9),
            }}
          >
            {c}
          </div>
        </div>
      ))}
      {FRICTION.map((f, i) => (
        <div
          key={f}
          style={{
            position: "absolute",
            left: [660, 1110, 720, 1150][i],
            top: [400, 380, 600, 600][i],
            color: "#FCA5A5",
            fontSize: 24,
            fontWeight: 700,
            letterSpacing: "0.03em",
            opacity: (1 - join) * interpolate(frame, [at(3) + i * 12, at(3) + i * 12 + 8], [0, 1], clamp),
            ...(frame >= at(3) + i * 12 ? { scale: String(1 + 0.04 * Math.sin(frame / 5 + i)) } : {}),
          }}
        >
          ✕ {f}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: center[0],
          top: center[1],
          transform: "translate(-50%, -50%)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
        }}
      >
        <div style={{ padding: "26px 40px", borderRadius: 26, background: "rgba(4,10,28,0.85)", boxShadow: `0 0 ${60 * logo}px ${colors.accentStrong}`, opacity: logo, scale: String(0.6 + logo * 0.4) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 400, display: "block" }} />
        </div>
        <div style={{ color: colors.accent, fontSize: 32, fontWeight: 700, whiteSpace: "nowrap", padding: "8px 22px", borderRadius: 14, background: "rgba(4,10,28,0.9)", ...pop(at(4) + 52, { dy: 20 }) }}>Inteligência em Crédito e Recebíveis.</div>
      </div>
    </AbsoluteFill>
  );
};

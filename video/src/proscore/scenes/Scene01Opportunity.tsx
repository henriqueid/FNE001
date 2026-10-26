import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { appear, SceneLabel } from "../components/ui";

const CONCEPTS = ["Cadastro", "Crédito", "Operações", "Risco", "Carteira", "Cobrança"];
const SCATTER: [number, number][] = [
  [330, 250], [1500, 210], [520, 720], [1380, 690], [860, 160], [1640, 470],
];
const FRICTION = ["Telas diferentes", "Processo manual", "Consulta isolada", "Informação desconectada"];

// Cena 01: processos desconectados que, ao final, convergem para o STRATO.
export const Scene01Opportunity: React.FC = () => {
  const { frame, at } = useNarration("s01");
  const join = interpolate(frame, [at(4), at(4) + 36], [0, 1], { ...clamp, easing: ease.inOut });
  const center: [number, number] = [960, 470];

  const ring = CONCEPTS.map((_, i) => {
    const a = (i / CONCEPTS.length) * Math.PI * 2 - Math.PI / 2;
    return [center[0] + Math.cos(a) * 470, center[1] + Math.sin(a) * 270] as [number, number];
  });
  const pos = CONCEPTS.map((_, i) => {
    const drift = Math.sin(frame / 40 + i * 1.7) * 10 * (1 - join);
    return [
      SCATTER[i][0] + (ring[i][0] - SCATTER[i][0]) * join + drift,
      SCATTER[i][1] + (ring[i][1] - SCATTER[i][1]) * join - drift,
    ];
  });

  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={1} title="A oportunidade" />
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {pos.map((p, i) => {
          const q = pos[(i + 1) % pos.length];
          const show = interpolate(frame, [at(0) + 10 + i * 8, at(0) + 30 + i * 8], [0, 1], clamp);
          return (
            <line
              key={`b${i}`}
              x1={p[0]}
              y1={p[1]}
              x2={p[0] + (q[0] - p[0]) * 0.42}
              y2={p[1] + (q[1] - p[1]) * 0.42}
              stroke="rgba(248,113,113,0.55)"
              strokeWidth={2}
              strokeDasharray="6 10"
              opacity={show * (1 - join)}
            />
          );
        })}
        {pos.map((p, i) => (
          <line
            key={`c${i}`}
            x1={p[0]}
            y1={p[1]}
            x2={p[0] + (center[0] - p[0]) * join}
            y2={p[1] + (center[1] - p[1]) * join}
            stroke={colors.accent}
            strokeWidth={2.5}
            opacity={join * 0.85}
          />
        ))}
      </svg>
      {CONCEPTS.map((c, i) => (
        <div
          key={c}
          style={{
            position: "absolute",
            left: pos[i][0],
            top: pos[i][1],
            transform: "translate(-50%, -50%)",
            padding: "14px 26px",
            borderRadius: 16,
            background: "rgba(11,29,79,0.85)",
            border: `1px solid ${join > 0.5 ? colors.accent : "rgba(255,255,255,0.18)"}`,
            color: colors.white,
            fontSize: 30,
            fontWeight: 600,
            ...appear(frame, at(0) + 6 + i * 7),
          }}
        >
          {c}
        </div>
      ))}
      {FRICTION.map((f, i) => (
        <div
          key={f}
          style={{
            position: "absolute",
            left: [640, 1120, 760, 1200][i],
            top: [380, 360, 560, 560][i],
            color: "#FCA5A5",
            fontSize: 22,
            fontWeight: 600,
            letterSpacing: "0.04em",
            opacity: interpolate(frame, [at(3) + i * 10, at(3) + i * 10 + 12], [0, 0.9], clamp) * (1 - join),
          }}
        >
          × {f}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: center[0],
          top: center[1],
          translate: "-50% -50%",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          gap: 22,
          opacity: interpolate(frame, [at(4) + 24, at(4) + 44], [0, 1], clamp),
        }}
      >
        <Img src={staticFile("strato-logo.png")} style={{ width: 420 }} />
        <div style={{ color: colors.accent, fontSize: 30, fontWeight: 600, whiteSpace: "nowrap", ...appear(frame, at(4) + 50) }}>
          Inteligência em Crédito e Recebíveis.
        </div>
      </div>
    </AbsoluteFill>
  );
};

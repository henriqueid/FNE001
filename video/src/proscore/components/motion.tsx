import { AbsoluteFill, interpolate, random, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors } from "../../brand/tokens";

// Vocabulário de movimento das cenas: entradas com mola, partículas e momentos de impacto.

/** Entrada com mola (escala + subida + opacidade) a partir do frame `at`. */
export const usePop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (at: number, opts: { dy?: number; dx?: number; from?: number; damping?: number } = {}) => {
    const p = spring({ frame: frame - at, fps, config: { damping: opts.damping ?? 14, stiffness: 120, mass: 0.8 } });
    return {
      opacity: interpolate(p, [0, 0.35], [0, 1], clamp),
      scale: String(interpolate(p, [0, 1], [opts.from ?? 0.86, 1])),
      translate: `${(1 - p) * (opts.dx ?? 0)}px ${(1 - p) * (opts.dy ?? 40)}px`,
    };
  };
};

/** Partículas de luz flutuando no fundo, sempre em movimento. */
export const Particles: React.FC<{ count?: number; color?: string; seed?: string }> = ({ count = 40, color = colors.accent, seed = "p" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ pointerEvents: "none" }}>
      {Array.from({ length: count }, (_, i) => {
        const x = random(`${seed}x${i}`) * 1920;
        const speed = 0.15 + random(`${seed}s${i}`) * 0.5;
        const y = (1080 + 40 - ((random(`${seed}y${i}`) * 1120 + frame * speed) % 1160)) - 40;
        const size = 2 + random(`${seed}r${i}`) * 4;
        const tw = 0.25 + 0.5 * (0.5 + 0.5 * Math.sin(frame / (12 + i % 7) + i));
        return (
          <div
            key={i}
            style={{ position: "absolute", left: x + Math.sin(frame / 60 + i) * 14, top: y, width: size, height: size, borderRadius: "50%", background: color, opacity: tw, boxShadow: `0 0 ${size * 3}px ${color}` }}
          />
        );
      })}
    </AbsoluteFill>
  );
};

/**
 * Momento de impacto: a cena desfoca e escurece e a frase entra com mola no centro,
 * sem disputar espaço com o conteúdo.
 */
export const ImpactMoment: React.FC<{ at: number; lines: [string, string?]; until?: number }> = ({ at, lines, until }) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const end = until ?? durationInFrames;
  const inP = spring({ frame: frame - at, fps, config: { damping: 16, stiffness: 110 } });
  const out = interpolate(frame, [end - 12, end], [1, 0], clamp);
  const v = Math.min(inP, out);
  if (frame < at) return null;
  return (
    <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", pointerEvents: "none" }}>
      <AbsoluteFill style={{ backdropFilter: `blur(${v * 14}px)`, background: `rgba(4,10,28,${v * 0.62})` }} />
      <div
        style={{
          opacity: v,
          scale: String(0.8 + inP * 0.2),
          textAlign: "center",
          color: colors.white,
          fontSize: 76,
          fontWeight: 800,
          letterSpacing: "-0.03em",
          lineHeight: 1.08,
          maxWidth: 1500,
          textShadow: "0 10px 40px rgba(2,6,23,0.8)",
        }}
      >
        <div style={{ translate: `0px ${(1 - inP) * 30}px` }}>{lines[0]}</div>
        {lines[1] ? (
          <div style={{ color: colors.accent, translate: `0px ${(1 - spring({ frame: frame - at - 8, fps, config: { damping: 16 } })) * 40}px` }}>{lines[1]}</div>
        ) : null}
        <div
          style={{
            margin: "28px auto 0",
            height: 4,
            borderRadius: 2,
            width: interpolate(frame, [at + 10, at + 40], [0, 220], clamp),
            background: `linear-gradient(90deg, ${colors.accentStrong}, ${colors.accent})`,
          }}
        />
      </div>
    </AbsoluteFill>
  );
};

/** Feixe que percorre uma linha (sinal fluindo entre dois pontos). */
export const Beam: React.FC<{ x1: number; y1: number; x2: number; y2: number; at: number; color?: string; period?: number; width?: number }> = ({
  x1,
  y1,
  x2,
  y2,
  at,
  color = colors.accent,
  period = 60,
  width = 2.5,
}) => {
  const frame = useCurrentFrame();
  const draw = interpolate(frame, [at, at + 24], [0, 1], clamp);
  if (draw <= 0) return null;
  const len = Math.hypot(x2 - x1, y2 - y1);
  const p = ((frame - at) % period) / period;
  return (
    <g>
      <line x1={x1} y1={y1} x2={x1 + (x2 - x1) * draw} y2={y1 + (y2 - y1) * draw} stroke={color} strokeOpacity={0.35} strokeWidth={width} />
      {draw >= 1 ? (
        <line
          x1={x1}
          y1={y1}
          x2={x2}
          y2={y2}
          stroke={color}
          strokeWidth={width + 1.5}
          strokeLinecap="round"
          strokeDasharray={`${len * 0.12} ${len}`}
          strokeDashoffset={-len * p}
          style={{ filter: `drop-shadow(0 0 6px ${color})` }}
        />
      ) : null}
    </g>
  );
};

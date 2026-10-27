import { AbsoluteFill, Img, interpolate, random, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";

// Peças do vídeo vertical "Bem-vindo ao novo": celular com tela real, flashes, glitch e tipografia de impacto.

export const FPS = 30;
export const BEAT = 15; // 120 BPM
export const DROP = 120; // impacto da trilha (4 s)
export const beat = (n: number) => DROP + n * BEAT;

/** Celular com print real (390×844 @3×); `scroll` em px da tela capturada (escala 3×). */
export const Phone: React.FC<{ src: string; scroll?: number; w?: number; glow?: string; children?: React.ReactNode }> = ({ src, scroll = 0, w = 700, glow = colors.accentStrong, children }) => {
  const inner = w - 36;
  const h = Math.round((inner * 844) / 390) + 36;
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: w * 0.12, background: "#0A0F1E", padding: 18, boxShadow: `0 60px 140px rgba(2,6,23,0.8), 0 0 0 2px rgba(255,255,255,0.14), 0 0 120px ${glow}55` }}>
      <div style={{ position: "relative", width: inner, height: h - 36, borderRadius: w * 0.1, overflow: "hidden", background: "#fff" }}>
        <Img src={staticFile(src)} style={{ width: inner, translate: `0px ${-(scroll * inner) / 1170}px` }} />
        {children}
      </div>
      <div style={{ position: "absolute", top: 34, left: "50%", width: w * 0.26, height: 30, marginLeft: -w * 0.13, borderRadius: 20, background: "#0A0F1E" }} />
    </div>
  );
};

/** Flash branco curto num corte. */
export const Flash: React.FC<{ at: number; dur?: number; color?: string }> = ({ at, dur = 6, color = "#fff" }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 1, at + dur], [0, 0.95, 0], clamp);
  return o > 0 ? <AbsoluteFill style={{ background: color, opacity: o, pointerEvents: "none" }} /> : null;
};

/** Tremor de câmera (px) em torno de um impacto. */
export const shake = (frame: number, at: number, amp = 22, dur = 12) => {
  const k = interpolate(frame, [at, at + dur], [1, 0], clamp);
  return { x: Math.sin(frame * 2.7) * amp * k, y: Math.cos(frame * 3.3) * amp * k };
};

/** Zoom "soco" no impacto: escala que salta e assenta. */
export const punch = (frame: number, fps: number, at: number, from = 1.25) => {
  const s = spring({ frame: frame - at, fps, config: { damping: 12, stiffness: 180 } });
  return frame < at ? from : interpolate(s, [0, 1], [from, 1]);
};

/** Palavra gigante que entra letra a letra com mola. */
export const SlamWord: React.FC<{ text: string; at: number; size: number; color?: string; stagger?: number; style?: React.CSSProperties }> = ({ text, at, size, color = colors.white, stagger = 2, style }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <div style={{ display: "flex", justifyContent: "center", fontSize: size, fontWeight: 900, letterSpacing: "-0.04em", lineHeight: 0.95, color, ...style }}>
      {[...text].map((ch, i) => {
        const p = spring({ frame: frame - at - i * stagger, fps, config: { damping: 11, stiffness: 200, mass: 0.7 } });
        return (
          <span key={i} style={{ display: "inline-block", whiteSpace: "pre", opacity: interpolate(p, [0, 0.3], [0, 1], clamp), translate: `0px ${(1 - p) * size * 0.7}px`, scale: String(interpolate(p, [0, 1], [1.8, 1])), filter: `blur(${(1 - p) * 10}px)` }}>
            {ch}
          </span>
        );
      })}
    </div>
  );
};

/** Rótulo de capítulo (AUTOMAÇÃO, DADOS, DECISÃO) com barra de varredura. */
export const Kicker: React.FC<{ text: string; at: number; color?: string }> = ({ text, at, color = colors.accent }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [at, at + 10], [0, 1], { ...clamp, easing: ease.out });
  return (
    <div style={{ display: "inline-flex", alignItems: "center", gap: 18, color, fontSize: 34, fontWeight: 800, letterSpacing: "0.32em", opacity: w }}>
      <span style={{ width: 70 * w, height: 4, background: color }} />
      {text}
    </div>
  );
};

/** Chuva de dígitos (dados em movimento) ao fundo. */
export const DataRain: React.FC<{ opacity?: number; seed?: string }> = ({ opacity = 0.35, seed = "r" }) => {
  const frame = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity, pointerEvents: "none", fontFamily: "monospace" }}>
      {Array.from({ length: 22 }, (_, c) => {
        const speed = 6 + random(`${seed}${c}`) * 10;
        const y = ((frame * speed + random(`${seed}y${c}`) * 1920) % 2300) - 300;
        return (
          <div key={c} style={{ position: "absolute", left: c * 50, top: y, color: colors.accent, fontSize: 26, lineHeight: 1.1, width: 30, wordBreak: "break-all", textShadow: `0 0 10px ${colors.accentStrong}` }}>
            {Array.from({ length: 10 }, (_, k) => Math.floor(random(`${seed}${c}-${k}-${Math.floor(frame / 4)}`) * 10)).join("")}
          </div>
        );
      })}
    </AbsoluteFill>
  );
};

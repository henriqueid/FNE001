import { loadFont } from "@remotion/fonts";
import { AbsoluteFill, Easing, Img, interpolate, random, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors } from "../brand/tokens";
import logo from "./logo-paths.json";

// Kit visual premium do vídeo "Bem-vindo ao novo": tipografia, fundo, vidro, celular e marca vetorial.

export const display = "Inter Tight, sans-serif";
export const mono = "Geist Mono, monospace";
export const fontsReady = Promise.all([
  loadFont({ family: "Inter Tight", url: staticFile("fonts/InterTight-latin.woff2"), weight: "300 900" }),
  loadFont({ family: "Geist Mono", url: staticFile("fonts/GeistMono-latin.woff2"), weight: "400 700" }),
]);

export const expo = Easing.bezier(0.16, 1, 0.3, 1);
export const snap = Easing.bezier(0.87, 0, 0.13, 1);
export const ink = { bg: "#03060F", blue: "#3B6BFF", sky: "#7AA7FF", ice: "#DCE6FF", green: "#34D399", amber: "#F5B544" };

/** Layout responsivo: mesma cena em 1080×1920 e 1920×1080. */
export const useL = () => {
  const { width, height } = useVideoConfig();
  return { W: width, H: height, v: height > width, u: Math.min(width, height) / 1080 };
};

/** Fundo: malha de luz azul que respira, grão de filme e vinheta. */
export const Backdrop: React.FC<{ glow?: number; hue?: string }> = ({ glow = 1, hue = ink.blue }) => {
  const frame = useCurrentFrame();
  const { W, H } = useL();
  const blob = (seed: number, r: number, c: string, a: number) => {
    const x = W * (0.5 + 0.38 * Math.sin(frame / (90 + seed * 13) + seed));
    const y = H * (0.45 + 0.35 * Math.cos(frame / (110 + seed * 7) + seed * 2));
    return <div key={seed} style={{ position: "absolute", left: x - r, top: y - r, width: r * 2, height: r * 2, borderRadius: "50%", background: `radial-gradient(circle, ${c} 0%, transparent 65%)`, opacity: a * glow }} />;
  };
  const R = Math.max(W, H);
  return (
    <AbsoluteFill style={{ background: ink.bg, overflow: "hidden" }}>
      {blob(1, R * 0.55, hue, 0.38)}
      {blob(2, R * 0.45, "#1E2A78", 0.5)}
      {blob(3, R * 0.35, "#5B3BFF", 0.18)}
      <AbsoluteFill style={{ background: `radial-gradient(ellipse 75% 70% at 50% 45%, transparent 40%, ${ink.bg} 100%)` }} />
      <Grain />
    </AbsoluteFill>
  );
};

export const Grain: React.FC<{ opacity?: number }> = ({ opacity = 0.07 }) => {
  const frame = useCurrentFrame();
  const { W, H } = useL();
  const id = `g${frame % 6}`;
  return (
    <svg width={W} height={H} style={{ position: "absolute", inset: 0, opacity, mixBlendMode: "overlay", pointerEvents: "none" }}>
      <filter id={id}>
        <feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={frame % 6} stitchTiles="stitch" />
      </filter>
      <rect width="100%" height="100%" filter={`url(#${id})`} />
    </svg>
  );
};

/** Linha que sobe de trás de uma máscara (lettering editorial). */
export const MaskLine: React.FC<{ at: number; dur?: number; out?: number; children: React.ReactNode; style?: React.CSSProperties }> = ({ at, dur = 22, out, children, style }) => {
  const frame = useCurrentFrame();
  const p = interpolate(frame, [at, at + dur], [0, 1], { ...clamp, easing: expo });
  const q = out === undefined ? 0 : interpolate(frame, [out, out + 14], [0, 1], { ...clamp, easing: snap });
  return (
    <div style={{ overflow: "hidden", paddingBottom: "0.08em", marginBottom: "-0.08em", ...style }}>
      <div style={{ translate: `0px ${(1 - p) * 110 - q * 110}%`, rotate: `${(1 - p) * 4}deg`, transformOrigin: "0 100%" }}>{children}</div>
    </div>
  );
};

/** Texto em gradiente (branco → azul gelo). */
export const Grad: React.FC<{ children: React.ReactNode; from?: string; to?: string }> = ({ children, from = "#FFFFFF", to = ink.sky }) => (
  <span style={{ background: `linear-gradient(100deg, ${from} 10%, ${to} 90%)`, WebkitBackgroundClip: "text", backgroundClip: "text", color: "transparent" }}>{children}</span>
);

const GLYPHS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789#%&/<>=+";
/** Texto mono que se decodifica (embaralha e assenta), estilo terminal. */
export const Scramble: React.FC<{ text: string; at: number; dur?: number; style?: React.CSSProperties }> = ({ text, at, dur = 18, style }) => {
  const frame = useCurrentFrame();
  if (frame < at) return null;
  const k = (frame - at) / dur;
  const shown = [...text]
    .map((ch, i) => {
      if (ch === " ") return " ";
      const settle = i / text.length;
      if (k >= settle + 0.25) return ch;
      if (k < settle * 0.6) return "";
      return GLYPHS[Math.floor(random(`${text}${i}${frame}`) * GLYPHS.length)];
    })
    .join("");
  return <span style={{ fontFamily: mono, whiteSpace: "pre", ...style }}>{shown}</span>;
};

/** Rótulo de capítulo: [ 01 ] AUTOMAÇÃO, em mono com linha que corre. */
export const Label: React.FC<{ n: string; text: string; at: number; color?: string; size: number }> = ({ n, text, at, color = ink.sky, size }) => {
  const frame = useCurrentFrame();
  const w = interpolate(frame, [at, at + 16], [0, 1], { ...clamp, easing: expo });
  return (
    <div style={{ display: "flex", alignItems: "center", gap: size * 0.8, fontFamily: mono, fontSize: size, letterSpacing: "0.18em", color }}>
      <Scramble text={`[ ${n} ]`} at={at} dur={10} />
      <span style={{ width: size * 3 * w, height: 1.5, background: color, opacity: 0.7 }} />
      <Scramble text={text} at={at + 4} dur={16} style={{ color: "#fff" }} />
    </div>
  );
};

/** Cartão de vidro (glassmorphism) com borda em gradiente. */
export const Glass: React.FC<{ children: React.ReactNode; style?: React.CSSProperties; accent?: string }> = ({ children, style, accent = ink.sky }) => (
  <div
    style={{
      padding: "0.9em 1.15em",
      borderRadius: "0.9em",
      background: "linear-gradient(160deg, rgba(22,32,64,0.82), rgba(8,13,30,0.78))",
      border: "1px solid rgba(255,255,255,0.18)",
      boxShadow: `0 30px 80px rgba(0,0,0,0.45), inset 0 1px 0 rgba(255,255,255,0.25), 0 0 0 1px ${accent}22`,
      backdropFilter: "blur(22px) saturate(1.4)",
      color: "#fff",
      ...style,
    }}
  >
    {children}
  </div>
);

/** Janela de navegador escura com print real de computador (1600 px CSS, imagem 2×).
 *  `cam`: canto superior esquerdo (px CSS) e zoom (px na tela por px CSS). */
export const Browser: React.FC<{ src: string; w: number; h: number; cam: { x: number; y: number; z: number }; children?: React.ReactNode; sheen?: number }> = ({ src, w, h, cam, children, sheen = -1 }) => {
  const bar = Math.max(30, w * 0.034);
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: w * 0.018, overflow: "hidden", background: "#0B1020", boxShadow: `0 ${w * 0.06}px ${w * 0.14}px rgba(0,0,0,0.6), 0 0 ${w * 0.12}px rgba(59,107,255,0.22), inset 0 0 0 1px rgba(255,255,255,0.16)` }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", gap: bar * 0.22, padding: `0 ${bar * 0.5}px`, background: "linear-gradient(180deg, #1A2132, #121827)", borderBottom: "1px solid rgba(255,255,255,0.08)" }}>
        {["#FF5F57", "#FEBC2E", "#28C840"].map(c => (
          <span key={c} style={{ width: bar * 0.32, height: bar * 0.32, borderRadius: "50%", background: c, opacity: 0.85 }} />
        ))}
        <div style={{ marginLeft: bar * 0.6, flex: 1, maxWidth: w * 0.4, height: bar * 0.56, borderRadius: bar, background: "rgba(255,255,255,0.07)", display: "flex", alignItems: "center", gap: bar * 0.2, padding: `0 ${bar * 0.4}px`, fontFamily: mono, fontSize: bar * 0.34, color: "rgba(226,232,255,0.6)", letterSpacing: "0.08em" }}>
          <span style={{ width: bar * 0.18, height: bar * 0.18, borderRadius: 2, border: "1.5px solid rgba(226,232,255,0.5)" }} />
          STRATO
        </div>
      </div>
      <div style={{ position: "relative", width: w, height: h - bar, overflow: "hidden", background: "#F8FAFC" }}>
        <Img src={staticFile(src)} style={{ position: "absolute", left: -cam.x * cam.z, top: -cam.y * cam.z, width: 1600 * cam.z }} />
        {children}
        {sheen > -0.5 ? <div style={{ position: "absolute", inset: 0, background: `linear-gradient(115deg, transparent ${sheen * 100 - 18}%, rgba(255,255,255,0.18) ${sheen * 100}%, transparent ${sheen * 100 + 16}%)` }} /> : null}
      </div>
    </div>
  );
};

/** Cursor de mouse com clique (onda) — coordenadas na tela. */
export const Mouse: React.FC<{ x: number; y: number; click: number; size: number }> = ({ x, y, click, size }) => {
  const frame = useCurrentFrame();
  const t = frame - click;
  const r = interpolate(t, [0, 18], [0, 1], { ...clamp, easing: expo });
  const press = t >= 0 && t < 6 ? 0.82 : 1;
  return (
    <div style={{ position: "absolute", left: x, top: y, pointerEvents: "none" }}>
      {t >= 0 ? <div style={{ position: "absolute", left: -size, top: -size, width: size * 2, height: size * 2, borderRadius: "50%", border: `3px solid ${ink.blue}`, background: `${ink.blue}22`, opacity: 1 - r, scale: String(0.2 + r * 1.2) }} /> : null}
      <svg width={size} height={size * 1.2} viewBox="0 0 17 20" style={{ scale: String(press), transformOrigin: "2px 2px", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }}>
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#0F172A" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

export const LOGO = logo as { width: number; height: number; parts: { d: string; bbox: number[] }[] };

/** Marca STRATO vetorial; `fill` 0–1 e `sweep` (−0,3 a 1,3) para o brilho que atravessa. */
export const LogoVector: React.FC<{ width: number; fill?: number; sweep?: number; id?: string }> = ({ width, fill = 1, sweep = -1, id = "lv" }) => (
  <svg width={width} height={(width * LOGO.height) / LOGO.width} viewBox={`0 0 ${LOGO.width} ${LOGO.height}`} style={{ overflow: "visible" }}>
    <defs>
      <linearGradient id={`${id}-f`} x1="0" y1="0" x2="1" y2="1">
        <stop offset="0" stopColor="#FFFFFF" />
        <stop offset="1" stopColor={ink.ice} />
      </linearGradient>
      <linearGradient id={`${id}-s`} x1="0" y1="0" x2="1" y2="0" gradientTransform="rotate(20)">
        <stop offset={Math.max(0, sweep - 0.12)} stopColor="#fff" stopOpacity="0" />
        <stop offset={Math.min(1, Math.max(0, sweep))} stopColor="#fff" stopOpacity="0.95" />
        <stop offset={Math.min(1, sweep + 0.12)} stopColor="#fff" stopOpacity="0" />
      </linearGradient>
      <clipPath id={`${id}-c`}>
        {LOGO.parts.map((p, i) => (
          <path key={i} d={p.d} clipRule="evenodd" />
        ))}
      </clipPath>
    </defs>
    {LOGO.parts.map((p, i) => (
      <path key={i} d={p.d} fill={`url(#${id}-f)`} fillRule="evenodd" opacity={fill} />
    ))}
    {sweep > -0.2 && sweep < 1.2 ? <rect width={LOGO.width} height={LOGO.height} fill={`url(#${id}-s)`} clipPath={`url(#${id}-c)`} style={{ mixBlendMode: "overlay" }} /> : null}
  </svg>
);

/** Clarão suave (light leak) num corte. */
export const Leak: React.FC<{ at: number; dur?: number; color?: string }> = ({ at, dur = 14, color = ink.sky }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at - 2, at, at + dur], [0, 0.85, 0], clamp);
  if (o <= 0) return null;
  return <AbsoluteFill style={{ background: `radial-gradient(ellipse 60% 50% at 50% 50%, ${color}, transparent 70%)`, mixBlendMode: "screen", opacity: o, pointerEvents: "none" }} />;
};

export const colorsInk = colors;

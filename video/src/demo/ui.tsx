import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease } from "../brand/tokens";
import captures from "./captures.json";

// Peças do vídeo "Operação de ponta a ponta" com a identidade do STRATO (tokens de app/globals.css).

export const ds = {
  navy: "#0F172A",
  navyDeep: "#0B1220",
  blue: "#2563EB",
  blueSoft: "#EFF6FF",
  slate: "#64748B",
  border: "#E2E8F0",
  canvas: "#F8FAFC",
  success: "#16A34A",
  successSoft: "#F0FDF4",
  warning: "#D97706",
  white: "#FFFFFF",
};

type Capture = { src: string; width: number; height: number; boxes: Record<string, number[] | null> };
export const CAP = captures as Record<string, Capture>;
export type Rect = [number, number, number, number];
export const box = (shot: string, key: string, pad = 0): Rect => {
  const b = CAP[shot]?.boxes[key];
  if (!b) throw new Error(`caixa ausente: ${shot}.${key}`);
  return [b[0] - pad, b[1] - pad, b[2] + pad * 2, b[3] + pad * 2];
};

/** Interpolação suave entre chaves {at, value}. */
export const keyed = (frame: number, keys: { at: number; v: number[]; dur?: number }[]) => {
  let v = keys[0].v;
  for (let i = 1; i < keys.length; i++) {
    const k = keys[i];
    const d = k.dur ?? 18;
    if (frame < k.at - d) break;
    const p = interpolate(frame, [k.at - d, k.at], [0, 1], { ...clamp, easing: ease.inOut });
    v = v.map((x, j) => x + (k.v[j] - x) * p);
  }
  return v;
};

/**
 * Tela real capturada, enquadrada por uma câmera: `cam` = [x, y, largura visível] em px CSS da captura.
 * O quadro tem tamanho fixo; a câmera faz aproximações suaves.
 */
export const Screen: React.FC<{
  shot: string;
  w: number;
  h: number;
  cam: { at: number; v: number[]; dur?: number }[];
  children?: (toScreen: (x: number, y: number) => [number, number], scale: number) => React.ReactNode;
  radius?: number;
}> = ({ shot, w, h, cam, children, radius = 20 }) => {
  const frame = useCurrentFrame();
  const c = CAP[shot];
  const [x, y, vw] = keyed(frame, cam);
  const s = w / vw;
  const toScreen = (px: number, py: number): [number, number] => [(px - x) * s, (py - y) * s];
  return (
    <div style={{ position: "relative", width: w, height: h, borderRadius: radius, overflow: "hidden", background: ds.canvas, boxShadow: "0 30px 80px rgba(2,6,23,0.45), 0 0 0 1px rgba(255,255,255,0.08)" }}>
      <Img src={staticFile(c.src)} style={{ position: "absolute", left: -x * s, top: -y * s, width: c.width * s, height: c.height * s }} />
      {children ? children(toScreen, s) : null}
    </div>
  );
};

/** Troca de tela com fusão curta. */
export const Swap: React.FC<{ at: number; children: [React.ReactNode, React.ReactNode] }> = ({ at, children }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 8], [0, 1], clamp);
  return (
    <div style={{ position: "relative" }}>
      <div style={{ opacity: 1 - o }}>{children[0]}</div>
      <div style={{ position: "absolute", inset: 0, opacity: o }}>{children[1]}</div>
    </div>
  );
};

/** Destaque discreto em volta de um elemento da tela. */
export const Mark: React.FC<{ rect: Rect; toScreen: (x: number, y: number) => [number, number]; scale: number; at: number; end?: number; color?: string }> = ({ rect, toScreen, scale, at, end, color = ds.blue }) => {
  const frame = useCurrentFrame();
  const o = interpolate(frame, [at, at + 8], [0, 1], clamp) * (end === undefined ? 1 : interpolate(frame, [end, end + 8], [1, 0], clamp));
  if (o <= 0) return null;
  const [x, y] = toScreen(rect[0], rect[1]);
  return <div style={{ position: "absolute", left: x - 6, top: y - 6, width: rect[2] * scale + 12, height: rect[3] * scale + 12, borderRadius: 12, border: `3px solid ${color}`, boxShadow: `0 0 0 6px ${color}26`, opacity: o }} />;
};

/** Cursor com clique. Coordenadas na tela do quadro. */
export const Cursor: React.FC<{ path: { at: number; v: number[]; dur?: number }[]; click?: number }> = ({ path, click }) => {
  const frame = useCurrentFrame();
  const [x, y] = keyed(frame, path);
  const appear = interpolate(frame, [path[0].at - 6, path[0].at], [0, 1], clamp);
  const t = click === undefined ? -1 : frame - click;
  const r = interpolate(t, [0, 16], [0, 1], { ...clamp, easing: ease.out });
  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: appear, pointerEvents: "none" }}>
      {t >= 0 && t < 16 ? <div style={{ position: "absolute", left: -28, top: -28, width: 56, height: 56, borderRadius: "50%", border: `3px solid ${ds.blue}`, background: `${ds.blue}22`, opacity: 1 - r, scale: String(0.3 + r) }} /> : null}
      <svg width={34} height={40} viewBox="0 0 17 20" style={{ scale: String(t >= 0 && t < 6 ? 0.85 : 1), transformOrigin: "2px 2px", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }}>
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill={ds.navy} stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

/** Entrada com mola (subida + opacidade). */
export const usePop = () => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (at: number, dy = 24) => {
    const p = spring({ frame: frame - at, fps, config: { damping: 18, stiffness: 140 } });
    return { opacity: interpolate(p, [0, 0.4], [0, 1], clamp), translate: `0px ${(1 - p) * dy}px` };
  };
};

/** Cartão no estilo do produto (superfície branca, borda e sombra suaves). */
export const Card: React.FC<{ children: React.ReactNode; style?: React.CSSProperties }> = ({ children, style }) => (
  <div style={{ background: ds.white, border: `1px solid ${ds.border}`, borderRadius: 20, boxShadow: "0 24px 60px rgba(2,6,23,0.28)", padding: "24px 28px", color: ds.navy, ...style }}>{children}</div>
);

export const Kicker: React.FC<{ children: React.ReactNode; color?: string }> = ({ children, color = ds.slate }) => (
  <div style={{ fontSize: 19, fontWeight: 700, letterSpacing: "0.12em", textTransform: "uppercase", color }}>{children}</div>
);

/** Balão do Copiloto, no mesmo desenho do painel real. */
export const CopilotBubble: React.FC<{ text: string; at: number; style?: React.CSSProperties }> = ({ text, at, style }) => {
  const pop = usePop();
  return (
    <div style={{ ...pop(at), ...style }}>
      <Card style={{ padding: "22px 26px", borderRadius: 22 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
          <span style={{ width: 40, height: 40, borderRadius: 12, background: "linear-gradient(135deg, #1E3A8A, #0F172A)", display: "grid", placeItems: "center" }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none">
              <path d="M12 2l1.9 5.6L19.5 9.5l-5.6 1.9L12 17l-1.9-5.6L4.5 9.5l5.6-1.9L12 2z" fill="#fff" />
            </svg>
          </span>
          <div>
            <div style={{ fontSize: 16, fontWeight: 800, letterSpacing: "0.14em", color: ds.slate }}>COPILOTO STRATO</div>
          </div>
        </div>
        <div style={{ marginTop: 14, fontSize: 32, fontWeight: 600, lineHeight: 1.3 }}>{text}</div>
      </Card>
    </div>
  );
};

export const Check: React.FC<{ on: boolean; children: React.ReactNode; size?: number }> = ({ on, children, size = 30 }) => (
  <div style={{ display: "flex", alignItems: "center", gap: 14, fontSize: size, fontWeight: 600, color: on ? ds.navy : "#94A3B8" }}>
    <span style={{ width: size * 1.15, height: size * 1.15, borderRadius: "50%", flex: "none", display: "grid", placeItems: "center", background: on ? ds.success : "#E2E8F0", color: "#fff", fontSize: size * 0.7, fontWeight: 900 }}>{on ? "✓" : ""}</span>
    {children}
  </div>
);

export const FullBleed: React.FC<{ children: React.ReactNode }> = ({ children }) => <AbsoluteFill>{children}</AbsoluteFill>;

import { Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import statesJson from "../data/states.json";

// Tela viva: print real do STRATO (página inteira, 2×) com câmera, rolagem, cursor que se move e
// clica, digitação e destaques — tudo animado a 30 fps e sincronizado com a narração.

type StateMeta = { src: string; width: number; height: number; targets: Record<string, number[] | null> };
const STATES = statesJson as Record<string, StateMeta>;
export type Rect = [number, number, number, number];

/** Retângulo de um alvo capturado: "estado.alvo". */
export const target = (ref: string, pad = 0): Rect => {
  const [s, t] = ref.split(".");
  const r = STATES[s]?.targets[t];
  if (!r) throw new Error(`alvo inexistente: ${ref}`);
  return [r[0] - pad, r[1] - pad, r[2] + pad * 2, r[3] + pad * 2];
};

export type Shot = { at: number; state: string };
export type Cam = { at: number; rect: Rect; dur?: number };
export type CursorKey = { at: number; x: number; y: number; click?: boolean; dur?: number };
export type Mark = { at: number; end?: number; rect: Rect; color?: string };
export type Typing = { at: number; text: string; x: number; y: number; w?: number; cps?: number; size?: number };

/** Ponto de mira dentro de um alvo (fração da largura/altura). */
export const aim = (ref: string, ax = 0.5, ay = 0.5) => {
  const r = target(ref);
  return { x: r[0] + r[2] * ax, y: r[1] + r[3] * ay };
};

const lerpRect = (a: Rect, b: Rect, p: number) => a.map((v, i) => v + (b[i] - v) * p) as Rect;

export const LiveScreen: React.FC<{
  shots: Shot[];
  camera: Cam[];
  cursor?: CursorKey[];
  marks?: Mark[];
  typing?: Typing[];
  view?: { x: number; y: number; w: number; h: number };
  enterAt?: number;
  tilt?: number;
}> = ({ shots, camera, cursor = [], marks = [], typing = [], view = { x: 160, y: 96, w: 1600, h: 840 }, enterAt = 0, tilt = 10 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();

  // Câmera: interpola entre chaves com curva suave e uma leve "respiração" contínua.
  let rect = camera[0].rect;
  for (let i = 1; i < camera.length; i++) {
    const k = camera[i];
    const d = (k.dur ?? 1.0) * fps;
    if (frame < k.at) break;
    rect = lerpRect(rect, k.rect, interpolate(frame, [k.at, k.at + d], [0, 1], { ...clamp, easing: ease.inOut }));
  }
  const current = [...shots].reverse().find(s => frame >= s.at) ?? shots[0];
  const meta = STATES[current.state];
  const breathe = 1 + Math.sin(frame / 70) * 0.006;
  const s = Math.min(view.w / rect[2], view.h / rect[3]) * breathe;
  const cx = rect[0] + rect[2] / 2;
  const cy = rect[1] + rect[3] / 2;
  const tx = Math.min(0, Math.max(view.w - meta.width * s, view.w / 2 - cx * s));
  const ty = Math.min(0, Math.max(view.h - meta.height * s, view.h / 2 - cy * s));

  // Entrada com mola e inclinação 3D que se assenta.
  const enter = spring({ frame: frame - enterAt, fps, config: { damping: 18, stiffness: 90, mass: 0.9 } });
  const rotY = (1 - enter) * -tilt + Math.sin(frame / 90) * 0.8;
  const rotX = (1 - enter) * tilt * 0.5 + Math.cos(frame / 110) * 0.5;

  // Cursor: chega a cada chave no instante `at`, partindo da anterior.
  let cur: { x: number; y: number } | null = null;
  let press = 1;
  let ripple = -1;
  let cursorOpacity = 0;
  if (cursor.length) {
    const first = cursor[0];
    cursorOpacity = interpolate(frame, [first.at - 20, first.at - 8], [0, 1], clamp);
    cur = { x: first.x, y: first.y };
    for (let i = 1; i < cursor.length; i++) {
      const k = cursor[i];
      const d = (k.dur ?? 0.8) * fps;
      const p = interpolate(frame, [k.at - d, k.at], [0, 1], { ...clamp, easing: ease.inOut });
      const prev: { x: number; y: number } = cur;
      const arc = Math.sin(Math.PI * p) * 0.08;
      cur = { x: prev.x + (k.x - prev.x) * p + (k.y - prev.y) * arc, y: prev.y + (k.y - prev.y) * p - (k.x - prev.x) * arc };
    }
    for (const k of cursor) {
      if (!k.click) continue;
      const t = frame - k.at;
      if (t >= 0 && t < 8) press = interpolate(t, [0, 3, 8], [1, 0.8, 1], clamp);
      if (t >= 0 && t < 16) ripple = t / 16;
    }
  }

  return (
    <div style={{ position: "absolute", left: view.x, top: view.y, width: view.w, height: view.h, perspective: 2400 }}>
      <div
        style={{
          position: "absolute",
          inset: 0,
          borderRadius: 24,
          overflow: "hidden",
          background: colors.surface,
          boxShadow: "0 50px 140px rgba(2,6,23,0.65), 0 0 0 1px rgba(255,255,255,0.16)",
          transform: `rotateY(${rotY}deg) rotateX(${rotX}deg) scale(${0.9 + enter * 0.1})`,
          opacity: interpolate(enter, [0, 0.4], [0, 1], clamp),
        }}
      >
        <div style={{ position: "absolute", left: 0, top: 0, width: meta.width, height: meta.height, transformOrigin: "0 0", translate: `${tx}px ${ty}px`, scale: String(s) }}>
          {shots.map((sh, i) => {
            const m = STATES[sh.state];
            const next = shots[i + 1];
            const op =
              (i === 0 ? 1 : interpolate(frame, [sh.at, sh.at + 9], [0, 1], clamp)) *
              (next ? interpolate(frame, [next.at + 9, next.at + 10], [1, 0], clamp) : 1);
            if (op <= 0) return null;
            return <Img key={sh.state + i} src={staticFile(m.src)} style={{ position: "absolute", left: 0, top: 0, width: m.width, height: m.height, opacity: op }} />;
          })}
          {marks.map((m, i) => {
            const on = interpolate(frame, [m.at, m.at + 10], [0, 1], clamp) * (m.end === undefined ? 1 : interpolate(frame, [m.end, m.end + 10], [1, 0], clamp));
            if (on <= 0) return null;
            const c = m.color ?? colors.accentStrong;
            const pulse = 0.6 + 0.4 * Math.sin((frame - m.at) / 8);
            const pad = 8 / s;
            return (
              <div
                key={i}
                style={{
                  position: "absolute",
                  left: m.rect[0] - pad,
                  top: m.rect[1] - pad,
                  width: m.rect[2] + pad * 2,
                  height: m.rect[3] + pad * 2,
                  borderRadius: 14 / s,
                  border: `${3 / s}px solid ${c}`,
                  boxShadow: `0 0 0 ${6 / s}px ${c}22, 0 0 ${(30 * pulse) / s}px ${c}aa`,
                  opacity: on,
                  scale: String(interpolate(on, [0, 1], [1.04, 1])),
                }}
              />
            );
          })}
          {typing.map((t, i) => {
            const n = Math.floor(Math.max(0, frame - t.at) / (fps / (t.cps ?? 16)));
            if (frame < t.at) return null;
            const shown = t.text.slice(0, n);
            return (
              <div key={i} style={{ position: "absolute", left: t.x, top: t.y, width: t.w, fontSize: t.size ?? 16, lineHeight: 1.4, color: colors.ink, background: "#fff", paddingRight: 6, whiteSpace: "nowrap", fontFamily: "Urbanist, sans-serif" }}>
                {shown}
                <span style={{ opacity: Math.floor(frame / 8) % 2 ? 1 : 0, color: colors.accentStrong }}>|</span>
              </div>
            );
          })}
          {cur ? (
            <div style={{ position: "absolute", left: cur.x, top: cur.y, opacity: cursorOpacity, scale: String(1 / s), transformOrigin: "0 0" }}>
              {ripple >= 0 ? (
                <div style={{ position: "absolute", left: -26, top: -26, width: 52, height: 52, borderRadius: "50%", border: "3px solid rgba(59,107,255,0.9)", background: "rgba(59,107,255,0.15)", opacity: 1 - ripple, scale: String(0.4 + ripple * 1.4) }} />
              ) : null}
              <svg width={34} height={40} viewBox="0 0 17 20" style={{ scale: String(press), transformOrigin: "2px 2px", filter: "drop-shadow(0 4px 8px rgba(0,0,0,0.35))" }}>
                <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#0F172A" stroke="white" strokeWidth="1.3" strokeLinejoin="round" />
              </svg>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
};

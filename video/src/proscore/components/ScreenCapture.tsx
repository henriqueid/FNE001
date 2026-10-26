import { Img, interpolate, staticFile, useCurrentFrame } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Highlight } from "../../components/Highlight";

// Print real do STRATO (capturado em 1600 × 1000 de tela) dentro de uma moldura, com câmera
// que enquadra retângulos de interesse e anéis de destaque. Tempos em frames da cena.
export const SHOT = { w: 1600, h: 1000 };
export type Rect = [number, number, number, number];
export type CamKey = { at: number; rect: Rect };
export type Mark = { at: number; end?: number; rect: Rect; color?: string };

const MOVE = 26;

export const ScreenCapture: React.FC<{
  images: { src: string; at: number }[];
  camera: CamKey[];
  marks?: Mark[];
  view?: { x: number; y: number; w: number; h: number };
  enterAt?: number;
  children?: React.ReactNode;
}> = ({ images, camera, marks = [], view = { x: 230, y: 100, w: 1460, h: 800 }, enterAt = 0, children }) => {
  const frame = useCurrentFrame();
  let rect = camera[0].rect;
  for (let i = 1; i < camera.length; i++) {
    const k = camera[i];
    if (frame < k.at) break;
    const p = interpolate(frame, [k.at, k.at + MOVE], [0, 1], { ...clamp, easing: ease.inOut });
    rect = rect.map((v, j) => v + (k.rect[j] - v) * p) as Rect;
  }
  const cover = Math.max(view.w / SHOT.w, view.h / SHOT.h);
  const s = Math.max(Math.min(view.w / rect[2], view.h / rect[3]), cover);
  const cx = rect[0] + rect[2] / 2;
  const cy = rect[1] + rect[3] / 2;
  const tx = Math.min(0, Math.max(view.w - SHOT.w * s, view.w / 2 - cx * s));
  const ty = Math.min(0, Math.max(view.h - SHOT.h * s, view.h / 2 - cy * s));
  const enter = interpolate(frame, [enterAt, enterAt + 20], [0, 1], { ...clamp, easing: ease.out });

  return (
    <div
      style={{
        position: "absolute",
        left: view.x,
        top: view.y,
        width: view.w,
        height: view.h,
        borderRadius: 26,
        overflow: "hidden",
        background: colors.surface,
        boxShadow: "0 40px 120px rgba(2, 6, 23, 0.6), 0 0 0 1px rgba(255,255,255,0.14)",
        opacity: enter,
        scale: String(0.96 + enter * 0.04),
      }}
    >
      <div
        style={{
          position: "absolute",
          left: 0,
          top: 0,
          width: SHOT.w,
          height: SHOT.h,
          transformOrigin: "0 0",
          translate: `${tx}px ${ty}px`,
          scale: String(s),
        }}
      >
        {images.map((img, i) => (
          <Img
            key={img.src}
            src={staticFile(img.src)}
            style={{
              position: "absolute",
              inset: 0,
              width: SHOT.w,
              height: SHOT.h,
              opacity: i === 0 ? 1 : interpolate(frame, [img.at, img.at + 12], [0, 1], clamp),
            }}
          />
        ))}
        {marks.map((m, i) => (
          <Highlight
            key={i}
            x={m.rect[0]}
            y={m.rect[1]}
            w={m.rect[2]}
            h={m.rect[3]}
            delay={m.at / 30}
            end={m.end === undefined ? undefined : m.end / 30}
            color={m.color}
            unit={1 / s}
          />
        ))}
        {children}
      </div>
    </div>
  );
};

import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "./Background";
import { Highlight } from "./Highlight";

// Prints do sistema são capturados em 1600 × 1000 px de tela (2× de densidade).
export const SHOT = { w: 1600, h: 1000 };

export type Rect = [number, number, number, number];
export type CameraKey = { at: number; rect: Rect };
export type Mark = { at: number; end?: number; rect: Rect; color?: string };
export type ShotImage = { src: string; at: number };

const CAMERA_MOVE = 0.9;

// Palco das cenas de produto: print real do STRATO dentro de uma moldura, com câmera que
// enquadra cada retângulo de interesse e anéis de destaque nas coordenadas do print.
export const ProductShot: React.FC<{
  images: ShotImage[];
  camera: CameraKey[];
  marks?: Mark[];
  children?: React.ReactNode;
}> = ({ images, camera, marks = [], children }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { width, vertical, u } = useLayout();
  const t = frame / fps;

  const view = vertical
    ? { x: u(40), y: u(250), w: width - u(80), h: u(1120) }
    : { x: u(192), y: u(84), w: u(1536), h: u(960) };

  // Interpola o enquadramento entre a chave anterior e a atual.
  let rect = camera[0].rect;
  for (let i = 1; i < camera.length; i++) {
    const k = camera[i];
    if (t < k.at) break;
    const p = interpolate(t, [k.at, k.at + CAMERA_MOVE], [0, 1], { ...clamp, easing: ease.inOut });
    rect = rect.map((v, j) => v + (k.rect[j] - v) * p) as Rect;
  }
  const cover = Math.max(view.w / SHOT.w, view.h / SHOT.h);
  const s = Math.max(Math.min(view.w / rect[2], view.h / rect[3]), cover);
  const cx = rect[0] + rect[2] / 2;
  const cy = rect[1] + rect[3] / 2;
  // Quando a área não cabe na largura (formato vertical), ancora na borda esquerda para não cortar títulos.
  const anchorX = rect[2] * s > view.w ? -rect[0] * s : view.w / 2 - cx * s;
  const tx = Math.min(0, Math.max(view.w - SHOT.w * s, anchorX));
  const ty = Math.min(0, Math.max(view.h - SHOT.h * s, view.h / 2 - cy * s));
  const enter = interpolate(frame, [0, 0.7 * fps], [0, 1], { ...clamp, easing: ease.out });

  return (
    <AbsoluteFill>
      <Background grid={false} />
      <div
        style={{
          position: "absolute",
          left: view.x,
          top: view.y,
          width: view.w,
          height: view.h,
          borderRadius: u(28),
          overflow: "hidden",
          background: colors.surface,
          boxShadow: `0 ${u(40)}px ${u(120)}px rgba(2, 6, 23, 0.6), 0 0 0 1px rgba(255,255,255,0.14)`,
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
                opacity: i === 0 ? 1 : interpolate(t, [img.at, img.at + 0.35], [0, 1], clamp),
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
              delay={m.at}
              end={m.end}
              color={m.color}
              unit={1 / s}
            />
          ))}
          {children}
        </div>
      </div>
    </AbsoluteFill>
  );
};

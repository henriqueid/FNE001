import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";

// Anel de foco sobre o elemento que a legenda explica. Coordenadas na escala da janela.
export const Highlight: React.FC<{
  x: number;
  y: number;
  w: number;
  h: number;
  delay: number;
  end?: number;
  color?: string;
  radius?: number;
}> = ({ x, y, w, h, delay, end, color = colors.accentStrong, radius = 18 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const start = delay * fps;
  const pulse = interpolate(Math.sin((frame - start) / 9), [-1, 1], [0.55, 1]);

  return (
    <div
      style={{
        position: "absolute",
        left: x,
        top: y,
        width: w,
        height: h,
        borderRadius: radius,
        border: `3px solid ${color}`,
        boxShadow: `0 0 0 6px ${color}22, 0 0 ${36 * pulse}px ${color}88`,
        opacity:
          interpolate(frame, [start, start + 0.3 * fps], [0, 1], clamp) *
          (end === undefined ? 1 : interpolate(frame, [end * fps, end * fps + 0.3 * fps], [1, 0], clamp)),
        scale: interpolate(frame, [start, start + 0.45 * fps], [1.06, 1], { ...clamp, easing: ease.out }),
        pointerEvents: "none",
      }}
    />
  );
};

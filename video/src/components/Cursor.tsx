import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease } from "../brand/tokens";

// Cursor que viaja até o alvo e clica (pulso no momento do clique).
export const Cursor: React.FC<{
  from: [number, number];
  to: [number, number];
  start: number;
  click: number;
}> = ({ from, to, start, click }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = interpolate(frame, [start * fps, click * fps], [0, 1], { ...clamp, easing: ease.inOut });
  const x = from[0] + (to[0] - from[0]) * t;
  const y = from[1] + (to[1] - from[1]) * t;
  const press = interpolate(frame, [click * fps, click * fps + 4, click * fps + 10], [1, 0.82, 1], clamp);
  const ring = interpolate(frame, [click * fps, click * fps + 14], [0, 1], clamp);

  return (
    <div style={{ position: "absolute", left: x, top: y, opacity: interpolate(frame, [start * fps - 6, start * fps], [0, 1], clamp) }}>
      <div
        style={{
          position: "absolute",
          left: -28,
          top: -28,
          width: 56,
          height: 56,
          borderRadius: "50%",
          border: "3px solid rgba(59,107,255,0.8)",
          opacity: ring > 0 && ring < 1 ? 1 - ring : 0,
          scale: 0.4 + ring * 1.2,
        }}
      />
      <svg width="34" height="40" viewBox="0 0 17 20" style={{ scale: press, transformOrigin: "0 0" }}>
        <path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#0F172A" stroke="white" strokeWidth="1.2" strokeLinejoin="round" />
      </svg>
    </div>
  );
};

import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { colors } from "../brand/tokens";
import { useLayout } from "../brand/layout";

// Fundo da marca: navy profundo, brilho azul que deriva devagar e grade técnica discreta.
export const Background: React.FC<{ grid?: boolean }> = ({ grid = true }) => {
  const frame = useCurrentFrame();
  const { durationInFrames } = useVideoConfig();
  const { u } = useLayout();
  const drift = interpolate(frame, [0, durationInFrames], [0, 1]);

  return (
    <AbsoluteFill style={{ backgroundColor: colors.navy950 }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse 60% 55% at ${68 + drift * 8}% ${8 + drift * 6}%, ${colors.glow}cc 0%, ${colors.navy800}66 40%, transparent 72%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `linear-gradient(180deg, transparent 40%, ${colors.navy950} 100%)`,
        }}
      />
      {grid ? (
        <AbsoluteFill
          style={{
            opacity: 0.07,
            backgroundImage:
              "linear-gradient(rgba(255,255,255,0.6) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.6) 1px, transparent 1px)",
            backgroundSize: `${u(64)}px ${u(64)}px`,
            maskImage: "radial-gradient(ellipse 80% 70% at 50% 40%, black, transparent)",
          }}
        />
      ) : null}
    </AbsoluteFill>
  );
};

import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "../components/Background";

// Feixes de luz convergem e revelam a marca.
export const LogoReveal: React.FC<{ tagline: string }> = ({ tagline }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, width } = useLayout();
  const beams = [-u(26), 0, u(26)];
  const logoW = vertical ? u(760) : u(820);

  return (
    <AbsoluteFill>
      <Background />
      {beams.map((offset, i) => {
        const s = (0.05 * i) * fps;
        const p = interpolate(frame, [s, s + 0.8 * fps], [0, 1], { ...clamp, easing: ease.out });
        return (
          <div
            key={i}
            style={{
              position: "absolute",
              top: `calc(50% + ${offset - u(30)}px)`,
              left: i % 2 ? width * (1 - p) * 0.5 : -width * 0.6 + p * width * 0.75,
              width: width * 0.6,
              height: u(4),
              borderRadius: u(2),
              background: `linear-gradient(90deg, transparent, ${colors.accent}, transparent)`,
              opacity: interpolate(frame, [s, s + 0.3 * fps, 0.9 * fps, 1.2 * fps], [0, 1, 1, 0], clamp),
              filter: `blur(${u(1)}px)`,
            }}
          />
        );
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: u(36) }}>
        <Img
          src={staticFile("strato-logo.png")}
          style={{
            width: logoW,
            opacity: interpolate(frame, [0.8 * fps, 1.3 * fps], [0, 1], clamp),
            filter: `blur(${interpolate(frame, [0.8 * fps, 1.3 * fps], [16, 0], clamp)}px)`,
            scale: interpolate(frame, [0.8 * fps, 2.6 * fps], [0.92, 1], { ...clamp, easing: ease.out }),
          }}
        />
        <div
          style={{
            color: colors.textSoft,
            fontSize: vertical ? u(40) : u(36),
            fontWeight: 500,
            textAlign: "center",
            padding: `0 ${u(60)}px`,
            opacity: interpolate(frame, [1.4 * fps, 1.9 * fps], [0, 1], clamp),
          }}
        >
          {tagline}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

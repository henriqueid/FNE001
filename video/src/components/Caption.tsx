import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease, timing } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { WordReveal } from "./WordReveal";

// Cartão de legenda de vidro: rótulo do módulo, título curto e apoio opcional.
export const Caption: React.FC<{
  eyebrow: string;
  title: string;
  body?: string;
  delay?: number;
}> = ({ eyebrow, title, body, delay = 0.35 }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const start = delay * fps;
  const titleWords = title.split(" ").length;
  const bodyDelay = delay + 0.2 + titleWords * timing.wordStagger;

  return (
    <div
      style={{
        position: "absolute",
        left: vertical ? u(64) : u(110),
        right: vertical ? u(64) : undefined,
        bottom: vertical ? u(150) : u(96),
        width: vertical ? undefined : u(760),
        padding: vertical ? `${u(44)}px ${u(48)}px` : `${u(36)}px ${u(44)}px`,
        borderRadius: u(28),
        background: colors.captionBg,
        border: `1px solid ${colors.captionBorder}`,
        boxShadow: `0 ${u(30)}px ${u(80)}px rgba(2, 6, 23, 0.55)`,
        backdropFilter: "blur(18px)",
        opacity: interpolate(frame, [start, start + timing.captionIn * fps], [0, 1], clamp),
        translate: interpolate(frame, [start, start + timing.captionIn * fps], [`0px ${u(40)}px`, "0px 0px"], {
          ...clamp,
          easing: ease.out,
        }),
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: u(12),
          color: colors.accent,
          fontSize: vertical ? u(30) : u(24),
          fontWeight: 700,
          letterSpacing: "0.16em",
          textTransform: "uppercase",
        }}
      >
        <span
          style={{
            width: u(10),
            height: u(10),
            borderRadius: "50%",
            background: colors.accent,
            boxShadow: `0 0 ${u(14)}px ${colors.accent}`,
          }}
        />
        {eyebrow}
      </div>
      <div
        style={{
          marginTop: u(14),
          color: colors.white,
          fontSize: vertical ? u(72) : u(60),
          fontWeight: 700,
          lineHeight: 1.08,
          letterSpacing: "-0.02em",
        }}
      >
        <WordReveal text={title} delay={delay + 0.15} />
      </div>
      {body ? (
        <div
          style={{
            marginTop: u(16),
            color: colors.textSoft,
            fontSize: vertical ? u(40) : u(32),
            fontWeight: 500,
            lineHeight: 1.3,
            opacity: interpolate(frame, [bodyDelay * fps, (bodyDelay + 0.5) * fps], [0, 1], clamp),
          }}
        >
          {body}
        </div>
      ) : null}
    </div>
  );
};

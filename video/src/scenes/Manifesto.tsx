import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "../components/Background";
import { WordReveal } from "../components/WordReveal";

// Fechamento de posicionamento: quem faz o quê na operação.
export const Manifesto: React.FC<{ footnote: string }> = ({ footnote }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const lines: [string, string, string][] = [
    ["A IA", "sugere.", colors.accent],
    ["O motor", "calcula.", colors.white],
    ["Você", "decide.", colors.decide],
  ];

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ justifyContent: "center", padding: vertical ? `0 ${u(80)}px` : `0 ${u(170)}px` }}>
        {lines.map(([lead, key, color], i) => (
          <div
            key={key}
            style={{
              fontSize: vertical ? u(120) : u(120),
              lineHeight: 1.08,
              letterSpacing: "-0.03em",
              color: colors.textSoft,
              fontWeight: 300,
            }}
          >
            <WordReveal text={lead} delay={0.2 + i * 0.55} />{" "}
            <span style={{ fontWeight: 800, color }}>
              <WordReveal text={key} delay={0.35 + i * 0.55} />
            </span>
          </div>
        ))}
        <div
          style={{
            marginTop: u(48),
            color: colors.textFaint,
            fontSize: vertical ? u(38) : u(34),
            fontWeight: 500,
            opacity: interpolate(frame, [2.2 * fps, 2.7 * fps], [0, 1], clamp),
          }}
        >
          {footnote}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

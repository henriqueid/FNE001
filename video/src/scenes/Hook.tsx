import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "../components/Background";
import { WordReveal } from "../components/WordReveal";

// Abertura: as dores da operação aparecem, são riscadas e dão lugar à promessa.
export const Hook: React.FC<{ pains: string[]; answer: string; answerAccent: string }> = ({
  pains,
  answer,
  answerAccent,
}) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const step = 0.42;
  const strikeAt = pains.length * step + 0.5;
  const answerAt = strikeAt + 0.9;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill
        style={{
          justifyContent: "center",
          padding: vertical ? `0 ${u(80)}px` : `0 ${u(170)}px`,
        }}
      >
        <div
          style={{
            opacity: interpolate(frame, [answerAt * fps, (answerAt + 0.5) * fps], [1, 0.22], clamp),
            translate: interpolate(frame, [answerAt * fps, (answerAt + 0.6) * fps], ["0px 0px", `0px ${-u(30)}px`], {
              ...clamp,
              easing: ease.out,
            }),
          }}
        >
          {pains.map((line, i) => {
            const at = 0.2 + i * step;
            const strike = strikeAt + i * 0.1;
            return (
              <div
                key={line}
                style={{
                  position: "relative",
                  width: "fit-content",
                  color: colors.textSoft,
                  fontSize: vertical ? u(86) : u(84),
                  fontWeight: 300,
                  lineHeight: 1.18,
                  letterSpacing: "-0.02em",
                  opacity: interpolate(frame, [at * fps, (at + 0.35) * fps], [0, 1], clamp),
                  translate: interpolate(frame, [at * fps, (at + 0.5) * fps], [`${-u(24)}px 0px`, "0px 0px"], {
                    ...clamp,
                    easing: ease.out,
                  }),
                }}
              >
                {line}
                <div
                  style={{
                    position: "absolute",
                    left: 0,
                    top: "56%",
                    height: u(5),
                    borderRadius: u(3),
                    background: colors.alert,
                    width: `${interpolate(frame, [strike * fps, (strike + 0.35) * fps], [0, 100], { ...clamp, easing: ease.inOut })}%`,
                  }}
                />
              </div>
            );
          })}
        </div>
        <div
          style={{
            marginTop: u(48),
            color: colors.white,
            fontSize: vertical ? u(96) : u(96),
            fontWeight: 700,
            lineHeight: 1.05,
            letterSpacing: "-0.03em",
          }}
        >
          <WordReveal text={answer} delay={answerAt} />
          <br />
          <span style={{ color: colors.accent }}>
            <WordReveal text={answerAccent} delay={answerAt + 0.3} />
          </span>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

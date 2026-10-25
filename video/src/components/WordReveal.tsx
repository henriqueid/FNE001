import { interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, ease, timing } from "../brand/tokens";

// Revela palavra por palavra (sobe e aparece). Substitui o efeito de máquina de escrever,
// que cortava palavras no meio e atrasava a leitura.
export const WordReveal: React.FC<{
  text: string;
  delay?: number;
  stagger?: number;
  highlight?: Record<string, string>;
}> = ({ text, delay = 0, stagger = timing.wordStagger, highlight = {} }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const words = text.split(" ");

  return (
    <>
      {words.map((word, i) => {
        const start = (delay + i * stagger) * fps;
        const key = word.replace(/[.,!?]/g, "");
        return (
          <span
            key={`${word}-${i}`}
            style={{
              display: "inline-block",
              whiteSpace: "pre",
              color: highlight[key],
              opacity: interpolate(frame, [start, start + 0.35 * fps], [0, 1], clamp),
              translate: interpolate(frame, [start, start + 0.45 * fps], ["0em 0.35em", "0em 0em"], {
                ...clamp,
                easing: ease.out,
              }),
              filter: `blur(${interpolate(frame, [start, start + 0.35 * fps], [6, 0], clamp)}px)`,
            }}
          >
            {word}
            {i < words.length - 1 ? " " : ""}
          </span>
        );
      })}
    </>
  );
};

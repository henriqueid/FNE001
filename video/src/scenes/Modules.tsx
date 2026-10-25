import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "../components/Background";
import { WordReveal } from "../components/WordReveal";

const MODULES = [
  ["operacoes.jpg", "Operações"],
  ["carteira.jpg", "Carteira"],
  ["financeiro.jpg", "Financeiro"],
  ["controladoria.jpg", "Controladoria"],
  ["comercial.jpg", "Comercial"],
  ["cadastros.jpg", "Cadastros"],
] as const;

// Resposta a "telas demais": os módulos chegam e se encaixam numa grade única.
export const Modules: React.FC<{ title: string; accent: string }> = ({ title, accent }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical, width } = useLayout();
  const cols = vertical ? 2 : 3;
  const gap = u(24);
  const gridW = vertical ? width - u(120) : u(1500);
  const tileW = (gridW - gap * (cols - 1)) / cols;
  const tileH = tileW / 1.6;

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: u(56) }}>
        <div
          style={{
            color: colors.white,
            fontSize: vertical ? u(80) : u(72),
            fontWeight: 700,
            letterSpacing: "-0.02em",
            textAlign: "center",
            lineHeight: 1.1,
            padding: `0 ${u(60)}px`,
          }}
        >
          <WordReveal text={title} delay={0.1} />{" "}
          <span style={{ color: colors.accent }}>
            <WordReveal text={accent} delay={0.35} />
          </span>
        </div>
        <div style={{ display: "grid", gridTemplateColumns: `repeat(${cols}, ${tileW}px)`, gap }}>
          {MODULES.map(([src, label], i) => {
            const at = (0.5 + i * 0.12) * fps;
            return (
              <div
                key={src}
                style={{
                  position: "relative",
                  width: tileW,
                  height: tileH,
                  borderRadius: u(18),
                  overflow: "hidden",
                  boxShadow: `0 ${u(20)}px ${u(50)}px rgba(2,6,23,0.5), 0 0 0 1px rgba(255,255,255,0.14)`,
                  opacity: interpolate(frame, [at, at + 0.4 * fps], [0, 1], clamp),
                  translate: interpolate(frame, [at, at + 0.6 * fps], [`0px ${u(60)}px`, "0px 0px"], { ...clamp, easing: ease.out }),
                  scale: interpolate(frame, [at, at + 0.6 * fps], [0.9, 1], { ...clamp, easing: ease.out }),
                }}
              >
                <Img src={staticFile(`screens/${src}`)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top" }} />
                <div
                  style={{
                    position: "absolute",
                    left: u(14),
                    bottom: u(14),
                    padding: `${u(8)}px ${u(16)}px`,
                    borderRadius: 999,
                    background: colors.captionBg,
                    color: colors.white,
                    fontSize: vertical ? u(30) : u(24),
                    fontWeight: 700,
                  }}
                >
                  {label}
                </div>
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

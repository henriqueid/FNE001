import { AbsoluteFill, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import { clamp, colors, ease } from "../brand/tokens";
import { useLayout } from "../brand/layout";
import { Background } from "../components/Background";

// Assinatura com chamada para ação; o vídeo original terminava sem próximo passo.
export const EndCard: React.FC<{ segments: string; cta: string; contact: string }> = ({ segments, cta, contact }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const { u, vertical } = useLayout();
  const appear = (at: number) => ({
    opacity: interpolate(frame, [at * fps, (at + 0.5) * fps], [0, 1], clamp),
    translate: interpolate(frame, [at * fps, (at + 0.6) * fps], [`0px ${u(20)}px`, "0px 0px"], { ...clamp, easing: ease.out }),
  });

  return (
    <AbsoluteFill>
      <Background />
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", padding: `0 ${u(60)}px` }}>
        <Img src={staticFile("strato-logo.png")} style={{ width: vertical ? u(720) : u(700), ...appear(0.1) }} />
        <div style={{ marginTop: u(44), fontSize: vertical ? u(76) : u(72), fontWeight: 700, color: colors.white, letterSpacing: "-0.02em", ...appear(0.4) }}>
          Menos planilha. <span style={{ color: colors.accent }}>Mais decisão.</span>
        </div>
        <div style={{ marginTop: u(22), fontSize: vertical ? u(30) : u(26), letterSpacing: "0.3em", color: colors.textFaint, fontWeight: 600, ...appear(0.7) }}>
          {segments}
        </div>
        <div
          style={{
            marginTop: u(64),
            padding: `${u(22)}px ${u(44)}px`,
            borderRadius: 999,
            background: colors.white,
            color: colors.navy900,
            fontSize: vertical ? u(40) : u(34),
            fontWeight: 700,
            ...appear(1.0),
          }}
        >
          {cta}
        </div>
        <div style={{ marginTop: u(22), fontSize: vertical ? u(34) : u(28), color: colors.textSoft, fontWeight: 500, ...appear(1.2) }}>
          {contact}
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

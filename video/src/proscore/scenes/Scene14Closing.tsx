import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { LiveScreen } from "../components/LiveScreen";
import { Particles, usePop } from "../components/motion";
import { SceneLabel } from "../components/ui";

// Cena 14: volta ao dashboard real, a câmera se afasta e a assinatura entra.
export const Scene14Closing: React.FC = () => {
  const { frame, at, fps } = useNarration("s14");
  const pop = usePop();
  const out = interpolate(frame, [at(2), at(2) + 40], [1, 0], { ...clamp, easing: ease.inOut });
  const ring = spring({ frame: frame - at(2) - 20, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={40} seed="s14" />
      <SceneLabel index={14} title="Encerramento" />
      <AbsoluteFill style={{ opacity: out, scale: String(0.7 + out * 0.3) }}>
        <LiveScreen
          shots={[{ at: 0, state: "home" }]}
          camera={[
            { at: 0, rect: [0, 280, 1250, 656] },
            { at: 20, rect: [0, 0, 1600, 840], dur: 6 },
          ]}
          tilt={0}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", border: `2px solid ${colors.accent}`, opacity: (1 - ring) * 0.6, scale: String(0.2 + ring * 1.4) }} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, ...pop(at(2) + 30, { from: 0.6 }) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 430 }} />
          <span style={{ fontSize: 60, color: colors.textFaint, fontWeight: 300 }}>×</span>
          {/* Nome em texto simples: sem reproduzir a identidade visual da proScore. */}
          <span style={{ fontSize: 78, fontWeight: 700, color: colors.white }}>proScore</span>
        </div>
        <div style={{ marginTop: 44, fontSize: 40, color: colors.white, fontWeight: 600, ...pop(at(3)) }}>
          Explorando novas possibilidades para o mercado de crédito e recebíveis.
        </div>
        <div style={{ marginTop: 56, fontSize: 32, fontWeight: 700, color: colors.white, ...pop(at(4)) }}>Henrique Moura</div>
        <div style={{ fontSize: 25, color: colors.accent, fontWeight: 600, letterSpacing: "0.2em", ...pop(at(4) + 8) }}>STRATO</div>
        <div style={{ marginTop: 50, fontSize: 22, color: colors.textFaint, fontStyle: "italic", ...pop(at(4) + 30) }}>
          Proposta de integração e parceria — sujeita a avaliação conjunta.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

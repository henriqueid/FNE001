import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ScreenCapture } from "../components/ScreenCapture";
import { appear, SceneLabel } from "../components/ui";


// Cena 14: volta ao dashboard real, câmera se afasta e surge a assinatura final.
export const Scene14Closing: React.FC = () => {
  const { frame, at } = useNarration("s14");
  const out = interpolate(frame, [at(2), at(2) + 40], [1, 0], { ...clamp, easing: ease.inOut });
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={14} title="Encerramento" />
      <AbsoluteFill style={{ opacity: out, scale: String(0.85 + out * 0.15) }}>
        <ScreenCapture
          images={[{ src: "screens/visao-geral.jpg", at: 0 }]}
          camera={[
            { at: 0, rect: [0, 280, 1260, 700] },
            { at: 30, rect: [0, 0, 1600, 1000] },
          ]}
        />
      </AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center", gap: 0 }}>
        <div style={{ display: "flex", alignItems: "center", gap: 40, ...appear(frame, at(2) + 30, 20, 20) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 420 }} />
          <span style={{ fontSize: 60, color: colors.textFaint, fontWeight: 300 }}>×</span>
          {/* Nome em texto simples: sem reproduzir a identidade visual da proScore. */}
          <span style={{ fontSize: 76, fontWeight: 700, color: colors.white }}>proScore</span>
        </div>
        <div style={{ marginTop: 40, fontSize: 38, color: colors.white, fontWeight: 600, ...appear(frame, at(3), 20) }}>
          Explorando novas possibilidades para o mercado de crédito e recebíveis.
        </div>
        <div style={{ marginTop: 56, fontSize: 30, fontWeight: 700, color: colors.white, ...appear(frame, at(4), 20) }}>Henrique Moura</div>
        <div style={{ fontSize: 24, color: colors.accent, fontWeight: 600, letterSpacing: "0.2em", ...appear(frame, at(4) + 8, 20) }}>STRATO</div>
        <div style={{ marginTop: 50, fontSize: 21, color: colors.textFaint, fontStyle: "italic", ...appear(frame, at(4) + 30, 20) }}>
          Proposta de integração e parceria — sujeita a avaliação conjunta.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

import { AbsoluteFill, Img, staticFile } from "remotion";
import "../brand/fonts";
import { colors, fontFamily } from "../brand/tokens";
import { Background } from "../components/Background";

// Capa institucional do vídeo STRATO × proScore (envio privado).
export const ProScoreThumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, width: 820, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Img src={staticFile("strato-logo.png")} style={{ width: 330 }} />
        <span style={{ fontSize: 50, color: colors.textFaint, fontWeight: 300 }}>×</span>
        <span style={{ fontSize: 62, color: colors.white, fontWeight: 700 }}>proScore</span>
      </div>
      <div style={{ marginTop: 56, color: colors.white, fontSize: 70, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
        Operação, dados
        <br />e decisão
        <br />
        <span style={{ color: colors.accent }}>em um único fluxo.</span>
      </div>
      <div style={{ marginTop: 36, color: colors.textSoft, fontSize: 28, fontWeight: 500 }}>
        Visão de produto e oportunidades de integração
      </div>
      <div style={{ marginTop: 14, color: colors.textFaint, fontSize: 22 }}>Henrique Moura · STRATO · proposta sujeita a avaliação conjunta</div>
    </div>
    <div style={{ position: "absolute", left: 980, top: 180, width: 1180, height: 738, borderRadius: 28, overflow: "hidden", rotate: "-4deg", boxShadow: "0 50px 140px rgba(2,6,23,0.7), 0 0 0 1px rgba(255,255,255,0.16)" }}>
      <Img src={staticFile("proscore/screens/motor-resultado.jpg")} style={{ width: "100%", height: "100%" }} />
    </div>
  </AbsoluteFill>
);

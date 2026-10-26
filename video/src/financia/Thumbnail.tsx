import { AbsoluteFill, Img, staticFile } from "remotion";
import "../brand/fonts";
import { colors, fontFamily } from "../brand/tokens";
import { Background } from "../components/Background";

// Capa do vídeo de proposta de parceria STRATO × Financia (envio privado).
export const FinanciaThumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, width: 840, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
        <Img src={staticFile("strato-logo.png")} style={{ width: 330 }} />
        <span style={{ fontSize: 50, color: colors.textFaint, fontWeight: 300 }}>×</span>
        <span style={{ fontSize: 66, color: colors.white, fontWeight: 800 }}>Financia</span>
      </div>
      <div style={{ marginTop: 56, color: colors.white, fontSize: 74, fontWeight: 800, lineHeight: 1.05, letterSpacing: "-0.03em" }}>
        Construindo
        <br />com quem
        <br />
        <span style={{ color: colors.accent }}>opera.</span>
      </div>
      <div style={{ marginTop: 36, color: colors.textSoft, fontSize: 30, fontWeight: 500 }}>Homologação · Piloto · Escala</div>
      <div style={{ marginTop: 14, color: colors.textFaint, fontSize: 22 }}>Proposta de parceria · STRATO</div>
    </div>
    <div style={{ position: "absolute", left: 1000, top: 180, width: 1180, height: 738, borderRadius: 28, overflow: "hidden", rotate: "-4deg", boxShadow: "0 50px 140px rgba(2,6,23,0.7), 0 0 0 1px rgba(255,255,255,0.16)" }}>
      <Img src={staticFile("proscore/states/home.jpg")} style={{ width: "100%" }} />
    </div>
  </AbsoluteFill>
);

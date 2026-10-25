import { AbsoluteFill, Img, staticFile } from "remotion";
import "./brand/fonts";
import { colors, fontFamily } from "./brand/tokens";
import { Background } from "./components/Background";

// Capa estática para YouTube/LinkedIn: promessa, marca e o produto real ao lado.
export const Thumbnail: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <div style={{ position: "absolute", left: 120, top: 0, bottom: 0, width: 800, display: "flex", flexDirection: "column", justifyContent: "center" }}>
      <Img src={staticFile("strato-logo.png")} style={{ width: 380 }} />
      <div style={{ marginTop: 64, color: colors.white, fontSize: 80, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.03em" }}>
        Uma plataforma.
        <br />
        <span style={{ color: colors.accent }}>
          A operação inteira
          <br />à vista.
        </span>
      </div>
      <div style={{ marginTop: 40, color: colors.textSoft, fontSize: 24, fontWeight: 600, letterSpacing: "0.2em", whiteSpace: "nowrap" }}>
        FACTORING · FIDC · SECURITIZADORA
      </div>
    </div>
    <div
      style={{
        position: "absolute",
        left: 960,
        top: 170,
        width: 1200,
        height: 750,
        borderRadius: 28,
        overflow: "hidden",
        boxShadow: "0 50px 140px rgba(2,6,23,0.7), 0 0 0 1px rgba(255,255,255,0.16)",
        rotate: "-4deg",
      }}
    >
      <Img src={staticFile("screens/visao-geral.jpg")} style={{ width: "100%", height: "100%" }} />
    </div>
  </AbsoluteFill>
);

import { AbsoluteFill, Img, staticFile } from "remotion";
import "./brand/fonts";
import { colors, fontFamily } from "./brand/tokens";
import { Background } from "./components/Background";

// Post de LinkedIn (1200×1200): anúncio "em breve" do STRATO com a tela real da visão geral.
export const LinkedInComingSoon: React.FC = () => (
  <AbsoluteFill style={{ fontFamily }}>
    <Background />
    <div style={{ position: "absolute", left: 90, top: 96, right: 90 }}>
      <Img src={staticFile("strato-logo.png")} style={{ width: 300, display: "block" }} />
      <div style={{ marginTop: 64, display: "inline-flex", alignItems: "center", gap: 14, padding: "10px 24px", borderRadius: 999, border: `1.5px solid ${colors.accent}`, background: "rgba(59,107,255,0.14)", color: colors.accent, fontSize: 26, fontWeight: 700, letterSpacing: "0.2em" }}>
        <span style={{ width: 12, height: 12, borderRadius: "50%", background: colors.decide, boxShadow: `0 0 14px ${colors.decide}` }} />
        EM BREVE
      </div>
      <div style={{ marginTop: 34, color: colors.white, fontSize: 92, fontWeight: 800, lineHeight: 1.02, letterSpacing: "-0.035em" }}>
        Veja o todo.
        <br />
        <span style={{ color: colors.accent }}>Decida com precisão.</span>
      </div>
      <div style={{ marginTop: 30, color: colors.textSoft, fontSize: 32, fontWeight: 500, lineHeight: 1.35, maxWidth: 820 }}>
        Uma plataforma. A operação inteira à vista.
      </div>
      <div style={{ marginTop: 34, color: colors.white, fontSize: 22, fontWeight: 700, letterSpacing: "0.18em" }}>FACTORING · FIDC · SECURITIZADORA</div>
    </div>
    <div style={{ position: "absolute", left: 430, top: 760, width: 1000, height: 625, borderRadius: 26, overflow: "hidden", rotate: "-5deg", boxShadow: "0 50px 140px rgba(2,6,23,0.75), 0 0 0 1px rgba(255,255,255,0.18)" }}>
      <Img src={staticFile("proscore/states/home.jpg")} style={{ width: "100%" }} />
    </div>
  </AbsoluteFill>
);

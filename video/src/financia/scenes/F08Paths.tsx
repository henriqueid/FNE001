import { AbsoluteFill, interpolate, spring } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Beam, Particles, usePop } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const GREEN = "#34D399";

// Cena 8: bifurcação — sócio-investidor ou cliente piloto sem custo, para sempre.
export const F08Paths: React.FC = () => {
  const { frame, at, fps } = useNarration("f08");
  const pop = usePop();
  const stamp = spring({ frame: frame - at(5), fps, config: { damping: 9, stiffness: 160 } });
  const focusA = interpolate(frame, [at(1), at(1) + 12], [0, 1], clamp) * interpolate(frame, [at(3) - 6, at(3) + 6], [1, 0], clamp);
  const focusB = interpolate(frame, [at(3), at(3) + 12], [0, 1], clamp) * interpolate(frame, [at(6), at(6) + 12], [1, 0], clamp);
  const card = (focus: number, color: string): React.CSSProperties => ({
    position: "absolute",
    top: 360,
    width: 700,
    minHeight: 420,
    padding: "34px 40px",
    borderRadius: 28,
    background: "linear-gradient(180deg, rgba(20,36,92,0.96), rgba(9,20,56,0.96))",
    border: `2px solid ${focus > 0.5 ? color : "rgba(255,255,255,0.14)"}`,
    boxShadow: focus > 0.5 ? `0 0 70px ${color}55` : "0 30px 80px rgba(2,6,23,0.5)",
    scale: String(1 + focus * 0.04),
  });
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={26} seed="f08" />
      <SceneLabel index={8} title="Dois caminhos" />
      <Badge kind="offer" from={at(0)} />
      <div style={{ position: "absolute", left: 960, top: 190, transform: "translate(-50%, -50%)", padding: "16px 36px", borderRadius: 999, background: "rgba(4,10,28,0.9)", border: `2px solid ${colors.accent}`, color: colors.white, fontSize: 34, fontWeight: 700, ...pop(at(0)) }}>
        Ao final da jornada
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        <Beam x1={960} y1={225} x2={560} y2={355} at={at(0) + 20} color={colors.accent} />
        <Beam x1={960} y1={225} x2={1360} y2={355} at={at(0) + 26} color={GREEN} />
      </svg>
      <div style={{ ...card(focusA, colors.accent), left: 210, ...pop(at(1) - 4, { dx: -80, dy: 0 }) }}>
        <div style={{ color: colors.accent, fontSize: 22, fontWeight: 800, letterSpacing: "0.14em" }}>CAMINHO A</div>
        <div style={{ color: colors.white, fontSize: 52, fontWeight: 800, marginTop: 8 }}>Sócio-investidor</div>
        <div style={{ color: colors.textSoft, fontSize: 28, marginTop: 18, lineHeight: 1.35 }}>Investir e participar do negócio que ajudou a construir.</div>
        <div style={{ marginTop: 34, padding: "16px 22px", borderRadius: 16, background: "rgba(122,167,255,0.1)", border: `1px dashed ${colors.accent}88`, color: colors.white, fontSize: 25, fontWeight: 600, ...pop(at(2)) }}>
          Participação e valores: conversa em um segundo momento
        </div>
      </div>
      <div style={{ ...card(focusB, GREEN), right: 210, ...pop(at(3) - 4, { dx: 80, dy: 0 }) }}>
        <div style={{ color: GREEN, fontSize: 22, fontWeight: 800, letterSpacing: "0.14em" }}>CAMINHO B</div>
        <div style={{ color: colors.white, fontSize: 52, fontWeight: 800, marginTop: 8 }}>Cliente piloto</div>
        <div style={{ color: colors.textSoft, fontSize: 28, marginTop: 18, lineHeight: 1.35, ...pop(at(4)) }}>Isenção de qualquer custo de uso do STRATO, por todo o tempo.</div>
        <div
          style={{
            marginTop: 30,
            display: "inline-block",
            padding: "14px 30px",
            borderRadius: 16,
            border: `4px solid ${GREEN}`,
            color: GREEN,
            fontSize: 44,
            fontWeight: 900,
            whiteSpace: "nowrap",
            letterSpacing: "0.04em",
            textTransform: "uppercase",
            rotate: "-4deg",
            opacity: interpolate(stamp, [0, 0.3], [0, 1], clamp),
            scale: String(interpolate(stamp, [0, 1], [2.4, 1])),
            boxShadow: `0 0 ${30 * stamp}px ${GREEN}66`,
          }}
        >
          Sem custo. Para sempre.
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 880, textAlign: "center", color: colors.white, fontSize: 34, fontWeight: 700, ...pop(at(6)) }}>
        A decisão vem <span style={{ color: colors.accent }}>depois de ver o sistema funcionando</span> na própria operação.
      </div>
    </AbsoluteFill>
  );
};

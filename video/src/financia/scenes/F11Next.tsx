import { AbsoluteFill, Img, interpolate, spring, staticFile } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { LiveScreen } from "../../proscore/components/LiveScreen";
import { Particles, usePop } from "../../proscore/components/motion";
import { SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const NEXT = ["Escopo da primeira fase", "Pessoas envolvidas", "Critérios de sucesso"];

// Cena 11: o próximo passo; o dashboard real se afasta e a assinatura STRATO × Financia entra.
export const F11Next: React.FC = () => {
  const { frame, at, fps } = useNarration("f11");
  const pop = usePop();
  const out = interpolate(frame, [at(2) - 10, at(2) + 30], [1, 0], { ...clamp, easing: ease.inOut });
  const ring = spring({ frame: frame - at(2) - 10, fps, config: { damping: 20 } });
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={40} seed="f11" />
      <SceneLabel index={11} title="Próximo passo" />
      <AbsoluteFill style={{ opacity: out * 0.9, scale: String(0.75 + out * 0.25) }}>
        <LiveScreen
          shots={[{ at: 0, state: "home" }]}
          view={{ x: 160, y: 96, w: 1600, h: 600 }}
          camera={[
            { at: 0, rect: [0, 280, 1250, 470] },
            { at: 20, rect: [0, 0, 1600, 600], dur: 6 },
          ]}
          tilt={0}
        />
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 740, display: "flex", justifyContent: "center", gap: 24, opacity: out }}>
        {NEXT.map((n, i) => (
          <div key={n} style={{ padding: "18px 30px", borderRadius: 18, background: "rgba(4,10,28,0.92)", border: `1.5px solid ${colors.accent}`, color: colors.white, fontSize: 32, fontWeight: 700, ...pop(at(1) + 6 + i * 14) }}>
            <span style={{ color: colors.accent, marginRight: 12 }}>{i + 1}</span>
            {n}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 860, textAlign: "center", color: colors.textSoft, fontSize: 30, fontWeight: 600, ...pop(at(0) + 20), opacity: out * pop(at(0) + 20).opacity }}>
        Próximo passo: <span style={{ color: colors.white }}>uma conversa</span>
      </div>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", textAlign: "center" }}>
        <div style={{ position: "absolute", width: 900, height: 900, borderRadius: "50%", border: `2px solid ${colors.accent}`, opacity: frame > at(2) ? (1 - ring) * 0.6 : 0, scale: String(0.2 + ring * 1.4) }} />
        <div style={{ display: "flex", alignItems: "center", gap: 40, ...pop(at(2) + 20, { from: 0.6 }) }}>
          <Img src={staticFile("strato-logo.png")} style={{ width: 430 }} />
          <span style={{ fontSize: 60, color: colors.textFaint, fontWeight: 300 }}>×</span>
          <span style={{ fontSize: 84, fontWeight: 800, color: colors.white, letterSpacing: "-0.02em" }}>Financia</span>
        </div>
        <div style={{ marginTop: 44, fontSize: 44, color: colors.white, fontWeight: 700, ...pop(at(2) + 40) }}>
          Construindo com quem opera.
        </div>
        <div style={{ marginTop: 22, fontSize: 28, color: colors.accent, fontWeight: 600, letterSpacing: "0.04em", ...pop(at(2) + 60) }}>Veja o todo. Decida com precisão.</div>
        <div style={{ marginTop: 60, fontSize: 21, color: colors.textFaint, fontStyle: "italic", ...pop(at(2) + 80) }}>
          Proposta de parceria — condições finais sujeitas a acordo entre as partes.
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

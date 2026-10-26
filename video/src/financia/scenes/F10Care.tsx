import { AbsoluteFill } from "remotion";
import { colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { LiveScreen, target } from "../../proscore/components/LiveScreen";
import { Particles, usePop } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const SEALS = [
  { t: "Acordo de confidencialidade", i: "🔒", s: 1 },
  { t: "Dados protegidos e restritos", i: "🛡", s: 1 },
  { t: "Trilha de auditoria completa", i: "≡", s: 2 },
  { t: "Nada com efeito real sem aprovação da equipe", i: "✓", s: 2 },
];

// Cena 10: cuidado com a operação — a trilha de auditoria real ao fundo e os compromissos ao lado.
export const F10Care: React.FC = () => {
  const { at } = useNarration("f10");
  const pop = usePop();
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={18} seed="f10" />
      <SceneLabel index={10} title="Cuidado com a operação" />
      <Badge kind="real" from={10} />
      <LiveScreen
        view={{ x: 90, y: 140, w: 1000, h: 800 }}
        shots={[{ at: 0, state: "mod-auditoria" }]}
        camera={[
          { at: 0, rect: [0, 40, 800, 640] },
          { at: 30, rect: [0, 900, 800, 640], dur: 6 },
          { at: at(2), rect: [0, 60, 760, 608], dur: 1.4 },
        ]}
        marks={[{ at: at(2) + 30, rect: target("mod-auditoria.trilha", 6) }]}
        tilt={-8}
      />
      <div style={{ position: "absolute", left: 1150, top: 200, width: 680, display: "flex", flexDirection: "column", gap: 22 }}>
        {SEALS.map((s, i) => (
          <div
            key={s.t}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 22,
              padding: "24px 28px",
              borderRadius: 22,
              background: "linear-gradient(180deg, rgba(20,36,92,0.96), rgba(9,20,56,0.96))",
              border: `1.5px solid ${colors.decide}77`,
              color: colors.white,
              fontSize: 30,
              fontWeight: 700,
              lineHeight: 1.2,
              ...pop(at(s.s) + 6 + (i % 2) * 18, { dx: 80, dy: 0 }),
            }}
          >
            <span style={{ width: 62, height: 62, flex: "none", borderRadius: 16, display: "grid", placeItems: "center", background: "rgba(52,211,153,0.15)", color: colors.decide, fontSize: 32 }}>{s.i}</span>
            {s.t}
          </div>
        ))}
      </div>
    </AbsoluteFill>
  );
};

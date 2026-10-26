import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ImpactMoment, Particles, usePop } from "../components/motion";
import { Badge, SceneLabel } from "../components/ui";
import states from "../data/states.json";

const WALL = ["home", "mod-operacoes", "mod-carteira", "op-motor", "mod-financeiro", "cfg-politicas", "mod-cadastros", "mod-auditoria", "mod-comercial"] as const;
const WORDS = ["Simplicidade", "Automação", "Inteligência"];

// Cena 12: parede 3D de telas reais rolando sozinhas; os três conceitos atravessam a cena.
export const Scene12Positioning: React.FC = () => {
  const { frame, at } = useNarration("s12");
  const pop = usePop();
  const dim = interpolate(frame, [at(2), at(3)], [1, 0.22], clamp);
  const W = 560;
  const H = 350;
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={24} seed="s12" />
      <SceneLabel index={12} title="Posicionamento" />
      <Badge kind="real" from={10} />
      <AbsoluteFill style={{ perspective: 1800, opacity: dim }}>
        <div
          style={{
            position: "absolute",
            left: 960 - (3 * W + 2 * 36) / 2,
            top: 540 - (3 * H + 2 * 36) / 2 + 10,
            width: 3 * W + 2 * 36,
            display: "grid",
            gridTemplateColumns: `repeat(3, ${W}px)`,
            gap: 36,
            transform: `rotateX(${14 - frame * 0.006}deg) rotateY(${-16 + frame * 0.012}deg) rotateZ(2deg) translateZ(${-120 + frame * 0.08}px)`,
            transformStyle: "preserve-3d",
          }}
        >
          {WALL.map((id, i) => {
            const m = (states as Record<string, { src: string; height: number }>)[id];
            const travel = Math.max(0, m.height * (W / 1600) - H);
            const speed = 0.25 + (i % 3) * 0.12;
            const y = travel ? (Math.sin(frame / (140 + i * 15) * speed * 3 + i) * 0.5 + 0.5) * travel : 0;
            return (
              <div key={id} style={{ width: W, height: H, borderRadius: 18, overflow: "hidden", background: colors.surface, boxShadow: "0 30px 80px rgba(2,6,23,0.6), 0 0 0 1px rgba(255,255,255,0.15)", ...pop(at(0) + i * 6, { dy: 80 }) }}>
                <Img src={staticFile(m.src)} style={{ width: W, translate: `0px ${-y}px` }} />
              </div>
            );
          })}
        </div>
      </AbsoluteFill>
      <div style={{ position: "absolute", left: 0, right: 0, top: 380, display: "flex", justifyContent: "center", gap: 80 }}>
        {WORDS.map((w, i) => (
          <div key={w} style={{ fontSize: 96, fontWeight: 800, letterSpacing: "-0.03em", color: i === 1 ? colors.accent : colors.white, textShadow: "0 8px 40px rgba(2,6,23,0.9)", ...pop(at(3) + i * 14, { dy: 70 }) }}>
            {w}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 540, textAlign: "center", fontSize: 36, color: colors.white, textShadow: "0 4px 24px rgba(2,6,23,0.95)", ...pop(at(5)) }}>
        Competir pela capacidade de fazer a operação trabalhar melhor.
      </div>
      <ImpactMoment at={at(6) + 60} lines={["Tecnologia robusta.", "Operação descomplicada."]} />
    </AbsoluteFill>
  );
};

import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Particles, usePop } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const GREEN = "#34D399";
const STRATO = [
  { t: "Sistema adaptado à operação", s: 0 },
  { t: "Implantação, treinamento e suporte", s: 0 },
  { t: "Licença gratuita na homologação", s: 1 },
  { t: "Prioridade nas melhorias pedidas", s: 1 },
];
const FINANCIA = [
  { t: "Ambiente e equipe operacional", s: 2 },
  { t: "Casos reais para validação", s: 2 },
  { t: "Feedback estruturado", s: 2 },
  { t: "Depois de validado: referência e apoio comercial", s: 3 },
];

// Cena 9: o que cada lado oferece, em dois cartões que se encontram no centro.
export const F09Exchange: React.FC = () => {
  const { frame, at } = useNarration("f09");
  const pop = usePop();
  const swap = ((frame % 90) / 90) * 2 - 1;
  const Col: React.FC<{ title: React.ReactNode; items: typeof STRATO; color: string; side: "l" | "r" }> = ({ title, items, color, side }) => (
    <div
      style={{
        position: "absolute",
        top: 300,
        [side === "l" ? "left" : "right"]: 150,
        width: 720,
        padding: "34px 38px",
        borderRadius: 28,
        background: "linear-gradient(180deg, rgba(20,36,92,0.96), rgba(9,20,56,0.96))",
        border: `2px solid ${color}`,
        boxShadow: `0 0 50px ${color}33`,
        ...pop(at(side === "l" ? 0 : 2) - 6, { dx: side === "l" ? -100 : 100, dy: 0 }),
      }}
    >
      <div style={{ height: 70, display: "flex", alignItems: "center" }}>{title}</div>
      <div style={{ marginTop: 24, display: "flex", flexDirection: "column", gap: 24 }}>
        {items.map((it, j) => (
          <div key={it.t} style={{ display: "flex", gap: 14, alignItems: "flex-start", color: colors.white, fontSize: 34, fontWeight: 600, lineHeight: 1.25, ...pop(at(it.s) + 14 + (j % 2) * 16, { dy: 20 }) }}>
            <span style={{ color, fontSize: 28 }}>✓</span>
            {it.t}
          </div>
        ))}
      </div>
    </div>
  );
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={24} seed="f09" />
      <SceneLabel index={9} title="O que cada lado oferece" />
      <Badge kind="offer" from={10} />
      <Col title={<Img src={staticFile("strato-logo.png")} style={{ height: 56 }} />} items={STRATO} color={colors.accent} side="l" />
      <Col title={<span style={{ color: colors.white, fontSize: 52, fontWeight: 800 }}>Financia</span>} items={FINANCIA} color={GREEN} side="r" />
      <div style={{ position: "absolute", left: 960, top: 560, transform: "translate(-50%, -50%)", width: 120, height: 120, borderRadius: "50%", display: "grid", placeItems: "center", background: "rgba(4,10,28,0.95)", border: `2px solid ${colors.accent}`, color: colors.white, fontSize: 50, opacity: interpolate(frame, [at(2) + 10, at(2) + 24], [0, 1], clamp) }}>
        <span style={{ translate: `${swap * 6}px 0px` }}>⇄</span>
      </div>
    </AbsoluteFill>
  );
};

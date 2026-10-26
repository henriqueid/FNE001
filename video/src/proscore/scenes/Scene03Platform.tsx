import { AbsoluteFill, Img, interpolate, staticFile } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { appear, Dot, SceneLabel } from "../components/ui";

type Stage = { label: string; img?: string; state: "existente" | "parcial" | "planejada" };
const STATE = {
  existente: { color: "#34D399", label: "Existente" },
  parcial: { color: "#F59E0B", label: "Parcial" },
  planejada: { color: "#7AA7FF", label: "Planejada" },
};
// Estado verificado no sistema (relatório de evidências).
const STAGES: Stage[] = [
  { label: "Cadastro", img: "screens/cadastros.jpg", state: "existente" },
  { label: "Crédito", img: "screens/operacao-risco.jpg", state: "existente" },
  { label: "Operação", img: "screens/operacoes.jpg", state: "existente" },
  { label: "Análise", img: "proscore/screens/motor-resultado.jpg", state: "existente" },
  { label: "Aprovação", img: "screens/operacao-etapas.jpg", state: "existente" },
  { label: "Formalização", img: "screens/controladoria.jpg", state: "parcial" },
  { label: "Carteira", img: "screens/carteira.jpg", state: "existente" },
  { label: "Cobrança", img: "proscore/screens/carteira-cedente.jpg", state: "parcial" },
  { label: "Encerramento", state: "planejada" },
];
const SUPPORT: Stage[] = [
  { label: "Conciliação", img: "screens/financeiro.jpg", state: "existente" },
  { label: "Recompra", img: "proscore/screens/auditoria.jpg", state: "existente" },
];

const W = 186;
const GAP = 20;
const X0 = (1920 - (STAGES.length * W + (STAGES.length - 1) * GAP)) / 2;

const StageCard: React.FC<{ s: Stage; x: number; y: number; show: number }> = ({ s, x, y, show }) => (
  <div style={{ position: "absolute", left: x, top: y, width: W, opacity: show, translate: `0px ${(1 - show) * 20}px` }}>
    <div
      style={{
        width: W,
        height: 116,
        borderRadius: 14,
        overflow: "hidden",
        border: `2px ${s.state === "planejada" ? "dashed" : "solid"} ${STATE[s.state].color}88`,
        background: s.img ? colors.surface : "rgba(122,167,255,0.08)",
        display: "grid",
        placeItems: "center",
        color: colors.accent,
        fontSize: 18,
        fontWeight: 600,
      }}
    >
      {s.img ? <Img src={staticFile(s.img)} style={{ width: "100%", height: "100%", objectFit: "cover", objectPosition: "top left" }} /> : "Visão de evolução"}
    </div>
    <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, color: colors.white, fontSize: 22, fontWeight: 700 }}>
      <Dot color={STATE[s.state].color} />
      {s.label}
    </div>
  </div>
);

// Cena 03: o ciclo completo da operação, com o estado real de cada etapa.
export const Scene03Platform: React.FC = () => {
  const { frame, at } = useNarration("s03");
  const reveal = (i: number) => {
    const start = i < 6 ? at(1) + i * 22 : at(2) + (i - 6) * 26;
    return interpolate(frame, [start, start + 14], [0, 1], clamp);
  };
  const y = 290;
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={3} title="A plataforma" />
      <div style={{ position: "absolute", top: 150, left: 0, right: 0, textAlign: "center", color: colors.white, fontSize: 46, fontWeight: 700, ...appear(frame, at(0)) }}>
        O ciclo completo de uma operação de recebíveis
      </div>
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {STAGES.slice(0, -1).map((_, i) => (
          <line
            key={i}
            x1={X0 + i * (W + GAP) + W}
            y1={y + 58}
            x2={X0 + i * (W + GAP) + W + GAP}
            y2={y + 58}
            stroke={colors.accent}
            strokeWidth={3}
            opacity={reveal(i + 1)}
          />
        ))}
      </svg>
      {STAGES.map((s, i) => (
        <StageCard key={s.label} s={s} x={X0 + i * (W + GAP)} y={y} show={reveal(i)} />
      ))}
      {SUPPORT.map((s, i) => (
        <StageCard key={s.label} s={s} x={X0 + (6 + i) * (W + GAP) + (W + GAP) / 2} y={y + 210} show={interpolate(frame, [at(2) + 30 + i * 20, at(2) + 44 + i * 20], [0, 1], clamp)} />
      ))}
      <div
        style={{
          position: "absolute",
          left: X0,
          right: X0,
          top: 730,
          padding: "20px 28px",
          borderRadius: 18,
          background: "rgba(11,29,79,0.7)",
          border: `1px solid ${colors.captionBorder}`,
          display: "flex",
          justifyContent: "space-between",
          color: colors.white,
          fontSize: 25,
          fontWeight: 600,
          ...appear(frame, at(3)),
        }}
      >
        <span>Registros históricos</span>
        <span style={{ color: colors.textFaint }}>·</span>
        <span>Regras de negócio versionadas</span>
        <span style={{ color: colors.textFaint }}>·</span>
        <span>Alçadas</span>
        <span style={{ color: colors.textFaint }}>·</span>
        <span>Trilha de auditoria</span>
      </div>
      <div style={{ position: "absolute", left: X0, top: 836, display: "flex", gap: 34, color: colors.textSoft, fontSize: 20, ...appear(frame, at(1) + 40) }}>
        {Object.values(STATE).map(s => (
          <span key={s.label} style={{ display: "flex", alignItems: "center", gap: 8 }}>
            <Dot color={s.color} size={9} /> {s.label}
          </span>
        ))}
        <span style={{ color: colors.textFaint }}>Estado verificado no sistema em 26/10/2026</span>
      </div>
    </AbsoluteFill>
  );
};

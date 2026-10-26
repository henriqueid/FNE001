import { AbsoluteFill } from "remotion";
import { colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ImpactMoment, Particles, usePop } from "../components/motion";
import { Badge, SceneLabel, Tile } from "../components/ui";

const PURPLE = "#C084FC";
// Caso totalmente sintético: nenhum dado real de cliente.
const STEPS: { title: string; detail: string; color: string; sentence: number; proposal?: boolean }[] = [
  { title: "Operação recebida", detail: "Securitizadora · 48 recebíveis (sintético)", color: colors.accent, sentence: 1 },
  { title: "Elegibilidade e exposição", detail: "45 títulos seguem o fluxo autorizado", color: "#34D399", sentence: 2 },
  { title: "Regra pede análise", detail: "Sacado novo acima do limite configurado", color: "#F59E0B", sentence: 3 },
  { title: "Consulta externa", detail: "proScore · integração proposta, com autorização", color: PURPLE, sentence: 4, proposal: true },
  { title: "Histórico interno", detail: "Score interno recebe o novo elemento conforme a metodologia", color: colors.accent, sentence: 5 },
  { title: "Copiloto organiza", detail: "Pontos de atenção e recomendação com fontes", color: colors.accent, sentence: 6 },
  { title: "Analista decide", detail: "Com contexto, dentro da alçada", color: "#34D399", sentence: 7 },
  { title: "Decisão registrada", detail: "Trilha com origem, versão da política e responsável", color: "#34D399", sentence: 8 },
];

// Cena 11: caso de uso sintético de ponta a ponta.
export const Scene11UseCase: React.FC = () => {
  const { frame, at } = useNarration("s11");
  const pop = usePop();
  const W = 395;
  const G = 32;
  const X0 = (1920 - (4 * W + 3 * G)) / 2;
  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={11} title="Uma operação inteligente" />
      <Particles count={24} seed="s11" />
      <Badge kind="simulation" from={10} />
      {STEPS.map((s, i) => {
        const row = Math.floor(i / 4);
        const col = row === 0 ? i % 4 : 3 - (i % 4);
        const start = s.sentence === 8 ? at(7) + 90 : at(s.sentence);
        return (
          <Tile
            key={s.title}
            accent={s.color}
            style={{
              position: "absolute",
              left: X0 + col * (W + G),
              top: 200 + row * 300,
              width: W,
              height: 200,
              boxSizing: "border-box",
              borderStyle: s.proposal ? "dashed" : "solid",
              ...pop(start, { dy: 50 }),
              boxShadow: frame >= start && frame < start + 45 ? `0 0 0 3px ${s.color}88, 0 0 50px ${s.color}44` : undefined,
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ width: 38, height: 38, borderRadius: "50%", display: "grid", placeItems: "center", background: `${s.color}33`, color: s.color, fontWeight: 800, fontSize: 20 }}>
                {i + 1}
              </span>
              <span style={{ fontSize: 27, fontWeight: 700 }}>{s.title}</span>
            </div>
            <div style={{ fontSize: 21, color: colors.textSoft, marginTop: 14, lineHeight: 1.35 }}>{s.detail}</div>
          </Tile>
        );
      })}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        {STEPS.slice(0, -1).map((s, i) => {
          const next = STEPS[i + 1];
          const show = frame >= (next.sentence === 8 ? at(7) + 90 : at(next.sentence)) ? 1 : 0;
          const row = Math.floor(i / 4);
          const col = row === 0 ? i % 4 : 3 - (i % 4);
          const x = X0 + col * (W + G);
          if (i === 3) return <line key={i} x1={x + W / 2} y1={400} x2={x + W / 2} y2={500} stroke={colors.accent} strokeWidth={3} opacity={show} />;
          return row === 0 ? (
            <line key={i} x1={x + W} y1={300} x2={x + W + G} y2={300} stroke={colors.accent} strokeWidth={3} opacity={show} />
          ) : (
            <line key={i} x1={x} y1={600} x2={x - G} y2={600} stroke={colors.accent} strokeWidth={3} opacity={show} />
          );
        })}
      </svg>
      <ImpactMoment at={at(8) + 20} lines={["Uma operação.", "Diferentes inteligências. Um único fluxo."]} />
    </AbsoluteFill>
  );
};

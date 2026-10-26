import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { ImpactMoment, Particles, usePop } from "../../proscore/components/motion";
import { SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const STEPS = ["Cadastro", "Análise", "Lastro", "Formalização", "Liberação", "Carteira", "Cobrança", "Conciliação"];
const PAINS = [
  { t: "Sistemas que não conversam", x: 250, y: 560 },
  { t: "Planilhas paralelas", x: 790, y: 610 },
  { t: "Conferência manual", x: 1290, y: 560 },
];

// Cena 2: a rotina de quem opera FIDC e securitização, quebrada em ferramentas soltas.
export const F02Problem: React.FC = () => {
  const { frame, at } = useNarration("f02");
  const pop = usePop();
  const W = 196;
  const GAP = 20;
  const X0 = (1920 - (STEPS.length * W + (STEPS.length - 1) * GAP)) / 2;
  const broken = interpolate(frame, [at(2), at(2) + 30], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={20} seed="f02" color="#FCA5A5" />
      <SceneLabel index={2} title="O problema" />
      <div style={{ position: "absolute", top: 170, left: 0, right: 0, textAlign: "center", color: colors.white, fontSize: 48, fontWeight: 700, ...pop(at(0)) }}>
        O dia a dia de quem opera <span style={{ color: colors.accent }}>FIDC e securitização</span>
      </div>
      {STEPS.map((s, i) => {
        const shake = broken * Math.sin(frame / 3 + i * 2.1) * 5;
        const gapOpen = broken * (i % 2 ? 14 : -14);
        return (
          <div
            key={s}
            style={{
              position: "absolute",
              left: X0 + i * (W + GAP),
              top: 340 + gapOpen + shake,
              width: W,
              padding: "20px 0",
              borderRadius: 16,
              textAlign: "center",
              background: "rgba(11,29,79,0.9)",
              border: `1.5px solid ${broken > 0.5 ? "rgba(248,113,113,0.55)" : `${colors.accent}77`}`,
              color: colors.white,
              fontSize: 25,
              fontWeight: 700,
              rotate: `${broken * (i % 2 ? 2.5 : -2.5)}deg`,
              ...pop(at(1) + i * 7, { dy: 30 }),
            }}
          >
            {s}
          </div>
        );
      })}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0 }}>
        {STEPS.slice(0, -1).map((_, i) => {
          const x = X0 + i * (W + GAP) + W;
          const show = interpolate(frame, [at(1) + i * 7 + 8, at(1) + i * 7 + 18], [0, 1], clamp);
          return <line key={i} x1={x} y1={378} x2={x + GAP} y2={378} stroke={broken > 0.5 ? colors.alert : colors.accent} strokeWidth={3} strokeDasharray={broken > 0.5 ? "4 6" : undefined} opacity={show * (1 - broken * 0.5)} />;
        })}
      </svg>
      {PAINS.map((p, i) => (
        <div
          key={p.t}
          style={{
            position: "absolute",
            left: p.x,
            top: p.y,
            width: 400,
            padding: "22px 26px",
            borderRadius: 18,
            background: "rgba(69,10,10,0.55)",
            border: "1.5px solid rgba(248,113,113,0.6)",
            color: "#FECACA",
            fontSize: 32,
            fontWeight: 700,
            textAlign: "center",
            ...pop(at(2) + 10 + i * 16, { dy: 40 }),
          }}
        >
          ✕ {p.t}
        </div>
      ))}
      <div
        style={{
          position: "absolute",
          left: 0,
          right: 0,
          top: 800,
          display: "flex",
          justifyContent: "center",
          gap: 60,
          color: colors.textSoft,
          fontSize: 30,
          fontWeight: 600,
          opacity: interpolate(frame, [at(3), at(3) + 16], [0, 1], { ...clamp, easing: ease.out }),
        }}
      >
        <span>⏱ Tempo em tarefa repetitiva</span>
        <span>◐ Decisão sem a visão completa da carteira</span>
      </div>
      <ImpactMoment at={at(3) + 75} lines={["Muito esforço.", "Pouca visão."]} />
    </AbsoluteFill>
  );
};

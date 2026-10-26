import { AbsoluteFill, interpolate, spring } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { Beam, ImpactMoment, Particles, usePop } from "../../proscore/components/motion";
import { SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const PILLARS = [
  { t: "Expertise", d: "quem conhece a operação por dentro", s: 4, icon: "◆" },
  { t: "Referência de mercado", d: "o que vocês já são", s: 5, icon: "★" },
  { t: "Estratégia comercial", d: "levar o produto a outras estruturas", s: 6, icon: "➚" },
];
// Posições dos nós da rede de parceiros (sem nomes) nas laterais do título.
const NET: [number, number][] = [[300, 170], [470, 300], [620, 160], [1300, 160], [1450, 300], [1620, 170]];
const TRAITS = ["Já estivemos na operação", "Equipe experiente", "Pode agregar muito ao produto"];

// Cena 6: por que a Financia — parceira estratégica, três motivos e uma rede que faz sentido.
export const F06Financia: React.FC = () => {
  const { frame, at, fps } = useNarration("f06");
  const pop = usePop();
  const name = spring({ frame: frame - at(0) - 6, fps, config: { damping: 12, stiffness: 100 } });
  const up = interpolate(frame, [at(3) - 10, at(3) + 20], [0, 1], clamp);
  const net = interpolate(frame, [at(7), at(7) + 20], [0, 1], clamp);
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={34} seed="f06" />
      <SceneLabel index={6} title="Por que a Financia" />
      <div style={{ position: "absolute", left: 0, right: 0, top: interpolate(up, [0, 1], [330, 150]), textAlign: "center" }}>
        <div style={{ fontSize: interpolate(up, [0, 1], [150, 92]), fontWeight: 800, letterSpacing: "-0.03em", color: colors.white, opacity: name, scale: String(0.7 + name * 0.3), textShadow: `0 0 60px ${colors.accentStrong}88` }}>
          Financia
        </div>
        <div style={{ display: "inline-block", marginTop: 10, padding: "10px 26px", borderRadius: 999, background: colors.accentStrong, color: colors.white, fontSize: 30, fontWeight: 700, ...pop(at(1), { from: 0.5 }) }}>
          Parceira estratégica
        </div>
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 640, display: "flex", justifyContent: "center", gap: 22, opacity: 1 - up }}>
        {TRAITS.map((t, i) => (
          <div key={t} style={{ padding: "16px 28px", borderRadius: 16, background: "rgba(52,211,153,0.12)", border: "1.5px solid #34D39988", color: colors.white, fontSize: 30, fontWeight: 700, ...pop(at(2) + 10 + i * 18) }}>
            ✓ {t}
          </div>
        ))}
      </div>
      <div style={{ position: "absolute", left: 0, right: 0, top: 410, display: "flex", justifyContent: "center", gap: 36, opacity: up }}>
        {PILLARS.map((p, i) => {
          const lit = interpolate(frame, [at(p.s), at(p.s) + 12], [0, 1], clamp);
          return (
            <div
              key={p.t}
              style={{
                width: 440,
                height: 300,
                borderRadius: 26,
                padding: "34px 30px",
                textAlign: "center",
                background: `linear-gradient(180deg, rgba(59,107,255,${0.12 + lit * 0.25}), rgba(9,20,56,0.95))`,
                border: `2px solid ${lit > 0.5 ? colors.accent : "rgba(255,255,255,0.12)"}`,
                boxShadow: lit > 0.5 ? `0 0 50px ${colors.accentStrong}66` : "none",
                ...pop(at(3) + 6 + i * 10, { dy: 80 }),
              }}
            >
              <div style={{ fontSize: 64, color: colors.accent, scale: String(1 + 0.15 * lit * Math.max(0, Math.sin((frame - at(p.s)) / 6))) }}>{p.icon}</div>
              <div style={{ fontSize: 38, fontWeight: 800, color: colors.white, marginTop: 14 }}>{p.t}</div>
              <div style={{ fontSize: 24, color: colors.textSoft, marginTop: 10 }}>{p.d}</div>
            </div>
          );
        })}
      </div>
      {/* Rede de parceiros da Financia: nós genéricos, sem nomes, ao redor do nome e acima dos pilares. */}
      <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, opacity: net }}>
        {NET.map(([x, y], i) => {
          const from = x < 960 ? 760 : 1160;
          return (
            <g key={i}>
              <Beam x1={from} y1={215} x2={x} y2={y} at={at(7) + i * 5} color={colors.decide} period={70 + i * 9} />
              <circle cx={x} cy={y} r={15 + 4 * Math.sin(frame / 10 + i)} fill="rgba(52,211,153,0.25)" stroke={colors.decide} strokeWidth={2} />
            </g>
          );
        })}
      </svg>
      <div style={{ position: "absolute", left: 0, right: 0, top: 760, textAlign: "center", color: colors.white, fontSize: 34, fontWeight: 700, opacity: net, translate: `0px ${(1 - net) * 20}px` }}>
        <span style={{ color: colors.decide }}>●</span> Parceiros estratégicos que fazem sentido para o nosso ecossistema
      </div>
      <ImpactMoment at={at(8)} lines={["Nenhum ambiente de teste", "substitui isso."]} />
    </AbsoluteFill>
  );
};

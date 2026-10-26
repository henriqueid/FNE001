import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen } from "../components/LiveScreen";
import { ImpactMoment, Particles, usePop } from "../components/motion";
import { appear, Badge, SceneLabel, Tile } from "../components/ui";

const RULES = [
  "Política de crédito",
  "Limites por cedente",
  "Exposição por sacado",
  "Concentração",
  "Elegibilidade",
  "Alçadas de aprovação",
  "Condições de precificação",
];
const TRACE = ["Origem", "Justificativa", "Histórico", "Rastreabilidade"];

// Cena 05: o motor determinístico e suas regras; depois a tabela real de regras da política.
export const Scene05Engine: React.FC = () => {
  const { frame, at } = useNarration("s05");
  const realAt = at(3) + 40;
  const diagram = interpolate(frame, [realAt - 8, realAt + 10], [1, 0], clamp);
  const pulse = 0.5 + 0.5 * Math.sin(frame / 10);
  const pop = usePop();
  const orbit = frame / 90;

  return (
    <AbsoluteFill>
      <Background />
      <Particles count={26} seed="s05" />
      <SceneLabel index={5} title="O motor de decisão" />
      <AbsoluteFill style={{ opacity: diagram }}>
        <Badge kind="vision" from={10} />
        <div
          style={{
            position: "absolute",
            left: 760,
            top: 320,
            width: 400,
            height: 400,
            borderRadius: "50%",
            display: "grid",
            placeItems: "center",
            textAlign: "center",
            background: "radial-gradient(circle, rgba(59,107,255,0.35), rgba(11,29,79,0.9) 70%)",
            border: `2px solid ${colors.accentStrong}`,
            boxShadow: `0 0 ${60 + pulse * 30}px rgba(59,107,255,0.45)`,
            color: colors.white,
            ...appear(frame, at(0)),
          }}
        >
          <div>
            <div style={{ fontSize: 20, letterSpacing: "0.16em", color: colors.accent, fontWeight: 700 }}>MOTOR</div>
            <div style={{ fontSize: 40, fontWeight: 800, lineHeight: 1.1 }}>
              determinístico
            </div>
            <div style={{ fontSize: 19, color: colors.textSoft, marginTop: 8 }}>mesma entrada · mesma decisão</div>
          </div>
        </div>
        {RULES.map((r, i) => {
          const a = (i / RULES.length) * Math.PI * 2 + orbit * 0.25 - Math.PI / 2;
          const x = 960 + Math.cos(a) * 560;
          const y = 520 + Math.sin(a) * 300;
          return (
            <div key={r} style={{ position: "absolute", left: x, top: y, transform: "translate(-50%, -50%)" }}>
              <div style={{ ...pop(at(2) + i * 9) }}>
                <Tile style={{ fontSize: 26, fontWeight: 600, whiteSpace: "nowrap", boxShadow: `0 0 ${18 + 10 * Math.sin(frame / 9 + i)}px rgba(59,107,255,0.35)` }}>{r}</Tile>
              </div>
            </div>
          );
        })}
        <svg width={1920} height={1080} style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
          {RULES.map((r, i) => {
            const a = (i / RULES.length) * Math.PI * 2 + orbit * 0.25 - Math.PI / 2;
            const show = interpolate(frame, [at(2) + i * 9, at(2) + i * 9 + 12], [0, 1], clamp);
            const k = ((frame + i * 13) % 50) / 50;
            return (
              <g key={r} opacity={show}>
                <line x1={960} y1={520} x2={960 + Math.cos(a) * 470} y2={520 + Math.sin(a) * 250} stroke="rgba(122,167,255,0.25)" strokeWidth={2} />
                <circle cx={960 + Math.cos(a) * 470 * (1 - k)} cy={520 + Math.sin(a) * 250 * (1 - k)} r={5} fill={colors.accent} />
              </g>
            );
          })}
        </svg>
        <div style={{ position: "absolute", left: 0, right: 0, top: 96, textAlign: "center", fontSize: 30, fontWeight: 600, color: colors.textSoft, ...appear(frame, at(1)) }}>
          Regras financeiras objetivas <span style={{ color: colors.white }}>não dependem de interpretação probabilística</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - diagram }}>
        <Badge kind="real" from={realAt} />
        <LiveScreen
          enterAt={realAt}
          view={{ x: 200, y: 96, w: 1520, h: 680 }}
          shots={[{ at: 0, state: "cfg-politicas" }]}
          camera={[
            { at: 0, rect: [270, 230, 1330, 595] },
            { at: realAt + 70, rect: [270, 840, 1330, 595], dur: 2.2 },
            { at: at(5) - 20, rect: [270, 1250, 1330, 595], dur: 3.0 },
          ]}
          cursor={[
            { at: realAt + 16, x: 900, y: 600 },
            { at: realAt + 50, ...aim("cfg-politicas.aprovada", 1.5, 0.5), dur: 0.9 },
            { at: realAt + 140, x: 700, y: 1060, dur: 1.4 },
            { at: realAt + 220, x: 1180, y: 1140, dur: 1.4 },
            { at: at(5) + 40, x: 900, y: 1500, dur: 1.6 },
          ]}
          marks={[
            { at: realAt + 30, end: realAt + 110, rect: [285, 868, 1310, 40] },
            { at: realAt + 130, rect: [285, 1000, 1310, 420] },
          ]}
        />
        <div style={{ position: "absolute", left: 200, right: 200, top: 800, display: "flex", gap: 18, opacity: interpolate(frame, [at(5) - 10, at(5) + 6], [1, 0], clamp) }}>
          {TRACE.map((t, i) => (
            <div key={t} style={{ flex: 1, ...pop(realAt + 20 + i * 10) }}>
              <Tile style={{ textAlign: "center", fontSize: 26, fontWeight: 700 }}>{t}</Tile>
            </div>
          ))}
        </div>
        <div style={{ position: "absolute", left: 200, right: 200, top: 800, ...pop(at(5) + 4) }}>
          <Tile accent="#34D399" style={{ display: "flex", alignItems: "center", gap: 22, padding: "18px 26px" }}>
            <span style={{ width: 70, height: 38, borderRadius: 19, background: "rgba(255,255,255,0.15)", position: "relative", flexShrink: 0 }}>
              <span style={{ position: "absolute", top: 4, left: interpolate(frame, [at(5) + 20, at(5) + 32], [36, 4], clamp), width: 30, height: 30, borderRadius: "50%", background: "#94A3B8" }} />
            </span>
            <span style={{ fontSize: 25, fontWeight: 700 }}>Copiloto de IA desligado</span>
            <span style={{ fontSize: 23, color: colors.textSoft }}>motores, políticas e alçadas seguem operando normalmente.</span>
          </Tile>
        </div>
      </AbsoluteFill>
      <ImpactMoment at={at(5) + 120} lines={["O motor executa.", "A política governa. A alçada autoriza."]} />
    </AbsoluteFill>
  );
};

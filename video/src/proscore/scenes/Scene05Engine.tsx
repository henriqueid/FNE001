import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors, ease } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ScreenCapture } from "../components/ScreenCapture";
import { appear, Badge, Impact, SceneLabel, Tile } from "../components/ui";

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

  return (
    <AbsoluteFill>
      <Background />
      <SceneLabel index={5} title="O motor de decisão" />
      <AbsoluteFill style={{ opacity: diagram }}>
        <Badge kind="vision" from={10} />
        <div
          style={{
            position: "absolute",
            left: 760,
            top: 300,
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
          const left = i < 4;
          const k = left ? i : i - 4;
          return (
            <Tile
              key={r}
              style={{
                position: "absolute",
                left: left ? 250 : 1250,
                top: (left ? 250 : 300) + k * 120,
                width: 420,
                fontSize: 25,
                fontWeight: 600,
                ...appear(frame, at(2) + i * 10, 12, 0),
                translate: interpolate(frame, [at(2) + i * 10, at(2) + i * 10 + 16], [left ? "-40px 0px" : "40px 0px", "0px 0px"], { ...clamp, easing: ease.out }),
              }}
            >
              {r}
            </Tile>
          );
        })}
        <div style={{ position: "absolute", left: 0, right: 0, top: 150, textAlign: "center", fontSize: 30, fontWeight: 600, color: colors.textSoft, ...appear(frame, at(1)) }}>
          Regras financeiras objetivas <span style={{ color: colors.white }}>não dependem de interpretação probabilística</span>
        </div>
      </AbsoluteFill>
      <AbsoluteFill style={{ opacity: 1 - diagram }}>
        <Badge kind="real" from={realAt} />
        <ScreenCapture
          enterAt={realAt}
          images={[{ src: "proscore/screens/politicas-regras.jpg", at: 0 }]}
          camera={[
            { at: 0, rect: [270, 180, 1330, 700] },
            { at: realAt + 80, rect: [270, 600, 1330, 400] },
          ]}
          marks={[
            { at: realAt + 30, end: realAt + 90, rect: [290, 625, 1300, 34] },
            { at: realAt + 100, rect: [290, 760, 1300, 240] },
          ]}
          view={{ x: 230, y: 100, w: 1460, h: 640 }}
        />
        <div style={{ position: "absolute", left: 230, right: 230, top: 760, display: "flex", gap: 18 }}>
          {TRACE.map((t, i) => (
            <Tile key={t} style={{ flex: 1, textAlign: "center", fontSize: 25, fontWeight: 700, ...appear(frame, realAt + 20 + i * 10) }}>
              {t}
            </Tile>
          ))}
        </div>
        <Tile
          accent="#34D399"
          style={{ position: "absolute", left: 1170, top: 130, width: 500, ...appear(frame, at(5)) }}
        >
          <div style={{ fontSize: 17, color: "#6EE7B7", fontWeight: 700, letterSpacing: "0.1em" }}>COPILOTO DE IA DESLIGADO</div>
          <div style={{ fontSize: 22, marginTop: 4 }}>Motores, políticas e alçadas seguem operando normalmente.</div>
        </Tile>
      </AbsoluteFill>
      <Impact lines={["O motor executa.", "A política governa. A alçada autoriza."]} at={at(5) + 110} />
    </AbsoluteFill>
  );
};

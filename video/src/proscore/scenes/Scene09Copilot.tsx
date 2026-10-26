import { AbsoluteFill } from "remotion";
import { colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ScreenCapture } from "../components/ScreenCapture";
import { appear, Badge, Impact, SceneLabel, Tile } from "../components/ui";

const ILLUSTRATIVE = [
  "Quais sacados apresentaram piora no comportamento de pagamento?",
  "Quais operações estão aguardando análise?",
  "Quais exceções merecem prioridade?",
  "Como evoluiu o risco da carteira?",
  "Quais dados adicionais podem apoiar esta decisão?",
];

// Cena 09: o Copiloto real (pergunta e resposta com fontes) e as perguntas da visão de evolução.
export const Scene09Copilot: React.FC = () => {
  const { frame, at } = useNarration("s09");
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <SceneLabel index={9} title="Copiloto de IA" />
      <Badge kind="real" from={10} />
      <ScreenCapture
        view={{ x: 800, y: 110, w: 1060, h: 790 }}
        images={[
          { src: "screens/copiloto.jpg", at: 0 },
          { src: "screens/copiloto-evidencias.jpg", at: at(3) },
        ]}
        camera={[
          { at: 0, rect: [0, 0, 1600, 1000] },
          { at: at(0) + 40, rect: [880, 130, 720, 800] },
          { at: at(3), rect: [0, 0, 1180, 760] },
        ]}
        marks={[
          { at: at(2), end: at(3) - 6, rect: [1344, 733, 214, 74] },
          { at: at(3) + 30, rect: [26, 218, 1108, 454] },
        ]}
      />
      <div style={{ position: "absolute", left: 70, top: 120, width: 690 }}>
        <div style={{ color: "#6EE7B7", fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", ...appear(frame, at(2)) }}>PERGUNTA REAL NO SISTEMA</div>
        <Tile accent="#34D399" style={{ marginTop: 10, fontSize: 25, fontWeight: 600, ...appear(frame, at(2) + 8) }}>
          “Quais títulos estão vencidos?” → resposta com dados e fontes
        </Tile>
        <div style={{ color: colors.accent, fontSize: 18, fontWeight: 700, letterSpacing: "0.12em", marginTop: 30, ...appear(frame, at(4) - 20) }}>
          PERGUNTAS ILUSTRATIVAS · VISÃO DE EVOLUÇÃO
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {ILLUSTRATIVE.map((q, i) => (
            <div
              key={q}
              style={{
                padding: "12px 18px",
                borderRadius: 14,
                border: "1px dashed rgba(122,167,255,0.55)",
                background: "rgba(11,29,79,0.6)",
                color: colors.white,
                fontSize: 21,
                ...appear(frame, at(4) - 10 + i * 12, 12, 10),
              }}
            >
              {q}
            </div>
          ))}
        </div>
        <Tile accent="#7AA7FF" style={{ marginTop: 20, fontSize: 20, ...appear(frame, at(5)) }}>
          <b>Visão de evolução:</b> sínteses de inteligência externa como evidência citada.
        </Tile>
        <Tile accent="#F59E0B" style={{ marginTop: 14, fontSize: 20, ...appear(frame, at(7)) }}>
          <b>Aprovação humana:</b> o Copiloto sugere; regras e alçadas decidem.
        </Tile>
      </div>
      <Impact lines={["Uma IA que entende", "o contexto da operação."]} at={at(7) + 150} />
    </AbsoluteFill>
  );
};

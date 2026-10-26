import { AbsoluteFill } from "remotion";
import { colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen, target } from "../components/LiveScreen";
import { ImpactMoment, usePop } from "../components/motion";
import { Badge, SceneLabel, Tile } from "../components/ui";

const ILLUSTRATIVE = [
  "Quais sacados apresentaram piora no comportamento de pagamento?",
  "Quais operações estão aguardando análise?",
  "Quais exceções merecem prioridade?",
  "Como evoluiu o risco da carteira?",
  "Quais dados adicionais podem apoiar esta decisão?",
];

// Cena 09: o usuário abre o Copiloto, digita a pergunta e abre a resposta com as fontes.
export const Scene09Copilot: React.FC = () => {
  const { at } = useNarration("s09");
  const pop = usePop();
  const ta = target("cop-open.textarea");
  const send = at(2) + 125;
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <SceneLabel index={9} title="Copiloto de IA" />
      <Badge kind="real" from={10} />
      <LiveScreen
        view={{ x: 760, y: 96, w: 1110, h: 840 }}
        shots={[
          { at: 0, state: "home" },
          { at: at(0) + 150, state: "cop-open" },
          { at: send + 30, state: "cop-answer" },
          { at: at(3) + 40, state: "cop-report" },
        ]}
        camera={[
          { at: 0, rect: [500, 160, 1100, 832] },
          { at: at(0) + 162, rect: [780, 140, 1000, 757], dur: 1.2 },
          { at: at(3) + 50, rect: [0, 0, 1190, 900], dur: 1.2 },
        ]}
        cursor={[
          { at: at(0) + 60, x: 1200, y: 600 },
          { at: at(0) + 140, ...aim("home.fab"), click: true, dur: 1.2 },
          { at: at(2) + 20, x: ta[0] + 60, y: ta[1] + 14, click: true, dur: 1.2 },
          { at: send, x: 1534, y: 846, click: true, dur: 0.6 },
          { at: at(3) + 30, x: 1190, y: 704, click: true, dur: 1.0 },
          { at: at(3) + 120, x: 600, y: 420, dur: 1.2 },
        ]}
        typing={[{ at: at(2) + 32, text: "Quais títulos estão vencidos?", x: ta[0], y: ta[1] + 1, w: ta[2], cps: 15, size: 16 }]}
        marks={[
          { at: send + 50, end: at(3) + 20, rect: target("cop-answer.panel", -4) },
          { at: at(3) + 80, rect: [26, 282, 1108, 390] },
        ]}
      />
      <div style={{ position: "absolute", left: 60, top: 116, width: 660 }}>
        <div style={{ color: "#6EE7B7", fontSize: 19, fontWeight: 700, letterSpacing: "0.12em", ...pop(at(2)) }}>PERGUNTA REAL NO SISTEMA</div>
        <div style={{ marginTop: 10, ...pop(at(2) + 8) }}>
          <Tile accent="#34D399" style={{ fontSize: 26, fontWeight: 600 }}>“Quais títulos estão vencidos?” → resposta com dados e fontes</Tile>
        </div>
        <div style={{ color: colors.accent, fontSize: 19, fontWeight: 700, letterSpacing: "0.12em", marginTop: 30, ...pop(at(4) - 20) }}>
          PERGUNTAS ILUSTRATIVAS · VISÃO DE EVOLUÇÃO
        </div>
        <div style={{ marginTop: 10, display: "flex", flexDirection: "column", gap: 10 }}>
          {ILLUSTRATIVE.map((q, i) => (
            <div
              key={q}
              style={{ padding: "12px 18px", borderRadius: 14, border: "1px dashed rgba(122,167,255,0.6)", background: "rgba(11,29,79,0.7)", color: colors.white, fontSize: 22, ...pop(at(4) - 10 + i * 12, { dx: -60, dy: 0 }) }}
            >
              {q}
            </div>
          ))}
        </div>
        <div style={{ marginTop: 20, ...pop(at(5)) }}>
          <Tile accent="#7AA7FF" style={{ fontSize: 21 }}>
            <b>Visão de evolução:</b> sínteses de inteligência externa como evidência citada.
          </Tile>
        </div>
        <div style={{ marginTop: 14, ...pop(at(7)) }}>
          <Tile accent="#F59E0B" style={{ fontSize: 21 }}>
            <b>Aprovação humana:</b> o Copiloto sugere; regras e alçadas decidem.
          </Tile>
        </div>
      </div>
      <ImpactMoment at={at(7) + 150} lines={["Uma IA que entende", "o contexto da operação."]} />
    </AbsoluteFill>
  );
};

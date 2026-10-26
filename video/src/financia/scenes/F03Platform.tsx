import { AbsoluteFill, interpolate } from "remotion";
import { clamp, colors } from "../../brand/tokens";
import { Background } from "../../components/Background";
import { aim, LiveScreen, target } from "../../proscore/components/LiveScreen";
import { Particles } from "../../proscore/components/motion";
import { Badge, SceneLabel } from "../../proscore/components/ui";
import { useNarration } from "../components/clock";

const CHAPTERS = ["Visão geral", "Esteira da operação", "Motor de políticas", "Exceções com contexto", "Carteira e financeiro", "Copiloto"];

// Cena 3: o STRATO em uso — da visão geral ao Copiloto, com cursor percorrendo as telas reais.
export const F03Platform: React.FC = () => {
  const { frame, at } = useNarration("f03");
  const chapter = [0, 1, 2, 3, 4, 5].filter(i => frame >= at(i) - 6).pop() ?? 0;
  return (
    <AbsoluteFill>
      <Background />
      <Particles count={18} seed="f03" />
      <SceneLabel index={3} title="O que é o STRATO" />
      <Badge kind="real" from={10} />
      <LiveScreen
        view={{ x: 160, y: 110, w: 1600, h: 800 }}
        shots={[
          { at: 0, state: "home" },
          { at: at(1) - 8, state: "op" },
          { at: at(2) - 8, state: "op-motor" },
          { at: at(4) - 8, state: "mod-financeiro" },
          { at: at(5) - 8, state: "cop-answer" },
        ]}
        camera={[
          { at: 0, rect: [0, 0, 1600, 800] },
          { at: 50, rect: [0, 100, 1240, 620], dur: 3 },
          { at: at(1), rect: [0, 40, 1400, 700], dur: 0.8 },
          { at: at(2), rect: [40, 660, 1100, 550], dur: 1 },
          { at: at(3), rect: [100, 940, 1000, 500], dur: 1 },
          { at: at(4), rect: [0, 0, 1600, 800], dur: 0.8 },
          { at: at(4) + 40, rect: [0, 120, 1500, 750], dur: 2 },
          { at: at(5), rect: [700, 120, 900, 450], dur: 1 },
        ]}
        cursor={[
          { at: 30, x: 800, y: 600 },
          { at: 70, ...aim("home.kpiVolume") },
          { at: 110, ...aim("home.decisoes") },
          { at: at(1) + 10, ...aim("op.stepper"), click: true },
          { at: at(2) + 20, ...aim("op-motor.motor", 0.3) },
          { at: at(3) + 10, ...aim("op-motor.excecao", 0.2), click: true },
          { at: at(4) + 30, ...aim("mod-financeiro.saldos", 0.3) },
          { at: at(5) + 20, x: 1340, y: 330 },
        ]}
        marks={[
          { at: 70, end: at(1) - 10, rect: target("home.kpiVolume", 6) },
          { at: at(1) + 14, end: at(2) - 10, rect: [85, 232, 1000, 70] },
          { at: at(2) + 24, end: at(3) - 4, rect: target("op-motor.motor", 6) },
          { at: at(2) + 40, end: at(3) - 4, rect: target("op-motor.alerta", 4), color: colors.warn },
          { at: at(3) + 14, end: at(4) - 10, rect: target("op-motor.excecao", 4), color: colors.alert },
          { at: at(4) + 40, end: at(5) - 10, rect: target("mod-financeiro.saldos", 8), color: colors.decide },
          { at: at(5) + 20, rect: target("cop-answer.panel", 2) },
        ]}
      />
      <div style={{ position: "absolute", left: 0, right: 0, top: 930, display: "flex", justifyContent: "center", gap: 14 }}>
        {CHAPTERS.map((c, i) => {
          const on = i === chapter;
          return (
            <div
              key={c}
              style={{
                padding: "8px 18px",
                borderRadius: 999,
                fontSize: 20,
                fontWeight: 700,
                color: on ? colors.white : colors.textFaint,
                background: on ? colors.accentStrong : "rgba(11,29,79,0.6)",
                border: `1px solid ${on ? colors.accent : "rgba(255,255,255,0.1)"}`,
                opacity: interpolate(frame, [at(0) + i * 5, at(0) + i * 5 + 10], [0, 1], clamp),
              }}
            >
              {c}
            </div>
          );
        })}
      </div>
    </AbsoluteFill>
  );
};

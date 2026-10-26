import { AbsoluteFill } from "remotion";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { aim, LiveScreen, target } from "../components/LiveScreen";
import { ImpactMoment, Particles } from "../components/motion";
import { Badge, SceneLabel } from "../components/ui";

// Cena 02: abertura do dia, o usuário fecha o resumo, passeia pelos indicadores e abre o Score.
export const Scene02Vision: React.FC = () => {
  const { at } = useNarration("s02");
  const close = aim("home-modal.close");
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <Particles count={20} seed="s02" />
      <SceneLabel index={2} title="Nossa visão" />
      <Badge kind="real" from={10} />
      <LiveScreen
        shots={[
          { at: 0, state: "home-modal" },
          { at: at(0) + 250, state: "home" },
          { at: at(3) + 75, state: "home-score" },
        ]}
        camera={[
          { at: 0, rect: [0, 0, 1600, 840] },
          { at: at(0) + 40, rect: [300, 60, 1000, 525], dur: 1.4 },
          { at: at(0) + 262, rect: [0, 230, 1250, 656], dur: 1.2 },
          { at: at(2), rect: [0, 470, 1250, 656], dur: 1.2 },
          { at: at(3) + 20, rect: [900, 90, 700, 368], dur: 1.2 },
          { at: at(4) + 10, rect: [0, 0, 1600, 840], dur: 1.6 },
        ]}
        cursor={[
          { at: at(0) + 70, x: 800, y: 620 },
          { at: at(0) + 150, ...aim("home-modal.kpis", 2.5, 4), dur: 1.0 },
          { at: at(0) + 240, ...close, click: true, dur: 1.0 },
          { at: at(1) + 10, ...aim("home.kpiVolume", 0.5, 4), dur: 1.0 },
          { at: at(1) + 120, ...aim("home.kpiCaixa", 0.6, 4), dur: 1.6 },
          { at: at(2) + 40, ...aim("home.leitura", 0.4, 0.5), dur: 1.0 },
          { at: at(2) + 120, ...aim("home.decidirGZ"), dur: 1.0 },
          { at: at(3) + 70, ...aim("home.tabScore"), click: true, dur: 1.2 },
          { at: at(3) + 120, ...aim("home-score.scoreCarteira", 0.6, 0.8), dur: 0.9 },
        ]}
        marks={[
          { at: at(1), end: at(2) - 10, rect: [36, 314, 1152, 178] },
          { at: at(2) + 20, end: at(3) - 10, rect: [target("home.leitura")[0] - 50, 506, 1152, 107] },
          { at: at(3) + 100, end: at(4) + 30, rect: [1236, 334, 304, 120] },
        ]}
      />
      <ImpactMoment at={at(4) + 70} lines={["Alta capacidade tecnológica.", "Baixa complexidade operacional."]} />
    </AbsoluteFill>
  );
};

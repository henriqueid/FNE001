import { AbsoluteFill } from "remotion";
import { Background } from "../../components/Background";
import { useNarration } from "../components/clock";
import { ScreenCapture } from "../components/ScreenCapture";
import { Badge, Impact, SceneLabel } from "../components/ui";

// Cena 02: revelação do dashboard real, navegando pelos indicadores.
export const Scene02Vision: React.FC = () => {
  const { at } = useNarration("s02");
  return (
    <AbsoluteFill>
      <Background grid={false} />
      <SceneLabel index={2} title="Nossa visão" />
      <Badge kind="real" from={10} />
      <ScreenCapture
        images={[{ src: "screens/visao-geral.jpg", at: 0 }]}
        camera={[
          { at: 0, rect: [0, 0, 1600, 1000] },
          { at: at(0) + 30, rect: [0, 110, 1260, 690] },
          { at: at(2), rect: [0, 420, 1260, 690] },
          { at: at(3), rect: [1180, 90, 420, 900] },
          { at: at(4), rect: [0, 0, 1600, 1000] },
        ]}
        marks={[
          { at: at(0) + 50, end: at(2) - 4, rect: [36, 314, 1152, 178] },
          { at: at(2) + 20, end: at(3) - 4, rect: [36, 506, 1152, 107] },
          { at: at(3) + 24, end: at(4) - 4, rect: [1218, 330, 342, 125] },
        ]}
      />
      <Impact lines={["Alta capacidade tecnológica.", "Baixa complexidade operacional."]} at={at(4) + 30} />
    </AbsoluteFill>
  );
};

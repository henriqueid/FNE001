import { AbsoluteFill, Series } from "remotion";
import { Backdrop, SceneFade } from "./components";
import { AttentionScene, BriefingScene, ChatScene, IntroScene, LauncherScene } from "./scenes-a";
import { DecisionScene, DeskScene, OutroScene, PrinciplesScene, ScenarioScene } from "./scenes-b";

const SCENES = [
  { id: "intro", duration: 120, Component: IntroScene },
  { id: "launcher", duration: 150, Component: LauncherScene },
  { id: "briefing", duration: 180, Component: BriefingScene },
  { id: "attention", duration: 180, Component: AttentionScene },
  { id: "chat", duration: 180, Component: ChatScene },
  { id: "desk", duration: 290, Component: DeskScene },
  { id: "scenario", duration: 200, Component: ScenarioScene },
  { id: "principles", duration: 190, Component: PrinciplesScene },
  { id: "decision", duration: 200, Component: DecisionScene },
  { id: "outro", duration: 150, Component: OutroScene },
] as const;

export const TOTAL_FRAMES = SCENES.reduce((sum, scene) => sum + scene.duration, 0);

export function CopilotoExplainer() {
  return (
    <AbsoluteFill>
      <Series>
        {SCENES.map(({ id, duration, Component }) => (
          <Series.Sequence key={id} durationInFrames={duration} name={id}>
            <Backdrop />
            <SceneFade duration={duration}>
              <Component />
            </SceneFade>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

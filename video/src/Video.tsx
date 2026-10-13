import type { ComponentType } from "react";
import { AbsoluteFill, Series, interpolate, useCurrentFrame } from "remotion";
import { Backdrop, ChapterBar, SceneFade } from "./components";
import { AttentionScene, BriefingScene, ChatScene, IntroScene, LauncherScene } from "./scenes-a";
import { DecisionScene, DeskScene, OutroScene, PrinciplesScene, ScenarioScene } from "./scenes-b";

type Scene = {
  id: string;
  duration: number;
  Component: ComponentType;
  variant: "light" | "night";
  chapter?: number;
};

const CHAPTERS = [
  "Sempre à mão",
  "Abertura do dia",
  "Central do Dia",
  "Pergunte",
  "Mesa Inteligente",
  "Cenários",
  "Governança",
  "Decisão e trilha",
];

const SCENES: Scene[] = [
  { id: "intro", duration: 120, Component: IntroScene, variant: "night" },
  { id: "launcher", duration: 170, Component: LauncherScene, variant: "light", chapter: 0 },
  { id: "briefing", duration: 180, Component: BriefingScene, variant: "light", chapter: 1 },
  { id: "attention", duration: 190, Component: AttentionScene, variant: "light", chapter: 2 },
  { id: "chat", duration: 180, Component: ChatScene, variant: "light", chapter: 3 },
  { id: "desk", duration: 300, Component: DeskScene, variant: "light", chapter: 4 },
  { id: "scenario", duration: 200, Component: ScenarioScene, variant: "light", chapter: 5 },
  { id: "principles", duration: 190, Component: PrinciplesScene, variant: "night", chapter: 6 },
  { id: "decision", duration: 210, Component: DecisionScene, variant: "light", chapter: 7 },
  { id: "outro", duration: 150, Component: OutroScene, variant: "night" },
];

export const TOTAL_FRAMES = SCENES.reduce((sum, scene) => sum + scene.duration, 0);

function SceneChapter({ chapter, duration, variant }: { chapter: number; duration: number; variant: Scene["variant"] }) {
  const frame = useCurrentFrame();
  const progress = interpolate(frame, [0, duration], [0, 1], { extrapolateRight: "clamp" });
  const opacity = interpolate(frame, [0, 12], [0, 1], { extrapolateRight: "clamp" });
  return (
    <AbsoluteFill style={{ opacity }}>
      <ChapterBar chapters={CHAPTERS} current={chapter} progress={progress} dark={variant === "night"} />
    </AbsoluteFill>
  );
}

export function CopilotoExplainer() {
  return (
    <AbsoluteFill>
      <Series>
        {SCENES.map(({ id, duration, Component, variant, chapter }) => (
          <Series.Sequence key={id} durationInFrames={duration} name={id}>
            <Backdrop variant={variant} />
            {chapter !== undefined && <SceneChapter chapter={chapter} duration={duration} variant={variant} />}
            <SceneFade duration={duration}>
              <Component />
            </SceneFade>
          </Series.Sequence>
        ))}
      </Series>
    </AbsoluteFill>
  );
}

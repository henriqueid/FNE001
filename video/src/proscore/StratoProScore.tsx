import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import "../brand/fonts";
import { fontFamily } from "../brand/tokens";
import { Subtitles } from "./components/Subtitles";
import { FPS, LEAD, SCENE_STARTS, sceneFrames, TIMELINE, TOTAL_FRAMES, XFADE_FRAMES } from "./data/scenes";
import { Scene01Opportunity } from "./scenes/Scene01Opportunity";
import { Scene02Vision } from "./scenes/Scene02Vision";
import { Scene03Platform } from "./scenes/Scene03Platform";
import { Scene04Automation } from "./scenes/Scene04Automation";
import { Scene05Engine } from "./scenes/Scene05Engine";
import { Scene06Score } from "./scenes/Scene06Score";
import { Scene07Synergy } from "./scenes/Scene07Synergy";
import { Scene08IntegrationMap } from "./scenes/Scene08IntegrationMap";
import { Scene09Copilot } from "./scenes/Scene09Copilot";
import { Scene10Layers } from "./scenes/Scene10Layers";
import { Scene11UseCase } from "./scenes/Scene11UseCase";
import { Scene12Positioning } from "./scenes/Scene12Positioning";
import { Scene13Partnership } from "./scenes/Scene13Partnership";
import { Scene14Closing } from "./scenes/Scene14Closing";

export type StratoProScoreProps = { subtitles: boolean; musicVolume: number };

const SCENES: Record<string, React.FC> = {
  s01: Scene01Opportunity,
  s02: Scene02Vision,
  s03: Scene03Platform,
  s04: Scene04Automation,
  s05: Scene05Engine,
  s06: Scene06Score,
  s07: Scene07Synergy,
  s08: Scene08IntegrationMap,
  s09: Scene09Copilot,
  s10: Scene10Layers,
  s11: Scene11UseCase,
  s12: Scene12Positioning,
  s13: Scene13Partnership,
  s14: Scene14Closing,
};

// Trechos (em frames globais) com narração: a trilha abaixa durante a fala e respira entre cenas.
const SPEECH = TIMELINE.map((scene, i) => {
  const base = SCENE_STARTS[i].start + LEAD * FPS;
  return [base + scene.sentences[0].start * FPS, base + scene.duration * FPS] as const;
});

const musicLevel = (frame: number, base: number) => {
  const near = SPEECH.some(([a, b]) => frame >= a - 12 && frame <= b + 12);
  const edge = SPEECH.reduce((d, [a, b]) => Math.min(d, Math.abs(frame - a), Math.abs(frame - b)), Infinity);
  const duck = near ? 0.32 : 1;
  const smooth = near ? duck : interpolate(edge, [0, 18], [0.32, 1], { extrapolateRight: "clamp" });
  const fadeIn = interpolate(frame, [0, 45], [0, 1], { extrapolateRight: "clamp" });
  const fadeOut = interpolate(frame, [TOTAL_FRAMES - 150, TOTAL_FRAMES - 5], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return base * smooth * fadeIn * fadeOut;
};

export const StratoProScore: React.FC<StratoProScoreProps> = ({ subtitles, musicVolume }) => (
  <AbsoluteFill style={{ fontFamily, backgroundColor: "#040A1C" }}>
    <TransitionSeries>
      {TIMELINE.flatMap((scene, i) => {
        const Scene = SCENES[scene.id];
        const items = [
          <TransitionSeries.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene.id)}>
            <Scene />
            <Sequence from={Math.round(LEAD * FPS)} name={`narração ${scene.id}`}>
              <Audio src={staticFile(`proscore/audio/${scene.id}.mp3`)} />
            </Sequence>
          </TransitionSeries.Sequence>,
        ];
        if (i < TIMELINE.length - 1)
          items.push(
            <TransitionSeries.Transition
              key={`t${scene.id}`}
              presentation={fade()}
              timing={linearTiming({ durationInFrames: XFADE_FRAMES })}
            />,
          );
        return items;
      })}
    </TransitionSeries>
    <Audio src={staticFile("proscore/audio/music.mp3")} volume={f => musicLevel(f, musicVolume)} />
    {subtitles ? <Subtitles /> : null}
  </AbsoluteFill>
);

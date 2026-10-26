import { Audio } from "@remotion/media";
import { linearTiming, TransitionSeries } from "@remotion/transitions";
import { fade } from "@remotion/transitions/fade";
import { AbsoluteFill, interpolate, Sequence, staticFile } from "remotion";
import "../brand/fonts";
import { fontFamily } from "../brand/tokens";
import { Subtitles } from "./components/Subtitles";
import { FPS, LEAD, SCENE_STARTS, sceneFrames, TIMELINE, TOTAL_FRAMES, XFADE_FRAMES } from "./data/scenes";
import { F01Opening } from "./scenes/F01Opening";
import { F02Problem } from "./scenes/F02Problem";
import { F03Platform } from "./scenes/F03Platform";
import { F04Status } from "./scenes/F04Status";
import { F05Ecosystem } from "./scenes/F05Ecosystem";
import { F06Financia } from "./scenes/F06Financia";
import { F07Phases } from "./scenes/F07Phases";
import { F08Paths } from "./scenes/F08Paths";
import { F09Exchange } from "./scenes/F09Exchange";
import { F10Care } from "./scenes/F10Care";
import { F11Next } from "./scenes/F11Next";

export type StratoFinanciaProps = { subtitles: boolean; musicVolume: number };

const SCENES: Record<string, React.FC> = {
  f01: F01Opening,
  f02: F02Problem,
  f03: F03Platform,
  f04: F04Status,
  f05: F05Ecosystem,
  f06: F06Financia,
  f07: F07Phases,
  f08: F08Paths,
  f09: F09Exchange,
  f10: F10Care,
  f11: F11Next,
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

export const StratoFinancia: React.FC<StratoFinanciaProps> = ({ subtitles, musicVolume }) => (
  <AbsoluteFill style={{ fontFamily, backgroundColor: "#040A1C" }}>
    <TransitionSeries>
      {TIMELINE.flatMap((scene, i) => {
        const Scene = SCENES[scene.id];
        const items = [
          <TransitionSeries.Sequence key={scene.id} name={scene.id} durationInFrames={sceneFrames(scene.id)}>
            <Scene />
            <Sequence from={Math.round(LEAD * FPS)} name={`narração ${scene.id}`}>
              <Audio src={staticFile(`financia/audio/${scene.id}.mp3`)} />
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
    <Audio src={staticFile("proscore/audio/music.mp3") /* mesma trilha própria do vídeo proScore */} volume={f => musicLevel(f, musicVolume)} />
    {subtitles ? <Subtitles /> : null}
  </AbsoluteFill>
);

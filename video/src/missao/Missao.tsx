/**
 * Vídeo "Missão STRATO": por que estamos reinventando a operação de recebíveis e onde o STRATO entra.
 * Mesma composição em 16:9 e 9:16; o layout de cada cena se adapta ao formato.
 */
import React from "react";
import { AbsoluteFill, Audio, Sequence, interpolate, staticFile, useCurrentFrame } from "remotion";
import { theme } from "../theme";
import { Background, Subtitles, Watermark } from "./layout";
import { AberturaScene, FechamentoScene, MercadoScene, MissaoScene, ProblemaScene } from "./scenes-historia";
import { CarteiraScene, CopilotoScene, EntradaScene, EsteiraScene, ExcecaoScene, TrilhaScene } from "./scenes-produto";
import { SCENES, type SceneId } from "./timeline";

const VIEWS: Record<SceneId, { variant: "night" | "light"; product?: boolean; render: (duration: number) => React.ReactNode }> = {
  abertura: { variant: "night", render: () => <AberturaScene /> },
  problema: { variant: "light", render: d => <ProblemaScene duration={d} /> },
  mercado: { variant: "night", render: () => <MercadoScene /> },
  missao: { variant: "night", render: d => <MissaoScene duration={d} /> },
  entrada: { variant: "light", product: true, render: () => <EntradaScene /> },
  esteira: { variant: "light", product: true, render: d => <EsteiraScene duration={d} /> },
  excecao: { variant: "light", product: true, render: d => <ExcecaoScene duration={d} /> },
  copiloto: { variant: "light", product: true, render: () => <CopilotoScene /> },
  carteira: { variant: "light", product: true, render: () => <CarteiraScene /> },
  trilha: { variant: "light", product: true, render: () => <TrilhaScene /> },
  fechamento: { variant: "night", render: () => <FechamentoScene /> },
};

/** Janelas (em frames globais) em que há narração, para abaixar a trilha. */
const VOICE_WINDOWS = SCENES.map(s => [s.from + s.voiceFrom, s.from + s.voiceFrom + s.voiceFrames] as const);
const TOTAL = SCENES[SCENES.length - 1].from + SCENES[SCENES.length - 1].duration;

function musicVolume(frame: number) {
  const ramp = 12;
  let near = Infinity;
  for (const [a, b] of VOICE_WINDOWS) {
    if (frame >= a && frame <= b) {
      near = 0;
      break;
    }
    near = Math.min(near, Math.abs(frame - a), Math.abs(frame - b));
  }
  const duck = interpolate(near, [0, ramp], [1, 0], { extrapolateRight: "clamp" });
  const base = 0.42 - 0.3 * duck;
  const fadeOut = interpolate(frame, [TOTAL - 45, TOTAL], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
  return base * fadeOut;
}

function SceneShell({ duration, children }: { duration: number; children: React.ReactNode }) {
  const frame = useCurrentFrame();
  const opacity = interpolate(frame, [0, 8, duration - 8, duration], [0, 1, 1, 0], {
    extrapolateLeft: "clamp",
    extrapolateRight: "clamp",
  });
  const scale = interpolate(frame, [0, 14], [1.03, 1], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ opacity, transform: `scale(${scale})` }}>{children}</AbsoluteFill>;
}

export function MissaoStrato() {
  return (
    <AbsoluteFill style={{ background: theme.navy, fontFamily: theme.font }}>
      <Audio src={staticFile("missao/trilha.mp3")} volume={musicVolume} />
      {SCENES.map(scene => {
        const view = VIEWS[scene.id];
        return (
          <Sequence key={scene.id} from={scene.from} durationInFrames={scene.duration} name={scene.id}>
            <Background variant={view.variant} />
            <SceneShell duration={scene.duration}>
              {view.render(scene.duration)}
              {view.product && <Watermark />}
            </SceneShell>
            <Subtitles text={scene.text} from={scene.voiceFrom} frames={scene.voiceFrames} />
            <Sequence from={scene.voiceFrom} layout="none">
              <Audio src={staticFile(`missao/narr_${scene.id}.mp3`)} volume={1} />
            </Sequence>
            {scene.from > 0 && (
              <Sequence from={0} durationInFrames={24} layout="none">
                <Audio src={staticFile("missao/whoosh.wav")} volume={0.35} />
              </Sequence>
            )}
          </Sequence>
        );
      })}
    </AbsoluteFill>
  );
}

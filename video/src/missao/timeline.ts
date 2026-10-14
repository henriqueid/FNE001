/**
 * Linha do tempo do vídeo "Missão STRATO": cada cena dura o trecho de narração + respiros.
 * As mesmas regras (LEAD, TAIL, END_EXTRA, ORDER) estão em scripts/gerar_trilha.py para alinhar a música.
 */
import script from "../../narration/missao.json";
import timing from "./timing.json";
import { FPS } from "../theme";

export const LEAD = 0.6;
export const TAIL = 0.9;
export const END_EXTRA = 3.0;

export const ORDER = [
  "abertura",
  "problema",
  "mercado",
  "missao",
  "entrada",
  "esteira",
  "excecao",
  "copiloto",
  "carteira",
  "trilha",
  "fechamento",
] as const;

export type SceneId = (typeof ORDER)[number];

export type SceneTiming = {
  id: SceneId;
  from: number;
  duration: number;
  /** Frame (relativo à cena) em que a narração começa. */
  voiceFrom: number;
  /** Duração da narração em frames. */
  voiceFrames: number;
  text: string;
  caption: string;
};

const segments = new Map(script.segments.map(s => [s.id, s]));

export const SCENES: SceneTiming[] = (() => {
  let from = 0;
  return ORDER.map((id, i) => {
    const seconds = (timing as Record<string, number>)[id];
    const duration = Math.round((LEAD + seconds + TAIL + (i === ORDER.length - 1 ? END_EXTRA : 0)) * FPS);
    const scene: SceneTiming = {
      id,
      from,
      duration,
      voiceFrom: Math.round(LEAD * FPS),
      voiceFrames: Math.round(seconds * FPS),
      text: segments.get(id)?.text ?? "",
      caption: segments.get(id)?.caption ?? "",
    };
    from += duration;
    return scene;
  });
})();

export const MISSAO_FRAMES = SCENES.reduce((sum, s) => sum + s.duration, 0);

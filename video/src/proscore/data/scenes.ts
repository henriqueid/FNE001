import timeline from "./timeline.json";
import timing from "./timing.json";

// Cada cena dura: respiro de entrada + narração + respiro de saída. As transições (fade) se
// sobrepõem às bordas, então a soma das cenas menos as transições dá a duração total.
export const FPS = timing.fps;
export const LEAD = timing.lead;
export const TAIL = timing.tail;
export const XFADE = timing.xfade;
const EXTRA_TAIL = timing.extraTail as Record<string, number>;

export type TimedSentence = { text: string; start: number; end: number };
export type SceneTiming = { id: string; duration: number; sentences: TimedSentence[] };

export const TIMELINE = timeline as SceneTiming[];

export const sceneFrames = (id: string) => {
  const scene = TIMELINE.find(s => s.id === id);
  if (!scene) throw new Error(`Cena sem narração: ${id}`);
  return Math.ceil((LEAD + scene.duration + TAIL + (EXTRA_TAIL[id] ?? 0)) * FPS);
};

const xfadeFrames = Math.round(XFADE * FPS);

// Início global (em frames) de cada cena, já descontando a sobreposição das transições.
export const SCENE_STARTS = (() => {
  let at = 0;
  return TIMELINE.map(scene => {
    const start = at;
    at += sceneFrames(scene.id) - xfadeFrames;
    return { id: scene.id, start };
  });
})();

export const TOTAL_FRAMES =
  TIMELINE.reduce((sum, scene) => sum + sceneFrames(scene.id), 0) - (TIMELINE.length - 1) * xfadeFrames;

export const XFADE_FRAMES = xfadeFrames;

// Legendas globais (segundos no vídeo final), usadas na composição e no SRT.
export const GLOBAL_CAPTIONS = TIMELINE.flatMap((scene, i) =>
  scene.sentences.map(sentence => ({
    text: sentence.text,
    start: SCENE_STARTS[i].start / FPS + LEAD + sentence.start,
    end: SCENE_STARTS[i].start / FPS + LEAD + sentence.end,
  })),
);

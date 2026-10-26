import { useCurrentFrame, useVideoConfig } from "remotion";
import { LEAD, TIMELINE } from "../data/scenes";

// Relógio da cena sincronizado à narração: at(i) é o frame (local) em que a frase i começa.
export const useNarration = (id: string) => {
  const frame = useCurrentFrame();
  const { fps, durationInFrames } = useVideoConfig();
  const scene = TIMELINE.find(s => s.id === id)!;
  const at = (i: number, offset = 0) => Math.round((LEAD + scene.sentences[Math.min(i, scene.sentences.length - 1)].start + offset) * fps);
  const end = (i: number, offset = 0) => Math.round((LEAD + scene.sentences[i].end + offset) * fps);
  return { frame, fps, at, end, durationInFrames, sentences: scene.sentences };
};

/**
 * Alinha as frases do roteiro ao áudio de cada cena: detecta as pausas (silêncios) e usa as
 * N−1 mais longas como fronteiras entre as N frases. Gera src/proscore/data/timeline.json
 * (durações por cena e início/fim de cada frase), usado pela composição e pelo SRT.
 */
const { execFileSync, spawnSync } = require("node:child_process");
const fs = require("node:fs");
const { scenes } = require("./tts-text.cjs");

const AUDIO = "public/proscore/audio";
const out = [];
for (const scene of scenes) {
  const file = `${AUDIO}/${scene.id}.mp3`;
  if (!fs.existsSync(file)) {
    console.error(`sem áudio: ${scene.id}`);
    continue;
  }
  const duration = Number(
    execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", file]).toString(),
  );
  const log = spawnSync("ffmpeg", ["-i", file, "-af", "silencedetect=n=-38dB:d=0.18", "-f", "null", "-"], {
    encoding: "utf8",
  }).stderr;
  const starts = [...log.matchAll(/silence_start: ([\d.]+)/g)].map(m => Number(m[1]));
  const ends = [...log.matchAll(/silence_end: ([\d.]+)/g)].map(m => Number(m[1]));
  const gaps = starts
    .map((s, i) => ({ s, e: ends[i] ?? duration, len: (ends[i] ?? duration) - s }))
    .filter(g => g.s > 0.3 && g.e < duration - 0.3);
  const n = scene.sentences.length;
  const cuts = [...gaps].sort((a, b) => b.len - a.len).slice(0, n - 1).sort((a, b) => a.s - b.s);
  const first = starts[0] === 0 || (starts[0] ?? 1) < 0.05 ? ends[0] : 0;
  const lead = Math.max(0, first ?? 0);
  const sentences = scene.sentences.map((text, i) => ({
    text,
    start: Number((i === 0 ? lead : cuts[i - 1].e).toFixed(2)),
    end: Number((i === n - 1 ? duration : cuts[i].s).toFixed(2)),
  }));
  const warn = cuts.length !== n - 1 ? ` ATENÇÃO: ${cuts.length} pausas para ${n} frases` : "";
  console.log(`${scene.id} ${duration.toFixed(2)}s ${n} frases${warn} | menor pausa usada ${Math.min(...cuts.map(c => c.len)).toFixed(2)}s`);
  out.push({ id: scene.id, duration: Number(duration.toFixed(3)), sentences });
}
fs.writeFileSync("src/proscore/data/timeline.json", JSON.stringify(out, null, 2) + "\n");

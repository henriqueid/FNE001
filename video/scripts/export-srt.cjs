// Gera o arquivo SRT com os mesmos tempos usados pela composição (timing.json + timeline.json).
const fs = require("node:fs");
const video = process.env.VIDEO ?? "proscore";
const timeline = require(`../src/${video}/data/timeline.json`);
const t = require(`../src/${video}/data/timing.json`);
const frames = s => Math.ceil((t.lead + s.duration + t.tail + (t.extraTail[s.id] ?? 0)) * t.fps);
const xf = Math.round(t.xfade * t.fps);
let at = 0;
const cues = [];
for (const s of timeline) {
  const base = at / t.fps + t.lead;
  for (const x of s.sentences) cues.push({ text: x.text, start: base + x.start, end: base + x.end });
  at += frames(s) - xf;
}
const ts = v => {
  const ms = Math.round(v * 1000);
  const p = (n, w = 2) => String(n).padStart(w, "0");
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)},${p(ms % 1000, 3)}`;
};
const out = process.argv[2] ?? `out/strato-${video}.srt`;
fs.mkdirSync(require("node:path").dirname(out), { recursive: true });
fs.writeFileSync(out, cues.map((c, i) => `${i + 1}\n${ts(c.start)} --> ${ts(c.end)}\n${c.text}\n`).join("\n"));
console.log(`${cues.length} legendas → ${out}; vídeo ${(at + xf) / t.fps}s`);

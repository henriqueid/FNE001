// Gera o roteiro final narrado (Markdown) com o tempo de início de cada cena no vídeo.
const fs = require("node:fs");
const timeline = require("../src/proscore/data/timeline.json");
const t = require("../src/proscore/data/timing.json");
const src = fs.readFileSync("src/proscore/data/narration.ts", "utf8");
const titles = Object.fromEntries([...src.matchAll(/id: "(s\d+)",\n\s+title: "([^"]+)"/g)].map(m => [m[1], m[2]]));
const frames = s => Math.ceil((t.lead + s.duration + t.tail + (t.extraTail[s.id] ?? 0)) * t.fps);
const xf = Math.round(t.xfade * t.fps);
const mmss = v => `${String(Math.floor(v / 60)).padStart(2, "0")}:${String(Math.floor(v % 60)).padStart(2, "0")}`;
let at = 0;
const parts = ["# STRATO × proScore — roteiro final narrado", "", "Texto integral da locução usada no vídeo (voz sintética ElevenLabs, eleven_v4, voz “Davi Menegon – Calm & Professional”). Tempos no vídeo final.", ""];
timeline.forEach((s, i) => {
  parts.push(`## Cena ${String(i + 1).padStart(2, "0")} — ${titles[s.id]} · ${mmss(at / t.fps)}`, "");
  parts.push(s.sentences.map(x => x.text).join(" "), "");
  at += frames(s) - xf;
});
parts.push(`Duração total: ${mmss((at + xf) / t.fps)}.`, "");
fs.writeFileSync("docs/proscore/02-roteiro-final.md", parts.join("\n"));
console.log("ok");

// Monta o texto enviado ao TTS por cena: pausas curtas entre frases (também usadas para alinhar
// as legendas) e IPA nas palavras que a voz tende a ler errado. As legendas usam o texto original.
const fs = require("node:fs");
const src = fs.readFileSync("src/proscore/data/narration.ts", "utf8");
const scenes = [...src.matchAll(/id: "(s\d+)",[\s\S]*?sentences: \[([\s\S]*?)\n    \]/g)].map(m => ({
  id: m[1],
  sentences: [...m[2].matchAll(/^      "(.*)",$/gm)].map(x => x[1]),
}));
const fix = s =>
  s
    .replaceAll("proScore", "/pɾɔˈskɔɾ/")
    .replaceAll("FIDCs", "/ˈfidʒiks/")
    .replaceAll("APIs", "/a pe ˈis/")
    .replaceAll("API", "/a pe ˈi/");
const out = Object.fromEntries(scenes.map(s => [s.id, s.sentences.map(fix).join(" [short pause] ")]));
if (require.main === module) {
  const id = process.argv[2];
  console.log(id ? out[id] : JSON.stringify(Object.fromEntries(Object.entries(out).map(([k, v]) => [k, v.length]))));
}
module.exports = { scenes, out };

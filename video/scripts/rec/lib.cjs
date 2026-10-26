/**
 * Gravador de demonstrações do STRATO para os vídeos: navegador automático no modo demonstração
 * (dados fictícios), cursor visível com clique animado, movimentos suaves e captura de quadros
 * via CDP (screencast). Gera MP4 a 30 fps. Nunca apontar para produção.
 */
const { chromium } = require("playwright");
const { mkdirSync, writeFileSync, rmSync } = require("node:fs");
const { execFileSync } = require("node:child_process");
const path = require("node:path");

const BASE = process.env.STRATO_URL ?? "http://127.0.0.1:5173/";

const CURSOR = `
(() => {
  if (window.__cursor) return;
  window.__cursor = true;
  const install = () => {
    const c = document.createElement('div');
    c.id = '__rec_cursor';
    c.innerHTML = '<svg width="30" height="36" viewBox="0 0 17 20"><path d="M1 1 L1 16 L5 12 L8 19 L11 18 L8 11 L14 11 Z" fill="#0F172A" stroke="white" stroke-width="1.3" stroke-linejoin="round"/></svg>';
    Object.assign(c.style, { position: 'fixed', left: '-100px', top: '-100px', zIndex: 2147483647, pointerEvents: 'none', filter: 'drop-shadow(0 3px 6px rgba(0,0,0,.35))', transformOrigin: '2px 2px', transition: 'transform 90ms ease-out' });
    document.body.appendChild(c);
    addEventListener('mousemove', e => { c.style.left = e.clientX - 2 + 'px'; c.style.top = e.clientY - 2 + 'px'; }, true);
    addEventListener('mousedown', e => {
      c.style.transform = 'scale(0.82)';
      const r = document.createElement('div');
      Object.assign(r.style, { position: 'fixed', left: e.clientX - 22 + 'px', top: e.clientY - 22 + 'px', width: '44px', height: '44px', borderRadius: '50%', border: '3px solid rgba(59,107,255,.9)', background: 'rgba(59,107,255,.15)', zIndex: 2147483646, pointerEvents: 'none', transition: 'transform 450ms ease-out, opacity 450ms ease-out' });
      document.body.appendChild(r);
      requestAnimationFrame(() => { r.style.transform = 'scale(1.9)'; r.style.opacity = '0'; });
      setTimeout(() => r.remove(), 500);
    }, true);
    addEventListener('mouseup', () => { c.style.transform = 'scale(1)'; }, true);
  };
  if (document.body) install(); else addEventListener('DOMContentLoaded', install);
})();`;

async function start({ width = 1600, height = 1000 } = {}) {
  const browser = await chromium.launch();
  const context = await browser.newContext({ viewport: { width, height }, deviceScaleFactor: 1.5 });
  await context.addInitScript(CURSOR);
  const page = await context.newPage();
  const state = { x: width / 2, y: height / 2 };
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

  const r = {
    page,
    browser,
    async enterDemo() {
      await page.goto(BASE);
      await page.getByText("Continuar na demonstração").click();
      await page.waitForTimeout(3500);
    },
    async move(x, y, ms = 700) {
      const sx = state.x;
      const sy = state.y;
      const steps = Math.max(8, Math.round(ms / 16));
      // Leve curva para o movimento parecer humano.
      const bend = (Math.random() - 0.5) * 0.18;
      for (let i = 1; i <= steps; i++) {
        const t = ease(i / steps);
        const nx = sx + (x - sx) * t + (y - sy) * bend * Math.sin(Math.PI * t);
        const ny = sy + (y - sy) * t - (x - sx) * bend * Math.sin(Math.PI * t);
        await page.mouse.move(nx, ny);
        await page.waitForTimeout(16);
      }
      state.x = x;
      state.y = y;
    },
    async moveTo(locator, ms = 700, dx = 0.5, dy = 0.5) {
      const box = await locator.boundingBox();
      if (!box) throw new Error("alvo sem caixa");
      await r.move(box.x + box.width * dx, box.y + box.height * dy, ms);
      return box;
    },
    async click(locator, ms = 700) {
      await r.moveTo(locator, ms);
      await page.waitForTimeout(140);
      await page.mouse.down();
      await page.waitForTimeout(90);
      await page.mouse.up();
    },
    async scroll(dy, ms = 1200) {
      const steps = Math.max(10, Math.round(ms / 16));
      let done = 0;
      for (let i = 1; i <= steps; i++) {
        const target = dy * ease(i / steps);
        await page.mouse.wheel(0, target - done);
        done = target;
        await page.waitForTimeout(16);
      }
    },
    async type(text, perChar = 55) {
      for (const ch of text) {
        await page.keyboard.type(ch);
        await page.waitForTimeout(perChar + Math.random() * 40);
      }
    },
    wait: ms => page.waitForTimeout(ms),
    async record(name, fn) {
      const dir = path.resolve(`out/rec-frames/${name}`);
      rmSync(dir, { recursive: true, force: true });
      mkdirSync(dir, { recursive: true });
      const cdp = await page.context().newCDPSession(page);
      const frames = [];
      cdp.on("Page.screencastFrame", async f => {
        frames.push({ data: f.data, t: Date.now() / 1000 });
        await cdp.send("Page.screencastFrameAck", { sessionId: f.sessionId }).catch(() => {});
      });
      await cdp.send("Page.startScreencast", { format: "jpeg", quality: 90, maxWidth: 2400, maxHeight: 1500, everyNthFrame: 1 });
      // Pequeno movimento para garantir o primeiro quadro.
      await page.mouse.move(state.x + 1, state.y);
      await page.waitForTimeout(300);
      const t0 = Date.now() / 1000;
      await fn(r);
      await page.waitForTimeout(500);
      const tEnd = Date.now() / 1000;
      await cdp.send("Page.stopScreencast");
      // Converte quadros com carimbo de tempo em vídeo de 30 fps constante.
      const list = [];
      const valid = frames.filter(f => f.t >= t0 - 0.35);
      valid.forEach((f, i) => {
        const file = `${String(i).padStart(5, "0")}.jpg`;
        writeFileSync(path.join(dir, file), Buffer.from(f.data, "base64"));
        const next = i + 1 < valid.length ? valid[i + 1].t : tEnd;
        list.push(`file '${file}'\nduration ${Math.max(0.001, next - Math.max(f.t, t0)).toFixed(4)}`);
      });
      list.push(`file '${String(valid.length - 1).padStart(5, "0")}.jpg'`);
      writeFileSync(path.join(dir, "list.txt"), list.join("\n"));
      const out = path.resolve(`public/proscore/rec/${name}.mp4`);
      mkdirSync(path.dirname(out), { recursive: true });
      execFileSync("ffmpeg", ["-v", "error", "-y", "-f", "concat", "-safe", "0", "-i", path.join(dir, "list.txt"), "-vf", "fps=30,scale=2400:1500:flags=lanczos,format=yuv420p", "-c:v", "libx264", "-crf", "18", "-preset", "slow", "-movflags", "+faststart", out]);
      const dur = execFileSync("ffprobe", ["-v", "error", "-show_entries", "format=duration", "-of", "csv=p=0", out]).toString().trim();
      console.log(`${name}: ${valid.length} quadros capturados → ${dur}s`);
      rmSync(dir, { recursive: true, force: true });
    },
    close: () => browser.close(),
  };
  return r;
}

module.exports = { start };

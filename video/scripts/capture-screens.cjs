/**
 * Recaptura os prints do STRATO usados nos vídeos, a partir do modo demonstração (dados fictícios).
 * Pré-requisito: app rodando localmente em http://127.0.0.1:5173 com um PostgreSQL local descartável
 * (a entrada demonstrativa só funciona em localhost). Nunca aponte para produção.
 * Uso: node scripts/capture-screens.cjs  →  grava PNGs 3200×2000 em out/screens/; converta para JPEG em public/screens/.
 */
const { chromium } = require("playwright");
const { mkdirSync } = require("node:fs");

const BASE = process.env.STRATO_URL ?? "http://127.0.0.1:5173/";
const OUT = "out/screens";

const enterDemo = async (browser, height = 1000) => {
  const page = await browser.newPage({ viewport: { width: 1600, height }, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.getByText("Continuar na demonstração").click();
  await page.waitForTimeout(4000);
  return page;
};

const openCopilot = async page => {
  await page.locator('[aria-label*="Copiloto" i]').first().click();
  await page.waitForTimeout(1500);
};

(async () => {
  mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();

  let page = await enterDemo(browser);
  await page.screenshot({ path: `${OUT}/abertura-do-dia.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await page.screenshot({ path: `${OUT}/visao-geral.png` });
  for (const [label, file] of [
    ["Operações", "operacoes"],
    ["Controladoria", "controladoria"],
    ["Carteira", "carteira"],
    ["Comercial", "comercial"],
    ["Financeiro", "financeiro"],
    ["Cadastros", "cadastros"],
  ]) {
    await page.locator(`header button[aria-label="${label}"]`).click();
    await page.waitForTimeout(2500);
    await page.screenshot({ path: `${OUT}/${file}.png` });
  }
  await page.close();

  page = await enterDemo(browser);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await page.getByRole("button", { name: /Decidir/ }).nth(1).click();
  await page.waitForTimeout(3000);
  await page.screenshot({ path: `${OUT}/operacao-etapas.png` });
  await page.mouse.wheel(0, 700);
  await page.waitForTimeout(1200);
  await page.screenshot({ path: `${OUT}/operacao-risco.png` });
  await page.close();

  page = await enterDemo(browser);
  await page.keyboard.press("Escape");
  await page.waitForTimeout(800);
  await openCopilot(page);
  await page.screenshot({ path: `${OUT}/copiloto.png` });
  await page.getByText("Quais títulos estão vencidos?").first().click();
  await page.waitForTimeout(4000);
  await page.getByText("Ver mais").last().click();
  await page.waitForTimeout(2500);
  // Retoque aplicado na versão publicada: a linha "Resposta local da sessão atual…" é coberta de branco.
  await page.screenshot({ path: `${OUT}/copiloto-evidencias.png` });

  await browser.close();
})();

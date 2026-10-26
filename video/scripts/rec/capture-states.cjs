/**
 * Captura estados reais do STRATO (modo demonstração, dados fictícios) para as cenas animadas:
 * prints da página inteira em 2× e a posição (em px de tela) de cada alvo de interação.
 * Saída: public/proscore/states/<estado>.jpg e src/proscore/data/states.json.
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const BASE = process.env.STRATO_URL ?? "http://127.0.0.1:5173/";
const OUT = "public/proscore/states";
const meta = {};

const enter = async browser => {
  const page = await browser.newPage({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 2 });
  await page.goto(BASE);
  await page.getByText("Continuar na demonstração").click();
  await page.waitForTimeout(4000);
  return page;
};

const box = async (page, locator) => {
  const b = await locator.first().boundingBox({ timeout: 2500 }).catch(() => null);
  if (!b) return null;
  const sy = await page.evaluate(() => window.scrollY);
  return [Math.round(b.x), Math.round(b.y + sy), Math.round(b.width), Math.round(b.height)];
};

const snap = async (page, name, targets = {}, full = true) => {
  await page.evaluate(() => window.scrollTo(0, 0));
  await page.waitForTimeout(600);
  const t = {};
  for (const [k, loc] of Object.entries(targets)) t[k] = await box(page, loc);
  // Em prints de página inteira, elementos fixos (avisos flutuantes, botão do Copiloto) ficariam no meio do conteúdo.
  if (full)
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("body *")) {
        const cs = getComputedStyle(el);
        if (cs.position === "fixed" && !el.closest("header")) el.setAttribute("data-rec-hidden", el.style.visibility || "visible"), (el.style.visibility = "hidden");
      }
    });
  const file = path.join(OUT, `${name}.jpg`);
  await page.screenshot({ path: file, fullPage: full, type: "jpeg", quality: 88 });
  const h = await page.evaluate(() => document.documentElement.scrollHeight);
  if (full)
    await page.evaluate(() => {
      for (const el of document.querySelectorAll("[data-rec-hidden]")) (el.style.visibility = el.getAttribute("data-rec-hidden")), el.removeAttribute("data-rec-hidden");
    });
  meta[name] = { src: `proscore/states/${name}.jpg`, width: 1600, height: full ? h : 1000, targets: t };
  console.log(name, full ? h : 1000, Object.entries(t).map(([k, v]) => `${k}:${v ? "ok" : "—"}`).join(" "));
};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const b = await chromium.launch();

  // Visão geral com a Abertura do dia aberta, depois a página inteira e a aba Score do radar.
  let p = await enter(b);
  await snap(p, "home-modal", { close: p.getByRole("button", { name: /fechar/i }), kpis: p.locator(".modal, [role=dialog]").getByText("PRIORIDADES") }, false);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(900);
  await snap(p, "home", {
    kpiVolume: p.getByText("Volume originado", { exact: true }),
    kpiCaixa: p.getByText("Caixa livre", { exact: true }),
    leitura: p.getByText("Resultado após risco exige revisão"),
    decisoes: p.getByText("Decisões de maior impacto"),
    decidirGZ: p.getByRole("button", { name: /Decidir/ }).nth(1),
    radar: p.getByText("Radar ao vivo"),
    tabScore: p.getByText("Score", { exact: true }),
    novaOperacao: p.getByText("Nova operação"),
    fab: p.locator('[aria-label*="Copiloto" i]'),
  });
  await p.getByText("Score", { exact: true }).first().click();
  await p.waitForTimeout(1200);
  await snap(p, "home-score", {
    scoreCarteira: p.getByText("Score da carteira"),
    scoreInterno: p.getByText("Score interno", { exact: true }),
    rede: p.getByText("Rede Clínica Integra").last(),
  });

  // Copiloto: painel aberto, resposta e detalhes com evidências.
  await p.locator('[aria-label*="Copiloto" i]').first().click();
  await p.waitForTimeout(1600);
  await snap(p, "cop-open", { textarea: p.locator('textarea[aria-label="Mensagem para o Copiloto"]'), chip: p.getByText("Quais títulos estão vencidos?"), panel: p.locator('section[aria-label="Copiloto STRATO"]') }, false);
  await p.locator('textarea[aria-label="Mensagem para o Copiloto"]').fill("Quais títulos estão vencidos?");
  await p.keyboard.press("Enter");
  await p.waitForTimeout(4500);
  await snap(p, "cop-answer", { verMais: p.getByText("Ver mais").last(), panel: p.locator('section[aria-label="Copiloto STRATO"]') }, false);
  await p.mouse.click(1188, 704);
  await p.waitForTimeout(2200);
  await p.evaluate(() => {
    for (const el of document.querySelectorAll("*")) if (el.childNodes.length === 1 && /Resposta local da sessão atual/.test(el.textContent ?? "")) el.style.visibility = "hidden";
  });
  await snap(p, "cop-report", { tabs: p.getByText("Dados e fontes"), table: p.getByText("Entidade", { exact: true }) }, false);
  await p.close();

  // Operação GZ: etapas, motor (com detalhes) e análise de sacados.
  p = await enter(b);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(800);
  await p.getByRole("button", { name: /Decidir/ }).nth(1).click();
  await p.waitForTimeout(3000);
  await snap(p, "op", {
    stepper: p.getByText("ETAPA ATUAL"),
    motor: p.getByText("Motor Universal de Elegibilidade"),
    abrir: p.getByText("Abrir detalhes"),
  });
  await p.getByText("Abrir detalhes").first().click();
  await p.waitForTimeout(1500);
  await snap(p, "op-motor", {
    motor: p.getByText("Motor Universal de Elegibilidade"),
    avaliacoes: p.getByText("Avaliações", { exact: true }),
    excecao: p.getByText("Supermercado Haag Ltda").first(),
    alerta: p.getByText("Título NF-66420/01").first(),
    cedente: p.getByText("ANÁLISE DO CEDENTE"),
    sacados: p.getByText("SACADOS DA OPERAÇÃO"),
    sacadoCritico: p.getByText("Carlos Marco Distribuidora Ltda").first(),
    bureau: p.getByText("Consultar bureau"),
    analiseSacado: p.getByText("ANÁLISE DO SACADO"),
  });
  await p.close();

  // Módulos: páginas inteiras para rolagem.
  p = await enter(b);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(800);
  for (const [label, name] of [["Operações", "mod-operacoes"], ["Carteira", "mod-carteira"], ["Financeiro", "mod-financeiro"], ["Cadastros", "mod-cadastros"], ["Comercial", "mod-comercial"]]) {
    await p.locator(`header button[aria-label="${label}"]`).click();
    await p.waitForTimeout(2200);
    await snap(p, name, { fluxo: p.getByText("FLUXO ATUAL"), prioridades: p.getByText("PRIORIDADES DO DIA"), saldos: p.getByText("SALDOS POR CONTA") });
  }
  await p.locator('header button[aria-label="Controladoria"]').click();
  await p.waitForTimeout(1500);
  await p.locator("main").getByText(/^Auditoria/).first().click();
  await p.waitForTimeout(1500);
  await snap(p, "mod-auditoria", { trilha: p.getByText("TRILHA DE AUDITORIA") });
  await p.locator('header button[aria-label="Configurações"]').click();
  await p.waitForTimeout(1200);
  await p.locator('aside[aria-label="Menu de configurações"]').getByText("Políticas e motor", { exact: true }).click();
  await p.waitForTimeout(1500);
  await snap(p, "cfg-politicas", { matriz: p.getByText("Matriz Mestre de Elegibilidade"), regras: p.getByText("REGRAS DA POLÍTICA"), aprovada: p.getByText("Aprovada por STRATO") });
  await p.locator('aside[aria-label="Menu de configurações"]').getByText("Integrações", { exact: true }).click();
  await p.waitForTimeout(1500);
  await snap(p, "cfg-integracoes", {
    resumo: p.getByText("fontes ativas"),
    bureau: p.getByText("Bureaus de crédito"),
    protestos: p.getByText("Protestos e cartórios"),
    pep: p.getByText("PEP, sanções e compliance"),
  });
  await b.close();
  fs.writeFileSync("src/proscore/data/states.json", JSON.stringify(meta, null, 2) + "\n");
})();

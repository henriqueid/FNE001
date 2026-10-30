/**
 * Percorre o STRATO real em modo demonstração local (dados fictícios) e captura as telas do vídeo
 * "Operação de ponta a ponta": Copiloto → risco → preço → aprovação e formalização → liberação →
 * pagamento simulado no Financeiro → carteira. Nada sai do navegador local; não há serviço externo.
 *
 * Uso (com o app em http://127.0.0.1:5173):  node video/scripts/demo/capture-operation.cjs
 * Saída: video/public/demo/*.jpg e video/src/demo/captures.json (caixas dos elementos, px CSS).
 */
const { chromium } = require("playwright");
const fs = require("node:fs");
const path = require("node:path");

const ROOT = path.resolve(__dirname, "../..");
const OUT = path.join(ROOT, "public/demo");
const CSV = path.join(__dirname, "operacao-empresa-exemplo.csv");
const VIEW = { width: 1200, height: 1500 };
const RATE = "2.4598"; // taxa mensal que leva deságio + tarifas a ≈ R$ 3.600 no motor de preço

// Cedente fictício: entra no cadastro gravado no navegador, como um cadastro feito em Cadastros.
const PARTY = {
  id: "pty-exemplo", kind: "PJ", document: "98.765.432/0001-98", name: "Empresa Exemplo Ltda", tradeName: "Empresa Exemplo",
  birthOrFoundation: "2015-03-02", stateRegistration: "", email: "financeiro@empresaexemplo.invalid", phone: "",
  address: { zipCode: "", street: "", number: "", complement: "", district: "", city: "São Paulo", state: "SP" },
  contacts: [], bankAccounts: [], roles: ["cedente"],
  roleData: { cedente: { creditLimit: 500000, monthlyRate: 2.8, repId: "", contractUntil: "2027-12-31", guarantee: "Com regresso" } },
  status: "Ativo", notes: "Cadastro fictício para vídeo demonstrativo.", origin: "Cadastro", createdAt: "2026-10-30", updatedAt: "2026-10-30", history: [],
};

const captures = {};

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await chromium.launch();
  const page = await browser.newPage({ viewport: VIEW, deviceScaleFactor: 3, timezoneId: "America/Sao_Paulo" });
  const p = page;
  // Relógio fixo: mesma data-base dos títulos fictícios (prazo médio de 35 dias) em qualquer execução.
  await p.clock.setFixedTime(new Date("2026-10-30T10:00:00-03:00"));
  await p.addInitScript(party => {
    const get = Storage.prototype.getItem;
    Storage.prototype.getItem = function (key) {
      const v = get.call(this, key);
      if (key !== "strato-parties-v1") return v;
      const list = v ? JSON.parse(v) : [];
      if (!list.some(x => x.id === party.id)) list.push(party);
      return JSON.stringify(list);
    };
  }, PARTY);

  const hideFloating = () =>
    p.evaluate(() => {
      for (const el of document.querySelectorAll(".cpl-launcher, [class*=toast], [class*=nudge], [class*=decisions-pill]")) el.style.visibility = "hidden";
      for (const el of document.querySelectorAll("button")) if (/decisões aguardam você/.test(el.textContent || "")) el.style.visibility = "hidden";
    });
  /** Captura a tela visível; `targets` vira caixas (px CSS, relativas à janela). */
  const snap = async (name, targets = {}, { focus, keepFloating } = {}) => {
    if (focus) {
      await focus.scrollIntoViewIfNeeded();
      await p.evaluate(y => window.scrollBy(0, y), 0);
    }
    if (!keepFloating) await hideFloating();
    await p.waitForTimeout(350);
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      const b = await loc.first().boundingBox({ timeout: 2500 }).catch(() => null);
      boxes[k] = b ? [Math.round(b.x), Math.round(b.y), Math.round(b.width), Math.round(b.height)] : null;
    }
    await p.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 88 });
    captures[name] = { src: `demo/${name}.jpg`, width: VIEW.width, height: VIEW.height, boxes };
    console.log("✓", name, JSON.stringify(boxes));
  };
  const scrollTo = async (loc, offset = 140) => {
    await loc.first().scrollIntoViewIfNeeded();
    const b = await loc.first().boundingBox();
    if (b) await p.evaluate(dy => window.scrollBy(0, dy), b.y - offset);
    await p.waitForTimeout(300);
  };
  const main = () => p.evaluate(() => document.querySelector("main")?.innerText ?? "");

  // 0) Entrada na demonstração local.
  await p.goto("http://127.0.0.1:5173/");
  await p.getByText("Continuar na demonstração").click();
  await p.waitForTimeout(6500);
  await p.keyboard.press("Escape");
  await p.waitForTimeout(500);

  // 1) Copiloto: arquivo fictício anexado e pedido digitado. O painel é capturado como elemento.
  const dialog = p.locator("section.cpl-dialog");
  /** Rola a lista interna do Copiloto até `target` e captura o painel; caixas relativas ao painel. */
  const snapPanel = async (name, target, targets = {}) => {
    if (target) await target.first().evaluate(el => el.scrollIntoView({ block: "center" }));
    await p.waitForTimeout(400);
    const d = await dialog.boundingBox();
    const boxes = {};
    for (const [k, loc] of Object.entries(targets)) {
      const b = await loc.first().boundingBox({ timeout: 2500 }).catch(() => null);
      boxes[k] = b ? [Math.round(b.x - d.x), Math.round(b.y - d.y), Math.round(b.width), Math.round(b.height)] : null;
    }
    await dialog.screenshot({ path: `${OUT}/${name}.jpg`, type: "jpeg", quality: 90 });
    captures[name] = { src: `demo/${name}.jpg`, width: Math.round(d.width), height: Math.round(d.height), boxes };
    console.log("✓", name, Math.round(d.width), Math.round(d.height), JSON.stringify(boxes));
  };
  await p.getByLabel("Abrir Copiloto").first().click();
  await p.waitForTimeout(900);
  await p.getByText("Analisar um lote de recebíveis").click();
  await p.waitForTimeout(700);
  await p.locator("select").filter({ hasText: "GZ Transportes" }).first().selectOption({ label: "Empresa Exemplo Ltda" });
  await p.locator("input[type=file]").first().setInputFiles(CSV);
  await p.waitForTimeout(700);
  const box = p.getByLabel("Mensagem para o Copiloto");
  const fileChip = p.getByText("operacao-empresa-exemplo.csv");
  await snapPanel("c1-anexo", fileChip, { file: fileChip, input: box, analyze: p.getByRole("button", { name: "Analisar", exact: true }) });
  await box.fill("Analise esta operação e verifique o enquadramento na política.");
  await snapPanel("c2-pedido", fileChip, { file: fileChip, input: box, analyze: p.getByRole("button", { name: "Analisar", exact: true }) });
  await box.fill("");
  await p.getByRole("button", { name: "Analisar", exact: true }).click();
  await p.waitForTimeout(2600);
  await p.getByRole("button", { name: "Autorizar consulta" }).click();
  await p.waitForTimeout(2600);
  await snapPanel("c3-analise", p.getByText("Extraindo títulos"), { extract: p.getByText(/título\(s\) de \d sacado/), policy: p.getByText("Aplicando política e calculando"), received: p.getByText("Arquivos recebidos") });
  await snapPanel("c4-resposta", p.getByText(/Encontrei 0 impedimento/), { reply: p.getByText(/Encontrei 0 impedimento/), fast: p.getByText("Aprovação rápida disponível") });

  // 2) Leva a OP para a esteira e abre.
  await p.getByRole("button", { name: "Enviar e abrir OP" }).click();
  await p.waitForTimeout(2500);
  await p.keyboard.press("Escape");
  await p.getByRole("button", { name: /^Operações/ }).first().click();
  await p.waitForTimeout(2200);
  await p.getByText("Empresa Exemplo Ltda").first().click();
  await p.waitForTimeout(2500);
  await p.evaluate(() => window.scrollTo(0, 0));
  await snap("o1-risco", { stepper: p.getByText("ETAPA ATUAL").first(), header: p.locator("h1, h2").first() });
  await scrollTo(p.getByText("RESULTADO DA POLÍTICA · EXECUÇÃO VERSIONADA"));
  await snap("o2-motor", { motor: p.getByText("Motor Universal de Elegibilidade"), cedente: p.getByText("ANÁLISE DO CEDENTE") });
  await p.getByRole("button", { name: "Aprovar elegíveis", exact: true }).click();
  await p.waitForTimeout(1400);
  await p.getByRole("button", { name: /Concluir etapa e avançar/ }).first().click();
  await p.waitForTimeout(2200);

  // 3) Preço: condição comercial no motor (taxa, sem reserva, float zero).
  if (/Preço e estrutura/.test(await main())) {
    await p.getByRole("button", { name: "Editar condição comercial" }).click();
    await p.waitForTimeout(700);
    const field = async (label, v) => {
      const f = p.locator("label", { hasText: new RegExp("^\\s*" + label, "i") }).locator("input").first();
      await f.fill(String(v));
      await f.press("Tab");
    };
    await field("Taxa mensal", RATE);
    await field("Float", "0");
    await field("Garantia / reserva", "0");
    await p.getByRole("button", { name: "Salvar condição comercial" }).last().click();
    await p.waitForTimeout(1500);
    await p.getByRole("button", { name: /Concluir etapa e avançar/ }).first().click();
    await p.waitForTimeout(2200);
  }

  // 4) Aprovação e formalização: contexto para a decisão humana.
  await p.evaluate(() => window.scrollTo(0, 0));
  await scrollTo(p.getByText("ANÁLISE FINAL DA OPERAÇÃO"), 110);
  await snap("a1-contexto", {
    final: p.getByText("Contexto completo para a decisão humana"),
    liquido: p.getByText("VALOR LÍQUIDO").first(),
    score: p.getByText("SCORE INTERNO").first(),
    sacados: p.getByText("Principais concentrações da operação"),
  });
  await scrollTo(p.getByText("EXCEÇÕES E ALERTAS"), 110);
  await snap("a2-decisao", { approve: p.getByRole("button", { name: "Aprovar operação" }), alerts: p.getByText("EXCEÇÕES E ALERTAS") });
  // Alçadas de crédito e final (na demonstração, o mesmo usuário registra cada decisão).
  for (let i = 0; i < 3; i++) {
    const al = p.getByRole("button", { name: "Aprovar", exact: true });
    if (!(await al.count())) break;
    await al.first().click();
    await p.waitForTimeout(900);
  }
  await scrollTo(p.getByText("EXCEÇÕES E ALERTAS"), 110);
  await p.getByRole("button", { name: "Aprovar operação" }).click();
  await p.waitForTimeout(1400);
  await snap("a3-aprovada", { approve: p.getByRole("button", { name: "Aprovar operação" }), feedback: p.getByText(/Operação aprovada\. O pacote/) });
  await scrollTo(p.getByText("PRONTIDÃO").first(), 110);
  await snap("a4-formalizacao", { strip: p.getByText("PRONTIDÃO").first(), docs: p.getByText("Pacote de formalização"), signatures: p.getByText("Partes e andamento") });
  for (let i = 0; i < 3; i++) {
    const m = p.getByRole("button", { name: "Marcar como assinado manualmente" });
    if (!(await m.count())) break;
    await m.first().click();
    await p.waitForTimeout(600);
    await p.getByRole("button", { name: "Confirmar assinatura manual" }).click();
    await p.waitForTimeout(1300);
  }

  // 5) Liberação: favorecido fictício, conferências e envio ao financeiro.
  await p.evaluate(() => window.scrollTo(0, 0));
  await p.waitForTimeout(500);
  await snap("l1-pronta", { status: p.getByText("Pronta para liberar"), stepper: p.getByText("ETAPA ATUAL").first(), aprovacao: p.getByText("Orquestrador FNE001").first() });
  const inp = name => p.locator("main label", { hasText: new RegExp("^" + name) }).locator("input").first();
  await inp("Banco").fill("000");
  await inp("Agência").fill("0001");
  await inp("Conta").fill("12345-6");
  await p.keyboard.press("Tab");
  await p.locator("main h1, main h2").first().click();
  await p.waitForTimeout(600);
  await scrollTo(p.getByText("VALOR A LIBERAR"), 120);
  await snap("l2-liberacao", { liquido: p.getByText("LÍQUIDO DO BORDERÔ").first(), valor: p.getByText("VALOR A LIBERAR"), composicao: p.getByText("COMPOSIÇÃO DO LÍQUIDO").first(), conferencia: p.getByText("CONFERÊNCIA E ENVIO") });
  for (const nm of ["Concluir preparação", "Liberar para o financeiro"]) {
    const bt = p.getByRole("button", { name: new RegExp(nm) });
    if (await bt.count()) {
      await bt.first().click();
      await p.waitForTimeout(1500);
    }
  }

  // 6) Financeiro: pagamento registrado no livro local da demonstração.
  await p.getByRole("button", { name: /^Financeiro/ }).first().click();
  await p.waitForTimeout(2500);
  await p.locator("button, [role=tab]", { hasText: "Liberações de operações" }).first().click();
  await p.waitForTimeout(2000);
  const row = p.locator("tr", { hasText: "Empresa Exemplo" }).first();
  await scrollTo(row, 260);
  await snap("f1-liberacoes", { row, pay: row.getByRole("button", { name: "Pagar" }) });
  await row.getByRole("button", { name: "Pagar" }).click();
  await p.waitForTimeout(1200);
  await p.getByRole("button", { name: /Confirmar pagamento/ }).click();
  await p.waitForTimeout(1800);
  await scrollTo(p.locator("tr", { hasText: "Empresa Exemplo" }).first(), 260);
  await snap("f2-pago", { row: p.locator("tr", { hasText: "Empresa Exemplo" }).first(), paid: p.getByText(/pagos de R\$/) });

  // 7) Carteira com os 12 títulos e a linha do tempo da operação.
  await p.getByRole("button", { name: /^Carteira/ }).first().click();
  await p.waitForTimeout(2500);
  await p.locator("button, [role=tab]", { hasText: /^Por cedente/ }).first().click();
  await p.waitForTimeout(1500);
  const ced = p.getByText("Empresa Exemplo Ltda").first();
  if (await ced.count()) await scrollTo(ced, 300);
  await snap("k1-cedentes", { cedente: p.getByText("Empresa Exemplo Ltda"), row: p.locator("tr", { hasText: "Empresa Exemplo Ltda" }) });
  if (await ced.count()) { await ced.click(); await p.waitForTimeout(1500); }
  await snap("k2-cedente", { cedente: p.getByText("Empresa Exemplo Ltda") });
  console.log("CARTEIRA>>", (await main()).slice(0, 2500).replace(/\n/g, " | "));
  fs.mkdirSync(path.join(ROOT, "src/demo"), { recursive: true });
  fs.writeFileSync(path.join(ROOT, "src/demo/captures.json"), JSON.stringify(captures, null, 2) + "\n");
  await browser.close();
})();

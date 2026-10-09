/**
 * Implantação do financeiro: estado de demonstração gerado pelo próprio motor, inclusão de contas e categorias.
 */
import { transfer } from "./banking";
import { type Result, addDays, emptyState, nextId, openingEntries, run, todayIso } from "./ledger";
import { chartWithBanks, withBankLedgers, type FinanceState } from "./model";
import { type StatementInput, autoReconcile, importStatement } from "./reconciliation";
import { createTitle } from "./titles";

export function seedFinance(today = todayIso()): FinanceState {
  const opening = addDays(today, -28);
  let s = openingEntries(emptyState(opening));
  const by = "Implantação";
  const apply = (r: Result) => {
    if (r.error) throw new Error(r.error);
    s = r.state;
  };
  const fomento = "Lastro Fomento Mercantil",
    orbita = "Órbita Securitizadora S.A.",
    prime = "Lastro Prime FIDC · Classe Sênior",
    aurora = "Aurora Recebíveis FIDC · Classe Única";
  // pagas no período
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Aluguel da sede",
        counterparty: "Imobiliária Pinheiro Ltda",
        categoryId: "cat-aluguel",
        company: fomento,
        competenceDate: addDays(today, -24),
        dueDate: addDays(today, -19),
        amount: 9_800,
      },
      by,
      { accountId: "cb-1", date: addDays(today, -19), method: "Boleto" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Folha de pagamento",
        counterparty: "Colaboradores",
        categoryId: "cat-pessoal",
        company: fomento,
        competenceDate: addDays(today, -25),
        dueDate: addDays(today, -23),
        amount: 64_300,
      },
      by,
      { accountId: "cb-1", date: addDays(today, -23), method: "Folha" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Licença do sistema",
        counterparty: "Strato Tecnologia",
        categoryId: "cat-sistemas",
        company: fomento,
        competenceDate: addDays(today, -20),
        dueDate: addDays(today, -15),
        amount: 4_900,
      },
      by,
      { accountId: "cb-1", date: addDays(today, -15), method: "PIX" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Custas de protesto",
        counterparty: "1º Tabelionato de Protesto",
        categoryId: "cat-cartorio",
        company: fomento,
        competenceDate: addDays(today, -9),
        dueDate: addDays(today, -9),
        amount: 1_260,
      },
      by,
      { accountId: "cb-1", date: addDays(today, -9), method: "PIX" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Tarifas de cobrança",
        counterparty: "Sicredi",
        categoryId: "cat-tarifa-banco",
        company: fomento,
        competenceDate: addDays(today, -5),
        dueDate: addDays(today, -5),
        amount: 742.4,
      },
      by,
      { accountId: "cb-1", date: addDays(today, -5), method: "Débito em conta" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Honorários contábeis",
        counterparty: "Contabilidade Alfa",
        categoryId: "cat-terceiros",
        company: orbita,
        competenceDate: addDays(today, -18),
        dueDate: addDays(today, -12),
        amount: 3_600,
      },
      by,
      { accountId: "cb-3", date: addDays(today, -12), method: "PIX" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Taxa de custódia",
        counterparty: "Custodiante Nexus",
        categoryId: "cat-terceiros",
        company: prime,
        competenceDate: addDays(today, -16),
        dueDate: addDays(today, -10),
        amount: 12_400,
      },
      by,
      { accountId: "cb-4", date: addDays(today, -10), method: "TED" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Receber",
        description: "Juros de mora · liquidações em atraso",
        counterparty: "Diversos sacados",
        categoryId: "cat-mora",
        company: fomento,
        competenceDate: addDays(today, -11),
        dueDate: addDays(today, -11),
        amount: 2_318.6,
      },
      by,
      { accountId: "cb-2", date: addDays(today, -11), method: "Retorno CNAB" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Receber",
        description: "Rendimento de aplicação automática",
        counterparty: "BTG Pactual",
        categoryId: "cat-financeira",
        company: prime,
        competenceDate: addDays(today, -3),
        dueDate: addDays(today, -3),
        amount: 6_912.3,
      },
      by,
      { accountId: "cb-4", date: addDays(today, -3), method: "Crédito em conta" },
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Receber",
        description: "Tarifa de cadastro de cedente",
        counterparty: "Distribuidora Nova Serra",
        categoryId: "cat-tarifas",
        company: orbita,
        competenceDate: addDays(today, -7),
        dueDate: addDays(today, -7),
        amount: 1_500,
      },
      by,
      { accountId: "cb-3", date: addDays(today, -7), method: "PIX" },
    ),
  );
  // em aberto
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Aluguel da sede",
        counterparty: "Imobiliária Pinheiro Ltda",
        categoryId: "cat-aluguel",
        company: fomento,
        competenceDate: addDays(today, 2),
        dueDate: addDays(today, 11),
        amount: 9_800,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Folha de pagamento",
        counterparty: "Colaboradores",
        categoryId: "cat-pessoal",
        company: fomento,
        competenceDate: addDays(today, 1),
        dueDate: addDays(today, 7),
        amount: 64_300,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "ISS sobre tarifas",
        counterparty: "Prefeitura Municipal",
        categoryId: "cat-tributos",
        company: fomento,
        competenceDate: addDays(today, -2),
        dueDate: addDays(today, 12),
        amount: 2_140,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "PIS e COFINS do mês",
        counterparty: "Receita Federal",
        categoryId: "cat-tributos",
        company: fomento,
        competenceDate: addDays(today, -1),
        dueDate: addDays(today, 24),
        amount: 18_760,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Consultas de crédito",
        counterparty: "Birô de Crédito S.A.",
        categoryId: "cat-terceiros",
        company: orbita,
        competenceDate: addDays(today, -4),
        dueDate: addDays(today, -1),
        amount: 2_870,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Taxa de administração do fundo",
        counterparty: "Adm. Fiduciário Orbe",
        categoryId: "cat-terceiros",
        company: prime,
        competenceDate: addDays(today, 0),
        dueDate: addDays(today, 5),
        amount: 21_300,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Pagar",
        description: "Taxa de gestão",
        counterparty: "Gestora Atlas",
        categoryId: "cat-terceiros",
        company: aurora,
        competenceDate: addDays(today, 0),
        dueDate: addDays(today, 5),
        amount: 17_900,
      },
      by,
    ),
  );
  apply(
    createTitle(
      s,
      {
        kind: "Receber",
        description: "Tarifa de aditivo contratual",
        counterparty: "Alimentos Horizonte S.A.",
        categoryId: "cat-tarifas",
        company: aurora,
        competenceDate: addDays(today, -1),
        dueDate: addDays(today, 3),
        amount: 2_400,
      },
      by,
    ),
  );
  // transferência e conciliação de parte dos movimentos
  apply(
    transfer(
      s,
      { from: "cb-2", to: "cb-1", date: addDays(today, -4), amount: 120_000, description: "Resgate da conta cobrança" },
      by,
    ),
  );
  // extrato bancário (OFX) de demonstração: bate com o sistema, com algumas diferenças para conciliar
  const bankLines: StatementInput[] = s.movements
    .filter(m => m.kind !== "Estorno")
    .map((m, i) => ({
      fitid: `SEED${String(i + 1).padStart(4, "0")}`,
      date: m.date <= addDays(today, -8) ? m.date : addDays(m.date, 1),
      amount: m.amount,
      memo: m.description.split(" · ")[0].toUpperCase().slice(0, 32),
    }));
  bankLines.forEach(l => {
    if (l.memo.startsWith("TAXA DE CUST")) {
      l.amount = -12_436.2;
      l.memo = "TED TAXA CUSTODIA + TARIFA";
    }
  });
  const byAccount = (id: string) =>
    bankLines.filter((_, i) => s.movements.filter(m => m.kind !== "Estorno")[i].accountId === id);
  const extras: Record<string, StatementInput[]> = {
    "cb-1": [
      { fitid: "SEEDX01", date: addDays(today, -2), amount: -38.9, memo: "TARIFA PACOTE SERVICOS" },
      { fitid: "SEEDX02", date: addDays(today, -1), amount: 4_850, memo: "PIX RECEBIDO 33907118000157" },
    ],
    "cb-3": [{ fitid: "SEEDX03", date: addDays(today, -3), amount: -12.4, memo: "TARIFA TED" }],
    "cb-4": [{ fitid: "SEEDX04", date: addDays(today, -1), amount: 1_204.55, memo: "RENDIMENTO APLIC AUTOMATICA" }],
  };
  s.accounts.forEach(a => {
    s = importStatement(s, a.id, [...byAccount(a.id), ...(extras[a.id] ?? [])], `extrato-${a.bankCode}.ofx`, by).state;
  });
  s.accounts.forEach(a => {
    s = autoReconcile(s, a.id, by, { upTo: addDays(today, -8) }).state;
  });
  return s;
}

export function addChartAccount(
  state: FinanceState,
  account: { code: string; name: string; nature: FinanceState["chart"][number]["nature"] },
): Result {
  return run(state, d => {
    const code = account.code.trim();
    if (!/^\d+(\.\d+)*$/.test(code)) throw new Error("Use um código numérico no padrão 5.1.10.");
    if (d.chart.some(c => c.code === code)) throw new Error("Já existe uma conta com esse código.");
    const parent = code.split(".").slice(0, -1).join(".");
    if (parent && !d.chart.some(c => c.code === parent || (code.startsWith(`${c.code}.`) && !c.analytic)))
      throw new Error(`A conta sintética ${parent} não existe.`);
    if (!account.name.trim()) throw new Error("Informe o nome da conta.");
    d.chart = [...d.chart, { code, name: account.name.trim(), nature: account.nature, analytic: true }].sort((a, b) =>
      a.code.localeCompare(b.code, "pt-BR", { numeric: true }),
    );
    return { message: `Conta ${code} criada.` };
  });
}

export function addCategory(
  state: FinanceState,
  category: { name: string; kind: "Receita" | "Despesa"; ledgerCode: string; group: string },
): Result {
  return run(state, d => {
    if (!category.name.trim()) throw new Error("Informe o nome da categoria.");
    const ledger = d.chart.find(c => c.code === category.ledgerCode && c.analytic);
    if (!ledger) throw new Error("Escolha uma conta contábil analítica.");
    if (ledger.nature !== category.kind)
      throw new Error(`A conta ${ledger.code} é de ${ledger.nature.toLowerCase()}, não combina com a categoria.`);
    d.categories = [
      ...d.categories,
      {
        id: nextId(d, "CAT"),
        name: category.name.trim(),
        kind: category.kind,
        ledgerCode: category.ledgerCode,
        group: category.group.trim() || "Outras",
      },
    ];
    return { message: "Categoria criada." };
  });
}

export function ensureChart(input: FinanceState): FinanceState {
  const state = input.statement ? input : { ...input, statement: [] };
  if (state.chartOrigin === "importado") {
    const chart = withBankLedgers(state.chart, state.accounts);
    return chart === state.chart ? state : { ...state, chart };
  }
  const merged = chartWithBanks(state.accounts);
  const missing = merged.filter(c => !state.chart.some(x => x.code === c.code));
  return missing.length
    ? {
        ...state,
        chart: [...state.chart, ...missing].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true })),
      }
    : state;
}

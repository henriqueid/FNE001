// Importação do plano de contas no leiaute padrão Strato (CSV).
// Fluxo: ler o arquivo → validar a hierarquia → montar o de-para das contas em uso → aplicar.
// Nada é apagado: ao substituir o plano, os lançamentos são reclassificados e guardam a conta original.

import {
  ledgerRoles,
  modelChart,
  nowStamp,
  roleLedger,
  sortChart,
  type AccountNature,
  type ChartAccount,
  type FinanceState,
  type LedgerRole,
} from "./model";

export const CHART_COLUMNS = [
  "codigo",
  "descricao",
  "natureza",
  "tipo",
  "codigo_reduzido",
  "conta_referencial",
] as const;

export type ChartIssue = { line: number; code?: string; message: string };
export type ParsedChart = { accounts: ChartAccount[]; errors: ChartIssue[]; warnings: ChartIssue[]; lines: number };
export type ImportMode = "substituir" | "acrescentar";

const plain = (v: string) =>
  v
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();

function natureOf(raw: string): AccountNature | undefined | null {
  const v = plain(raw)
    .replace(/[^a-z0-9 ]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
  if (!v) return undefined; // vazio: herda da conta superior
  if (["ativo", "a", "1", "01"].includes(v)) return "Ativo";
  if (["passivo", "p", "2", "02"].includes(v)) return "Passivo";
  if (["patrimonio liquido", "pl", "patrimonio", "3", "03"].includes(v)) return "Patrimônio líquido";
  if (["receita", "receitas", "r", "4"].includes(v)) return "Receita";
  if (["despesa", "despesas", "custo", "custos", "d", "5"].includes(v)) return "Despesa";
  return null; // não reconhecida
}

function typeOf(raw: string): boolean | undefined | null {
  const v = plain(raw);
  if (!v) return undefined; // vazio: deduz pela hierarquia
  if (["a", "analitica", "analitico", "an"].includes(v)) return true;
  if (["s", "sintetica", "sintetico", "t", "titulo", "grupo"].includes(v)) return false;
  return null;
}

function splitCsv(line: string, sep: string) {
  const out: string[] = [];
  let cur = "",
    quoted = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') {
        cur += '"';
        i++;
      } else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === sep) {
      out.push(cur);
      cur = "";
    } else cur += ch;
  }
  out.push(cur);
  return out.map(v => v.trim());
}

const parentOf = (code: string) => code.split(".").slice(0, -1).join(".");

/** Lê o CSV (separador ; , ou tab, com ou sem cabeçalho) e valida a estrutura do plano. */
export function parseChartCsv(text: string): ParsedChart {
  const errors: ChartIssue[] = [],
    warnings: ChartIssue[] = [];
  const raw = text
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .map((l, i) => ({ n: i + 1, text: l }))
    .filter(l => l.text.trim());
  if (!raw.length) return { accounts: [], errors: [{ line: 0, message: "O arquivo está vazio." }], warnings, lines: 0 };
  const sep = [";", "\t", ","].map(s => ({ s, n: raw[0].text.split(s).length })).sort((a, b) => b.n - a.n)[0].s;
  const first = splitCsv(raw[0].text, sep).map(h =>
    plain(h)
      .replace(/[^a-z_ ]/g, "")
      .replace(/\s+/g, "_"),
  );
  const hasHeader = first.some(h => h.startsWith("codigo") || h.startsWith("descri") || h === "conta");
  const find = (...names: string[]) => first.findIndex(h => names.some(n => h === n || h.startsWith(n)));
  const col = hasHeader
    ? {
        code: first.findIndex(h => (h.startsWith("codigo") && !h.includes("reduz")) || h === "conta"),
        name: find("descricao", "nome"),
        nature: find("natureza"),
        type: find("tipo"),
        short: find("codigo_reduzido", "reduzido"),
        ref: find("conta_referencial", "referencial"),
      }
    : { code: 0, name: 1, nature: 2, type: 3, short: 4, ref: 5 };
  if (col.code < 0 || col.name < 0)
    return {
      accounts: [],
      errors: [{ line: 1, message: "O cabeçalho precisa ter as colunas codigo e descricao." }],
      warnings,
      lines: 0,
    };

  type Row = {
    line: number;
    code: string;
    name: string;
    nature?: AccountNature;
    analytic?: boolean;
    shortCode?: string;
    referential?: string;
  };
  const rows: Row[] = [];
  const seen = new Map<string, number>();
  (hasHeader ? raw.slice(1) : raw).forEach(({ n, text: t }) => {
    const cells = splitCsv(t, sep);
    const get = (i: number) => (i >= 0 ? (cells[i] ?? "") : "");
    const code = get(col.code)
      .replace(/[-/\s]/g, ".")
      .replace(/\.+/g, ".")
      .replace(/^\.|\.$/g, "");
    const name = get(col.name);
    if (!code && !name) return;
    if (!code) {
      errors.push({ line: n, message: "Linha sem código." });
      return;
    }
    if (!/^\d+(\.\d+)*$/.test(code)) {
      errors.push({ line: n, code, message: "Código inválido. Use só números separados por ponto, como 1.1.2.01." });
      return;
    }
    if (!name) errors.push({ line: n, code, message: "Conta sem descrição." });
    if (seen.has(code)) {
      errors.push({ line: n, code, message: `Código repetido (já aparece na linha ${seen.get(code)}).` });
      return;
    }
    seen.set(code, n);
    const nature = natureOf(get(col.nature));
    if (nature === null)
      errors.push({
        line: n,
        code,
        message: `Natureza "${get(col.nature)}" não reconhecida. Use Ativo, Passivo, Patrimônio líquido, Receita ou Despesa.`,
      });
    const analytic = typeOf(get(col.type));
    if (analytic === null)
      errors.push({
        line: n,
        code,
        message: `Tipo "${get(col.type)}" não reconhecido. Use S (sintética) ou A (analítica).`,
      });
    rows.push({
      line: n,
      code,
      name,
      nature: nature ?? undefined,
      analytic: analytic ?? undefined,
      shortCode: get(col.short) || undefined,
      referential: get(col.ref) || undefined,
    });
  });

  const byCode = new Map(rows.map(r => [r.code, r]));
  const sorted = [...rows].sort((a, b) => a.code.localeCompare(b.code, "pt-BR", { numeric: true }));
  const ancestor = (code: string) => {
    let p = parentOf(code);
    while (p) {
      const r = byCode.get(p);
      if (r) return r;
      p = parentOf(p);
    }
    return undefined;
  };
  const hasChildren = (code: string) => rows.some(r => r.code.startsWith(`${code}.`));
  const accounts: ChartAccount[] = [];
  let inferredNature = 0,
    inferredType = 0;
  sorted.forEach(r => {
    const up = ancestor(r.code);
    if (r.code.includes(".") && !up)
      errors.push({
        line: r.line,
        code: r.code,
        message: `Não existe conta superior para ${r.code}. Inclua o grupo ${parentOf(r.code)} (ou outro nível acima) como sintético.`,
      });
    if (up && up.analytic === true)
      errors.push({
        line: r.line,
        code: r.code,
        message: `A conta superior ${up.code} está marcada como analítica, mas tem subcontas. Marque-a como S.`,
      });
    const children = hasChildren(r.code);
    if (r.analytic === true && children)
      errors.push({ line: r.line, code: r.code, message: "Conta marcada como analítica, mas tem subcontas." });
    const analytic = r.analytic ?? !children;
    if (r.analytic === undefined) inferredType++;
    let nature = r.nature;
    if (!nature) {
      nature = up ? (accounts.find(a => a.code === up.code)?.nature ?? up.nature) : undefined;
      if (!nature)
        errors.push({
          line: r.line,
          code: r.code,
          message: "Informe a natureza: a conta não tem conta superior de onde herdar.",
        });
      else inferredNature++;
    } else if (up) {
      const upNature = accounts.find(a => a.code === up.code)?.nature ?? up.nature;
      if (upNature && upNature !== nature)
        warnings.push({
          line: r.line,
          code: r.code,
          message: `Natureza ${nature} diferente da conta superior ${up.code} (${upNature}).`,
        });
    }
    if (!analytic && !children)
      warnings.push({ line: r.line, code: r.code, message: "Grupo sintético sem nenhuma subconta." });
    accounts.push({
      code: r.code,
      name: r.name,
      nature: nature ?? "Ativo",
      analytic,
      ...(r.shortCode ? { shortCode: r.shortCode } : {}),
      ...(r.referential ? { referential: r.referential } : {}),
    });
  });
  if (rows.length && !accounts.some(a => a.analytic))
    errors.push({ line: 0, message: "O plano não tem nenhuma conta analítica." });
  if (inferredNature)
    warnings.push({
      line: 0,
      message: `${inferredNature} conta(s) sem natureza herdaram a natureza da conta superior.`,
    });
  if (inferredType)
    warnings.push({
      line: 0,
      message: `${inferredType} conta(s) sem tipo: sintética quando tem subcontas, analítica quando não tem.`,
    });
  return { accounts, errors: errors.sort((a, b) => a.line - b.line), warnings, lines: rows.length };
}

/** Modelo para baixar (ou exportação do plano atual) no leiaute padrão. */
export function chartToCsv(chart: ChartAccount[] = modelChart) {
  const esc = (v: string) => (/[;"\n]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  const body = chart.map(c =>
    [c.code, c.name, c.nature, c.analytic ? "A" : "S", c.shortCode ?? "", c.referential ?? ""].map(esc).join(";"),
  );
  return `\uFEFF${CHART_COLUMNS.join(";")}\n${body.join("\n")}\n`;
}

export type MappingUse = { kind: "role" | "banco" | "categoria" | "lancamentos" | "titulos"; label: string };
export type MappingRow = {
  from: string;
  fromName: string;
  nature: AccountNature;
  analytic: boolean;
  uses: MappingUse[];
  suggestion: string;
  how: "mesmo código" | "mesmo nome" | "nome parecido" | "";
};

const words = (v: string) =>
  plain(v)
    .replace(/[^a-z0-9 ]/g, " ")
    .split(/\s+/)
    .filter(w => w.length > 2 && !["das", "dos", "com", "para", "por", "sem"].includes(w));

function suggest(
  target: ChartAccount[],
  from: ChartAccount | undefined,
  code: string,
  nature: AccountNature,
  analytic: boolean,
): Pick<MappingRow, "suggestion" | "how"> {
  const pool = target.filter(c => c.analytic === analytic && c.nature === nature);
  const same = pool.find(
    c =>
      c.code === code &&
      (!from || plain(c.name) === plain(from.name) || words(c.name).some(w => words(from.name).includes(w))),
  );
  if (same) return { suggestion: same.code, how: "mesmo código" };
  if (!from) return { suggestion: "", how: "" };
  const exact = pool.find(c => plain(c.name) === plain(from.name));
  if (exact) return { suggestion: exact.code, how: "mesmo nome" };
  const fw = words(from.name);
  const scored = pool
    .map(c => {
      const cw = words(c.name);
      const hit = cw.filter(w => fw.includes(w)).length;
      return { c, score: hit / Math.max(fw.length, cw.length, 1) };
    })
    .sort((a, b) => b.score - a.score);
  if (scored[0] && scored[0].score >= 0.5) return { suggestion: scored[0].c.code, how: "nome parecido" };
  const byCode = pool.find(c => c.code === code);
  return byCode ? { suggestion: byCode.code, how: "mesmo código" } : { suggestion: "", how: "" };
}

/** Lista as contas do plano atual que estão em uso (contas-chave, bancos, categorias, lançamentos) e sugere a conta nova de cada uma. */
export function buildMapping(state: FinanceState, target: ChartAccount[]): MappingRow[] {
  const uses = new Map<string, MappingUse[]>();
  const add = (code: string, use: MappingUse) => {
    const l = uses.get(code) ?? [];
    if (!l.some(u => u.kind === use.kind && u.label === use.label)) l.push(use);
    uses.set(code, l);
  };
  ledgerRoles.forEach(r => add(roleLedger(state, r.key), { kind: "role", label: r.label }));
  state.accounts.forEach(a => add(a.ledgerCode, { kind: "banco", label: a.nickname }));
  state.categories.forEach(c => add(c.ledgerCode, { kind: "categoria", label: c.name }));
  const count = new Map<string, number>();
  state.journal.forEach(j => j.lines.forEach(l => count.set(l.ledger, (count.get(l.ledger) ?? 0) + 1)));
  count.forEach((n, code) => add(code, { kind: "lancamentos", label: `${n} lançamento(s)` }));
  const openTitles = new Map<string, number>();
  state.titles
    .filter(t => t.status === "Em aberto")
    .forEach(t => openTitles.set(t.settlementLedger, (openTitles.get(t.settlementLedger) ?? 0) + 1));
  openTitles.forEach((n, code) => add(code, { kind: "titulos", label: `${n} título(s) em aberto` }));
  const rows: MappingRow[] = [...uses.entries()]
    .map(([code, u]) => {
      const from = state.chart.find(c => c.code === code);
      const role = ledgerRoles.find(
        r => roleLedger(state, r.key) === code && u.some(x => x.kind === "role" && x.label === r.label),
      );
      const nature = from?.nature ?? role?.nature ?? "Ativo";
      const analytic = from?.analytic ?? role?.analytic ?? true;
      return {
        from: code,
        fromName: from?.name ?? role?.label ?? code,
        nature,
        analytic,
        uses: u,
        ...suggest(target, from, code, nature, analytic),
      };
    })
    .sort((a, b) => a.from.localeCompare(b.from, "pt-BR", { numeric: true }));
  // Bancos: casar pelo nome do banco ou pelo número da conta, sem repetir a mesma conta contábil.
  const taken = new Set(
    rows.filter(r => r.suggestion && !state.accounts.some(a => a.ledgerCode === r.from)).map(r => r.suggestion),
  );
  state.accounts.forEach(bank => {
    const row = rows.find(r => r.from === bank.ledgerCode);
    if (!row || row.how === "mesmo código" || row.how === "mesmo nome") {
      if (row?.suggestion) taken.add(row.suggestion);
      return;
    }
    const digits = bank.account.replace(/\D/g, "");
    const bankWord =
      plain(bank.bankName)
        .split(" ")
        .find(w => w.length > 2 && w !== "banco") ?? bank.bankCode;
    const pool = target.filter(c => c.analytic && c.nature === "Ativo" && !taken.has(c.code));
    const hit =
      pool.find(c => digits.length >= 4 && c.name.replace(/\D/g, "").includes(digits.slice(0, -1))) ??
      pool.find(c => plain(c.name).includes(plain(bank.nickname))) ??
      pool.find(
        c =>
          plain(c.name)
            .split(/[^a-z0-9]+/)
            .includes(bankWord) || c.name.includes(bank.bankCode),
      );
    if (hit) {
      row.suggestion = hit.code;
      row.how = "nome parecido";
      taken.add(hit.code);
    }
  });
  // Grupo das contas bancárias: a conta sintética que reúne os bancos sugeridos.
  const group = rows.find(r => r.from === roleLedger(state, "bankGroup"));
  if (group && !group.suggestion) {
    const parents = state.accounts
      .map(a => rows.find(r => r.from === a.ledgerCode)?.suggestion)
      .filter(Boolean)
      .map(c => parentOf(c!));
    const common =
      parents.length && parents.every(p => p === parents[0])
        ? target.find(c => c.code === parents[0] && !c.analytic && c.nature === "Ativo")
        : undefined;
    if (common) {
      group.suggestion = common.code;
      group.how = "nome parecido";
    }
  }
  return rows;
}

export function mappingProblems(
  state: FinanceState,
  target: ChartAccount[],
  rows: MappingRow[],
  mapping: Record<string, string>,
) {
  const problems: string[] = [];
  rows.forEach(r => {
    const to = mapping[r.from];
    const acc = target.find(c => c.code === to);
    if (!to) problems.push(`${r.from} ${r.fromName}: escolha a conta nova.`);
    else if (!acc) problems.push(`${r.from}: a conta ${to} não existe no plano importado.`);
    else if (acc.analytic !== r.analytic)
      problems.push(`${r.from}: a conta ${to} precisa ser ${r.analytic ? "analítica" : "sintética"}.`);
    else if (acc.nature !== r.nature)
      problems.push(`${r.from}: a conta ${to} é de ${acc.nature}, a atual é de ${r.nature}.`);
  });
  const bankTargets = new Map<string, string>();
  state.accounts.forEach(a => {
    const to = mapping[a.ledgerCode];
    if (!to) return;
    const other = bankTargets.get(to);
    if (other && other !== a.ledgerCode)
      problems.push(`Duas contas bancárias apontam para ${to}. Cada banco precisa da sua conta contábil.`);
    bankTargets.set(to, a.ledgerCode);
  });
  return [...new Set(problems)];
}

export type ChartImportResult = { state: FinanceState; error?: string; message?: string };

export function applyChartImport(
  state: FinanceState,
  input: { accounts: ChartAccount[]; mode: ImportMode; mapping: Record<string, string>; file: string },
  by: string,
): ChartImportResult {
  try {
    if (!input.accounts.length) throw new Error("Nada para importar.");
    const at = nowStamp();
    if (input.mode === "acrescentar") {
      const fresh = input.accounts.filter(a => !state.chart.some(c => c.code === a.code));
      const conflicts = input.accounts.filter(a =>
        state.chart.some(c => c.code === a.code && (c.nature !== a.nature || c.analytic !== a.analytic)),
      );
      if (!fresh.length) throw new Error("Todas as contas do arquivo já existem no plano atual.");
      const chart = sortChart([...state.chart, ...fresh]);
      const broken = fresh.filter(a => {
        const p = parentOf(a.code);
        return p && chart.some(c => c.code === p && c.analytic);
      });
      if (broken.length)
        throw new Error(
          `A conta ${parentOf(broken[0].code)} é analítica no plano atual e não pode receber subcontas (${broken[0].code}).`,
        );
      const log = { at, by, file: input.file, mode: input.mode, accounts: fresh.length, reclassified: 0 };
      return {
        state: { ...state, chart, chartImports: [...(state.chartImports ?? []), log] },
        message: `${fresh.length} conta(s) acrescentada(s)${conflicts.length ? ` · ${conflicts.length} código(s) já existiam e foram mantidos como estavam` : ""}.`,
      };
    }
    const target = sortChart(input.accounts);
    const rows = buildMapping(state, target);
    const problems = mappingProblems(state, target, rows, input.mapping);
    if (problems.length) throw new Error(problems[0]);
    const map = (code: string) => input.mapping[code] ?? code;
    let reclassified = 0;
    const journal = state.journal.map(j => {
      if (!j.lines.some(l => map(l.ledger) !== l.ledger)) return j;
      reclassified++;
      return {
        ...j,
        lines: j.lines.map(l =>
          map(l.ledger) === l.ledger
            ? l
            : { ...l, ledger: map(l.ledger), originalLedger: l.originalLedger ?? l.ledger },
        ),
      };
    });
    const roles = Object.fromEntries(ledgerRoles.map(r => [r.key, map(roleLedger(state, r.key))])) as Record<
      LedgerRole,
      string
    >;
    const next: FinanceState = {
      ...state,
      chart: target,
      roles,
      chartOrigin: "importado",
      accounts: state.accounts.map(a => ({ ...a, ledgerCode: map(a.ledgerCode) })),
      categories: state.categories.map(c => ({ ...c, ledgerCode: map(c.ledgerCode) })),
      titles: state.titles.map(t => ({ ...t, settlementLedger: map(t.settlementLedger) })),
      journal,
      chartImports: [
        ...(state.chartImports ?? []),
        { at, by, file: input.file, mode: input.mode, accounts: target.length, reclassified },
      ],
    };
    return {
      state: next,
      message: `Plano importado: ${target.length} contas${reclassified ? ` · ${reclassified} lançamento(s) reclassificado(s) pelo de-para` : ""}.`,
    };
  } catch (e) {
    return { state, error: e instanceof Error ? e.message : String(e) };
  }
}

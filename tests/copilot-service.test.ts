/** Fluxo real de resposta com fontes isoladas: cálculo completo e ausência de enriquecimento. */
import { beforeEach, describe, expect, it, vi } from "vitest";
const boundary = vi.hoisted(() => ({
  sources: vi.fn(),
  memories: vi.fn(),
  save: vi.fn(),
  provider: vi.fn(),
  read: vi.fn(),
}));
vi.mock("@/src/server/copilot/sources", () => ({ loadCopilotSources: boundary.sources }));
vi.mock("@/src/server/copilot/behavior-sources", () => ({ loadLedgerBehavior: async () => [] }));
vi.mock("@/src/server/copilot/memory-repository", () => ({
  listMemories: boundary.memories,
  saveReport: boundary.save,
  readReport: boundary.read,
}));
vi.mock("@/src/server/intelligence/budgeted-response", () => ({ createBudgetedOpenAIResponse: boundary.provider }));
import { answerCopilotQuestion } from "@/src/server/copilot/service";
import type { ServerPrincipal } from "@/src/server/access/repository";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
const principal = {
  id: "u",
  tenantId: "tenant",
  permissions: ["dashboard:view", "portfolio:manage"],
  companyScopes: ["A"],
} as ServerPrincipal;
const db = {} as DecisionDatabase;
beforeEach(() => {
  vi.clearAllMocks();
  const titles = Array.from({ length: 1501 }, (_, i) => ({
    id: String(i),
    debtorName: "Sacado",
    debtorDocument: "11111111000111",
    ownerName: "Cedente",
    ownerDocument: "22222222000122",
    reference: String(i),
    vehicle: "A",
    amount: 1,
    dueDate: "2026-10-10",
  }));
  boundary.sources.mockResolvedValue({
    knowledge: { today: "2026-10-18", titles, operations: [], cedents: [], policies: [], rules: [], parameters: {} },
    portfolio: { version: 3, titles: [], positionDate: "2026-10-17" },
    entityCompanies: new Map(titles.map(t => [`title:${t.id}`, "A"])),
  });
  boundary.memories.mockResolvedValue([]);
  boundary.save.mockResolvedValue(undefined);
});
describe("Copiloto no servidor", () => {
  it("calcula todos os títulos sem consumir IA e compartilha snapshot com resumo", async () => {
    const result = await answerCopilotQuestion(db, principal, "qual meu sacado mais concentrado?", {
      allowInterpretation: false,
    });
    expect(result.reply.report?.metrics.some(m => m.value.includes("1.501"))).toBe(true);
    expect(boundary.provider).not.toHaveBeenCalled();
    expect(boundary.save.mock.calls[0][2].table.rows[0][2]).toContain("1.501");
  });
  it("nega carteira sem permissão do módulo", async () => {
    await expect(
      answerCopilotQuestion(
        db,
        { ...principal, permissions: ["dashboard:view"] },
        "sacados com mais títulos vencidos",
        {},
      ),
    ).rejects.toThrow("Carteira");
    expect(boundary.save).not.toHaveBeenCalled();
  });
  it("bloqueia enriquecimento externo e não usa provedor como fonte", async () => {
    const result = await answerCopilotQuestion(db, principal, "pesquise na internet o CNPJ do sacado", {});
    expect(result.reply.paragraphs.join(" ")).toContain("externo");
    expect(boundary.provider).not.toHaveBeenCalled();
  });
  it("não apresenta CDI como dado conhecido quando não há conector autorizado", async () => {
    const result = await answerCopilotQuestion(db, principal, "qual o CDI de hoje?", {});
    expect(result.reply.paragraphs.join(" ")).toContain("não está configurada");
    expect(boundary.provider).not.toHaveBeenCalled();
  });
  it("não ignora o filtro de documento ao atualizar a análise", async () => {
    const result = await answerCopilotQuestion(db, principal, "maiores sacados", {
      allowInterpretation: false,
      filters: { document: "99999999000199" },
    });
    expect(result.reply.paragraphs.join(" ")).toContain("Nenhum título");
    expect(boundary.save.mock.calls[0][2].table.rows).toHaveLength(0);
  });
  it("preserva empresa e documento numa continuação", async () => {
    boundary.read.mockResolvedValue({
      queryKey: "debtor:balance:overdue",
      filters: { company: "A", document: "99999999000199" },
    });
    const result = await answerCopilotQuestion(db, principal, "e os cedentes?", {
      allowInterpretation: false,
      previousReportId: "previous",
    });
    expect(result.reply.paragraphs.join(" ")).toContain("Nenhum título");
    expect(boundary.save.mock.calls[0][2].filters).toEqual({ company: "A", document: "99999999000199" });
  });
  it("guarda a pergunta resolvida e o documento nominal para atualização", async () => {
    await answerCopilotQuestion(db, principal, "exposição do sacado 11.111.111/0001-11", {
      allowInterpretation: false,
    });
    expect(boundary.save.mock.calls[0][2].queryEntityDocument).toBe("11111111000111");
    expect(boundary.save.mock.calls[0][2].resolvedQuestion).toContain("11.111.111/0001-11");
  });
  it("pede confirmação do critério sugerido pela IA antes de apresentar números", async () => {
    boundary.provider.mockResolvedValue({
      text: '{"queryKey":"debtor:count:overdue"}',
      usage: { inputTokens: 10, outputTokens: 5, totalTokens: 15 },
    });
    const result = await answerCopilotQuestion(db, principal, "organize o panorama", { allowInterpretation: true });
    expect(result.reply.suggestedQuestions?.[0]).toContain("sacados");
    expect(result.reply.table).toBeUndefined();
    expect(result.reply.paragraphs.join(" ")).toContain("Confirme");
  });
  it("trata JSON null do interpretador como intenção desconhecida", async () => {
    boundary.provider.mockResolvedValue({ text: "null", usage: { inputTokens: 10, outputTokens: 1, totalTokens: 11 } });
    const result = await answerCopilotQuestion(db, principal, "organize o panorama", { allowInterpretation: true });
    expect(result.reply.paragraphs.join(" ")).toContain("Não identifiquei");
  });
  it("troca ou limpa documento nominal ao atualizar o snapshot", async () => {
    const sources = await boundary.sources();
    sources.knowledge.titles.push({
      ...sources.knowledge.titles[0],
      id: "other",
      debtorName: "Outro sacado",
      debtorDocument: "99999999000199",
    });
    sources.entityCompanies.set("title:other", "A");
    boundary.read.mockResolvedValue({
      queryKey: "debtor:balance:open",
      queryEntityDocument: "11111111000111",
      filters: {},
    });
    const changed = await answerCopilotQuestion(db, principal, "exposição do sacado 11111111000111", {
      allowInterpretation: false,
      refreshReportId: "previous",
      filters: { document: "99999999000199" },
    });
    expect(changed.reply.table?.rows).toHaveLength(1);
    expect(changed.reply.table?.rows[0][0]).toBe("Outro sacado");
    const cleared = await answerCopilotQuestion(db, principal, "exposição do sacado 11111111000111", {
      allowInterpretation: false,
      refreshReportId: "previous",
      filters: { document: "" },
    });
    expect(cleared.reply.table?.rows).toHaveLength(2);
  });
  it("aplica filtro de empresa também à consulta de operações", async () => {
    const sources = await boundary.sources();
    sources.knowledge.operations = [
      { id: "opA", document: "1", vehicle: "A", cedent: "Cedente A", status: "Em análise", amount: 100 },
      { id: "opB", document: "2", vehicle: "B", cedent: "Cedente B", status: "Em análise", amount: 900 },
    ];
    sources.entityCompanies.set("operation:opA", "A");
    sources.entityCompanies.set("operation:opB", "B");
    const result = await answerCopilotQuestion(
      db,
      { ...principal, companyScopes: ["A", "B"], permissions: [...principal.permissions, "operations:view"] },
      "operações",
      { allowInterpretation: false, filters: { company: "A" } },
    );
    expect(result.reply.table?.rows).toHaveLength(1);
    expect(result.reply.table?.rows[0][1]).toBe("Cedente A");
    expect(boundary.save.mock.calls[0][2].companies).toEqual(["A"]);
  });
});

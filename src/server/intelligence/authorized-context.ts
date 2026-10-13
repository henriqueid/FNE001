const MAX_CONTEXT_LENGTH = 60_000;

type JsonObject = Record<string, unknown>;

const isObject = (value: unknown): value is JsonObject =>
  typeof value === "object" && value !== null && !Array.isArray(value);

const text = (value: unknown, limit = 500) => (typeof value === "string" ? value.slice(0, limit) : "");
const number = (value: unknown) => (typeof value === "number" && Number.isFinite(value) ? value : 0);
const rows = (value: unknown, limit: number) => (Array.isArray(value) ? value.filter(isObject).slice(0, limit) : []);
const normalized = (value: string) => value.trim().toLocaleLowerCase("pt-BR");
const digits = (value: string) => value.replace(/\D/g, "");

const hasScope = (companyScopes: string[], company: string) => {
  const requested = normalized(company);
  return !!requested && companyScopes.some(scope => scope === "*" || normalized(scope) === requested);
};

/**
 * Trata o contexto enviado pelo navegador como não confiável e produz o único formato aceito pelo provedor de IA.
 * O filtro não concede acesso: ele reduz novamente os dados já obtidos pelas APIs para as empresas da sessão.
 */
export function authorizeCopilotContext(value: unknown, companyScopes: string[]) {
  const raw = JSON.stringify(value ?? {});
  if (raw.length > MAX_CONTEXT_LENGTH) throw new Error("O contexto autorizado excede o limite da conversa.");
  const source = isObject(value) ? value : {};

  const operations = rows(source.operations, 250)
    .filter(item => hasScope(companyScopes, text(item.vehicle)))
    .map(item => ({
      id: text(item.id, 120),
      cedent: text(item.cedent),
      document: text(item.document, 30),
      amount: number(item.amount),
      status: text(item.status, 120),
      stage: number(item.stage),
      vehicle: text(item.vehicle),
      institution: text(item.institution),
      blockers: number(item.blockers),
    }));

  const portfolio = rows(source.portfolio, 1_000)
    .filter(item => hasScope(companyScopes, text(item.vehicle)))
    .map(item => ({
      debtor: text(item.debtor),
      cedentDocument: text(item.cedentDocument, 30),
      amount: number(item.amount),
      dueDate: text(item.dueDate, 10),
      source: text(item.source, 120),
      vehicle: text(item.vehicle),
    }));

  const visibleDocuments = new Set([
    ...operations.map(item => digits(item.document)),
    ...portfolio.map(item => digits(item.cedentDocument)),
  ]);
  visibleDocuments.delete("");

  const cedents = rows(source.cedents, 500)
    .filter(item => visibleDocuments.has(digits(text(item.document, 30))))
    .map(item => ({
      id: text(item.id, 120),
      name: text(item.name),
      document: text(item.document, 30),
      score: number(item.score),
      creditLimit: number(item.creditLimit),
      usedLimit: number(item.usedLimit),
      settlements: number(item.settlements),
      lateSettlements: number(item.lateSettlements),
      averageDelayDays: number(item.averageDelayDays),
      repurchases: number(item.repurchases),
    }));

  const policies = rows(source.policies, 100)
    .filter(item => hasScope(companyScopes, text(item.company)))
    .map(item => ({
      id: text(item.id, 120),
      name: text(item.name),
      company: text(item.company),
      status: text(item.status, 80),
      version: text(item.version, 80),
      bindings: rows(item.bindings, 200).map(binding => ({
        ruleId: text(binding.ruleId, 120),
        enabled: binding.enabled === true,
        operator: text(binding.operator, 30),
        parameter:
          typeof binding.parameter === "number" || typeof binding.parameter === "boolean"
            ? binding.parameter
            : text(binding.parameter, 200),
        failureOutcome: text(binding.failureOutcome, 30),
        overrideAuthority: text(binding.overrideAuthority, 120),
      })),
    }));

  return {
    referenceDate: /^\d{4}-\d{2}-\d{2}$/.test(text(source.referenceDate, 10)) ? text(source.referenceDate, 10) : "",
    operations,
    cedents,
    portfolio,
    policies,
  };
}

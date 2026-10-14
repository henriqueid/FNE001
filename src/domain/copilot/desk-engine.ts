/**
 * Motor determinístico da Mesa Inteligente: calcula face, deságio, tarifas, IOF, líquido e custo efetivo de um
 * cenário, aplica as regras da política de mesa (duplicidade, sacado sem consulta, concentração, piso de taxa,
 * prazo curto) e decide se a aprovação rápida é permitida. A IA do Copiloto só lê estes resultados.
 */
import { pricingAdjustment } from "@/src/domain/operations/pricing";

export type DeskFileFormat = "XML" | "CNAB" | "XLS" | "OUTRO";
export type DeskFile = { name: string; format: DeskFileFormat; detail: string; content?: string; readError?: string };

export type DeskTitle = {
  id: string;
  document: string;
  debtor: string;
  amountCents: number;
  days: number;
  source: Exclude<DeskFileFormat, "OUTRO">;
  /** Já existe na carteira com o mesmo sacado e documento. */
  duplicate?: boolean;
  /** Sacado sem cadastro anterior; a política pede consulta ao birô. */
  newDebtor?: boolean;
};

export type DeskPolicy = {
  name: string;
  version: string;
  /** Participação máxima de um sacado no valor de face da operação (%). */
  concentrationLimit: number;
  /** Piso de taxa mensal (% a.m.); abaixo dele o cenário exige alçada comercial. */
  rateFloor: number;
  /** Prazo de referência (dias); abaixo dele vira alerta, sem bloquear. */
  minDays: number;
  operationFeeCents: number;
  perTitleFeeCents: number;
  defaultRate: number;
  scoreAttention?: number;
  scorePositive?: number;
};

export type DeskSeverity = "impedimento" | "alcada" | "info";
export type DeskEvidence = "Fato" | "Inferência" | "Sem dados";
export type DeskInsightKind = "FATO" | "REGRA" | "TENDÊNCIA" | "HIPÓTESE" | "SUGESTÃO";

export type DeskFinding = {
  id: string;
  severity: DeskSeverity;
  evidence: DeskEvidence;
  kind: DeskInsightKind;
  title: string;
  detail: string;
  /** Pergunta pronta para o Copiloto explicar o apontamento. */
  question?: string;
};

export type DeskResult = {
  count: number;
  faceCents: number;
  discountCents: number;
  feesCents: number;
  iofCents: number;
  netCents: number;
  averageDays: number;
  allInMonthly: number;
  top: { debtor: string; share: number };
  findings: DeskFinding[];
  blockers: DeskFinding[];
  exceptions: DeskFinding[];
  fastTrack: boolean;
};

export type DeskScenario = {
  version: number;
  ratePercent: number;
  included: string[];
  label: string;
  result: DeskResult;
};

export type DeskContext = {
  titles: DeskTitle[];
  policy: DeskPolicy;
  /** A consulta ao birô do sacado novo foi autorizada e feita. */
  bureauChecked: boolean;
  cedent?: { name: string; score: number; creditLimitCents: number; usedLimitCents: number };
};

/** Alíquotas de IOF apenas para a demonstração (diária + adicional); a versão real vem de tabela versionada. */
const DEMO_IOF_DAILY = 0.000041;
const DEMO_IOF_ADDITIONAL = 0.0038;

export const centsToBRL = (cents: number) =>
  (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export const percentBR = (value: number, digits = 1) =>
  `${value.toLocaleString("pt-BR", { minimumFractionDigits: digits, maximumFractionDigits: digits })}%`;

export function deskCalculation(context: DeskContext, included: string[], ratePercent: number): DeskResult {
  const { titles, policy, bureauChecked } = context;
  const selected = new Set(included);
  const rows = titles.filter(title => selected.has(title.id));
  let faceCents = 0;
  let discountCents = 0;
  let iofCents = 0;
  for (const title of rows) {
    const discount = Math.round(pricingAdjustment(title.amountCents / 100, title.days, ratePercent, "Nominal") * 100);
    faceCents += title.amountCents;
    discountCents += discount;
    iofCents += Math.round(
      (title.amountCents - discount) * (DEMO_IOF_DAILY * Math.min(title.days, 365) + DEMO_IOF_ADDITIONAL),
    );
  }
  const feesCents = rows.length ? policy.operationFeeCents + policy.perTitleFeeCents * rows.length : 0;
  const netCents = Math.max(0, faceCents - discountCents - feesCents - iofCents);
  const averageDays = faceCents ? rows.reduce((sum, title) => sum + title.amountCents * title.days, 0) / faceCents : 0;
  const allInMonthly =
    netCents > 0 && averageDays > 0 ? (Math.pow(faceCents / netCents, 30 / averageDays) - 1) * 100 : 0;

  const byDebtor = new Map<string, number>();
  rows.forEach(title => byDebtor.set(title.debtor, (byDebtor.get(title.debtor) ?? 0) + title.amountCents));
  let top = { debtor: "", share: 0 };
  byDebtor.forEach((amount, debtor) => {
    const share = faceCents ? (amount / faceCents) * 100 : 0;
    if (share > top.share) top = { debtor, share };
  });

  const findings: DeskFinding[] = [];
  if (context.cedent) {
    const { cedent } = context;
    const attention = policy.scoreAttention ?? 600;
    const positive = policy.scorePositive ?? 700;
    if (cedent.score <= 0)
      findings.push({
        id: "cedent-score",
        severity: "impedimento",
        evidence: "Sem dados",
        kind: "REGRA",
        title: `${cedent.name} ainda não possui score interno`,
        detail: "O score precisa ser calculado ou decidido pela alçada antes da aprovação.",
        question: "Como está o score do cedente?",
      });
    else
      findings.push({
        id: "cedent-score",
        severity: cedent.score < attention ? "alcada" : "info",
        evidence: "Fato",
        kind: "REGRA",
        title: `Score do cedente: ${cedent.score}`,
        detail:
          cedent.score >= positive
            ? `Faixa positiva da política (a partir de ${positive}).`
            : cedent.score >= attention
              ? `Faixa de atenção da política (${attention} a ${positive - 1}).`
              : `Abaixo do corte de ${attention}; exige revisão de risco.`,
        question: "Como está o score do cedente?",
      });
    const available = Math.max(0, cedent.creditLimitCents - cedent.usedLimitCents);
    if (faceCents > available)
      findings.push({
        id: "cedent-limit",
        severity: "alcada",
        evidence: "Fato",
        kind: "REGRA",
        title: "Valor acima do limite disponível do cedente",
        detail: `Disponível ${centsToBRL(available)}; face modelada ${centsToBRL(faceCents)}. Exige alçada de crédito.`,
        question: "A operação cabe no limite do cedente?",
      });
  }
  rows
    .filter(title => title.duplicate)
    .forEach(title =>
      findings.push({
        id: `dup-${title.id}`,
        severity: "impedimento",
        evidence: "Fato",
        kind: "REGRA",
        title: `${title.document} já está na carteira`,
        detail: "Mesmo sacado e número de documento de um título já adquirido. Regra INTAKE-DUP-001.",
        question: `Por que o ${title.document} foi bloqueado?`,
      }),
    );
  const hasNewDebtor = rows.some(title => title.newDebtor);
  const newDebtor = rows.find(title => title.newDebtor)?.debtor ?? "";
  if (hasNewDebtor && !bureauChecked)
    findings.push({
      id: "bureau",
      severity: "impedimento",
      evidence: "Sem dados",
      kind: "REGRA",
      title: `${newDebtor} sem consulta`,
      detail: "Sacado novo. A política exige consulta ao birô antes de aprovar.",
      question: `O que falta sobre a ${newDebtor}?`,
    });
  if (top.share > policy.concentrationLimit)
    findings.push({
      id: "concentration",
      severity: "alcada",
      evidence: "Fato",
      kind: "REGRA",
      title: `${top.debtor} concentra ${percentBR(top.share)} da operação`,
      detail: `Limite da política ${policy.name} v${policy.version}: ${policy.concentrationLimit}%. Exige alçada ou ajuste.`,
      question: `Por que a ${top.debtor} foi sinalizada?`,
    });
  if (ratePercent < policy.rateFloor)
    findings.push({
      id: "rate-floor",
      severity: "alcada",
      evidence: "Fato",
      kind: "REGRA",
      title: `Taxa de ${percentBR(ratePercent, 2)} a.m. abaixo do piso`,
      detail: `Piso da política para este risco: ${percentBR(policy.rateFloor, 2)} a.m. Exige alçada comercial.`,
      question: "Por que a taxa precisa de alçada?",
    });
  rows
    .filter(title => title.days < policy.minDays)
    .forEach(title =>
      findings.push({
        id: `term-${title.id}`,
        severity: "info",
        evidence: "Fato",
        kind: "FATO",
        title: `${title.document} vence em ${title.days} dias`,
        detail: `Abaixo do prazo de referência de ${policy.minDays} dias. Não bloqueia; vale conferir com o cedente.`,
        question: `O ${title.document} vence cedo, isso é problema?`,
      }),
    );
  if (hasNewDebtor && bureauChecked)
    findings.push({
      id: "bureau-ok",
      severity: "info",
      evidence: "Fato",
      kind: "FATO",
      title: `${newDebtor} consultada`,
      detail: "Birô de demonstração: score 688, sem restrições. O score do birô fica em campo separado.",
    });

  const blockers = findings.filter(finding => finding.severity === "impedimento");
  const exceptions = findings.filter(finding => finding.severity === "alcada");
  return {
    count: rows.length,
    faceCents,
    discountCents,
    feesCents,
    iofCents,
    netCents,
    averageDays,
    allInMonthly,
    top,
    findings,
    blockers,
    exceptions,
    fastTrack: rows.length > 0 && !blockers.length && !exceptions.length,
  };
}

export function firstScenario(context: DeskContext): DeskScenario {
  const included = context.titles.map(title => title.id);
  const ratePercent = context.policy.defaultRate;
  return {
    version: 1,
    ratePercent,
    included,
    label: "Análise inicial",
    result: deskCalculation(context, included, ratePercent),
  };
}

/** Cria a próxima versão imutável a partir da última; nenhuma versão anterior é alterada. */
export function nextScenario(
  context: DeskContext,
  scenarios: DeskScenario[],
  change: { ratePercent?: number; included?: string[]; label: string },
): DeskScenario {
  const previous = scenarios[scenarios.length - 1];
  const ratePercent = change.ratePercent ?? previous.ratePercent;
  const included = change.included ?? previous.included;
  return {
    version: previous.version + 1,
    ratePercent,
    included,
    label: change.label,
    result: deskCalculation(context, included, ratePercent),
  };
}

/** Menor retirada de um título do sacado mais concentrado que deixa a operação dentro do limite. */
export function bestConcentrationFix(context: DeskContext, scenario: DeskScenario) {
  const { debtor } = scenario.result.top;
  let best: { title: DeskTitle; share: number; result: DeskResult } | null = null;
  for (const title of context.titles) {
    if (!scenario.included.includes(title.id) || title.debtor !== debtor) continue;
    const included = scenario.included.filter(id => id !== title.id);
    const result = deskCalculation(context, included, scenario.ratePercent);
    if (result.top.share > context.policy.concentrationLimit) continue;
    const debtorCents = context.titles
      .filter(item => included.includes(item.id) && item.debtor === debtor)
      .reduce((sum, item) => sum + item.amountCents, 0);
    const share = result.faceCents ? (debtorCents / result.faceCents) * 100 : 0;
    if (!best || title.amountCents < best.title.amountCents) best = { title, share, result };
  }
  return best;
}

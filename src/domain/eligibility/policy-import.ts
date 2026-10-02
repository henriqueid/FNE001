import { type InstitutionType } from "@/src/domain/core/types";
import { masterRuleCatalog } from "./master-rule-catalog";
import {
  type EligibilityAction,
  type EligibilityOperator,
  type EligibilityPolicy,
  type PolicyRuleBinding,
} from "./model";
import { createBlankPolicy } from "./policy-library";

const columns = [
  "policy_name",
  "version",
  "modality",
  "company",
  "product",
  "effective_from",
  "rule_id",
  "enabled",
  "operator",
  "parameter",
  "failure_outcome",
  "action",
  "override_allowed",
  "override_authority",
];

const quote = (value: unknown) => `"${String(value ?? "").replace(/"/g, '""')}"`;

export function policyImportTemplate() {
  const rows = masterRuleCatalog.map(rule => [
    "Nova Política",
    "v1.0",
    rule.modalities[0] === "TODAS" ? "FIDC" : rule.modalities[0],
    "PREENCHER EMPRESA",
    "",
    new Date().toISOString().slice(0, 10),
    rule.id,
    "false",
    rule.defaultOperator,
    "",
    "EXCECAO",
    "SOLICITAR_DECISAO",
    "false",
    "",
  ]);
  return `\uFEFF${columns.map(quote).join(";")}\n${rows.map(row => row.map(quote).join(";")).join("\n")}`;
}

function parseLine(line: string) {
  const values: string[] = [];
  let value = "";
  let quoted = false;
  for (let index = 0; index < line.length; index++) {
    const char = line[index];
    if (char === '"' && quoted && line[index + 1] === '"') {
      value += '"';
      index++;
    } else if (char === '"') quoted = !quoted;
    else if (char === ";" && !quoted) {
      values.push(value);
      value = "";
    } else value += char;
  }
  values.push(value);
  return values;
}

function boolean(value: string) {
  return ["true", "sim", "1", "yes"].includes(value.trim().toLocaleLowerCase());
}

function parameter(value: string) {
  const normalized = value.trim();
  if (!normalized) return null;
  if (["true", "false", "sim", "não", "nao"].includes(normalized.toLocaleLowerCase())) return boolean(normalized);
  const numeric = Number(normalized.replace(",", "."));
  if (Number.isFinite(numeric)) return numeric;
  if (normalized.includes("|"))
    return normalized
      .split("|")
      .map(item => item.trim())
      .filter(Boolean);
  return normalized;
}

export function importPolicyCsv(content: string): EligibilityPolicy {
  const lines = content
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter(line => line.trim());
  if (lines.length < 2) throw new Error("O arquivo não contém regras preenchidas.");
  const headers = parseLine(lines[0]);
  const positions = new Map(headers.map((header, index) => [header.trim(), index]));
  columns.forEach(column => {
    if (!positions.has(column)) throw new Error(`Coluna obrigatória ausente: ${column}.`);
  });
  const records = lines.slice(1).map(line => {
    const values = parseLine(line);
    return Object.fromEntries(columns.map(column => [column, values[positions.get(column)!] ?? ""]));
  });
  const first = records[0];
  if (!first.policy_name || !first.version || !first.company || !first.modality || !first.effective_from)
    throw new Error("Preencha nome, versão, modalidade, empresa e início da vigência.");
  if (!["FIDC", "Securitizadora", "Factoring"].includes(first.modality)) throw new Error("Modalidade inválida.");
  const knownRules = new Set(masterRuleCatalog.map(rule => rule.id));
  const bindings: PolicyRuleBinding[] = records
    .filter(record => boolean(record.enabled))
    .map(record => {
      if (!knownRules.has(record.rule_id)) throw new Error(`Regra desconhecida: ${record.rule_id}.`);
      return {
        ruleId: record.rule_id,
        enabled: true,
        operator: (record.operator || undefined) as EligibilityOperator | undefined,
        parameter: parameter(record.parameter),
        failureOutcome: (record.failure_outcome || "EXCECAO") as PolicyRuleBinding["failureOutcome"],
        action: (record.action || "SOLICITAR_DECISAO") as EligibilityAction,
        overrideAllowed: boolean(record.override_allowed),
        overrideAuthority: record.override_authority || undefined,
      };
    });
  const policy = createBlankPolicy({
    name: first.policy_name,
    version: first.version,
    modality: first.modality as InstitutionType,
    company: first.company,
    product: first.product,
    effectiveFrom: first.effective_from,
  });
  return { ...policy, bindings };
}

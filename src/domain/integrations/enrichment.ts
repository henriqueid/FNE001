import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";
import { type IntegrationProviderId, type IntegrationState } from "./model";

export type EnrichmentProvenance = "INTERNO" | "DEMONSTRACAO" | "OFICIAL" | "PENDENTE" | "INDISPONIVEL";
export type EnrichmentResult = "CONFIRMADO" | "ATENCAO" | "PENDENTE" | "INDISPONIVEL";

export type EnrichmentCheck = {
  id: string;
  providerId?: IntegrationProviderId;
  source: string;
  subject: "OPERACAO" | "CEDENTE" | "SACADO" | "TITULO";
  subjectId: string;
  label: string;
  value: string;
  provenance: EnrichmentProvenance;
  result: EnrichmentResult;
  evidence: string;
  observedAt: string;
};

export type EnrichmentSnapshot = {
  id: string;
  createdAt: string;
  configurationFingerprint: string;
  checks: EnrichmentCheck[];
  summary: Record<EnrichmentProvenance, number>;
};

export type EnrichmentReview = { snapshot: EnrichmentSnapshot; history?: EnrichmentSnapshot[] };

const digits = (value: string) => value.replace(/\D/g, "");
const compactHash = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16).padStart(8, "0");
};

export function enrichmentFingerprint(operation: Operation, state: IntegrationState) {
  const titles = (operation.manualEntry?.entries ?? []).map(title =>
    [
      title.id,
      title.documentNumber,
      title.amount,
      title.dueDate,
      digits(title.debtorDocument),
      title.nfeKey ?? "",
    ].join(":"),
  );
  const providers = state.providers.map(provider => `${provider.id}:${provider.mode}`).sort();
  return compactHash(
    JSON.stringify({ operation: operation.id, document: digits(operation.document), titles, providers }),
  );
}

function externalCheck({
  state,
  providerId,
  id,
  subject,
  subjectId,
  label,
  demoValue,
  officialValue,
  observedAt,
}: {
  state: IntegrationState;
  providerId: IntegrationProviderId;
  id: string;
  subject: EnrichmentCheck["subject"];
  subjectId: string;
  label: string;
  demoValue: string;
  officialValue?: string;
  observedAt: string;
}): EnrichmentCheck {
  const provider = state.providers.find(item => item.id === providerId);
  const source = provider?.name ?? providerId;
  if (provider?.mode === "DEMONSTRACAO")
    return {
      id,
      providerId,
      source,
      subject,
      subjectId,
      label,
      value: demoValue,
      provenance: "DEMONSTRACAO",
      result: "ATENCAO",
      evidence: "Dado de demonstração. Não representa consulta oficial ao provedor.",
      observedAt,
    };
  if (provider?.mode === "ATIVA")
    return {
      id,
      providerId,
      source,
      subject,
      subjectId,
      label,
      value: officialValue ?? demoValue,
      provenance: "OFICIAL",
      result: "CONFIRMADO",
      evidence: `Retorno da integração ${source} configurada.`,
      observedAt,
    };
  if (provider?.mode === "INDISPONIVEL")
    return {
      id,
      providerId,
      source,
      subject,
      subjectId,
      label,
      value: "Fonte temporariamente indisponível",
      provenance: "INDISPONIVEL",
      result: "INDISPONIVEL",
      evidence: "A fonte está configurada, mas não respondeu nesta execução.",
      observedAt,
    };
  return {
    id,
    providerId,
    source,
    subject,
    subjectId,
    label,
    value: "Consulta pendente",
    provenance: "PENDENTE",
    result: "PENDENTE",
    evidence: "Credenciais e homologação do provedor ainda não foram configuradas.",
    observedAt,
  };
}

export function buildEnrichmentSnapshot({
  operation,
  debtors,
  cedent,
  integrations,
  at = new Date().toISOString(),
}: {
  operation: Operation;
  debtors: Debtor[];
  cedent?: Cedent;
  integrations: IntegrationState;
  at?: string;
}): EnrichmentSnapshot {
  const titles = operation.manualEntry?.entries ?? [];
  const debtorDocuments = [...new Set(titles.map(title => digits(title.debtorDocument)).filter(Boolean))];
  const relatedDebtors = debtorDocuments.map(document => debtors.find(debtor => digits(debtor.document) === document));
  const nfeKeys = titles.filter(title => title.nfeKey).length;
  const validNfeKeys = titles.filter(title => digits(title.nfeKey ?? "").length === 44).length;
  const provisionalDebtors = relatedDebtors.filter(
    debtor => !debtor || debtor.registrationStatus === "Provisório",
  ).length;
  const checks: EnrichmentCheck[] = [
    {
      id: `internal:entry:${operation.id}`,
      source: "FNE001",
      subject: "OPERACAO",
      subjectId: operation.id,
      label: "Entrada normalizada",
      value: `${titles.length} título(s) estruturado(s)`,
      provenance: "INTERNO",
      result: titles.length ? "CONFIRMADO" : "ATENCAO",
      evidence: operation.entryIntake
        ? `Lote ${operation.entryIntake.id}, hash ${operation.entryIntake.fileHash}.`
        : "Dados registrados no fluxo interno da operação.",
      observedAt: at,
    },
    {
      id: `internal:cedent:${operation.id}`,
      source: "Cadastro FNE001",
      subject: "CEDENTE",
      subjectId: digits(operation.document),
      label: "Identidade do cedente",
      value: cedent ? `${cedent.name} · cadastro localizado` : "Cadastro não localizado",
      provenance: "INTERNO",
      result: cedent ? "CONFIRMADO" : "ATENCAO",
      evidence: "Correspondência pelo CPF/CNPJ dentro do cadastro interno.",
      observedAt: at,
    },
    {
      id: `internal:debtors:${operation.id}`,
      source: "Cadastro FNE001",
      subject: "SACADO",
      subjectId: operation.id,
      label: "Identidade dos sacados",
      value: `${relatedDebtors.filter(Boolean).length} de ${debtorDocuments.length} localizado(s)`,
      provenance: provisionalDebtors ? "PENDENTE" : "INTERNO",
      result: provisionalDebtors ? "PENDENTE" : "CONFIRMADO",
      evidence: "Correspondência pelo CPF/CNPJ; cadastros provisórios exigem complementação.",
      observedAt: at,
    },
    externalCheck({
      state: integrations,
      providerId: "RECEITA",
      id: `receita:cedent:${operation.id}`,
      subject: "CEDENTE",
      subjectId: digits(operation.document),
      label: "Situação cadastral do cedente",
      demoValue: cedent?.publicStatus ?? "Sem dado demonstrativo",
      observedAt: at,
    }),
    externalCheck({
      state: integrations,
      providerId: "RECEITA",
      id: `receita:debtors:${operation.id}`,
      subject: "SACADO",
      subjectId: operation.id,
      label: "Situação cadastral dos sacados",
      demoValue: `${relatedDebtors.filter(debtor => debtor?.publicStatus).length} registro(s) com referência cadastral`,
      observedAt: at,
    }),
    externalCheck({
      state: integrations,
      providerId: "BUREAU",
      id: `bureau:${operation.id}`,
      subject: "OPERACAO",
      subjectId: operation.id,
      label: "Crédito e restrições externas",
      demoValue: `${[cedent, ...relatedDebtors].filter(entity => entity?.bureauScore != null || entity?.score != null).length} participante(s) com score de referência`,
      observedAt: at,
    }),
    externalCheck({
      state: integrations,
      providerId: "SEFAZ",
      id: `sefaz:${operation.id}`,
      subject: "TITULO",
      subjectId: operation.id,
      label: "Documentos fiscais eletrônicos",
      demoValue: `${validNfeKeys} chave(s) com 44 dígitos de ${nfeKeys} informada(s)`,
      observedAt: at,
    }),
    externalCheck({
      state: integrations,
      providerId: "REGISTRADORA",
      id: `registradora:${operation.id}`,
      subject: "TITULO",
      subjectId: operation.id,
      label: "Registro, titularidade e gravames",
      demoValue: "Referência demonstrativa de registro",
      observedAt: at,
    }),
    externalCheck({
      state: integrations,
      providerId: "CUSTODIANTE",
      id: `custodiante:${operation.id}`,
      subject: "TITULO",
      subjectId: operation.id,
      label: "Custódia e lastro documental",
      demoValue: "Referência demonstrativa de custódia",
      observedAt: at,
    }),
  ];
  const summary: EnrichmentSnapshot["summary"] = {
    INTERNO: 0,
    DEMONSTRACAO: 0,
    OFICIAL: 0,
    PENDENTE: 0,
    INDISPONIVEL: 0,
  };
  checks.forEach(check => {
    summary[check.provenance] += 1;
  });
  const fingerprint = enrichmentFingerprint(operation, integrations);
  return {
    id: `enrichment:${operation.id}:${fingerprint}:${at}`,
    createdAt: at,
    configurationFingerprint: fingerprint,
    checks,
    summary,
  };
}

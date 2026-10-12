import type { CnpjEvidence } from "@/src/domain/integrations/cnpj";

type BrasilApiResponse = Record<string, unknown> & {
  cnpj?: string;
  razao_social?: string;
  nome_fantasia?: string;
  situacao_cadastral?: number;
  data_inicio_atividade?: string;
  natureza_juridica?: string;
  porte?: string;
  capital_social?: number;
  email?: string | null;
  ddd_telefone_1?: string;
  ddd_telefone_2?: string | null;
  cep?: string;
  logradouro?: string;
  numero?: string;
  complemento?: string;
  bairro?: string;
  municipio?: string;
  uf?: string;
  cnae_fiscal?: number;
  cnae_fiscal_descricao?: string;
  cnaes_secundarios?: Array<{ codigo?: number; descricao?: string }>;
  qsa?: Array<{
    nome_socio?: string;
    cnpj_cpf_do_socio?: string;
    qualificacao_socio?: string;
    data_entrada_sociedade?: string;
  }>;
  opcao_pelo_simples?: boolean | null;
  opcao_pelo_mei?: boolean | null;
};

const statusLabels: Record<number, string> = {
  1: "Nula",
  2: "Ativa",
  3: "Suspensa",
  4: "Inapta",
  8: "Baixada",
};
const clean = (value: unknown) => (typeof value === "string" ? value.trim() : "");
const digits = (value: unknown) => clean(value).replace(/\D/g, "");
const formatZip = (value: unknown) => {
  const zip = digits(value).slice(0, 8);
  return zip.length === 8 ? `${zip.slice(0, 5)}-${zip.slice(5)}` : zip;
};
const isoDate = (value: unknown) => {
  const text = clean(value);
  if (!text) return "";
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const match = text.match(/^(\d{2})[/-](\d{2})[/-](\d{4})$/);
  return match ? `${match[3]}-${match[2]}-${match[1]}` : "";
};

export function normalizeBrasilApiCnpj(raw: BrasilApiResponse, fetchedAt = new Date()): CnpjEvidence {
  const expiresAt = new Date(fetchedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + 30);
  const status = Number(raw.situacao_cadastral ?? 0);
  return {
    provider: "BRASIL_API",
    registrationNumber: digits(raw.cnpj),
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: expiresAt.toISOString(),
    legalName: clean(raw.razao_social),
    tradeName: clean(raw.nome_fantasia),
    registrationStatus: { code: status ? String(status) : "", label: statusLabels[status] ?? "Não informada" },
    openedAt: isoDate(raw.data_inicio_atividade),
    legalNature: clean(raw.natureza_juridica),
    companySize: clean(raw.porte),
    shareCapital: Number(raw.capital_social ?? 0) || 0,
    email: clean(raw.email).toLowerCase(),
    phones: [clean(raw.ddd_telefone_1), clean(raw.ddd_telefone_2)].filter(Boolean),
    address: {
      zipCode: formatZip(raw.cep),
      street: clean(raw.logradouro),
      number: clean(raw.numero),
      complement: clean(raw.complemento),
      district: clean(raw.bairro),
      city: clean(raw.municipio),
      state: clean(raw.uf).toUpperCase(),
    },
    mainActivity: { code: String(raw.cnae_fiscal ?? ""), description: clean(raw.cnae_fiscal_descricao) },
    secondaryActivities: (raw.cnaes_secundarios ?? []).map(activity => ({
      code: String(activity.codigo ?? ""),
      description: clean(activity.descricao),
    })),
    partners: (raw.qsa ?? []).map(partner => ({
      name: clean(partner.nome_socio),
      document: clean(partner.cnpj_cpf_do_socio),
      qualification: clean(partner.qualificacao_socio),
      joinedAt: isoDate(partner.data_entrada_sociedade),
    })),
    simples: typeof raw.opcao_pelo_simples === "boolean" ? raw.opcao_pelo_simples : null,
    mei: typeof raw.opcao_pelo_mei === "boolean" ? raw.opcao_pelo_mei : null,
  };
}

export async function fetchBrasilApiCnpj(
  cnpj: string,
  fetcher: typeof fetch = fetch,
): Promise<{ evidence: CnpjEvidence; raw: BrasilApiResponse }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 12_000);
  try {
    const response = await fetcher(`https://brasilapi.com.br/api/cnpj/v1/${encodeURIComponent(cnpj)}`, {
      headers: { accept: "application/json", "user-agent": "STRATO-Receivables-OS/0.7" },
      signal: controller.signal,
    });
    const raw = (await response.json().catch(() => ({}))) as BrasilApiResponse & { message?: string };
    if (!response.ok) throw new Error(raw.message || `BrasilAPI respondeu HTTP ${response.status}.`);
    const evidence = normalizeBrasilApiCnpj(raw);
    if (!evidence.registrationNumber || !evidence.legalName)
      throw new Error("BrasilAPI retornou uma resposta cadastral incompleta.");
    return { evidence, raw };
  } finally {
    clearTimeout(timeout);
  }
}

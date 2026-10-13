import type { CnpjEvidence } from "@/src/domain/integrations/cnpj";
import type {
  BankEvidence,
  CepEvidence,
  HolidayEvidence,
  PixParticipantEvidence,
} from "@/src/domain/integrations/public-data";

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

const publicDataCache = new Map<string, { expiresAt: number; value: unknown }>();

async function cachedPublicJson<T>(key: string, url: string, ttlMs: number, fetcher: typeof fetch = fetch): Promise<T> {
  const cached = publicDataCache.get(key);
  if (cached && cached.expiresAt > Date.now()) return cached.value as T;
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);
  try {
    const response = await fetcher(url, {
      headers: { accept: "application/json", "user-agent": "STRATO-Receivables-OS/0.7" },
      signal: controller.signal,
    });
    const body = (await response.json().catch(() => ({}))) as T & { message?: string };
    if (!response.ok) throw new Error(body.message || `Fonte pública respondeu HTTP ${response.status}.`);
    publicDataCache.set(key, { expiresAt: Date.now() + ttlMs, value: body });
    return body;
  } finally {
    clearTimeout(timeout);
  }
}

const expiry = (fetchedAt: Date, days: number) => {
  const expiresAt = new Date(fetchedAt);
  expiresAt.setUTCDate(expiresAt.getUTCDate() + days);
  return expiresAt.toISOString();
};

type BrasilApiCepResponse = {
  cep?: string;
  state?: string;
  city?: string;
  neighborhood?: string;
  street?: string;
  service?: string;
  ibge?: { city?: string; state?: string };
  location?: { coordinates?: { latitude?: string | number; longitude?: string | number } };
};

export async function fetchBrasilApiCep(zipCode: string, fetcher: typeof fetch = fetch): Promise<CepEvidence> {
  const zip = digits(zipCode);
  if (!/^\d{8}$/.test(zip)) throw new Error("CEP inválido.");
  const raw = await cachedPublicJson<BrasilApiCepResponse>(
    `cep:${zip}`,
    `https://brasilapi.com.br/api/cep/v2/${zip}`,
    7 * 86_400_000,
    fetcher,
  );
  if (!clean(raw.city) || !clean(raw.state)) throw new Error("A fonte de CEP retornou dados incompletos.");
  const fetchedAt = new Date();
  const latitude = Number(raw.location?.coordinates?.latitude);
  const longitude = Number(raw.location?.coordinates?.longitude);
  return {
    provider: "BRASIL_API",
    fetchedAt: fetchedAt.toISOString(),
    expiresAt: expiry(fetchedAt, 30),
    zipCode: formatZip(raw.cep || zip),
    state: clean(raw.state).toUpperCase(),
    city: clean(raw.city),
    district: clean(raw.neighborhood),
    street: clean(raw.street),
    service: clean(raw.service),
    ibgeCity: clean(raw.ibge?.city),
    ibgeState: clean(raw.ibge?.state),
    location: Number.isFinite(latitude) && Number.isFinite(longitude) ? { latitude, longitude } : undefined,
  };
}

type BrasilApiBankResponse = { ispb?: string; name?: string; code?: number | null; fullName?: string };

export async function fetchBrasilApiBanks(fetcher: typeof fetch = fetch): Promise<BankEvidence[]> {
  const raw = await cachedPublicJson<BrasilApiBankResponse[]>(
    "banks:all",
    "https://brasilapi.com.br/api/banks/v1",
    7 * 86_400_000,
    fetcher,
  );
  const fetchedAt = new Date();
  return raw
    .filter(item => clean(item.ispb) && (clean(item.name) || clean(item.fullName)))
    .map(item => ({
      provider: "BRASIL_API_BCB" as const,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: expiry(fetchedAt, 30),
      code: typeof item.code === "number" ? item.code : undefined,
      ispb: clean(item.ispb),
      name: clean(item.name),
      fullName: clean(item.fullName),
    }))
    .sort((left, right) => (left.code ?? 9999) - (right.code ?? 9999));
}

type BrasilApiHolidayResponse = { date?: string; name?: string; type?: string };

export async function fetchBrasilApiHolidays(
  year: number,
  state?: string,
  fetcher: typeof fetch = fetch,
): Promise<HolidayEvidence[]> {
  if (!Number.isInteger(year) || year < 1900 || year > 2199) throw new Error("Ano inválido.");
  const uf = clean(state).toUpperCase();
  if (uf && !/^[A-Z]{2}$/.test(uf)) throw new Error("UF inválida.");
  const query = uf ? `?uf=${encodeURIComponent(uf)}` : "";
  const raw = await cachedPublicJson<BrasilApiHolidayResponse[]>(
    `holidays:${year}:${uf}`,
    `https://brasilapi.com.br/api/feriados/v1/${year}${query}`,
    30 * 86_400_000,
    fetcher,
  );
  const fetchedAt = new Date();
  return raw
    .filter(item => /^\d{4}-\d{2}-\d{2}$/.test(clean(item.date)))
    .map(item => ({
      provider: "BRASIL_API" as const,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: expiry(fetchedAt, 90),
      date: clean(item.date),
      name: clean(item.name),
      type: clean(item.type),
    }));
}

type BrasilApiPixParticipant = {
  ispb?: string;
  nome?: string;
  nome_reduzido?: string;
  modalidade_participacao?: string;
  tipo_participacao?: string;
};

export async function fetchBrasilApiPixParticipants(fetcher: typeof fetch = fetch): Promise<PixParticipantEvidence[]> {
  const raw = await cachedPublicJson<BrasilApiPixParticipant[]>(
    "pix:participants",
    "https://brasilapi.com.br/api/pix/v1/participants",
    24 * 60 * 60_000,
    fetcher,
  );
  const fetchedAt = new Date();
  return raw
    .filter(item => clean(item.ispb) && clean(item.nome))
    .map(item => ({
      provider: "BRASIL_API_BCB" as const,
      fetchedAt: fetchedAt.toISOString(),
      expiresAt: expiry(fetchedAt, 7),
      ispb: clean(item.ispb),
      name: clean(item.nome),
      shortName: clean(item.nome_reduzido),
      participationMode: clean(item.modalidade_participacao),
      participationType: clean(item.tipo_participacao),
    }));
}

import { sessionPrincipal } from "@/src/server/access/session";
import { getDatabase } from "@/src/server/database/postgres";
import { fetchBrasilApiCnpj } from "@/src/server/integrations/cnpj-provider";
import {
  cnpjParty,
  completeCnpjJob,
  failCnpjJob,
  latestCnpjEvidence,
  startCnpjJob,
} from "@/src/server/integrations/cnpj-repository";

const json = (body: unknown, status = 200) => Response.json(body, { status });
const digest = async (value: unknown) => {
  const bytes = new TextEncoder().encode(JSON.stringify(value));
  const result = await crypto.subtle.digest("SHA-256", bytes);
  return [...new Uint8Array(result)].map(byte => byte.toString(16).padStart(2, "0")).join("");
};

async function context(request: Request) {
  const tenantId = request.headers.get("x-strato-tenant-id")?.trim();
  if (!tenantId) return { error: json({ error: "Empresa não informada." }, 400) } as const;
  const db = getDatabase();
  const principal = await sessionPrincipal(db, request.headers, tenantId);
  if (!principal) return { error: json({ error: "Sessão ausente ou expirada." }, 401) } as const;
  return { db, tenantId, principal } as const;
}

export async function GET(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  const partyId = new URL(request.url).searchParams.get("partyId")?.trim();
  if (!partyId) return json({ error: "Cadastro não informado." }, 400);
  return json({ evidence: await latestCnpjEvidence(access.db, access.tenantId, partyId) });
}

export async function POST(request: Request) {
  const access = await context(request);
  if ("error" in access) return access.error;
  if (
    !access.principal.permissions.some(
      permission =>
        permission === "registry:edit" ||
        permission === "settings:manage" ||
        permission === "portfolio:manage" ||
        permission === "operations:edit",
    )
  )
    return json({ error: "Sem permissão para consultar dados cadastrais externos." }, 403);
  const body = (await request.json().catch(() => null)) as {
    partyId?: string;
    document?: string;
    force?: boolean;
  } | null;
  if (body?.document) {
    if (
      !access.principal.permissions.some(
        permission =>
          permission === "portfolio:manage" ||
          permission === "registry:edit" ||
          permission === "settings:manage" ||
          permission === "operations:edit",
      )
    )
      return json({ error: "Sem permissão para consultar dados cadastrais externos." }, 403);
    const document = body.document.replace(/\D/g, "");
    if (!/^\d{14}$/.test(document)) return json({ error: "Informe um CNPJ válido." }, 400);
    try {
      const result = await fetchBrasilApiCnpj(document);
      return json({ evidence: result.evidence, cached: false });
    } catch (reason) {
      console.error("lead_cnpj_enrichment_failed", reason);
      return json({ error: "A fonte cadastral está indisponível. Tente novamente em instantes." }, 503);
    }
  }
  if (!body?.partyId) return json({ error: "Cadastro não informado." }, 400);
  const party = await cnpjParty(access.db, access.tenantId, body.partyId);
  if (!party) return json({ error: "Cadastro não encontrado." }, 404);
  if (party.kind !== "PJ" || !/^\d{14}$/.test(party.document_digits))
    return json({ error: "A consulta externa exige um CNPJ válido." }, 400);
  const cached = await latestCnpjEvidence(access.db, access.tenantId, party.party_id);
  if (!body.force && cached && cached.expiresAt > new Date().toISOString())
    return json({ evidence: cached, cached: true });
  let jobId: string | undefined;
  try {
    jobId = await startCnpjJob(access.db, access.tenantId, party.party_id, access.principal.id, "BRASIL_API");
    const result = await fetchBrasilApiCnpj(party.document_digits);
    await completeCnpjJob(access.db, {
      tenantId: access.tenantId,
      jobId,
      partyId: party.party_id,
      actorId: access.principal.id,
      providerId: "BRASIL_API",
      registrationNumber: party.document_digits,
      evidence: result.evidence,
      raw: result.raw,
      responseHash: await digest(result.raw),
    });
    return json({ evidence: result.evidence, cached: false });
  } catch (reason) {
    const message = reason instanceof Error ? reason.message : "Consulta cadastral indisponível.";
    if (jobId) await failCnpjJob(access.db, access.tenantId, jobId, message);
    console.error("cnpj_enrichment_failed", { partyId: party.party_id, message });
    return json(
      { error: "A fonte cadastral está indisponível. A tentativa foi registrada para reprocessamento." },
      503,
    );
  }
}

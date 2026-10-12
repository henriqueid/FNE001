import type { CnpjEvidence } from "@/src/domain/integrations/cnpj";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type PartyRow = { party_id: string; kind: string; document_digits: string };
type EvidenceRow = { normalized_payload: CnpjEvidence };

export async function cnpjParty(db: DecisionDatabase, tenantId: string, partyId: string) {
  return db
    .prepare(
      `select party_id, kind, document_digits
       from private.registry_parties
       where tenant_id = ? and party_id = ?`,
    )
    .bind(tenantId, partyId)
    .first<PartyRow>();
}

export async function latestCnpjEvidence(db: DecisionDatabase, tenantId: string, partyId: string) {
  const row = await db
    .prepare(
      `select normalized_payload
       from private.company_evidence_snapshots
       where tenant_id = ? and party_id = ?
       order by fetched_at desc
       limit 1`,
    )
    .bind(tenantId, partyId)
    .first<EvidenceRow>();
  return row?.normalized_payload ?? null;
}

export async function startCnpjJob(
  db: DecisionDatabase,
  tenantId: string,
  partyId: string,
  actorId: string,
  providerId: string,
) {
  const jobId = crypto.randomUUID();
  await db
    .prepare(
      `insert into private.cnpj_enrichment_jobs
        (tenant_id, job_id, party_id, provider_id, capability, status, requested_by, correlation_id)
       values (?, ?, ?, ?, 'CNPJ_LOOKUP', 'RUNNING', ?, ?)`,
    )
    .bind(tenantId, jobId, partyId, providerId, actorId, jobId)
    .run();
  return jobId;
}

export async function completeCnpjJob(
  db: DecisionDatabase,
  input: {
    tenantId: string;
    jobId: string;
    partyId: string;
    actorId: string;
    providerId: string;
    registrationNumber: string;
    evidence: CnpjEvidence;
    raw: unknown;
    responseHash: string;
  },
) {
  const evidenceId = crypto.randomUUID();
  await db.batch([
    db
      .prepare(
        `insert into private.company_evidence_snapshots
          (tenant_id, evidence_id, party_id, provider_id, registration_number, provider_status,
           fetched_at, expires_at, response_hash, normalized_payload, raw_payload, created_by)
         values (?, ?, ?, ?, ?, ?, ?::timestamptz, ?::timestamptz, ?, ?::jsonb, ?::jsonb, ?)
         on conflict (tenant_id, party_id, provider_id, response_hash) do nothing`,
      )
      .bind(
        input.tenantId,
        evidenceId,
        input.partyId,
        input.providerId,
        input.registrationNumber,
        input.evidence.registrationStatus.label,
        input.evidence.fetchedAt,
        input.evidence.expiresAt,
        input.responseHash,
        jsonParameter(input.evidence),
        jsonParameter(input.raw),
        input.actorId,
      ),
    db
      .prepare(
        `update private.cnpj_enrichment_jobs
         set status = 'SUCCEEDED', attempts = attempts + 1, completed_at = now(), last_error = null
         where tenant_id = ? and job_id = ?`,
      )
      .bind(input.tenantId, input.jobId),
  ]);
}

export async function failCnpjJob(db: DecisionDatabase, tenantId: string, jobId: string, reason: string) {
  await db
    .prepare(
      `update private.cnpj_enrichment_jobs
       set status = case when attempts + 1 >= 3 then 'DEAD' else 'RETRY' end,
           attempts = attempts + 1,
           available_at = now() + interval '15 minutes',
           last_error = ?, completed_at = case when attempts + 1 >= 3 then now() else null end
       where tenant_id = ? and job_id = ?`,
    )
    .bind(reason.slice(0, 500), tenantId, jobId)
    .run();
}

import type { CompanyProfile } from "@/src/domain/company/profile";
import { onlyDigits, type Party } from "@/src/domain/registry/parties";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type CompanyRow = {
  legal_name: string;
  trade_name: string;
  document_digits: string;
  institution_type: CompanyProfile["institutionType"];
  email: string;
  phone: string;
  website: string;
  foundation_date: string | null;
  address: CompanyProfile["address"];
};

export async function loadCompanyProfile(db: DecisionDatabase, tenantId: string): Promise<CompanyProfile | null> {
  const row = await db
    .prepare(
      `select legal_name, trade_name, document_digits, institution_type, email, phone, website,
      foundation_date::text, address from private.company_profiles where tenant_id = ?`,
    )
    .bind(tenantId)
    .first<CompanyRow>();
  return row
    ? {
        legalName: row.legal_name,
        tradeName: row.trade_name,
        document: row.document_digits,
        institutionType: row.institution_type,
        email: row.email,
        phone: row.phone,
        website: row.website,
        foundationDate: row.foundation_date ?? "",
        address: row.address,
      }
    : null;
}

export async function saveCompanyProfile(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  company: CompanyProfile,
) {
  await db
    .prepare(
      `insert into private.company_profiles
      (tenant_id, legal_name, trade_name, document_digits, institution_type, email, phone, website, foundation_date, address, created_by, updated_by)
      values (?, ?, ?, ?, ?, ?, ?, ?, nullif(?, '')::date, ?::jsonb, ?, ?)
      on conflict (tenant_id) do update set legal_name = excluded.legal_name, trade_name = excluded.trade_name,
      document_digits = excluded.document_digits, institution_type = excluded.institution_type, email = excluded.email,
      phone = excluded.phone, website = excluded.website, foundation_date = excluded.foundation_date,
      address = excluded.address, updated_by = excluded.updated_by, updated_at = now()`,
    )
    .bind(
      tenantId,
      company.legalName.trim(),
      company.tradeName.trim(),
      onlyDigits(company.document),
      company.institutionType,
      company.email.trim(),
      company.phone.trim(),
      company.website.trim(),
      company.foundationDate,
      JSON.stringify(company.address),
      actorId,
      actorId,
    )
    .run();
}

export async function loadRegistryParties(db: DecisionDatabase, tenantId: string): Promise<Party[]> {
  const result = await db
    .prepare(`select payload from private.registry_parties where tenant_id = ? order by name`)
    .bind(tenantId)
    .all<{ payload: Party }>();
  return result.results.map(row => row.payload);
}

export async function saveRegistryParty(db: DecisionDatabase, tenantId: string, actorId: string, party: Party) {
  const previous = await db
    .prepare(`select status from private.registry_parties where tenant_id = ? and party_id = ?`)
    .bind(tenantId, party.id)
    .first<{ status: string }>();
  await db.batch([
    db
      .prepare(
        `insert into private.registry_parties
      (tenant_id, party_id, kind, document_digits, name, trade_name, status, roles, payload, created_by, updated_by)
      values (?, ?, ?, ?, ?, ?, ?, ?::text[], ?::jsonb, ?, ?)
      on conflict (tenant_id, party_id) do update set kind = excluded.kind, document_digits = excluded.document_digits,
      name = excluded.name, trade_name = excluded.trade_name, status = excluded.status, roles = excluded.roles,
      payload = excluded.payload, updated_by = excluded.updated_by, updated_at = now()`,
      )
      .bind(
        tenantId,
        party.id,
        party.kind,
        onlyDigits(party.document),
        party.name.trim(),
        party.tradeName.trim(),
        party.status,
        `{${party.roles.join(",")}}`,
        JSON.stringify(party),
        actorId,
        actorId,
      ),
    db
      .prepare(
        `insert into private.registry_party_events (event_id, tenant_id, party_id, actor_id, event_type, payload)
      values (?, ?, ?, ?, ?, ?::jsonb)`,
      )
      .bind(
        crypto.randomUUID(),
        tenantId,
        party.id,
        actorId,
        !previous
          ? "CREATED"
          : previous.status !== party.status
            ? party.status === "Ativo"
              ? "REACTIVATED"
              : "INACTIVATED"
            : "UPDATED",
        JSON.stringify({
          name: party.name,
          document: onlyDigits(party.document),
          status: party.status,
          roles: party.roles,
        }),
      ),
  ]);
}

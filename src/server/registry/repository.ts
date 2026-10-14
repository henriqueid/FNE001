import type { CompanyProfile } from "@/src/domain/company/profile";
import { onlyDigits, type Party } from "@/src/domain/registry/parties";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { jsonParameter } from "@/src/server/database/postgres";

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
      jsonParameter(company.address),
      actorId,
      actorId,
    )
    .run();
  await db
    .prepare(
      `update private.tenant_memberships
       set company_scopes = case
         when company_scopes @> jsonb_build_array(?) then company_scopes
         else company_scopes || jsonb_build_array(?)
       end
       where tenant_id = ? and user_id = ?`,
    )
    .bind(company.tradeName.trim(), company.tradeName.trim(), tenantId, actorId)
    .run();
}

export type RegistryPartySearchItem = {
  party: Party;
  openAmount: number;
  cedentCount: number;
};

export type RegistryPartyStats = {
  total: number;
  active: number;
  byRole: Record<string, number>;
};

export async function loadRegistryParties(db: DecisionDatabase, tenantId: string): Promise<Party[]> {
  const result = await db
    .prepare(
      `select payload from private.registry_parties
       where tenant_id = ?
         and (roles @> array['cedente']::text[] or not (roles @> array['sacado']::text[]))
       order by name`,
    )
    .bind(tenantId)
    .all<{ payload: Party }>();
  return result.results.map(row => row.payload);
}

export async function searchRegistryParties(
  db: DecisionDatabase,
  tenantId: string,
  options: { role?: string; query?: string; status?: string; limit: number; offset: number },
) {
  const term = options.query?.trim() ?? "";
  const pattern = `%${term}%`;
  const documentPattern = `%${onlyDigits(term)}%`;
  const role = options.role?.trim() ?? "";
  const status = options.status?.trim() ?? "";
  const where = `tenant_id = ?
    and (? = '' or ? = any(roles))
    and (? = '' or status = ?)
    and (? = '' or name ilike ? or trade_name ilike ? or document_digits like ?)`;
  const bindings = [tenantId, role, role, status, status, term, pattern, pattern, documentPattern];
  const count = await db
    .prepare(`select count(*)::integer as total from private.registry_parties where ${where}`)
    .bind(...bindings)
    .first<{ total: number }>();
  const rows = await db
    .prepare(
      `with matched as (
         select party_id, payload, name
         from private.registry_parties
         where ${where}
         order by name
         limit ? offset ?
       ), latest_position as (
         select max(position_date) as position_date
         from private.portfolio_title_positions
         where tenant_id = ?
       ), exposure as (
         select t.debtor_party_id,
                coalesce(sum(p.open_amount), 0)::float8 as open_amount,
                count(distinct t.cedent_party_id)::integer as cedent_count
         from private.portfolio_titles t
         join private.portfolio_title_positions p
           on p.tenant_id = t.tenant_id and p.title_id = t.title_id
         join latest_position latest on latest.position_date = p.position_date
         where t.tenant_id = ? and p.lifecycle_status = 'OPEN'
           and t.debtor_party_id in (select party_id from matched)
         group by t.debtor_party_id
       )
       select matched.payload,
              coalesce(exposure.open_amount, 0)::float8 as open_amount,
              coalesce(exposure.cedent_count, 0)::integer as cedent_count
       from matched
       left join exposure on exposure.debtor_party_id = matched.party_id
       order by matched.name`,
    )
    .bind(...bindings, options.limit, options.offset, tenantId, tenantId)
    .all<{ payload: Party; open_amount: number; cedent_count: number }>();
  return {
    items: rows.results.map(row => ({
      party: row.payload,
      openAmount: Number(row.open_amount),
      cedentCount: Number(row.cedent_count),
    })),
    total: Number(count?.total ?? 0),
  };
}

export async function loadRegistryPartyStats(db: DecisionDatabase, tenantId: string): Promise<RegistryPartyStats> {
  const rows = await db
    .prepare(
      `select role, count(*)::integer as total
       from private.registry_parties p
       cross join lateral unnest(p.roles) role
       where p.tenant_id = ? and p.status = 'Ativo'
       group by role`,
    )
    .bind(tenantId)
    .all<{ role: string; total: number }>();
  const totals = await db
    .prepare(
      `select count(*)::integer as total,
              count(*) filter (where status = 'Ativo')::integer as active
       from private.registry_parties where tenant_id = ?`,
    )
    .bind(tenantId)
    .first<{ total: number; active: number }>();
  return {
    total: Number(totals?.total ?? 0),
    active: Number(totals?.active ?? 0),
    byRole: Object.fromEntries(rows.results.map(row => [row.role, Number(row.total)])),
  };
}

export async function findRegistryPartyByDocument(
  db: DecisionDatabase,
  tenantId: string,
  document: string,
): Promise<Party | null> {
  const row = await db
    .prepare(`select payload from private.registry_parties where tenant_id = ? and document_digits = ?`)
    .bind(tenantId, onlyDigits(document))
    .first<{ payload: Party }>();
  return row?.payload ?? null;
}

export async function findRegistryPartyById(db: DecisionDatabase, tenantId: string, partyId: string) {
  const row = await db
    .prepare(`select payload from private.registry_parties where tenant_id = ? and party_id = ?`)
    .bind(tenantId, partyId)
    .first<{ payload: Party }>();
  return row?.payload ?? null;
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
        jsonParameter(party),
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
        jsonParameter({
          name: party.name,
          document: onlyDigits(party.document),
          status: party.status,
          roles: party.roles,
        }),
      ),
  ]);
}

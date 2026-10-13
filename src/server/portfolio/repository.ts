import type { Party } from "@/src/domain/registry/parties";
import type { PortfolioState, PortfolioTitleRecord } from "@/src/domain/portfolio/model";
import type { DecisionDatabase } from "@/src/server/decisions/repository";

type ImportedPortfolioRow = {
  title_id: string;
  document_number: string;
  receivable_type: string;
  negotiation_date: string;
  original_due_date: string;
  current_due_date: string;
  original_amount: number;
  wallet_code: string;
  internal_wallet: string;
  title_payload: Record<string, unknown>;
  position_date: string;
  open_amount: number;
  present_amount: number;
  paid_amount: number;
  discount_amount: number;
  discount_income: number;
  late_fee_amount: number;
  monetary_correction_amount: number;
  collection_agreement: boolean;
  collection_status: string;
  position_payload: Record<string, unknown>;
  cedent: Party;
  debtor: Party;
  company: string;
  institution: string;
};

const numberValue = (value: number) => Number(value ?? 0);

function importedTitle(row: ImportedPortfolioRow): PortfolioTitleRecord {
  const additionalNumber = String(row.title_payload.additionalNumber ?? "");
  const source = String(row.title_payload.sourceSystem ?? "Importação de carteira");
  return {
    id: row.title_id,
    status: "Em aberto",
    bankStatus: row.wallet_code ? "Registrado" : "Sem boleto",
    source: "Carteira anterior",
    importSource: "Planilha",
    receivableType: row.receivable_type,
    company: row.company,
    institution: row.institution,
    proposal: `Posição importada em ${row.position_date}`,
    aditivoNumber: additionalNumber,
    borderoNumber: row.internal_wallet || row.wallet_code,
    operationType: "Carteira importada",
    documentNumber: row.document_number,
    ownerName: row.cedent.name,
    ownerDocument: row.cedent.document,
    debtorName: row.debtor.name,
    debtorDocument: row.debtor.document,
    issueDate: row.negotiation_date,
    originalDueDate: row.original_due_date,
    dueDate: row.current_due_date,
    originalAmount: numberValue(row.original_amount),
    openAmount: numberValue(row.open_amount),
    paidAmount: numberValue(row.paid_amount),
    repurchasedAmount: 0,
    discountAmount: numberValue(row.discount_amount),
    abatementAmount: 0,
    payments: [],
    wallet: row.wallet_code,
    collectionInstruction: row.collection_status,
    collectionOccurrences: [],
    confirmation: { status: "Não iniciada" },
    events: [
      {
        id: `import-${row.title_id}`,
        at: row.position_date,
        by: "Importação controlada",
        action: "Entrada na carteira",
        detail: `${source} · saldo e posição preservados no banco.`,
      },
    ],
  };
}

export async function loadCurrentPortfolio(db: DecisionDatabase, tenantId: string): Promise<PortfolioState> {
  const rows = await db
    .prepare(
      `with latest as (
         select max(position_date) as position_date
         from private.portfolio_title_positions
         where tenant_id = ?
       )
       select t.title_id, t.document_number, t.receivable_type,
              t.negotiation_date::text, t.original_due_date::text, t.current_due_date::text,
              t.original_amount::float8, t.wallet_code, t.internal_wallet,
              t.payload as title_payload,
              p.position_date::text, p.open_amount::float8, p.present_amount::float8,
              p.paid_amount::float8, p.discount_amount::float8, p.discount_income::float8,
              p.late_fee_amount::float8, p.monetary_correction_amount::float8,
              p.collection_agreement, p.collection_status, p.payload as position_payload,
              cedent.payload as cedent, debtor.payload as debtor,
              coalesce(company.trade_name, company.legal_name, 'Carteira') as company,
              coalesce(company.institution_type, 'FIDC') as institution
       from private.portfolio_titles t
       join private.portfolio_title_positions p
         on p.tenant_id = t.tenant_id and p.title_id = t.title_id
       join latest on latest.position_date = p.position_date
       join private.registry_parties cedent
         on cedent.tenant_id = t.tenant_id and cedent.party_id = t.cedent_party_id
       join private.registry_parties debtor
         on debtor.tenant_id = t.tenant_id and debtor.party_id = t.debtor_party_id
       left join private.company_profiles company on company.tenant_id = t.tenant_id
       where t.tenant_id = ? and p.lifecycle_status = 'OPEN' and p.open_amount > 0
       order by p.computed_days_past_due desc, t.current_due_date, t.title_id`,
    )
    .bind(tenantId, tenantId)
    .all<ImportedPortfolioRow>();
  const positionDate = rows.results[0]?.position_date;
  const historical = await db
    .prepare(`select count(*)::integer as total from private.portfolio_titles where tenant_id = ?`)
    .bind(tenantId)
    .first<{ total: number }>();
  return {
    version: 3,
    titles: rows.results.map(importedTitle),
    positionDate,
    historicalTitleCount: Number(historical?.total ?? rows.results.length),
  };
}

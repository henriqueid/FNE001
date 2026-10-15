import type { Party, PartyBankAccount } from "@/src/domain/registry/parties";
import { jsonParameter } from "@/src/server/database/postgres";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { saveRegistryParty } from "@/src/server/registry/repository";

export type BankAccountChangeStatus = "PENDING" | "APPROVED" | "REJECTED";

export type BankAccountChange = {
  changeId: string;
  partyId: string;
  partyName: string;
  previousAccounts: PartyBankAccount[];
  proposedAccounts: PartyBankAccount[];
  reason: string;
  status: BankAccountChangeStatus;
  requestedBy: string;
  requestedByName: string;
  requestedAt: string;
  decidedBy?: string;
  decidedByName?: string;
  decidedAt?: string;
  decisionReason?: string;
  appliedAt?: string;
};

type ChangeRow = {
  change_id: string;
  party_id: string;
  party_name: string;
  previous_accounts: PartyBankAccount[];
  proposed_accounts: PartyBankAccount[];
  reason: string;
  status: BankAccountChangeStatus;
  requested_by: string;
  requested_by_name: string;
  requested_at: string;
  decided_by: string | null;
  decided_by_name: string | null;
  decided_at: string | null;
  decision_reason: string | null;
  applied_at: string | null;
};

const selectColumns = `c.change_id, c.party_id, p.name as party_name,
  c.previous_accounts, c.proposed_accounts, c.reason, c.status,
  c.requested_by, requester.name as requested_by_name, c.requested_at::text,
  c.decided_by, decider.name as decided_by_name, c.decided_at::text,
  c.decision_reason, c.applied_at::text`;

function fromRow(row: ChangeRow): BankAccountChange {
  return {
    changeId: row.change_id,
    partyId: row.party_id,
    partyName: row.party_name,
    previousAccounts: row.previous_accounts,
    proposedAccounts: row.proposed_accounts,
    reason: row.reason,
    status: row.status,
    requestedBy: row.requested_by,
    requestedByName: row.requested_by_name,
    requestedAt: row.requested_at,
    decidedBy: row.decided_by ?? undefined,
    decidedByName: row.decided_by_name ?? undefined,
    decidedAt: row.decided_at ?? undefined,
    decisionReason: row.decision_reason ?? undefined,
    appliedAt: row.applied_at ?? undefined,
  };
}

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

export function bankAccountProposalError(accounts: PartyBankAccount[], reason: string) {
  if (reason.trim().length < 10) return "Informe um motivo com pelo menos 10 caracteres.";
  const ids = new Set<string>();
  let main = 0;
  for (const account of accounts) {
    if (!account.id.trim() || ids.has(account.id)) return "Cada conta bancária precisa ter um identificador único.";
    ids.add(account.id);
    if (!(account.bank.trim() && account.agency.trim() && account.account.trim()))
      return "Banco, agência e conta são obrigatórios.";
    if (account.holderDocument.replace(/\D/g, "").length < 11) return "O CPF/CNPJ do titular da conta está incompleto.";
    if (account.main) main += 1;
  }
  if (accounts.length && main !== 1) return "Defina exatamente uma conta bancária como principal.";
  return null;
}

export async function listBankAccountChanges(db: DecisionDatabase, tenantId: string, status?: BankAccountChangeStatus) {
  const result = await db
    .prepare(
      `select ${selectColumns}
       from private.registry_bank_account_changes c
       join private.registry_parties p on p.tenant_id = c.tenant_id and p.party_id = c.party_id
       join private.access_users requester on requester.user_id = c.requested_by
       left join private.access_users decider on decider.user_id = c.decided_by
       where c.tenant_id = ? and (? = '' or c.status = ?)
       order by case when c.status = 'PENDING' then 0 else 1 end, c.requested_at desc`,
    )
    .bind(tenantId, status ?? "", status ?? "")
    .all<ChangeRow>();
  return result.results.map(fromRow);
}

export async function requestBankAccountChange(
  db: DecisionDatabase,
  tenantId: string,
  actorId: string,
  partyId: string,
  proposedAccounts: PartyBankAccount[],
  reason: string,
) {
  const error = bankAccountProposalError(proposedAccounts, reason);
  if (error) throw new Error(error);
  const work = async (transaction: DecisionDatabase) => {
    const party = await transaction
      .prepare(`select payload from private.registry_parties where tenant_id = ? and party_id = ? for update`)
      .bind(tenantId, partyId)
      .first<{ payload: Party }>();
    if (!party) throw new Error("Cadastro não encontrado.");
    if (same(party.payload.bankAccounts, proposedAccounts))
      throw new Error("As contas propostas são iguais às atuais.");
    const changeId = crypto.randomUUID();
    await transaction
      .prepare(
        `insert into private.registry_bank_account_changes
          (tenant_id, change_id, party_id, previous_accounts, proposed_accounts, reason, requested_by)
         values (?, ?, ?, ?::jsonb, ?::jsonb, ?, ?)`,
      )
      .bind(
        tenantId,
        changeId,
        partyId,
        jsonParameter(party.payload.bankAccounts),
        jsonParameter(proposedAccounts),
        reason.trim(),
        actorId,
      )
      .run();
    return changeId;
  };
  return db.transaction ? db.transaction(work) : work(db);
}

export async function decideBankAccountChange(
  db: DecisionDatabase,
  tenantId: string,
  actor: { id: string; name: string },
  changeId: string,
  decision: "APPROVED" | "REJECTED",
  decisionReason: string,
  now = new Date().toISOString(),
) {
  if (decisionReason.trim().length < 5) throw new Error("Informe o motivo da decisão com pelo menos 5 caracteres.");
  const work = async (transaction: DecisionDatabase) => {
    const row = await transaction
      .prepare(
        `select c.*, p.payload
         from private.registry_bank_account_changes c
         join private.registry_parties p on p.tenant_id = c.tenant_id and p.party_id = c.party_id
         where c.tenant_id = ? and c.change_id = ? for update of c, p`,
      )
      .bind(tenantId, changeId)
      .first<{
        party_id: string;
        previous_accounts: PartyBankAccount[];
        proposed_accounts: PartyBankAccount[];
        requested_by: string;
        status: BankAccountChangeStatus;
        payload: Party;
      }>();
    if (!row) throw new Error("Solicitação não encontrada.");
    if (row.status !== "PENDING") throw new Error("Esta solicitação já recebeu uma decisão.");
    if (row.requested_by === actor.id) throw new Error("Quem solicitou não pode decidir a própria alteração bancária.");

    if (decision === "APPROVED") {
      if (!same(row.payload.bankAccounts, row.previous_accounts))
        throw new Error("O cadastro mudou depois da solicitação. Rejeite-a e prepare uma nova alteração.");
      const party: Party = {
        ...row.payload,
        bankAccounts: row.proposed_accounts,
        updatedAt: now,
        history: [
          ...(row.payload.history ?? []),
          {
            at: now,
            by: actor.name,
            action: "Contas bancárias aprovadas",
            field: "bankAccounts",
            reason: decisionReason.trim(),
            origin: "Maker-checker",
          },
        ],
      };
      await saveRegistryParty(transaction, tenantId, actor.id, party);
    }

    await transaction
      .prepare(
        `update private.registry_bank_account_changes
         set status = ?, decided_by = ?, decided_at = ?::timestamptz, decision_reason = ?,
             applied_at = case when ? = 'APPROVED' then ?::timestamptz else null end
         where tenant_id = ? and change_id = ? and status = 'PENDING'`,
      )
      .bind(decision, actor.id, now, decisionReason.trim(), decision, now, tenantId, changeId)
      .run();
    return { decision, partyId: row.party_id };
  };
  return db.transaction ? db.transaction(work) : work(db);
}

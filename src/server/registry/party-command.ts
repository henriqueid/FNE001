/** Grava cadastro público com versão, motivo e histórico produzidos no servidor. */
import { partyChanges } from "@/src/domain/registry/party-save";
import {
  defaultRoleData,
  partyRoles,
  validateParty,
  type Party,
  type PartyRole,
  type CedentRoleData,
} from "@/src/domain/registry/parties";
import { isDeepStrictEqual } from "node:util";
import {
  defaultOperationalParameters,
  emptyOperationalDefaults,
  validateOperationalDefaults,
} from "@/src/domain/registry/operational-profile";
import { loadOperationalParameterState } from "./operational-parameter-requests";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import {
  findRegistryPartyByDocument,
  findRegistryPartyById,
  loadCompanyDestinations,
  loadCompanyProfile,
  saveRegistryParty,
} from "./repository";

export class RegistryCommandError extends Error {
  constructor(
    message: string,
    readonly status: number,
  ) {
    super(message);
  }
}

const record = (value: unknown): value is Record<string, unknown> =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function matchesTemplate(
  value: unknown,
  template: Record<string, unknown>,
  optional: string[] = [],
  special: string[] = [],
): boolean {
  if (!record(value) || Object.keys(value).some(key => !Object.hasOwn(template, key) && !optional.includes(key)))
    return false;
  return (
    Object.entries(template).every(([key, example]) => {
      const item = value[key];
      if ((optional.includes(key) || special.includes(key)) && item === undefined) return true;
      if (special.includes(key)) return true;
      if (Array.isArray(example)) return Array.isArray(item) && item.every(entry => typeof entry === "string");
      if (record(example)) return matchesTemplate(item, example);
      if (typeof example === "number") return typeof item === "number" && Number.isFinite(item) && item >= 0;
      return typeof item === typeof example;
    }) &&
    optional.every(key => Object.hasOwn(template, key) || value[key] === undefined || typeof value[key] === "string")
  );
}

function roleDataShape(party: Party) {
  if (!record(party.roleData) || party.roles.some(role => !party.roleData[role])) return false;
  for (const [role, data] of Object.entries(party.roleData)) {
    if (!partyRoles.some(item => item.id === role)) return false;
    const template = defaultRoleData(role as PartyRole)!;
    const optional =
      role === "cedente"
        ? ["managerId", "contract", "compliance", "requiresLastroPrecheck"]
        : role === "representante"
          ? ["repId"]
          : [];
    if (
      !matchesTemplate(
        data,
        template as unknown as Record<string, unknown>,
        optional,
        role === "cedente" ? ["operationalOverrides", "tranches"] : [],
      )
    )
      return false;
  }
  const cedent = party.roleData.cedente;
  if (cedent) {
    if (!["Com regresso", "Sem regresso"].includes(cedent.guarantee)) return false;
    if (
      cedent.operationalOverrides !== undefined &&
      (!record(cedent.operationalOverrides) ||
        Object.entries(cedent.operationalOverrides).some(([key, value]) => {
          const example = defaultOperationalParameters[key as keyof typeof defaultOperationalParameters];
          return (
            example === undefined ||
            typeof value !== typeof example ||
            (typeof value === "number" && !Number.isFinite(value))
          );
        }))
    )
      return false;
    if (cedent.compliance && !["Pendente", "Em análise", "Aprovado", "Reprovado"].includes(cedent.compliance.kycStatus))
      return false;
    if (cedent.contract?.allowedInstitutions.some(value => !["Factoring", "Securitizadora", "FIDC"].includes(value)))
      return false;
  }
  if (party.roleData.representante && !["CLT", "Agente autônomo"].includes(party.roleData.representante.repKind))
    return false;
  if (party.roleData.avalista && !["Aval", "Fiança"].includes(party.roleData.avalista.kind)) return false;
  if (
    party.roleData.cotista &&
    !["Sênior", "Mezanino", "Subordinada", "Única"].includes(party.roleData.cotista.quotaClass)
  )
    return false;
  return true;
}

function creditSnapshot(party?: Party, includeTranches = true) {
  const data = party?.roleData.cedente;
  const fallback = defaultRoleData("cedente") as CedentRoleData;
  return {
    debtorLimit: party?.roleData.sacado?.creditLimit ?? 0,
    guarantorLimit: party?.roleData.avalista?.limit ?? 0,
    guaranteedDocument:
      (party?.roleData.avalista?.limit ?? 0) > 0 ? (party?.roleData.avalista?.guaranteedDocument ?? "") : "",
    guaranteeKind: (party?.roleData.avalista?.limit ?? 0) > 0 ? (party?.roleData.avalista?.kind ?? "Aval") : "Aval",
    monthlyRate: data?.monthlyRate ?? fallback.monthlyRate,
    contractUntil: data?.contractUntil ?? "",
    guarantee: data?.guarantee ?? fallback.guarantee,
    requiresLastroPrecheck: data?.requiresLastroPrecheck ?? false,
    overrides: data?.operationalOverrides ?? {},
    tranches: includeTranches ? (data?.tranches ?? []) : [],
    contract: {
      validFrom: data?.contract?.validFrom ?? "",
      validUntil: data?.contract?.validUntil ?? "",
      automaticRenewal: data?.contract?.automaticRenewal ?? false,
      allowedInstitutions: data?.contract?.allowedInstitutions ?? [],
      allowedReceivables: data?.contract?.allowedReceivables ?? [],
    },
  };
}

function partyShape(value: unknown): value is Party {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const party = value as Party;
  const strings = [
    party.id,
    party.document,
    party.name,
    party.tradeName,
    party.birthOrFoundation,
    party.stateRegistration,
    party.email,
    party.phone,
    party.notes,
  ];
  if (strings.some(item => typeof item !== "string") || !party.id.trim()) return false;
  if (!["PF", "PJ"].includes(party.kind) || !["Ativo", "Inativo"].includes(party.status)) return false;
  if (!Array.isArray(party.roles) || !party.roles.every(role => partyRoles.some(item => item.id === role)))
    return false;
  if (
    !party.address ||
    ["zipCode", "street", "number", "complement", "district", "city", "state"].some(
      key => typeof party.address[key as keyof Party["address"]] !== "string",
    )
  )
    return false;
  if (
    !Array.isArray(party.bankAccounts) ||
    !Array.isArray(party.contacts) ||
    !party.roleData ||
    typeof party.roleData !== "object"
  )
    return false;
  if (
    party.bankAccounts.some(
      account =>
        !account ||
        [account.id, account.bank, account.agency, account.account, account.pixKey, account.holderDocument].some(
          item => typeof item !== "string",
        ) ||
        typeof account.main !== "boolean",
    )
  )
    return false;
  if (
    party.contacts.some(
      contact =>
        !contact ||
        [contact.id, contact.name, contact.area, contact.email, contact.phone].some(item => typeof item !== "string"),
    )
  )
    return false;
  if (!roleDataShape(party)) return false;
  const tranches = party.roleData.cedente?.tranches;
  if (tranches !== undefined) {
    if (
      !Array.isArray(tranches) ||
      tranches.some(tranche => {
        if (!tranche || typeof tranche !== "object" || Array.isArray(tranche)) return true;
        if (
          [
            tranche.id,
            tranche.name,
            tranche.institution,
            tranche.vehicle,
            tranche.modality,
            tranche.receivableType,
            tranche.validUntil,
          ].some(item => typeof item !== "string")
        )
          return true;
        if (
          [tranche.amount, tranche.priority].some(
            item => typeof item !== "number" || !Number.isFinite(item) || item < 0,
          ) ||
          !Number.isInteger(tranche.priority) ||
          tranche.priority < 1
        )
          return true;
        if ([tranche.active, tranche.allowSharing].some(item => typeof item !== "boolean")) return true;
        if (!["Todos", "Factoring", "Securitizadora", "FIDC"].includes(tranche.institution)) return true;
        return [
          tranche.maximumOperationAmount,
          tranche.monthlyRate,
          tranche.maximumTermDays,
          tranche.maximumDebtorConcentrationPercent,
        ].some(item => item !== undefined && (typeof item !== "number" || !Number.isFinite(item) || item < 0));
      })
    )
      return false;
  }
  if (party.roleData.debenturista && typeof party.roleData.debenturista.series !== "string") return false;
  return true;
}

export async function executeRegistryPartyCommand(
  db: DecisionDatabase,
  tenantId: string,
  principal: Pick<ServerPrincipal, "id" | "name" | "permissions" | "authorityIds" | "companyScopes">,
  input: unknown,
) {
  if (!principal.permissions.includes("registry:edit"))
    throw new RegistryCommandError("Sem permissão para editar cadastros.", 403);
  const body = input && typeof input === "object" && !Array.isArray(input) ? (input as Record<string, unknown>) : {};
  const candidate = "party" in body ? body.party : body;
  if (!partyShape(candidate)) throw new RegistryCommandError("Cadastro inválido.", 400);
  const reason = typeof body.reason === "string" ? body.reason.trim() : "";
  return inTenantFinanceTransaction(db, tenantId, async transaction => {
    const current = await findRegistryPartyById(transaction, tenantId, candidate.id, true);
    if (current && !reason)
      throw new RegistryCommandError("Informe o motivo da alteração para manter a auditoria.", 400);
    if (current && body.expectedUpdatedAt !== current.updatedAt)
      throw new RegistryCommandError("O cadastro mudou. Recarregue a ficha antes de salvar.", 409);
    const sameDocument = await findRegistryPartyByDocument(transaction, tenantId, candidate.document);
    const issue = validateParty(candidate, sameDocument ? [sameDocument] : []).find(item => item.blocking);
    if (issue) throw new RegistryCommandError(issue.message, 400);
    if (JSON.stringify(current?.bankAccounts ?? []) !== JSON.stringify(candidate.bankAccounts))
      throw new RegistryCommandError(
        "Alterações de contas bancárias exigem solicitação e aprovação por outra pessoa no fluxo de segurança do Cadastro.",
        409,
      );
    if ((current?.roleData.cedente?.creditLimit ?? 0) !== (candidate.roleData.cedente?.creditLimit ?? 0))
      throw new RegistryCommandError(
        "O limite aprovado é alterado por decisão do comitê no Comercial, não pela gravação cadastral.",
        403,
      );
    const cedent = candidate.roleData.cedente;
    if (cedent) {
      const defaults = (await loadOperationalParameterState(transaction, tenantId)) ?? emptyOperationalDefaults();
      const effective = { ...defaults.general, monthlyRate: cedent.monthlyRate, ...cedent.operationalOverrides };
      const parameterError = validateOperationalDefaults({ ...defaults, general: effective });
      if (parameterError) throw new RegistryCommandError(parameterError, 400);
      for (const tranche of cedent.tranches ?? []) {
        const overrides = Object.fromEntries(
          Object.entries({
            monthlyRate: tranche.monthlyRate,
            maximumOperationAmount: tranche.maximumOperationAmount,
            maximumTermDays: tranche.maximumTermDays,
            maximumDebtorConcentrationPercent: tranche.maximumDebtorConcentrationPercent,
          }).filter(([, value]) => value !== undefined),
        );
        const trancheError = validateOperationalDefaults({ ...defaults, general: { ...effective, ...overrides } });
        if (trancheError) throw new RegistryCommandError(`Tranche ${tranche.name}: ${trancheError}`, 400);
      }
    }
    if (!isDeepStrictEqual(creditSnapshot(current ?? undefined), creditSnapshot(candidate))) {
      if (!principal.permissions.includes("risk:decide") || !principal.authorityIds?.includes("credit-director"))
        throw new RegistryCommandError(
          "Alterar condições de crédito exige alçada de Diretoria de crédito e permissão de decisão de risco.",
          403,
        );
      const tranches = [
        ...(current?.roleData.cedente?.tranches ?? []),
        ...(candidate.roleData.cedente?.tranches ?? []),
      ];
      if (tranches.some(tranche => tranche.vehicle.trim() && !principalHasCompanyScope(principal, tranche.vehicle)))
        throw new RegistryCommandError("A tranche pertence a uma empresa fora do seu acesso.", 403);
      const globalChange = !isDeepStrictEqual(
        creditSnapshot(current ?? undefined, false),
        creditSnapshot(candidate, false),
      );
      if (
        (globalChange || tranches.some(tranche => !tranche.vehicle.trim())) &&
        !principal.companyScopes.includes("*")
      ) {
        const destinations = await loadCompanyDestinations(transaction, tenantId);
        const primary = destinations.length ? null : await loadCompanyProfile(transaction, tenantId);
        const companies = destinations.filter(item => item.status === "ACTIVE").map(item => item.name);
        if (primary) companies.push(primary.tradeName);
        if (companies.some(company => !principalHasCompanyScope(principal, company)))
          throw new RegistryCommandError("A condição global de crédito afeta empresas fora do seu acesso.", 403);
      }
    }
    const now = new Date().toISOString();
    const party: Party = {
      ...candidate,
      createdAt: current?.createdAt ?? now,
      updatedAt: now,
      origin: current?.origin ?? "Cadastro",
      history: current?.history ?? [],
    };
    const changes = current ? partyChanges(current, party) : [{ field: "cadastro", from: "—", to: "Criado" }];
    if (!changes.length) throw new RegistryCommandError("Nenhuma alteração foi identificada no cadastro.", 400);
    party.history = [
      ...party.history,
      ...changes.map(change => ({
        ...change,
        at: now,
        by: principal.name,
        action: current ? "Campo alterado" : "Cadastro criado",
        reason: reason || "Cadastro inicial",
        origin: "Cadastro",
      })),
    ];
    await saveRegistryParty(transaction, tenantId, principal.id, party);
    return party;
  });
}

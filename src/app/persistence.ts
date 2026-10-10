/**
 * Persistência da demonstração no navegador (localStorage).
 *
 * Cada área tem sua chave versionada. Ao restaurar, os registros salvos são mesclados com os
 * dados de demonstração atuais (migração), para que campos novos não quebrem dados antigos.
 * Tudo é tolerante a falha: sem armazenamento, o app segue só na memória.
 */
import { isAccountManager, type CommercialState } from "@/src/domain/commercial/types";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { type FinanceState } from "@/src/domain/finance/model";
import { migrateEligibilityPolicyState, type EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import { ensureChart } from "@/src/domain/finance/setup";
import { datePrefix } from "@/src/domain/operations/dates";
import { migratePortfolioState, type PortfolioState, type StoredPortfolioState } from "@/src/domain/portfolio/model";
import { type Party } from "@/src/domain/registry/parties";
import { migrateOperationalDefaults, type OperationalDefaultsState } from "@/src/domain/registry/operational-profile";
import { migrateIntegrationState, type IntegrationState } from "@/src/domain/integrations/model";
import { migrateTaskState, type TaskState } from "@/src/domain/tasks/model";

export const STORAGE_KEYS = {
  operations: "lastro-mvp-operations-v3",
  debtors: "lastro-mvp-debtors-v1",
  finance: "strato-finance-v2",
  commercial: "strato-commercial-v1",
  parties: "strato-parties-v1",
  portfolio: "strato-portfolio-v1",
  policies: "strato-eligibility-policies-v2",
  integrations: "strato-integrations-v1",
  operationalDefaults: "strato-operational-defaults-v1",
  tasks: "strato-tasks-v1",
  guidance: "lastro-interface-guidance-v1",
  journey: "strato-journey-bar-v1",
} as const;

export type PersistedState = {
  operations: Operation[];
  debtors: Debtor[];
  finance: FinanceState;
  commercial: CommercialState;
  parties: Party[];
  portfolio: PortfolioState;
  policies: EligibilityPolicyState;
  integrations: IntegrationState;
  operationalDefaults: OperationalDefaultsState;
  tasks: TaskState;
};

/** Mescla operações salvas com a versão atual dos dados de demonstração. */
export function migrateStoredOperations(restored: Operation[]): Operation[] {
  return restored.map((operation, index) => {
    const baseline = initialOperations.find(item => item.id === operation.id);
    const migrated =
      operation.id === "op-3407" && operation.stage === 5 && operation.status === "Aguardando terceiro"
        ? { ...operation, ...initialOperations[1] }
        : operation;
    const invalidLegacyIdentifiers = !baseline && !/^\d{7}$/.test(migrated.borderoNumber ?? "");
    return {
      ...baseline,
      ...migrated,
      elapsedMinutes: migrated.elapsedMinutes ?? baseline?.elapsedMinutes ?? 0,
      clientAverageMinutes: migrated.clientAverageMinutes ?? baseline?.clientAverageMinutes ?? 0,
      historySample: migrated.historySample ?? baseline?.historySample ?? 0,
      manualEntry: migrated.manualEntry?.entries?.length ? migrated.manualEntry : baseline?.manualEntry,
      riskReview:
        baseline?.riskReview || migrated.riskReview
          ? {
              ...baseline?.riskReview,
              ...migrated.riskReview,
              debtorDecisions: {
                ...baseline?.riskReview?.debtorDecisions,
                ...migrated.riskReview?.debtorDecisions,
              },
              titleDecisions: {
                ...baseline?.riskReview?.titleDecisions,
                ...migrated.riskReview?.titleDecisions,
              },
              audit: migrated.riskReview?.audit?.length ? migrated.riskReview.audit : baseline?.riskReview?.audit,
            }
          : undefined,
      lastroReview:
        baseline?.lastroReview || migrated.lastroReview
          ? { items: { ...baseline?.lastroReview?.items, ...migrated.lastroReview?.items } }
          : undefined,
      aditivoNumber: invalidLegacyIdentifiers
        ? `${datePrefix()}${String(5 + index).padStart(3, "0")}`
        : (migrated.aditivoNumber ?? baseline?.aditivoNumber ?? `${datePrefix()}${String(5 + index).padStart(3, "0")}`),
      borderoNumber: invalidLegacyIdentifiers
        ? String(3409 + index).padStart(7, "0")
        : (migrated.borderoNumber ?? baseline?.borderoNumber ?? String(3409 + index).padStart(7, "0")),
    } as Operation;
  });
}

/** Mescla sacados salvos com o histórico de crédito atual dos dados de demonstração. */
export function migrateStoredDebtors(restored: Debtor[]): Debtor[] {
  return restored.map(debtor => {
    const baseline = initialDebtors.find(
      item => item.id === debtor.id || item.document.replace(/\D/g, "") === debtor.document.replace(/\D/g, ""),
    );
    return {
      ...baseline,
      ...debtor,
      score: debtor.score ?? baseline?.score,
      portfolioReceivable: debtor.portfolioReceivable ?? baseline?.portfolioReceivable,
      portfolioOverdue: debtor.portfolioOverdue ?? baseline?.portfolioOverdue,
      settlements: debtor.settlements ?? baseline?.settlements,
      lateSettlements: debtor.lateSettlements ?? baseline?.lateSettlements,
      averageDelayDays: debtor.averageDelayDays ?? baseline?.averageDelayDays,
      repurchases: debtor.repurchases ?? baseline?.repurchases,
      incidents: debtor.incidents ?? baseline?.incidents,
      publicStatus: debtor.publicStatus ?? baseline?.publicStatus,
      scoreReasons: debtor.scoreReasons ?? baseline?.scoreReasons,
      incidentDetails: debtor.incidentDetails ?? baseline?.incidentDetails,
      portfolioMetrics: debtor.portfolioMetrics ?? baseline?.portfolioMetrics,
      groupName: debtor.groupName ?? baseline?.groupName,
      groupCompanies: debtor.groupCompanies ?? baseline?.groupCompanies,
      groupExposure: debtor.groupExposure ?? baseline?.groupExposure,
      groupOverdue: debtor.groupOverdue ?? baseline?.groupOverdue,
      groupScore: debtor.groupScore ?? baseline?.groupScore,
    } as Debtor;
  });
}

const read = <T>(key: string): T | null => {
  const raw = window.localStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : null;
};

/** Completa vínculos antigos com um gerente de conta real, preservando os demais dados locais. */
export function migrateCommercialState(state: CommercialState): CommercialState {
  const managerId = state.reps.find(rep => rep.active && isAccountManager(rep))?.id;
  return {
    ...state,
    links: state.links.map(link => ({ ...link, managerId: link.managerId ?? managerId })),
  };
}

/** Lê o que houver salvo; áreas ausentes ou inválidas voltam como `undefined`. */
export function loadPersistedState(): Partial<PersistedState> & { guidance?: boolean; journey?: boolean } {
  try {
    const operations = read<Operation[]>(STORAGE_KEYS.operations);
    const debtors = read<Debtor[]>(STORAGE_KEYS.debtors);
    const finance = read<FinanceState>(STORAGE_KEYS.finance);
    const commercial = read<CommercialState>(STORAGE_KEYS.commercial);
    const parties = read<Party[]>(STORAGE_KEYS.parties);
    const portfolio = read<StoredPortfolioState>(STORAGE_KEYS.portfolio);
    const policies = read<unknown>(STORAGE_KEYS.policies);
    const integrations = read<unknown>(STORAGE_KEYS.integrations);
    const operationalDefaults = read<unknown>(STORAGE_KEYS.operationalDefaults);
    const tasks = read<unknown>(STORAGE_KEYS.tasks);
    window.localStorage.removeItem("strato-eligibility-policies-v1");
    const guidance = window.localStorage.getItem(STORAGE_KEYS.guidance);
    const journey = window.localStorage.getItem(STORAGE_KEYS.journey);
    const migratedOperations = operations ? migrateStoredOperations(operations) : undefined;
    return {
      operations: migratedOperations,
      debtors: debtors ? migrateStoredDebtors(debtors) : undefined,
      finance: finance?.version === 1 && Array.isArray(finance.accounts) ? ensureChart(finance) : undefined,
      commercial:
        commercial?.version === 1 && Array.isArray(commercial.reps) ? migrateCommercialState(commercial) : undefined,
      parties: Array.isArray(parties) ? parties : undefined,
      portfolio:
        portfolio && [1, 2, 3].includes(portfolio.version) && Array.isArray(portfolio.titles)
          ? migratePortfolioState(portfolio, migratedOperations ?? initialOperations)
          : undefined,
      policies: migrateEligibilityPolicyState(policies),
      integrations: migrateIntegrationState(integrations),
      operationalDefaults: migrateOperationalDefaults(operationalDefaults),
      tasks: migrateTaskState(tasks),
      guidance: guidance === null ? undefined : guidance === "true",
      journey: journey === null ? undefined : journey === "true",
    };
  } catch {
    return {};
  }
}

export function savePersistedState(state: PersistedState) {
  try {
    const { carteiraEvents: _transient, ...commercial } = state.commercial;
    void _transient;
    window.localStorage.setItem(STORAGE_KEYS.operations, JSON.stringify(state.operations));
    window.localStorage.setItem(STORAGE_KEYS.debtors, JSON.stringify(state.debtors));
    window.localStorage.setItem(STORAGE_KEYS.finance, JSON.stringify(state.finance));
    window.localStorage.setItem(STORAGE_KEYS.commercial, JSON.stringify(commercial));
    window.localStorage.setItem(STORAGE_KEYS.parties, JSON.stringify(state.parties));
    window.localStorage.setItem(STORAGE_KEYS.portfolio, JSON.stringify(state.portfolio));
    window.localStorage.setItem(STORAGE_KEYS.policies, JSON.stringify(state.policies));
    window.localStorage.setItem(STORAGE_KEYS.integrations, JSON.stringify(state.integrations));
    window.localStorage.setItem(STORAGE_KEYS.operationalDefaults, JSON.stringify(state.operationalDefaults));
    window.localStorage.setItem(STORAGE_KEYS.tasks, JSON.stringify(state.tasks));
  } catch {
    /* sem armazenamento: a demonstração segue só na memória */
  }
}

export function saveGuidance(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.guidance, String(value));
  } catch {
    /* sem armazenamento */
  }
}

/** Barra da jornada ("Você está em" e "Entenda esta tela"): oculta por padrão, ligada nas Configurações. */
export function saveJourneyBar(value: boolean) {
  try {
    window.localStorage.setItem(STORAGE_KEYS.journey, String(value));
  } catch {
    /* sem armazenamento */
  }
}

/** Apaga tudo o que a demonstração gravou (usado por "Restaurar dados de demonstração"). */
export function clearPersistedState() {
  try {
    [
      STORAGE_KEYS.operations,
      STORAGE_KEYS.debtors,
      STORAGE_KEYS.finance,
      STORAGE_KEYS.commercial,
      STORAGE_KEYS.parties,
      STORAGE_KEYS.portfolio,
      STORAGE_KEYS.policies,
      STORAGE_KEYS.integrations,
      STORAGE_KEYS.operationalDefaults,
      STORAGE_KEYS.tasks,
    ].forEach(key => window.localStorage.removeItem(key));
  } catch {
    /* sem armazenamento */
  }
}

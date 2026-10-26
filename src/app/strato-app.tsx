"use client";

/**
 * Raiz da aplicação (cliente). Dono do estado global — operações, sacados, financeiro, comercial e cadastro —,
 * da persistência em localStorage e da navegação entre módulos. Deriva o cadastro único (`RegistryContext`) e o
 * contexto do shell (`ShellContext`) e escolhe a tela pela `view` atual ou pela operação aberta.
 */
import { normalizedPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { Badge } from "@/src/features/operations/components/status";
import type { NewOperationInput } from "@/src/features/operations/new-operation/new-operation-modal";
import { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedState,
  loadPersistedState,
  saveGuidance,
  saveJourneyBar,
  savePersistedState,
} from "./persistence";
import { buildNewOperation } from "@/src/domain/operations/create-operation";
import { operationMutationPermissionError } from "@/src/domain/operations/mutation-permissions";

import { managerOf, repAt } from "@/src/domain/commercial/rules";
import { emptyCommercial, seedCommercial } from "@/src/domain/commercial/seed";
import { prepareCommissionTransfer } from "@/src/domain/commercial/finance-transfer";
import { type CommercialState } from "@/src/domain/commercial/types";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { type Effect } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import { payableKey, syncReleases } from "@/src/domain/finance/releases";
import { emptyFinance, seedFinance } from "@/src/domain/finance/setup";
import { isoDate, portfolioTitles } from "@/src/domain/home/metrics";
import { demoCedentHistories, demoDebtorHistories } from "@/src/domain/core/demo/quality-history";
import { qualityByDocument, scoredCedent, scoredDebtor } from "@/src/domain/risk/quality-scores";
import { portfolioQualityHistories } from "@/src/domain/risk/portfolio-quality-history";
import { QualityContext, type QualityValue, useQualityPolicyState } from "@/src/features/risk/use-quality-policy";
import { mergeParties, type Party, partyToCedent, partyToDebtor, seedParties } from "@/src/domain/registry/parties";
import { saveParty as savePartyRecord } from "@/src/domain/registry/party-save";
import { syncCommercialOnboardingParties } from "@/src/domain/registry/commercial-onboarding";
import { buildRegistry, effectiveCedents, repurchaseEvents } from "@/src/domain/registry/registry";
import { portfolioHomeTitles, seedPortfolio, syncPortfolio } from "@/src/domain/portfolio/model";
import { Shell } from "@/src/features/shell/shell";
import { type AppView, ShellContext } from "@/src/features/shell/shell-context";
import { RegistryContext, type RegistryValue } from "./registry-context";
import { EligibilityPolicyProvider } from "./eligibility-policy-context";
import {
  emptyEligibilityPolicies,
  seedEligibilityPolicies,
  type EligibilityPolicyState,
} from "@/src/domain/eligibility/policy-library";
import { emptyIntegrationState, seedIntegrationState } from "@/src/domain/integrations/model";
import { IntegrationProvider } from "./integration-context";
import { emptyOperationalDefaults, seedOperationalDefaults } from "@/src/domain/registry/operational-profile";
import {
  buildDailyBriefing,
  demoAdminUser,
  operationsForUser,
  withAssignedTasks,
} from "@/src/domain/copilot/daily-briefing";
import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import {
  actionableAttentionItems,
  applyTaskCommand,
  managedTasks,
  rebaseTaskState,
  reconcileTasks,
  seedTaskState,
  taskIsExplicitlyAssigned,
  type TaskCommand,
  type TaskState,
  visibleTasksForUser,
} from "@/src/domain/tasks/model";
import {
  type AccessState,
  activeUser,
  authenticatedUser,
  can,
  canAccessView,
  defaultViewFor,
  emptyAccessState,
  seedAccessState,
  stopUserPreview,
} from "@/src/domain/access/model";
import { emptyIntelligenceState, seedIntelligenceState, type IntelligenceState } from "@/src/domain/intelligence/model";
import { type PublishedNotification } from "@/src/domain/notifications/model";
import { loadAccessDirectory } from "./access-directory-client";
import { syncPublishedNotifications } from "./notification-client";
import { useHomeRadar } from "./use-home-radar";
import { useStratoAuth } from "@/src/features/auth/auth-context";
import { loadRegistryParties, persistRegistryParty } from "./registry-client";
import { useCompanyDestinations } from "./company-context";
import {
  loadOperations as loadServerOperations,
  persistOperation as persistServerOperation,
} from "./operations-client";
import { loadFinanceState as loadServerFinance, persistFinanceState as persistServerFinance } from "./finance-client";
import { loadCurrentPortfolio, persistPortfolioState as persistServerPortfolio } from "./portfolio-client";
import {
  loadTaskState as loadServerTasks,
  persistTaskState as persistServerTasks,
  TaskPersistenceError,
} from "./tasks-client";
import {
  loadEligibilityPolicyState as loadServerPolicies,
  persistEligibilityPolicyState as persistServerPolicies,
} from "./eligibility-policies-client";
import {
  loadCommercialState as loadServerCommercial,
  persistCommercialState as persistServerCommercial,
  sendCommission as sendServerCommission,
} from "./commercial-client";
import { loadOperationalParameters as loadServerOperationalParameters } from "./operational-parameters-client";
import { loadIntegrationState as loadServerIntegrations } from "./integrations-client";
import {
  loadIntelligenceState as loadServerIntelligence,
  persistIntelligenceState as persistServerIntelligence,
} from "./intelligence-client";
import type { PortfolioFocus } from "@/src/features/portfolio/portfolio-navigation";
import {
  consumeOperationServerResult,
  mergeOperationAcknowledgement,
  newOperationAtEntry,
} from "./operation-server-result";
import {
  approveCopilotOperation as approveCopilotOperationFlow,
  buildCopilotOperation,
  type CopilotOperationRequest,
} from "@/src/domain/copilot/operation-handoff";

const CommercialModule = lazy(() => import("@/src/features/commercial/commercial-module"));
const ControlleriaModule = lazy(() => import("@/src/features/controlleria/controlleria-module"));
const FinanceModule = lazy(() => import("@/src/features/finance/finance-module"));
const HomeDashboard = lazy(() => import("@/src/features/home/home-dashboard"));
const LiveOperations = lazy(() => import("@/src/features/live-operations/live-operations"));
const PortfolioModule = lazy(() => import("@/src/features/portfolio/portfolio-module"));
const RegistryModule = lazy(() => import("@/src/features/registry/registry-module"));
const SettingsModule = lazy(() => import("@/src/features/settings/settings-module"));
const ModuleRoadmap = lazy(() =>
  import("@/src/features/shell/module-roadmap").then(module => ({ default: module.ModuleRoadmap })),
);
const NewOperationModal = lazy(() =>
  import("@/src/features/operations/new-operation/new-operation-modal").then(module => ({
    default: module.NewOperationModal,
  })),
);
const OperationsList = lazy(() =>
  import("@/src/features/operations/central/operations-list").then(module => ({ default: module.OperationsList })),
);
const OperationWorkspace = lazy(() =>
  import("@/src/features/operations/workspace/operation-workspace").then(module => ({
    default: module.OperationWorkspace,
  })),
);

function ModuleLoading() {
  return (
    <div className="empty-state" role="status" aria-live="polite">
      <strong>Carregando módulo…</strong>
      <span>Preparando os dados desta área.</span>
    </div>
  );
}

const COMPANY_SCOPE_KEY = "strato-company-scope";
export default function StratoApp() {
  const auth = useStratoAuth();
  const isDemo = auth?.mode === "demo";
  const destinations = useCompanyDestinations();
  const deepLinkHandled = useRef(false);
  const [operations, setOperations] = useState(() => (isDemo ? initialOperations : []));
  const [operationsServerReady, setOperationsServerReady] = useState(isDemo);
  const [operationPersistenceError, setOperationPersistenceError] = useState<string>();
  const operationSaveQueues = useRef(new Map<string, Promise<Operation>>());
  const [debtors, setDebtors] = useState(() => (isDemo ? initialDebtors : []));
  const [selected, setSelected] = useState<Operation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [companyScope, setCompanyScope] = useState(() =>
    isDemo ? "Consolidado" : (destinations[0]?.name ?? "Consolidado"),
  );
  const [storageReady, setStorageReady] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [showJourney, setShowJourney] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [access, setAccess] = useState(() => (isDemo ? seedAccessState() : emptyAccessState()));
  const [accessServerReady, setAccessServerReady] = useState(isDemo);
  const [accessLoadError, setAccessLoadError] = useState<string>();
  const [accessLoadAttempt, setAccessLoadAttempt] = useState(0);
  const [intelligence, setIntelligence] = useState(() => (isDemo ? seedIntelligenceState() : emptyIntelligenceState()));
  const [intelligenceServerReady, setIntelligenceServerReady] = useState(isDemo);
  const [intelligencePersistenceError, setIntelligencePersistenceError] = useState<string>();
  const [intelligenceLoadAttempt, setIntelligenceLoadAttempt] = useState(0);
  const persistedIntelligenceRef = useRef<IntelligenceState | null>(isDemo ? intelligence : null);
  const intelligenceSaveQueue = useRef<Promise<IntelligenceState> | null>(null);
  const currentUser = useMemo(() => activeUser(access), [access]);
  const sessionUser = useMemo(() => authenticatedUser(access), [access]);
  const [view, setView] = useState<AppView>("home");
  const radar = useHomeRadar(
    intelligence.tenantId,
    view === "home" && accessServerReady && !isDemo && !access.previewUserId && can(currentUser, "dashboard:view"),
    companyScope,
    `${currentUser.id}:${currentUser.permissions.join(",")}:${currentUser.companyScopes.join(",")}`,
  );
  const [bankSettingsCompany, setBankSettingsCompany] = useState<string>();
  const [settingsInitialSection, setSettingsInitialSection] = useState<"integrations">();
  const [portfolioFocus, setPortfolioFocus] = useState<PortfolioFocus>();
  const [financeInitialTab, setFinanceInitialTab] = useState<"cobranca">();
  const [navigationDenied, setNavigationDenied] = useState<string>();
  const navigate = (target: AppView) => {
    if (!canAccessView(currentUser, target)) {
      setNavigationDenied(
        "Seu perfil não tem permissão para acessar este módulo. Solicite liberação ao administrador.",
      );
      return;
    }
    setNavigationDenied(undefined);
    setSelected(null);
    setBankSettingsCompany(undefined);
    setSettingsInitialSection(target === "integrations" ? "integrations" : undefined);
    setFinanceInitialTab(undefined);
    if (target === "portfolio") setPortfolioFocus(undefined);
    setView(target === "integrations" ? "settings" : target);
  };
  const openPortfolio = (focus: PortfolioFocus) => {
    if (!canAccessView(currentUser, "portfolio")) return;
    setSelected(null);
    setPortfolioFocus({ ...focus });
    setView("portfolio");
  };
  const [finance, setFinance] = useState<FinanceState>(() => (isDemo ? seedFinance() : emptyFinance()));
  const [financeServerReady, setFinanceServerReady] = useState(isDemo);
  const [financePersistenceError, setFinancePersistenceError] = useState<string>();
  const financeSaveQueue = useRef<Promise<FinanceState> | null>(null);
  const financeRef = useRef(finance);
  const [portfolio, setPortfolio] = useState(() =>
    isDemo ? seedPortfolio(initialOperations) : { version: 3 as const, titles: [] },
  );
  const [portfolioServerReady, setPortfolioServerReady] = useState(isDemo);
  const [portfolioLoadError, setPortfolioLoadError] = useState<string>();
  const portfolioSaveQueue = useRef<Promise<typeof portfolio> | null>(null);
  const portfolioRef = useRef(portfolio);
  // Vínculo comercial do cliente (carteira, comitês, comissões): compartilhado por Cadastro, Operação, Carteira e Comercial.
  const [commercial, setCommercial] = useState<CommercialState>(() => (isDemo ? seedCommercial() : emptyCommercial()));
  const [commercialServerReady, setCommercialServerReady] = useState(isDemo);
  const [commercialPersistenceError, setCommercialPersistenceError] = useState<string>();
  const commercialSaveQueue = useRef<Promise<CommercialState> | null>(null);
  const commercialRef = useRef(commercial);
  // Cadastro de pessoas (cedentes, sacados, fornecedores, representantes, investidores...).
  const [savedParties, setSavedParties] = useState<Party[]>(() => (isDemo ? seedParties() : []));
  const [policies, setPolicies] = useState(() => (isDemo ? seedEligibilityPolicies() : emptyEligibilityPolicies()));
  const [persistedPolicies, setPersistedPolicies] = useState(() =>
    isDemo ? seedEligibilityPolicies() : emptyEligibilityPolicies(),
  );
  const [policiesServerReady, setPoliciesServerReady] = useState(isDemo);
  const [policyPersistenceError, setPolicyPersistenceError] = useState<string>();
  const policySaveQueue = useRef<Promise<typeof policies> | null>(null);
  const persistedPoliciesRef = useRef(persistedPolicies);
  const [integrations, setIntegrations] = useState(() => (isDemo ? seedIntegrationState() : emptyIntegrationState()));
  const [integrationsServerReady, setIntegrationsServerReady] = useState(isDemo);
  const [operationalDefaults, setOperationalDefaults] = useState(() =>
    isDemo ? seedOperationalDefaults() : emptyOperationalDefaults(),
  );
  const [operationalDefaultsServerReady, setOperationalDefaultsServerReady] = useState(isDemo);
  const [tasks, setTasks] = useState(() => seedTaskState());
  const [tasksServerReady, setTasksServerReady] = useState(isDemo);
  const [taskPersistenceError, setTaskPersistenceError] = useState<string>();
  const taskSaveQueue = useRef<Promise<TaskState> | null>(null);
  const taskRef = useRef(tasks);
  const [publishedNotifications, setPublishedNotifications] = useState<PublishedNotification[]>([]);
  const [taskClock, setTaskClock] = useState(() => Date.now());

  const persistRealPolicies = useCallback(
    (candidate: EligibilityPolicyState) => {
      if (isDemo) {
        persistedPoliciesRef.current = candidate;
        setPolicies(candidate);
        setPersistedPolicies(candidate);
        return Promise.resolve(candidate);
      }
      const prior = policySaveQueue.current ?? Promise.resolve(persistedPoliciesRef.current);
      const queued = prior
        .catch(async () => (await loadServerPolicies()) ?? persistedPoliciesRef.current)
        .then(serverBase =>
          persistServerPolicies({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
      policySaveQueue.current = queued;
      return queued
        .then(saved => {
          persistedPoliciesRef.current = saved;
          setPersistedPolicies(saved);
          setPolicyPersistenceError(undefined);
          setPolicies(current => {
            const next = current === candidate ? saved : { ...current, persistenceVersion: saved.persistenceVersion };
            return next;
          });
          return saved;
        })
        .catch(reason => {
          setPolicyPersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar as políticas no banco.",
          );
          throw reason;
        })
        .finally(() => {
          if (policySaveQueue.current === queued) policySaveQueue.current = null;
        });
    },
    [isDemo],
  );

  function applyPoliciesState(candidate: typeof policies) {
    setPolicies(candidate);
  }

  useEffect(() => {
    financeRef.current = finance;
  }, [finance]);

  useEffect(() => {
    taskRef.current = tasks;
  }, [tasks]);

  useEffect(() => {
    portfolioRef.current = portfolio;
  }, [portfolio]);

  useEffect(() => {
    commercialRef.current = commercial;
  }, [commercial]);

  const persistRealCommercial = useCallback(
    (candidate: CommercialState) => {
      if (isDemo) {
        setSavedParties(current => syncCommercialOnboardingParties(current, candidate, "Comercial"));
        return Promise.resolve(candidate);
      }
      const prior = commercialSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior.catch(() => candidate).then(() => persistServerCommercial(candidate));
      commercialSaveQueue.current = queued;
      void queued
        .then(saved => {
          commercialRef.current = saved;
          setCommercialPersistenceError(undefined);
          setCommercial(saved);
          return loadRegistryParties();
        })
        .then(setSavedParties)
        .catch(reason => {
          setCommercialPersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar o Comercial no banco.",
          );
        })
        .finally(() => {
          if (commercialSaveQueue.current === queued) commercialSaveQueue.current = null;
        });
      return queued;
    },
    [isDemo],
  );

  const applyCommercialState = useCallback(
    async (candidate: CommercialState) => {
      try {
        const saved = await persistRealCommercial(candidate);
        commercialRef.current = saved;
        setCommercial(saved);
        return true;
      } catch {
        return false;
      }
    },
    [persistRealCommercial],
  );

  const sendCommercialCommission = async (month: string) => {
    if (commercialSaveQueue.current) await commercialSaveQueue.current;
    const currentCommercial = commercialRef.current;
    const currentFinance = financeRef.current;
    const result = isDemo
      ? prepareCommissionTransfer(currentFinance, currentCommercial, month, isoDate(new Date()), currentUser.name)
      : await sendServerCommission(
          month,
          currentCommercial.persistenceVersion ?? 0,
          currentFinance.persistenceVersion ?? 0,
        );
    commercialRef.current = result.commercial;
    financeRef.current = result.finance;
    setCommercial(result.commercial);
    setFinance(result.finance);
  };

  const persistRealPortfolio = useCallback(
    (candidate: typeof portfolio) => {
      if (isDemo) return Promise.resolve(candidate);
      const prior = portfolioSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior.catch(() => candidate).then(() => persistServerPortfolio(candidate));
      portfolioSaveQueue.current = queued;
      void queued
        .then(saved => {
          setPortfolioLoadError(undefined);
          portfolioRef.current = saved;
          setPortfolio(saved);
        })
        .catch(reason => {
          setPortfolioLoadError(reason instanceof Error ? reason.message : "Não foi possível salvar a Carteira.");
        })
        .finally(() => {
          if (portfolioSaveQueue.current === queued) portfolioSaveQueue.current = null;
        });
      return queued;
    },
    [isDemo],
  );

  const applyPortfolioState = useCallback(
    async (candidate: typeof portfolio) => {
      const previousById = new Map(portfolioRef.current.titles.map(title => [title.id, title]));
      const attributed = {
        ...candidate,
        titles: candidate.titles.map(title => {
          const previous = previousById.get(title.id);
          if (!previous) return title;
          const confirmationChanged = JSON.stringify(previous.confirmation) !== JSON.stringify(title.confirmation);
          return {
            ...title,
            collectionOccurrences: title.collectionOccurrences.map((item, index) =>
              index < previous.collectionOccurrences.length ? item : { ...item, createdBy: sessionUser.name },
            ),
            events: title.events.map((event, index) =>
              index < previous.events.length ? event : { ...event, by: sessionUser.name },
            ),
            confirmation: confirmationChanged
              ? { ...title.confirmation, updatedBy: sessionUser.name }
              : title.confirmation,
          };
        }),
      };
      try {
        const saved = await persistRealPortfolio(attributed);
        portfolioRef.current = saved;
        setPortfolio(saved);
        return true;
      } catch {
        return false;
      }
    },
    [persistRealPortfolio, sessionUser.name],
  );

  function persistRealOperation(candidate: Operation) {
    if (isDemo) return;
    const prior = operationSaveQueues.current.get(candidate.id) ?? Promise.resolve(candidate);
    const queued = prior
      .catch(() => candidate)
      .then(serverBase =>
        persistServerOperation({
          ...candidate,
          persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
        }),
      );
    operationSaveQueues.current.set(candidate.id, queued);
    void queued
      .then(saved => {
        setOperationPersistenceError(undefined);
        setOperations(current => current.map(operation => mergeOperationAcknowledgement(operation, candidate, saved)));
        setSelected(current => (current ? mergeOperationAcknowledgement(current, candidate, saved) : current));
        if (saved.status === "Liberada ao financeiro") {
          void Promise.all([loadServerFinance(), loadCurrentPortfolio()])
            .then(([serverFinance, serverPortfolio]) => {
              if (serverFinance) {
                financeRef.current = serverFinance;
                setFinance(serverFinance);
              }
              portfolioRef.current = serverPortfolio;
              setPortfolio(serverPortfolio);
            })
            .catch(reason =>
              setFinancePersistenceError(
                reason instanceof Error
                  ? reason.message
                  : "Operação gravada; não foi possível atualizar a posição financeira.",
              ),
            );
        }
      })
      .catch(reason => {
        setOperationPersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível salvar a operação no banco.",
        );
      })
      .finally(() => {
        if (operationSaveQueues.current.get(candidate.id) === queued) operationSaveQueues.current.delete(candidate.id);
      });
  }

  const persistRealFinance = useCallback(
    (candidate: FinanceState) => {
      if (isDemo) return Promise.resolve(candidate);
      const prior = financeSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior.catch(() => candidate).then(() => persistServerFinance(candidate));
      financeSaveQueue.current = queued;
      void queued
        .then(saved => {
          setFinancePersistenceError(undefined);
          if (financeSaveQueue.current === queued) setFinance(saved);
        })
        .catch(reason => {
          setFinancePersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar o Financeiro no banco.",
          );
        })
        .finally(() => {
          if (financeSaveQueue.current === queued) financeSaveQueue.current = null;
        });
      return queued;
    },
    [isDemo],
  );

  async function applyFinanceState(candidate: FinanceState) {
    if (isDemo) {
      setFinance(candidate);
      return;
    }
    const saved = await persistRealFinance(candidate);
    financeRef.current = saved;
    setFinance(saved);
    void loadServerOperations()
      .then(serverOperations => {
        setOperations(serverOperations);
        setSelected(current =>
          current ? (serverOperations.find(operation => operation.id === current.id) ?? current) : current,
        );
      })
      .catch(reason =>
        setOperationPersistenceError(
          reason instanceof Error ? reason.message : "Financeiro gravado; não foi possível atualizar as operações.",
        ),
      );
  }

  const persistRealTasks = useCallback(
    (base: TaskState, candidate: TaskState) => {
      if (isDemo) return;
      const prior = taskSaveQueue.current ?? Promise.resolve(base);
      const queued = prior
        .catch(async () => (await loadServerTasks()) ?? base)
        .then(async serverBase => {
          // A resposta do servidor já vem recortada para a fila nominal do autor. Em comandos
          // enfileirados, não reenvia uma tarefa que acabou de ser transferida para outra pessoa.
          const serverTaskIds = new Set(serverBase.tasks.map(task => task.id));
          const rebased = rebaseTaskState(base, candidate, serverBase);
          const outgoing = {
            ...rebased,
            tasks: rebased.tasks.filter(
              task => serverTaskIds.has(task.id) || !base.tasks.some(item => item.id === task.id),
            ),
            persistenceVersion: serverBase.persistenceVersion ?? base.persistenceVersion,
          };
          try {
            return await persistServerTasks(outgoing);
          } catch (reason) {
            if (!(reason instanceof TaskPersistenceError) || reason.status !== 409) throw reason;
            const refreshed = await loadServerTasks();
            if (!refreshed) throw reason;
            return persistServerTasks(rebaseTaskState(base, candidate, refreshed));
          }
        });
      taskSaveQueue.current = queued;
      void queued
        .then(saved => {
          setTaskPersistenceError(undefined);
          setTasks(current => {
            if (current === candidate) {
              taskRef.current = saved;
              return saved;
            }
            return { ...current, persistenceVersion: saved.persistenceVersion };
          });
        })
        .catch(reason => {
          setTaskPersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar as tarefas no banco.",
          );
        })
        .finally(() => {
          if (taskSaveQueue.current === queued) taskSaveQueue.current = null;
        });
    },
    [isDemo],
  );
  // Resultado financeiro de cada operação, pela mesma precificação da etapa Preço, para a Visão geral.
  const homeFinancials = useMemo(
    () =>
      Object.fromEntries(
        operations.map(operation => {
          const pricing = normalizedPricing(operation);
          const calc = pricingCalculation(operation, pricing);
          const priced = calc.face > 0;
          const discount = priced ? calc.originalDiscount : Math.max(0, operation.amount - operation.netAmount);
          const fees = priced ? calc.fees : 0;
          return [
            operation.id,
            {
              face: priced ? calc.face : operation.amount,
              discount,
              fees,
              revenue: discount + fees,
              rate: priced && calc.allInMonthly > 0 ? calc.allInMonthly : pricing.monthlyRate,
              net: priced ? calc.net : operation.netAmount,
            },
          ];
        }),
      ),
    [operations],
  );
  // Liberações enviadas ao financeiro viram títulos a pagar e a compra é contabilizada.
  useEffect(() => {
    if (!isDemo) return;
    const current = financeRef.current;
    const next = syncReleases(current, operations, homeFinancials);
    if (next === current) return;
    setFinance(next);
    persistRealFinance(next);
  }, [operations, homeFinancials, financeServerReady, isDemo, persistRealFinance]);
  useEffect(() => {
    if (!isDemo) return;
    const current = portfolioRef.current;
    const next = syncPortfolio(current, operations);
    if (next !== current) applyPortfolioState(next);
  }, [operations, portfolioServerReady, isDemo, applyPortfolioState]);
  function applyFinanceEffects(effects: Effect[]) {
    if (!isDemo) return;
    if (!can(currentUser, "finance:release")) return;
    const nextOperations = operations.map(operation => {
      const mine = effects.filter(effect => effect.operationId === operation.id);
      if (!mine.length || !operation.releaseReview) return operation;
      return {
        ...operation,
        releaseReview: {
          ...operation.releaseReview,
          payables: (operation.releaseReview.payables ?? []).map(payable => {
            const effect = mine.find(item => item.payableKey === payableKey(payable));
            return effect ? { ...payable, status: effect.status, paidAt: effect.paidAt } : payable;
          }),
          audit: [
            ...(operation.releaseReview.audit ?? []),
            ...mine.map(effect => ({
              at: new Intl.DateTimeFormat("pt-BR", {
                dateStyle: "short",
                timeStyle: "short",
                timeZone: "America/Sao_Paulo",
              }).format(new Date()),
              by: "Financeiro",
              action: effect.status === "Pago" ? "Pagamento realizado" : "Pagamento estornado",
              detail: effect.payableKey.split("@")[0],
            })),
          ],
        },
      };
    });
    setOperations(nextOperations);
    nextOperations
      .filter(operation => effects.some(effect => effect.operationId === operation.id))
      .forEach(persistRealOperation);
  }
  function patchOperation(id: string, patch: Partial<Operation>) {
    if (!can(currentUser, "finance:release")) return;
    const current = operations.find(operation => operation.id === id);
    if (!current) return;
    const updated = { ...current, ...patch };
    setOperations(items => items.map(operation => (operation.id === id ? updated : operation)));
    persistRealOperation(updated);
  }
  // A empresa do título acompanha a projeção de caixa do Financeiro (antes entrava em qualquer recorte).
  const carteiraFlows = useMemo(
    () =>
      (isDemo ? portfolioTitles(operations, true) : portfolioHomeTitles(portfolio)).map(title => ({
        date: title.dueDate,
        amount: title.amount,
        company: title.vehicle,
      })),
    [operations, isDemo, portfolio],
  );

  const confirmedAccessKey = useRef<string | undefined>(undefined);
  const applyConfirmedAccess = useCallback(
    (serverState: AccessState, preservePreview = false) => {
      if (isDemo) {
        setAccess(serverState);
        return;
      }
      const actor = authenticatedUser(serverState);
      const key = `${actor.id}:${actor.status}:${[...actor.permissions].sort().join(",")}:${[...actor.companyScopes].sort().join(",")}`;
      const changed = confirmedAccessKey.current !== undefined && confirmedAccessKey.current !== key;
      confirmedAccessKey.current = key;
      if (changed) {
        setSelected(null);
        setOperations([]);
        setOperationsServerReady(false);
        setFinance(emptyFinance());
        setFinanceServerReady(false);
        const emptyCommercialState = emptyCommercial();
        commercialRef.current = emptyCommercialState;
        setCommercial(emptyCommercialState);
        setCommercialServerReady(false);
        const emptyPortfolioState = { version: 3 as const, titles: [] };
        portfolioRef.current = emptyPortfolioState;
        setPortfolio(emptyPortfolioState);
        setPortfolioServerReady(false);
        taskRef.current = seedTaskState();
        setTasks(taskRef.current);
        setTasksServerReady(false);
        setSavedParties([]);
        setPolicies(emptyEligibilityPolicies());
        setPersistedPolicies(emptyEligibilityPolicies());
        setPoliciesServerReady(false);
      }
      setAccess(current => ({
        ...serverState,
        previewUserId:
          preservePreview && can(actor, "users:manage") ? current.previewUserId : serverState.previewUserId,
      }));
    },
    [isDemo],
  );

  // Restaura o que foi salvo depois de montar (evita divergência na hidratação do SSR).
  useEffect(() => {
    const browserState = loadPersistedState();
    const stored = isDemo ? browserState : { guidance: browserState.guidance, journey: browserState.journey };
    /* eslint-disable react-hooks/set-state-in-effect -- restauração única do localStorage após montar */
    if (stored.operations) setOperations(stored.operations);
    if (stored.debtors) setDebtors(stored.debtors);
    if (stored.finance) setFinance(stored.finance);
    if (stored.commercial) setCommercial(stored.commercial);
    if (isDemo && stored.commercial)
      setSavedParties(syncCommercialOnboardingParties(stored.parties ?? seedParties(), stored.commercial, "Comercial"));
    else if (stored.parties) setSavedParties(stored.parties);
    if (stored.portfolio) setPortfolio(stored.portfolio);
    if (stored.policies) {
      setPolicies(stored.policies);
      setPersistedPolicies(stored.policies);
      persistedPoliciesRef.current = stored.policies;
    }
    if (stored.integrations) setIntegrations(stored.integrations);
    if (stored.operationalDefaults) setOperationalDefaults(stored.operationalDefaults);
    if (stored.tasks) setTasks(stored.tasks);
    if (isDemo && stored.access) setAccess(stored.access);
    if (stored.intelligence) setIntelligence(stored.intelligence);
    if (stored.guidance !== undefined) setShowGuidance(stored.guidance);
    if (stored.journey !== undefined) setShowJourney(stored.journey);
    try {
      const savedScope = window.localStorage.getItem(COMPANY_SCOPE_KEY);
      if (
        savedScope &&
        (savedScope === "Consolidado" || destinations.some(destination => destination.name === savedScope))
      )
        setCompanyScope(savedScope);
    } catch {
      /* ignora armazenamento indisponível */
    }
    setStorageReady(true);
    /* eslint-enable react-hooks/set-state-in-effect */
  }, [isDemo, destinations]);

  useEffect(() => {
    if (storageReady && isDemo)
      savePersistedState({
        operations,
        debtors,
        finance,
        commercial,
        parties: savedParties,
        portfolio,
        policies,
        integrations,
        operationalDefaults,
        tasks,
        access,
        intelligence,
      });
  }, [
    operations,
    debtors,
    finance,
    commercial,
    savedParties,
    portfolio,
    policies,
    integrations,
    operationalDefaults,
    tasks,
    access,
    intelligence,
    storageReady,
    isDemo,
  ]);

  useEffect(() => {
    if (!storageReady || isDemo) return;
    let cancelled = false;
    let sequence = 0;
    const refresh = () => {
      const requestSequence = ++sequence;
      return loadAccessDirectory(intelligence.tenantId)
        .then(serverState => {
          if (cancelled || requestSequence !== sequence) return;
          if (!serverState.users.some(user => user.id === serverState.authenticatedUserId && user.status === "active"))
            throw new Error("Sessão sem perfil ativo confirmado.");
          applyConfirmedAccess(serverState, true);
          setAccessLoadError(undefined);
        })
        .catch(error => {
          if (cancelled || requestSequence !== sequence) return;
          applyConfirmedAccess(emptyAccessState());
          setAccessLoadError(error instanceof Error ? error.message : "Não foi possível confirmar seu acesso.");
        })
        .finally(() => {
          if (!cancelled && requestSequence === sequence) setAccessServerReady(true);
        });
    };
    void refresh();
    const interval = window.setInterval(() => void refresh(), 30_000);
    window.addEventListener("focus", refresh);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refresh);
    };
  }, [intelligence.tenantId, storageReady, isDemo, accessLoadAttempt, applyConfirmedAccess]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady) return;
    let cancelled = false;
    (can(sessionUser, "registry:view") ? loadRegistryParties() : Promise.resolve([]))
      .then(parties => {
        if (!cancelled) setSavedParties(parties);
      })
      .catch(() => {
        /* o modo real permanece vazio quando o banco estiver indisponível */
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || operationsServerReady) return;
    let cancelled = false;
    (can(sessionUser, "operations:view") ? loadServerOperations() : Promise.resolve([]))
      .then(serverOperations => {
        if (cancelled) return;
        setOperations(serverOperations);
        setOperationPersistenceError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setOperationPersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível carregar as operações do banco.",
        );
      })
      .finally(() => {
        if (!cancelled) setOperationsServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, operationsServerReady, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || financeServerReady) return;
    let cancelled = false;
    (can(sessionUser, "finance:view") ? loadServerFinance() : Promise.resolve(null))
      .then(serverFinance => {
        if (cancelled) return;
        setFinance(serverFinance ?? emptyFinance());
        setFinancePersistenceError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setFinancePersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível carregar o Financeiro do banco.",
        );
      })
      .finally(() => {
        if (!cancelled) setFinanceServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [financeServerReady, isDemo, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || commercialServerReady) return;
    let cancelled = false;
    (can(sessionUser, "portfolio:manage") || can(sessionUser, "risk:decide")
      ? loadServerCommercial()
      : Promise.resolve(null)
    )
      .then(serverCommercial => {
        if (cancelled) return;
        const loaded = serverCommercial ?? emptyCommercial();
        commercialRef.current = loaded;
        setCommercial(loaded);
        setCommercialPersistenceError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setCommercialPersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível carregar o Comercial do banco.",
        );
      })
      .finally(() => {
        if (!cancelled) setCommercialServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [commercialServerReady, isDemo, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || tasksServerReady) return;
    let cancelled = false;
    (can(sessionUser, "dashboard:view") ? loadServerTasks() : Promise.resolve(null))
      .then(serverTasks => {
        if (cancelled) return;
        const loaded = serverTasks ?? seedTaskState();
        taskRef.current = loaded;
        setTasks(loaded);
        setTaskPersistenceError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setTaskPersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível carregar as tarefas do banco.",
        );
      })
      .finally(() => {
        if (!cancelled) setTasksServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, storageReady, tasksServerReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !tasksServerReady || !can(sessionUser, "dashboard:view")) return;
    let cancelled = false;
    const refreshTasks = () => {
      if (taskSaveQueue.current) return;
      const stateBeforeRefresh = taskRef.current;
      void loadServerTasks()
        .then(serverTasks => {
          if (cancelled || taskSaveQueue.current || taskRef.current !== stateBeforeRefresh) return;
          const loaded = serverTasks ?? seedTaskState();
          taskRef.current = loaded;
          setTasks(loaded);
          setTaskPersistenceError(undefined);
        })
        .catch(reason => {
          if (cancelled) return;
          setTaskPersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível atualizar as tarefas do banco.",
          );
        });
    };
    const interval = window.setInterval(refreshTasks, 15_000);
    window.addEventListener("focus", refreshTasks);
    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener("focus", refreshTasks);
    };
  }, [isDemo, storageReady, tasksServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || policiesServerReady) return;
    let cancelled = false;
    (can(sessionUser, "settings:view") || can(sessionUser, "settings:manage")
      ? loadServerPolicies()
      : Promise.resolve(null)
    )
      .then(serverPolicies => {
        if (cancelled) return;
        const loaded = serverPolicies ?? emptyEligibilityPolicies();
        persistedPoliciesRef.current = loaded;
        setPolicies(loaded);
        setPersistedPolicies(loaded);
        setPolicyPersistenceError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setPolicyPersistenceError(
          reason instanceof Error ? reason.message : "Não foi possível carregar as políticas do banco.",
        );
      })
      .finally(() => {
        if (!cancelled) setPoliciesServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, policiesServerReady, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!storageReady || isDemo || operationalDefaultsServerReady) return;
    let cancelled = false;
    loadServerOperationalParameters()
      .then(result => {
        if (!cancelled) setOperationalDefaults(result.state);
      })
      .catch(() => {
        /* mantém padrões seguros enquanto o serviço estiver indisponível */
      })
      .finally(() => {
        if (!cancelled) setOperationalDefaultsServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, operationalDefaultsServerReady, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || integrationsServerReady) return;
    let cancelled = false;
    loadServerIntegrations()
      .then(serverState => {
        if (!cancelled) setIntegrations(serverState);
      })
      .catch(() => {
        /* mantém o catálogo seguro como não configurado quando o servidor está indisponível */
      })
      .finally(() => {
        if (!cancelled) setIntegrationsServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [integrationsServerReady, isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || intelligenceServerReady) return;
    let cancelled = false;
    loadServerIntelligence()
      .then(serverState => {
        if (cancelled) return;
        persistedIntelligenceRef.current = serverState;
        setIntelligence(serverState);
        setIntelligenceServerReady(true);
        setIntelligencePersistenceError(undefined);
      })
      .catch(error => {
        if (!cancelled)
          setIntelligencePersistenceError(
            error instanceof Error ? error.message : "Não foi possível carregar a configuração de IA.",
          );
      });
    return () => {
      cancelled = true;
    };
  }, [intelligenceServerReady, intelligenceLoadAttempt, isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || !intelligenceServerReady || intelligence === persistedIntelligenceRef.current)
      return;
    // Somente quem administra as configurações grava a licença e o orçamento; o consumo é registrado pelo servidor.
    if (!currentUser.permissions.includes("settings:manage")) return;
    const candidate = intelligence;
    const timer = window.setTimeout(() => {
      const prior = intelligenceSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior.catch(() => candidate).then(() => persistServerIntelligence(candidate));
      intelligenceSaveQueue.current = queued;
      void queued
        .then(saved => {
          persistedIntelligenceRef.current = saved;
          setIntelligencePersistenceError(undefined);
          setIntelligence(current =>
            current === candidate ? saved : { ...current, persistenceVersion: saved.persistenceVersion },
          );
        })
        .catch(error => {
          setIntelligence(current => {
            if (current !== candidate) return current;
            return persistedIntelligenceRef.current ?? current;
          });
          setIntelligencePersistenceError(
            error instanceof Error ? error.message : "A alteração de IA não foi salva. Tente novamente.",
          );
        })
        .finally(() => {
          if (intelligenceSaveQueue.current === queued) intelligenceSaveQueue.current = null;
        });
    }, 350);
    return () => window.clearTimeout(timer);
  }, [currentUser.permissions, intelligence, intelligenceServerReady, isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || !accessServerReady || portfolioServerReady) return;
    let cancelled = false;
    (can(sessionUser, "dashboard:view") ? loadCurrentPortfolio() : Promise.resolve({ version: 3 as const, titles: [] }))
      .then(serverPortfolio => {
        if (cancelled) return;
        portfolioRef.current = serverPortfolio;
        setPortfolio(serverPortfolio);
        setPortfolioLoadError(undefined);
      })
      .catch(reason => {
        if (cancelled) return;
        setPortfolioLoadError(reason instanceof Error ? reason.message : "Não foi possível carregar a carteira.");
      })
      .finally(() => {
        if (!cancelled) setPortfolioServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, portfolioServerReady, storageReady, accessServerReady, sessionUser]);

  useEffect(() => {
    if (!accessServerReady || isDemo) return;
    let cancelled = false;
    const refresh = () =>
      syncPublishedNotifications(intelligence.tenantId)
        .then(result => {
          if (!cancelled) {
            setPublishedNotifications(result.notifications);
          }
        })
        .catch(() => {
          /* mantém a última posição conhecida quando o publicador estiver indisponível */
        });
    void refresh();
    const timer = window.setInterval(() => void refresh(), 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [accessServerReady, intelligence.tenantId, isDemo]);

  useEffect(() => {
    const timer = window.setInterval(() => setTaskClock(Date.now()), 60_000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(COMPANY_SCOPE_KEY, companyScope);
    } catch {
      /* ignora armazenamento indisponível */
    }
  }, [companyScope, storageReady]);

  useEffect(() => {
    if (!storageReady || deepLinkHandled.current) return;
    deepLinkHandled.current = true;
    const params = new URLSearchParams(window.location.search);
    const operationId = params.get("operation");
    const targetView = params.get("view") as AppView | null;
    const operation = operationId ? operations.find(item => item.id === operationId) : undefined;
    const validViews: AppView[] = [
      "home",
      "operations",
      "controlleria",
      "portfolio",
      "commercial",
      "live",
      "finance",
      "registry",
      "policies",
      "integrations",
      "settings",
    ];
    if (targetView && validViews.includes(targetView)) {
      if (targetView === "operations" && operation) {
        // eslint-disable-next-line react-hooks/set-state-in-effect -- aplica uma única vez o endereço de uma aba de trabalho compartilhada
        setSelected(operation);
      } else {
        setSelected(null);
      }
      setView(targetView);
      return;
    }
    if (operation) {
      setSelected(operation);
      setView("operations");
    }
  }, [storageReady, operations]);

  function updateOperation(updated: Operation) {
    if (!isDemo && consumeOperationServerResult(updated)) {
      setOperationPersistenceError(undefined);
      setOperations(current =>
        current.map(operation =>
          operation.id === updated.id && (operation.persistenceVersion ?? 0) <= (updated.persistenceVersion ?? 0)
            ? updated
            : operation,
        ),
      );
      setSelected(current =>
        current?.id === updated.id && (current.persistenceVersion ?? 0) <= (updated.persistenceVersion ?? 0)
          ? updated
          : current,
      );
      return;
    }
    if (
      !can(currentUser, "operations:edit") &&
      !can(currentUser, "risk:decide") &&
      !can(currentUser, "controlleria:formalize") &&
      !can(currentUser, "finance:release")
    )
      return;
    const persisted = operations.find(operation => operation.id === updated.id) ?? null;
    if (operationMutationPermissionError(persisted, updated, currentUser.permissions)) return;
    setOperations(current => current.map(operation => (operation.id === updated.id ? updated : operation)));
    setSelected(updated);
    persistRealOperation(updated);
  }

  function registerDebtor(debtor: Debtor) {
    if (!can(currentUser, "operations:edit") && !can(currentUser, "registry:edit")) return;
    setDebtors(current => [
      debtor,
      ...current.filter(item => item.document.replace(/\D/g, "") !== debtor.document.replace(/\D/g, "")),
    ]);
  }

  // Confirmação feita na própria página (diálogos do navegador não funcionam em todos os ambientes).
  function resetDemo() {
    setConfirmReset(true);
  }
  function doResetDemo() {
    setConfirmReset(false);
    clearPersistedState();
    setOperations(initialOperations);
    setDebtors(initialDebtors);
    setFinance(seedFinance());
    setCommercial(seedCommercial());
    setSavedParties(seedParties());
    setPortfolio(seedPortfolio(initialOperations));
    setPolicies(seedEligibilityPolicies());
    setIntegrations(seedIntegrationState());
    setOperationalDefaults(seedOperationalDefaults());
    setTasks(seedTaskState());
    setAccess(seedAccessState());
    setIntelligence(seedIntelligenceState());
    setSelected(null);
  }
  function createOperation(input: NewOperationInput) {
    if (!can(currentUser, "operations:edit")) return;
    const next = buildNewOperation(
      { ...input, actor: { name: currentUser.name } },
      operations,
      commercial,
      new Date().toISOString().slice(0, 10),
    );
    // Sacados novos do arquivo são cadastrados automaticamente ao iniciar a operação.
    const importedDebtors = input.entryIntake?.newDebtors ?? [];
    if (importedDebtors.length)
      setDebtors(current => {
        const known = new Set(current.map(debtor => debtor.document.replace(/\D/g, "")));
        const fresh = importedDebtors.filter(debtor => !known.has(debtor.document.replace(/\D/g, "")));
        return fresh.length ? [...fresh, ...current] : current;
      });
    setOperations([next, ...operations]);
    setShowNew(false);
    setSelected(next);
    persistRealOperation(next);
  }
  const openSettings = () => navigate("settings");
  const carteiraEvents = useMemo(() => repurchaseEvents(operations), [operations]);
  const commercialLive = useMemo(() => ({ ...commercial, carteiraEvents }), [commercial, carteiraEvents]);
  // Cedentes = cadastro de crédito existente + cedentes novos criados no Cadastro; limite vem do comitê.
  const registryCedents = useMemo(() => {
    const baseline = isDemo
      ? initialCedents.map(cedent => {
          const registered = savedParties.find(
            party => party.document.replace(/\D/g, "") === cedent.document.replace(/\D/g, ""),
          );
          return {
            ...cedent,
            requiresLastroPrecheck: registered?.roleData.cedente?.requiresLastroPrecheck ?? false,
          };
        })
      : [];
    const known = new Set(baseline.map(c => c.document.replace(/\D/g, "")));
    const created = savedParties
      .filter(p => p.roles.includes("cedente") && p.status === "Ativo" && !known.has(p.document.replace(/\D/g, "")))
      .map(partyToCedent);
    return effectiveCedents(commercial, [...baseline, ...created]);
  }, [commercial, savedParties, isDemo]);
  const registryDebtors = useMemo(() => {
    if (isDemo) return debtors;
    const byDocument = new Map(debtors.map(debtor => [debtor.document.replace(/\D/g, ""), debtor]));
    savedParties
      .filter(party => party.roles.includes("sacado") && party.status === "Ativo")
      .forEach(party => {
        const document = party.document.replace(/\D/g, "");
        if (!byDocument.has(document)) byDocument.set(document, partyToDebtor(party));
      });
    return [...byDocument.values()];
  }, [debtors, savedParties, isDemo]);
  function createCopilotOperation(request: CopilotOperationRequest) {
    if (!can(currentUser, "operations:edit")) return undefined;
    const existing = operations.find(
      operation =>
        operation.copilotOrigin?.runId === request.runId &&
        operation.copilotOrigin.scenarioVersion === request.scenario.version,
    );
    if (existing) return existing;
    const cedent = registryCedents.find(item => item.id === request.cedentId);
    const destination = destinations.find(item => item.name === companyScope) ?? destinations[0];
    if (!cedent || !destination) return undefined;
    const at = new Date().toISOString();
    const copilotDraft = buildCopilotOperation({
      request,
      destination,
      cedent,
      operations,
      commercial,
      debtors,
      actor: { name: currentUser.name },
      today: at.slice(0, 10),
      at,
    });
    const next = isDemo ? copilotDraft : newOperationAtEntry(copilotDraft);
    const importedDebtors = next.entryIntake?.newDebtors ?? [];
    if (importedDebtors.length)
      setDebtors(current => {
        const known = new Set(current.map(debtor => debtor.document.replace(/\D/g, "")));
        const fresh = importedDebtors.filter(debtor => !known.has(debtor.document.replace(/\D/g, "")));
        return fresh.length ? [...fresh, ...current] : current;
      });
    setOperations(current => [next, ...current]);
    persistRealOperation(next);
    return next;
  }
  function approveCopilotOperation(operationId: string, authorityApproved = false) {
    if (!can(currentUser, "operations:edit") && !can(currentUser, "risk:decide")) return undefined;
    const current = operations.find(operation => operation.id === operationId);
    if (!current) return undefined;
    if (!isDemo) {
      setSelected(current);
      setView("operations");
      setOperationPersistenceError(
        "Conclua as etapas e registre as alçadas no workspace da operação. A análise assistida não autoriza avanço ou aprovação.",
      );
      return current;
    }
    const next = approveCopilotOperationFlow(current, {
      actor: currentUser.name,
      at: new Date().toISOString(),
      debtors,
      authorityApproved,
    });
    if (next === current) return current;
    setOperations(items => items.map(operation => (operation.id === operationId ? next : operation)));
    persistRealOperation(next);
    return next;
  }
  // Score de qualidade único (0–1000): calculado pela política sobre o histórico de cada cliente e usado
  // igual no cadastro, na operação, no painel de Risco e no panorama. O score de bureau fica em `bureauScore`.
  const qualityState = useQualityPolicyState(isDemo);
  const scoreDay = isoDate(new Date());
  const portfolioHistories = useMemo(
    () => (isDemo ? undefined : portfolioQualityHistories(portfolio, registryCedents, registryDebtors, scoreDay)),
    [isDemo, portfolio, registryCedents, registryDebtors, scoreDay],
  );
  const cedentHistories = useMemo(
    () => (isDemo ? demoCedentHistories(registryCedents, scoreDay) : (portfolioHistories?.cedentHistories ?? [])),
    [registryCedents, scoreDay, isDemo, portfolioHistories],
  );
  const debtorHistories = useMemo(
    () =>
      isDemo
        ? demoDebtorHistories(
            registryDebtors.map(d => {
              const doc = d.document.replace(/\D/g, "");
              return { id: doc, name: d.name, document: doc, exposure: d.portfolioReceivable ?? 0, debtor: d };
            }),
            scoreDay,
          )
        : (portfolioHistories?.debtorHistories ?? []),
    [registryDebtors, scoreDay, isDemo, portfolioHistories],
  );
  const qualityValue = useMemo<QualityValue>(() => {
    const byDocument = qualityByDocument([...cedentHistories, ...debtorHistories], qualityState.policy);
    return { ...qualityState, cedentHistories, debtorHistories, byDocument };
  }, [qualityState, cedentHistories, debtorHistories]);
  const scoredCedents = useMemo(
    () => registryCedents.map(c => scoredCedent(c, qualityValue.byDocument.get(c.document.replace(/\D/g, "")))),
    [registryCedents, qualityValue],
  );
  const scoredDebtors = useMemo(
    () => registryDebtors.map(d => scoredDebtor(d, qualityValue.byDocument.get(d.document.replace(/\D/g, "")))),
    [registryDebtors, qualityValue],
  );
  const today = new Date().toISOString().slice(0, 10);
  const parties = useMemo(
    () =>
      mergeParties(savedParties, {
        cedents: scoredCedents,
        debtors: scoredDebtors,
        reps: commercial.reps,
        repOfCedent: document => repAt(commercial, document, new Date().toISOString().slice(0, 10)),
        managerOfCedent: document => managerOf(commercial, document),
      }),
    [savedParties, scoredCedents, scoredDebtors, commercial],
  );
  const registryValue = useMemo<RegistryValue>(
    () => ({
      isDemo,
      commercial: commercialLive,
      cedents: scoredCedents,
      records: buildRegistry(commercialLive, scoredCedents),
      repOf: (document: string, date?: string) => {
        const id = repAt(commercialLive, document, date ?? new Date().toISOString().slice(0, 10));
        return commercialLive.reps.find(rep => rep.id === id);
      },
      managerOf: (document: string) => {
        const id = managerOf(commercialLive, document);
        return commercialLive.reps.find(rep => rep.id === id);
      },
      operationalDefaults,
      parties,
      refreshParties: async () => {
        if (!isDemo) setSavedParties(await loadRegistryParties());
      },
      saveParty: async (party, reason) => {
        if (!can(currentUser, "registry:edit")) return { error: "Seu perfil não permite editar cadastros." };
        const result = savePartyRecord({
          party,
          saved: savedParties,
          all: parties,
          debtors,
          commercial,
          today,
          by: sessionUser.name,
          reason,
          source: "Cadastro",
        });
        if (!result.ok) return { error: result.error };
        if (!isDemo) {
          try {
            const confirmed = await persistRegistryParty(
              result.saved.find(item => item.id === party.id) ?? party,
              reason,
              party.updatedAt,
            );
            result.saved = result.saved.map(item => (item.id === confirmed.id ? confirmed : item));
          } catch (error) {
            return { error: error instanceof Error ? error.message : "Não foi possível salvar o cadastro." };
          }
        }
        setSavedParties(result.saved);
        setDebtors(result.debtors);
        setCommercial(result.commercial);
        return { message: result.message };
      },
      onCommercial: async next => {
        if (!can(currentUser, "portfolio:manage")) return false;
        const { carteiraEvents: _drop, ...rest } = next;
        void _drop;
        return applyCommercialState(rest as CommercialState);
      },
    }),
    [
      commercialLive,
      scoredCedents,
      parties,
      savedParties,
      debtors,
      isDemo,
      commercial,
      operationalDefaults,
      today,
      currentUser,
      sessionUser.name,
      applyCommercialState,
    ],
  );
  const userScope = useMemo(
    () => ({
      referenceDate: today,
      repOfCedent: (document: string, date: string) => repAt(commercial, document, date),
      managerOfCedent: (document: string) => managerOf(commercial, document),
    }),
    [commercial, today],
  );
  const scopedOperations = useMemo(
    () => operationsForUser(operations, currentUser, userScope),
    [operations, currentUser, userScope],
  );
  const activeCount = scopedOperations.filter(
    operation => operation.status !== "Cancelada" && operation.status !== "Liberada ao financeiro",
  ).length;
  useEffect(() => {
    if (!storageReady) return;
    const allowedCompanies = currentUser.companyScopes ?? [];
    if (
      currentUser.access !== "admin" &&
      (companyScope === "Consolidado" || !allowedCompanies.includes(companyScope)) &&
      allowedCompanies[0]
    ) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- corrige o escopo ao trocar a visão simulada
      setCompanyScope(allowedCompanies[0]);
    }
    if (!canAccessView(currentUser, view)) {
      setSelected(null);
      setView(defaultViewFor(currentUser));
      return;
    }
    if (selected && !scopedOperations.some(operation => operation.id === selected.id)) setSelected(null);
  }, [currentUser, companyScope, scopedOperations, selected, storageReady, view]);
  const livePortfolioTitles = useMemo(
    () => (isDemo ? portfolioTitles(operations, true) : portfolioHomeTitles(portfolio)),
    [isDemo, operations, portfolio],
  );
  const operationalDailyBriefing = useMemo(
    () =>
      buildDailyBriefing({
        user: currentUser,
        operations,
        financials: homeFinancials,
        titles: livePortfolioTitles,
        referenceDate: today,
        revenueTarget: operationalDefaults.revenueGoals.consolidated.mes,
        scope: userScope,
      }),
    [
      operations,
      homeFinancials,
      today,
      operationalDefaults.revenueGoals.consolidated.mes,
      userScope,
      currentUser,
      livePortfolioTitles,
    ],
  );
  const systemAttentionItems = useMemo(
    () =>
      buildAttentionItems({
        operations,
        titles: livePortfolioTitles,
        user: demoAdminUser,
        referenceDate: today,
        scope: userScope,
      }),
    [operations, today, userScope, livePortfolioTitles],
  );
  const detectedAttentionItems = useMemo(
    () =>
      buildAttentionItems({
        operations,
        titles: livePortfolioTitles,
        user: currentUser,
        referenceDate: today,
        scope: userScope,
      }),
    [operations, today, userScope, currentUser, livePortfolioTitles],
  );
  const publishedAttentionItems = useMemo(
    () =>
      publishedNotifications.map(notification => ({
        id: notification.id,
        kind: notification.kind,
        tone: notification.tone,
        title: notification.title,
        summary: notification.summary,
        detail: notification.detail,
        impact: notification.impact,
        nextAction: notification.nextAction,
        owner: notification.owner,
        department: notification.department,
        timing: notification.timing,
        view: notification.view,
        operation: operations.find(operation => operation.id === notification.operationId),
      })),
    [operations, publishedNotifications],
  );
  const persistentAttentionItems = useMemo(
    () => [
      ...systemAttentionItems,
      ...publishedAttentionItems.filter(
        published =>
          !systemAttentionItems.some(
            detected => detected.kind === published.kind && detected.operation?.id === published.operation?.id,
          ),
      ),
    ],
    [publishedAttentionItems, systemAttentionItems],
  );
  useEffect(() => {
    if (!isDemo || !storageReady || !tasksServerReady || access.previewUserId) return;
    const current = taskRef.current;
    const next = reconcileTasks(current, persistentAttentionItems, new Date().toISOString(), { sourcesReady: true });
    if (next === current) return;
    taskRef.current = next;
    setTasks(next);
  }, [isDemo, persistentAttentionItems, storageReady, tasksServerReady, access.previewUserId]);
  const taskItems = useMemo(() => {
    const allManaged = managedTasks(
      tasks,
      isDemo ? [...persistentAttentionItems, ...detectedAttentionItems] : [],
      new Date(taskClock).toISOString(),
    ).map(task =>
      isDemo
        ? task
        : {
            ...task,
            operation: scopedOperations.find(
              operation => operation.id === tasks.tasks.find(record => record.id === task.id)?.snapshot.operationId,
            ),
          },
    );
    const visible = new Set(visibleTasksForUser(allManaged, currentUser, userScope).map(task => task.id));
    const detected = new Set(isDemo ? detectedAttentionItems.map(item => item.id) : []);
    return allManaged.filter(
      task => visible.has(task.id) || (detected.has(task.id) && !taskIsExplicitlyAssigned(task)),
    );
  }, [
    tasks,
    isDemo,
    persistentAttentionItems,
    detectedAttentionItems,
    taskClock,
    userScope,
    currentUser,
    scopedOperations,
  ]);
  const attentionItems = useMemo(
    () => actionableAttentionItems(taskItems, new Date(taskClock).toISOString()),
    [taskItems, taskClock],
  );
  const delegatedDecisionOperationIds = useMemo(
    () =>
      new Set(
        tasks.tasks
          .filter(task => task.snapshot.kind === "decision" && taskIsExplicitlyAssigned(task))
          .filter(task => (task.ownerUserId ? task.ownerUserId !== currentUser.id : task.owner !== currentUser.name))
          .flatMap(task => (task.snapshot.operationId ? [task.snapshot.operationId] : [])),
      ),
    [currentUser.id, currentUser.name, tasks.tasks],
  );
  const dailyBriefing = useMemo(
    () => withAssignedTasks(operationalDailyBriefing, attentionItems),
    [attentionItems, operationalDailyBriefing],
  );
  const runTaskCommand = (id: string, command: TaskCommand) => {
    const current = taskRef.current;
    const next = applyTaskCommand(current, id, command, new Date().toISOString());
    if (next === current) return;
    taskRef.current = next;
    setTasks(next);
    persistRealTasks(current, next);
  };
  if (!isDemo && accessLoadError)
    return (
      <section className="empty-state" role="alert">
        <strong>Acesso não confirmado</strong>
        <p>{accessLoadError}</p>
        <button type="button" onClick={() => setAccessLoadAttempt(attempt => attempt + 1)}>
          Tentar novamente
        </button>
        <button type="button" onClick={() => void auth?.signOut()}>
          Voltar ao login
        </button>
      </section>
    );
  if (
    !isDemo &&
    accessServerReady &&
    !(
      [
        "home",
        "operations",
        "controlleria",
        "portfolio",
        "commercial",
        "live",
        "finance",
        "registry",
        "settings",
      ] as const
    ).some(target => canAccessView(currentUser, target))
  )
    return (
      <section className="empty-state" role="status">
        <strong>Nenhum módulo liberado</strong>
        <p>Seu cadastro está ativo. Solicite ao administrador as empresas e permissões necessárias para trabalhar.</p>
        <button type="button" onClick={() => void auth?.signOut()}>
          Voltar ao login
        </button>
      </section>
    );
  if (
    !isDemo &&
    (!accessServerReady ||
      !operationsServerReady ||
      !financeServerReady ||
      !commercialServerReady ||
      !portfolioServerReady ||
      !tasksServerReady ||
      !policiesServerReady)
  )
    return <ModuleLoading />;
  const shellContext = {
    operations: scopedOperations,
    navigate,
    openOperation: (operation: Operation) => {
      if (scopedOperations.some(candidate => candidate.id === operation.id)) setSelected(operation);
    },
    newOperation: () => {
      if (can(currentUser, "operations:edit")) setShowNew(true);
    },
    createCopilotOperation,
    approveCopilotOperation,
    openSettings,
    resetDemo: isDemo ? resetDemo : undefined,
  };
  const roadmapViews = { integrations: "Integrações" } as const;
  const activeSection = selected
    ? "Operações"
    : view === "home"
      ? "Visão geral"
      : view === "finance"
        ? "Financeiro"
        : view === "commercial"
          ? "Comercial"
          : view === "live"
            ? "Operação ao vivo"
            : view === "registry"
              ? "Cadastros"
              : view === "controlleria"
                ? "Controladoria"
                : view === "portfolio"
                  ? "Carteira"
                  : view === "settings" || view === "policies"
                    ? "Configurações"
                    : view in roadmapViews
                      ? roadmapViews[view as keyof typeof roadmapViews]
                      : "Operações";
  let page: React.ReactNode;
  if (selected)
    page = (
      <OperationWorkspace
        operation={selected}
        debtors={scoredDebtors}
        onRegisterDebtor={registerDebtor}
        onBack={() => setSelected(null)}
        onUpdate={updateOperation}
        showGuidance={showGuidance}
        actor={{ id: sessionUser.id, name: sessionUser.name }}
      />
    );
  else if (view === "finance")
    page = (
      <FinanceModule
        initialTab={financeInitialTab}
        onConfigureBanks={
          canAccessView(currentUser, "settings")
            ? company => {
                navigate("settings");
                setBankSettingsCompany(company ?? companyScope);
              }
            : undefined
        }
        state={finance}
        onState={applyFinanceState}
        onEffects={applyFinanceEffects}
        onPatchOperation={patchOperation}
        operations={scopedOperations}
        carteira={carteiraFlows}
        companyScope={companyScope}
        onOpenOperation={setSelected}
        portfolio={!isDemo ? portfolio : undefined}
        onReturnOperation={
          !isDemo
            ? async (operation, intent) => {
                const { returnReleasedOperation } = await import("./operation-return-client");
                const result = await returnReleasedOperation({
                  ...intent,
                  operationId: operation.id,
                  expectedVersion: operation.persistenceVersion ?? 0,
                });
                setOperations(current =>
                  current.map(item => (item.id === result.operation.id ? result.operation : item)),
                );
                setSelected(current => (current?.id === result.operation.id ? result.operation : current));
                try {
                  const [confirmedFinance, confirmedPortfolio] = await Promise.all([
                    loadServerFinance(),
                    loadCurrentPortfolio(),
                  ]);
                  if (confirmedFinance) setFinance(confirmedFinance);
                  setPortfolio(confirmedPortfolio);
                } catch {
                  setFinancePersistenceError(
                    "Devolução confirmada. Atualize a página para consultar a posição financeira atual.",
                  );
                }
              }
            : undefined
        }
        onBankingCommitted={
          !isDemo
            ? async () => {
                const [confirmedFinance, confirmedPortfolio] = await Promise.all([
                  loadServerFinance(),
                  loadCurrentPortfolio(),
                ]);
                if (confirmedFinance) setFinance(confirmedFinance);
                setPortfolio(confirmedPortfolio);
              }
            : undefined
        }
      />
    );
  else if (view === "commercial")
    page = (
      <CommercialModule
        state={registryValue.commercial}
        onState={registryValue.onCommercial}
        operations={scopedOperations}
        financials={homeFinancials}
        finance={finance}
        onSendCommission={sendCommercialCommission}
        canDecideCommittee={can(currentUser, "risk:decide")}
        onOpenOperation={setSelected}
        onNavigate={navigate}
      />
    );
  else if (view === "home")
    page = (
      <HomeDashboard
        operations={scopedOperations}
        debtors={scoredDebtors}
        financials={homeFinancials}
        finance={finance}
        carteira={carteiraFlows}
        onGoFinance={() => navigate("finance")}
        companyScope={companyScope}
        onOpen={setSelected}
        onGoOperations={() => navigate("operations")}
        onGoPortfolio={openPortfolio}
        onGoLive={can(currentUser, "users:manage") ? () => navigate("live") : undefined}
        onNew={can(currentUser, "operations:edit") ? () => setShowNew(true) : undefined}
        revenueGoals={operationalDefaults.revenueGoals}
        originationGoals={operationalDefaults.originationGoals}
        includeDemoPortfolio={isDemo}
        portfolioTitlesOverride={livePortfolioTitles}
        delegatedDecisionOperationIds={delegatedDecisionOperationIds}
        canViewRadarScores={can(currentUser, "portfolio:manage")}
        radar={{
          ...radar,
          mode: isDemo ? "demo" : access.previewUserId ? "preview" : "live",
          onRefresh: radar.refresh,
          onAccept: radar.accept,
          onEvent: event => {
            if (event.operationId) {
              const operation = scopedOperations.find(item => item.id === event.operationId);
              if (operation && can(currentUser, "operations:view")) {
                setSelected(operation);
                return;
              }
            }
            navigate(event.view);
          },
        }}
      />
    );
  else if (view === "live")
    page = (
      <LiveOperations
        demoMode={isDemo}
        users={access.users}
        currentUser={currentUser}
        operations={scopedOperations}
        onOpenOperation={setSelected}
      />
    );
  else if (view === "registry")
    page = (
      <RegistryModule
        debtors={scoredDebtors}
        operations={scopedOperations}
        onOpenOperation={setSelected}
        onNavigate={navigate}
        portfolioTitles={livePortfolioTitles}
      />
    );
  else if (view === "portfolio")
    page = (
      <PortfolioModule
        key={portfolioFocus ? JSON.stringify(portfolioFocus) : "portfolio-default"}
        portfolio={portfolio}
        onPortfolio={applyPortfolioState}
        companyScope={companyScope}
        onNavigate={target => {
          navigate(target);
          if (target === "finance") setFinanceInitialTab("cobranca");
        }}
        focus={portfolioFocus}
        debtors={scoredDebtors}
        finance={!isDemo ? finance : undefined}
        onSettlement={
          !isDemo
            ? async command => {
                const { sendReceivableCommand } = await import("./receivable-client");
                const saved = await sendReceivableCommand(command);
                setFinance(saved.finance);
                setPortfolio(saved.portfolio);
              }
            : undefined
        }
      />
    );
  else if (view === "controlleria")
    page = (
      <ControlleriaModule
        operations={scopedOperations}
        portfolio={portfolio}
        onPortfolio={applyPortfolioState}
        companyScope={companyScope}
        onOpenOperation={setSelected}
      />
    );
  else if (view === "settings" || view === "policies")
    page = (
      <SettingsModule
        key={`${settingsInitialSection ?? "overview"}:${bankSettingsCompany ?? ""}`}
        finance={finance}
        onFinance={applyFinanceState}
        companyScope={companyScope}
        initialSection={settingsInitialSection}
        bankSettingsCompany={bankSettingsCompany}
        policies={policies}
        persistedPolicies={persistedPolicies}
        onPolicies={applyPoliciesState}
        onSavePolicies={persistRealPolicies}
        showGuidance={showGuidance}
        onGuidance={value => {
          setShowGuidance(value);
          saveGuidance(value);
        }}
        showJourney={showJourney}
        onJourney={value => {
          setShowJourney(value);
          saveJourneyBar(value);
        }}
        integrations={integrations}
        onIntegrations={setIntegrations}
        operationalDefaults={operationalDefaults}
        onOperationalDefaults={setOperationalDefaults}
        access={access}
        onAccess={applyConfirmedAccess}
        intelligence={intelligence}
        onIntelligence={setIntelligence}
        intelligenceReady={intelligenceServerReady}
        intelligenceError={intelligencePersistenceError}
        onRetryIntelligence={() => {
          setIntelligencePersistenceError(undefined);
          setIntelligenceServerReady(false);
          setIntelligenceLoadAttempt(attempt => attempt + 1);
        }}
        policyApprovalActor={{ id: sessionUser.id, name: sessionUser.name }}
        demoMode={isDemo}
      />
    );
  else if (view in roadmapViews) page = <ModuleRoadmap view={view as keyof typeof roadmapViews} />;
  else
    page = (
      <OperationsList
        operations={scopedOperations}
        companyScope={companyScope}
        onOpen={setSelected}
        onNew={can(currentUser, "operations:edit") ? () => setShowNew(true) : undefined}
        onReset={isDemo ? resetDemo : undefined}
      />
    );
  return (
    <EligibilityPolicyProvider value={policies.policies}>
      <IntegrationProvider value={integrations}>
        <RegistryContext.Provider value={registryValue}>
          <QualityContext.Provider value={qualityValue}>
            <ShellContext.Provider value={shellContext}>
              <Shell
                active={activeSection}
                operationCount={activeCount}
                companyScope={selected?.vehicle ?? companyScope}
                onCompanyScopeChange={scope => {
                  if (
                    currentUser.access !== "admin" &&
                    (scope === "Consolidado" || !currentUser.companyScopes.includes(scope))
                  )
                    return;
                  setCompanyScope(scope);
                  if (selected) setSelected(null);
                }}
                onOpenSettings={openSettings}
                onNavigate={navigate}
                showJourney={showJourney}
                currentUser={currentUser}
                intelligence={intelligence}
                onIntelligence={setIntelligence}
                dailyBriefing={dailyBriefing}
                attentionItems={attentionItems}
                taskItems={taskItems}
                taskAssignees={access.users.filter(
                  user => user.status === "active" && user.tenantIds.includes(intelligence.tenantId),
                )}
                onTaskCommand={runTaskCommand}
                briefingReady={storageReady}
                previewedBy={access.previewUserId ? sessionUser.name : undefined}
                onEndPreview={() => {
                  setAccess(current => stopUserPreview(current));
                  setCompanyScope("Consolidado");
                }}
                debtors={scoredDebtors}
                portfolioTitles={livePortfolioTitles}
                demoMode={isDemo}
              >
                {navigationDenied && (
                  <div className="empty-state" role="alert">
                    <span>{navigationDenied}</span>
                    <button type="button" onClick={() => setNavigationDenied(undefined)}>
                      Fechar aviso
                    </button>
                  </div>
                )}
                {operationPersistenceError && (
                  <div className="empty-state" role="alert">
                    <strong>Alterações da operação ainda não foram salvas</strong>
                    <span>{operationPersistenceError}</span>
                  </div>
                )}
                {financePersistenceError && (
                  <div className="empty-state" role="alert">
                    <strong>Alterações do Financeiro ainda não foram salvas</strong>
                    <span>{financePersistenceError}</span>
                  </div>
                )}
                {taskPersistenceError && (
                  <div className="empty-state" role="alert">
                    <strong>Alterações das tarefas ainda não foram salvas</strong>
                    <span>{taskPersistenceError}</span>
                  </div>
                )}
                {policyPersistenceError && (
                  <div className="empty-state" role="alert">
                    <strong>Alterações das políticas ainda não foram salvas</strong>
                    <span>{policyPersistenceError}</span>
                  </div>
                )}
                {commercialPersistenceError && (
                  <div className="empty-state" role="alert">
                    <strong>Alterações do Comercial ainda não foram salvas</strong>
                    <span>{commercialPersistenceError}</span>
                  </div>
                )}
                {portfolioLoadError && (
                  <div className="empty-state" role="alert">
                    <strong>A carteira não foi carregada</strong>
                    <span>{portfolioLoadError}</span>
                  </div>
                )}
                <Suspense fallback={<ModuleLoading />}>{page}</Suspense>
              </Shell>
              {showNew && can(currentUser, "operations:edit") && (
                <Suspense fallback={null}>
                  <NewOperationModal
                    defaultDestination={companyScope}
                    operations={operations}
                    debtors={debtors}
                    onClose={() => setShowNew(false)}
                    onCreate={createOperation}
                  />
                </Suspense>
              )}
              {isDemo && confirmReset && (
                <div className="modal-backdrop" role="presentation">
                  <section
                    className="settings-modal reset-modal"
                    role="alertdialog"
                    aria-modal="true"
                    aria-labelledby="reset-title"
                  >
                    <div className="modal-head">
                      <div>
                        <Badge tone="eyebrow">DEMONSTRAÇÃO</Badge>
                        <h2 id="reset-title">Restaurar dados de demonstração?</h2>
                        <p>
                          Operações, cadastro comercial, comitês, comissões e financeiro voltam ao estado inicial. As
                          alterações feitas neste navegador são descartadas.
                        </p>
                      </div>
                    </div>
                    <div className="modal-actions">
                      <button className="secondary-action" onClick={() => setConfirmReset(false)}>
                        Cancelar
                      </button>
                      <button className="primary-action" onClick={doResetDemo}>
                        Restaurar
                      </button>
                    </div>
                  </section>
                </div>
              )}
            </ShellContext.Provider>
          </QualityContext.Provider>
        </RegistryContext.Provider>
      </IntegrationProvider>
    </EligibilityPolicyProvider>
  );
}

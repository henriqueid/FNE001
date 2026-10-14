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
import { QualityContext, type QualityValue, useQualityPolicyState } from "@/src/features/risk/use-quality-policy";
import { mergeParties, type Party, partyToCedent, seedParties } from "@/src/domain/registry/parties";
import { saveParty as savePartyRecord } from "@/src/domain/registry/party-save";
import { buildRegistry, effectiveCedents, repurchaseEvents } from "@/src/domain/registry/registry";
import { portfolioHomeTitles, seedPortfolio, syncPortfolio } from "@/src/domain/portfolio/model";
import { Shell } from "@/src/features/shell/shell";
import { type AppView, ShellContext } from "@/src/features/shell/shell-context";
import { RegistryContext, type RegistryValue } from "./registry-context";
import { EligibilityPolicyProvider } from "./eligibility-policy-context";
import { emptyEligibilityPolicies, seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import { emptyIntegrationState, seedIntegrationState } from "@/src/domain/integrations/model";
import { IntegrationProvider } from "./integration-context";
import { emptyOperationalDefaults, seedOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { buildDailyBriefing, demoAdminUser, operationsForUser } from "@/src/domain/copilot/daily-briefing";
import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import {
  actionableAttentionItems,
  applyTaskCommand,
  managedTasks,
  reconcileTasks,
  seedTaskState,
  type TaskCommand,
  type TaskState,
  visibleTasksForUser,
} from "@/src/domain/tasks/model";
import {
  activeUser,
  authenticatedUser,
  can,
  canAccessView,
  defaultViewFor,
  seedAccessState,
  stopUserPreview,
} from "@/src/domain/access/model";
import { emptyIntelligenceState, seedIntelligenceState } from "@/src/domain/intelligence/model";
import { type PublishedNotification } from "@/src/domain/notifications/model";
import { loadAccessDirectory, saveAccessDirectory } from "./access-directory-client";
import { syncPublishedNotifications } from "./notification-client";
import { useStratoAuth } from "@/src/features/auth/auth-context";
import { loadRegistryParties, persistRegistryParty } from "./registry-client";
import { useCompanyDestinations } from "./company-context";
import {
  loadOperations as loadServerOperations,
  persistOperation as persistServerOperation,
} from "./operations-client";
import { loadFinanceState as loadServerFinance, persistFinanceState as persistServerFinance } from "./finance-client";
import { loadCurrentPortfolio, persistPortfolioState as persistServerPortfolio } from "./portfolio-client";
import { loadTaskState as loadServerTasks, persistTaskState as persistServerTasks } from "./tasks-client";
import {
  loadEligibilityPolicyState as loadServerPolicies,
  persistEligibilityPolicyState as persistServerPolicies,
} from "./eligibility-policies-client";
import {
  loadCommercialState as loadServerCommercial,
  persistCommercialState as persistServerCommercial,
} from "./commercial-client";

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
  const [access, setAccess] = useState(() => seedAccessState());
  const [accessServerReady, setAccessServerReady] = useState(isDemo);
  const [intelligence, setIntelligence] = useState(() => (isDemo ? seedIntelligenceState() : emptyIntelligenceState()));
  const currentUser = useMemo(() => activeUser(access), [access]);
  const sessionUser = useMemo(() => authenticatedUser(access), [access]);
  const [view, setView] = useState<AppView>("home");
  const navigate = (target: AppView) => {
    if (!canAccessView(currentUser, target)) return;
    setSelected(null);
    setView(target);
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
  const [policiesServerReady, setPoliciesServerReady] = useState(isDemo);
  const [policyPersistenceError, setPolicyPersistenceError] = useState<string>();
  const policySaveQueue = useRef<Promise<typeof policies> | null>(null);
  const [integrations, setIntegrations] = useState(() => (isDemo ? seedIntegrationState() : emptyIntegrationState()));
  const [operationalDefaults, setOperationalDefaults] = useState(() =>
    isDemo ? seedOperationalDefaults() : emptyOperationalDefaults(),
  );
  const [tasks, setTasks] = useState(() => seedTaskState());
  const [tasksServerReady, setTasksServerReady] = useState(isDemo);
  const [taskPersistenceError, setTaskPersistenceError] = useState<string>();
  const taskSaveQueue = useRef<Promise<TaskState> | null>(null);
  const taskRef = useRef(tasks);
  const [publishedNotifications, setPublishedNotifications] = useState<PublishedNotification[]>([]);
  const [taskClock, setTaskClock] = useState(() => Date.now());

  const persistRealPolicies = useCallback(
    (candidate: typeof policies) => {
      if (isDemo) return;
      const prior = policySaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior
        .catch(() => candidate)
        .then(serverBase =>
          persistServerPolicies({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
      policySaveQueue.current = queued;
      void queued
        .then(saved => {
          setPolicyPersistenceError(undefined);
          setPolicies(current => ({ ...current, persistenceVersion: saved.persistenceVersion }));
        })
        .catch(reason => {
          setPolicyPersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar as políticas no banco.",
          );
        })
        .finally(() => {
          if (policySaveQueue.current === queued) policySaveQueue.current = null;
        });
    },
    [isDemo],
  );

  function applyPoliciesState(candidate: typeof policies) {
    setPolicies(candidate);
    persistRealPolicies(candidate);
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
      if (isDemo) return;
      const prior = commercialSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior
        .catch(() => candidate)
        .then(serverBase =>
          persistServerCommercial({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
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
    },
    [isDemo],
  );

  const applyCommercialState = useCallback(
    (candidate: CommercialState) => {
      commercialRef.current = candidate;
      setCommercial(candidate);
      persistRealCommercial(candidate);
    },
    [persistRealCommercial],
  );

  const persistRealPortfolio = useCallback(
    (candidate: typeof portfolio) => {
      if (isDemo) return;
      const prior = portfolioSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior
        .catch(() => candidate)
        .then(serverBase =>
          persistServerPortfolio({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
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
    },
    [isDemo],
  );

  const applyPortfolioState = useCallback(
    (candidate: typeof portfolio) => {
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
      portfolioRef.current = attributed;
      setPortfolio(attributed);
      persistRealPortfolio(attributed);
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
        setOperations(current =>
          current.map(operation =>
            operation.id === saved.id ? { ...operation, persistenceVersion: saved.persistenceVersion } : operation,
          ),
        );
        setSelected(current =>
          current?.id === saved.id ? { ...current, persistenceVersion: saved.persistenceVersion } : current,
        );
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
      if (isDemo) return;
      const prior = financeSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior
        .catch(() => candidate)
        .then(serverBase =>
          persistServerFinance({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
      financeSaveQueue.current = queued;
      void queued
        .then(saved => {
          setFinancePersistenceError(undefined);
          setFinance(current => ({ ...current, persistenceVersion: saved.persistenceVersion }));
        })
        .catch(reason => {
          setFinancePersistenceError(
            reason instanceof Error ? reason.message : "Não foi possível salvar o Financeiro no banco.",
          );
        })
        .finally(() => {
          if (financeSaveQueue.current === queued) financeSaveQueue.current = null;
        });
    },
    [isDemo],
  );

  function applyFinanceState(candidate: FinanceState) {
    setFinance(candidate);
    persistRealFinance(candidate);
  }

  const persistRealTasks = useCallback(
    (candidate: TaskState) => {
      if (isDemo) return;
      const prior = taskSaveQueue.current ?? Promise.resolve(candidate);
      const queued = prior
        .catch(() => candidate)
        .then(serverBase =>
          persistServerTasks({
            ...candidate,
            persistenceVersion: serverBase.persistenceVersion ?? candidate.persistenceVersion,
          }),
        );
      taskSaveQueue.current = queued;
      void queued
        .then(saved => {
          setTaskPersistenceError(undefined);
          setTasks(current => ({ ...current, persistenceVersion: saved.persistenceVersion }));
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
    if (!isDemo && !financeServerReady) return;
    const current = financeRef.current;
    const next = syncReleases(current, operations, homeFinancials);
    if (next === current) return;
    setFinance(next);
    persistRealFinance(next);
  }, [operations, homeFinancials, financeServerReady, isDemo, persistRealFinance]);
  useEffect(() => {
    if (!isDemo && !portfolioServerReady) return;
    const current = portfolioRef.current;
    const next = syncPortfolio(current, operations);
    if (next !== current) applyPortfolioState(next);
  }, [operations, portfolioServerReady, isDemo, applyPortfolioState]);
  function applyFinanceEffects(effects: Effect[]) {
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

  // Restaura o que foi salvo depois de montar (evita divergência na hidratação do SSR).
  useEffect(() => {
    const stored = isDemo ? loadPersistedState() : {};
    /* eslint-disable react-hooks/set-state-in-effect -- restauração única do localStorage após montar */
    if (stored.operations) setOperations(stored.operations);
    if (stored.debtors) setDebtors(stored.debtors);
    if (stored.finance) setFinance(stored.finance);
    if (stored.commercial) setCommercial(stored.commercial);
    if (stored.parties) setSavedParties(stored.parties);
    if (stored.portfolio) setPortfolio(stored.portfolio);
    if (stored.policies) setPolicies(stored.policies);
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
    if (storageReady) saveGuidance(showGuidance);
  }, [showGuidance, storageReady]);

  useEffect(() => {
    if (!storageReady || accessServerReady) return;
    if (isDemo) return;
    let cancelled = false;
    const tenantId = intelligence.tenantId;
    loadAccessDirectory(tenantId)
      .then(serverState => {
        if (cancelled) return;
        setAccess(current => ({ ...serverState, previewUserId: current.previewUserId }));
      })
      .catch(() => {
        /* mantém a sessão atual e tenta novamente no próximo acesso */
      })
      .finally(() => {
        if (!cancelled) setAccessServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [accessServerReady, intelligence.tenantId, storageReady, isDemo]);

  useEffect(() => {
    if (!storageReady || isDemo) return;
    let cancelled = false;
    loadRegistryParties()
      .then(parties => {
        if (!cancelled) setSavedParties(parties);
      })
      .catch(() => {
        /* o modo real permanece vazio quando o banco estiver indisponível */
      });
    return () => {
      cancelled = true;
    };
  }, [isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || operationsServerReady) return;
    let cancelled = false;
    loadServerOperations()
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
  }, [isDemo, operationsServerReady, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || financeServerReady) return;
    let cancelled = false;
    loadServerFinance()
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
  }, [financeServerReady, isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || commercialServerReady) return;
    let cancelled = false;
    loadServerCommercial()
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
  }, [commercialServerReady, isDemo, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || tasksServerReady) return;
    let cancelled = false;
    loadServerTasks()
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
  }, [isDemo, storageReady, tasksServerReady]);

  useEffect(() => {
    if (!storageReady || isDemo || policiesServerReady) return;
    let cancelled = false;
    loadServerPolicies()
      .then(serverPolicies => {
        if (cancelled) return;
        setPolicies(serverPolicies ?? emptyEligibilityPolicies());
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
  }, [isDemo, policiesServerReady, storageReady]);

  useEffect(() => {
    if (!storageReady || isDemo || portfolioServerReady) return;
    let cancelled = false;
    loadCurrentPortfolio()
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
  }, [isDemo, portfolioServerReady, storageReady]);

  useEffect(() => {
    if (!accessServerReady || isDemo) return;
    const timer = window.setTimeout(() => {
      void saveAccessDirectory(intelligence.tenantId, access).catch(() => {
        /* o estado local continua disponível e uma próxima alteração tenta novamente */
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [access, accessServerReady, intelligence.tenantId, isDemo]);

  useEffect(() => {
    if (!accessServerReady) return;
    let cancelled = false;
    const refresh = () =>
      syncPublishedNotifications(intelligence.tenantId)
        .then(result => {
          if (!cancelled) setPublishedNotifications(result.notifications);
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
  }, [accessServerReady, intelligence.tenantId]);

  useEffect(() => {
    if (storageReady) saveJourneyBar(showJourney);
  }, [showJourney, storageReady]);

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
    if (operation) {
      // eslint-disable-next-line react-hooks/set-state-in-effect -- aplica uma única vez o endereço de uma aba de trabalho compartilhada
      setSelected(operation);
      setView("operations");
      return;
    }
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
    if (targetView && validViews.includes(targetView)) setView(targetView);
  }, [storageReady, operations]);

  function updateOperation(updated: Operation) {
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
    const baseline = isDemo ? initialCedents : [];
    const known = new Set(baseline.map(c => c.document.replace(/\D/g, "")));
    const created = savedParties
      .filter(p => p.roles.includes("cedente") && p.status === "Ativo" && !known.has(p.document.replace(/\D/g, "")))
      .map(partyToCedent);
    return effectiveCedents(commercial, [...baseline, ...created]);
  }, [commercial, savedParties, isDemo]);
  // Score de qualidade único (0–1000): calculado pela política sobre o histórico de cada cliente e usado
  // igual no cadastro, na operação, no painel de Risco e no panorama. O score de bureau fica em `bureauScore`.
  const qualityState = useQualityPolicyState(isDemo);
  const scoreDay = isoDate(new Date());
  const cedentHistories = useMemo(
    () => (isDemo ? demoCedentHistories(registryCedents, scoreDay) : []),
    [registryCedents, scoreDay, isDemo],
  );
  const debtorHistories = useMemo(
    () =>
      isDemo
        ? demoDebtorHistories(
            debtors.map(d => {
              const doc = d.document.replace(/\D/g, "");
              return { id: doc, name: d.name, document: doc, exposure: d.portfolioReceivable ?? 0, debtor: d };
            }),
            scoreDay,
          )
        : [],
    [debtors, scoreDay, isDemo],
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
    () => debtors.map(d => scoredDebtor(d, qualityValue.byDocument.get(d.document.replace(/\D/g, "")))),
    [debtors, qualityValue],
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
      saveParty: (party, reason) => {
        if (!can(currentUser, "registry:edit")) return { error: "Seu perfil não permite editar cadastros." };
        const result = savePartyRecord({
          party,
          saved: savedParties,
          all: parties,
          debtors,
          commercial,
          today,
          by: "Henrique",
          reason,
          source: "Cadastro",
        });
        if (!result.ok) return { error: result.error };
        setSavedParties(result.saved);
        setDebtors(result.debtors);
        setCommercial(result.commercial);
        if (!isDemo) void persistRegistryParty(result.saved.find(item => item.id === party.id) ?? party);
        return { message: result.message };
      },
      onCommercial: next => {
        if (!can(currentUser, "portfolio:manage")) return;
        const { carteiraEvents: _drop, ...rest } = next;
        void _drop;
        applyCommercialState(rest as CommercialState);
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
  const dailyBriefing = useMemo(
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
    if (!storageReady || !tasksServerReady || (!isDemo && sessionUser.access !== "admin")) return;
    const current = taskRef.current;
    const next = reconcileTasks(current, persistentAttentionItems, new Date().toISOString());
    if (next === current) return;
    taskRef.current = next;
    setTasks(next);
    persistRealTasks(next);
  }, [isDemo, persistentAttentionItems, persistRealTasks, sessionUser.access, storageReady, tasksServerReady]);
  const taskItems = useMemo(() => {
    const allManaged = managedTasks(
      tasks,
      [...persistentAttentionItems, ...detectedAttentionItems],
      new Date(taskClock).toISOString(),
    );
    const visible = new Set(visibleTasksForUser(allManaged, currentUser, userScope).map(task => task.id));
    const detected = new Set(detectedAttentionItems.map(item => item.id));
    return allManaged.filter(task => visible.has(task.id) || detected.has(task.id));
  }, [tasks, persistentAttentionItems, detectedAttentionItems, taskClock, userScope, currentUser]);
  const attentionItems = useMemo(
    () => actionableAttentionItems(taskItems, new Date(taskClock).toISOString()),
    [taskItems, taskClock],
  );
  const runTaskCommand = (id: string, command: TaskCommand) => {
    const next = applyTaskCommand(taskRef.current, id, command, new Date().toISOString());
    if (next === taskRef.current) return;
    taskRef.current = next;
    setTasks(next);
    persistRealTasks(next);
  };
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
        state={finance}
        onState={applyFinanceState}
        onEffects={applyFinanceEffects}
        onPatchOperation={patchOperation}
        operations={scopedOperations}
        carteira={carteiraFlows}
        companyScope={companyScope}
        onOpenOperation={setSelected}
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
        onFinance={applyFinanceState}
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
        onGoLive={can(currentUser, "users:manage") ? () => navigate("live") : undefined}
        onNew={can(currentUser, "operations:edit") ? () => setShowNew(true) : undefined}
        revenueGoals={operationalDefaults.revenueGoals}
        originationGoals={operationalDefaults.originationGoals}
        includeDemoPortfolio={isDemo}
        portfolioTitlesOverride={livePortfolioTitles}
      />
    );
  else if (view === "live")
    page = (
      <LiveOperations
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
        portfolio={portfolio}
        onPortfolio={applyPortfolioState}
        companyScope={companyScope}
        onNavigate={navigate}
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
        policies={policies}
        onPolicies={applyPoliciesState}
        showGuidance={showGuidance}
        onGuidance={setShowGuidance}
        showJourney={showJourney}
        onJourney={setShowJourney}
        integrations={integrations}
        onIntegrations={setIntegrations}
        operationalDefaults={operationalDefaults}
        onOperationalDefaults={setOperationalDefaults}
        access={access}
        onAccess={setAccess}
        intelligence={intelligence}
        onIntelligence={setIntelligence}
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
                taskAssignees={access.users
                  .filter(user => user.status === "active" && user.tenantIds.includes(intelligence.tenantId))
                  .map(user => ({ id: user.id, name: user.name, department: user.department }))}
                onTaskCommand={runTaskCommand}
                briefingReady={storageReady}
                previewedBy={access.previewUserId ? sessionUser.name : undefined}
                onEndPreview={() => {
                  setAccess(current => stopUserPreview(current));
                  setCompanyScope("Consolidado");
                }}
                debtors={scoredDebtors}
                demoMode={isDemo}
              >
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

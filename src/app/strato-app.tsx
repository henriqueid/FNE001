"use client";

/**
 * Raiz da aplicação (cliente). Dono do estado global — operações, sacados, financeiro, comercial e cadastro —,
 * da persistência em localStorage e da navegação entre módulos. Deriva o cadastro único (`RegistryContext`) e o
 * contexto do shell (`ShellContext`) e escolhe a tela pela `view` atual ou pela operação aberta.
 */
import { normalizedPricing, pricingCalculation } from "@/src/domain/operations/pricing";
import { OperationsList } from "@/src/features/operations/central/operations-list";
import { Badge } from "@/src/features/operations/components/status";
import { type NewOperationInput, NewOperationModal } from "@/src/features/operations/new-operation/new-operation-modal";
import { OperationWorkspace } from "@/src/features/operations/workspace/operation-workspace";

import CommercialModule from "@/src/features/commercial/commercial-module";
import FinanceModule from "@/src/features/finance/finance-module";
import HomeDashboard from "@/src/features/home/home-dashboard";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  clearPersistedState,
  loadPersistedState,
  saveGuidance,
  saveJourneyBar,
  savePersistedState,
} from "./persistence";
import { buildNewOperation } from "@/src/domain/operations/create-operation";

import { managerOf, repAt } from "@/src/domain/commercial/rules";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { type CommercialState } from "@/src/domain/commercial/types";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { destinations } from "@/src/domain/core/demo/companies";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { type Effect } from "@/src/domain/finance/ledger";
import type { FinanceState } from "@/src/domain/finance/model";
import { payableKey, syncReleases } from "@/src/domain/finance/releases";
import { seedFinance } from "@/src/domain/finance/setup";
import { isoDate, portfolioTitles } from "@/src/domain/home/metrics";
import { demoCedentHistories, demoDebtorHistories } from "@/src/domain/core/demo/quality-history";
import { qualityByDocument, scoredCedent, scoredDebtor } from "@/src/domain/risk/quality-scores";
import { QualityContext, type QualityValue, useQualityPolicyState } from "@/src/features/risk/use-quality-policy";
import { mergeParties, type Party, partyToCedent, seedParties } from "@/src/domain/registry/parties";
import { saveParty as savePartyRecord } from "@/src/domain/registry/party-save";
import { buildRegistry, effectiveCedents, repurchaseEvents } from "@/src/domain/registry/registry";
import { seedPortfolio, syncPortfolio } from "@/src/domain/portfolio/model";
import PortfolioModule from "@/src/features/portfolio/portfolio-module";
import ControlleriaModule from "@/src/features/controlleria/controlleria-module";
import RegistryModule from "@/src/features/registry/registry-module";
import { ModuleRoadmap } from "@/src/features/shell/module-roadmap";
import { Shell } from "@/src/features/shell/shell";
import { type AppView, ShellContext } from "@/src/features/shell/shell-context";
import { RegistryContext, type RegistryValue } from "./registry-context";
import { EligibilityPolicyProvider } from "./eligibility-policy-context";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import SettingsModule from "@/src/features/settings/settings-module";
import { seedIntegrationState } from "@/src/domain/integrations/model";
import { IntegrationProvider } from "./integration-context";
import { seedOperationalDefaults } from "@/src/domain/registry/operational-profile";
import { buildDailyBriefing, demoAdminUser, operationsForUser } from "@/src/domain/copilot/daily-briefing";
import { buildAttentionItems } from "@/src/domain/copilot/attention-center";
import {
  actionableAttentionItems,
  applyTaskCommand,
  managedTasks,
  reconcileTasks,
  seedTaskState,
  type TaskCommand,
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
import { seedIntelligenceState } from "@/src/domain/intelligence/model";
import { loadAccessDirectory, saveAccessDirectory } from "./access-directory-client";

const COMPANY_SCOPE_KEY = "strato-company-scope";
const ACCESS_SERVER_MIGRATION_KEY = "strato-access-server-migrated-v1";

export default function StratoApp() {
  const deepLinkHandled = useRef(false);
  const [operations, setOperations] = useState(initialOperations);
  const [debtors, setDebtors] = useState(initialDebtors);
  const [selected, setSelected] = useState<Operation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [companyScope, setCompanyScope] = useState("Consolidado");
  const [storageReady, setStorageReady] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [showJourney, setShowJourney] = useState(false);
  const [confirmReset, setConfirmReset] = useState(false);
  const [access, setAccess] = useState(() => seedAccessState());
  const [accessServerReady, setAccessServerReady] = useState(false);
  const [intelligence, setIntelligence] = useState(() => seedIntelligenceState());
  const currentUser = useMemo(() => activeUser(access), [access]);
  const sessionUser = useMemo(() => authenticatedUser(access), [access]);
  const [view, setView] = useState<AppView>("home");
  const navigate = (target: AppView) => {
    if (!canAccessView(currentUser, target)) return;
    setSelected(null);
    setView(target);
  };
  const [finance, setFinance] = useState<FinanceState>(() => seedFinance());
  const [portfolio, setPortfolio] = useState(() => seedPortfolio(initialOperations));
  // Vínculo comercial do cliente (carteira, comitês, comissões): compartilhado por Cadastro, Operação, Carteira e Comercial.
  const [commercial, setCommercial] = useState<CommercialState>(() => seedCommercial());
  // Cadastro de pessoas (cedentes, sacados, fornecedores, representantes, investidores...).
  const [savedParties, setSavedParties] = useState<Party[]>(() => seedParties());
  const [policies, setPolicies] = useState(() => seedEligibilityPolicies());
  const [integrations, setIntegrations] = useState(() => seedIntegrationState());
  const [operationalDefaults, setOperationalDefaults] = useState(() => seedOperationalDefaults());
  const [tasks, setTasks] = useState(() => seedTaskState());
  const [taskClock, setTaskClock] = useState(() => Date.now());
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
    // eslint-disable-next-line react-hooks/set-state-in-effect -- sincroniza liberações com o financeiro sempre que as operações mudam
    setFinance(current => syncReleases(current, operations, homeFinancials));
  }, [operations, homeFinancials]);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- novas liberações entram na carteira sem apagar manutenções
    setPortfolio(current => syncPortfolio(current, operations));
  }, [operations]);
  function applyFinanceEffects(effects: Effect[]) {
    if (!can(currentUser, "finance:release")) return;
    setOperations(current =>
      current.map(operation => {
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
      }),
    );
  }
  function patchOperation(id: string, patch: Partial<Operation>) {
    if (!can(currentUser, "finance:release")) return;
    setOperations(current => current.map(operation => (operation.id === id ? { ...operation, ...patch } : operation)));
  }
  // A empresa do título acompanha a projeção de caixa do Financeiro (antes entrava em qualquer recorte).
  const carteiraFlows = useMemo(
    () =>
      portfolioTitles(operations).map(title => ({ date: title.dueDate, amount: title.amount, company: title.vehicle })),
    [operations],
  );

  // Restaura o que foi salvo depois de montar (evita divergência na hidratação do SSR).
  useEffect(() => {
    const stored = loadPersistedState();
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
    if (stored.access) setAccess(stored.access);
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
  }, []);

  useEffect(() => {
    if (storageReady)
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
  ]);

  useEffect(() => {
    if (storageReady) saveGuidance(showGuidance);
  }, [showGuidance, storageReady]);

  useEffect(() => {
    if (!storageReady || accessServerReady) return;
    let cancelled = false;
    const tenantId = intelligence.tenantId;
    const migrate = window.localStorage.getItem(ACCESS_SERVER_MIGRATION_KEY) !== "done";
    const request = migrate ? saveAccessDirectory(tenantId, access) : loadAccessDirectory(tenantId);
    request
      .then(serverState => {
        if (cancelled) return;
        setAccess(current => ({ ...serverState, previewUserId: current.previewUserId }));
        window.localStorage.setItem(ACCESS_SERVER_MIGRATION_KEY, "done");
      })
      .catch(() => {
        /* mantém a demonstração local quando o backend estiver indisponível */
      })
      .finally(() => {
        if (!cancelled) setAccessServerReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, [access, accessServerReady, intelligence.tenantId, storageReady]);

  useEffect(() => {
    if (!accessServerReady) return;
    const timer = window.setTimeout(() => {
      void saveAccessDirectory(intelligence.tenantId, access).catch(() => {
        /* o estado local continua disponível e uma próxima alteração tenta novamente */
      });
    }, 300);
    return () => window.clearTimeout(timer);
  }, [access, accessServerReady, intelligence.tenantId]);

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
    setOperations(current => current.map(operation => (operation.id === updated.id ? updated : operation)));
    setSelected(updated);
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
    const next = buildNewOperation(input, operations, commercial, new Date().toISOString().slice(0, 10));
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
  }
  const openSettings = () => navigate("settings");
  const carteiraEvents = useMemo(() => repurchaseEvents(operations), [operations]);
  const commercialLive = useMemo(() => ({ ...commercial, carteiraEvents }), [commercial, carteiraEvents]);
  // Cedentes = cadastro de crédito existente + cedentes novos criados no Cadastro; limite vem do comitê.
  const registryCedents = useMemo(() => {
    const known = new Set(initialCedents.map(c => c.document.replace(/\D/g, "")));
    const created = savedParties
      .filter(p => p.roles.includes("cedente") && p.status === "Ativo" && !known.has(p.document.replace(/\D/g, "")))
      .map(partyToCedent);
    return effectiveCedents(commercial, [...initialCedents, ...created]);
  }, [commercial, savedParties]);
  // Score de qualidade único (0–1000): calculado pela política sobre o histórico de cada cliente e usado
  // igual no cadastro, na operação, no painel de Risco e no panorama. O score de bureau fica em `bureauScore`.
  const qualityState = useQualityPolicyState();
  const scoreDay = isoDate(new Date());
  const cedentHistories = useMemo(() => demoCedentHistories(registryCedents, scoreDay), [registryCedents, scoreDay]);
  const debtorHistories = useMemo(
    () =>
      demoDebtorHistories(
        debtors.map(d => {
          const doc = d.document.replace(/\D/g, "");
          return { id: doc, name: d.name, document: doc, exposure: d.portfolioReceivable ?? 0, debtor: d };
        }),
        scoreDay,
      ),
    [debtors, scoreDay],
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
        return { message: result.message };
      },
      onCommercial: next => {
        if (!can(currentUser, "portfolio:manage")) return;
        const { carteiraEvents: _drop, ...rest } = next;
        void _drop;
        setCommercial(rest as CommercialState);
      },
    }),
    [
      commercialLive,
      scoredCedents,
      parties,
      savedParties,
      debtors,
      commercial,
      operationalDefaults,
      today,
      currentUser,
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
  const dailyBriefing = useMemo(
    () =>
      buildDailyBriefing({
        user: currentUser,
        operations,
        financials: homeFinancials,
        titles: portfolioTitles(operations),
        referenceDate: today,
        revenueTarget: operationalDefaults.revenueGoals.consolidated.mes,
        scope: userScope,
      }),
    [operations, homeFinancials, today, operationalDefaults.revenueGoals.consolidated.mes, userScope, currentUser],
  );
  const systemAttentionItems = useMemo(
    () =>
      buildAttentionItems({
        operations,
        titles: portfolioTitles(operations),
        user: demoAdminUser,
        referenceDate: today,
        scope: userScope,
      }),
    [operations, today, userScope],
  );
  const detectedAttentionItems = useMemo(
    () =>
      buildAttentionItems({
        operations,
        titles: portfolioTitles(operations),
        user: currentUser,
        referenceDate: today,
        scope: userScope,
      }),
    [operations, today, userScope, currentUser],
  );
  useEffect(() => {
    if (!storageReady) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reconcilia alertas automáticos com o histórico persistido
    setTasks(current => reconcileTasks(current, systemAttentionItems, new Date().toISOString()));
  }, [systemAttentionItems, storageReady]);
  const taskItems = useMemo(() => {
    const allManaged = managedTasks(
      tasks,
      [...systemAttentionItems, ...detectedAttentionItems],
      new Date(taskClock).toISOString(),
    );
    const visible = new Set(visibleTasksForUser(allManaged, currentUser, userScope).map(task => task.id));
    const detected = new Set(detectedAttentionItems.map(item => item.id));
    return allManaged.filter(task => visible.has(task.id) || detected.has(task.id));
  }, [tasks, systemAttentionItems, detectedAttentionItems, taskClock, userScope, currentUser]);
  const attentionItems = useMemo(
    () => actionableAttentionItems(taskItems, new Date(taskClock).toISOString()),
    [taskItems, taskClock],
  );
  const runTaskCommand = (id: string, command: TaskCommand) =>
    setTasks(current => applyTaskCommand(current, id, command, new Date().toISOString()));
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
    resetDemo,
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
      />
    );
  else if (view === "finance")
    page = (
      <FinanceModule
        state={finance}
        onState={setFinance}
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
        onFinance={setFinance}
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
        onNew={can(currentUser, "operations:edit") ? () => setShowNew(true) : undefined}
        revenueGoals={operationalDefaults.revenueGoals}
      />
    );
  else if (view === "registry")
    page = (
      <RegistryModule
        debtors={scoredDebtors}
        operations={scopedOperations}
        onOpenOperation={setSelected}
        onNavigate={navigate}
      />
    );
  else if (view === "portfolio")
    page = (
      <PortfolioModule
        portfolio={portfolio}
        onPortfolio={setPortfolio}
        companyScope={companyScope}
        onNavigate={navigate}
      />
    );
  else if (view === "controlleria")
    page = (
      <ControlleriaModule
        operations={scopedOperations}
        portfolio={portfolio}
        onPortfolio={setPortfolio}
        companyScope={companyScope}
        onOpenOperation={setSelected}
      />
    );
  else if (view === "settings" || view === "policies")
    page = (
      <SettingsModule
        policies={policies}
        onPolicies={setPolicies}
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
        onReset={resetDemo}
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
                dailyBriefing={dailyBriefing}
                attentionItems={attentionItems}
                taskItems={taskItems}
                onTaskCommand={runTaskCommand}
                briefingReady={storageReady}
                previewedBy={access.previewUserId ? sessionUser.name : undefined}
                onEndPreview={() => {
                  setAccess(current => stopUserPreview(current));
                  setCompanyScope("Consolidado");
                }}
              >
                {page}
              </Shell>
              {showNew && can(currentUser, "operations:edit") && (
                <NewOperationModal
                  defaultDestination={companyScope}
                  operations={operations}
                  debtors={debtors}
                  onClose={() => setShowNew(false)}
                  onCreate={createOperation}
                />
              )}
              {confirmReset && (
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

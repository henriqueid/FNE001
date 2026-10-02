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
import { useEffect, useMemo, useState } from "react";
import { clearPersistedState, loadPersistedState, saveGuidance, savePersistedState } from "./persistence";
import { buildNewOperation } from "@/src/domain/operations/create-operation";

import { repAt } from "@/src/domain/commercial/rules";
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
import { portfolioTitles } from "@/src/domain/home/metrics";
import { mergeParties, type Party, partyToCedent, seedParties } from "@/src/domain/registry/parties";
import { saveParty as savePartyRecord } from "@/src/domain/registry/party-save";
import { buildRegistry, effectiveCedents, repurchaseEvents } from "@/src/domain/registry/registry";
import { seedPortfolio, syncPortfolio } from "@/src/domain/portfolio/model";
import PortfolioModule from "@/src/features/portfolio/portfolio-module";
import RegistryModule from "@/src/features/registry/registry-module";
import { ModuleRoadmap } from "@/src/features/shell/module-roadmap";
import { Shell } from "@/src/features/shell/shell";
import { type AppView, ShellContext } from "@/src/features/shell/shell-context";
import { RegistryContext, type RegistryValue } from "./registry-context";
import { EligibilityPolicyProvider } from "./eligibility-policy-context";
import { seedEligibilityPolicies } from "@/src/domain/eligibility/policy-library";
import SettingsModule from "@/src/features/settings/settings-module";

const COMPANY_SCOPE_KEY = "strato-company-scope";

export default function StratoApp() {
  const [operations, setOperations] = useState(initialOperations);
  const [debtors, setDebtors] = useState(initialDebtors);
  const [selected, setSelected] = useState<Operation | null>(null);
  const [showNew, setShowNew] = useState(false);
  const [companyScope, setCompanyScope] = useState("Consolidado");
  const [storageReady, setStorageReady] = useState(false);
  const [showGuidance, setShowGuidance] = useState(true);
  const [confirmReset, setConfirmReset] = useState(false);
  const [view, setView] = useState<AppView>("home");
  const navigate = (target: AppView) => {
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
    if (stored.guidance !== undefined) setShowGuidance(stored.guidance);
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
      savePersistedState({ operations, debtors, finance, commercial, parties: savedParties, portfolio, policies });
  }, [operations, debtors, finance, commercial, savedParties, portfolio, policies, storageReady]);

  useEffect(() => {
    if (storageReady) saveGuidance(showGuidance);
  }, [showGuidance, storageReady]);

  useEffect(() => {
    if (!storageReady) return;
    try {
      window.localStorage.setItem(COMPANY_SCOPE_KEY, companyScope);
    } catch {
      /* ignora armazenamento indisponível */
    }
  }, [companyScope, storageReady]);

  function updateOperation(updated: Operation) {
    setOperations(current => current.map(operation => (operation.id === updated.id ? updated : operation)));
    setSelected(updated);
  }

  function registerDebtor(debtor: Debtor) {
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
    setSelected(null);
  }
  function createOperation(input: NewOperationInput) {
    const next = buildNewOperation(input, operations, commercial, new Date().toISOString().slice(0, 10));
    setOperations([next, ...operations]);
    setShowNew(false);
    setSelected(next);
  }
  const activeCount = operations.filter(
    operation => operation.status !== "Cancelada" && operation.status !== "Liberada ao financeiro",
  ).length;
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
  const today = new Date().toISOString().slice(0, 10);
  const parties = useMemo(
    () =>
      mergeParties(savedParties, {
        cedents: registryCedents,
        debtors,
        reps: commercial.reps,
        repOfCedent: document => repAt(commercial, document, new Date().toISOString().slice(0, 10)),
      }),
    [savedParties, registryCedents, debtors, commercial],
  );
  const registryValue = useMemo<RegistryValue>(
    () => ({
      commercial: commercialLive,
      cedents: registryCedents,
      records: buildRegistry(commercialLive, registryCedents),
      repOf: (document: string, date?: string) => {
        const id = repAt(commercialLive, document, date ?? new Date().toISOString().slice(0, 10));
        return commercialLive.reps.find(rep => rep.id === id);
      },
      parties,
      saveParty: party => {
        const result = savePartyRecord({
          party,
          saved: savedParties,
          all: parties,
          debtors,
          commercial,
          today,
          by: "Henrique",
        });
        if (!result.ok) return { error: result.error };
        setSavedParties(result.saved);
        setDebtors(result.debtors);
        setCommercial(result.commercial);
        return { message: result.message };
      },
      onCommercial: next => {
        const { carteiraEvents: _drop, ...rest } = next;
        void _drop;
        setCommercial(rest as CommercialState);
      },
    }),
    [commercialLive, registryCedents, parties, savedParties, debtors, commercial, today],
  );
  const shellContext = {
    operations,
    navigate,
    openOperation: (operation: Operation) => setSelected(operation),
    newOperation: () => setShowNew(true),
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
        debtors={debtors}
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
        operations={operations}
        carteira={carteiraFlows}
        companyScope={companyScope}
        onCompanyScopeChange={setCompanyScope}
        onOpenOperation={setSelected}
      />
    );
  else if (view === "commercial")
    page = (
      <CommercialModule
        state={registryValue.commercial}
        onState={registryValue.onCommercial}
        operations={operations}
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
        operations={operations}
        debtors={debtors}
        financials={homeFinancials}
        finance={finance}
        carteira={carteiraFlows}
        onGoFinance={() => navigate("finance")}
        companyScope={companyScope}
        onCompanyScopeChange={setCompanyScope}
        onOpen={setSelected}
        onGoOperations={() => navigate("operations")}
        onNew={() => setShowNew(true)}
      />
    );
  else if (view === "registry")
    page = (
      <RegistryModule debtors={debtors} operations={operations} onOpenOperation={setSelected} onNavigate={navigate} />
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
  else if (view === "settings" || view === "policies")
    page = (
      <SettingsModule
        policies={policies}
        onPolicies={setPolicies}
        showGuidance={showGuidance}
        onGuidance={setShowGuidance}
      />
    );
  else if (view in roadmapViews) page = <ModuleRoadmap view={view as keyof typeof roadmapViews} />;
  else
    page = (
      <OperationsList
        operations={operations}
        companyScope={companyScope}
        onCompanyScopeChange={setCompanyScope}
        onOpen={setSelected}
        onNew={() => setShowNew(true)}
        onReset={resetDemo}
      />
    );
  return (
    <EligibilityPolicyProvider value={policies.policies}>
      <RegistryContext.Provider value={registryValue}>
        <ShellContext.Provider value={shellContext}>
          <Shell
            active={activeSection}
            operationCount={activeCount}
            companyScope={selected?.vehicle ?? companyScope}
            onCompanyScopeChange={scope => {
              setCompanyScope(scope);
              if (selected) setSelected(null);
            }}
            onOpenSettings={openSettings}
            onNavigate={navigate}
          >
            {page}
          </Shell>
          {showNew && (
            <NewOperationModal
              defaultDestination={companyScope}
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
      </RegistryContext.Provider>
    </EligibilityPolicyProvider>
  );
}

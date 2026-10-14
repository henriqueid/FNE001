"use client";

import { useCompanyDestinations, useCompanyDirectory } from "@/src/app/company-context";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { type EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import PoliciesModule from "@/src/features/policies/policies-module";
import { useEffect, useState } from "react";
import { type IntegrationState, updateIntegrationMode } from "@/src/domain/integrations/model";
import {
  operationalDefaultsSnapshot,
  type OperationalDefaultsState,
  type OperationalParameterChangeRequest,
} from "@/src/domain/registry/operational-profile";
import { OperationalParametersEditor } from "@/src/features/registry/operational-parameters-editor";
import { type HomePeriod } from "@/src/domain/home/settings";
import { type AccessState } from "@/src/domain/access/model";
import { UsersAccessPanel } from "./users-access-panel";
import { aiStatusLabel, effectiveAIStatus, type IntelligenceState } from "@/src/domain/intelligence/model";
import { OutboxHealthPanel } from "./outbox-health-panel";
import { AIConfigurationPanel } from "./ai-configuration-panel";
import {
  decideOperationalParameters,
  loadOperationalParameters,
  proposeOperationalParameters,
} from "@/src/app/operational-parameters-client";
import {
  emptyCompanyDestination,
  validateCompanyDestination,
  type CompanyDestinationDraft,
} from "@/src/domain/company/destination";
import { formatDocument } from "@/src/domain/registry/parties";
import { LocalizedNumberInput } from "@/src/ui/localized-number-input";

const goalPeriods: Array<{ id: HomePeriod; label: string }> = [
  { id: "dia", label: "Dia" },
  { id: "semana", label: "Semana" },
  { id: "mes", label: "Mês" },
];

type SettingsSection =
  "overview" | "access" | "operational" | "policies" | "companies" | "integrations" | "intelligence" | "interface";

type SettingsItem = {
  id: SettingsSection;
  label: string;
  description: string;
  marker: string;
};

const menuGroups: Array<{ label: string; items: SettingsItem[] }> = [
  {
    label: "INÍCIO",
    items: [{ id: "overview", label: "Visão geral", description: "Status e atalhos", marker: "01" }],
  },
  {
    label: "ESTRUTURA",
    items: [
      { id: "access", label: "Usuários e acesso", description: "Perfis, carteiras e permissões", marker: "02" },
      { id: "companies", label: "Empresas e veículos", description: "Ambiente multiempresa", marker: "03" },
    ],
  },
  {
    label: "RISCO E OPERAÇÕES",
    items: [
      {
        id: "operational",
        label: "Padrões operacionais",
        description: "Taxas, tarifas, limites e lastro",
        marker: "04",
      },
      { id: "policies", label: "Políticas e motor", description: "Regras, alçadas e vigências", marker: "05" },
    ],
  },
  {
    label: "CONEXÕES",
    items: [
      { id: "integrations", label: "Integrações", description: "Fontes de dados externas", marker: "06" },
      { id: "intelligence", label: "Inteligência e IA", description: "Licença, estado e orçamento", marker: "07" },
    ],
  },
  {
    label: "PREFERÊNCIAS",
    items: [{ id: "interface", label: "Interface", description: "Orientação e visualização", marker: "08" }],
  },
];

const shortcuts: Array<{
  section: Exclude<SettingsSection, "overview">;
  eyebrow: string;
  title: string;
  description: string;
  action: string;
}> = [
  {
    section: "access",
    eyebrow: "IA-0 · FUNDAÇÃO",
    title: "Usuários e acesso",
    description: "Controle perfis, departamentos, carteiras, empresas e permissões efetivas.",
    action: "Gerenciar acessos",
  },
  {
    section: "operational",
    eyebrow: "OPERAÇÕES",
    title: "Padrões operacionais",
    description: "Defina o que todo cliente novo herda em taxas, tarifas, lastro e concentração.",
    action: "Configurar padrões",
  },
  {
    section: "policies",
    eyebrow: "RISCO E OPERAÇÕES",
    title: "Políticas e motor",
    description: "Crie políticas, defina regras, vigências e alçadas por empresa.",
    action: "Configurar políticas",
  },
  {
    section: "companies",
    eyebrow: "ESTRUTURA",
    title: "Empresas e veículos",
    description: "Cadastre e gerencie os escopos que participam do ambiente multiempresa.",
    action: "Gerenciar empresas",
  },
  {
    section: "integrations",
    eyebrow: "CONEXÕES",
    title: "Integrações",
    description: "Acompanhe as fontes externas necessárias para ampliar as análises.",
    action: "Ver integrações",
  },
  {
    section: "intelligence",
    eyebrow: "GOVERNANÇA",
    title: "Inteligência e IA",
    description: "Controle a disponibilidade da IA sem afetar o motor financeiro determinístico.",
    action: "Configurar inteligência",
  },
  {
    section: "interface",
    eyebrow: "PREFERÊNCIAS",
    title: "Interface",
    description: "Escolha o nível de orientação apresentado aos usuários.",
    action: "Ajustar interface",
  },
];

export default function SettingsModule({
  policies,
  onPolicies,
  showGuidance,
  onGuidance,
  showJourney,
  onJourney,
  integrations,
  onIntegrations,
  operationalDefaults,
  onOperationalDefaults,
  access,
  onAccess,
  intelligence,
  onIntelligence,
  policyApprovalActor,
  demoMode = false,
}: {
  policies: EligibilityPolicyState;
  onPolicies: (state: EligibilityPolicyState) => void;
  showGuidance: boolean;
  onGuidance: (value: boolean) => void;
  showJourney: boolean;
  onJourney: (value: boolean) => void;
  integrations: IntegrationState;
  onIntegrations: (state: IntegrationState) => void;
  operationalDefaults: OperationalDefaultsState;
  onOperationalDefaults: (state: OperationalDefaultsState) => void;
  access: AccessState;
  onAccess: (state: AccessState) => void;
  intelligence: IntelligenceState;
  onIntelligence: (state: IntelligenceState) => void;
  policyApprovalActor: { id: string; name: string };
  demoMode?: boolean;
}) {
  const destinations = useCompanyDestinations();
  const companyDirectory = useCompanyDirectory();
  const [section, setSection] = useState<SettingsSection>("overview");
  const activePolicies = policies.policies.filter(policy => policy.status === "ATIVA").length;
  const executableRules = masterRuleCatalog.filter(
    rule => rule.readiness !== "REQUER_DADO" && rule.readiness !== "REQUER_INTEGRACAO",
  ).length;
  const currentSection = menuGroups.flatMap(group => group.items).find(item => item.id === section);
  const activeIntegrations = integrations.providers.filter(provider => provider.mode === "ATIVA").length;
  const demoIntegrations = integrations.providers.filter(provider => provider.mode === "DEMONSTRACAO").length;
  const [operationalDraft, setOperationalDraft] = useState(operationalDefaults);
  const [operationalRequests, setOperationalRequests] = useState<OperationalParameterChangeRequest[]>([]);
  const [operationalReason, setOperationalReason] = useState("");
  const [operationalDecisionReason, setOperationalDecisionReason] = useState("");
  const [operationalSubmitting, setOperationalSubmitting] = useState(false);
  const [operationalFeedback, setOperationalFeedback] = useState<{ tone: "success" | "error"; message: string }>();
  const [showCompanyCreate, setShowCompanyCreate] = useState(false);
  const [companyDraft, setCompanyDraft] = useState<CompanyDestinationDraft>(emptyCompanyDestination);
  const [companySaving, setCompanySaving] = useState(false);
  const [companyFeedback, setCompanyFeedback] = useState("");
  const pendingOperationalRequest = operationalRequests.find(request => request.status === "PENDING");
  const operationalHistory = operationalRequests.filter(request => request.status !== "PENDING").slice(0, 5);
  const editableOperationalDefaults = demoMode ? operationalDefaults : operationalDraft;
  const operationalChanged =
    JSON.stringify(operationalDefaultsSnapshot(operationalDraft)) !==
    JSON.stringify(operationalDefaultsSnapshot(operationalDefaults));

  useEffect(() => {
    if (demoMode) return;
    let cancelled = false;
    loadOperationalParameters()
      .then(result => {
        if (cancelled) return;
        setOperationalRequests(result.requests);
        setOperationalDraft(result.state);
      })
      .catch(error => {
        if (!cancelled)
          setOperationalFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Não foi possível carregar as aprovações.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode]);

  const editOperationalDefaults = (candidate: OperationalDefaultsState) => {
    if (demoMode) onOperationalDefaults(candidate);
    else setOperationalDraft(candidate);
  };

  const submitCompanyDestination = async () => {
    if (!companyDirectory) return;
    const validationError = validateCompanyDestination(companyDraft);
    if (validationError) {
      setCompanyFeedback(validationError);
      return;
    }
    setCompanySaving(true);
    setCompanyFeedback("");
    try {
      const created = await companyDirectory.create(companyDraft);
      setCompanyDraft(emptyCompanyDestination());
      setShowCompanyCreate(false);
      setCompanyFeedback(`${created.name} foi cadastrado e já pode ser usado em políticas e operações.`);
    } catch (error) {
      setCompanyFeedback(error instanceof Error ? error.message : "Não foi possível concluir o cadastro.");
    } finally {
      setCompanySaving(false);
    }
  };

  const submitOperationalProposal = async () => {
    setOperationalSubmitting(true);
    setOperationalFeedback(undefined);
    try {
      const requests = await proposeOperationalParameters(
        operationalDraft,
        operationalDefaults.persistenceVersion ?? 0,
        operationalReason,
      );
      setOperationalRequests(requests);
      setOperationalReason("");
      setOperationalFeedback({
        tone: "success",
        message: "Proposta enviada. Os valores efetivos permanecem inalterados até outra pessoa aprovar.",
      });
    } catch (error) {
      setOperationalFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar a proposta.",
      });
    } finally {
      setOperationalSubmitting(false);
    }
  };

  const decideOperationalProposal = async (decision: "APPROVED" | "REJECTED") => {
    if (!pendingOperationalRequest) return;
    setOperationalSubmitting(true);
    setOperationalFeedback(undefined);
    try {
      const result = await decideOperationalParameters(
        pendingOperationalRequest.id,
        decision,
        operationalDecisionReason,
      );
      setOperationalRequests(result.requests);
      onOperationalDefaults(result.state);
      setOperationalDraft(result.state);
      setOperationalDecisionReason("");
      setOperationalFeedback({
        tone: "success",
        message:
          decision === "APPROVED"
            ? "Nova versão aprovada e aplicada."
            : "Proposta rejeitada sem alterar a versão efetiva.",
      });
    } catch (error) {
      setOperationalFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível registrar a decisão.",
      });
    } finally {
      setOperationalSubmitting(false);
    }
  };

  return (
    <main className="settings-page">
      <header className="settings-page-head">
        <span>ADMINISTRAÇÃO DA PLATAFORMA</span>
        <h1>Configurações</h1>
        <p>Organize empresas, políticas, integrações e preferências em um único lugar.</p>
      </header>

      <div className="settings-layout">
        <aside className="settings-nav" aria-label="Menu de configurações">
          <div className="settings-nav-intro">
            <strong>Central de configurações</strong>
            <small>Selecione um assunto para começar.</small>
          </div>
          {menuGroups.map(group => (
            <div className="settings-nav-group" key={group.label}>
              <span>{group.label}</span>
              {group.items.map(item => (
                <button
                  type="button"
                  key={item.id}
                  className={section === item.id ? "active" : ""}
                  onClick={() => setSection(item.id)}
                >
                  <b>{item.marker}</b>
                  <span>
                    <strong>{item.label}</strong>
                    <small>{item.description}</small>
                  </span>
                </button>
              ))}
            </div>
          ))}
        </aside>

        <section className="settings-content">
          {section !== "overview" && currentSection && (
            <div className="settings-context-bar">
              <button type="button" onClick={() => setSection("overview")}>
                Configurações
              </button>
              <span>/</span>
              <strong>{currentSection.label}</strong>
            </div>
          )}

          {section === "overview" && (
            <div className="settings-overview">
              <section className="settings-overview-hero">
                <div>
                  <span>VISÃO GERAL</span>
                  <h2>O que você deseja configurar?</h2>
                  <p>Use os atalhos abaixo ou navegue pelos assuntos no menu lateral.</p>
                </div>
                <div className="settings-readiness">
                  <b>
                    {destinations.length > 0 && activePolicies === destinations.length
                      ? "Ambiente organizado"
                      : "Requer atenção"}
                  </b>
                  <small>
                    {activePolicies} de {destinations.length} empresas com política ativa
                  </small>
                </div>
              </section>

              <section className="settings-status-grid" aria-label="Resumo das configurações">
                <article>
                  <strong>{destinations.length}</strong>
                  <span>Empresas e veículos</span>
                  <small>Escopos disponíveis</small>
                </article>
                <article>
                  <strong>{activePolicies}</strong>
                  <span>Políticas ativas</span>
                  <small>Uma por empresa</small>
                </article>
                <article>
                  <strong>{executableRules}</strong>
                  <span>Regras executáveis</span>
                  <small>Com os dados atuais</small>
                </article>
                <article>
                  <strong>{activeIntegrations}</strong>
                  <span>Integrações ativas</span>
                  <small>{demoIntegrations} fonte(s) em demonstração</small>
                </article>
              </section>

              <section className="settings-shortcuts">
                {shortcuts.map(shortcut => (
                  <article key={shortcut.section}>
                    <span>{shortcut.eyebrow}</span>
                    <h3>{shortcut.title}</h3>
                    <p>{shortcut.description}</p>
                    <button type="button" onClick={() => setSection(shortcut.section)}>
                      {shortcut.action} <b aria-hidden="true">→</b>
                    </button>
                  </article>
                ))}
              </section>

              <section className="settings-next-steps">
                <header>
                  <span>CONFIGURAÇÃO ASSISTIDA</span>
                  <h3>Ordem recomendada</h3>
                </header>
                <ol>
                  <li className="done">
                    <b>1</b>
                    <span>
                      <strong>Confirme as empresas</strong>
                      <small>{destinations.length} escopo(s) empresarial(is) cadastrado(s).</small>
                    </span>
                  </li>
                  <li className={activePolicies === destinations.length && destinations.length > 0 ? "done" : ""}>
                    <b>2</b>
                    <span>
                      <strong>Revise as políticas</strong>
                      <small>
                        {activePolicies} de {destinations.length} empresa(s) com política ativa.
                      </small>
                    </span>
                  </li>
                  <li>
                    <b>3</b>
                    <span>
                      <strong>Conecte as fontes externas</strong>
                      <small>Amplie a cobertura das regras que exigem dados de terceiros.</small>
                    </span>
                  </li>
                  <li>
                    <b>4</b>
                    <span>
                      <strong>Ajuste a experiência</strong>
                      <small>Defina quanto contexto será mostrado aos operadores.</small>
                    </span>
                  </li>
                </ol>
              </section>
            </div>
          )}

          {section === "policies" && (
            <PoliciesModule
              state={policies}
              onState={onPolicies}
              approvalActor={policyApprovalActor}
              demoMode={demoMode}
              embedded
            />
          )}

          {section === "access" && <UsersAccessPanel state={access} onState={onAccess} demoMode={demoMode} />}

          {section === "intelligence" && (
            <div className="settings-section-card">
              <header>
                <span>IA OPCIONAL POR ORGANIZAÇÃO</span>
                <h2>Inteligência e IA</h2>
                <p>
                  O motor de políticas, os cálculos, as filas e as aprovações continuam funcionando mesmo quando a IA
                  estiver desativada ou indisponível.
                </p>
              </header>
              <div className="settings-integration-legend" role="status">
                <span>
                  <b>{effectiveAIStatus(intelligence).replace("AI_", "")}</b> estado efetivo
                </span>
                <span>
                  <b>{intelligence.usedTokens.toLocaleString("pt-BR")}</b> tokens utilizados
                </span>
                <span>
                  <b>{intelligence.monthlyTokenBudget.toLocaleString("pt-BR")}</b> orçamento mensal
                </span>
              </div>
              <AIConfigurationPanel
                active={intelligence.contracted && intelligence.enabled}
                onAvailabilityChange={available =>
                  onIntelligence({
                    ...intelligence,
                    status: available ? "AI_AVAILABLE" : "AI_UNAVAILABLE",
                    monthlyTokenBudget:
                      intelligence.monthlyTokenBudget > 0 ? intelligence.monthlyTokenBudget : 1_000_000,
                    updatedAt: new Date().toISOString(),
                  })
                }
              />
              <div className="settings-interface-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={intelligence.contracted}
                    onChange={event => {
                      const contracted = event.target.checked;
                      onIntelligence({
                        ...intelligence,
                        contracted,
                        enabled: contracted ? intelligence.enabled : false,
                        status: contracted ? intelligence.status : "AI_DISABLED",
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  />
                  <span>
                    <strong>IA contratada</strong>
                    <small>Habilita o recurso para esta organização.</small>
                  </span>
                  <b>{intelligence.contracted ? "Contratada" : "Não contratada"}</b>
                </label>
                <label>
                  <input
                    type="checkbox"
                    checked={intelligence.enabled}
                    disabled={!intelligence.contracted}
                    onChange={event => {
                      const enabled = event.target.checked;
                      onIntelligence({
                        ...intelligence,
                        enabled,
                        status: enabled ? "AI_PROCESSING" : "AI_DISABLED",
                        monthlyTokenBudget:
                          enabled && intelligence.monthlyTokenBudget <= 0 ? 1_000_000 : intelligence.monthlyTokenBudget,
                        updatedAt: new Date().toISOString(),
                      });
                    }}
                  />
                  <span>
                    <strong>Copiloto habilitado</strong>
                    <small>Controla conversa e sínteses; não controla o motor financeiro.</small>
                  </span>
                  <b>{intelligence.enabled && intelligence.contracted ? "Ativo" : "Inativo"}</b>
                </label>
              </div>
              <div className="settings-goal-row">
                <span>
                  <strong>Orçamento mensal de tokens</strong>
                  <small>{aiStatusLabel(intelligence)}</small>
                </span>
                <label>
                  <input
                    type="number"
                    min="0"
                    step="10000"
                    aria-label="Orçamento mensal de tokens da IA"
                    value={intelligence.monthlyTokenBudget}
                    onChange={event =>
                      onIntelligence({
                        ...intelligence,
                        monthlyTokenBudget: Math.max(0, Number(event.target.value)),
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  />
                </label>
              </div>
              <p className="settings-integration-requirements">
                <b>Regra de segurança:</b> nenhuma decisão, cálculo, desbloqueio de alçada ou movimentação financeira
                depende da IA. Em falha, o STRATO mantém o resultado determinístico e informa a indisponibilidade.
              </p>
              <OutboxHealthPanel tenantId={intelligence.tenantId} />
            </div>
          )}

          {section === "operational" && (
            <div className="settings-section-card settings-operational-defaults">
              <header>
                <span>HERANÇA DE PARÂMETROS</span>
                <h2>Padrões operacionais gerais</h2>
                <p>
                  Todo cliente novo nasce com estes valores. No cadastro, somente os campos personalizados substituem o
                  padrão; zero continua sendo um valor válido.
                </p>
              </header>
              {!demoMode && (
                <section className="settings-operational-governance" aria-label="Governança dos parâmetros">
                  <div>
                    <strong>Versão efetiva {operationalDefaults.persistenceVersion ?? 0}</strong>
                    <span>
                      {pendingOperationalRequest
                        ? `Proposta de ${pendingOperationalRequest.requestedBy} aguardando outra pessoa.`
                        : operationalChanged
                          ? "Alterações preparadas, ainda sem efeito operacional."
                          : "Nenhuma alteração pendente."}
                    </span>
                  </div>
                  {pendingOperationalRequest ? (
                    <div className="settings-operational-approval">
                      <p>
                        <b>Motivo da proposta:</b> {pendingOperationalRequest.reason}
                      </p>
                      <label>
                        Justificativa da decisão
                        <textarea
                          value={operationalDecisionReason}
                          onChange={event => setOperationalDecisionReason(event.target.value)}
                          placeholder="Registre a análise realizada"
                        />
                      </label>
                      <div>
                        <button
                          type="button"
                          disabled={
                            operationalSubmitting || pendingOperationalRequest.requestedById === policyApprovalActor.id
                          }
                          onClick={() => void decideOperationalProposal("REJECTED")}
                        >
                          Rejeitar
                        </button>
                        <button
                          type="button"
                          disabled={
                            operationalSubmitting || pendingOperationalRequest.requestedById === policyApprovalActor.id
                          }
                          onClick={() => void decideOperationalProposal("APPROVED")}
                        >
                          Aprovar e aplicar
                        </button>
                      </div>
                      {pendingOperationalRequest.requestedById === policyApprovalActor.id && (
                        <small>Entre com outra pessoa autorizada para decidir esta proposta.</small>
                      )}
                    </div>
                  ) : (
                    <div className="settings-operational-proposal">
                      <label>
                        Motivo da alteração
                        <textarea
                          value={operationalReason}
                          onChange={event => setOperationalReason(event.target.value)}
                          placeholder="Explique o objetivo e o impacto esperado"
                        />
                      </label>
                      <button
                        type="button"
                        disabled={!operationalChanged || operationalSubmitting}
                        onClick={() => void submitOperationalProposal()}
                      >
                        Enviar para aprovação
                      </button>
                    </div>
                  )}
                  {operationalFeedback && (
                    <p className={`settings-operational-feedback ${operationalFeedback.tone}`}>
                      {operationalFeedback.message}
                    </p>
                  )}
                  {!!operationalHistory.length && (
                    <div className="settings-operational-history">
                      <strong>Histórico recente</strong>
                      {operationalHistory.map(request => (
                        <article key={request.id}>
                          <span>
                            {request.status === "APPROVED" ? "Aprovada" : "Rejeitada"} · versão de origem{" "}
                            {request.expectedVersion}
                            {request.appliedVersion ? ` → ${request.appliedVersion}` : ""}
                          </span>
                          <small>
                            {request.requestedBy} solicitou · {request.decidedBy} decidiu
                          </small>
                          <small>{request.decisionReason}</small>
                        </article>
                      ))}
                    </div>
                  )}
                </section>
              )}
              <fieldset className="settings-operational-fields" disabled={!demoMode && !!pendingOperationalRequest}>
                <OperationalParametersEditor
                  defaults={editableOperationalDefaults}
                  overrides={editableOperationalDefaults.general}
                  allowInheritance={false}
                  onChange={general =>
                    editOperationalDefaults({
                      ...editableOperationalDefaults,
                      general: { ...editableOperationalDefaults.general, ...general },
                    })
                  }
                />
                <section className="settings-revenue-goals">
                  <header>
                    <span>META DE ORIGINAÇÃO</span>
                    <h3>Volume por período e veículo</h3>
                    <p>Começa zerado no ambiente real e só passa a orientar os painéis depois de configurado.</p>
                  </header>
                  <div className="settings-goal-row heading">
                    <b>Escopo</b>
                    {goalPeriods.map(period => (
                      <b key={period.id}>{period.label}</b>
                    ))}
                  </div>
                  <div className="settings-goal-row">
                    <span>
                      <strong>Consolidado</strong>
                      <small>Meta geral de volume</small>
                    </span>
                    {goalPeriods.map(period => (
                      <div className="settings-goal-input" key={period.id}>
                        <small>R$</small>
                        <LocalizedNumberInput
                          min={0}
                          decimals={2}
                          aria-label={`Meta consolidada de originação por ${period.label.toLowerCase()}`}
                          value={editableOperationalDefaults.originationGoals.consolidated[period.id]}
                          onValueChange={value =>
                            editOperationalDefaults({
                              ...editableOperationalDefaults,
                              originationGoals: {
                                ...editableOperationalDefaults.originationGoals,
                                consolidated: {
                                  ...editableOperationalDefaults.originationGoals.consolidated,
                                  [period.id]: value,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {destinations.map(destination => (
                    <div className="settings-goal-row" key={destination.name}>
                      <span>
                        <strong>{destination.name}</strong>
                        <small>{destination.institution}</small>
                      </span>
                      {goalPeriods.map(period => (
                        <div className="settings-goal-input" key={period.id}>
                          <small>R$</small>
                          <LocalizedNumberInput
                            min={0}
                            decimals={2}
                            aria-label={`Meta de originação de ${destination.name} por ${period.label.toLowerCase()}`}
                            value={
                              editableOperationalDefaults.originationGoals.byVehicle[destination.name]?.[period.id] ?? 0
                            }
                            onValueChange={value =>
                              editOperationalDefaults({
                                ...editableOperationalDefaults,
                                originationGoals: {
                                  ...editableOperationalDefaults.originationGoals,
                                  byVehicle: {
                                    ...editableOperationalDefaults.originationGoals.byVehicle,
                                    [destination.name]: {
                                      ...editableOperationalDefaults.originationGoals.byVehicle[destination.name],
                                      [period.id]: value,
                                    },
                                  },
                                },
                              })
                            }
                          />
                        </div>
                      ))}
                    </div>
                  ))}
                </section>
                <section className="settings-revenue-goals">
                  <header>
                    <span>META DE RECEITA</span>
                    <h3>Metas por período e veículo</h3>
                    <p>
                      A meta consolidada é distribuída pelos dias úteis. Valores específicos por veículo têm prioridade.
                    </p>
                  </header>
                  <div className="settings-goal-row heading">
                    <b>Escopo</b>
                    {goalPeriods.map(period => (
                      <b key={period.id}>{period.label}</b>
                    ))}
                  </div>
                  <div className="settings-goal-row">
                    <span>
                      <strong>Consolidado</strong>
                      <small>Meta geral do grupo</small>
                    </span>
                    {goalPeriods.map(period => (
                      <div className="settings-goal-input" key={period.id}>
                        <small>R$</small>
                        <LocalizedNumberInput
                          min={0}
                          decimals={2}
                          aria-label={`Meta consolidada de receita por ${period.label.toLowerCase()}`}
                          value={editableOperationalDefaults.revenueGoals.consolidated[period.id]}
                          onValueChange={value =>
                            editOperationalDefaults({
                              ...editableOperationalDefaults,
                              revenueGoals: {
                                ...editableOperationalDefaults.revenueGoals,
                                consolidated: {
                                  ...editableOperationalDefaults.revenueGoals.consolidated,
                                  [period.id]: value,
                                },
                              },
                            })
                          }
                        />
                      </div>
                    ))}
                  </div>
                  {destinations.map(destination => (
                    <div className="settings-goal-row" key={destination.name}>
                      <span>
                        <strong>{destination.name}</strong>
                        <small>{destination.institution}</small>
                      </span>
                      {goalPeriods.map(period => {
                        return (
                          <div className="settings-goal-input" key={period.id}>
                            <small>R$</small>
                            <LocalizedNumberInput
                              min={0}
                              decimals={2}
                              aria-label={`Meta de ${destination.name} por ${period.label.toLowerCase()}`}
                              value={
                                editableOperationalDefaults.revenueGoals.byVehicle[destination.name]?.[period.id] ?? 0
                              }
                              onValueChange={value =>
                                editOperationalDefaults({
                                  ...editableOperationalDefaults,
                                  revenueGoals: {
                                    ...editableOperationalDefaults.revenueGoals,
                                    byVehicle: {
                                      ...editableOperationalDefaults.revenueGoals.byVehicle,
                                      [destination.name]: {
                                        ...editableOperationalDefaults.revenueGoals.byVehicle[destination.name],
                                        [period.id]: value,
                                      },
                                    },
                                  },
                                })
                              }
                            />
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </section>
              </fieldset>
            </div>
          )}

          {section === "companies" && (
            <div className="settings-section-card settings-companies-card">
              <header>
                <div>
                  <span>MULTIEMPRESA</span>
                  <h2>Empresas e veículos</h2>
                  <p>Cadastre as pessoas jurídicas e os veículos usados como escopo de operações e políticas.</p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setCompanyFeedback("");
                    setShowCompanyCreate(true);
                  }}
                >
                  Nova empresa ou veículo
                </button>
              </header>
              {companyFeedback && (
                <p className="settings-company-feedback" role="status">
                  {companyFeedback}
                </p>
              )}
              {companyDirectory?.error && <p className="settings-company-feedback error">{companyDirectory.error}</p>}
              <div className="settings-company-list">
                {companyDirectory?.loading && <p className="settings-company-empty">Carregando cadastros…</p>}
                {!companyDirectory?.loading && !destinations.length && (
                  <div className="settings-company-empty">
                    <strong>Nenhuma empresa cadastrada</strong>
                    <span>Cadastre a primeira empresa ou veículo para criar políticas e operações.</span>
                  </div>
                )}
                {destinations.map(destination => {
                  const entry = companyDirectory?.entries.find(item => item.name === destination.name);
                  return (
                    <article key={destination.name}>
                      <div className="settings-company-identity">
                        <span className="settings-company-monogram">
                          {destination.name.slice(0, 2).toLocaleUpperCase()}
                        </span>
                        <div>
                          <strong>{destination.name}</strong>
                          {entry?.legalName && entry.legalName !== destination.name && <small>{entry.legalName}</small>}
                          {entry?.document && <small>{formatDocument(entry.document)}</small>}
                        </div>
                      </div>
                      <div className="settings-company-scope">
                        <span>{destination.institution}</span>
                        <small>{destination.detail}</small>
                      </div>
                      <div className="settings-company-policy-count">
                        <b>
                          {
                            policies.policies.filter(
                              policy => policy.company === destination.name && policy.status === "ATIVA",
                            ).length
                          }
                        </b>
                        <small>política(s) ativa(s)</small>
                      </div>
                    </article>
                  );
                })}
              </div>
            </div>
          )}

          {showCompanyCreate && (
            <div className="modal-backdrop" role="presentation">
              <section
                className="settings-modal settings-company-modal"
                role="dialog"
                aria-modal="true"
                aria-labelledby="company-create-title"
              >
                <div className="modal-head">
                  <div>
                    <span>NOVO ESCOPO</span>
                    <h2 id="company-create-title">Cadastrar empresa ou veículo</h2>
                    <p>
                      O nome fantasia identifica o escopo nas operações. A razão social e o CNPJ preservam o cadastro
                      jurídico.
                    </p>
                  </div>
                </div>
                <div className="settings-company-form">
                  <label className="wide">
                    <span>Razão social *</span>
                    <input
                      value={companyDraft.legalName}
                      onChange={event => setCompanyDraft(current => ({ ...current, legalName: event.target.value }))}
                      placeholder="Ex.: Fundo Alpha de Investimento em Direitos Creditórios"
                    />
                  </label>
                  <label>
                    <span>Nome do veículo / fantasia *</span>
                    <input
                      value={companyDraft.tradeName}
                      onChange={event => setCompanyDraft(current => ({ ...current, tradeName: event.target.value }))}
                      placeholder="Ex.: FIDC Alpha · Classe Sênior"
                    />
                  </label>
                  <label>
                    <span>CNPJ *</span>
                    <input
                      inputMode="numeric"
                      value={companyDraft.document}
                      onChange={event =>
                        setCompanyDraft(current => ({ ...current, document: formatDocument(event.target.value) }))
                      }
                      placeholder="00.000.000/0000-00"
                    />
                  </label>
                  <label>
                    <span>Tipo de instituição *</span>
                    <select
                      value={companyDraft.institution}
                      onChange={event =>
                        setCompanyDraft(current => ({
                          ...current,
                          institution: event.target.value as CompanyDestinationDraft["institution"],
                        }))
                      }
                    >
                      <option>Factoring</option>
                      <option>Securitizadora</option>
                      <option>FIDC</option>
                    </select>
                  </label>
                  <label className="wide">
                    <span>Classe, produto ou finalidade *</span>
                    <input
                      value={companyDraft.detail}
                      onChange={event => setCompanyDraft(current => ({ ...current, detail: event.target.value }))}
                      placeholder="Ex.: Classe Sênior · Antecipação mercantil"
                    />
                    <small>Este texto aparece abaixo do nome ao escolher o veículo.</small>
                  </label>
                </div>
                {companyFeedback && <p className="settings-company-feedback error">{companyFeedback}</p>}
                <footer>
                  <button
                    type="button"
                    className="secondary-action"
                    onClick={() => {
                      setShowCompanyCreate(false);
                      setCompanyFeedback("");
                    }}
                    disabled={companySaving}
                  >
                    Cancelar
                  </button>
                  <button type="button" onClick={() => void submitCompanyDestination()} disabled={companySaving}>
                    {companySaving ? "Salvando…" : "Cadastrar e disponibilizar"}
                  </button>
                </footer>
              </section>
            </div>
          )}

          {section === "integrations" && (
            <div className="settings-section-card">
              <header>
                <span>FONTES EXTERNAS</span>
                <h2>Integrações do motor</h2>
                <p>
                  Controle quais fontes alimentam o enriquecimento. Demonstração nunca é apresentada como consulta
                  oficial.
                </p>
              </header>
              <div className="settings-integration-legend">
                <span>
                  <b>{activeIntegrations}</b> fontes ativas
                </span>
                <span>
                  <b>{demoIntegrations}</b> em demonstração
                </span>
                <span>
                  <b>{integrations.providers.filter(provider => provider.mode === "NAO_CONFIGURADA").length}</b> não
                  configuradas
                </span>
              </div>
              <div className="settings-integration-grid">
                {integrations.providers.map(provider => (
                  <article key={provider.id} className={`integration-${provider.mode.toLowerCase()}`}>
                    <div>
                      <small>{provider.capability}</small>
                      <strong>{provider.name}</strong>
                      <p>{provider.description}</p>
                    </div>
                    <span>
                      {provider.mode === "ATIVA"
                        ? provider.connection?.sourceType === "PUBLIC"
                          ? "Fonte pública ativa"
                          : "Integração institucional ativa"
                        : provider.mode === "DEMONSTRACAO"
                          ? "Demonstração"
                          : provider.mode === "INDISPONIVEL"
                            ? "Indisponível"
                            : "Não configurada"}
                    </span>
                    <small>
                      {provider.mode === "DEMONSTRACAO"
                        ? "Usa dados fictícios claramente identificados."
                        : provider.mode === "ATIVA"
                          ? provider.connection?.sourceType === "PUBLIC"
                            ? `${provider.connection.label}; disponibilidade governada pelo servidor.`
                            : "Credenciais institucionais configuradas no servidor."
                          : "Credenciais e homologação necessárias."}
                    </small>
                    <small className="settings-integration-requirements">
                      <b>Para ativar:</b> {provider.requirements}
                    </small>
                    {provider.mode === "DEMONSTRACAO" ? (
                      <button
                        type="button"
                        onClick={() =>
                          onIntegrations(updateIntegrationMode(integrations, provider.id, "NAO_CONFIGURADA"))
                        }
                      >
                        Desativar demonstração
                      </button>
                    ) : demoMode &&
                      provider.mode === "NAO_CONFIGURADA" &&
                      ["CEP", "RECEITA", "SEFAZ", "BUREAU", "PEP_SANCOES"].includes(provider.id) ? (
                      <button
                        type="button"
                        onClick={() => onIntegrations(updateIntegrationMode(integrations, provider.id, "DEMONSTRACAO"))}
                      >
                        Usar dados de demonstração
                      </button>
                    ) : (
                      <em>
                        {provider.mode === "ATIVA" && provider.connection?.sourceType === "PUBLIC"
                          ? "Operação pública ativa"
                          : "Conexão institucional futura"}
                      </em>
                    )}
                  </article>
                ))}
              </div>
            </div>
          )}

          {section === "interface" && (
            <div className="settings-section-card">
              <header>
                <span>EXPERIÊNCIA</span>
                <h2>Preferências da interface</h2>
                <p>Ajuste o nível de orientação exibido nas telas operacionais.</p>
              </header>
              <section className="settings-inline-option">
                <div>
                  <strong>Explicações permanentes</strong>
                  <span>Exibe subtítulos e textos explicativos nos blocos operacionais.</span>
                  <small>Os ícones de informação continuam disponíveis quando esta opção estiver desativada.</small>
                </div>
                <label className="settings-switch">
                  <input
                    aria-label="Exibir explicações permanentes"
                    type="checkbox"
                    checked={showGuidance}
                    onChange={event => onGuidance(event.target.checked)}
                  />
                  <span />
                  <b>{showGuidance ? "Visíveis" : "Ocultas"}</b>
                </label>
              </section>
              <section className="settings-inline-option">
                <div>
                  <strong>Barra de jornada e ajuda</strong>
                  <span>
                    Mostra no topo das telas onde você está no fluxo e o botão &ldquo;Entenda esta tela&rdquo;.
                  </span>
                  <small>Fica oculta por padrão. O Copiloto continua disponível com a barra desligada.</small>
                </div>
                <label className="settings-switch">
                  <input
                    aria-label="Exibir barra de jornada e ajuda"
                    type="checkbox"
                    checked={showJourney}
                    onChange={event => onJourney(event.target.checked)}
                  />
                  <span />
                  <b>{showJourney ? "Visível" : "Oculta"}</b>
                </label>
              </section>
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

"use client";

import { useCompanyDestinations } from "@/src/app/company-context";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { type EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import PoliciesModule from "@/src/features/policies/policies-module";
import { useState } from "react";
import { type IntegrationState, updateIntegrationMode } from "@/src/domain/integrations/model";
import type { OperationalDefaultsState } from "@/src/domain/registry/operational-profile";
import { OperationalParametersEditor } from "@/src/features/registry/operational-parameters-editor";
import { type HomePeriod } from "@/src/domain/home/settings";
import { type AccessState } from "@/src/domain/access/model";
import { UsersAccessPanel } from "./users-access-panel";
import {
  aiStatusLabel,
  effectiveAIStatus,
  type AIStatus,
  type IntelligenceState,
} from "@/src/domain/intelligence/model";
import { OutboxHealthPanel } from "./outbox-health-panel";

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
    description: "Consulte os escopos que participam do ambiente multiempresa.",
    action: "Ver empresas",
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
  demoMode?: boolean;
}) {
  const destinations = useCompanyDestinations();
  const [section, setSection] = useState<SettingsSection>("overview");
  const activePolicies = policies.policies.filter(policy => policy.status === "ATIVA").length;
  const executableRules = masterRuleCatalog.filter(
    rule => rule.readiness !== "REQUER_DADO" && rule.readiness !== "REQUER_INTEGRACAO",
  ).length;
  const currentSection = menuGroups.flatMap(group => group.items).find(item => item.id === section);
  const activeIntegrations = integrations.providers.filter(provider => provider.mode === "ATIVA").length;
  const demoIntegrations = integrations.providers.filter(provider => provider.mode === "DEMONSTRACAO").length;

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

          {section === "policies" && <PoliciesModule state={policies} onState={onPolicies} embedded />}

          {section === "access" && <UsersAccessPanel state={access} onState={onAccess} />}

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
              <div className="settings-interface-grid">
                <label>
                  <input
                    type="checkbox"
                    checked={intelligence.contracted}
                    onChange={event =>
                      onIntelligence({
                        ...intelligence,
                        contracted: event.target.checked,
                        updatedAt: new Date().toISOString(),
                      })
                    }
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
                    onChange={event =>
                      onIntelligence({
                        ...intelligence,
                        enabled: event.target.checked,
                        updatedAt: new Date().toISOString(),
                      })
                    }
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
                  <strong>Estado operacional da IA</strong>
                  <small>{aiStatusLabel(intelligence)}</small>
                </span>
                <label>
                  <select
                    aria-label="Estado operacional da IA"
                    value={intelligence.status}
                    onChange={event =>
                      onIntelligence({
                        ...intelligence,
                        status: event.target.value as AIStatus,
                        updatedAt: new Date().toISOString(),
                      })
                    }
                  >
                    <option value="AI_AVAILABLE">Disponível</option>
                    <option value="AI_DEGRADED">Capacidade reduzida</option>
                    <option value="AI_UNAVAILABLE">Indisponível</option>
                    <option value="AI_PROCESSING">Processando</option>
                    <option value="AI_DISABLED">Desativada</option>
                  </select>
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
              <OperationalParametersEditor
                defaults={operationalDefaults}
                overrides={operationalDefaults.general}
                allowInheritance={false}
                onChange={general =>
                  onOperationalDefaults({
                    ...operationalDefaults,
                    general: { ...operationalDefaults.general, ...general },
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
                    <label key={period.id}>
                      <small>R$</small>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        aria-label={`Meta consolidada de originação por ${period.label.toLowerCase()}`}
                        value={operationalDefaults.originationGoals.consolidated[period.id]}
                        onChange={event =>
                          onOperationalDefaults({
                            ...operationalDefaults,
                            originationGoals: {
                              ...operationalDefaults.originationGoals,
                              consolidated: {
                                ...operationalDefaults.originationGoals.consolidated,
                                [period.id]: Number(event.target.value),
                              },
                            },
                          })
                        }
                      />
                    </label>
                  ))}
                </div>
                {destinations.map(destination => (
                  <div className="settings-goal-row" key={destination.name}>
                    <span>
                      <strong>{destination.name}</strong>
                      <small>{destination.institution}</small>
                    </span>
                    {goalPeriods.map(period => (
                      <label key={period.id}>
                        <small>R$</small>
                        <input
                          type="number"
                          min="0"
                          step="1000"
                          aria-label={`Meta de originação de ${destination.name} por ${period.label.toLowerCase()}`}
                          value={operationalDefaults.originationGoals.byVehicle[destination.name]?.[period.id] ?? 0}
                          onChange={event =>
                            onOperationalDefaults({
                              ...operationalDefaults,
                              originationGoals: {
                                ...operationalDefaults.originationGoals,
                                byVehicle: {
                                  ...operationalDefaults.originationGoals.byVehicle,
                                  [destination.name]: {
                                    ...operationalDefaults.originationGoals.byVehicle[destination.name],
                                    [period.id]: Number(event.target.value),
                                  },
                                },
                              },
                            })
                          }
                        />
                      </label>
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
                    <label key={period.id}>
                      <small>R$</small>
                      <input
                        type="number"
                        min="0"
                        step="1000"
                        aria-label={`Meta consolidada de receita por ${period.label.toLowerCase()}`}
                        value={operationalDefaults.revenueGoals.consolidated[period.id]}
                        onChange={event =>
                          onOperationalDefaults({
                            ...operationalDefaults,
                            revenueGoals: {
                              ...operationalDefaults.revenueGoals,
                              consolidated: {
                                ...operationalDefaults.revenueGoals.consolidated,
                                [period.id]: Number(event.target.value),
                              },
                            },
                          })
                        }
                      />
                    </label>
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
                        <label key={period.id}>
                          <small>R$</small>
                          <input
                            type="number"
                            min="0"
                            step="1000"
                            aria-label={`Meta de ${destination.name} por ${period.label.toLowerCase()}`}
                            value={operationalDefaults.revenueGoals.byVehicle[destination.name]?.[period.id] ?? 0}
                            onChange={event =>
                              onOperationalDefaults({
                                ...operationalDefaults,
                                revenueGoals: {
                                  ...operationalDefaults.revenueGoals,
                                  byVehicle: {
                                    ...operationalDefaults.revenueGoals.byVehicle,
                                    [destination.name]: {
                                      ...operationalDefaults.revenueGoals.byVehicle[destination.name],
                                      [period.id]: Number(event.target.value),
                                    },
                                  },
                                },
                              })
                            }
                          />
                        </label>
                      );
                    })}
                  </div>
                ))}
              </section>
            </div>
          )}

          {section === "companies" && (
            <div className="settings-section-card">
              <header>
                <span>MULTIEMPRESA</span>
                <h2>Empresas e veículos</h2>
                <p>Cada operação e política é resolvida dentro de um destes escopos.</p>
              </header>
              <div className="settings-company-list">
                {destinations.map(destination => (
                  <article key={destination.name}>
                    <div>
                      <strong>{destination.name}</strong>
                      <small>{destination.detail}</small>
                    </div>
                    <span>{destination.institution}</span>
                    <b>
                      {
                        policies.policies.filter(
                          policy => policy.company === destination.name && policy.status === "ATIVA",
                        ).length
                      }{" "}
                      política ativa
                    </b>
                  </article>
                ))}
              </div>
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
                  <b>{activeIntegrations}</b> oficiais ativas
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
                        ? "Oficial ativa"
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
                          ? "Credenciais institucionais configuradas."
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
                      <em>Conexão institucional futura</em>
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

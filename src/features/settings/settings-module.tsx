"use client";

import { destinations } from "@/src/domain/core/demo/companies";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import { type EligibilityPolicyState } from "@/src/domain/eligibility/policy-library";
import PoliciesModule from "@/src/features/policies/policies-module";
import { useState } from "react";

type SettingsSection = "overview" | "policies" | "companies" | "integrations" | "interface";

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
    items: [{ id: "companies", label: "Empresas e veículos", description: "Ambiente multiempresa", marker: "02" }],
  },
  {
    label: "RISCO E OPERAÇÕES",
    items: [{ id: "policies", label: "Políticas e motor", description: "Regras, alçadas e vigências", marker: "03" }],
  },
  {
    label: "CONEXÕES",
    items: [{ id: "integrations", label: "Integrações", description: "Fontes de dados externas", marker: "04" }],
  },
  {
    label: "PREFERÊNCIAS",
    items: [{ id: "interface", label: "Interface", description: "Orientação e visualização", marker: "05" }],
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
}: {
  policies: EligibilityPolicyState;
  onPolicies: (state: EligibilityPolicyState) => void;
  showGuidance: boolean;
  onGuidance: (value: boolean) => void;
}) {
  const [section, setSection] = useState<SettingsSection>("overview");
  const activePolicies = policies.policies.filter(policy => policy.status === "ATIVA").length;
  const executableRules = masterRuleCatalog.filter(
    rule => rule.readiness !== "REQUER_DADO" && rule.readiness !== "REQUER_INTEGRACAO",
  ).length;
  const currentSection = menuGroups.flatMap(group => group.items).find(item => item.id === section);

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
                  <b>{activePolicies === destinations.length ? "Ambiente organizado" : "Requer atenção"}</b>
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
                  <strong>0</strong>
                  <span>Integrações ativas</span>
                  <small>Fontes externas pendentes</small>
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
                      <small>Os quatro escopos multiempresa já estão disponíveis.</small>
                    </span>
                  </li>
                  <li className="done">
                    <b>2</b>
                    <span>
                      <strong>Revise as políticas</strong>
                      <small>Cada empresa possui uma política ativa para evoluir.</small>
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
                <p>Conexões necessárias para executar regras que dependem de dados externos.</p>
              </header>
              <div className="settings-integration-grid">
                {[
                  "Receita Federal",
                  "SEFAZ",
                  "Bureaus de crédito",
                  "Registradoras",
                  "Bancos e funding",
                  "Assinatura eletrônica",
                ].map(name => (
                  <article key={name}>
                    <strong>{name}</strong>
                    <span>Não configurada</span>
                    <small>Preparada para integração institucional</small>
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
            </div>
          )}
        </section>
      </div>
    </main>
  );
}

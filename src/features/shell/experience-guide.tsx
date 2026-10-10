"use client";

import { type Operation } from "@/src/domain/core/types";
import { type AttentionItem } from "@/src/domain/copilot/attention-center";
import { type DailyBriefingData } from "@/src/domain/copilot/daily-briefing";
import { operationalSuggestion } from "@/src/domain/copilot/operational-suggestion";
import { Copilot } from "@/src/features/copilot/copilot";
import { ArrowIcon, CheckIcon } from "@/src/ui/icons";
import { useState } from "react";
import { type AppView } from "./shell-context";
import { type Signal } from "./notifications";
import { type AccessUser } from "@/src/domain/access/model";
import { type IntelligenceState } from "@/src/domain/intelligence/model";

type JourneyStep = {
  label: string;
  short: string;
  view: AppView;
  active: string;
  tone: "blue" | "violet" | "amber" | "red" | "green" | "mint" | "slate";
};

const journey: JourneyStep[] = [
  { label: "Relacionar", short: "Comercial", view: "commercial", active: "Comercial", tone: "violet" },
  { label: "Cadastrar", short: "Base única", view: "registry", active: "Cadastros", tone: "blue" },
  { label: "Originar", short: "Operações", view: "operations", active: "Operações", tone: "mint" },
  { label: "Controlar", short: "Controladoria", view: "controlleria", active: "Controladoria", tone: "amber" },
  { label: "Recuperar", short: "Carteira", view: "portfolio", active: "Carteira", tone: "red" },
  { label: "Liquidar", short: "Financeiro", view: "finance", active: "Financeiro", tone: "green" },
  { label: "Aprender", short: "Visão geral", view: "home", active: "Visão geral", tone: "slate" },
];

const guide: Record<string, { verb: string; goal: string; now: string; output: string }> = {
  "Visão geral": {
    verb: "Entender",
    goal: "Ler resultado, caixa, risco e capacidade em poucos segundos.",
    now: "Comece pelas exceções; aprofunde apenas o que pede decisão.",
    output: "Prioridades claras para o dia e decisões orientadas por impacto.",
  },
  Operações: {
    verb: "Originar",
    goal: "Transformar recebíveis em uma operação pronta, sem perder rastreabilidade.",
    now: "Siga a etapa destacada e resolva bloqueios antes de avançar.",
    output: "Operação elegível, precificada, formalizada e pronta para pagamento.",
  },
  Controladoria: {
    verb: "Conferir",
    goal: "Garantir lastro, documentos, assinaturas e conciliação independentes.",
    now: "Trate primeiro divergências e itens que ultrapassaram o SLA.",
    output: "Evidência íntegra, auditável e apta para liberação.",
  },
  Carteira: {
    verb: "Recuperar",
    goal: "Acompanhar títulos e maximizar recebimento com uma régua consistente.",
    now: "Comece pela agenda crítica, depois promessas e escalonamentos.",
    output: "Contato registrado, promessa acompanhada ou ação escalonada.",
  },
  Comercial: {
    verb: "Crescer",
    goal: "Converter relacionamento em originação saudável e recorrente.",
    now: "Priorize oportunidades com limite, qualidade e retorno adequados.",
    output: "Pipeline qualificado e metas conectadas à rentabilidade.",
  },
  Financeiro: {
    verb: "Liquidar",
    goal: "Pagar, receber e conciliar com segurança e previsibilidade de caixa.",
    now: "Resolva liberações prontas e diferenças bancárias antes do corte.",
    output: "Caixa conciliado, pagamentos rastreáveis e contabilidade consistente.",
  },
  Cadastros: {
    verb: "Conhecer",
    goal: "Manter uma fonte única de verdade para pessoas, contas e vínculos.",
    now: "Complete dados críticos e valide documentos antes da operação.",
    output: "Cadastro reutilizável por todos os módulos, sem redigitação.",
  },
  Configurações: {
    verb: "Governar",
    goal: "Definir as regras que a automação usa para orientar e proteger o fluxo.",
    now: "Revise políticas, alçadas e integrações antes de ampliar a automação.",
    output: "Regras versionadas, explicáveis e aplicadas de forma consistente.",
  },
};

export function ExperienceGuide({
  showJourney,
  active,
  operations,
  signals,
  dailyBriefing,
  attentionItems,
  onOpenAttention,
  onNavigate,
  currentUser,
  intelligence,
}: {
  active: string;
  operations: Operation[];
  signals: Signal[];
  dailyBriefing: DailyBriefingData;
  attentionItems: AttentionItem[];
  onOpenAttention: (itemId?: string) => void;
  onNavigate: (view: AppView) => void;
  showJourney: boolean;
  currentUser: AccessUser;
  intelligence: IntelligenceState;
}) {
  const [explained, setExplained] = useState(false);
  const current = guide[active] ?? guide.Operações;
  const activeStep = journey.findIndex(step => step.active === active);
  const suggestion = operationalSuggestion(operations, signals);

  return (
    <>
      {showJourney && (
        <aside className="xp-guide" aria-label="Jornada STRATO">
          <div className="xp-guide-main">
            <div className="xp-guide-context">
              <span className="xp-context-dot" data-tone={journey[activeStep]?.tone ?? "slate"} />
              <div>
                <small>VOCÊ ESTÁ EM · {current.verb.toUpperCase()}</small>
                <b>{active}</b>
              </div>
            </div>
            <nav className="xp-journey" aria-label="Fluxo ponta a ponta">
              {journey.map((step, index) => (
                <button
                  type="button"
                  key={step.label}
                  className={index === activeStep ? "is-current" : index < activeStep ? "is-past" : ""}
                  data-tone={step.tone}
                  onClick={() => onNavigate(step.view)}
                  aria-label={`${step.label} · ${step.short}`}
                  title={`${step.label} · ${step.short}`}
                >
                  <i>{index < activeStep ? <CheckIcon /> : index + 1}</i>
                  <span>
                    <b>{step.label}</b>
                    <small>{step.short}</small>
                  </span>
                </button>
              ))}
            </nav>
            <button
              className="xp-explain-btn"
              type="button"
              aria-expanded={explained}
              onClick={() => setExplained(value => !value)}
            >
              {explained ? "Ocultar orientação" : "Entenda esta tela"}
              <ArrowIcon />
            </button>
          </div>
          {explained && (
            <div className="xp-guide-detail">
              <div>
                <small>OBJETIVO</small>
                <b>{current.goal}</b>
              </div>
              <div>
                <small>FAÇA AGORA</small>
                <b>{current.now}</b>
              </div>
              <div>
                <small>SAÍDA ESPERADA</small>
                <b>{current.output}</b>
              </div>
              <div className="xp-color-key">
                <small>CORES QUE FALAM</small>
                <span>
                  <i className="info" /> salvar
                </span>
                <span>
                  <i className="attention" /> revisar
                </span>
                <span>
                  <i className="blocked" /> excluir
                </span>
                <span>
                  <i className="done" /> confirmar
                </span>
              </div>
            </div>
          )}
        </aside>
      )}

      <Copilot
        dailyBriefing={dailyBriefing}
        attentionItems={attentionItems}
        onOpenAttention={onOpenAttention}
        suggestion={{
          title: suggestion.title,
          body: suggestion.body,
          action: suggestion.action,
          onAction: () => onNavigate(suggestion.view),
        }}
        currentUser={currentUser}
        intelligence={intelligence}
      />
    </>
  );
}

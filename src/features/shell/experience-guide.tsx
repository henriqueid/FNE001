"use client";

import { type Operation } from "@/src/domain/core/types";
import { AlertIcon, ArrowIcon, CheckIcon, CloseIcon, SparkIcon } from "@/src/ui/icons";
import { useState } from "react";
import { type AppView } from "./shell-context";
import { type Signal } from "./notifications";

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
  active,
  operations,
  signals,
  onNavigate,
}: {
  active: string;
  operations: Operation[];
  signals: Signal[];
  onNavigate: (view: AppView) => void;
}) {
  const [explained, setExplained] = useState(false);
  const [copilotOpen, setCopilotOpen] = useState(false);
  const current = guide[active] ?? guide.Operações;
  const activeStep = journey.findIndex(step => step.active === active);
  const blocked = operations.filter(operation => operation.blockers > 0 && operation.status !== "Cancelada");
  const ready = operations.filter(operation => operation.status === "Pronta para liberar");
  const delayed = signals.filter(signal => signal.tone === "warning");
  const suggestion = blocked.length
    ? {
        title: `${blocked.length} decisão(ões) destravam o maior valor agora`,
        body: `${blocked[0].cedent} concentra a primeira exceção. A IA recomenda revisar o bloqueio antes de iniciar novas análises.`,
        action: "Revisar operações",
        view: "operations" as AppView,
      }
    : ready.length
      ? {
          title: `${ready.length} operação(ões) pronta(s) para liberar`,
          body: "Os requisitos anteriores estão concluídos. Confirme favorecidos e janela bancária.",
          action: "Abrir financeiro",
          view: "finance" as AppView,
        }
      : delayed.length
        ? {
            title: "O ritmo de uma operação saiu do padrão",
            body: "A recomendação considera o tempo atual comparado ao histórico do mesmo cliente.",
            action: "Ver a exceção",
            view: "operations" as AppView,
          }
        : {
            title: "Fluxo dentro do padrão esperado",
            body: "Nenhuma exceção crítica nova. Continue pela etapa destacada na jornada.",
            action: "Ver visão geral",
            view: "home" as AppView,
          };

  return (
    <>
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
                <i className="info" /> informação
              </span>
              <span>
                <i className="attention" /> atenção
              </span>
              <span>
                <i className="blocked" /> bloqueio
              </span>
              <span>
                <i className="done" /> concluído
              </span>
            </div>
          </div>
        )}
      </aside>

      <div className={`xp-copilot ${copilotOpen ? "is-open" : ""}`}>
        {copilotOpen && (
          <section role="dialog" aria-label="Copiloto STRATO">
            <header>
              <span>
                <SparkIcon />
                <b>Copiloto STRATO</b>
              </span>
              <button type="button" aria-label="Fechar copiloto" onClick={() => setCopilotOpen(false)}>
                <CloseIcon />
              </button>
            </header>
            <div className="xp-ai-label">
              <i /> RECOMENDAÇÃO CONTEXTUAL
            </div>
            <h2>{suggestion.title}</h2>
            <p>{suggestion.body}</p>
            <div className="xp-ai-proof">
              <AlertIcon />
              <span>
                <b>Por que isto?</b> Prioridade calculada por bloqueio, valor, prazo e etapa atual.
              </span>
            </div>
            <button
              type="button"
              className="xp-ai-action"
              onClick={() => {
                onNavigate(suggestion.view);
                setCopilotOpen(false);
              }}
            >
              {suggestion.action}
              <ArrowIcon />
            </button>
            <small>A IA orienta; decisões e registros continuam sob controle humano.</small>
          </section>
        )}
        <button
          type="button"
          className="xp-copilot-trigger"
          aria-expanded={copilotOpen}
          onClick={() => setCopilotOpen(value => !value)}
        >
          <SparkIcon />
          <span>
            <b>Copiloto</b>
            <small>{blocked.length ? `${blocked.length} prioridade(s)` : "Fluxo assistido"}</small>
          </span>
        </button>
      </div>
    </>
  );
}

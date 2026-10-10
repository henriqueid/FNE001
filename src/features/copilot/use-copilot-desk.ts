"use client";

/**
 * Estado do Copiloto da Mesa Inteligente: arquivos recebidos, tarefa assíncrona por etapas (simulada com
 * temporizadores; no MVP vira fila no servidor), autorização de consulta ao birô, cenários versionados, conversa
 * e decisão (aprovação rápida ou alçada). A tarefa continua rodando com a caixa fechada.
 */
import { answerDesk, type DeskReply } from "@/src/domain/copilot/desk-assistant";
import { answerSystemQuestion, type SystemKnowledge } from "@/src/domain/copilot/system-query";
import { deskDemoFiles, deskDemoPolicy, deskDemoTitles, deskFileFormat } from "@/src/domain/copilot/desk-demo";
import {
  centsToBRL,
  type DeskContext,
  type DeskFile,
  type DeskScenario,
  firstScenario,
  nextScenario,
} from "@/src/domain/copilot/desk-engine";
import { useCallback, useEffect, useRef, useState } from "react";
import { can, type AccessUser } from "@/src/domain/access/model";
import { appendDecisionEvent, createAuthorityGrant, decisionFingerprint } from "@/src/domain/decisions/engine";
import { emptyDecisionLedger } from "@/src/domain/decisions/model";
import { canUseGenerativeAI, type IntelligenceState } from "@/src/domain/intelligence/model";

export type DeskStage = "idle" | "recebida" | "validando" | "extraindo" | "calculando" | "concluida";
export type DeskDecision = "pending" | "approved" | "rejected" | null;

export type DeskMessage =
  | { id: number; role: "me"; text: string }
  | { id: number; role: "ai"; reply: DeskReply }
  | { id: number; role: "card"; card: "progress" | "result" };

export const DESK_STAGES: { key: Exclude<DeskStage, "idle">; label: string }[] = [
  { key: "recebida", label: "Arquivos recebidos" },
  { key: "validando", label: "Validando formatos" },
  { key: "extraindo", label: "Extraindo títulos" },
  { key: "calculando", label: "Aplicando política e calculando" },
  { key: "concluida", label: "Análise concluída" },
];

type WithoutId<T> = T extends unknown ? Omit<T, "id"> : never;

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export function useCopilotDesk(knowledge: SystemKnowledge, actor: AccessUser, intelligence: IntelligenceState) {
  const [cedent, setCedent] = useState("");
  const [files, setFiles] = useState<DeskFile[]>([]);
  const [userFiles, setUserFiles] = useState(false);
  const [stage, setStage] = useState<DeskStage>("idle");
  const [logs, setLogs] = useState<Partial<Record<DeskStage, string>>>({});
  const [waitingAuth, setWaitingAuth] = useState(false);
  const [bureauChecked, setBureauChecked] = useState(false);
  const [scenarios, setScenarios] = useState<DeskScenario[]>([]);
  const [messages, setMessages] = useState<DeskMessage[]>([]);
  const [decision, setDecision] = useState<DeskDecision>(null);
  const [unread, setUnread] = useState(false);
  const [decisionLedger, setDecisionLedger] = useState(emptyDecisionLedger);
  const [decisionError, setDecisionError] = useState("");
  const alive = useRef(true);
  /** Identifica a tarefa em curso; limpar a conversa invalida a anterior. */
  const run = useRef(0);
  const nextId = useRef(1);
  const nextEventId = useRef(1);

  useEffect(() => {
    alive.current = true;
    return () => {
      alive.current = false;
    };
  }, []);

  const push = useCallback((message: WithoutId<DeskMessage>) => {
    const id = nextId.current++;
    setMessages(list => [...list, { ...message, id } as DeskMessage]);
  }, []);

  const log = useCallback((key: DeskStage, text: string) => {
    setStage(key);
    setLogs(current => ({ ...current, [key]: text }));
  }, []);

  const context: DeskContext = { titles: deskDemoTitles, policy: deskDemoPolicy, bureauChecked };
  const aiAvailable = canUseGenerativeAI(intelligence);
  const operationId = `copilot-${cedent || "unassigned"}`;

  const recordEvent = useCallback(
    (
      eventType:
        | "ANALYSIS_REQUESTED"
        | "ANALYSIS_COMPLETED"
        | "POLICY_BLOCKED"
        | "EXCEPTION_REQUESTED"
        | "EXCEPTION_APPROVED"
        | "EXCEPTION_REJECTED"
        | "OPERATION_SENT_TO_FORMALIZATION",
      outcome: "PENDING" | "WITHIN_POLICY" | "BLOCKED" | "APPROVED" | "REJECTED",
      reasonCodes: string[],
      humanRationale?: string,
      snapshot?: { version: number; metrics: Record<string, number | string | boolean> },
    ) => {
      const now = new Date().toISOString();
      const eventNumber = nextEventId.current++;
      setDecisionLedger(current =>
        appendDecisionEvent(current, {
          eventId: `decision-event-${eventNumber}`,
          eventType,
          decisionId: `decision-${operationId}`,
          tenantId: intelligence.tenantId,
          operationId,
          entityRefs: cedent ? [cedent] : [],
          decisionType: "OPERATION_ELIGIBILITY",
          requestedAction: eventType,
          actorId: actor.id,
          actorRole: actor.role,
          authorityId: eventType.includes("EXCEPTION") ? "credit-director" : undefined,
          policyId: deskDemoPolicy.name,
          policyVersion: deskDemoPolicy.version,
          inputSnapshotId: `scenario-${snapshot?.version ?? scenarios.at(-1)?.version ?? 0}`,
          inputSnapshotHash: decisionFingerprint({
            files: files.map(file => ({ name: file.name, format: file.format })),
            scenario: snapshot?.version ?? scenarios.at(-1)?.version ?? 0,
            policy: `${deskDemoPolicy.name}:${deskDemoPolicy.version}`,
          }),
          computedMetrics:
            snapshot?.metrics ??
            (scenarios.length
              ? {
                  faceCents: scenarios.at(-1)?.result.faceCents ?? 0,
                  netCents: scenarios.at(-1)?.result.netCents ?? 0,
                }
              : {}),
          reasonCodes,
          humanRationale,
          supportingEvidenceRefs: files.map(file => file.name),
          priorDecisionRefs: current.events.length ? [current.events.at(-1)?.eventId ?? ""] : [],
          outcome,
          conditions: [],
          validFrom: now,
          createdAt: now,
          correlationId: `copilot-run-${run.current}`,
        }),
      );
    },
    [actor.id, actor.role, cedent, files, intelligence.tenantId, operationId, scenarios],
  );

  const loadExamples = () => {
    setFiles(deskDemoFiles);
    setUserFiles(false);
  };

  const addFiles = (list: FileList | File[]) => {
    const added = Array.from(list).map(file => ({ name: file.name, ...deskFileFormat(file.name) }));
    if (!added.length) return;
    setFiles(current => [...current, ...added]);
    setUserFiles(true);
  };

  const start = async () => {
    const token = ++run.current;
    const stale = () => !alive.current || token !== run.current;
    setScenarios([]);
    setDecision(null);
    setBureauChecked(false);
    setLogs({});
    setDecisionLedger(emptyDecisionLedger());
    setDecisionError("");
    push({ role: "me", text: `Analisar ${files.length} arquivo(s)` });
    push({ role: "card", card: "progress" });
    recordEvent("ANALYSIS_REQUESTED", "PENDING", []);
    log("recebida", `${files.length} arquivo(s) identificado(s) e preservado(s) para análise.`);
    await wait(900);
    if (stale()) return;
    log("validando", "XML NF-e, CNAB 400 e XLS no layout padrão reconhecidos. 1 título já existe na carteira.");
    await wait(1300);
    if (stale()) return;
    log(
      "extraindo",
      `${deskDemoTitles.length} títulos de 5 sacados. Campos ausentes viram pendência, nada é inventado.`,
    );
    await wait(1200);
    if (stale()) return;
    log(
      "calculando",
      `Política ${deskDemoPolicy.name} v${deskDemoPolicy.version}. Exposição e histórico do cedente lidos.`,
    );
    await wait(800);
    if (stale()) return;
    setWaitingAuth(true);
    setUnread(true);
  };

  const authorize = async (allowed: boolean) => {
    const token = run.current;
    setWaitingAuth(false);
    setBureauChecked(allowed);
    setLogs(current => ({
      ...current,
      calculando: `${current.calculando ?? ""} ${allowed ? "Consulta ao birô autorizada." : "Seguiu sem consulta ao birô."}`,
    }));
    await wait(1200);
    if (!alive.current || token !== run.current) return;
    const scenario = firstScenario({ ...context, bureauChecked: allowed });
    setScenarios([scenario]);
    const { result } = scenario;
    recordEvent(
      "ANALYSIS_COMPLETED",
      result.fastTrack ? "WITHIN_POLICY" : "BLOCKED",
      [...result.blockers.map(item => item.id), ...result.exceptions.map(item => item.id)],
      undefined,
      {
        version: scenario.version,
        metrics: {
          faceCents: result.faceCents,
          netCents: result.netCents,
          blockerCount: result.blockers.length,
          exceptionCount: result.exceptions.length,
        },
      },
    );
    if (result.blockers.length || result.exceptions.length)
      recordEvent(
        "POLICY_BLOCKED",
        "BLOCKED",
        [...result.blockers.map(item => item.id), ...result.exceptions.map(item => item.id)],
        undefined,
        {
          version: scenario.version,
          metrics: { blockerCount: result.blockers.length, exceptionCount: result.exceptions.length },
        },
      );
    log(
      "concluida",
      `${result.blockers.length} impedimento(s), ${result.exceptions.length} ponto(s) de alçada, líquido ${centsToBRL(result.netCents)}.`,
    );
    push({ role: "card", card: "result" });
    push({
      role: "ai",
      reply: {
        paragraphs: [
          `Encontrei ${result.blockers.length} impedimento(s) e ${result.exceptions.length} ponto(s) que pedem alçada. Os valores vêm do motor de cálculo.`,
          "Por onde quer começar?",
        ],
      },
    });
    setUnread(true);
  };

  const locked = decision !== null;

  /** Pergunta livre: primeiro sobre o cenário em análise (se houver); senão, consulta a base e a política. */
  const ask = (text: string) => {
    push({ role: "me", text });
    if (!aiAvailable) {
      push({
        role: "ai",
        reply: {
          paragraphs: [
            "A IA está desativada ou indisponível para esta organização. O motor determinístico e o relatório estruturado continuam disponíveis.",
          ],
        },
      });
      return;
    }
    if (scenarios.length && !locked) {
      const answer = answerDesk(text, context, scenarios);
      if (!answer.fallback) {
        if (answer.scenario) setScenarios(list => [...list, answer.scenario as DeskScenario]);
        push({ role: "ai", reply: answer.reply });
        return;
      }
    }
    push({ role: "ai", reply: answerSystemQuestion(text, knowledge) });
  };

  const toggleTitle = (id: string) => {
    if (!scenarios.length || locked) return;
    const current = scenarios[scenarios.length - 1];
    const document = deskDemoTitles.find(title => title.id === id)?.document ?? id;
    const removing = current.included.includes(id);
    const scenario = nextScenario(context, scenarios, {
      included: removing ? current.included.filter(item => item !== id) : [...current.included, id],
      label: `${removing ? "Retirado" : "Incluído"} ${document} na tabela`,
    });
    setScenarios(list => [...list, scenario]);
    push({
      role: "ai",
      reply: {
        tool: `simular_cenario(${removing ? "retirar" : "incluir"}=[${document}])`,
        paragraphs: [`Cenário v${scenario.version}: líquido ${centsToBRL(scenario.result.netCents)}.`],
      },
    });
  };

  const approveFast = () => {
    const current = scenarios[scenarios.length - 1];
    setDecision("approved");
    recordEvent("OPERATION_SENT_TO_FORMALIZATION", "APPROVED", []);
    push({
      role: "ai",
      reply: {
        tool: `encaminhar_formalizacao(v${current.version})`,
        paragraphs: [
          "Aprovada dentro da sua alçada e enviada para a fila de formalização. A formalização e o pagamento seguem manuais.",
        ],
      },
    });
  };

  const sendToAuthority = () => {
    const current = scenarios[scenarios.length - 1];
    setDecision("pending");
    setDecisionError("");
    recordEvent(
      "EXCEPTION_REQUESTED",
      "PENDING",
      current.result.exceptions.map(item => item.id),
    );
    push({
      role: "ai",
      reply: {
        tool: `solicitar_excecao(v${current.version})`,
        paragraphs: [
          `Enviei o cenário v${current.version} para a alçada com os motivos: ${current.result.exceptions.map(item => item.title).join("; ")}.`,
        ],
      },
    });
  };

  const authorityDecides = (approved: boolean, rationale: string) => {
    setDecisionError("");
    const current = scenarios[scenarios.length - 1];
    if (!current) return false;
    if (!can(actor, "risk:decide")) {
      setDecisionError("Seu perfil não possui competência para esta alçada.");
      return false;
    }
    try {
      if (approved) {
        const now = new Date();
        createAuthorityGrant({
          actor: { id: actor.id, role: actor.role, authorityIds: ["credit-director"] },
          authorityId: "credit-director",
          operationId,
          cedentDocument: cedent || "nao-informado",
          policyId: context.policy.name,
          policyVersion: context.policy.version,
          additionalExposureCents: current.result.faceCents,
          maximumAdditionalExposureCents: current.result.faceCents,
          validFrom: now.toISOString(),
          validUntil: new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString(),
          rationale,
        });
      } else if (rationale.trim().length < 12) {
        throw new Error("Informe uma justificativa objetiva para a decisão.");
      }
    } catch (error) {
      setDecisionError(error instanceof Error ? error.message : "Não foi possível registrar a decisão.");
      return false;
    }
    setDecision(approved ? "approved" : "rejected");
    recordEvent(
      approved ? "EXCEPTION_APPROVED" : "EXCEPTION_REJECTED",
      approved ? "APPROVED" : "REJECTED",
      current.result.exceptions.map(item => item.id),
      rationale.trim(),
    );
    push({
      role: "ai",
      reply: {
        paragraphs: [
          approved
            ? "A Diretoria de crédito aprovou. A operação entrou na fila de formalização manual."
            : "A alçada reprovou. O motivo fica registrado na trilha de auditoria.",
        ],
      },
    });
    return true;
  };

  const reset = () => {
    run.current++;
    setUnread(false);
    setStage("idle");
    setFiles([]);
    setUserFiles(false);
    setMessages([]);
    setScenarios([]);
    setDecision(null);
    setWaitingAuth(false);
    setLogs({});
    setDecisionLedger(emptyDecisionLedger());
    setDecisionError("");
  };

  return {
    cedent,
    setCedent,
    files,
    userFiles,
    loadExamples,
    addFiles,
    stage,
    logs,
    waitingAuth,
    scenarios,
    messages,
    decision,
    decisionLedger,
    decisionError,
    aiAvailable,
    locked,
    unread,
    clearUnread: () => setUnread(false),
    busy: stage !== "idle" && stage !== "concluida" && !waitingAuth,
    context,
    start,
    authorize,
    ask,
    toggleTitle,
    approveFast,
    sendToAuthority,
    authorityDecides,
    reset,
  };
}

export type CopilotDesk = ReturnType<typeof useCopilotDesk>;

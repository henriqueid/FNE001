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
import { createAuthorityGrant, decisionFingerprint } from "@/src/domain/decisions/engine";
import { emptyDecisionLedger, type DecisionEventDraft } from "@/src/domain/decisions/model";
import { canUseGenerativeAI, type IntelligenceState } from "@/src/domain/intelligence/model";
import { loadDecisionLedger, persistDecisionEvent } from "./decision-ledger-client";
import { askConfiguredCopilot } from "@/src/app/intelligence-client";
import { type Debtor, type EntryIntake, type EntryIntakeIssue, type ManualEntryData } from "@/src/domain/core/types";
import { buildOfflineDeskContext } from "@/src/domain/copilot/offline-analysis";

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
const uniqueId = (prefix: string) =>
  `${prefix}-${globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;

export function useCopilotDesk(
  knowledge: SystemKnowledge,
  actor: AccessUser,
  intelligence: IntelligenceState,
  defaultCedentId = "",
  demoMode = false,
  debtors: Debtor[] = [],
  onUsage?: (tokens: number) => void,
) {
  const [cedent, setCedent] = useState(defaultCedentId);
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
  const [asking, setAsking] = useState(false);
  const [analysisContext, setAnalysisContext] = useState<DeskContext | null>(null);
  const [intakeIssues, setIntakeIssues] = useState<EntryIntakeIssue[]>([]);
  const [fileErrors, setFileErrors] = useState<string[]>([]);
  const [importedData, setImportedData] = useState<ManualEntryData>();
  const [entryIntake, setEntryIntake] = useState<EntryIntake>();
  const [linkedOperationId, setLinkedOperationId] = useState<string>();
  const alive = useRef(true);
  /** Identifica a tarefa em curso; limpar a conversa invalida a anterior. */
  const run = useRef(0);
  const nextId = useRef(1);
  const correlationId = useRef(uniqueId("copilot-run"));
  const latestPersistedEventId = useRef<string | undefined>(undefined);
  const persistenceQueue = useRef<Promise<void>>(Promise.resolve());
  const linkedSnapshotRecorded = useRef<string | undefined>(undefined);

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

  const context: DeskContext = analysisContext
    ? { ...analysisContext, bureauChecked }
    : { titles: deskDemoTitles, policy: deskDemoPolicy, bureauChecked };
  const contextRef = useRef<DeskContext>(context);
  contextRef.current = context;
  const aiAvailable = canUseGenerativeAI(intelligence);
  const operationId = linkedOperationId ?? `copilot-${cedent || "unassigned"}`;
  const decisionId = `decision-${operationId}`;
  const isDraftOperation = operationId.startsWith("copilot-");

  useEffect(() => {
    if (isDraftOperation) return;
    let cancelled = false;
    loadDecisionLedger(intelligence.tenantId, decisionId)
      .then(ledger => {
        if (cancelled) return;
        setDecisionError("");
        setDecisionLedger(ledger);
        latestPersistedEventId.current = ledger.events.at(-1)?.eventId;
      })
      .catch(error => {
        if (!cancelled)
          setDecisionError(error instanceof Error ? error.message : "Não foi possível carregar a trilha de decisões.");
      });
    return () => {
      cancelled = true;
    };
  }, [actor, decisionId, intelligence.tenantId, isDraftOperation]);

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
      if (isDraftOperation) return;
      const now = new Date().toISOString();
      const event: DecisionEventDraft = {
        eventId: uniqueId("decision-event"),
        eventType,
        decisionId,
        operationId,
        entityRefs: cedent ? [cedent] : [],
        decisionType: "OPERATION_ELIGIBILITY",
        requestedAction: eventType,
        authorityId: eventType.includes("EXCEPTION") ? "credit-director" : undefined,
        policyId: contextRef.current.policy.name,
        policyVersion: contextRef.current.policy.version,
        inputSnapshotId: `scenario-${snapshot?.version ?? scenarios.at(-1)?.version ?? 0}`,
        inputSnapshotHash: decisionFingerprint({
          files: files.map(file => ({ name: file.name, format: file.format })),
          scenario: snapshot?.version ?? scenarios.at(-1)?.version ?? 0,
          policy: `${contextRef.current.policy.name}:${contextRef.current.policy.version}`,
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
        priorDecisionRefs: latestPersistedEventId.current ? [latestPersistedEventId.current] : [],
        outcome,
        conditions: [],
        validFrom: now,
        correlationId: correlationId.current,
      };
      persistenceQueue.current = persistenceQueue.current
        .then(async () => {
          const persisted = await persistDecisionEvent(intelligence.tenantId, event);
          latestPersistedEventId.current = persisted.eventId;
          setDecisionLedger(current => ({
            ...current,
            events: [...current.events.filter(item => item.eventId !== persisted.eventId), persisted].sort(
              (left, right) => left.eventVersion - right.eventVersion,
            ),
          }));
        })
        .catch(error => {
          setDecisionError(error instanceof Error ? error.message : "Não foi possível persistir a decisão.");
        });
    },
    [cedent, decisionId, files, intelligence.tenantId, isDraftOperation, operationId, scenarios],
  );

  useEffect(() => {
    const scenario = scenarios.at(-1);
    if (demoMode || isDraftOperation || !linkedOperationId || !scenario) return;
    const snapshotKey = `${linkedOperationId}:${scenario.version}`;
    if (linkedSnapshotRecorded.current === snapshotKey) return;
    linkedSnapshotRecorded.current = snapshotKey;
    recordEvent(
      "ANALYSIS_COMPLETED",
      scenario.result.fastTrack ? "WITHIN_POLICY" : "BLOCKED",
      [...scenario.result.blockers.map(item => item.id), ...scenario.result.exceptions.map(item => item.id)],
      undefined,
      {
        version: scenario.version,
        metrics: {
          faceCents: scenario.result.faceCents,
          netCents: scenario.result.netCents,
          blockerCount: scenario.result.blockers.length,
          exceptionCount: scenario.result.exceptions.length,
        },
      },
    );
  }, [demoMode, isDraftOperation, linkedOperationId, recordEvent, scenarios]);

  const loadExamples = () => {
    if (!demoMode) return;
    setFiles(deskDemoFiles);
    setUserFiles(false);
    setAnalysisContext(null);
    setIntakeIssues([]);
    setFileErrors([]);
    setImportedData(undefined);
    setEntryIntake(undefined);
    setLinkedOperationId(undefined);
    linkedSnapshotRecorded.current = undefined;
  };

  const addFiles = async (list: FileList | File[]) => {
    const added = await Promise.all(
      Array.from(list).map(async file => {
        const metadata = { name: file.name, ...deskFileFormat(file.name) };
        try {
          return { ...metadata, content: await file.text() };
        } catch {
          return { ...metadata, readError: "não foi possível ler o arquivo" };
        }
      }),
    );
    if (!added.length) return;
    setFiles(current => [...current, ...added]);
    setUserFiles(true);
  };

  const start = async () => {
    const token = ++run.current;
    correlationId.current = uniqueId("copilot-run");
    const stale = () => !alive.current || token !== run.current;
    setScenarios([]);
    setDecision(null);
    setBureauChecked(false);
    setLogs({});
    setDecisionError("");
    setIntakeIssues([]);
    setFileErrors([]);
    setImportedData(undefined);
    setEntryIntake(undefined);
    setLinkedOperationId(undefined);
    linkedSnapshotRecorded.current = undefined;
    push({ role: "me", text: `Analisar ${files.length} arquivo(s)` });
    push({ role: "card", card: "progress" });
    log("recebida", `${files.length} arquivo(s) identificado(s) e preservado(s) para análise.`);
    await wait(250);
    if (stale()) return;
    const offline =
      demoMode && !userFiles
        ? {
            context: { titles: deskDemoTitles, policy: deskDemoPolicy, bureauChecked: false },
            issues: [],
            fileErrors: [],
            acceptedRows: deskDemoTitles.length,
          }
        : buildOfflineDeskContext({ files, knowledge, debtors, cedentId: cedent });
    setIntakeIssues(offline.issues);
    setFileErrors(offline.fileErrors);
    setImportedData(offline.importedData);
    setEntryIntake(offline.entryIntake);
    log(
      "validando",
      `${files.length - offline.fileErrors.length} arquivo(s) lido(s)${offline.issues.length ? ` · ${offline.issues.length} apontamento(s) de entrada` : " · estrutura válida"}.`,
    );
    await wait(300);
    if (stale()) return;
    if (!offline.context) {
      log("extraindo", "Nenhum título válido foi extraído; revise os apontamentos do arquivo.");
      setStage("idle");
      push({
        role: "ai",
        reply: {
          tool: "analisar_arquivo_offline()",
          paragraphs: [
            "Não consegui modelar a operação porque nenhum título válido foi extraído.",
            ...offline.fileErrors,
            ...offline.issues.slice(0, 5).map(item => item.message),
          ],
        },
      });
      return;
    }
    setAnalysisContext(offline.context);
    contextRef.current = offline.context;
    recordEvent("ANALYSIS_REQUESTED", "PENDING", []);
    log(
      "extraindo",
      `${offline.acceptedRows} título(s) de ${new Set(offline.context.titles.map(title => title.debtor)).size} sacado(s). Campos ausentes viram pendência, nada é inventado.`,
    );
    await wait(300);
    if (stale()) return;
    log(
      "calculando",
      `Política ${offline.context.policy.name} v${offline.context.policy.version}. Score, limite, exposição e títulos processados localmente.`,
    );
    await wait(300);
    if (stale()) return;
    if (offline.context.titles.some(title => title.newDebtor)) {
      setWaitingAuth(true);
      setUnread(true);
    } else await completeAnalysis(false, offline.context, token);
  };

  async function completeAnalysis(allowed: boolean, sourceContext: DeskContext, token = run.current) {
    const completedContext = { ...sourceContext, bureauChecked: allowed };
    contextRef.current = completedContext;
    setAnalysisContext(completedContext);
    await wait(250);
    if (!alive.current || token !== run.current) return;
    const scenario = firstScenario(completedContext);
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
  }

  const authorize = async (allowed: boolean) => {
    const token = run.current;
    setWaitingAuth(false);
    setBureauChecked(allowed);
    setLogs(current => ({
      ...current,
      calculando: `${current.calculando ?? ""} ${allowed ? "Consulta ao birô autorizada." : "Seguiu sem consulta ao birô."}`,
    }));
    await completeAnalysis(allowed, context, token);
  };

  const locked = decision !== null || Boolean(linkedOperationId);

  /** Pergunta livre: primeiro sobre o cenário em análise (se houver); senão, consulta a base e a política. */
  const ask = async (text: string) => {
    push({ role: "me", text });
    if (scenarios.length && !locked) {
      const answer = answerDesk(text, context, scenarios);
      if (!answer.fallback) {
        if (answer.scenario) setScenarios(list => [...list, answer.scenario as DeskScenario]);
        push({ role: "ai", reply: answer.reply });
        return;
      }
    }
    const localAnswer = answerSystemQuestion(text, knowledge);
    if (localAnswer.tool) {
      push({ role: "ai", reply: localAnswer });
      return;
    }
    if (!aiAvailable) {
      push({
        role: "ai",
        reply: {
          paragraphs: [
            ...localAnswer.paragraphs,
            "Estou em modo offline: consigo consultar dados, explicar a política e modelar cenários; perguntas livres e insights generativos exigem a conexão com IA.",
          ],
        },
      });
      return;
    }
    setAsking(true);
    try {
      const result = await askConfiguredCopilot(text, knowledge);
      push({ role: "ai", reply: result.reply });
      if (result.usage.totalTokens > 0) onUsage?.(result.usage.totalTokens);
    } catch (error) {
      push({
        role: "ai",
        reply: {
          tool: "copilot_error()",
          paragraphs: [
            error instanceof Error
              ? error.message
              : "A IA não conseguiu responder agora. As consultas estruturadas continuam disponíveis.",
            "Sua pergunta continua na conversa. Você pode tentar enviá-la novamente sem perder o contexto.",
          ],
        },
      });
    } finally {
      setAsking(false);
    }
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
          cedentDocument: (knowledge.cedents.find(item => item.id === cedent)?.document ?? cedent) || "nao-informado",
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
            ? "A Diretoria de crédito aprovou. A operação avançou até o próximo controle obrigatório da esteira."
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
    setDecisionError("");
    setAnalysisContext(null);
    setIntakeIssues([]);
    setFileErrors([]);
    setImportedData(undefined);
    setEntryIntake(undefined);
    setLinkedOperationId(undefined);
    linkedSnapshotRecorded.current = undefined;
    setBureauChecked(false);
  };

  return {
    cedent,
    setCedent,
    files,
    userFiles,
    intakeIssues,
    fileErrors,
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
    demoMode,
    locked,
    unread,
    clearUnread: () => setUnread(false),
    busy: stage !== "idle" && stage !== "concluida" && !waitingAuth,
    asking,
    context,
    runId: correlationId.current,
    importedData,
    entryIntake,
    linkedOperationId,
    linkOperation: setLinkedOperationId,
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

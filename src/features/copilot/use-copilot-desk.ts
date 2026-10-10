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

export function useCopilotDesk(knowledge: SystemKnowledge) {
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
  const alive = useRef(true);
  /** Identifica a tarefa em curso; limpar a conversa invalida a anterior. */
  const run = useRef(0);
  const nextId = useRef(1);

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
    push({ role: "me", text: `Analisar ${files.length} arquivo(s)` });
    push({ role: "card", card: "progress" });
    log("recebida", `${files.length} arquivo(s) guardado(s) com SHA-256.`);
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

  const authorityDecides = (approved: boolean) => {
    setDecision(approved ? "approved" : "rejected");
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

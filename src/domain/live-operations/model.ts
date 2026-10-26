import { type AccessUser } from "@/src/domain/access/model";
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";

export type LivePresence = "active" | "away" | "offline" | "unknown";

export type LiveOperator = {
  user: AccessUser;
  presence: LivePresence;
  sessionMinutes: number;
  activityMinutes: number;
  screen: string;
  task: string;
  context: string;
  result: string;
  progress: number;
  alert?: string;
  operation?: Operation;
  simulated?: boolean;
};

const seededNumber = (value: string) => [...value].reduce((total, character) => total + character.charCodeAt(0), 0);

/** Restringe a supervisão à árvore do gestor; administradores veem toda a operação ativa. */
export function supervisedUsers(users: AccessUser[], viewer: AccessUser) {
  const active = users.filter(user => user.status === "active" && user.id !== viewer.id);
  if (viewer.access === "admin") return active;
  if (viewer.access !== "manager") return [];
  const directReports = active.filter(user => user.managerUserId === viewer.id);
  if (directReports.length) return directReports;
  return active.filter(user => user.access === "operator" && user.department === viewer.department);
}

/** Monta a projeção da sala operacional sem expor conteúdo digitado ou a tela física do usuário. */
export function buildLiveOperators(
  users: AccessUser[],
  viewer: AccessUser,
  operations: Operation[],
  demoMode = false,
): LiveOperator[] {
  const supervised = supervisedUsers(users, viewer);
  const usersWithOperationalEvidence = supervised.filter(user =>
    operations.some(operation => operation.owner === user.name),
  );

  return usersWithOperationalEvidence.map((user, index) => {
    const seed = seededNumber(user.id);
    const owned = operations.filter(operation => operation.owner === user.name);
    const operation =
      owned.find(item => item.status !== "Cancelada" && item.status !== "Liberada ao financeiro") ?? owned[0];
    const presence: LivePresence = !demoMode
      ? "unknown"
      : index === usersWithOperationalEvidence.length - 1 && usersWithOperationalEvidence.length > 4
        ? "offline"
        : seed % 5 === 0
          ? "away"
          : "active";
    const stage = operation ? (stages.find(item => item.id === operation.stage)?.title ?? "Operação") : undefined;
    const roleActivity =
      user.department === "Comercial"
        ? { screen: "Comercial · Carteira", task: "Revisando relacionamento", context: "Carteira comercial" }
        : user.department === "Risco e crédito"
          ? {
              screen: "Operações · Risco",
              task: "Analisando elegibilidade",
              context: operation?.cedent ?? "Fila de risco",
            }
          : user.department === "Controladoria"
            ? {
                screen: "Controladoria",
                task: "Conferindo documentos",
                context: operation?.cedent ?? "Fila de formalização",
              }
            : user.department === "Financeiro"
              ? { screen: "Financeiro · Conciliação", task: "Conciliando movimento", context: "Movimento bancário" }
              : {
                  screen: operation ? `Operações · ${stage}` : "Central do Dia",
                  task: operation?.nextAction ?? "Organizando fila",
                  context: operation?.cedent ?? "Fila operacional",
                };
    const activityMinutes =
      !demoMode || presence === "offline" ? 0 : presence === "away" ? 16 + (seed % 14) : 2 + (seed % 11);
    return {
      user,
      presence,
      sessionMinutes: !demoMode || presence === "offline" ? 0 : 72 + (seed % 341),
      activityMinutes,
      ...(demoMode
        ? roleActivity
        : {
            screen: operation ? `Operações · ${stage}` : "Sem operação vinculada",
            task: operation?.nextAction ?? "Sem próxima ação registrada",
            context: operation?.cedent ?? "Sem operação vinculada",
          }),
      result: operation
        ? `${operation.titleCount} títulos · ${operation.status}`
        : index % 2
          ? "3 contatos · 1 retorno"
          : "Fila revisada · sem bloqueios",
      progress: operation ? Math.min(100, Math.round((operation.stage / stages.length) * 100)) : 64 + (seed % 28),
      alert:
        presence === "away"
          ? "Sem atividade há mais de 15 min"
          : operation && operation.blockers > 0
            ? `${operation.blockers} bloqueio${operation.blockers > 1 ? "s" : ""} na tarefa`
            : undefined,
      operation,
      simulated: demoMode,
    };
  });
}

export function formatLiveDuration(minutes: number) {
  if (minutes < 60) return `${minutes} min`;
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  return rest ? `${hours}h ${rest}min` : `${hours}h`;
}

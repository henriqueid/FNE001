/**
 * Criação de uma nova operação a partir do modal "Nova operação".
 * Gera o aditivo (AAAAMMDD + sequência diária) e o borderô (sequência geral), grava o comercial
 * responsável pelo cedente na data e aplica a política padrão do tipo de veículo.
 */
import { repAt } from "@/src/domain/commercial/rules";
import { type CommercialState } from "@/src/domain/commercial/types";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { type Cedent, type Destination, type Operation, type OperationSource } from "@/src/domain/core/types";
import { datePrefix } from "./dates";

export type NewOperationRequest = {
  source: OperationSource;
  operationType: string;
  destination: Destination;
  cedent: Cedent;
};

export function buildNewOperation(
  { source, operationType, destination, cedent }: NewOperationRequest,
  operations: Operation[],
  commercial: CommercialState,
  today: string,
): Operation {
  const nextActions: Record<OperationSource, string> = {
    "XML NF-e": "Conferir títulos identificados nos XMLs",
    CNAB: "Validar leiaute e ocorrências importadas",
    Planilha: "Conferir colunas e títulos importados",
    "Digitação manual": "Definir o tipo de recebível e iniciar a digitação",
    "Crédito estruturado": "Cadastrar condições, garantias e partes da CCB",
  };
  const prefix = datePrefix();
  const dailySequence =
    Math.max(
      0,
      ...operations
        .filter(operation => operation.aditivoNumber?.startsWith(prefix))
        .map(operation => Number(operation.aditivoNumber.slice(-3)) || 0),
    ) + 1;
  const borderoSequence = Math.max(0, ...operations.map(operation => Number(operation.borderoNumber) || 0)) + 1;
  const aditivoNumber = `${prefix}${String(dailySequence).padStart(3, "0")}`;
  const borderoNumber = String(borderoSequence).padStart(7, "0");
  return {
    ...initialOperations[4],
    commercialRepId: repAt(commercial, cedent.document, today),
    id: `op-${Date.now()}`,
    proposal: `#${borderoSequence}`,
    aditivoNumber,
    borderoNumber,
    institution: destination.institution,
    vehicle: destination.name,
    source,
    operationType,
    cedent: cedent.name,
    document: cedent.document,
    risk: cedent.score >= 700 ? "Baixo" : cedent.score >= 600 ? "Médio" : "Alto",
    amount: 0,
    netAmount: 0,
    titleCount: 0,
    stage: 1,
    status: "Em andamento",
    blockers: 0,
    alerts: cedent.incidents,
    enteredAt: "Agora",
    waitingFor: "agora",
    elapsedMinutes: 0,
    clientAverageMinutes: 0,
    historySample: 0,
    nextAction: nextActions[source],
    policy:
      destination.institution === "FIDC"
        ? "Política do fundo selecionado"
        : destination.institution === "Securitizadora"
          ? "Política comercial da securitizadora"
          : "Política de fomento com regresso",
    fundClass: destination.institution === "FIDC" ? destination.detail : undefined,
    participants:
      destination.institution === "FIDC" ? ["Gestora Atlas", "Adm. Fiduciário Orbe", "Custodiante Nexus"] : undefined,
  };
}

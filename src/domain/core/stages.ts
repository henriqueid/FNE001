/**
 * As seis etapas da esteira de operação, na ordem em que são concluídas.
 */
import { type Stage } from "./types";
export const stages: Stage[] = [
  {
    id: 1,
    short: "Entrada",
    title: "Entrada e pré-validação",
    description: "Recebíveis, documentos fiscais e duplicidade",
  },
  { id: 2, short: "Risco", title: "Risco e elegibilidade", description: "Cedente, sacados, histórico e decisões" },
  { id: 3, short: "Lastro", title: "Lastro e confirmação", description: "Evidências, amostra e confirmação do sacado" },
  { id: 4, short: "Preço", title: "Preço e estrutura", description: "Deságio, tarifas, retenções e condições" },
  { id: 5, short: "Aprovação", title: "Aprovação e formalização", description: "Alçadas, documentos e assinaturas" },
  {
    id: 6,
    short: "Liberação",
    title: "Liberação e pagamento",
    description: "Favorecidos, conferências e envio ao financeiro",
  },
];

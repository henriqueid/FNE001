/** Formatações compartilhadas pelas abas do Cadastro. */
import { scoreBand } from "@/src/domain/eligibility/operational-parameters";

/** Classe de cor do score: sem score (conta nova), bom, atenção ou crítico. */
export const scoreTone = (score: number) =>
  score === 0 ? "" : { Positivo: "good", Atenção: "warn", Crítico: "bad", Novo: "" }[scoreBand(score)];

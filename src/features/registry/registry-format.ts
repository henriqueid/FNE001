/** Formatações compartilhadas pelas abas do Cadastro. */
import { scoreBand, type ScoreBand } from "@/src/domain/eligibility/operational-parameters";

/**
 * Classifica a pessoa para exibição. Nos adaptadores do Cadastro, score zero representa
 * uma conta nova ainda não avaliada (e não uma conta na faixa crítica).
 */
export const scoreClassification = (score: number | undefined | null): ScoreBand =>
  score == null || score <= 0 ? "Novo" : scoreBand(score);

/** Classe de cor do score: sem score (conta nova), bom, atenção ou crítico. */
export const scoreTone = (score: number) =>
  ({ Positivo: "good", Atenção: "warn", Crítico: "bad", Novo: "" })[scoreClassification(score)];

/** Tom equivalente para os chips do design system. */
export const scoreChipTone = (score: number | undefined | null) =>
  ({ Positivo: "ok", Atenção: "warn", Crítico: "bad", Novo: "muted" })[scoreClassification(score)];

/** Formatações compartilhadas pelas abas do Cadastro. */

/** Classe de cor do score: sem score (conta nova), bom, atenção ou crítico. */
export const scoreTone = (score: number) => (score === 0 ? "" : score >= 700 ? "good" : score >= 600 ? "warn" : "bad");

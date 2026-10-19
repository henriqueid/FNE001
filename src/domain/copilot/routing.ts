/** Somente perguntas explicitamente sobre simulação/lote usam o estado local da Mesa. */
import { normalizedQuestion } from "./analytics";
export function isDeskQuestion(question: string) {
  return /cenario|lote|duplicad|retir|remov|recoloc|simul|enquadr|apontamento|inclu.*titulo|taxa.*\d/.test(
    normalizedQuestion(question),
  );
}

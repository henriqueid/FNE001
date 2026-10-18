/** Expõe regras cadastradas e vigentes, sem completar lacunas com parâmetros de demonstração. */
import type { EligibilityPolicy, MasterRule } from "@/src/domain/eligibility/model";
import { formatEligibilityValue } from "@/src/domain/eligibility/engine";
import type { DeskReply } from "./desk-assistant";
import { normalizedQuestion } from "./analytics";
export function answerAuthorizedPolicy(
  question: string,
  policies: EligibilityPolicy[],
  rules: MasterRule[],
  today: string,
): DeskReply {
  const q = normalizedQuestion(question);
  const topics = [
    /concentra/.test(q) ? "concentra" : "",
    /taxa|piso/.test(q) ? "taxa" : "",
    /prazo/.test(q) ? "prazo" : "",
    /score/.test(q) ? "score" : "",
    /lastro/.test(q) ? "lastro" : "",
  ].filter(Boolean);
  const active = policies.filter(
    policy =>
      policy.status === "ATIVA" &&
      policy.effectiveFrom <= today &&
      (!policy.effectiveTo || policy.effectiveTo >= today),
  );
  const rows = active.flatMap(policy =>
    policy.bindings
      .filter(binding => binding.enabled)
      .flatMap(binding => {
        const rule = rules.find(rule => rule.id === binding.ruleId);
        if (!rule) return [];
        const searchable = normalizedQuestion(`${rule.name} ${rule.description} ${rule.variable}`);
        if (topics.length && !topics.every(topic => searchable.includes(topic))) return [];
        return [
          [
            rule.name,
            `${binding.operator ?? rule.defaultOperator} ${formatEligibilityValue(binding.parameter, rule.variable)}`,
            binding.failureOutcome,
            binding.overrideAuthority ?? "Sem exceção configurada",
            `${policy.name} · ${policy.version} · ${policy.company ?? "Escopo não informado"}`,
          ],
        ];
      }),
  );
  return {
    tool: "consultar_politica(fonte=politicas_persistidas)",
    paragraphs: rows.length
      ? [
          `${rows.length} regra(s) cadastrada(s) e vigente(s) no seu escopo. A aplicação a uma operação depende do motor de elegibilidade e de seus vínculos; esta consulta não concede aprovação.`,
        ]
      : [
          "Não há regra cadastrada e vigente para esse tema no seu escopo. Parâmetros legados ou de demonstração não serão apresentados como política do cliente.",
        ],
    table: rows.length
      ? { head: ["Regra", "Condição", "Resultado da falha", "Alçada", "Política / versão"], rows }
      : undefined,
  };
}

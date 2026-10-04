"use client";

import { useIntegrations } from "@/src/app/integration-context";
import { type Cedent, type Debtor, type Operation } from "@/src/domain/core/types";
import { buildEnrichmentSnapshot } from "@/src/domain/integrations/enrichment";
import { useEffect, useMemo, useState } from "react";

const provenanceLabel = {
  INTERNO: "Dado interno",
  DEMONSTRACAO: "Demonstração",
  OFICIAL: "Fonte oficial",
  PENDENTE: "Pendente",
  INDISPONIVEL: "Indisponível",
};

export function EnrichmentPanel({
  operation,
  debtors,
  cedent,
  onChange,
}: {
  operation: Operation;
  debtors: Debtor[];
  cedent?: Cedent;
  onChange: (operation: Operation) => void;
}) {
  const integrations = useIntegrations();
  const [expanded, setExpanded] = useState(false);
  const calculated = useMemo(
    () => buildEnrichmentSnapshot({ operation, debtors, cedent, integrations }),
    [operation, debtors, cedent, integrations],
  );
  const snapshot = operation.enrichmentReview?.snapshot ?? calculated;
  const inputsChanged = Boolean(
    operation.enrichmentReview && snapshot.configurationFingerprint !== calculated.configurationFingerprint,
  );

  useEffect(() => {
    if (operation.stage !== 2 || operation.enrichmentReview) return;
    onChange({ ...operation, enrichmentReview: { snapshot: calculated, history: [] } });
  }, [calculated, onChange, operation]);

  const rerun = () => {
    const next = buildEnrichmentSnapshot({ operation, debtors, cedent, integrations });
    onChange({
      ...operation,
      enrichmentReview: {
        snapshot: next,
        history: [...(operation.enrichmentReview?.history ?? []), snapshot],
      },
    });
  };

  const pending = snapshot.summary.PENDENTE + snapshot.summary.INDISPONIVEL;
  const trusted = snapshot.summary.INTERNO + snapshot.summary.OFICIAL;
  const createdAt = new Intl.DateTimeFormat("pt-BR", { dateStyle: "short", timeStyle: "short" }).format(
    new Date(snapshot.createdAt),
  );

  return (
    <section className={`enrichment-panel ${expanded ? "expanded" : ""}`}>
      <button
        type="button"
        className="enrichment-summary"
        onClick={() => setExpanded(current => !current)}
        aria-expanded={expanded}
      >
        <span className="enrichment-chevron" aria-hidden="true">
          ›
        </span>
        <span className="enrichment-title">
          <small>HUB DE ENRIQUECIMENTO</small>
          <strong>Fontes e qualidade dos dados</strong>
          <em>Fotografia {createdAt}</em>
        </span>
        <span className="enrichment-metrics">
          <b>{trusted}</b>
          <small>confirmados</small>
        </span>
        <span className="enrichment-metrics demo">
          <b>{snapshot.summary.DEMONSTRACAO}</b>
          <small>demonstração</small>
        </span>
        <span className={`enrichment-metrics ${pending ? "pending" : ""}`}>
          <b>{pending}</b>
          <small>pendências</small>
        </span>
        <span className="enrichment-open">{expanded ? "Fechar" : "Ver fontes"}</span>
      </button>

      {expanded && (
        <div className="enrichment-details">
          <div className="enrichment-notice">
            <div>
              <strong>Origem identificada em cada evidência</strong>
              <p>Dados demonstrativos ajudam a validar o fluxo, mas não são tratados como consultas oficiais.</p>
            </div>
            {inputsChanged && <span>A configuração ou os dados mudaram após esta fotografia.</span>}
            <button type="button" onClick={rerun}>
              {inputsChanged ? "Executar novamente" : "Atualizar fotografia"}
            </button>
          </div>
          <div className="enrichment-checks">
            {snapshot.checks.map(check => (
              <article key={check.id} className={`enrichment-check ${check.provenance.toLowerCase()}`}>
                <div>
                  <span>
                    {check.source} · {check.subject}
                  </span>
                  <strong>{check.label}</strong>
                  <p>{check.value}</p>
                </div>
                <div className="enrichment-evidence">
                  <b>{provenanceLabel[check.provenance]}</b>
                  <small>{check.evidence}</small>
                </div>
              </article>
            ))}
          </div>
          {(operation.enrichmentReview?.history?.length ?? 0) > 0 && (
            <small className="enrichment-history">
              {operation.enrichmentReview?.history?.length} fotografia(s) anterior(es) preservada(s) para auditoria.
            </small>
          )}
        </div>
      )}
    </section>
  );
}

"use client";

/** Análise em tela do snapshot: fatos, comportamento, aprendizado e revisão explícita. */
import { useEffect, useRef, useState } from "react";
import type { CopilotReport as Report } from "@/src/domain/copilot/report";
import type { DeskReply } from "@/src/domain/copilot/desk-assistant";
import type { AccessUser } from "@/src/domain/access/model";
import { askConfiguredCopilot, loadCopilotReport, loadCopilotMemories } from "@/src/app/intelligence-client";
import type { BehaviorEvent } from "@/src/domain/copilot/behavior";
import { CloseIcon } from "@/src/ui/icons";
import { CopilotMemory } from "./copilot-memory";

export function CopilotReport({
  reply,
  currentUser,
  onClose,
}: {
  reply: DeskReply;
  currentUser: AccessUser;
  onClose: () => void;
}) {
  const modal = useRef<HTMLDialogElement>(null);
  const [report, setReport] = useState<Report>();
  const [tab, setTab] = useState("data");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [page, setPage] = useState(0);
  const [company, setCompany] = useState("");
  const [document, setDocument] = useState("");
  const [memories, setMemories] = useState<BehaviorEvent[]>([]);
  useEffect(() => {
    modal.current?.showModal();
    let live = true;
    if (reply.report)
      void loadCopilotReport(reply.report.id)
        .then(value => {
          if (live) {
            setReport(value);
            setCompany(value.filters?.company ?? "");
            setDocument(value.filters?.document ?? value.queryEntityDocument ?? "");
          }
        })
        .catch(reason => {
          if (live) setError(reason instanceof Error ? reason.message : "Não foi possível abrir a análise.");
        });
    return () => {
      live = false;
    };
  }, [reply]);
  const loadMemory = async () => {
    try {
      setMemories(await loadCopilotMemories());
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível carregar as memórias.");
    }
  };
  const refresh = async () => {
    if (!report) return;
    setBusy(true);
    setError("");
    try {
      const question = report.resolvedQuestion ?? report.question;
      const result = await askConfiguredCopilot(question, undefined, {
        allowInterpretation: false,
        refreshReportId: report.queryKey ? report.id : undefined,
        filters: { company, document },
      });
      if (result.reply.report) {
        setReport(await loadCopilotReport(result.reply.report.id));
        setPage(0);
      }
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível atualizar a análise.");
    } finally {
      setBusy(false);
    }
  };
  const events = report
    ? [
        ...new Map(
          [...report.behavior, ...memories.filter(event => report.entityRefs.includes(event.entityId))].map(event => [
            event.id,
            event,
          ]),
        ).values(),
      ]
    : [];
  const rows = report?.table?.rows ?? reply.table?.rows ?? [];
  const head = report?.table?.head ?? reply.table?.head ?? [];
  return (
    <dialog
      ref={modal}
      className="cpl-report-modal"
      aria-labelledby="copilot-report-heading"
      onCancel={onClose}
      onClose={onClose}
    >
      <header className="cpl-report-header">
        <div>
          <small>STRATO · ANÁLISE COM EVIDÊNCIAS</small>
          <h2 id="copilot-report-heading">{report?.title ?? reply.report?.title ?? "Detalhes da resposta"}</h2>
        </div>
        <button type="button" className="cpl-icon" onClick={onClose} aria-label="Fechar análise">
          <CloseIcon />
        </button>
      </header>
      <div className="cpl-report-content">
        {error && <p role="alert">{error}</p>}
        {reply.report && !report && !error && <p role="status">Carregando e verificando seu acesso…</p>}
        {(!reply.report || report) && (
          <>
            <p className="cpl-note">
              {report
                ? `Consulta: ${report.question}. Referência ${report.referenceDate.split("-").reverse().join("/")}${report.positionDate ? ` · posição importada ${report.positionDate.split("-").reverse().join("/")}` : ""}. Gerada em ${new Date(report.createdAt).toLocaleString("pt-BR")}.`
                : "Resposta local da sessão atual; não representa consulta completa ao servidor."}
            </p>
            <p>
              {report?.criterion ??
                "Valores e regras da resposta original. Consulte os controles da operação antes de agir."}
            </p>
            {(report?.paragraphs ?? reply.paragraphs).map((text, index) => (
              <p key={index}>{text}</p>
            ))}
            {report && (
              <dl className="cpl-report-metrics">
                {report.metrics.map(metric => (
                  <div key={metric.label}>
                    <dt>{metric.label}</dt>
                    <dd>{metric.value}</dd>
                  </div>
                ))}
              </dl>
            )}
            {report && (report.queryKey || report.source === "behavior") && (
              <form
                className="cpl-report-filters"
                onSubmit={event => {
                  event.preventDefault();
                  void refresh();
                }}
              >
                <label>
                  Empresa
                  <select value={company} onChange={event => setCompany(event.target.value)}>
                    <option value="">Todas do meu acesso</option>
                    {report.availableCompanies?.map(name => (
                      <option key={name}>{name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  CPF/CNPJ do sacado ou cedente
                  <input
                    value={document}
                    onChange={event => setDocument(event.target.value)}
                    maxLength={30}
                    placeholder="Todos os documentos"
                  />
                </label>
                <button type="submit" className="cpl-primary" disabled={busy}>
                  {busy ? "Consultando…" : "Consultar posição atual"}
                </button>
              </form>
            )}
            <nav className="cpl-report-tabs" aria-label="Camadas da análise">
              {[
                { id: "data", label: "Dados e fontes" },
                { id: "behavior", label: `Comportamento (${events.length})` },
                { id: "learning", label: `Aprendizado (${report?.learnings.length ?? 0})` },
              ].map(item => (
                <button
                  type="button"
                  key={item.id}
                  aria-pressed={tab === item.id}
                  onClick={() => {
                    setTab(item.id);
                    if (item.id === "behavior") void loadMemory();
                  }}
                >
                  {item.label}
                </button>
              ))}
            </nav>
            {tab === "data" && (
              <>
                {report?.marketSource && (
                  <p>
                    Fonte autorizada:{" "}
                    <a href={report.marketSource.url} target="_blank" rel="noreferrer">
                      {report.marketSource.name}
                    </a>{" "}
                    · {report.marketSource.date} · {report.marketSource.unit}
                  </p>
                )}
                {head.length > 0 && (
                  <div className="cpl-table">
                    <table>
                      <thead>
                        <tr>
                          {head.map((cell, index) => (
                            <th key={index} scope="col">
                              {cell}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {rows.slice(page * 50, (page + 1) * 50).map((row, index) => (
                          <tr key={`${page}-${index}`}>
                            {row.map((cell, col) => (
                              <td key={col}>{cell}</td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
                {rows.length > 50 && (
                  <div className="cpl-report-pagination">
                    <button type="button" disabled={!page} onClick={() => setPage(value => value - 1)}>
                      Anterior
                    </button>
                    <span>
                      Página {page + 1} de {Math.ceil(rows.length / 50)} · {rows.length} linhas
                    </span>
                    <button
                      type="button"
                      disabled={(page + 1) * 50 >= rows.length}
                      onClick={() => setPage(value => value + 1)}
                    >
                      Próxima
                    </button>
                  </div>
                )}
                {report && (
                  <details>
                    <summary>Fontes e registros da análise ({report.entityRefs.length})</summary>
                    <p>Empresas: {report.companies.join(", ") || "Nenhum registro de negócio utilizado"}.</p>
                    <ul>
                      {report.entities?.map(entity => (
                        <li key={entity.id}>
                          {entity.label} · {entity.company}
                        </li>
                      ))}
                    </ul>
                  </details>
                )}
              </>
            )}
            {tab === "behavior" && report && (
              <CopilotMemory report={report} events={events} user={currentUser} onSaved={loadMemory} />
            )}
            {tab === "learning" && (
              <section aria-label="Aprendizado utilizado">
                <p>
                  Esta é a memória utilizada na data da resposta. Atualize a consulta para incorporar revisões e novos
                  resultados. Ela não muda políticas nem alçadas.
                </p>
                {report?.learnings.length ? (
                  report.learnings.map(item => (
                    <article className="cpl-memory-event" key={item.id}>
                      <b>
                        {item.kind === "interpretation"
                          ? "Interpretação revisada"
                          : item.kind === "guidance"
                            ? "Orientação revisada"
                            : "Resultado observado"}
                      </b>
                      <p>{item.text}</p>
                      <small>
                        Amostra: {item.sampleSize} · Evidências: {item.evidenceRefs.join(", ")}
                      </small>
                    </article>
                  ))
                ) : (
                  <p>Ainda não há evidências suficientes para aprendizado neste recorte.</p>
                )}
              </section>
            )}
            {report && (
              <details>
                <summary>Limitações e critérios de confiança</summary>
                <ul>
                  {report.warnings.map((text, index) => (
                    <li key={index}>{text}</li>
                  ))}
                </ul>
              </details>
            )}
          </>
        )}
      </div>
    </dialog>
  );
}

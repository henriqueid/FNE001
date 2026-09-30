"use client";

/**
 * Importação do plano de contas (CSV): leitura, validação, de-para das contas em uso e aplicação.
 */
import { useMemo, useState } from "react";
import {
  applyChartImport,
  buildMapping,
  chartToCsv,
  mappingProblems,
  parseChartCsv,
  type ImportMode,
  type ParsedChart,
} from "@/src/domain/finance/chart-import";
import type { FinanceState } from "@/src/domain/finance/model";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";
import { BY, Modal } from "./finance-ui";

type Apply = (r: { state: FinanceState; error?: string; message?: string }) => void;

export function downloadCsv(name: string, content: string) {
  const url = URL.createObjectURL(new Blob([content], { type: "text/csv;charset=utf-8" }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const useLabel: Record<string, string> = {
  role: "Conta-chave",
  banco: "Banco",
  categoria: "Categoria",
  lancamentos: "Lançamentos",
  titulos: "Títulos",
};

export function ChartImportModal({
  state,
  onClose,
  onApply,
}: {
  state: FinanceState;
  onClose: () => void;
  onApply: Apply;
}) {
  const [file, setFile] = useState("");
  const [parsed, setParsed] = useState<ParsedChart | null>(null);
  const [mode, setMode] = useState<ImportMode>("substituir");
  const [mapping, setMapping] = useState<Record<string, string>>({});
  const [showWarnings, setShowWarnings] = useState(false);
  const [onlyPending, setOnlyPending] = useState(false);

  const rows = useMemo(
    () => (parsed && !parsed.errors.length ? buildMapping(state, parsed.accounts) : []),
    [state, parsed],
  );
  const problems = useMemo(
    () => (parsed && mode === "substituir" ? mappingProblems(state, parsed.accounts, rows, mapping) : []),
    [state, parsed, rows, mapping, mode],
  );
  const fresh = parsed ? parsed.accounts.filter(a => !state.chart.some(c => c.code === a.code)).length : 0;

  async function onFile(f: File) {
    const buf = await f.arrayBuffer();
    let text = new TextDecoder("utf-8").decode(buf);
    if (text.includes("\uFFFD")) text = new TextDecoder("windows-1252").decode(buf); // planilhas salvas no Excel em ANSI
    const p = parseChartCsv(text);
    setFile(f.name);
    setParsed(p);
    setShowWarnings(false);
    const m: Record<string, string> = {};
    if (!p.errors.length)
      buildMapping(state, p.accounts).forEach(r => {
        if (r.suggestion) m[r.from] = r.suggestion;
      });
    setMapping(m);
  }

  const synthetic = parsed?.accounts.filter(a => !a.analytic).length ?? 0;
  const analytic = parsed?.accounts.filter(a => a.analytic).length ?? 0;
  const pending = rows.filter(r => !mapping[r.from]).length;
  const canImport = Boolean(parsed && !parsed.errors.length && (mode === "acrescentar" ? fresh > 0 : !problems.length));

  const footer = (
    <>
      <button className="fn-btn ghost" onClick={onClose}>
        Cancelar
      </button>
      <button
        className="fn-btn primary"
        disabled={!canImport}
        onClick={() => {
          if (!parsed) return;
          const r = applyChartImport(state, { accounts: parsed.accounts, mode, mapping, file }, BY);
          onApply(r);
          if (!r.error) onClose();
        }}
      >
        {mode === "acrescentar" ? `Acrescentar ${fresh} conta(s)` : `Importar ${parsed?.accounts.length ?? 0} contas`}
      </button>
    </>
  );

  return (
    <Modal
      wide
      title="Importar plano de contas"
      subtitle="Leiaute padrão Strato em CSV · o sistema valida a hierarquia e cadastra as contas automaticamente"
      onClose={onClose}
      footer={footer}
    >
      <div className="fn-ci">
        <section className="fn-ci-step">
          <header>
            <b>1</b>
            <div>
              <h3>Arquivo</h3>
              <p>Uma linha por conta. Separador ponto e vírgula (também aceita vírgula ou tab). Cabeçalho opcional.</p>
            </div>
          </header>
          <table className="fn-ci-layout">
            <thead>
              <tr>
                <th>Coluna</th>
                <th>Obrigatória</th>
                <th>Como preencher</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>codigo</td>
                <td>Sim</td>
                <td>Números separados por ponto: 1, 1.1, 1.1.2.01</td>
              </tr>
              <tr>
                <td>descricao</td>
                <td>Sim</td>
                <td>Nome da conta</td>
              </tr>
              <tr>
                <td>natureza</td>
                <td>Nas contas de 1º nível</td>
                <td>
                  Ativo, Passivo, Patrimônio líquido, Receita ou Despesa (ou 1 a 5). Vazio herda da conta superior
                </td>
              </tr>
              <tr>
                <td>tipo</td>
                <td>Não</td>
                <td>S (sintética) ou A (analítica). Vazio: sintética se tiver subcontas</td>
              </tr>
              <tr>
                <td>codigo_reduzido</td>
                <td>Não</td>
                <td>Código curto usado pelo contador</td>
              </tr>
              <tr>
                <td>conta_referencial</td>
                <td>Não</td>
                <td>Conta referencial do SPED, para a exportação contábil</td>
              </tr>
            </tbody>
          </table>
          <div className="fn-ci-actions">
            <label className="fn-btn primary fn-file">
              {file ? "Escolher outro arquivo" : "Escolher arquivo CSV"}
              <input
                type="file"
                accept=".csv,.txt,text/csv"
                onChange={e => {
                  const f = e.target.files?.[0];
                  if (f) onFile(f);
                  e.currentTarget.value = "";
                }}
              />
            </label>
            <button
              className="fn-btn ghost"
              onClick={() => downloadCsv("modelo-plano-de-contas-strato.csv", chartToCsv())}
            >
              Baixar modelo preenchido
            </button>
            {file && <span className="fn-ci-file">{file}</span>}
          </div>
        </section>

        {parsed && (
          <section className="fn-ci-step">
            <header>
              <b>2</b>
              <div>
                <h3>Validação</h3>
                <p>{parsed.lines} linha(s) lida(s)</p>
              </div>
            </header>
            <div className="fn-ci-kpis">
              <div>
                <span>Contas</span>
                <strong>{parsed.accounts.length}</strong>
              </div>
              <div>
                <span>Sintéticas</span>
                <strong>{synthetic}</strong>
              </div>
              <div>
                <span>Analíticas</span>
                <strong>{analytic}</strong>
              </div>
              <div className={parsed.errors.length ? "bad" : "ok"}>
                <span>Erros</span>
                <strong>{parsed.errors.length}</strong>
              </div>
              <div className={parsed.warnings.length ? "warn" : ""}>
                <span>Avisos</span>
                <strong>{parsed.warnings.length}</strong>
              </div>
            </div>
            {parsed.errors.length > 0 && (
              <>
                <p className="fn-warning">
                  <AlertIcon /> Corrija o arquivo e importe de novo. Nenhuma conta foi cadastrada.
                </p>
                <div className="fn-table-scroll fn-ci-issues">
                  <table className="fn-table">
                    <thead>
                      <tr>
                        <th>Linha</th>
                        <th>Conta</th>
                        <th>Problema</th>
                      </tr>
                    </thead>
                    <tbody>
                      {parsed.errors.slice(0, 200).map((e, i) => (
                        <tr key={i}>
                          <td>{e.line || "—"}</td>
                          <td>
                            <b>{e.code ?? ""}</b>
                          </td>
                          <td>{e.message}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
            {!parsed.errors.length && (
              <p className="fn-ci-ok">
                <CheckIcon /> Estrutura válida: códigos únicos, toda conta tem a sua superior e as analíticas não têm
                subcontas.
              </p>
            )}
            {parsed.warnings.length > 0 && (
              <>
                <button className="fn-btn link" onClick={() => setShowWarnings(!showWarnings)}>
                  {showWarnings ? "Ocultar avisos" : `Ver ${parsed.warnings.length} aviso(s)`}
                </button>
                {showWarnings && (
                  <ul className="fn-ci-warnings">
                    {parsed.warnings.map((w, i) => (
                      <li key={i}>
                        {w.line ? (
                          <b>
                            Linha {w.line} · {w.code}{" "}
                          </b>
                        ) : null}
                        {w.message}
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </section>
        )}

        {parsed && !parsed.errors.length && (
          <section className="fn-ci-step">
            <header>
              <b>3</b>
              <div>
                <h3>Como aplicar</h3>
              </div>
            </header>
            <div className="fn-ci-modes">
              <label className={mode === "substituir" ? "active" : ""}>
                <input type="radio" checked={mode === "substituir"} onChange={() => setMode("substituir")} />
                <div>
                  <b>Substituir o plano atual</b>
                  <small>
                    O plano do arquivo passa a ser o oficial. As contas em uso são reclassificadas pelo de-para abaixo;
                    cada lançamento guarda a conta original.
                  </small>
                </div>
              </label>
              <label className={mode === "acrescentar" ? "active" : ""}>
                <input type="radio" checked={mode === "acrescentar"} onChange={() => setMode("acrescentar")} />
                <div>
                  <b>Acrescentar ao plano atual</b>
                  <small>Cadastra só as contas novas ({fresh}). Os códigos que já existem ficam como estão.</small>
                </div>
              </label>
            </div>
          </section>
        )}

        {parsed && !parsed.errors.length && mode === "substituir" && (
          <section className="fn-ci-step">
            <header>
              <b>4</b>
              <div>
                <h3>De-para das contas em uso</h3>
                <p>
                  {rows.length} conta(s) do plano atual são usadas pelo sistema.{" "}
                  {pending
                    ? `${pending} sem correspondência sugerida.`
                    : "Todas têm sugestão; confira antes de importar."}
                </p>
              </div>
              <label className="fn-ci-filter">
                <input type="checkbox" checked={onlyPending} onChange={e => setOnlyPending(e.target.checked)} /> Só
                pendentes
              </label>
            </header>
            <div className="fn-table-scroll fn-ci-map">
              <table className="fn-table">
                <thead>
                  <tr>
                    <th>Conta atual</th>
                    <th>Onde é usada</th>
                    <th>Conta no plano importado</th>
                  </tr>
                </thead>
                <tbody>
                  {rows
                    .filter(r => !onlyPending || !mapping[r.from])
                    .map(r => {
                      const options = parsed.accounts.filter(a => a.analytic === r.analytic && a.nature === r.nature);
                      return (
                        <tr key={r.from} className={mapping[r.from] ? "" : "pending"}>
                          <td>
                            <b>{r.from}</b> {r.fromName}
                            <small>
                              {r.nature}
                              {r.analytic ? "" : " · sintética"}
                            </small>
                          </td>
                          <td>
                            <div className="fn-ci-uses">
                              {r.uses.slice(0, 4).map((u, i) => (
                                <span
                                  key={i}
                                  className={`fn-chip ${u.kind === "role" ? "warn" : ""}`}
                                  title={useLabel[u.kind]}
                                >
                                  {u.kind === "role" ? `Chave: ${u.label}` : u.label}
                                </span>
                              ))}
                              {r.uses.length > 4 && <span className="fn-chip">+{r.uses.length - 4}</span>}
                            </div>
                          </td>
                          <td>
                            <select
                              value={mapping[r.from] ?? ""}
                              onChange={e => setMapping({ ...mapping, [r.from]: e.target.value })}
                            >
                              <option value="">Escolha…</option>
                              {options.map(o => (
                                <option key={o.code} value={o.code}>
                                  {o.code} {o.name}
                                </option>
                              ))}
                            </select>
                            {mapping[r.from] && mapping[r.from] === r.suggestion && r.how && (
                              <small>Sugerida por {r.how}</small>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
            {problems.length > 0 && (
              <p className="fn-warning">
                <AlertIcon /> {problems.length} pendência(s): {problems[0]}
              </p>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}

"use client";

/**
 * Nova operação: cedente obrigatório (com comercial, score e limite), origem dos títulos e destino.
 */
import { RegistryContext, useCedents } from "@/src/app/registry-context";
import { destinations } from "@/src/domain/core/demo/companies";
import { preciseMoney } from "@/src/domain/core/format";
import {
  type Cedent,
  type Debtor,
  type Destination,
  type EntryIntake,
  type ManualEntryData,
  type Operation,
  type OperationSource,
} from "@/src/domain/core/types";
import { intakeCsvTemplate, normalizeOperationIntake } from "@/src/domain/operations/intake";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, ArrowIcon, CheckIcon, CloseIcon, SparkIcon } from "@/src/ui/icons";
import { useContext, useState } from "react";
import { scoreBand } from "@/src/domain/eligibility/operational-parameters";
import { saveFile } from "@/src/ui/download";

export type NewOperationInput = {
  source: OperationSource;
  operationType: string;
  destination: Destination;
  cedent: Cedent;
  importedData?: ManualEntryData;
  entryIntake?: EntryIntake;
};

export const sourceOptions: { source: OperationSource; label: string; description: string; tag: string }[] = [
  {
    source: "XML NF-e",
    label: "Importar XML",
    description: "Notas fiscais e duplicatas identificadas automaticamente",
    tag: "XML",
  },
  {
    source: "CNAB",
    label: "Importar CNAB",
    description: "Arquivo bancário, carteira de títulos ou borderô",
    tag: "CNAB",
  },
  {
    source: "Planilha",
    label: "Importar planilha",
    description: "Arquivo CSV ou XLSX no leiaute da empresa",
    tag: "XLSX",
  },
  {
    source: "Digitação manual",
    label: "Digitação manual",
    description: "Duplicata, cheque, promissória, transferibilidade ou garantia",
    tag: "DIG",
  },
  {
    source: "Crédito estruturado",
    label: "Crédito estruturado",
    description: "CCB, contrato, cronograma e garantias",
    tag: "CCB",
  },
];

export function NewOperationModal({
  onClose,
  onCreate,
  defaultDestination,
  operations,
  debtors,
}: {
  onClose: () => void;
  onCreate: (input: NewOperationInput) => void;
  defaultDestination?: string;
  operations: Operation[];
  debtors: Debtor[];
}) {
  const registryCedents = useCedents();
  const registry = useContext(RegistryContext);
  const [source, setSource] = useState<OperationSource>("XML NF-e");
  const [destinationName, setDestinationName] = useState(
    defaultDestination && defaultDestination !== "Consolidado" ? defaultDestination : destinations[0].name,
  );
  const [cedentId, setCedentId] = useState("");
  const [analysis, setAnalysis] = useState<{ data: ManualEntryData; intake: EntryIntake } | null>(null);
  const [readingFile, setReadingFile] = useState(false);
  const requiresFile = source === "XML NF-e" || source === "CNAB" || source === "Planilha";
  const detectedType =
    source === "XML NF-e"
      ? "Duplicata mercantil com NF-e"
      : source === "CNAB"
        ? "Carteira de títulos em CNAB"
        : source === "Planilha"
          ? "Duplicatas em leiaute validado"
          : source === "Crédito estruturado"
            ? "CCB"
            : "A definir na digitação";
  const destination = destinations.find(item => item.name === destinationName) ?? destinations[0];
  const cedent = registryCedents.find(item => item.id === cedentId);

  function chooseSource(next: OperationSource) {
    setSource(next);
    setAnalysis(null);
  }

  async function analyzeFile(file?: File) {
    if (!file) return;
    setReadingFile(true);
    try {
      const text = await file.text();
      const knownTitles = operations.flatMap(operation => operation.manualEntry?.entries ?? []);
      setAnalysis(
        normalizeOperationIntake({
          source,
          fileName: file.name,
          text,
          debtors,
          knownTitles,
          importedAt: new Date().toISOString(),
        }),
      );
    } finally {
      setReadingFile(false);
    }
  }

  function downloadTemplate() {
    void saveFile("modelo-importacao-operacao.csv", intakeCsvTemplate());
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={e => e.currentTarget === e.target && onClose()}>
      <section className="new-modal" role="dialog" aria-modal="true" aria-label="Nova operação">
        <div className="modal-head">
          <div>
            <Badge tone="eyebrow">NOVA OPERAÇÃO</Badge>
            <h2>Como deseja iniciar esta operação?</h2>
            <p>Escolha a origem. A STRATO identifica o tipo e aplica as regras da empresa de destino.</p>
          </div>
          <button onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <div className="new-cedent-step">
          <div>
            <span>1 · CEDENTE DA OPERAÇÃO</span>
            <strong>Quem está cedendo os recebíveis?</strong>
            <small>O risco, o limite e os apontamentos são carregados antes da entrada dos títulos.</small>
          </div>
          <label>
            <select
              aria-label="Selecionar cedente"
              value={cedentId}
              onChange={event => setCedentId(event.target.value)}
            >
              <option value="">Selecione o cedente</option>
              {registryCedents.map(item => (
                <option value={item.id} key={item.id}>
                  {item.name} · {item.document}
                </option>
              ))}
            </select>
          </label>
          {cedent && (
            <div className="cedent-quick-risk">
              <span>
                <b>{registry?.repOf(cedent.document)?.name ?? "Sem comercial"}</b>
                <small>Comercial responsável</small>
              </span>
              <span>
                <b>{registry?.managerOf(cedent.document)?.name ?? "Sem gerente"}</b>
                <small>Operações e pós-venda</small>
              </span>
              <span>
                <b>Score {cedent.score}</b>
                <small>
                  {scoreBand(cedent.score) === "Positivo"
                    ? "Faixa positiva"
                    : scoreBand(cedent.score) === "Atenção"
                      ? "Faixa de atenção"
                      : "Faixa crítica"}
                </small>
              </span>
              <span>
                <b>{preciseMoney.format(cedent.creditLimit - cedent.usedLimit)}</b>
                <small>Limite disponível</small>
              </span>
              <Badge tone={cedent.incidents ? "attention" : "ready"}>
                {cedent.incidents ? `${cedent.incidents} apontamento(s)` : "Sem apontamentos"}
              </Badge>
            </div>
          )}
        </div>
        <div className="source-options">
          {sourceOptions.map(option => (
            <button
              className={source === option.source ? "selected" : ""}
              onClick={() => chooseSource(option.source)}
              key={option.source}
            >
              <span className="source-tag">{option.tag}</span>
              <div>
                <strong>{option.label}</strong>
                <small>{option.description}</small>
              </div>
              <span className="radio">
                <i />
              </span>
            </button>
          ))}
        </div>
        <div className="operation-origin-panel">
          {requiresFile ? (
            <div className="intake-import-workbench">
              <div className="file-import">
                <div>
                  <strong>Arquivo da operação</strong>
                  <small>
                    {source === "XML NF-e"
                      ? "Selecione um arquivo .xml com NF-e e duplicatas"
                      : source === "CNAB"
                        ? "Selecione o CNAB; o leiaute precisa estar configurado"
                        : "CSV é processado agora; XLSX exige conversão para CSV nesta implantação"}
                  </small>
                </div>
                <div className="intake-file-actions">
                  {source === "Planilha" && (
                    <button type="button" className="secondary-action" onClick={downloadTemplate}>
                      Baixar modelo CSV
                    </button>
                  )}
                  <label className="secondary-action intake-file-picker">
                    {readingFile ? "Analisando..." : analysis ? "Trocar arquivo" : "Selecionar arquivo"}
                    <input
                      type="file"
                      accept={
                        source === "XML NF-e"
                          ? ".xml,text/xml"
                          : source === "Planilha"
                            ? ".csv,.xlsx,text/csv"
                            : ".rem,.ret,.cnab,.txt,.csv"
                      }
                      disabled={readingFile}
                      onChange={event => void analyzeFile(event.target.files?.[0])}
                    />
                  </label>
                </div>
              </div>
              {analysis && (
                <div className={`intake-analysis ${analysis.intake.status.toLocaleLowerCase()}`}>
                  <div className="intake-analysis-head">
                    <span>{analysis.intake.status === "PRONTO" ? <CheckIcon /> : <AlertIcon />}</span>
                    <div>
                      <strong>{analysis.intake.fileName}</strong>
                      <small>
                        {analysis.intake.format} · lote {analysis.intake.fileHash} · {analysis.intake.originalRows}{" "}
                        linha(s)
                      </small>
                    </div>
                    <Badge
                      tone={
                        analysis.intake.status === "PRONTO"
                          ? "ready"
                          : analysis.intake.status === "ATENCAO"
                            ? "attention"
                            : "critical"
                      }
                    >
                      {analysis.intake.status}
                    </Badge>
                  </div>
                  <div className="intake-analysis-kpis">
                    <span>
                      <b>{analysis.intake.acceptedRows}</b> aceitas
                    </span>
                    <span>
                      <b>{analysis.intake.rejectedRows}</b> rejeitadas
                    </span>
                    <span>
                      <b>{analysis.intake.matchedDebtors}</b> sacados associados
                    </span>
                    {(analysis.intake.newDebtors?.length ?? 0) > 0 && (
                      <span>
                        <b>{analysis.intake.newDebtors?.length}</b> sacados novos
                      </span>
                    )}
                    <span>
                      <b>{analysis.intake.issues.length}</b> apontamentos
                    </span>
                  </div>
                  {analysis.intake.issues.length > 0 && (
                    <div className="intake-issues">
                      {analysis.intake.issues.slice(0, 4).map(item => (
                        <p key={item.id}>
                          <b>{item.severity}</b> {item.row ? `Linha ${item.row} · ` : ""}
                          {item.message}
                        </p>
                      ))}
                      {analysis.intake.issues.length > 4 && (
                        <small>+ {analysis.intake.issues.length - 4} apontamento(s)</small>
                      )}
                    </div>
                  )}
                  {(analysis.intake.newDebtors?.length ?? 0) > 0 && (
                    <div className="intake-new-debtors">
                      <p>
                        <b>Cadastro automático</b> Estes sacados não estavam na base e serão cadastrados com os dados do
                        arquivo ao iniciar a operação:
                      </p>
                      <ul>
                        {analysis.intake.newDebtors?.slice(0, 4).map(debtor => (
                          <li key={debtor.id}>
                            <b>{debtor.name}</b>
                            <small>
                              {debtor.document} · {debtor.city}/{debtor.state}
                              {debtor.registrationStatus === "Provisório" ? " · endereço a completar" : ""}
                            </small>
                          </li>
                        ))}
                      </ul>
                      {(analysis.intake.newDebtors?.length ?? 0) > 4 && (
                        <small>+ {(analysis.intake.newDebtors?.length ?? 0) - 4} sacado(s)</small>
                      )}
                    </div>
                  )}
                  {analysis.data.entries.length > 0 && (
                    <div className="intake-preview">
                      {analysis.data.entries.slice(0, 3).map(title => (
                        <span key={title.id}>
                          <strong>{title.documentNumber}</strong>
                          <small>
                            {title.debtorName} · {preciseMoney.format(title.amount)} · {title.dueDate}
                          </small>
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          ) : source === "Digitação manual" ? (
            <div className="structured-info">
              <strong>Operação criada para digitação</strong>
              <small>
                O tipo do recebível será escolhido na etapa de entrada. Cheques serão mantidos em operação separada.
              </small>
            </div>
          ) : (
            <div className="structured-info">
              <strong>Operação CCB</strong>
              <small>Informe as partes, condições financeiras, cronograma e garantias na próxima etapa.</small>
            </div>
          )}
          {(!requiresFile || Boolean(analysis?.intake.acceptedRows)) && (
            <div className="detected-type">
              <SparkIcon />
              <div>
                <span>TIPO DA OPERAÇÃO</span>
                <strong>{detectedType}</strong>
                <small>{requiresFile ? "Identificado pelo conteúdo do arquivo" : "Definido para esta entrada"}</small>
              </div>
            </div>
          )}
        </div>
        <label className="modal-field destination-field">
          <span>Destino da operação</span>
          <select value={destinationName} onChange={e => setDestinationName(e.target.value)}>
            {destinations.map(item => (
              <option value={item.name} key={item.name}>
                {item.name} · {item.institution}
              </option>
            ))}
          </select>
          <small>A empresa já está cadastrada. Aqui você apenas direciona a operação.</small>
        </label>
        <div className="modal-actions">
          <button className="secondary-action" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="primary-action"
            disabled={!cedent || (requiresFile && (!analysis || analysis.intake.status === "BLOQUEADO"))}
            onClick={() =>
              cedent &&
              onCreate({
                source,
                operationType: detectedType,
                destination,
                cedent,
                importedData: analysis?.data,
                entryIntake: analysis?.intake,
              })
            }
          >
            Iniciar operação <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}

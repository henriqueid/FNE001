"use client";

/**
 * Nova operação: cedente obrigatório (com comercial, score e limite), origem dos títulos e destino.
 */
import { RegistryContext, useCedents } from "@/src/app/registry-context";
import { destinations } from "@/src/domain/core/demo/companies";
import { preciseMoney } from "@/src/domain/core/format";
import { type Cedent, type Destination, type OperationSource } from "@/src/domain/core/types";
import { Badge } from "@/src/features/operations/components/status";
import { ArrowIcon, CheckIcon, CloseIcon, SparkIcon } from "@/src/ui/icons";
import { useContext, useState } from "react";

export type NewOperationInput = {
  source: OperationSource;
  operationType: string;
  destination: Destination;
  cedent: Cedent;
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
}: {
  onClose: () => void;
  onCreate: (input: NewOperationInput) => void;
  defaultDestination?: string;
}) {
  const registryCedents = useCedents();
  const registry = useContext(RegistryContext);
  const [source, setSource] = useState<OperationSource>("XML NF-e");
  const [destinationName, setDestinationName] = useState(
    defaultDestination && defaultDestination !== "Consolidado" ? defaultDestination : destinations[0].name,
  );
  const [cedentId, setCedentId] = useState("");
  const [fileLoaded, setFileLoaded] = useState(false);
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
    setFileLoaded(false);
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
                <b>Score {cedent.score}</b>
                <small>
                  {cedent.score >= 700 ? "Faixa positiva" : cedent.score >= 600 ? "Faixa de atenção" : "Faixa crítica"}
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
            <div className="file-import">
              <div>
                <strong>Arquivo da operação</strong>
                <small>
                  {source === "XML NF-e"
                    ? "Selecione um ou mais arquivos .xml"
                    : source === "CNAB"
                      ? "Selecione o arquivo CNAB recebido"
                      : "Selecione um arquivo .xlsx ou .csv"}
                </small>
              </div>
              <button className={fileLoaded ? "file-loaded" : "secondary-action"} onClick={() => setFileLoaded(true)}>
                {fileLoaded ? (
                  <>
                    <CheckIcon /> Arquivo analisado
                  </>
                ) : (
                  "Selecionar arquivo"
                )}
              </button>
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
          {(!requiresFile || fileLoaded) && (
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
            disabled={!cedent || (requiresFile && !fileLoaded)}
            onClick={() => cedent && onCreate({ source, operationType: detectedType, destination, cedent })}
          >
            Iniciar operação <ArrowIcon />
          </button>
        </div>
      </section>
    </div>
  );
}

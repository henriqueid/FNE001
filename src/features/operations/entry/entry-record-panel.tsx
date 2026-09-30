"use client";

/**
 * Etapa Entrada (somente leitura) para origens por arquivo: registro do que foi importado.
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type Operation } from "@/src/domain/core/types";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, CheckIcon } from "@/src/ui/icons";

export function EntryRecordPanel({ operation }: { operation: Operation }) {
  const entries = operation.manualEntry?.entries ?? [];
  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  const discounts = entries.reduce((sum, entry) => sum + (entry.discount ?? 0), 0);
  const debtors = new Set(
    entries.map(entry => entry.debtorId || entry.debtorDocument || entry.debtorName).filter(Boolean),
  );
  const withEvidence = entries.filter(entry => entry.nfeKey || entry.cmc7).length;
  const issueDates = entries
    .map(entry => entry.issueDate)
    .filter(Boolean)
    .sort();
  const dueDates = entries
    .map(entry => entry.dueDate)
    .filter(Boolean)
    .sort();

  return (
    <section className="entry-record">
      <div className="entry-record-head">
        <div>
          <Badge tone="ready">
            <CheckIcon /> REGISTRO PRESERVADO
          </Badge>
          <h3>Dados recebidos na Entrada</h3>
          <p>
            A carteira original permanece vinculada ao aditivo e alimenta Risco, Lastro e Preço. Esta visualização não
            altera os dados concluídos.
          </p>
        </div>
        <div>
          <span>ORIGEM</span>
          <strong>{operation.source ?? "Não informada"}</strong>
          <small>{operation.operationType ?? operation.manualEntry?.receivableType ?? "Tipo não definido"}</small>
        </div>
      </div>
      <div className="entry-record-kpis">
        <div>
          <span>TÍTULOS</span>
          <strong>{entries.length}</strong>
          <small>{debtors.size} sacado(s)</small>
        </div>
        <div>
          <span>VALOR DE FACE</span>
          <strong>{preciseMoney.format(total)}</strong>
          <small>Desconto informado: {preciseMoney.format(discounts)}</small>
        </div>
        <div>
          <span>EVIDÊNCIAS NA ORIGEM</span>
          <strong>
            {withEvidence}/{entries.length}
          </strong>
          <small>Chave NF-e ou CMC7</small>
        </div>
        <div>
          <span>PERÍODO DA CARTEIRA</span>
          <strong>{dueDates.length ? formatBrazilianDate(dueDates[0]) : "—"}</strong>
          <small>até {dueDates.length ? formatBrazilianDate(dueDates[dueDates.length - 1]) : "—"}</small>
        </div>
      </div>
      <div className="entry-record-context">
        <div>
          <span>CEDENTE</span>
          <strong>{operation.cedent}</strong>
          <small>{operation.document}</small>
        </div>
        <div>
          <span>VEÍCULO</span>
          <strong>{operation.vehicle}</strong>
          <small>
            {operation.institution}
            {operation.fundClass ? ` · ${operation.fundClass}` : ""}
          </small>
        </div>
        <div>
          <span>ENTRADA DA OPERAÇÃO</span>
          <strong>{operation.enteredAt}</strong>
          <small>
            {issueDates.length
              ? `Emissões a partir de ${formatBrazilianDate(issueDates[0])}`
              : "Data de emissão não informada"}
          </small>
        </div>
      </div>
      {entries.length ? (
        <div className="entry-record-scroll">
          <div className="entry-record-grid entry-record-grid-head">
            <span>DOCUMENTO</span>
            <span>SACADO / CPF-CNPJ</span>
            <span>EMISSÃO</span>
            <span>VENCIMENTO</span>
            <span>VALOR DE FACE</span>
            <span>DESCONTO</span>
            <span>LASTRO DE ORIGEM</span>
            <span>REFERÊNCIAS</span>
            <span>OBSERVAÇÃO</span>
          </div>
          {entries.map(entry => (
            <div className="entry-record-grid entry-record-row" key={entry.id}>
              <span>
                <strong>{entry.documentNumber}</strong>
                <small>{operation.manualEntry?.receivableType}</small>
              </span>
              <span>
                <strong>{entry.debtorName || "Sacado não identificado"}</strong>
                <small>{entry.debtorDocument || "Documento não informado"}</small>
              </span>
              <span>{formatBrazilianDate(entry.issueDate)}</span>
              <span>
                <strong>{formatBrazilianDate(entry.dueDate)}</strong>
              </span>
              <strong>{preciseMoney.format(entry.amount)}</strong>
              <span>{preciseMoney.format(entry.discount ?? 0)}</span>
              <span>
                <strong>
                  {entry.nfeKey ? `NF-e ${entry.nfeKey}` : entry.cmc7 ? `CMC7 ${entry.cmc7}` : "Não informado"}
                </strong>
                <small>
                  {entry.cfop
                    ? `CFOP ${entry.cfop}`
                    : entry.bank
                      ? `Banco ${entry.bank} · Ag. ${entry.agency || "—"}`
                      : "Sem complemento"}
                </small>
              </span>
              <span>
                <strong>{entry.ourNumber || entry.account || "—"}</strong>
                <small>
                  {entry.compensation
                    ? `Comp. ${entry.compensation}`
                    : entry.city
                      ? `${entry.city}/${entry.state}`
                      : "—"}
                </small>
              </span>
              <span title={entry.observation}>{entry.observation || "—"}</span>
            </div>
          ))}
        </div>
      ) : (
        <div className="entry-record-empty">
          <AlertIcon />
          <strong>Nenhum título registrado na Entrada</strong>
          <span>A operação não poderá avançar sem recuperar ou incluir a carteira de origem.</span>
        </div>
      )}
    </section>
  );
}

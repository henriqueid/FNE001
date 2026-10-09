"use client";
/**
 * Linha de busca do sacado por CPF/CNPJ, com o sacado localizado, o atalho de
 * cadastro e o aviso de sacado não existente.
 */
import { type Debtor } from "@/src/domain/core/types";
import { AlertIcon, CheckIcon, SearchIcon } from "@/src/ui/icons";
import { formatTaxId } from "./manual-entry-model";

export function DebtorLookup({
  query,
  selectedDebtor,
  searched,
  onQueryChange,
  onSearch,
  onRegisterWithQuery,
  onOpenRegister,
}: {
  query: string;
  selectedDebtor: Debtor | null;
  searched: boolean;
  onQueryChange: (value: string) => void;
  onSearch: () => void;
  onRegisterWithQuery: () => void;
  onOpenRegister: () => void;
}) {
  return (
    <>
      <div className="sacado-line">
        <span>Sacado *</span>
        <div className="debtor-search-control">
          <input
            aria-label="CPF ou CNPJ do sacado"
            value={query}
            onChange={event => onQueryChange(event.target.value)}
            placeholder="CPF ou CNPJ"
          />
          <button className="lookup-button" aria-label="Buscar sacado" onClick={onSearch}>
            <SearchIcon />
          </button>
        </div>
        {selectedDebtor ? (
          <div className="debtor-selection-card">
            <CheckIcon />
            <div>
              <strong>{selectedDebtor.name}</strong>
              <small>{formatTaxId(selectedDebtor.document)}</small>
            </div>
          </div>
        ) : (
          <span className="debtor-inline-empty">Localize o sacado</span>
        )}
        <button className="inline-new" onClick={onRegisterWithQuery}>
          + Cadastrar sacado
        </button>
      </div>
      {searched && !selectedDebtor && (
        <div className="inline-debtor-result missing">
          <AlertIcon />
          <span>Sacado não existente.</span>
          <button onClick={onOpenRegister}>Cadastrar agora</button>
        </div>
      )}
    </>
  );
}

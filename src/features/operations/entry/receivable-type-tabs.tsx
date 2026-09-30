"use client";
/**
 * Abas de tipo de recebível da digitação manual e estado vazio exibido antes da
 * escolha. Com títulos salvos, só o tipo atual permanece habilitado.
 */
import { type ReceivableType, receivableTypes } from "./manual-entry-model";

export function ReceivableTypeTabs({
  receivableType,
  locked,
  onChoose,
}: {
  receivableType: ReceivableType | "";
  locked: boolean;
  onChoose: (type: ReceivableType) => void;
}) {
  return (
    <div className="manual-tabs">
      {receivableTypes.map(type => (
        <button
          key={type.value}
          className={receivableType === type.value ? "active" : ""}
          disabled={locked && receivableType !== type.value}
          onClick={() => onChoose(type.value)}
        >
          {type.label}
        </button>
      ))}
    </div>
  );
}

export function ReceivableTypeEmpty() {
  return (
    <div className="compact-empty">
      <strong>Escolha o tipo do recebível para iniciar.</strong>
      <span>O tipo será exclusivo desta operação; cheques nunca serão misturados com papel.</span>
    </div>
  );
}

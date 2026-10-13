"use client";
/**
 * Cadastro rápido de sacado dentro da digitação: identificação, endereço e contato,
 * com exigência opcional de e-mail e telefone.
 */
import { type DebtorDraft, formatPhone, formatTaxId, formatZip } from "./manual-entry-model";
import { consultLeadCnpj } from "@/src/app/cnpj-enrichment-client";
import { consultCep } from "@/src/app/public-enrichment-client";
import { onlyDigits } from "@/src/domain/registry/parties";
import { useState } from "react";

export function QuickDebtorForm({
  draft,
  requireEmail,
  requirePhone,
  valid,
  onDraftChange,
  onRequireEmailChange,
  onRequirePhoneChange,
  onClose,
  onSubmit,
}: {
  draft: DebtorDraft;
  requireEmail: boolean;
  requirePhone: boolean;
  valid: boolean;
  onDraftChange: (draft: DebtorDraft) => void;
  onRequireEmailChange: (value: boolean) => void;
  onRequirePhoneChange: (value: boolean) => void;
  onClose: () => void;
  onSubmit: () => void;
}) {
  const [lookup, setLookup] = useState<"cnpj" | "cep" | null>(null);
  const [lookupMessage, setLookupMessage] = useState("");
  const [lookupError, setLookupError] = useState("");
  const lookupCnpj = async () => {
    setLookup("cnpj");
    setLookupError("");
    try {
      const evidence = await consultLeadCnpj(draft.document);
      onDraftChange({
        ...draft,
        name: evidence.legalName || draft.name,
        tradeName: evidence.tradeName || draft.tradeName,
        address: evidence.address.street || draft.address,
        number: evidence.address.number || draft.number,
        district: evidence.address.district || draft.district,
        city: evidence.address.city || draft.city,
        state: evidence.address.state || draft.state,
        zipCode: evidence.address.zipCode || draft.zipCode,
        email: evidence.email || draft.email,
        phone: evidence.phones[0] ? formatPhone(evidence.phones[0]) : draft.phone,
        publicStatus: `${evidence.registrationStatus.label} · BrasilAPI · ${evidence.fetchedAt.slice(0, 10)}`,
      });
      setLookupMessage(`Cadastro público encontrado · situação ${evidence.registrationStatus.label}`);
    } catch (reason) {
      setLookupError(reason instanceof Error ? reason.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setLookup(null);
    }
  };
  const lookupCep = async () => {
    setLookup("cep");
    setLookupError("");
    try {
      const evidence = await consultCep(draft.zipCode);
      onDraftChange({
        ...draft,
        zipCode: evidence.zipCode,
        address: evidence.street || draft.address,
        district: evidence.district || draft.district,
        city: evidence.city,
        state: evidence.state,
      });
      setLookupMessage(`CEP conferido · ${evidence.city}/${evidence.state}`);
    } catch (reason) {
      setLookupError(reason instanceof Error ? reason.message : "Não foi possível consultar o CEP.");
    } finally {
      setLookup(null);
    }
  };
  return (
    <div className="debtor-form compact-register">
      <div className="debtor-form-head">
        <div>
          <strong>Novo sacado</strong>
          <small>Dados da pessoa/empresa e endereço são obrigatórios.</small>
        </div>
        <div className="contact-policy">
          <label>
            <input
              type="checkbox"
              checked={requireEmail}
              onChange={event => onRequireEmailChange(event.target.checked)}
            />{" "}
            Exigir e-mail
          </label>
          <label>
            <input
              type="checkbox"
              checked={requirePhone}
              onChange={event => onRequirePhoneChange(event.target.checked)}
            />{" "}
            Exigir telefone
          </label>
        </div>
      </div>
      <div className="debtor-form-grid">
        <label>
          <span>CPF / CNPJ *</span>
          <div className="public-lookup-row">
            <input
              value={draft.document}
              onChange={event => onDraftChange({ ...draft, document: formatTaxId(event.target.value) })}
            />
            {onlyDigits(draft.document).length === 14 && (
              <button type="button" disabled={lookup != null} onClick={() => void lookupCnpj()}>
                {lookup === "cnpj" ? "Consultando…" : "Consultar CNPJ"}
              </button>
            )}
          </div>
        </label>
        <label className="wide">
          <span>NOME / RAZÃO SOCIAL *</span>
          <input value={draft.name} onChange={event => onDraftChange({ ...draft, name: event.target.value })} />
        </label>
        <label>
          <span>NOME FANTASIA</span>
          <input
            value={draft.tradeName}
            onChange={event => onDraftChange({ ...draft, tradeName: event.target.value })}
          />
        </label>
        <label className="wide">
          <span>ENDEREÇO *</span>
          <input value={draft.address} onChange={event => onDraftChange({ ...draft, address: event.target.value })} />
        </label>
        <label>
          <span>NÚMERO *</span>
          <input value={draft.number} onChange={event => onDraftChange({ ...draft, number: event.target.value })} />
        </label>
        <label>
          <span>BAIRRO *</span>
          <input value={draft.district} onChange={event => onDraftChange({ ...draft, district: event.target.value })} />
        </label>
        <label>
          <span>CIDADE *</span>
          <input value={draft.city} onChange={event => onDraftChange({ ...draft, city: event.target.value })} />
        </label>
        <label>
          <span>UF *</span>
          <input
            maxLength={2}
            value={draft.state}
            onChange={event => onDraftChange({ ...draft, state: event.target.value.toUpperCase() })}
          />
        </label>
        <label>
          <span>CEP *</span>
          <div className="public-lookup-row">
            <input
              value={draft.zipCode}
              onChange={event => onDraftChange({ ...draft, zipCode: formatZip(event.target.value) })}
            />
            <button
              type="button"
              disabled={lookup != null || onlyDigits(draft.zipCode).length !== 8}
              onClick={() => void lookupCep()}
            >
              {lookup === "cep" ? "Buscando…" : "Buscar CEP"}
            </button>
          </div>
        </label>
        <label>
          <span>E-MAIL {requireEmail ? "*" : ""}</span>
          <input
            type="email"
            value={draft.email}
            onChange={event => onDraftChange({ ...draft, email: event.target.value })}
          />
        </label>
        <label>
          <span>TELEFONE {requirePhone ? "*" : ""}</span>
          <input
            value={draft.phone}
            onChange={event => onDraftChange({ ...draft, phone: formatPhone(event.target.value) })}
          />
        </label>
      </div>
      {lookupMessage && <p className="public-lookup-feedback success">{lookupMessage}</p>}
      {lookupError && <p className="public-lookup-feedback error">{lookupError}</p>}
      <div className="debtor-form-actions">
        <button onClick={onClose}>Fechar</button>
        <button className="primary-action" disabled={!valid} onClick={onSubmit}>
          Salvar e usar
        </button>
      </div>
    </div>
  );
}

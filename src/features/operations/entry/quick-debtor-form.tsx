"use client";
/**
 * Cadastro rápido de sacado dentro da digitação: identificação, endereço e contato,
 * com exigência opcional de e-mail e telefone.
 */
import { type DebtorDraft, formatPhone, formatTaxId, formatZip } from "./manual-entry-model";

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
          <input
            value={draft.document}
            onChange={event => onDraftChange({ ...draft, document: formatTaxId(event.target.value) })}
          />
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
          <input
            value={draft.zipCode}
            onChange={event => onDraftChange({ ...draft, zipCode: formatZip(event.target.value) })}
          />
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
      <div className="debtor-form-actions">
        <button onClick={onClose}>Fechar</button>
        <button className="primary-action" disabled={!valid} onClick={onSubmit}>
          Salvar e usar
        </button>
      </div>
    </div>
  );
}

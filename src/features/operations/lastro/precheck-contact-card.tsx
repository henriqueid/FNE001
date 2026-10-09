"use client";
/**
 * Cartão de contato do sacado na pré-checagem: revela o telefone sob demanda e
 * oferece os atalhos de ligação e WhatsApp Web.
 */
import { type LastroAssessmentRow } from "@/src/domain/operations/lastro";

export function PrecheckContactCard({
  selected,
  revealed,
  phone,
  whatsappPhone,
  onReveal,
}: {
  selected: LastroAssessmentRow;
  revealed: boolean;
  phone: string | undefined;
  whatsappPhone: string;
  onReveal: () => void;
}) {
  return (
    <section className="precheck-contact-card">
      <div>
        <span>CONTATO DO SACADO</span>
        <strong>{selected.debtor?.name ?? selected.title.debtorName}</strong>
        <small>{selected.debtor?.document ?? selected.title.debtorDocument}</small>
      </div>
      <div className="precheck-phone">
        {revealed ? (
          <>
            <strong>{phone ?? "Telefone não cadastrado"}</strong>
            {phone && (
              <div className="contact-links">
                <a href={`tel:${phone.replace(/\D/g, "")}`}>Ligar</a>
                {whatsappPhone && (
                  <a href={`https://wa.me/${whatsappPhone}`} target="_blank" rel="noreferrer">
                    Enviar mensagem
                  </a>
                )}
              </div>
            )}
          </>
        ) : (
          <button onClick={onReveal}>Ver contato</button>
        )}
        <small>
          {whatsappPhone
            ? "Celular habilitado para abrir no WhatsApp Web"
            : phone
              ? "Telefone disponível para ligação; WhatsApp não cadastrado"
              : "Cadastre um telefone para habilitar o contato"}
        </small>
      </div>
    </section>
  );
}

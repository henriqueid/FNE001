"use client";

/**
 * Preferências da interface (explicações permanentes).
 */
import { Badge, InfoTip } from "@/src/features/operations/components/status";
import { CloseIcon } from "@/src/ui/icons";

export function InterfaceSettingsModal({
  showGuidance,
  onChange,
  onClose,
}: {
  showGuidance: boolean;
  onChange: (value: boolean) => void;
  onClose: () => void;
}) {
  return (
    <div
      className="modal-backdrop"
      role="presentation"
      onMouseDown={event => event.currentTarget === event.target && onClose()}
    >
      <section className="settings-modal" role="dialog" aria-modal="true" aria-label="Configurações de interface">
        <div className="modal-head">
          <div>
            <Badge tone="eyebrow">CONFIGURAÇÕES</Badge>
            <h2>Preferências da interface</h2>
            <p>Adapte o nível de orientação ao perfil de cada usuário.</p>
          </div>
          <button aria-label="Fechar configurações" onClick={onClose}>
            <CloseIcon />
          </button>
        </div>
        <section className="settings-option">
          <div>
            <strong>Explicações permanentes</strong>
            <span>Exibe subtítulos e textos explicativos diretamente nos blocos operacionais.</span>
            <small>Os ícones de informação continuam disponíveis mesmo quando os textos estiverem ocultos.</small>
          </div>
          <label className="settings-switch">
            <input
              aria-label="Exibir explicações permanentes"
              type="checkbox"
              checked={showGuidance}
              onChange={event => onChange(event.target.checked)}
            />
            <span />
            <b>{showGuidance ? "Visíveis" : "Ocultas"}</b>
          </label>
        </section>
        <div className="settings-preview">
          <span>COMO FICA</span>
          <strong>
            Tarifas e retenções{" "}
            <InfoTip text="Configura os componentes descontados do valor liberado, incluindo tarifas, tributos, garantia e retenções." />
          </strong>
          {showGuidance && (
            <>
              <b>Componentes da liberação</b>
              <small>Tributos conforme a configuração da empresa.</small>
            </>
          )}
        </div>
        <div className="modal-actions">
          <button className="primary-action" onClick={onClose}>
            Concluir
          </button>
        </div>
      </section>
    </div>
  );
}

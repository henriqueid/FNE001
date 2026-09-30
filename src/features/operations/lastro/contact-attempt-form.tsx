"use client";
/**
 * Formulário de nova tentativa de contato (escopo, canal, resultado e próxima
 * tentativa) com o histórico das três últimas tentativas do título.
 */
import { type LastroReviewItem } from "@/src/domain/operations/lastro";
import { type AttemptChannel, type AttemptResult, type ConfirmationScope } from "./lastro-model";

export function ContactAttemptForm({
  review,
  confirmationScope,
  attemptChannel,
  attemptResult,
  nextContactAt,
  whatsappEnabled,
  onConfirmationScopeChange,
  onAttemptChannelChange,
  onAttemptResultChange,
  onNextContactAtChange,
  onRegister,
}: {
  review: LastroReviewItem | undefined;
  confirmationScope: ConfirmationScope;
  attemptChannel: AttemptChannel;
  attemptResult: AttemptResult;
  nextContactAt: string;
  whatsappEnabled: boolean;
  onConfirmationScopeChange: (scope: ConfirmationScope) => void;
  onAttemptChannelChange: (channel: AttemptChannel) => void;
  onAttemptResultChange: (result: AttemptResult) => void;
  onNextContactAtChange: (value: string) => void;
  onRegister: () => void;
}) {
  return (
    <section className="precheck-attempt">
      <div className="precheck-section-title">
        <div>
          <span>NOVA TENTATIVA DE CONTATO</span>
          <strong>Escolha o agrupamento, o canal e o resultado</strong>
        </div>
        <small>{review?.attempts?.length ?? 0} tentativa(s) no histórico</small>
      </div>
      <div className="attempt-form">
        <label>
          <span>APLICAR A</span>
          <select
            aria-label="Escopo da confirmação"
            value={confirmationScope}
            onChange={event => onConfirmationScopeChange(event.target.value as ConfirmationScope)}
          >
            <option>Nota</option>
            <option>Sacado</option>
          </select>
        </label>
        <label>
          <span>CANAL</span>
          <select
            aria-label="Canal da tentativa"
            value={attemptChannel}
            onChange={event => onAttemptChannelChange(event.target.value as AttemptChannel)}
          >
            <option>Ligação</option>
            <option disabled={!whatsappEnabled}>WhatsApp</option>
          </select>
        </label>
        <label>
          <span>RESULTADO</span>
          <select
            aria-label="Resultado da tentativa"
            value={attemptResult}
            onChange={event => onAttemptResultChange(event.target.value as AttemptResult)}
          >
            <option>Contato iniciado</option>
            <option>Sem contato</option>
            <option>Confirmado</option>
            <option>Confirmado com ressalva</option>
            <option>Recusado</option>
            <option>Telefone inválido</option>
          </select>
        </label>
        <label>
          <span>PRÓXIMA TENTATIVA</span>
          <input
            aria-label="Próxima tentativa"
            type="datetime-local"
            value={nextContactAt}
            onChange={event => onNextContactAtChange(event.target.value)}
          />
        </label>
        <button onClick={onRegister}>Adicionar tentativa</button>
      </div>
      <small className="scope-helper">
        Por nota aplica o retorno às parcelas da mesma NF-e. Por sacado aplica a todos os títulos desse sacado na
        operação. Fora da amostra, o contato é voluntário.
      </small>
      {Boolean(review?.attempts?.length) && (
        <div className="attempt-history">
          {review?.attempts
            ?.slice(-3)
            .reverse()
            .map((attempt, index) => (
              <div key={`${attempt.at}-${index}`}>
                <strong>
                  {attempt.channel} · {attempt.result}
                </strong>
                <small>
                  {attempt.at} · {attempt.by}
                  {attempt.nextContactAt
                    ? ` · próxima: ${new Date(attempt.nextContactAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })}`
                    : ""}
                </small>
              </div>
            ))}
        </div>
      )}
    </section>
  );
}

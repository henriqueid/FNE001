/** Enfileira baixa de registro vigente sem antecipar confirmação bancária. */
import type { PortfolioTitleRecord } from "@/src/domain/portfolio/model";
export function queueRepurchaseWriteOff(
  title: PortfolioTitleRecord,
  input: { applicationId: string; operationId: string; actor: string; at: string },
): { title: PortfolioTitleRecord; error?: string } {
  if (title.bankStatus === "Sem boleto" || title.bankStatus === "Baixado") return { title };
  if (title.bankStatus !== "Registrado")
    return { title, error: "Confirme o vínculo bancário e confira eventual liquidação antes de recomprar com baixa." };
  if (
    !title.ourNumber ||
    !["341", "237"].includes(title.bank ?? "") ||
    !title.agency ||
    !title.account ||
    !title.wallet
  )
    return { title, error: "Baixa exige nosso número e vínculo de cobrança Itaú/Bradesco completos." };
  if (title.bankWriteoff) {
    if (title.bankWriteoff.applicationId === input.applicationId) return { title };
    return { title, error: "O título já possui uma solicitação de baixa bancária." };
  }
  return {
    title: {
      ...title,
      bankWriteoff: {
        operationId: input.operationId,
        applicationId: input.applicationId,
        cycleId: input.applicationId,
        status: "Pendente",
        requestedAt: input.at,
      },
      events: [
        ...title.events,
        {
          id: `bank-writeoff-request:${input.applicationId}`,
          at: input.at,
          by: input.actor,
          action: "Baixa bancária solicitada pela recompra",
          detail: "Incluir pedido de baixa na próxima remessa; aguardando confirmação do banco.",
        },
      ],
    },
  };
}

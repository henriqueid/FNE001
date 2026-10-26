/** Vínculo da recompra ao saldo autoritativo, com reserva e reversão auditáveis. */
import type { Operation, RepurchaseApplication } from "@/src/domain/core/types";
import { portfolioBalance, type PortfolioState } from "@/src/domain/portfolio/model";
import { OperationGovernanceError } from "./governance";
import { queueRepurchaseWriteOff } from "@/src/domain/banking/writeoff";
const digits = (s: string) => s.replace(/\D/g, "");
const fail = (message: string): never => {
  throw new OperationGovernanceError(message);
};
export function bindRepurchaseSources(operation: Operation, portfolio: PortfolioState): Operation {
  const active = new Map((operation.repurchaseApplications ?? []).filter(a => !a.reversedAt).map(a => [a.titleId, a]));
  const ownApplication = (title: PortfolioState["titles"][number]) => {
    const application = active.get(title.id);
    return application &&
      title.repurchaseReservation?.applicationId === application.id &&
      title.repurchaseReservation.operationId === operation.id
      ? application
      : undefined;
  };
  const principal = (title: PortfolioState["titles"][number]) =>
    ownApplication(title)?.principal ?? portfolioBalance(title);
  const titles = portfolio.titles.filter(
    t =>
      t.company === operation.vehicle &&
      digits(t.ownerDocument) === digits(operation.document) &&
      t.operationId !== operation.id &&
      (Boolean(ownApplication(t)) ||
        (!t.positionReviewRequired &&
          !t.repurchaseReservation &&
          !t.bankWriteoff &&
          t.bankStatus !== "Liquidado" &&
          !["Pago", "Recomprado", "Cancelado"].includes(t.status) &&
          portfolioBalance(t) > 0)),
  );
  for (const id of operation.pricingReview?.repurchaseTitleIds ?? []) {
    const title = titles.find(t => t.id === id);
    if (!title) fail("Título de recompra indisponível na carteira da mesma empresa e cedente.");
    const terms =
      operation.pricingReview!.repurchaseTerms?.[id] ?? fail("Informe Baixar título: Sim ou Não para cada recompra.");
    if (typeof terms?.writeOffTitle !== "boolean") fail("Informe Baixar título: Sim ou Não para cada recompra.");
    if (terms.action && terms.action !== "Recompra")
      fail("A recompra real suporta somente o saldo integral do título.");
    if ([terms.rateOverride ?? 0, terms.lateInterestMonthly ?? 0, terms.penaltyPercent ?? 0].some(n => n !== 0))
      fail("A recompra real utiliza somente principal aberto; encargos exigem política autoritativa.");
    if (operation.pricingReview!.repurchaseSourceBalances?.[id] !== principal(title!))
      fail("O saldo da recompra mudou. Revise e salve novamente o preço.");
  }
  const selected = operation.pricingReview?.repurchaseTitleIds ?? [];
  if (new Set(selected).size !== selected.length) fail("Há títulos repetidos na recompra.");
  return {
    ...operation,
    repurchaseContext: {
      titles: titles.map(t => ({
        id: t.id,
        cedentDocument: t.ownerDocument,
        debtorName: t.debtorName,
        debtorDocument: t.debtorDocument,
        documentNumber: t.documentNumber,
        dueDate: t.dueDate,
        faceAmount: principal(t),
        acquisitionMonthlyRate: 0,
        acquisitionMethod: "Nominal",
        acquisitionReference: t.aditivoNumber ?? t.proposal ?? "Carteira persistida",
        status: "Em aberto",
      })),
    },
  };
}
export function applyRepurchases(operation: Operation, portfolio: PortfolioState, actor: string, at: string) {
  if (operation.repurchaseApplications?.some(a => !a.reversedAt)) return { operation, portfolio };
  const bound = bindRepurchaseSources(operation, portfolio);
  const next = structuredClone(portfolio);
  const applications: RepurchaseApplication[] = [...(operation.repurchaseApplications ?? [])];
  for (const titleId of bound.pricingReview?.repurchaseTitleIds ?? []) {
    const title = next.titles.find(t => t.id === titleId)!;
    const principal = portfolioBalance(title);
    const writeOffTitle = bound.pricingReview!.repurchaseTerms![titleId].writeOffTitle!;
    const application: RepurchaseApplication = {
      id: crypto.randomUUID(),
      titleId,
      principal,
      amount: principal,
      writeOffTitle,
      appliedAt: at,
      previous: {
        status: title.status,
        openAmount: title.openAmount,
        repurchasedAmount: title.repurchasedAmount,
        paidAmount: title.paidAmount,
        discountAmount: title.discountAmount,
        abatementAmount: title.abatementAmount,
        payments: JSON.stringify(title.payments),
      },
    };
    if (writeOffTitle) {
      const queued = queueRepurchaseWriteOff(title, {
        applicationId: application.id,
        operationId: operation.id,
        actor,
        at,
      });
      if (queued.error) fail(queued.error);
      Object.assign(title, queued.title, {
        status: "Recomprado",
        openAmount: 0,
        repurchasedAmount: title.repurchasedAmount + principal,
      });
    }
    title.repurchaseReservation = {
      applicationId: application.id,
      operationId: operation.id,
      amount: principal,
      principal,
      writeOffTitle,
      appliedAt: at,
    };
    title.events.push({
      id: `repurchase:${application.id}`,
      at,
      by: actor,
      action: "Recompra aplicada",
      detail: `Operação ${operation.id} · ${principal.toFixed(2)} descontado do líquido · baixar título: ${writeOffTitle ? "Sim" : "Não"}`,
    });
    applications.push(application);
  }
  return { operation: { ...bound, repurchaseApplications: applications }, portfolio: next };
}
export function reverseRepurchases(operation: Operation, portfolio: PortfolioState, actor: string, at: string) {
  const next = structuredClone(portfolio);
  const applications = (operation.repurchaseApplications ?? []).map(application => {
    if (application.reversedAt) return application;
    const title = next.titles.find(t => t.id === application.titleId);
    if (!title || title.repurchaseReservation?.applicationId !== application.id)
      fail("Vínculo da recompra foi alterado; reconcilie antes de devolver.");
    const t = title!;
    if (t.bankWriteoff && t.bankWriteoff.status !== "Pendente")
      fail("Baixa bancária já enviada ou confirmada; reconcilie antes de devolver.");
    if (
      t.positionReviewRequired ||
      t.paidAmount !== application.previous.paidAmount ||
      t.discountAmount !== application.previous.discountAmount ||
      t.abatementAmount !== application.previous.abatementAmount ||
      JSON.stringify(t.payments) !== application.previous.payments ||
      portfolioBalance(t) !== (application.writeOffTitle ? 0 : application.principal)
    )
      fail("Saldo do título recomposto foi alterado; regularize recebimentos antes da devolução.");
    t.status = application.previous.status;
    t.openAmount = application.previous.openAmount;
    t.repurchasedAmount = application.previous.repurchasedAmount;
    delete t.repurchaseReservation;
    delete t.bankWriteoff;
    t.events.push({
      id: `repurchase-reversal:${application.id}`,
      at,
      by: actor,
      action: "Recompra estornada",
      detail: `Devolução da operação ${operation.id} · vínculo ${application.id}`,
    });
    return { ...application, reversedAt: at };
  });
  return { operation: { ...operation, repurchaseApplications: applications }, portfolio: next };
}

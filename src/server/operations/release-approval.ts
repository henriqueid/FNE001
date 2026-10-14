import type { Operation, ReleasePayable, ReleasePayee, ReleaseReview } from "@/src/domain/core/types";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";

const same = (left: unknown, right: unknown) => JSON.stringify(left) === JSON.stringify(right);

function destination(payee: ReleasePayee) {
  if (payee.method === "Crédito em conta-corrente") return "Conta-corrente interna do cedente";
  if (payee.method === "PIX") return `Chave PIX ${payee.pixKey}`;
  return `${payee.bank} · Ag. ${payee.agency} · CC ${payee.account}`;
}

function payeeError(payee: ReleasePayee) {
  if (!payee.name.trim() || payee.document.replace(/\D/g, "").length < 11)
    return "Todo favorecido precisa ter nome e CPF/CNPJ válidos.";
  if (!Number.isFinite(payee.amount) || payee.amount <= 0) return "Todo favorecido precisa ter valor positivo.";
  if (payee.method === "PIX" && !payee.pixKey?.trim()) return "Todo pagamento PIX precisa ter uma chave.";
  if (payee.method === "TED" && !(payee.bank?.trim() && payee.agency?.trim() && payee.account?.trim()))
    return "Todo pagamento por TED precisa ter banco, agência e conta.";
  if (payee.relation === "Terceiro" && !payee.justification?.trim())
    return "Pagamento a terceiro exige justificativa.";
  return null;
}

function netToRelease(operation: Operation) {
  if (!operation.pricingReview) return roundPricing(operation.netAmount);
  const pricing = normalizedPricing(operation);
  const calculated = pricingCalculation(operation, pricing);
  const offsets =
    repurchaseCalculation(operation, pricing).total + settlementAdjustmentCalculation(operation, pricing).total;
  return roundPricing(calculated.net - offsets);
}

/** Confere no servidor o pacote que será congelado para aprovação independente. */
export function preparedReleaseError(operation: Operation, review: ReleaseReview) {
  const payees = review.payees ?? [];
  if (!payees.length) return "A liberação precisa ter ao menos um favorecido.";
  for (const payee of payees) {
    const error = payeeError(payee);
    if (error) return error;
  }
  const distributed = roundPricing(payees.reduce((total, payee) => total + payee.amount, 0));
  if (Math.abs(distributed - netToRelease(operation)) >= 0.01)
    return "Os favorecidos precisam distribuir exatamente o valor líquido da operação.";
  if (!review.paymentDate?.trim()) return "A liberação precisa ter uma data de pagamento.";
  return null;
}

/** O aprovador só pode aceitar o pacote salvo pelo preparador, nunca trocar o destino durante a aprovação. */
export function approvalChangedPreparedRelease(previous: ReleaseReview, requested: ReleaseReview) {
  return !same(
    {
      payingAccountId: previous.payingAccountId,
      balanceCheckedAt: previous.balanceCheckedAt,
      paymentDate: previous.paymentDate,
      observation: previous.observation,
      payees: previous.payees ?? [],
    },
    {
      payingAccountId: requested.payingAccountId,
      balanceCheckedAt: requested.balanceCheckedAt,
      paymentDate: requested.paymentDate,
      observation: requested.observation,
      payees: requested.payees ?? [],
    },
  );
}

/** Lançamentos são produzidos de novo pelo backend; o navegador não decide destino, valor ou favorecido. */
export function approvedPayables(operation: Operation, prepared: ReleaseReview, createdAt: string): ReleasePayable[] {
  return (prepared.payees ?? []).map((payee, index) => ({
    id: `CP-${operation.borderoNumber}-${String(index + 1).padStart(2, "0")}`,
    payee: payee.name,
    document: payee.document,
    method: payee.method,
    destination: destination(payee),
    amount: roundPricing(payee.amount),
    dueDate: prepared.paymentDate!,
    payingAccount: "Definida pelo financeiro",
    status: "Pendente de pagamento",
    createdAt,
  }));
}

/** Pacote de liberação isolado para regressões de devolução. */
import { initialOperations } from "@/src/domain/core/demo/operations";
import type { Operation } from "@/src/domain/core/types";
export function releasedOperation(): Operation {
  const op = structuredClone(initialOperations.find(o => o.manualEntry?.entries.length)!);
  const entry = {
    ...op.manualEntry!.entries[0],
    id: "entry-return",
    amount: 1000,
    discount: 0,
    nfeKey: "",
    dueDate: "2027-12-31",
    ourNumber: undefined,
    bank: undefined,
    agency: undefined,
    account: undefined,
    wallet: undefined,
    agreement: undefined,
  };
  return {
    ...op,
    id: "operation-return",
    vehicle: "Empresa A",
    amount: 1000,
    netAmount: 900,
    titleCount: 1,
    stage: 6,
    status: "Liberada ao financeiro",
    pricingReview: undefined,
    riskReview: undefined,
    manualEntry: { ...op.manualEntry!, entries: [entry] },
    releaseReview: {
      status: "Enviada ao financeiro",
      releasedAt: "2026-10-18T12:00:00Z",
      preparedById: "maker",
      approvedById: "checker",
      payables: [
        {
          id: "payable-return",
          payee: op.cedent,
          document: op.document,
          method: "PIX",
          destination: "Chave cadastrada",
          amount: 900,
          dueDate: "2026-10-18",
          payingAccount: "Conta A",
          status: "Pendente de pagamento",
          createdAt: "2026-10-18T12:00:00Z",
        },
      ],
      audit: [],
    },
  };
}

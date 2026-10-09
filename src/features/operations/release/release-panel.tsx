"use client";

/**
 * Etapa Liberação: favorecidos (cedente ou terceiro com justificativa), conferências e envio ao financeiro.
 */
import { cedentBankAccounts } from "@/src/domain/core/demo/cedents";
import { preciseMoney } from "@/src/domain/core/format";
import {
  type BankAccount,
  type Operation,
  type PaymentMethod,
  type ReleasePayable,
  type ReleasePayee,
  type ReleaseReview,
} from "@/src/domain/core/types";
import { localDateISO } from "@/src/domain/operations/dates";
import { formatBrazilianDate } from "@/src/domain/operations/format";
import {
  normalizedPricing,
  pricingCalculation,
  repurchaseCalculation,
  roundPricing,
  settlementAdjustmentCalculation,
} from "@/src/domain/operations/pricing";
import { Badge } from "@/src/features/operations/components/status";
import { AlertIcon, ArrowIcon, CheckIcon } from "@/src/ui/icons";
import { useState } from "react";

export const releaseNow = () => new Date().toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" });

export const paymentMethods: PaymentMethod[] = ["PIX", "TED", "Crédito em conta-corrente"];

export function payeeDestination(payee: ReleasePayee) {
  if (payee.method === "Crédito em conta-corrente") return "Conta-corrente interna do cedente";
  if (payee.method === "PIX") return `Chave PIX ${payee.pixKey || "não informada"}`;
  return `${payee.bank || "Banco?"} · Ag. ${payee.agency || "?"} · CC ${payee.account || "?"}`;
}

export function payeeIssues(payee: ReleasePayee) {
  const issues: string[] = [];
  if (!payee.name.trim() || payee.document.replace(/\D/g, "").length < 11) issues.push("nome e CPF/CNPJ");
  if (payee.method === "PIX" && !payee.pixKey?.trim()) issues.push("chave PIX");
  if (payee.method === "TED" && !(payee.bank?.trim() && payee.agency?.trim() && payee.account?.trim()))
    issues.push("banco, agência e conta");
  if (payee.amount <= 0) issues.push("valor");
  if (payee.relation === "Terceiro" && !payee.justification?.trim())
    issues.push("justificativa do pagamento a terceiro");
  return issues;
}

/** Identificador de favorecido criado pelo usuário (chamado só em eventos, nunca no render). */
function newPayeeId() {
  return `payee-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;
}

export function ReleasePanel({
  operation,
  onChange,
}: {
  operation: Operation;
  onChange: (operation: Operation) => void;
}) {
  const pricing = normalizedPricing(operation);
  const calculated = pricingCalculation(operation, pricing);
  const offsets =
    repurchaseCalculation(operation, pricing).total + settlementAdjustmentCalculation(operation, pricing).total;
  const netToRelease = roundPricing(operation.pricingReview ? calculated.net - offsets : operation.netAmount);
  const cedentAccounts = cedentBankAccounts[operation.document.replace(/\D/g, "")] ?? [];
  const today = localDateISO();
  const cedentPayee = (account: BankAccount | undefined, id: string): ReleasePayee => ({
    id,
    relation: "Cedente",
    name: operation.cedent,
    document: operation.document,
    method: account?.pixKey ? "PIX" : "TED",
    accountId: account?.id,
    bank: account?.bank,
    agency: account?.agency,
    account: account?.account,
    pixKey: account?.pixKey,
    amount: 0,
  });
  const review: ReleaseReview = operation.releaseReview ?? {
    status: "Em preparação",
    paymentDate: today,
    payees: [{ ...cedentPayee(cedentAccounts[0], "payee-cedente"), amount: netToRelease }],
    audit: [],
  };
  const payees = review.payees ?? [];
  const released = review.status === "Enviada ao financeiro";
  const distributed = roundPricing(payees.reduce((sum, item) => sum + (Number(item.amount) || 0), 0));
  const remaining = roundPricing(netToRelease - distributed);
  const [observation, setObservation] = useState(review.observation ?? "");
  const [feedback, setFeedback] = useState<{ tone: "success" | "warning"; message: string } | null>(null);

  const checks = [
    {
      label: "Valor líquido 100% distribuído",
      ok: Math.abs(remaining) < 0.01,
      detail:
        Math.abs(remaining) < 0.01
          ? "Favorecidos somam o líquido do borderô"
          : remaining > 0
            ? `Faltam ${preciseMoney.format(remaining)} para distribuir`
            : `Excedeu em ${preciseMoney.format(Math.abs(remaining))}`,
    },
    {
      label: "Dados dos favorecidos completos",
      ok: payees.length > 0 && payees.every(item => payeeIssues(item).length === 0),
      detail:
        payees.length === 0
          ? "Inclua ao menos um favorecido"
          : payees
              .filter(item => payeeIssues(item).length)
              .map(item => `${item.name || "Favorecido"}: ${payeeIssues(item).join(", ")}`)
              .join(" · ") || "Contas e chaves informadas",
    },
    {
      label: "Data de pagamento válida",
      ok: Boolean(review.paymentDate) && (review.paymentDate ?? "") >= today,
      detail: review.paymentDate ? `Pagamento em ${formatBrazilianDate(review.paymentDate)}` : "Informe a data",
    },
  ];
  const readyToRelease = checks.every(item => item.ok);

  function save(
    change: Partial<ReleaseReview>,
    audit?: { action: string; detail: string },
    operationChange: Partial<Operation> = {},
  ) {
    const next: ReleaseReview = {
      ...review,
      ...change,
      audit: audit ? [...(review.audit ?? []), { at: releaseNow(), by: "Henrique", ...audit }] : review.audit,
    };
    onChange({ ...operation, ...operationChange, releaseReview: next });
  }
  function updatePayee(id: string, change: Partial<ReleasePayee>) {
    save({ payees: payees.map(item => (item.id === id ? { ...item, ...change } : item)) });
  }
  function chooseCedentAccount(id: string, accountId: string) {
    const account = cedentAccounts.find(item => item.id === accountId);
    updatePayee(id, {
      accountId,
      bank: account?.bank,
      agency: account?.agency,
      account: account?.account,
      pixKey: account?.pixKey,
      method: account?.pixKey ? "PIX" : "TED",
    });
  }
  function addCedentAccount() {
    const used = new Set(payees.map(item => item.accountId));
    const account = cedentAccounts.find(item => !used.has(item.id)) ?? cedentAccounts[0];
    save({ payees: [...payees, { ...cedentPayee(account, newPayeeId()), amount: Math.max(0, remaining) }] });
  }
  function addThirdParty() {
    save({
      payees: [
        ...payees,
        {
          id: `payee-${Date.now()}`,
          relation: "Terceiro",
          name: "",
          document: "",
          method: "PIX",
          amount: Math.max(0, remaining),
          justification: "",
        },
      ],
    });
  }
  function removePayee(id: string) {
    save({ payees: payees.filter(item => item.id !== id) });
  }
  function fillRemaining(id: string) {
    const payee = payees.find(item => item.id === id);
    if (payee) updatePayee(id, { amount: roundPricing((Number(payee.amount) || 0) + remaining) });
  }
  function release() {
    if (!readyToRelease) {
      setFeedback({ tone: "warning", message: "Resolva os itens da conferência antes de liberar para o financeiro." });
      return;
    }
    const createdAt = releaseNow();
    const payables: ReleasePayable[] = payees.map((item, index) => ({
      id: `CP-${operation.borderoNumber}-${String(index + 1).padStart(2, "0")}`,
      payee: item.name,
      document: item.document,
      method: item.method,
      destination: payeeDestination(item),
      amount: roundPricing(item.amount),
      dueDate: review.paymentDate ?? today,
      payingAccount: "Definida pelo financeiro",
      status: "Pendente de pagamento",
      createdAt,
    }));
    save(
      {
        status: "Enviada ao financeiro",
        payables: [...(review.payables ?? []).filter(item => item.status === "Cancelado"), ...payables],
        releasedAt: createdAt,
        releasedBy: "Henrique",
        observation,
      },
      {
        action: "Liberada ao financeiro",
        detail: `${payables.length} lançamento(s) a pagar · ${preciseMoney.format(distributed)} · pagamento em ${formatBrazilianDate(review.paymentDate)}`,
      },
      { status: "Liberada ao financeiro", nextAction: "Aguardando pagamento no financeiro" },
    );
    setFeedback({
      tone: "success",
      message: `${payables.length} lançamento(s) criado(s) no financeiro como pendente de pagamento.`,
    });
  }

  return (
    <section className="approval-workbench release-workbench">
      <div className="approval-hero">
        <div>
          <Badge tone="eyebrow">LIBERAÇÃO</Badge>
          <h3>Pagamento da operação</h3>
          <p>
            Defina os favorecidos, faça as conferências e envie ao financeiro como pendente de pagamento. A conta
            pagadora e o saldo são tratados pelo financeiro.
          </p>
        </div>
        <Badge tone={released ? "ready" : "attention"}>{released ? "Enviada ao financeiro" : "Em preparação"}</Badge>
      </div>
      <div className="release-kpis">
        <div>
          <span>VALOR A LIBERAR</span>
          <strong>{preciseMoney.format(netToRelease)}</strong>
          <small>Líquido do borderô {operation.borderoNumber}</small>
        </div>
        <div>
          <span>DISTRIBUÍDO</span>
          <strong>{preciseMoney.format(distributed)}</strong>
          <small>{payees.length} favorecido(s)</small>
        </div>
        <div>
          <span>SALDO A DISTRIBUIR</span>
          <strong className={Math.abs(remaining) < 0.01 ? "positive" : "negative"}>
            {preciseMoney.format(remaining)}
          </strong>
          <small>{Math.abs(remaining) < 0.01 ? "Distribuição fechada" : "Ajuste os valores"}</small>
        </div>
        <div>
          <span>PAGAMENTO</span>
          <strong>{formatBrazilianDate(review.paymentDate)}</strong>
          <small>{review.paymentDate === today ? "Hoje" : "Agendado"}</small>
        </div>
      </div>
      {feedback && (
        <div className={`release-feedback ${feedback.tone}`}>
          {feedback.tone === "success" ? <CheckIcon /> : <AlertIcon />}
          <span>{feedback.message}</span>
        </div>
      )}

      <section className="approval-card release-card">
        <div className="approval-card-head">
          <div>
            <span>1 · FAVORECIDOS</span>
            <strong>Para quem vai o pagamento</strong>
          </div>
          <small>{payees.length} favorecido(s)</small>
        </div>
        <div className="release-payees">
          {payees.map(payee => {
            const issues = payeeIssues(payee);
            return (
              <div className="release-payee" key={payee.id}>
                <div className="release-payee-head">
                  <div>
                    <Badge tone={payee.relation === "Cedente" ? "live" : "waiting"}>{payee.relation}</Badge>
                    {payee.relation === "Cedente" ? (
                      <strong>
                        {payee.name}
                        <small>{payee.document}</small>
                      </strong>
                    ) : (
                      <strong>
                        Pagamento a terceiro<small>Ex.: fornecedor indicado pelo cedente</small>
                      </strong>
                    )}
                  </div>
                  {!released && (
                    <div className="release-payee-actions">
                      {Math.abs(remaining) >= 0.01 && (
                        <button onClick={() => fillRemaining(payee.id)}>
                          {remaining > 0 ? "+ saldo restante" : "− excedente"}
                        </button>
                      )}
                      {payees.length > 1 && (
                        <button className="danger" onClick={() => removePayee(payee.id)}>
                          Remover
                        </button>
                      )}
                    </div>
                  )}
                </div>
                <div className="release-fields">
                  {payee.relation === "Terceiro" && (
                    <>
                      <label>
                        <span>Nome / razão social</span>
                        <input
                          disabled={released}
                          value={payee.name}
                          onChange={e => updatePayee(payee.id, { name: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>CPF / CNPJ</span>
                        <input
                          disabled={released}
                          value={payee.document}
                          onChange={e => updatePayee(payee.id, { document: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <span>Forma de pagamento</span>
                    <select
                      disabled={released}
                      value={payee.method}
                      onChange={e => updatePayee(payee.id, { method: e.target.value as PaymentMethod })}
                    >
                      {paymentMethods
                        .filter(method => payee.relation === "Cedente" || method !== "Crédito em conta-corrente")
                        .map(method => (
                          <option key={method}>{method}</option>
                        ))}
                    </select>
                  </label>
                  {payee.relation === "Cedente" &&
                    cedentAccounts.length > 0 &&
                    payee.method !== "Crédito em conta-corrente" && (
                      <label>
                        <span>Conta cadastrada</span>
                        <select
                          disabled={released}
                          value={payee.accountId ?? ""}
                          onChange={e => chooseCedentAccount(payee.id, e.target.value)}
                        >
                          {cedentAccounts.map(account => (
                            <option value={account.id} key={account.id}>
                              {account.label} · {account.bank} · CC {account.account}
                            </option>
                          ))}
                        </select>
                      </label>
                    )}
                  {payee.method === "PIX" && (payee.relation === "Terceiro" || cedentAccounts.length === 0) && (
                    <label>
                      <span>Chave PIX</span>
                      <input
                        disabled={released}
                        value={payee.pixKey ?? ""}
                        onChange={e => updatePayee(payee.id, { pixKey: e.target.value })}
                      />
                    </label>
                  )}
                  {payee.method === "TED" && (payee.relation === "Terceiro" || cedentAccounts.length === 0) && (
                    <>
                      <label>
                        <span>Banco</span>
                        <input
                          disabled={released}
                          value={payee.bank ?? ""}
                          onChange={e => updatePayee(payee.id, { bank: e.target.value })}
                          placeholder="Ex.: 341 · Itaú"
                        />
                      </label>
                      <label>
                        <span>Agência</span>
                        <input
                          disabled={released}
                          value={payee.agency ?? ""}
                          onChange={e => updatePayee(payee.id, { agency: e.target.value })}
                        />
                      </label>
                      <label>
                        <span>Conta</span>
                        <input
                          disabled={released}
                          value={payee.account ?? ""}
                          onChange={e => updatePayee(payee.id, { account: e.target.value })}
                        />
                      </label>
                    </>
                  )}
                  <label>
                    <span>Valor</span>
                    <input
                      disabled={released}
                      type="number"
                      min={0}
                      step={0.01}
                      value={payee.amount}
                      onChange={e => updatePayee(payee.id, { amount: Number(e.target.value) })}
                    />
                  </label>
                  {payee.relation === "Terceiro" && (
                    <label className="wide">
                      <span>Justificativa (obrigatória)</span>
                      <input
                        disabled={released}
                        value={payee.justification ?? ""}
                        onChange={e => updatePayee(payee.id, { justification: e.target.value })}
                        placeholder="Ex.: pagamento ao fornecedor conforme autorização assinada pelo cedente"
                      />
                    </label>
                  )}
                </div>
                <small className={`release-destination ${issues.length ? "negative" : ""}`}>
                  {issues.length ? `Pendente: ${issues.join(", ")}` : `Destino: ${payeeDestination(payee)}`}
                </small>
              </div>
            );
          })}
        </div>
        {!released && (
          <div className="release-add">
            <button onClick={addCedentAccount} disabled={!cedentAccounts.length}>
              + Outra conta do cedente
            </button>
            <button onClick={addThirdParty}>+ Pagamento a terceiro</button>
          </div>
        )}
      </section>

      <section className="approval-card release-card">
        <div className="approval-card-head">
          <div>
            <span>2 · CONFERÊNCIA E ENVIO</span>
            <strong>Liberar para o financeiro</strong>
          </div>
          <small>
            {checks.filter(item => item.ok).length}/{checks.length} conferidos
          </small>
        </div>
        <div className="release-send">
          <div className="release-checks">
            {checks.map(item => (
              <div key={item.label} className={item.ok ? "ok" : "pending"}>
                {item.ok ? <CheckIcon /> : <AlertIcon />}
                <span>
                  <strong>{item.label}</strong>
                  <small>{item.detail}</small>
                </span>
              </div>
            ))}
          </div>
          <div className="release-form">
            <label>
              <span>Data do pagamento</span>
              <input
                type="date"
                disabled={released}
                min={today}
                value={review.paymentDate ?? ""}
                onChange={e => save({ paymentDate: e.target.value })}
              />
            </label>
            <label>
              <span>Observação para o financeiro</span>
              <textarea
                disabled={released}
                value={observation}
                onChange={e => setObservation(e.target.value)}
                placeholder="Ex.: pagar até as 15h para cair no mesmo dia · preferência de conta pagadora"
              />
            </label>
            {!released ? (
              <button className="primary-action release-submit" disabled={!readyToRelease} onClick={release}>
                Liberar para o financeiro <ArrowIcon />
              </button>
            ) : (
              <div className="release-done">
                <CheckIcon />
                <span>
                  <strong>Enviada ao financeiro em {review.releasedAt}</strong>
                  <small>
                    por {review.releasedBy} · aguardando pagamento · alterações e estorno somente pelo financeiro
                  </small>
                </span>
              </div>
            )}
          </div>
        </div>
      </section>

      {Boolean(review.payables?.length) && (
        <section className="approval-card release-card">
          <div className="approval-card-head">
            <div>
              <span>FINANCEIRO · CONTAS A PAGAR</span>
              <strong>Lançamentos gerados · conta pagadora definida pelo financeiro</strong>
            </div>
            {released && <small>Estorno somente pelo financeiro</small>}
          </div>
          <div className="release-table">
            <div className="release-table-head">
              <span>Lançamento</span>
              <span>Favorecido</span>
              <span>Destino</span>
              <span>Vencimento</span>
              <span>Valor</span>
              <span>Status</span>
            </div>
            {review.payables!.map(item => (
              <div
                key={`${item.id}-${item.createdAt}-${item.status}`}
                className={item.status === "Cancelado" ? "cancelled" : ""}
              >
                <strong>{item.id}</strong>
                <span>
                  {item.payee}
                  <small>{item.document}</small>
                </span>
                <span>
                  {item.method}
                  <small>{item.destination}</small>
                </span>
                <span>{formatBrazilianDate(item.dueDate)}</span>
                <strong>{preciseMoney.format(item.amount)}</strong>
                <Badge tone={item.status === "Cancelado" ? "cancelled" : "waiting"}>{item.status}</Badge>
              </div>
            ))}
          </div>
        </section>
      )}

      {Boolean(review.audit?.length) && (
        <section className="approval-card release-card">
          <div className="approval-card-head">
            <div>
              <span>TRILHA DA LIBERAÇÃO</span>
              <strong>Quem fez o quê e quando</strong>
            </div>
            <small>Mais recente primeiro</small>
          </div>
          <div className="release-audit">
            {review
              .audit!.slice()
              .reverse()
              .map((item, index) => (
                <div key={`${item.at}-${index}`}>
                  <strong>{item.action}</strong>
                  <small>{item.detail}</small>
                  <em>
                    {item.at} · {item.by}
                  </em>
                </div>
              ))}
          </div>
        </section>
      )}
    </section>
  );
}

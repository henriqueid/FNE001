"use client";

/**
 * Liberações de operações: pagamento aos favorecidos, cobrança e devolução da operação.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { inScope } from "@/src/domain/finance/banking";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import { type FinanceState } from "@/src/domain/finance/model";
import { confirmCollection, isOperationLocked, returnOperation, sendCollection } from "@/src/domain/finance/releases";
import { BY, Field, Modal, StatusChip, br, money, type Action } from "@/src/features/finance/finance-ui";
import { AlertIcon, ArrowIcon, BankIcon, CheckIcon, ClockIcon, LockIcon, UndoIcon } from "@/src/ui/icons";
import { useState } from "react";

export function ReleasesTab({
  state,
  scope,
  operations,
  onAction,
  onApply,
  onOpenOperation,
  onReturn,
}: {
  state: FinanceState;
  scope: string;
  operations: Operation[];
  onAction: (a: NonNullable<Action>) => void;
  onApply: (r: Result) => void;
  onOpenOperation: (op: Operation) => void;
  onReturn: (op: Operation) => void;
}) {
  const today = todayIso();
  const released = operations.filter(
    op =>
      (op.status === "Liberada ao financeiro" || state.titles.some(t => t.operationId === op.id)) &&
      inScope(op.vehicle, scope),
  );
  const pending = operations.filter(op => op.status === "Pronta para liberar" && inScope(op.vehicle, scope));
  return (
    <>
      {released.length === 0 && (
        <section className="fn-card fn-empty-card">
          <BankIcon />
          <div>
            <h2>Nenhuma operação liberada ao financeiro</h2>
            <p>
              Quando a operação for liberada na etapa Liberação, os pagamentos aos favorecidos aparecem aqui para pagar,
              e a compra é contabilizada automaticamente.
            </p>
            {pending.length > 0 && (
              <div className="fn-pending">
                {pending.map(op => (
                  <button key={op.id} className="fn-btn ghost" onClick={() => onOpenOperation(op)}>
                    Abrir {op.cedent} · pronta para liberar <ArrowIcon />
                  </button>
                ))}
              </div>
            )}
          </div>
        </section>
      )}
      {released.map(op => {
        const titles = state.titles.filter(t => t.operationId === op.id && t.origin === "Liberação de operação");
        const active = titles.filter(t => t.status !== "Cancelado");
        const reg = state.registrations[op.id];
        const locked = isOperationLocked(state, op.id);
        const collectionAccounts = state.accounts.filter(
          a => a.active && a.usage.collection && a.company === op.vehicle,
        );
        const paid = active.filter(t => t.status === "Baixado").reduce((s, t) => s + t.amount, 0);
        const total = active.reduce((s, t) => s + t.amount, 0);
        return (
          <section key={op.id} className={`fn-card fn-release ${locked ? "locked" : ""}`}>
            <header className="fn-card-head">
              <div>
                <h2>
                  {op.cedent} · aditivo {op.aditivoNumber}
                </h2>
                <p>
                  {op.vehicle} · borderô {op.borderoNumber} · {op.titleCount} títulos · compra contabilizada em{" "}
                  {state.purchasePosted[op.id] ?? "—"}
                </p>
              </div>
              <div className="fn-release-status">
                {locked ? (
                  <span className="fn-chip lock">
                    <LockIcon /> Em cobrança · registro confirmado {reg?.confirmedAt}
                  </span>
                ) : reg ? (
                  <span className="fn-chip warn">
                    <ClockIcon /> Remessa enviada {reg.sentAt} · aguardando banco
                  </span>
                ) : (
                  <span className="fn-chip">Títulos não enviados à cobrança</span>
                )}
              </div>
            </header>
            <div className="fn-progress">
              <i style={{ width: `${total ? (paid / total) * 100 : 0}%` }} />
              <span>
                {money(paid)} pagos de {money(total)}
              </span>
            </div>
            <div className="fn-table-scroll">
              <table className="fn-table">
                <thead>
                  <tr>
                    <th>Pagamento</th>
                    <th>Favorecido</th>
                    <th className="num">Valor</th>
                    <th>Situação</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {titles.map(t => (
                    <tr key={t.id} className={t.status === "Cancelado" ? "cancelled" : ""}>
                      <td className="date">{br(t.dueDate)}</td>
                      <td>
                        <b>{t.counterparty}</b>
                        <small>
                          {t.id} · {t.counterpartyDocument}
                        </small>
                      </td>
                      <td className="num bad">− {money(t.amount)}</td>
                      <td>
                        <StatusChip title={t} today={today} />
                      </td>
                      <td className="actions">
                        {t.status === "Em aberto" && (
                          <button
                            className="fn-btn small primary"
                            onClick={() => onAction({ type: "settle", title: t })}
                          >
                            Pagar
                          </button>
                        )}
                        {t.status === "Baixado" && (
                          <button
                            className="fn-btn small ghost"
                            onClick={() => onAction({ type: "reverse", title: t })}
                          >
                            <UndoIcon /> Estornar
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <div className="fn-release-actions">
              <button className="fn-btn ghost" onClick={() => onOpenOperation(op)}>
                Abrir operação
              </button>
              {!reg && op.status === "Liberada ao financeiro" && (
                <button
                  className="fn-btn ghost"
                  disabled={!collectionAccounts.length}
                  title={collectionAccounts.length ? "" : "Nenhuma conta com cobrança para este veículo"}
                  onClick={() => onApply(sendCollection(state, op, collectionAccounts[0].id, BY))}
                >
                  Gerar remessa de cobrança · {collectionAccounts[0]?.nickname ?? "sem conta"}
                </button>
              )}
              {reg && !locked && (
                <button className="fn-btn ghost" onClick={() => onApply(confirmCollection(state, op.id))}>
                  <CheckIcon /> Confirmar retorno do banco
                </button>
              )}
              {op.status === "Liberada ao financeiro" && (
                <button
                  className="fn-btn danger-ghost"
                  disabled={locked}
                  title={locked ? "Títulos registrados e confirmados pelo banco: a operação está em cobrança" : ""}
                  onClick={() => onReturn(op)}
                >
                  {locked ? <LockIcon /> : <UndoIcon />} Devolver para a operação
                </button>
              )}
            </div>
            {locked && (
              <p className="fn-note">
                <LockIcon /> Os títulos foram enviados e confirmados pelo banco. A operação está em cobrança e não pode
                mais ser devolvida nem estornada; ajustes seguem pela cobrança (baixa, prorrogação, recompra).
              </p>
            )}
          </section>
        );
      })}
    </>
  );
}

export function ReturnModal({
  op,
  state,
  onClose,
  onDone,
}: {
  op: Operation;
  state: FinanceState;
  onClose: () => void;
  onDone: (r: ReturnType<typeof returnOperation>) => void;
}) {
  const titles = state.titles.filter(
    t => t.operationId === op.id && t.origin === "Liberação de operação" && t.status !== "Cancelado",
  );
  const paid = titles.filter(t => t.status === "Baixado");
  const reconciled = paid.some(t => state.movements.find(m => m.id === t.movementId)?.reconciled);
  const [target, setTarget] = useState(4);
  const [reason, setReason] = useState("");
  const [cash, setCash] = useState<"" | "sim" | "nao">(paid.length ? "" : "nao");
  const [sure, setSure] = useState(false);
  const reg = state.registrations[op.id];
  return (
    <Modal
      wide
      title="Devolver operação para análise"
      subtitle={`${op.cedent} · aditivo ${op.aditivoNumber} · ${op.vehicle}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Não devolver
          </button>
          <button
            className="fn-btn danger"
            disabled={!reason.trim() || !cash || !sure || reconciled}
            onClick={() =>
              onDone(returnOperation(state, op, { targetStage: target, reason, cashMoved: cash === "sim" }, BY))
            }
          >
            <UndoIcon /> Devolver operação
          </button>
        </>
      }
    >
      <div className="fn-steps">
        <h4>O que será desfeito, nesta ordem</h4>
        <ol>
          {paid.length > 0 && (
            <li>
              Estorno de {paid.length} pagamento(s) · {money(paid.reduce((s, t) => s + t.amount, 0))}
            </li>
          )}
          <li>Cancelamento de {titles.length} lançamento(s) de liberação</li>
          <li>Estorno do lançamento contábil da compra {state.purchasePosted[op.id] ?? ""}</li>
          {reg && <li>Remessa enviada e ainda não confirmada: instrução de baixa na próxima remessa</li>}
          <li>Assinaturas invalidadas e operação volta para a etapa escolhida</li>
        </ol>
      </div>
      {reconciled && (
        <p className="fn-warning">
          <AlertIcon /> Há pagamento já conciliado com o extrato. Desconcilie na aba Extrato antes de devolver.
        </p>
      )}
      <div className="fn-form">
        <Field label="Voltar para a etapa">
          <select value={target} onChange={e => setTarget(Number(e.target.value))}>
            {stages.slice(1, 5).map(s => (
              <option key={s.id} value={s.id}>
                {s.id}. {s.title}
              </option>
            ))}
          </select>
        </Field>
      </div>
      {paid.length > 0 && (
        <fieldset className="fn-question">
          <legend>O pagamento ao cedente já saiu do caixa?</legend>
          <label className={cash === "sim" ? "selected" : ""}>
            <input type="radio" name="rcash" checked={cash === "sim"} onChange={() => setCash("sim")} />
            <span>
              <b>Sim, o dinheiro já está com o cedente</b>
              <small>
                O banco não muda. É criado um lançamento a receber de {op.cedent} (débito na conta gráfica) para cobrar
                ou compensar na próxima operação.
              </small>
            </span>
          </label>
          <label className={cash === "nao" ? "selected" : ""}>
            <input type="radio" name="rcash" checked={cash === "nao"} onChange={() => setCash("nao")} />
            <span>
              <b>Não, o pagamento não chegou a sair</b>
              <small>O movimento é estornado no extrato e o saldo volta.</small>
            </span>
          </label>
        </fieldset>
      )}
      <Field label="Motivo da devolução" wide>
        <textarea
          rows={3}
          value={reason}
          onChange={e => setReason(e.target.value)}
          placeholder="Ex.: taxa aplicada diferente da aprovada"
        />
      </Field>
      <label className="fn-check">
        <input type="checkbox" checked={sure} onChange={e => setSure(e.target.checked)} /> Tenho certeza. Todos os
        estornos ficam registrados no histórico da operação e na contabilidade.
      </label>
    </Modal>
  );
}

"use client";

/**
 * Liberações de operações: pagamento aos favorecidos, cobrança e devolução da operação.
 */
import { stages } from "@/src/domain/core/stages";
import { type Operation } from "@/src/domain/core/types";
import { inScope } from "@/src/domain/finance/banking";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import { type FinanceState } from "@/src/domain/finance/model";
import type { PortfolioState } from "@/src/domain/portfolio/model";
import { confirmCollection, isOperationLocked, returnOperation, sendCollection } from "@/src/domain/finance/releases";
import { BY, Field, Modal, StatusChip, br, money, type Action } from "@/src/features/finance/finance-ui";
import { AlertIcon, ArrowIcon, BankIcon, CheckIcon, ClockIcon, LockIcon, UndoIcon } from "@/src/ui/icons";
import { useRef, useState } from "react";

export function ReleasesTab({
  state,
  scope,
  operations,
  onAction,
  onApply,
  onOpenOperation,
  onReturn,
  allowCollectionSimulation = true,
  portfolio,
}: {
  state: FinanceState;
  scope: string;
  operations: Operation[];
  onAction: (a: NonNullable<Action>) => void;
  onApply: (r: Result) => void;
  onOpenOperation: (op: Operation) => void;
  onReturn: (op: Operation) => void;
  allowCollectionSimulation?: boolean;
  portfolio?: PortfolioState;
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
        const bankTitles =
          portfolio?.titles.filter(title => title.operationId === op.id && title.status !== "Cancelado") ?? [];
        const linkedTitles = bankTitles.filter(title =>
          ["Registrado", "Pendente de integração", "Liquidado"].includes(title.bankStatus),
        );
        const locked = allowCollectionSimulation ? isOperationLocked(state, op.id) : linkedTitles.length > 0;
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
                    <LockIcon />{" "}
                    {allowCollectionSimulation
                      ? `Em cobrança · registro confirmado ${reg?.confirmedAt ?? ""}`
                      : `${linkedTitles.length} título(s) com vínculo bancário`}
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
              {allowCollectionSimulation && !reg && op.status === "Liberada ao financeiro" && (
                <button
                  className="fn-btn ghost"
                  disabled={!collectionAccounts.length}
                  title={collectionAccounts.length ? "" : "Nenhuma conta com cobrança para este veículo"}
                  onClick={() => onApply(sendCollection(state, op, collectionAccounts[0].id, BY))}
                >
                  Gerar remessa de cobrança · {collectionAccounts[0]?.nickname ?? "sem conta"}
                </button>
              )}
              {allowCollectionSimulation && reg && !locked && (
                <button className="fn-btn action-confirm" onClick={() => onApply(confirmCollection(state, op.id))}>
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
            {!allowCollectionSimulation && (
              <p className="fn-note">
                Gere remessas e importe o retorno original em Financeiro → Bancos. O registro dos títulos depende da
                resposta do banco.
              </p>
            )}
            {locked && (
              <p className="fn-note">
                <LockIcon /> Há títulos com vínculo bancário ativo. Conclua a baixa bancária e confira o retorno antes
                de devolver a operação.
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
  onReturn,
}: {
  op: Operation;
  state: FinanceState;
  onClose: () => void;
  onDone: (r: ReturnType<typeof returnOperation>) => void | Promise<void>;
  onReturn?: (intent: {
    targetStage: number;
    reason: string;
    cashMoved: boolean;
    date: string;
    commandId: string;
  }) => Promise<void>;
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
  const [date, setDate] = useState(todayIso());
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const pending = useRef<{ key: string; id: string } | null>(null);
  const lock = useRef(false);
  async function submit() {
    if (lock.current) return;
    lock.current = true;
    setBusy(true);
    setError("");
    try {
      if (onReturn) {
        const key = JSON.stringify([target, reason, cash, date]);
        if (pending.current?.key !== key) pending.current = { key, id: crypto.randomUUID() };
        await onReturn({ targetStage: target, reason, cashMoved: cash === "sim", date, commandId: pending.current.id });
      } else
        await onDone(returnOperation(state, op, { targetStage: target, reason, cashMoved: cash === "sim", date }, BY));
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "A devolução não foi confirmada.");
    } finally {
      lock.current = false;
      setBusy(false);
    }
  }
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
            disabled={busy || !reason.trim() || !cash || !sure || reconciled}
            onClick={() => void submit()}
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
          {reg && <li>Registro bancário preservado no histórico; vínculos ativos podem impedir a devolução</li>}
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
            {stages
              .filter(stage => stage.id >= 1 && stage.id <= 5)
              .map(s => (
                <option key={s.id} value={s.id}>
                  {s.id}. {s.title}
                </option>
              ))}
          </select>
        </Field>
        <Field label="Data do estorno">
          <input type="date" value={date} disabled={busy} onChange={event => setDate(event.target.value)} />
        </Field>
      </div>
      {error && (
        <p role="alert" className="fn-warning">
          {error}
        </p>
      )}
      {busy && <p role="status">Confirmando devolução no servidor…</p>}
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

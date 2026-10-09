"use client";
import { todayIso } from "@/src/domain/finance/ledger";
import type { FinanceState, FinanceTitle } from "@/src/domain/finance/model";
import { br, Modal, money, StatusChip } from "@/src/features/finance/finance-ui";
/* aplica uma função a vários lançamentos, acumulando o estado e os erros */

export function HistoryModal({
  state,
  title,
  onClose,
}: {
  state: FinanceState;
  title: FinanceTitle;
  onClose: () => void;
}) {
  const movements = state.movements.filter(m => m.titleId === title.id);
  const entries = state.journal
    .filter(j => j.origin.id === title.id || movements.some(m => m.id === j.origin.id))
    .sort((a, b) => a.id.localeCompare(b.id));
  const linked = state.titles.filter(t => t.linkedTitleId === title.id || t.id === title.linkedTitleId);
  const category = state.categories.find(c => c.id === title.categoryId);
  const name = (code: string) => state.chart.find(c => c.code === code)?.name ?? code;
  const acc = (id: string) => state.accounts.find(a => a.id === id)?.nickname ?? id;
  return (
    <Modal
      wide
      title={`Histórico · ${title.id}`}
      subtitle={`${title.description} · ${title.counterparty}`}
      onClose={onClose}
      footer={
        <button className="fn-btn primary" onClick={onClose}>
          Fechar
        </button>
      }
    >
      <div className="fn-hist-summary">
        <div>
          <span>Tipo</span>
          <b className={title.kind === "Pagar" ? "bad" : "good"}>{title.kind === "Pagar" ? "A pagar" : "A receber"}</b>
        </div>
        <div>
          <span>Valor</span>
          <b>{money(title.amount)}</b>
        </div>
        <div>
          <span>Situação</span>
          <StatusChip title={title} today={todayIso()} />
        </div>
        <div>
          <span>Vencimento</span>
          <b>{br(title.dueDate)}</b>
        </div>
        <div>
          <span>Competência</span>
          <b>{br(title.competenceDate)}</b>
        </div>
        <div>
          <span>Categoria</span>
          <b>{category?.name ?? title.origin}</b>
        </div>
        <div>
          <span>Empresa</span>
          <b>{title.company}</b>
        </div>
        <div>
          <span>Origem</span>
          <b>{title.origin}</b>
        </div>
      </div>
      <h4 className="fn-hist-h">Linha do tempo</h4>
      <ol className="fn-timeline">
        {title.history.map((h, i) => (
          <li key={i}>
            <i />
            <div>
              <b>{h.action}</b>
              <time>
                {h.at} · {h.by}
              </time>
              <span>{h.detail}</span>
            </div>
          </li>
        ))}
      </ol>
      {movements.length > 0 && (
        <>
          <h4 className="fn-hist-h">Movimentos bancários</h4>
          <div className="fn-mini-list">
            {movements.map(m => (
              <p key={m.id}>
                <span>
                  {m.id} · {br(m.date)} · {acc(m.accountId)} · {m.kind}
                  {m.reconciled ? " · conciliado" : ""}
                  {m.reversedBy ? ` · estornado por ${m.reversedBy}` : ""}
                </span>
                <b className={m.amount < 0 ? "bad" : "good"}>{money(m.amount)}</b>
              </p>
            ))}
          </div>
        </>
      )}
      {linked.length > 0 && (
        <>
          <h4 className="fn-hist-h">Lançamentos ligados</h4>
          <div className="fn-mini-list">
            {linked.map(t => (
              <p key={t.id}>
                <span>
                  {t.id} · {t.description} · {t.status}
                </span>
                <b>{money(t.amount)}</b>
              </p>
            ))}
          </div>
        </>
      )}
      <h4 className="fn-hist-h">Lançamentos contábeis</h4>
      {entries.length ? (
        <div className="fn-journal">
          {entries.map(j => (
            <article key={j.id} className={j.reversedBy ? "reversed" : j.reversalOf ? "reversal" : ""}>
              <header>
                <b>{j.id}</b>
                <span>{br(j.date)}</span>
                <span>{j.history}</span>
                {j.reversalOf && <em className="fn-chip warn">Estorno de {j.reversalOf}</em>}
                {j.reversedBy && <em className="fn-chip muted">Estornado por {j.reversedBy}</em>}
              </header>
              <table>
                <tbody>
                  {j.lines.map((l, i) => (
                    <tr key={i}>
                      <td>{l.ledger}</td>
                      <td>{name(l.ledger)}</td>
                      <td className="num">{l.debit ? money(l.debit) : ""}</td>
                      <td className="num">{l.credit ? money(l.credit) : ""}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </article>
          ))}
        </div>
      ) : (
        <p className="fn-note">
          Sem lançamento contábil próprio (título de controle ou liberação contabilizada na compra da operação).
        </p>
      )}
    </Modal>
  );
}

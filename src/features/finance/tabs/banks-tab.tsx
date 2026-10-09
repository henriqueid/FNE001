"use client";

/**
 * Contas bancárias da empresa: cadastro, finalidades, convênio de cobrança e saldo mínimo.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { accountBalance, inScope, saveAccount } from "@/src/domain/finance/banking";
import { todayIso, type Result } from "@/src/domain/finance/ledger";
import { bankList, type BankAccountType, type CompanyBankAccount, type FinanceState } from "@/src/domain/finance/model";
import { Field, Modal, formatMoneyInput, money, parseMoneyBR } from "@/src/features/finance/finance-ui";
import { PlusIcon } from "@/src/ui/icons";
import { useState } from "react";

export function BanksTab({
  state,
  scope,
  onApply,
}: {
  state: FinanceState;
  scope: string;
  onApply: (r: Result) => boolean;
}) {
  const [editing, setEditing] = useState<CompanyBankAccount | null>(null);
  const blank: CompanyBankAccount = {
    id: "",
    company: scope === "Consolidado" ? destinations[3].name : scope,
    bankCode: "341",
    bankName: "Itaú Unibanco",
    agency: "",
    account: "",
    type: "Conta movimento",
    nickname: "",
    usage: { payments: true, receipts: true, collection: false },
    openingBalance: 0,
    openingDate: todayIso(),
    minimumBalance: 0,
    ledgerCode: "",
    active: true,
  };
  const list = state.accounts.filter(a => inScope(a.company, scope));
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Configuração de bancos</h2>
          <p>Contas de cada empresa e veículo, finalidades, carteira de cobrança, saldo de abertura e saldo mínimo</p>
        </div>
        <button className="fn-btn primary" onClick={() => setEditing(blank)}>
          <PlusIcon /> Nova conta
        </button>
      </header>
      <div className="fn-table-scroll">
        <table className="fn-table">
          <thead>
            <tr>
              <th>Conta</th>
              <th>Empresa</th>
              <th>Tipo e finalidades</th>
              <th>Cobrança</th>
              <th className="num">Saldo atual</th>
              <th className="num">Mínimo</th>
              <th>Contábil</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {list.map(a => (
              <tr key={a.id} className={a.active ? "" : "cancelled"}>
                <td>
                  <b>{a.nickname}</b>
                  <small>
                    {a.bankCode} {a.bankName} · ag {a.agency} · cc {a.account}
                    {a.pixKey ? ` · Pix ${a.pixKey}` : ""}
                  </small>
                </td>
                <td>
                  <small>{a.company}</small>
                </td>
                <td>
                  {a.type}
                  <small>
                    {[
                      a.usage.payments && "pagamentos",
                      a.usage.receipts && "recebimentos",
                      a.usage.collection && "cobrança",
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </small>
                </td>
                <td>
                  {a.collection ? (
                    <small>
                      {a.collection.layout} · convênio {a.collection.agreement} · carteira {a.collection.wallet}
                    </small>
                  ) : (
                    <small>—</small>
                  )}
                </td>
                <td className="num">{money(accountBalance(state, a.id))}</td>
                <td className="num">{money(a.minimumBalance)}</td>
                <td>
                  <small>{a.ledgerCode}</small>
                </td>
                <td className="actions">
                  <button className="fn-btn small ghost" onClick={() => setEditing(a)}>
                    Editar
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {editing && (
        <AccountModal
          account={editing}
          isNew={!editing.id}
          hasMoves={state.movements.some(m => m.accountId === editing.id)}
          onClose={() => setEditing(null)}
          onSave={a => {
            if (onApply(saveAccount(state, a))) setEditing(null);
          }}
        />
      )}
    </section>
  );
}

export function AccountModal({
  account,
  isNew,
  hasMoves,
  onClose,
  onSave,
}: {
  account: CompanyBankAccount;
  isNew: boolean;
  hasMoves: boolean;
  onClose: () => void;
  onSave: (a: CompanyBankAccount) => void;
}) {
  const [a, setA] = useState<CompanyBankAccount>(account);
  const set = (change: Partial<CompanyBankAccount>) => setA(prev => ({ ...prev, ...change }));
  // Valores digitados ficam como texto até salvar (aceita "1.500,55").
  const [opening, setOpening] = useState(formatMoneyInput(account.openingBalance));
  const [minimum, setMinimum] = useState(formatMoneyInput(account.minimumBalance));
  return (
    <Modal
      wide
      title={isNew ? "Nova conta bancária" : `Editar ${account.nickname}`}
      subtitle={
        hasMoves
          ? "Conta com movimentos: empresa, saldo e data de abertura ficam travados."
          : "O saldo de abertura gera o lançamento contábil inicial."
      }
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn primary"
            onClick={() =>
              onSave({
                ...a,
                openingBalance: parseMoneyBR(opening),
                minimumBalance: parseMoneyBR(minimum),
                nickname: a.nickname || `${a.bankName} ${a.type === "Conta cobrança" ? "cobrança" : "movimento"}`,
              })
            }
          >
            {isNew ? "Cadastrar conta" : "Salvar alterações"}
          </button>
        </>
      }
    >
      <div className="fn-form">
        <Field label="Empresa ou veículo">
          <select disabled={hasMoves} value={a.company} onChange={e => set({ company: e.target.value })}>
            {destinations.map(d => (
              <option key={d.name}>{d.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Banco">
          <select
            value={a.bankCode}
            onChange={e =>
              set({ bankCode: e.target.value, bankName: bankList.find(b => b[0] === e.target.value)?.[1] ?? "" })
            }
          >
            {bankList.map(([code, n]) => (
              <option key={code} value={code}>
                {code} · {n}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Agência">
          <input value={a.agency} onChange={e => set({ agency: e.target.value })} />
        </Field>
        <Field label="Conta com dígito">
          <input value={a.account} onChange={e => set({ account: e.target.value })} />
        </Field>
        <Field label="Apelido">
          <input
            value={a.nickname}
            onChange={e => set({ nickname: e.target.value })}
            placeholder="Ex.: Itaú movimento"
          />
        </Field>
        <Field label="Tipo">
          <select value={a.type} onChange={e => set({ type: e.target.value as BankAccountType })}>
            {[
              "Conta movimento",
              "Conta cobrança",
              "Conta vinculada (escrow)",
              "Aplicação automática",
              "Caixa interno",
            ].map(t => (
              <option key={t}>{t}</option>
            ))}
          </select>
        </Field>
        <Field label="Chave Pix">
          <input value={a.pixKey ?? ""} onChange={e => set({ pixKey: e.target.value })} />
        </Field>
        <Field label="Saldo de abertura (R$)">
          <input
            disabled={hasMoves}
            inputMode="decimal"
            value={opening}
            placeholder="0,00"
            onChange={e => setOpening(e.target.value)}
            onBlur={() => setOpening(formatMoneyInput(parseMoneyBR(opening)))}
          />
        </Field>
        <Field label="Data de abertura">
          <input
            disabled={hasMoves}
            type="date"
            value={a.openingDate}
            onChange={e => set({ openingDate: e.target.value })}
          />
        </Field>
        <Field label="Saldo mínimo de segurança (R$)">
          <input
            inputMode="decimal"
            value={minimum}
            placeholder="0,00"
            onChange={e => setMinimum(e.target.value)}
            onBlur={() => setMinimum(formatMoneyInput(parseMoneyBR(minimum)))}
          />
        </Field>
      </div>
      <fieldset className="fn-usage">
        <legend>Finalidades</legend>
        <label className="fn-check">
          <input
            type="checkbox"
            checked={a.usage.payments}
            onChange={e => set({ usage: { ...a.usage, payments: e.target.checked } })}
          />{" "}
          Pagamentos (liberações, fornecedores)
        </label>
        <label className="fn-check">
          <input
            type="checkbox"
            checked={a.usage.receipts}
            onChange={e => set({ usage: { ...a.usage, receipts: e.target.checked } })}
          />{" "}
          Recebimentos
        </label>
        <label className="fn-check">
          <input
            type="checkbox"
            checked={a.usage.collection}
            onChange={e =>
              set({
                usage: { ...a.usage, collection: e.target.checked },
                collection: e.target.checked
                  ? (a.collection ?? { agreement: "", wallet: "", layout: "CNAB 240", nextOurNumber: 1 })
                  : undefined,
              })
            }
          />{" "}
          Carteira de cobrança (registro de boletos)
        </label>
        <label className="fn-check">
          <input type="checkbox" checked={a.active} onChange={e => set({ active: e.target.checked })} /> Conta ativa
        </label>
      </fieldset>
      {a.usage.collection && a.collection && (
        <div className="fn-form">
          <Field label="Convênio">
            <input
              value={a.collection.agreement}
              onChange={e => set({ collection: { ...a.collection!, agreement: e.target.value } })}
            />
          </Field>
          <Field label="Carteira">
            <input
              value={a.collection.wallet}
              onChange={e => set({ collection: { ...a.collection!, wallet: e.target.value } })}
            />
          </Field>
          <Field label="Leiaute">
            <select
              value={a.collection.layout}
              onChange={e =>
                set({ collection: { ...a.collection!, layout: e.target.value as "CNAB 240" | "CNAB 400" } })
              }
            >
              <option>CNAB 240</option>
              <option>CNAB 400</option>
            </select>
          </Field>
          <Field label="Próximo nosso número">
            <input
              inputMode="numeric"
              value={String(a.collection.nextOurNumber)}
              onChange={e => set({ collection: { ...a.collection!, nextOurNumber: Number(e.target.value) || 1 } })}
            />
          </Field>
        </div>
      )}
    </Modal>
  );
}

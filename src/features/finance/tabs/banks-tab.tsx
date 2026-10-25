"use client";

/**
 * Contas bancárias da empresa: cadastro, finalidades, convênio de cobrança e saldo mínimo.
 */
import { useCompanyDestinations } from "@/src/app/company-context";
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
  editable = false,
  onConfigure,
  error,
  saving = false,
  onEdit,
}: {
  state: FinanceState;
  scope: string;
  onApply?: (r: Result) => boolean | Promise<boolean>;
  editable?: boolean;
  onConfigure?: () => void;
  error?: string;
  saving?: boolean;
  onEdit?: () => void;
}) {
  const destinations = useCompanyDestinations();
  const [editing, setEditing] = useState<CompanyBankAccount | null>(null);
  const blank: CompanyBankAccount = {
    id: "",
    company: scope === "Consolidado" ? (destinations[0]?.name ?? "") : scope,
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
          <h2>{editable ? "Bancos e remessas" : "Bancos configurados"}</h2>
          <p>
            {editable
              ? "Cadastre contas e configure as remessas de cada empresa."
              : "Consulte contas, finalidades e saldos. O cadastro fica em Configurações → Bancos e remessas."}
          </p>
        </div>
        {editable && onApply && (
          <button
            className="fn-btn primary"
            onClick={() => {
              onEdit?.();
              setEditing(blank);
            }}
          >
            <PlusIcon /> Nova conta
          </button>
        )}
        {!editable && onConfigure && (
          <button className="fn-btn" onClick={onConfigure}>
            Gerenciar em Configurações
          </button>
        )}
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
              {editable && onApply && <th />}
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
                {editable && onApply && (
                  <td className="actions">
                    <button
                      className="fn-btn small ghost"
                      onClick={() => {
                        onEdit?.();
                        setEditing(a);
                      }}
                    >
                      Editar
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!list.length && <p className="fn-note">Nenhuma conta bancária configurada para esta empresa.</p>}
      {editable && onApply && editing && (
        <AccountModal
          account={editing}
          error={error}
          saving={saving}
          isNew={!editing.id}
          hasMoves={state.movements.some(m => m.accountId === editing.id)}
          onClose={() => setEditing(null)}
          onSave={async a => {
            if (await onApply(saveAccount(state, a))) setEditing(null);
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
  error,
  saving = false,
}: {
  account: CompanyBankAccount;
  isNew: boolean;
  hasMoves: boolean;
  onClose: () => void;
  onSave: (a: CompanyBankAccount) => void;
  error?: string;
  saving?: boolean;
}) {
  const destinations = useCompanyDestinations();
  const [a, setA] = useState<CompanyBankAccount>(account);
  const set = (change: Partial<CompanyBankAccount>) => setA(prev => ({ ...prev, ...change }));
  const [interestMode, setInterestMode] = useState<"daily" | "monthly">(
    account.collection?.monthlyInterestPercent !== undefined ? "monthly" : "daily",
  );
  const [monthlyInterest, setMonthlyInterest] = useState(account.collection?.monthlyInterestPercent?.toFixed(2) ?? "");
  const [lateFine, setLateFine] = useState(account.collection?.lateFinePercent?.toFixed(2) ?? "");
  const bankAssignsOurNumber = a.bankCode === "341" && a.collection?.wallet.trim() === "112";
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
            disabled={saving}
            onClick={() =>
              onSave({
                ...a,
                openingBalance: parseMoneyBR(opening),
                minimumBalance: parseMoneyBR(minimum),
                nickname: a.nickname || `${a.bankName} ${a.type === "Conta cobrança" ? "cobrança" : "movimento"}`,
              })
            }
          >
            {saving ? "Salvando…" : isNew ? "Cadastrar conta" : "Salvar alterações"}
          </button>
        </>
      }
    >
      {error && (
        <p className="fn-warning" role="alert">
          {error}
        </p>
      )}
      <h3 className="fn-bank-section-title">Dados da conta</h3>
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
            onChange={e => {
              const bankCode = e.target.value;
              if (bankCode !== "341") setLateFine("");
              set({
                bankCode,
                bankName: bankList.find(b => b[0] === bankCode)?.[1] ?? "",
                collection:
                  a.collection && bankCode !== "341"
                    ? {
                        ...a.collection,
                        lateFinePercent: undefined,
                        lateFineDaysAfterDue: undefined,
                        sendPayerEmail: undefined,
                      }
                    : a.collection,
              });
            }}
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
        <Field label={a.collection?.layout === "CNAB 400" ? "Conta sem dígito (CNAB 400)" : "Conta com dígito"}>
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
      </div>
      <details className="fn-bank-details">
        <summary>Saldos e dados complementares</summary>
        <div className="fn-form">
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
      </details>
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
                  ? (a.collection ?? { agreement: "", wallet: "", layout: "CNAB 240", nextOurNumber: 0 })
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
        <section className="fn-bank-section">
          <h3 className="fn-bank-section-title">Remessas de cobrança</h3>
          <p className="fn-note">
            Use os dados do convênio contratado com o banco. Os campos abaixo variam conforme o leiaute.
          </p>
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
            {bankAssignsOurNumber ? (
              <p className="fn-note fn-field wide">
                Na carteira Itaú 112, o banco atribui o nosso número e o informa no retorno. A sequência de remessa
                abaixo continua obrigatória.
              </p>
            ) : (
              <Field label="Próximo nosso número (obrigatório)">
                <input
                  required
                  type="number"
                  min={1}
                  step={1}
                  inputMode="numeric"
                  value={a.collection.nextOurNumber || ""}
                  onChange={e => set({ collection: { ...a.collection!, nextOurNumber: Number(e.target.value) } })}
                />
              </Field>
            )}
            {a.collection.layout === "CNAB 400" && (
              <>
                <Field label="Dígito da conta (obrigatório)">
                  <input
                    required
                    inputMode="numeric"
                    maxLength={1}
                    value={a.collection.accountDigit ?? ""}
                    onChange={e => set({ collection: { ...a.collection!, accountDigit: e.target.value } })}
                  />
                </Field>
                <Field label="Beneficiário · CPF/CNPJ" hint="Documento real do titular do convênio.">
                  <input
                    required
                    value={a.collection.beneficiaryDocument ?? ""}
                    onChange={e => set({ collection: { ...a.collection!, beneficiaryDocument: e.target.value } })}
                  />
                </Field>
                <Field label="Beneficiário · Nome ou razão social">
                  <input
                    required
                    value={a.collection.beneficiaryName ?? ""}
                    onChange={e => set({ collection: { ...a.collection!, beneficiaryName: e.target.value } })}
                  />
                </Field>
                <Field
                  label="Próxima sequência de remessa"
                  hint="Use a sequência acordada com o banco; a numeração não pode retroceder."
                >
                  <input
                    required
                    type="number"
                    min={1}
                    step={1}
                    value={a.collection.nextRemittanceSequence ?? ""}
                    onChange={e =>
                      set({
                        collection: {
                          ...a.collection!,
                          nextRemittanceSequence: e.target.value ? Number(e.target.value) : undefined,
                        },
                      })
                    }
                  />
                </Field>
                <h3 className="fn-bank-section-title fn-field wide">Juros, multa e instruções</h3>
                <Field label="Modalidade de juros">
                  <select
                    value={interestMode}
                    onChange={e => {
                      setInterestMode(e.target.value as "daily" | "monthly");
                      setMonthlyInterest("");
                      set({
                        collection: {
                          ...a.collection!,
                          dailyInterestCents: undefined,
                          monthlyInterestPercent: undefined,
                        },
                      });
                    }}
                  >
                    <option value="daily">Valor fixo diário em centavos</option>
                    <option value="monthly">Percentual mensal (base de 30 dias)</option>
                  </select>
                </Field>
                {interestMode === "monthly" ? (
                  <Field
                    label="Juros mensal (% a.m.)"
                    hint="Informe a taxa contratada com até duas casas decimais. A remessa usa o equivalente diário em base de 30 dias."
                  >
                    <input
                      required
                      type="number"
                      min={0}
                      step="0.01"
                      inputMode="decimal"
                      max={100}
                      value={monthlyInterest}
                      onChange={e => {
                        setMonthlyInterest(e.target.value);
                        set({
                          collection: {
                            ...a.collection!,
                            monthlyInterestPercent: e.target.value === "" ? undefined : Number(e.target.value),
                            dailyInterestCents: undefined,
                          },
                        });
                      }}
                      onBlur={() => {
                        if (/^\d+(?:\.\d{0,2})?$/.test(monthlyInterest))
                          setMonthlyInterest(Number(monthlyInterest).toFixed(2));
                      }}
                    />
                  </Field>
                ) : (
                  <Field label="Juros por dia em centavos (obrigatório; informe 0 sem juros)">
                    <input
                      required
                      type="number"
                      min={0}
                      step={1}
                      value={a.collection.dailyInterestCents ?? ""}
                      onChange={e =>
                        set({
                          collection: {
                            ...a.collection!,
                            dailyInterestCents: e.target.value === "" ? undefined : Number(e.target.value),
                            monthlyInterestPercent: undefined,
                          },
                        })
                      }
                    />
                  </Field>
                )}
                {a.bankCode === "341" && (
                  <details
                    className="fn-bank-details fn-field wide"
                    open={
                      (account.collection?.lateFinePercent ?? 0) > 0 ||
                      account.collection?.sendPayerEmail === true ||
                      undefined
                    }
                  >
                    <summary>Multa e envio de e-mail (opcional)</summary>
                    <div className="fn-form">
                      <Field
                        label="Multa (%)"
                        hint="Informe o percentual contratado com até duas casas decimais; 0 significa sem multa."
                      >
                        <input
                          type="number"
                          min={0}
                          max="99.99"
                          step="0.01"
                          inputMode="decimal"
                          value={lateFine}
                          onChange={e => {
                            setLateFine(e.target.value);
                            set({
                              collection: {
                                ...a.collection!,
                                lateFinePercent: e.target.value === "" ? undefined : Number(e.target.value),
                              },
                            });
                          }}
                          onBlur={() => {
                            if (/^\d+(?:\.\d{0,2})?$/.test(lateFine)) setLateFine(Number(lateFine).toFixed(2));
                          }}
                        />
                      </Field>
                      <Field
                        label="Dias após o vencimento para cobrar multa"
                        hint="Obrigatório quando há multa. Informe 0 para iniciar na data do vencimento; máximo de 365 dias."
                      >
                        <input
                          required={(a.collection.lateFinePercent ?? 0) > 0}
                          type="number"
                          min={0}
                          max={365}
                          step={1}
                          inputMode="numeric"
                          value={a.collection.lateFineDaysAfterDue ?? ""}
                          onChange={e =>
                            set({
                              collection: {
                                ...a.collection!,
                                lateFineDaysAfterDue: e.target.value === "" ? undefined : Number(e.target.value),
                              },
                            })
                          }
                        />
                      </Field>
                      <label className="fn-check">
                        <input
                          type="checkbox"
                          checked={a.collection.sendPayerEmail === true}
                          onChange={e => set({ collection: { ...a.collection!, sendPayerEmail: e.target.checked } })}
                        />
                        Incluir e-mail do sacado na remessa Itaú (registro 5)
                      </label>
                    </div>
                  </details>
                )}
                {a.bankCode === "237" && (
                  <label className="fn-check">
                    <input
                      type="checkbox"
                      checked={a.collection.finalBeneficiaryEnabled === true}
                      onChange={e =>
                        set({ collection: { ...a.collection!, finalBeneficiaryEnabled: e.target.checked } })
                      }
                    />
                    Cadastro de beneficiário final habilitado pelo Bradesco para duplicatas adquiridas
                  </label>
                )}
                <p className="fn-note fn-field wide">
                  Informe a agência e a conta somente com números, sem dígito. Itaú: carteiras 109 e 112. Na 112, o
                  nosso número é atribuído pelo banco no retorno. Bradesco: carteiras 09 ou 19, com convênio real. A
                  geração exige cadastro completo do sacado e do cedente.
                </p>
              </>
            )}
          </div>
        </section>
      )}
    </Modal>
  );
}

"use client";
/** Geração/recuperação de remessas e importação transacional de retorno, sem transmissão bancária. */
import { useMemo, useRef, useState } from "react";
import type { FinanceState } from "@/src/domain/finance/model";
import { portfolioBalance, type PortfolioState } from "@/src/domain/portfolio/model";
import { submitBankingCommand, recoverBankingRemittance, downloadBankingFile } from "@/src/app/banking-client";
import type { BankingCommand } from "@/src/server/banking/service";
import { Field, money } from "./finance-ui";
export function BankingPanel({
  state,
  portfolio,
  scope = "Consolidado",
  onCommitted,
}: {
  state: FinanceState;
  portfolio: PortfolioState;
  scope?: string;
  onCommitted: () => Promise<void>;
}) {
  const accounts = useMemo(
    () =>
      state.accounts.filter(
        a =>
          a.active &&
          a.usage.collection &&
          a.collection?.layout === "CNAB 400" &&
          (scope === "Consolidado" || a.company === scope),
      ),
    [state.accounts, scope],
  );
  const [accountId, setAccountId] = useState(""),
    [selected, setSelected] = useState<string[]>([]),
    [busy, setBusy] = useState(false),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [recovery, setRecovery] = useState("");
  const last = useRef<{ payload: string; command: BankingCommand } | null>(null),
    account = accounts.find(a => a.id === accountId);
  const titles = portfolio.titles.filter(
    t => t.company === account?.company && t.bankStatus === "Sem boleto" && !t.ourNumber && portfolioBalance(t) > 0,
  );
  async function execute(
    input:
      | Omit<Extract<BankingCommand, { action: "remittance" }>, "commandId">
      | Omit<Extract<BankingCommand, { action: "return" }>, "commandId">,
  ) {
    const payload = JSON.stringify(input);
    if (last.current?.payload !== payload)
      last.current = { payload, command: { ...input, commandId: crypto.randomUUID() } as BankingCommand };
    setBusy(true);
    setError("");
    setMessage("");
    try {
      const result = await submitBankingCommand(last.current!.command);
      setRecovery(result.commandId);
      setMessage(result.message);
      await onCommitted();
      if (result.content) downloadBankingFile(result);
      setSelected([]);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Comando bancário não concluído.");
    } finally {
      setBusy(false);
    }
  }
  async function importFile(file: File | undefined) {
    if (!file) return;
    if (file.size > 4_000_000) {
      setError("O retorno deve ter no máximo 4 MB.");
      return;
    }
    const bytes = new Uint8Array(await file.arrayBuffer());
    if (bytes.some(byte => byte > 127)) {
      setError("O retorno deve ser um arquivo ASCII original do banco.");
      return;
    }
    const content = new TextDecoder("ascii").decode(bytes);
    await execute({ action: "return", accountId, content });
  }
  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>Arquivos de cobrança CNAB 400</h2>
          <p>
            Itaú (109/112) e Bradesco (09/19) · geração e importação locais. Envio e homologação são feitos no banco.
          </p>
        </div>
      </header>
      <div className="fn-form">
        <Field label="Conta de cobrança">
          <select
            value={accountId}
            disabled={busy}
            onChange={e => {
              setAccountId(e.target.value);
              setSelected([]);
              last.current = null;
            }}
          >
            <option value="">Selecione uma conta configurada</option>
            {accounts.map(a => (
              <option key={a.id} value={a.id}>
                {a.company} · {a.nickname}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Chave de remessa para recuperar arquivo">
          <input value={recovery} onChange={e => setRecovery(e.target.value)} placeholder="Chave exibida após gerar" />
        </Field>
        <button
          className="fn-btn"
          disabled={busy || !accountId || !recovery.trim()}
          onClick={async () => {
            setBusy(true);
            setError("");
            try {
              downloadBankingFile(await recoverBankingRemittance(accountId, recovery.trim()));
            } catch (reason) {
              setError(reason instanceof Error ? reason.message : "Remessa não encontrada.");
            } finally {
              setBusy(false);
            }
          }}
        >
          Recuperar remessa gravada
        </button>
      </div>
      {account && (
        <>
          <p>
            Sequência de remessa: {account.collection?.nextRemittanceSequence ?? "configuração pendente"}. A numeração é
            reservada pelo servidor junto com o arquivo.
          </p>
          {account.bankCode === "341" && account.collection?.wallet.trim() === "112" && (
            <p className="fn-note">
              Carteira Itaú 112: a remessa solicita o registro, e o nosso número é atribuído pelo banco no retorno. O
              arquivo conserva a sequência de remessa.
            </p>
          )}
          <div className="fn-table-scroll">
            <table className="fn-table">
              <thead>
                <tr>
                  <th>Incluir</th>
                  <th>Documento</th>
                  <th>Cedente</th>
                  <th>Sacado</th>
                  <th>Vencimento</th>
                  <th className="num">Saldo</th>
                </tr>
              </thead>
              <tbody>
                {titles.map(t => (
                  <tr key={t.id}>
                    <td>
                      <input
                        type="checkbox"
                        aria-label={`Incluir ${t.documentNumber}`}
                        checked={selected.includes(t.id)}
                        disabled={busy}
                        onChange={e =>
                          setSelected(previous =>
                            e.target.checked ? [...previous, t.id] : previous.filter(id => id !== t.id),
                          )
                        }
                      />
                    </td>
                    <td>{t.documentNumber}</td>
                    <td>{t.ownerName}</td>
                    <td>{t.debtorName}</td>
                    <td>{t.dueDate}</td>
                    <td className="num">{money(portfolioBalance(t))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!titles.length && <p>Não há títulos sem vínculo bancário nesta empresa.</p>}
          <div className="fn-actions">
            <button
              className="fn-btn primary"
              disabled={busy || !selected.length}
              onClick={() => void execute({ action: "remittance", accountId, titleIds: selected })}
            >
              Gerar remessa selecionada
            </button>
            <Field label="Importar arquivo retorno original">
              <input
                type="file"
                accept=".ret,.txt"
                disabled={busy}
                onChange={e => {
                  const file = e.target.files?.[0];
                  e.target.value = "";
                  void importFile(file).catch(reason =>
                    setError(reason instanceof Error ? reason.message : "Não foi possível ler o arquivo."),
                  );
                }}
              />
            </Field>
          </div>
        </>
      )}
      {!accounts.length && (
        <p>
          Configure uma conta ativa CNAB 400 em Configurações → Bancos e remessas com dados reais do beneficiário,
          carteira e sequência. Escolha juros diários em centavos ou percentual mensal em base de 30 dias, sem taxas
          presumidas.
        </p>
      )}
      {busy && <p role="status">Processando arquivo e atualização da carteira…</p>}
      {message && (
        <p role="status">
          {message} Chave: {recovery}
        </p>
      )}
      {error && <p role="alert">{error}</p>}
    </section>
  );
}

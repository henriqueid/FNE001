"use client";

/** Centraliza arquivos de cobrança e posição bancária dos títulos por empresa. */
import { inScope } from "@/src/domain/finance/banking";
import type { FinanceState } from "@/src/domain/finance/model";
import { portfolioBalance, type PortfolioBankStatus, type PortfolioState } from "@/src/domain/portfolio/model";
import { BankingPanel } from "@/src/features/finance/banking-panel";
import { br, money } from "@/src/features/finance/finance-ui";

const bankStatuses: PortfolioBankStatus[] = [
  "Sem boleto",
  "Pendente de integração",
  "Registrado",
  "Baixado",
  "Liquidado",
];

export function CollectionTab({
  state,
  portfolio,
  scope,
  onCommitted,
  onConfigureBanks,
}: {
  state: FinanceState;
  portfolio?: PortfolioState;
  scope: string;
  onCommitted?: () => Promise<void>;
  onConfigureBanks?: () => void;
}) {
  const titles = portfolio?.titles.filter(t => t.status !== "Cancelado" && inScope(t.company ?? "", scope)) ?? [];
  return (
    <>
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Cobrança</h2>
            <p>Gere remessas, importe retornos e acompanhe o registro e a liquidação dos títulos.</p>
            <p>
              CNAB 400 Itaú e Bradesco disponíveis para contas compatíveis. Uso bancário exige homologação do convênio;
              outros bancos e layouts ainda não são atendidos por esta rotina.
            </p>
          </div>
          {onConfigureBanks && (
            <button className="fn-btn" onClick={onConfigureBanks}>
              Configurar contas de cobrança
            </button>
          )}
        </header>
      </section>
      {portfolio && onCommitted ? (
        <BankingPanel state={state} portfolio={portfolio} scope={scope} onCommitted={onCommitted} />
      ) : (
        <p className="fn-note">Arquivos bancários disponíveis no ambiente autenticado com carteira carregada.</p>
      )}
      <section className="fn-card">
        <header className="fn-card-head">
          <div>
            <h2>Situação bancária da carteira</h2>
            <p>Remessa gerada aguarda retorno do banco para confirmar registro. Baixado indica baixa bancária.</p>
          </div>
        </header>
        {!portfolio ? (
          <p role="status">Carteira bancária indisponível neste ambiente.</p>
        ) : (
          <>
            <div className="fn-sums">
              {bankStatuses.map(status => (
                <span key={status}>
                  {status} <b>{titles.filter(t => t.bankStatus === status).length}</b>
                </span>
              ))}
              <span>
                Saldo em carteira <b>{money(titles.reduce((sum, t) => sum + portfolioBalance(t), 0))}</b>
              </span>
            </div>
            {!titles.length ? (
              <p>Nenhum título na empresa selecionada.</p>
            ) : (
              <div className="fn-table-scroll">
                <table className="fn-table">
                  <thead>
                    <tr>
                      <th>Documento</th>
                      <th>Cedente / Sacado</th>
                      <th>Vencimento</th>
                      <th>Situação do título</th>
                      <th>Situação bancária</th>
                      <th>Banco / Carteira</th>
                      <th>Nosso número</th>
                      <th className="num">Saldo</th>
                    </tr>
                  </thead>
                  <tbody>
                    {titles.map(t => (
                      <tr key={t.id}>
                        <td>
                          <b>{t.documentNumber}</b>
                          <small>{t.company}</small>
                        </td>
                        <td>
                          {t.ownerName}
                          <small>{t.debtorName}</small>
                        </td>
                        <td>{br(t.dueDate)}</td>
                        <td>{t.status}</td>
                        <td>{t.bankStatus}</td>
                        <td>
                          {t.bank ?? "—"}
                          <small>{t.wallet ?? "—"}</small>
                        </td>
                        <td>{t.ourNumber ?? "—"}</td>
                        <td className="num">{money(portfolioBalance(t))}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </>
        )}
      </section>
    </>
  );
}

"use client";

/**
 * Módulo Financeiro: escolhe a empresa e a aba e aplica os resultados do motor (toast e efeitos na operação).
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { type Operation } from "@/src/domain/core/types";
import { inScope, scopedAccounts } from "@/src/domain/finance/banking";
import { todayIso, type Effect, type Result } from "@/src/domain/finance/ledger";
import { type FinanceState, type Movement } from "@/src/domain/finance/model";
import { type CarteiraFlow } from "@/src/domain/finance/reports";
import { AccountingTab } from "@/src/features/finance/tabs/accounting-tab";
import { BanksTab } from "@/src/features/finance/tabs/banks-tab";
import { CashTab } from "@/src/features/finance/tabs/cash-tab";
import { ReleasesTab, ReturnModal } from "@/src/features/finance/tabs/releases-tab";
import { ExtractTab } from "@/src/features/finance/tabs/statement-tab";
import { NewTitleModal } from "@/src/features/finance/titles/new-title-modal";
import { AlertIcon, BankIcon, CheckIcon, CloseIcon, PlusIcon } from "@/src/ui/icons";
import { useState } from "react";
import { TitleActionModal, type Action } from "./finance-ui";
import { ReconcileTab } from "@/src/features/finance/tabs/reconcile-tab";
import { TitlesTab } from "@/src/features/finance/tabs/titles-tab";

export type Tab = "caixa" | "titulos" | "liberacoes" | "extrato" | "conciliacao" | "contabil" | "bancos";
export type Toast = { tone: "success" | "error"; text: string } | null;

export type Props = {
  state: FinanceState;
  onState: (s: FinanceState) => void;
  onEffects: (effects: Effect[]) => void;
  onPatchOperation: (id: string, patch: Partial<Operation>) => void;
  operations: Operation[];
  carteira: CarteiraFlow[];
  companyScope: string;
  onCompanyScopeChange: (s: string) => void;
  onOpenOperation: (op: Operation) => void;
};

export default function FinanceModule({
  state,
  onState,
  onEffects,
  onPatchOperation,
  operations,
  carteira,
  companyScope,
  onCompanyScopeChange,
  onOpenOperation,
}: Props) {
  const [tab, setTab] = useState<Tab>("caixa");
  const [toast, setToast] = useState<Toast>(null);
  const [action, setAction] = useState<Action>(null);
  const [newTitle, setNewTitle] = useState(false);
  const [returning, setReturning] = useState<Operation | null>(null);
  const [extractAccount, setExtractAccount] = useState("");
  const apply = (r: Result) => {
    if (r.error) {
      setToast({ tone: "error", text: r.error });
      return false;
    }
    onState(r.state);
    if (r.effects?.length) onEffects(r.effects);
    if (r.message) setToast({ tone: "success", text: r.message });
    return true;
  };
  const today = todayIso();
  const openPay = state.titles.filter(
    t => t.status === "Em aberto" && t.kind === "Pagar" && inScope(t.company, companyScope),
  );
  const releasesPending = state.titles.filter(
    t => t.origin === "Liberação de operação" && t.status === "Em aberto" && inScope(t.company, companyScope),
  ).length;
  const tabs: [Tab, string, number?][] = [
    ["caixa", "Caixa e fluxo"],
    [
      "titulos",
      "A pagar e a receber",
      openPay.filter(t => t.origin !== "Liberação de operação" && t.dueDate <= today).length,
    ],
    ["liberacoes", "Liberações de operações", releasesPending],
    ["extrato", "Extrato bancário"],
    [
      "conciliacao",
      "Conciliação bancária",
      (state.statement ?? []).filter(
        l => l.status === "Pendente" && scopedAccounts(state, companyScope).some(a => a.id === l.accountId),
      ).length,
    ],
    ["contabil", "Contábil"],
    ["bancos", "Bancos"],
  ];
  return (
    <div className="page-wrap fn-page">
      <div className="fn-heading">
        <div>
          <span className="hd-eyebrow">
            <BankIcon /> FINANCEIRO E CONTÁBIL
          </span>
          <h1>Financeiro</h1>
          <p>Caixa, contas a pagar e a receber, conta corrente, conciliação e contabilidade no mesmo lançamento.</p>
        </div>
        <div className="fn-heading-actions">
          <label className="company-scope">
            <span>EMPRESA</span>
            <select value={companyScope} onChange={e => onCompanyScopeChange(e.target.value)}>
              <option value="Consolidado">Consolidado · todas as empresas</option>
              {destinations.map(d => (
                <option key={d.name} value={d.name}>
                  {d.name}
                </option>
              ))}
            </select>
          </label>
          <button className="fn-btn primary" onClick={() => setNewTitle(true)}>
            <PlusIcon /> Novo lançamento
          </button>
        </div>
      </div>
      <nav className="fn-tabs" aria-label="Seções do financeiro">
        {tabs.map(([id, label, badge]) => (
          <button key={id} className={tab === id ? "active" : ""} onClick={() => setTab(id)}>
            {label}
            {badge ? <b>{badge}</b> : null}
          </button>
        ))}
      </nav>
      {toast && (
        <div className={`fn-toast ${toast.tone}`} role="status">
          {toast.tone === "error" ? <AlertIcon /> : <CheckIcon />}
          <span>{toast.text}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <CloseIcon />
          </button>
        </div>
      )}
      {tab === "caixa" && (
        <CashTab
          state={state}
          scope={companyScope}
          carteira={carteira}
          onGoExtract={id => {
            setExtractAccount(id);
            setTab("extrato");
          }}
        />
      )}
      {tab === "titulos" && (
        <TitlesTab
          state={state}
          scope={companyScope}
          onAction={setAction}
          onNew={() => setNewTitle(true)}
          onApply={apply}
        />
      )}
      {tab === "liberacoes" && (
        <ReleasesTab
          state={state}
          scope={companyScope}
          operations={operations}
          onAction={setAction}
          onApply={apply}
          onOpenOperation={onOpenOperation}
          onReturn={setReturning}
        />
      )}
      {tab === "extrato" && (
        <ExtractTab
          state={state}
          scope={companyScope}
          accountId={extractAccount}
          setAccountId={setExtractAccount}
          onApply={apply}
          onAction={setAction}
        />
      )}
      {tab === "conciliacao" && (
        <ReconcileTab
          state={state}
          scope={companyScope}
          accountId={extractAccount}
          setAccountId={setExtractAccount}
          onApply={apply}
        />
      )}
      {tab === "contabil" && <AccountingTab state={state} scope={companyScope} onApply={apply} />}
      {tab === "bancos" && <BanksTab state={state} scope={companyScope} onApply={apply} />}
      {action && (
        <TitleActionModal
          action={action}
          state={state}
          onClose={() => setAction(null)}
          onApply={r => {
            if (apply(r)) setAction(null);
          }}
        />
      )}
      {newTitle && (
        <NewTitleModal
          state={state}
          defaultCompany={companyScope}
          onClose={() => setNewTitle(false)}
          onApply={r => {
            if (apply(r)) setNewTitle(false);
          }}
        />
      )}
      {returning && (
        <ReturnModal
          op={returning}
          state={state}
          onClose={() => setReturning(null)}
          onDone={r => {
            if (apply(r)) {
              if (r.operationPatch) onPatchOperation(returning.id, r.operationPatch);
              setReturning(null);
            }
          }}
        />
      )}
    </div>
  );
}

export type { Movement };

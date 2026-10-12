"use client";

/**
 * Módulo Cadastros: pessoas (PF/PJ) com papéis — cedentes, sacados, fornecedores,
 * representantes, debenturistas, cotistas, avalistas e prestadores.
 *
 * As abas Cedentes e Sacados mostram também crédito e carteira; as demais listam as
 * fichas de cada papel. Todo registro abre no mesmo formulário (`PartyFormModal`), e a
 * gravação propaga para Operação, Comercial e sacados (ver `domain/registry/party-save.ts`).
 */
import { useRegistry } from "@/src/app/registry-context";
import { linkClient, transferClient } from "@/src/domain/commercial/actions";
import { type ClientLink } from "@/src/domain/commercial/types";
import { type Debtor, type Operation } from "@/src/domain/core/types";
import { emptyParty, onlyDigits, partyRoles, type Party, type PartyRole } from "@/src/domain/registry/parties";
import { type ClientRecord } from "@/src/domain/registry/registry";
import { BY } from "@/src/features/finance/finance-ui";
import { type AppView } from "@/src/features/shell/shell-context";
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon, UsersIcon } from "@/src/ui/icons";
import { ModuleTabs } from "@/src/ui/module-tabs";
import { loadRegistryPartyStats } from "@/src/app/registry-client";
import type { RegistryPartyStats } from "@/src/server/registry/repository";
import { useEffect, useState } from "react";
import { CedentsTab } from "./cedents-tab";
import { LinkModal, TransferModal } from "./commercial-link-modals";
import { DebtorsTab } from "./debtors-tab";
import { PartiesTab } from "./parties-tab";
import { PartyFormModal } from "./party-form-modal";
import { RegistryIndicatorsCard } from "./registry-indicators-card";

type Tab = "todos" | PartyRole;
type Toast = { tone: "success" | "error"; text: string } | null;
type Props = {
  debtors: Debtor[];
  operations: Operation[];
  onOpenOperation: (operation: Operation) => void;
  onNavigate: (view: AppView) => void;
};

export default function RegistryModule({ debtors, operations, onOpenOperation, onNavigate }: Props) {
  const { parties, commercial, onCommercial } = useRegistry();
  const [tab, setTab] = useState<Tab>("cedente");
  const [repFilter, setRepFilter] = useState("");
  const [toast, setToast] = useState<Toast>(null);
  const [editing, setEditing] = useState<Party | null>(null);
  const [stats, setStats] = useState<RegistryPartyStats | null>(null);
  const [linkModal, setLinkModal] = useState<
    null | { type: "transfer"; link: ClientLink } | { type: "link"; record: ClientRecord }
  >(null);

  const active = parties.filter(p => p.status === "Ativo");
  const countOf = (role: Tab) =>
    role === "todos"
      ? (stats?.active ?? active.length)
      : (stats?.byRole[role] ?? active.filter(p => p.roles.includes(role)).length);
  const openByDocument = (document: string) => {
    const party = parties.find(p => onlyDigits(p.document) === onlyDigits(document));
    if (party) setEditing(party);
  };
  const newForTab = () => setEditing(emptyParty(tab === "todos" ? undefined : tab));
  const applyCommercial = (result: { state: typeof commercial; error?: string; message?: string }) => {
    if (result.error) {
      setToast({ tone: "error", text: result.error });
      return false;
    }
    onCommercial(result.state);
    if (result.message) setToast({ tone: "success", text: result.message });
    return true;
  };
  const tabs: [Tab, string][] = [["todos", "Todos"], ...partyRoles.map(r => [r.id, r.plural] as [Tab, string])];
  const selectedRole = tab === "todos" ? null : partyRoles.find(role => role.id === tab);

  useEffect(() => {
    let cancelled = false;
    loadRegistryPartyStats()
      .then(result => {
        if (!cancelled) setStats(result);
      })
      .catch(() => {
        /* mantém os totais locais se o banco estiver temporariamente indisponível */
      });
    return () => {
      cancelled = true;
    };
  }, [parties.length]);

  return (
    <div className="page-wrap fn-page rg-page">
      <div className="fn-heading">
        <div>
          <span className="hd-eyebrow">
            <UsersIcon /> CADASTRO E KYC
          </span>
          <h1>Cadastros</h1>
          <p>Central única de clientes, contrapartes, responsáveis e dados operacionais.</p>
        </div>
        <div className="fn-heading-actions">
          {tab === "cedente" && (
            <label className="company-scope">
              <span>COMERCIAL</span>
              <select value={repFilter} onChange={e => setRepFilter(e.target.value)}>
                <option value="">Todos</option>
                {commercial.reps.map(r => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
                <option value="none">Sem comercial</option>
              </select>
            </label>
          )}
          <button className="fn-btn primary" onClick={newForTab}>
            <PlusIcon /> {selectedRole ? `Novo ${selectedRole.label.toLowerCase()}` : "Novo cadastro"}
          </button>
        </div>
      </div>
      <RegistryIndicatorsCard operations={operations} />
      <ModuleTabs
        label="Papéis do cadastro"
        className="rg-tabs"
        value={tab}
        onChange={setTab}
        tabs={tabs.map(([id, label]) => ({ id, label, count: countOf(id), tone: "neutral" as const }))}
      />
      <section className="rg-directory-context">
        <div className="rg-directory-icon">
          <UsersIcon />
        </div>
        <div>
          <span>DIRETÓRIO ATUAL</span>
          <h2>{selectedRole?.plural ?? "Todas as pessoas"}</h2>
          <p>{selectedRole?.hint ?? "Consulte todos os cadastros e os papéis vinculados a cada CPF ou CNPJ."}</p>
        </div>
        <b>{countOf(tab)} cadastro(s) ativo(s)</b>
      </section>
      {toast && (
        <div className={`fn-toast ${toast.tone}`} role="status">
          {toast.tone === "error" ? <AlertIcon /> : <CheckIcon />}
          <span>{toast.text}</span>
          <button aria-label="Fechar aviso" onClick={() => setToast(null)}>
            <CloseIcon />
          </button>
        </div>
      )}

      {tab === "cedente" && (
        <CedentsTab
          operations={operations}
          onOpenOperation={onOpenOperation}
          onNavigate={onNavigate}
          onEdit={openByDocument}
          onTransfer={link => setLinkModal({ type: "transfer", link })}
          onLink={record => setLinkModal({ type: "link", record })}
          repFilter={repFilter}
        />
      )}
      {tab === "sacado" && (
        <DebtorsTab
          debtors={debtors}
          operations={operations}
          onEditDocument={openByDocument}
          onEditParty={setEditing}
        />
      )}
      {tab !== "cedente" && tab !== "sacado" && <PartiesTab role={tab} onEdit={setEditing} />}

      {editing && (
        <PartyFormModal
          key={editing.id}
          party={editing}
          onClose={() => setEditing(null)}
          onOpenExisting={setEditing}
          onSaved={message => {
            setEditing(null);
            setToast({ tone: "success", text: message });
          }}
        />
      )}
      {linkModal?.type === "transfer" && (
        <TransferModal
          link={linkModal.link}
          onClose={() => setLinkModal(null)}
          onSave={(to, reason) => {
            if (applyCommercial(transferClient(commercial, linkModal.link.id, to, reason, BY))) setLinkModal(null);
          }}
        />
      )}
      {linkModal?.type === "link" && (
        <LinkModal
          record={linkModal.record}
          onClose={() => setLinkModal(null)}
          onSave={(repId, managerId, origin) => {
            const { record } = linkModal;
            const result = linkClient(commercial, {
              document: record.document,
              clientName: record.name,
              repId,
              managerId,
              origin,
              approvedLimit: record.cedent.creditLimit,
            });
            if (applyCommercial(result)) setLinkModal(null);
          }}
        />
      )}
    </div>
  );
}

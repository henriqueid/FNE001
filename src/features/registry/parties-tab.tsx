"use client";

/**
 * Lista de pessoas do Cadastro para um papel (ou todas). Cada papel mostra as colunas
 * da sua ficha: categoria do fornecedor, meta do representante, série do debenturista etc.
 */
import { useRegistry } from "@/src/app/registry-context";
import { onlyDigits, partyRoles, roleLabel, type Party, type PartyRole } from "@/src/domain/registry/parties";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { SearchIcon } from "@/src/ui/icons";
import { type ReactNode, useState } from "react";

type Column = { label: string; num?: boolean; render: (party: Party) => ReactNode };

const cityOf = (p: Party) => (p.address.city ? `${p.address.city}/${p.address.state}` : "—");
const mainAccount = (p: Party) => p.bankAccounts.find(a => a.main) ?? p.bankAccounts[0];

function roleColumns(
  role: PartyRole | "todos",
  repName: (id?: string) => string,
  clientsOf: (repId?: string) => number,
): Column[] {
  switch (role) {
    case "fornecedor":
      return [
        { label: "Categoria", render: p => p.roleData.fornecedor?.category || "—" },
        { label: "Prazo", num: true, render: p => `${p.roleData.fornecedor?.paymentTermDays ?? 0} d` },
        {
          label: "Conta para pagamento",
          render: p =>
            mainAccount(p) ? (
              `${mainAccount(p)!.bank} · ${mainAccount(p)!.account}`
            ) : (
              <span className="fn-chip warn">Sem conta</span>
            ),
        },
      ];
    case "prestador":
      return [
        { label: "Serviço", render: p => p.roleData.prestador?.service || "—" },
        { label: "Contrato até", num: true, render: p => br(p.roleData.prestador?.contractUntil) },
        {
          label: "Conta para pagamento",
          render: p =>
            mainAccount(p) ? (
              `${mainAccount(p)!.bank} · ${mainAccount(p)!.account}`
            ) : (
              <span className="fn-chip warn">Sem conta</span>
            ),
        },
      ];
    case "representante":
      return [
        { label: "Tipo", render: p => p.roleData.representante?.repKind ?? "—" },
        { label: "Região", render: p => p.roleData.representante?.region || "—" },
        { label: "Meta mensal", num: true, render: p => compact(p.roleData.representante?.monthlyGoal ?? 0) },
        {
          label: "Comissão",
          num: true,
          render: p =>
            p.roleData.representante?.repKind === "Agente autônomo"
              ? `${p.roleData.representante.flatRate}% fixo`
              : "faixas por meta",
        },
        { label: "Clientes", num: true, render: p => clientsOf(p.roleData.representante?.repId) || "—" },
      ];
    case "debenturista":
      return [
        { label: "Série", render: p => p.roleData.debenturista?.series || "—" },
        {
          label: "Quantidade",
          num: true,
          render: p => (p.roleData.debenturista?.quantity ?? 0).toLocaleString("pt-BR"),
        },
        {
          label: "Subscrito",
          num: true,
          render: p => money((p.roleData.debenturista?.quantity ?? 0) * (p.roleData.debenturista?.unitValue ?? 0)),
        },
        { label: "Remuneração", render: p => p.roleData.debenturista?.remuneration || "—" },
        { label: "Vencimento", num: true, render: p => br(p.roleData.debenturista?.maturity) },
      ];
    case "cotista":
      return [
        { label: "Fundo", render: p => p.roleData.cotista?.fund || "—" },
        { label: "Classe", render: p => p.roleData.cotista?.quotaClass || "—" },
        { label: "Cotas", num: true, render: p => (p.roleData.cotista?.quotas ?? 0).toLocaleString("pt-BR") },
        { label: "Qualificado", render: p => (p.roleData.cotista?.qualifiedInvestor ? "Sim" : "Não") },
      ];
    case "avalista":
      return [
        {
          label: "Garante",
          render: p => p.roleData.avalista?.guaranteedName || p.roleData.avalista?.guaranteedDocument || "—",
        },
        { label: "Tipo", render: p => p.roleData.avalista?.kind ?? "—" },
        { label: "Limite garantido", num: true, render: p => compact(p.roleData.avalista?.limit ?? 0) },
      ];
    case "cedente":
      return [{ label: "Comercial", render: p => repName(p.roleData.cedente?.repId) }];
    default:
      return [
        {
          label: "Papéis",
          render: p => (
            <span className="rg-roles">
              {p.roles.map(r => (
                <span key={r} className="fn-chip">
                  {roleLabel(r)}
                </span>
              ))}
            </span>
          ),
        },
        { label: "Origem", render: p => p.origin },
      ];
  }
}

type Props = { role: PartyRole | "todos"; onEdit: (party: Party) => void };

export function PartiesTab({ role, onEdit }: Props) {
  const { parties, commercial } = useRegistry();
  const [q, setQ] = useState("");
  const [showInactive, setShowInactive] = useState(false);
  const repName = (id?: string) => commercial.reps.find(r => r.id === id)?.name ?? "—";
  const clientsOf = (repId?: string) => (repId ? commercial.links.filter(l => l.repId === repId).length : 0);
  const shown = parties.filter(
    p =>
      (role === "todos" || p.roles.includes(role)) &&
      (showInactive || p.status === "Ativo") &&
      (!q ||
        `${p.name} ${p.tradeName} ${p.document} ${onlyDigits(p.document)} ${p.address.city}`
          .toLowerCase()
          .includes(q.toLowerCase())),
  );
  const columns = roleColumns(role, repName, clientsOf);
  const meta = role === "todos" ? null : partyRoles.find(r => r.id === role);

  return (
    <section className="fn-card">
      <header className="fn-card-head">
        <div>
          <h2>{meta ? meta.plural : "Todas as pessoas"}</h2>
          <p>
            {meta ? meta.hint : "Uma pessoa por CPF/CNPJ, com todos os papéis que ela tem na empresa"} · {shown.length}{" "}
            registro(s)
          </p>
        </div>
        <div className="fn-head-actions">
          <label className="rg-check">
            <input type="checkbox" checked={showInactive} onChange={e => setShowInactive(e.target.checked)} /> Mostrar
            inativos
          </label>
          <label className="cm-search">
            <SearchIcon />
            <input
              value={q}
              onChange={e => setQ(e.target.value)}
              placeholder="Buscar nome, CPF/CNPJ, cidade"
              aria-label="Buscar cadastro"
            />
          </label>
        </div>
      </header>
      <div className="fn-table-scroll">
        <table className="fn-table rg-parties">
          <thead>
            <tr>
              <th>Nome</th>
              <th>Tipo</th>
              <th>Cidade</th>
              {columns.map(c => (
                <th key={c.label} className={c.num ? "num" : undefined}>
                  {c.label}
                </th>
              ))}
              <th>Situação</th>
              <th />
            </tr>
          </thead>
          <tbody>
            {shown.map(p => (
              <tr key={p.id}>
                <td>
                  <b>{p.name}</b>
                  <small>
                    {p.document}
                    {p.tradeName ? ` · ${p.tradeName}` : ""}
                  </small>
                </td>
                <td>{p.kind}</td>
                <td>{cityOf(p)}</td>
                {columns.map(c => (
                  <td key={c.label} className={c.num ? "num" : undefined}>
                    {c.render(p)}
                  </td>
                ))}
                <td>
                  {p.status === "Ativo" ? (
                    <span className="fn-chip ok">Ativo</span>
                  ) : (
                    <span className="fn-chip muted">Inativo</span>
                  )}
                </td>
                <td className="actions">
                  <button className="fn-btn small ghost" onClick={() => onEdit(p)}>
                    Abrir
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {!shown.length && <p className="fn-note">Nenhum registro neste filtro. Use “Novo cadastro” para incluir.</p>}
    </section>
  );
}

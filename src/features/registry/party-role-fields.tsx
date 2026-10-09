"use client";

/**
 * Fichas por papel no formulário do Cadastro. Cada papel marcado ganha um bloco com os
 * campos próprios (limite e comercial do cedente, série do debenturista, fundo do cotista...).
 */
import { useRegistry } from "@/src/app/registry-context";
import { destinations } from "@/src/domain/core/demo/companies";
import {
  defaultRoleData,
  roleLabel,
  type Party,
  type PartyRole,
  type PartyRoleData,
} from "@/src/domain/registry/parties";
import { Field, formatMoneyInput, parseMoneyBR } from "@/src/features/finance/finance-ui";
import { useState } from "react";

const supplierCategories = [
  "Tecnologia",
  "Material de escritório",
  "Aluguel e condomínio",
  "Marketing",
  "Serviços contábeis",
  "Impostos e taxas",
  "Viagens",
  "Outros",
];

type Props = {
  party: Party;
  onChange: (roleData: PartyRoleData) => void;
  issueFor: (field: string) => string | undefined;
};

/** Campo monetário que aceita digitação em pt-BR ("1.500,00") e grava número. */
function MoneyInput({ id, value, onChange }: { id: string; value: number; onChange: (v: number) => void }) {
  const [text, setText] = useState(formatMoneyInput(value));
  return (
    <input
      id={id}
      inputMode="decimal"
      value={text}
      placeholder="0,00"
      onChange={e => setText(e.target.value)}
      onBlur={() => {
        const v = parseMoneyBR(text);
        onChange(v);
        setText(formatMoneyInput(v));
      }}
    />
  );
}

export function PartyRoleFields({ party, onChange, issueFor }: Props) {
  const { commercial, cedents } = useRegistry();
  const data = party.roleData;
  const update = <K extends PartyRole>(role: K, patch: Partial<NonNullable<PartyRoleData[K]>>) =>
    onChange({
      ...data,
      [role]: { ...(data[role] ?? (defaultRoleData(role) as NonNullable<PartyRoleData[K]>)), ...patch },
    });
  const hint = (field: string) => issueFor(field);

  return (
    <>
      {party.roles.map(role => (
        <fieldset key={role} className="rg-fieldset">
          <legend>{roleLabel(role)}</legend>
          <div className="fn-form">
            {role === "cedente" &&
              (() => {
                const d = data.cedente ?? (defaultRoleData("cedente") as NonNullable<PartyRoleData["cedente"]>);
                const link = commercial.links.find(
                  l => l.document.replace(/\D/g, "") === party.document.replace(/\D/g, ""),
                );
                return (
                  <>
                    <Field label="Comercial responsável" hint={hint("cedente.repId")}>
                      <select id="ced-rep" value={d.repId} onChange={e => update("cedente", { repId: e.target.value })}>
                        <option value="">Sem comercial</option>
                        {commercial.reps
                          .filter(r => r.active)
                          .map(r => (
                            <option key={r.id} value={r.id}>
                              {r.name}
                            </option>
                          ))}
                      </select>
                    </Field>
                    <Field
                      label={link ? "Limite aprovado (comitê)" : "Limite proposto (R$)"}
                      hint={
                        link
                          ? "Alterações de limite passam pelo comitê (Comercial › Comitês)."
                          : "Vira o limite inicial do vínculo; o comitê pode revisar."
                      }
                    >
                      {link ? (
                        <input id="ced-limit" value={formatMoneyInput(link.approvedLimit)} disabled />
                      ) : (
                        <MoneyInput
                          id="ced-limit"
                          value={d.creditLimit}
                          onChange={v => update("cedente", { creditLimit: v })}
                        />
                      )}
                    </Field>
                    <Field label="Taxa padrão (% a.m.)">
                      <input
                        id="ced-rate"
                        inputMode="decimal"
                        value={String(d.monthlyRate).replace(".", ",")}
                        onChange={e => update("cedente", { monthlyRate: parseMoneyBR(e.target.value) })}
                      />
                    </Field>
                    <Field label="Modalidade padrão">
                      <select
                        id="ced-guarantee"
                        value={d.guarantee}
                        onChange={e =>
                          update("cedente", { guarantee: e.target.value as "Com regresso" | "Sem regresso" })
                        }
                      >
                        <option>Com regresso</option>
                        <option>Sem regresso</option>
                      </select>
                    </Field>
                    <Field label="Contrato-mãe válido até">
                      <input
                        id="ced-contract"
                        type="date"
                        value={d.contractUntil}
                        onChange={e => update("cedente", { contractUntil: e.target.value })}
                      />
                    </Field>
                  </>
                );
              })()}
            {role === "sacado" &&
              (() => {
                const d = data.sacado ?? (defaultRoleData("sacado") as NonNullable<PartyRoleData["sacado"]>);
                return (
                  <>
                    <Field label="Limite por sacado (R$)" hint="Zero = sem limite próprio; vale a política.">
                      <MoneyInput
                        id="sac-limit"
                        value={d.creditLimit}
                        onChange={v => update("sacado", { creditLimit: v })}
                      />
                    </Field>
                    <Field label="Contato para confirmação de lastro" wide>
                      <input
                        id="sac-contact"
                        value={d.confirmationContact}
                        onChange={e => update("sacado", { confirmationContact: e.target.value })}
                        placeholder="Nome, telefone ou e-mail de quem confirma as notas"
                      />
                    </Field>
                  </>
                );
              })()}
            {role === "fornecedor" &&
              (() => {
                const d =
                  data.fornecedor ?? (defaultRoleData("fornecedor") as NonNullable<PartyRoleData["fornecedor"]>);
                return (
                  <>
                    <Field label="Categoria de despesa" hint={hint("fornecedor.category")}>
                      <select
                        id="sup-category"
                        value={d.category}
                        onChange={e => update("fornecedor", { category: e.target.value })}
                      >
                        <option value="">Escolha</option>
                        {supplierCategories.map(c => (
                          <option key={c}>{c}</option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Prazo de pagamento (dias)">
                      <input
                        id="sup-term"
                        type="number"
                        min={0}
                        value={d.paymentTermDays}
                        onChange={e => update("fornecedor", { paymentTermDays: Number(e.target.value) || 0 })}
                      />
                    </Field>
                  </>
                );
              })()}
            {role === "prestador" &&
              (() => {
                const d = data.prestador ?? (defaultRoleData("prestador") as NonNullable<PartyRoleData["prestador"]>);
                return (
                  <>
                    <Field label="Serviço prestado" wide>
                      <input
                        id="prov-service"
                        value={d.service}
                        onChange={e => update("prestador", { service: e.target.value })}
                        placeholder="Ex.: protesto, custódia, auditoria, jurídico"
                      />
                    </Field>
                    <Field label="Contrato válido até">
                      <input
                        id="prov-contract"
                        type="date"
                        value={d.contractUntil}
                        onChange={e => update("prestador", { contractUntil: e.target.value })}
                      />
                    </Field>
                  </>
                );
              })()}
            {role === "representante" &&
              (() => {
                const d =
                  data.representante ??
                  (defaultRoleData("representante") as NonNullable<PartyRoleData["representante"]>);
                return (
                  <>
                    <Field label="Vínculo">
                      <select
                        id="rep-kind"
                        value={d.repKind}
                        onChange={e =>
                          update("representante", { repKind: e.target.value as "CLT" | "Agente autônomo" })
                        }
                      >
                        <option>CLT</option>
                        <option>Agente autônomo</option>
                      </select>
                    </Field>
                    <Field label="Região de atuação">
                      <input
                        id="rep-region"
                        value={d.region}
                        onChange={e => update("representante", { region: e.target.value })}
                        placeholder="Ex.: Sul · PR e SC"
                      />
                    </Field>
                    <Field label="Meta mensal de receita (R$)" hint={hint("representante.monthlyGoal")}>
                      <MoneyInput
                        id="rep-goal"
                        value={d.monthlyGoal}
                        onChange={v => update("representante", { monthlyGoal: v })}
                      />
                    </Field>
                    {d.repKind === "Agente autônomo" && (
                      <Field label="Comissão fixa (% da receita)" hint={hint("representante.flatRate")}>
                        <input
                          id="rep-rate"
                          inputMode="decimal"
                          value={String(d.flatRate).replace(".", ",")}
                          onChange={e => update("representante", { flatRate: parseMoneyBR(e.target.value) })}
                        />
                      </Field>
                    )}
                    <Field label="Empresa que paga a comissão">
                      <select
                        id="rep-company"
                        value={d.company}
                        onChange={e => update("representante", { company: e.target.value })}
                      >
                        <option value="">Escolha</option>
                        {destinations.map(x => (
                          <option key={x.name}>{x.name}</option>
                        ))}
                      </select>
                    </Field>
                  </>
                );
              })()}
            {role === "debenturista" &&
              (() => {
                const d =
                  data.debenturista ?? (defaultRoleData("debenturista") as NonNullable<PartyRoleData["debenturista"]>);
                return (
                  <>
                    <Field label="Emissora">
                      <select
                        id="deb-issuer"
                        value={d.issuer}
                        onChange={e => update("debenturista", { issuer: e.target.value })}
                      >
                        {destinations
                          .filter(x => x.institution === "Securitizadora")
                          .map(x => (
                            <option key={x.name}>{x.name}</option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Série" hint={hint("debenturista.series")}>
                      <input
                        id="deb-series"
                        value={d.series}
                        onChange={e => update("debenturista", { series: e.target.value })}
                        placeholder="Ex.: 1ª série · ORBT11"
                      />
                    </Field>
                    <Field label="Quantidade" hint={hint("debenturista.quantity")}>
                      <input
                        id="deb-qty"
                        type="number"
                        min={0}
                        value={d.quantity}
                        onChange={e => update("debenturista", { quantity: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <Field label="Valor unitário (PU, R$)" hint={hint("debenturista.unitValue")}>
                      <MoneyInput
                        id="deb-pu"
                        value={d.unitValue}
                        onChange={v => update("debenturista", { unitValue: v })}
                      />
                    </Field>
                    <Field label="Remuneração">
                      <input
                        id="deb-rem"
                        value={d.remuneration}
                        onChange={e => update("debenturista", { remuneration: e.target.value })}
                        placeholder="Ex.: CDI + 3,00% a.a."
                      />
                    </Field>
                    <Field label="Vencimento" hint={hint("debenturista.maturity")}>
                      <input
                        id="deb-maturity"
                        type="date"
                        value={d.maturity}
                        onChange={e => update("debenturista", { maturity: e.target.value })}
                      />
                    </Field>
                    <label className="rg-check">
                      <input
                        type="checkbox"
                        checked={d.qualifiedInvestor}
                        onChange={e => update("debenturista", { qualifiedInvestor: e.target.checked })}
                      />{" "}
                      Investidor qualificado
                    </label>
                  </>
                );
              })()}
            {role === "cotista" &&
              (() => {
                const d = data.cotista ?? (defaultRoleData("cotista") as NonNullable<PartyRoleData["cotista"]>);
                return (
                  <>
                    <Field label="Fundo" hint={hint("cotista.fund")}>
                      <select
                        id="quota-fund"
                        value={d.fund}
                        onChange={e => update("cotista", { fund: e.target.value })}
                      >
                        <option value="">Escolha</option>
                        {destinations
                          .filter(x => x.institution === "FIDC")
                          .map(x => (
                            <option key={x.name}>{x.name}</option>
                          ))}
                      </select>
                    </Field>
                    <Field label="Classe / subclasse">
                      <select
                        id="quota-class"
                        value={d.quotaClass}
                        onChange={e => update("cotista", { quotaClass: e.target.value })}
                      >
                        <option>Sênior</option>
                        <option>Mezanino</option>
                        <option>Subordinada</option>
                        <option>Única</option>
                      </select>
                    </Field>
                    <Field label="Quantidade de cotas" hint={hint("cotista.quotas")}>
                      <input
                        id="quota-qty"
                        type="number"
                        min={0}
                        value={d.quotas}
                        onChange={e => update("cotista", { quotas: Number(e.target.value) || 0 })}
                      />
                    </Field>
                    <label className="rg-check">
                      <input
                        type="checkbox"
                        checked={d.qualifiedInvestor}
                        onChange={e => update("cotista", { qualifiedInvestor: e.target.checked })}
                      />{" "}
                      Investidor qualificado
                    </label>
                  </>
                );
              })()}
            {role === "avalista" &&
              (() => {
                const d = data.avalista ?? (defaultRoleData("avalista") as NonNullable<PartyRoleData["avalista"]>);
                return (
                  <>
                    <Field label="Cedente garantido" hint={hint("avalista.guaranteedDocument")}>
                      <select
                        id="guar-cedent"
                        value={d.guaranteedDocument}
                        onChange={e =>
                          update("avalista", {
                            guaranteedDocument: e.target.value,
                            guaranteedName: cedents.find(c => c.document === e.target.value)?.name ?? "",
                          })
                        }
                      >
                        <option value="">Escolha</option>
                        {cedents.map(c => (
                          <option key={c.document} value={c.document}>
                            {c.name}
                          </option>
                        ))}
                      </select>
                    </Field>
                    <Field label="Garantia">
                      <select
                        id="guar-kind"
                        value={d.kind}
                        onChange={e => update("avalista", { kind: e.target.value as "Aval" | "Fiança" })}
                      >
                        <option>Aval</option>
                        <option>Fiança</option>
                      </select>
                    </Field>
                    <Field label="Limite garantido (R$)">
                      <MoneyInput id="guar-limit" value={d.limit} onChange={v => update("avalista", { limit: v })} />
                    </Field>
                  </>
                );
              })()}
          </div>
        </fieldset>
      ))}
    </>
  );
}

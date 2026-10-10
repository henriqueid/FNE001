"use client";

import { destinations } from "@/src/domain/core/demo/companies";
import type { InstitutionType } from "@/src/domain/core/types";
import {
  type ClientComplianceProfile,
  type ClientContractProfile,
  type LimitTranche,
  type OperationalDefaultsState,
} from "@/src/domain/registry/operational-profile";
import type { CedentRoleData } from "@/src/domain/registry/parties";
import { Field, formatMoneyInput, parseMoneyBR } from "@/src/features/finance/finance-ui";
import { CloseIcon, PlusIcon } from "@/src/ui/icons";
import { useState } from "react";
import { OperationalParametersEditor } from "./operational-parameters-editor";

const receivableTypes = ["Duplicata mercantil", "Cheque", "Cartão", "Contrato", "CCB", "Nota comercial"];
const institutions: InstitutionType[] = ["Factoring", "Securitizadora", "FIDC"];
const emptyContract = (): ClientContractProfile => ({
  number: "",
  signedAt: "",
  validFrom: "",
  validUntil: "",
  automaticRenewal: false,
  allowedInstitutions: [],
  allowedReceivables: [],
  notes: "",
});
const emptyCompliance = (): ClientComplianceProfile => ({
  kycStatus: "Pendente",
  coafQualified: false,
  politicallyExposed: false,
  beneficialOwnerIdentified: false,
  sanctionsCheckedAt: "",
  registrationReviewAt: "",
  creditReviewAt: "",
});
const newTranche = (): LimitTranche => ({
  id: `tr-${Math.random().toString(36).slice(2, 8)}`,
  name: "Nova tranche",
  amount: 0,
  institution: "Todos",
  vehicle: "",
  modality: "",
  receivableType: "",
  validUntil: "",
  priority: 1,
  allowSharing: false,
  active: true,
});

export function CedentProfileFields({
  section,
  data,
  defaults,
  onChange,
}: {
  section: "contract" | "parameters" | "limits" | "compliance";
  data: CedentRoleData;
  defaults: OperationalDefaultsState;
  onChange: (next: CedentRoleData) => void;
}) {
  const patch = (value: Partial<CedentRoleData>) => onChange({ ...data, ...value });
  const contract = data.contract ?? emptyContract();
  const compliance = data.compliance ?? emptyCompliance();
  const tranches = data.tranches ?? [];

  if (section === "parameters")
    return (
      <div className="rg-profile-section">
        <header className="rg-profile-intro">
          <div>
            <span>CONDIÇÃO ESPECÍFICA DO CLIENTE</span>
            <h2>Parâmetros operacionais</h2>
            <p>
              Campos marcados como padrão geral são herdados automaticamente. Um valor zero digitado é mantido como zero
              real.
            </p>
          </div>
          <b>{Object.keys(data.operationalOverrides ?? {}).length} personalizados</b>
        </header>
        <OperationalParametersEditor
          defaults={defaults}
          overrides={data.operationalOverrides ?? {}}
          onChange={operationalOverrides => patch({ operationalOverrides })}
        />
      </div>
    );

  if (section === "contract")
    return (
      <div className="rg-profile-section">
        <header className="rg-profile-intro">
          <div>
            <span>FORMALIZAÇÃO</span>
            <h2>Contrato e produtos autorizados</h2>
            <p>Vigência, modalidades e documentos que podem originar operações.</p>
          </div>
        </header>
        <fieldset className="rg-fieldset">
          <legend>Contrato principal</legend>
          <div className="fn-form">
            <Field label="Número do contrato">
              <input
                value={contract.number}
                onChange={event => patch({ contract: { ...contract, number: event.target.value } })}
              />
            </Field>
            <Field label="Assinado em">
              <input
                type="date"
                value={contract.signedAt}
                onChange={event => patch({ contract: { ...contract, signedAt: event.target.value } })}
              />
            </Field>
            <Field label="Início da vigência">
              <input
                type="date"
                value={contract.validFrom}
                onChange={event => patch({ contract: { ...contract, validFrom: event.target.value } })}
              />
            </Field>
            <Field label="Válido até">
              <input
                type="date"
                value={contract.validUntil}
                onChange={event =>
                  patch({
                    contract: { ...contract, validUntil: event.target.value },
                    contractUntil: event.target.value,
                  })
                }
              />
            </Field>
            <label className="rg-check">
              <input
                type="checkbox"
                checked={contract.automaticRenewal}
                onChange={event => patch({ contract: { ...contract, automaticRenewal: event.target.checked } })}
              />
              Renovação automática
            </label>
            <Field label="Modalidade padrão">
              <select
                value={data.guarantee}
                onChange={event => patch({ guarantee: event.target.value as CedentRoleData["guarantee"] })}
              >
                <option>Com regresso</option>
                <option>Sem regresso</option>
              </select>
            </Field>
            <Field label="Observações contratuais" wide>
              <textarea
                rows={3}
                value={contract.notes}
                onChange={event => patch({ contract: { ...contract, notes: event.target.value } })}
              />
            </Field>
          </div>
        </fieldset>
        <ChoiceGrid
          title="Veículos autorizados"
          values={institutions}
          selected={contract.allowedInstitutions}
          onChange={allowedInstitutions => patch({ contract: { ...contract, allowedInstitutions } })}
        />
        <ChoiceGrid
          title="Recebíveis autorizados"
          values={receivableTypes}
          selected={contract.allowedReceivables}
          onChange={allowedReceivables => patch({ contract: { ...contract, allowedReceivables } })}
        />
      </div>
    );

  if (section === "limits")
    return (
      <div className="rg-profile-section">
        <header className="rg-profile-intro">
          <div>
            <span>CRÉDITO E ALOCAÇÃO</span>
            <h2>Limites, concentração e tranches</h2>
            <p>Distribua o limite global entre veículos e modalidades, com validade e prioridade próprias.</p>
          </div>
          <b>{formatMoneyInput(tranches.reduce((sum, item) => sum + item.amount, 0))} alocado</b>
        </header>
        <fieldset className="rg-fieldset">
          <legend>Limite global</legend>
          <div className="fn-form">
            <Field label="Limite aprovado (R$)">
              <MoneyDraft value={data.creditLimit} onChange={creditLimit => patch({ creditLimit })} />
            </Field>
            <Field label="Validade do limite">
              <input
                type="date"
                value={data.contractUntil}
                onChange={event => patch({ contractUntil: event.target.value })}
              />
            </Field>
          </div>
        </fieldset>
        <section className="rg-tranches">
          <header>
            <div>
              <h3>Tranches do limite</h3>
              <p>A soma pode ser menor que o limite global; o saldo permanece não alocado.</p>
            </div>
            <button
              type="button"
              className="fn-btn small ghost"
              onClick={() => patch({ tranches: [...tranches, newTranche()] })}
            >
              <PlusIcon /> Adicionar tranche
            </button>
          </header>
          {tranches.length === 0 && (
            <p className="fn-note">Nenhuma tranche: o limite global vale para todos os produtos autorizados.</p>
          )}
          {tranches.map((tranche, index) => (
            <TrancheCard
              key={tranche.id}
              tranche={tranche}
              onChange={next => patch({ tranches: tranches.map(item => (item.id === tranche.id ? next : item)) })}
              onRemove={() => patch({ tranches: tranches.filter(item => item.id !== tranche.id) })}
              index={index}
            />
          ))}
        </section>
      </div>
    );

  return (
    <div className="rg-profile-section">
      <header className="rg-profile-intro">
        <div>
          <span>KYC, COAF E REVISÕES</span>
          <h2>Conformidade e garantias</h2>
          <p>Controles mínimos para liberar e manter o relacionamento.</p>
        </div>
      </header>
      <fieldset className="rg-fieldset">
        <legend>Qualificação</legend>
        <div className="fn-form">
          <Field label="Situação do KYC">
            <select
              value={compliance.kycStatus}
              onChange={event =>
                patch({
                  compliance: { ...compliance, kycStatus: event.target.value as ClientComplianceProfile["kycStatus"] },
                })
              }
            >
              <option>Pendente</option>
              <option>Em análise</option>
              <option>Aprovado</option>
              <option>Reprovado</option>
            </select>
          </Field>
          <Field label="Última consulta de sanções">
            <input
              type="date"
              value={compliance.sanctionsCheckedAt}
              onChange={event => patch({ compliance: { ...compliance, sanctionsCheckedAt: event.target.value } })}
            />
          </Field>
          <Field label="Próxima revisão cadastral">
            <input
              type="date"
              value={compliance.registrationReviewAt}
              onChange={event => patch({ compliance: { ...compliance, registrationReviewAt: event.target.value } })}
            />
          </Field>
          <Field label="Próxima revisão de crédito">
            <input
              type="date"
              value={compliance.creditReviewAt}
              onChange={event => patch({ compliance: { ...compliance, creditReviewAt: event.target.value } })}
            />
          </Field>
          <label className="rg-check">
            <input
              type="checkbox"
              checked={compliance.coafQualified}
              onChange={event => patch({ compliance: { ...compliance, coafQualified: event.target.checked } })}
            />{" "}
            Qualificação COAF concluída
          </label>
          <label className="rg-check">
            <input
              type="checkbox"
              checked={compliance.politicallyExposed}
              onChange={event => patch({ compliance: { ...compliance, politicallyExposed: event.target.checked } })}
            />{" "}
            Pessoa exposta politicamente
          </label>
          <label className="rg-check">
            <input
              type="checkbox"
              checked={compliance.beneficialOwnerIdentified}
              onChange={event =>
                patch({ compliance: { ...compliance, beneficialOwnerIdentified: event.target.checked } })
              }
            />{" "}
            Beneficiário final identificado
          </label>
        </div>
      </fieldset>
    </div>
  );
}

function ChoiceGrid<T extends string>({
  title,
  values,
  selected,
  onChange,
}: {
  title: string;
  values: T[];
  selected: T[];
  onChange: (next: T[]) => void;
}) {
  return (
    <fieldset className="rg-fieldset">
      <legend>{title}</legend>
      <div className="rg-choice-grid">
        {values.map(value => (
          <label className="rg-check" key={value}>
            <input
              type="checkbox"
              checked={selected.includes(value)}
              onChange={event =>
                onChange(event.target.checked ? [...selected, value] : selected.filter(item => item !== value))
              }
            />{" "}
            {value}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

function MoneyDraft({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const [text, setText] = useState(formatMoneyInput(value));
  return (
    <input
      inputMode="decimal"
      value={text}
      onChange={event => setText(event.target.value)}
      onBlur={() => {
        const next = parseMoneyBR(text);
        onChange(next);
        setText(formatMoneyInput(next));
      }}
    />
  );
}

function TrancheCard({
  tranche,
  index,
  onChange,
  onRemove,
}: {
  tranche: LimitTranche;
  index: number;
  onChange: (next: LimitTranche) => void;
  onRemove: () => void;
}) {
  const set = (patch: Partial<LimitTranche>) => onChange({ ...tranche, ...patch });
  return (
    <article className="rg-tranche-card">
      <header>
        <b>Tranche {index + 1}</b>
        <label className="rg-check">
          <input type="checkbox" checked={tranche.active} onChange={event => set({ active: event.target.checked })} />{" "}
          Ativa
        </label>
        <button type="button" className="fn-btn small ghost" aria-label="Remover tranche" onClick={onRemove}>
          <CloseIcon />
        </button>
      </header>
      <div className="fn-form">
        <Field label="Nome">
          <input value={tranche.name} onChange={event => set({ name: event.target.value })} />
        </Field>
        <Field label="Valor (R$)">
          <MoneyDraft value={tranche.amount} onChange={amount => set({ amount })} />
        </Field>
        <Field label="Estrutura">
          <select
            value={tranche.institution}
            onChange={event => set({ institution: event.target.value as LimitTranche["institution"] })}
          >
            <option>Todos</option>
            {institutions.map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Veículo">
          <select value={tranche.vehicle} onChange={event => set({ vehicle: event.target.value })}>
            <option value="">Qualquer veículo</option>
            {destinations.map(item => (
              <option key={item.name}>{item.name}</option>
            ))}
          </select>
        </Field>
        <Field label="Modalidade">
          <input
            value={tranche.modality}
            onChange={event => set({ modality: event.target.value })}
            placeholder="Ex.: com regresso"
          />
        </Field>
        <Field label="Recebível">
          <select value={tranche.receivableType} onChange={event => set({ receivableType: event.target.value })}>
            <option value="">Todos</option>
            {receivableTypes.map(value => (
              <option key={value}>{value}</option>
            ))}
          </select>
        </Field>
        <Field label="Validade">
          <input type="date" value={tranche.validUntil} onChange={event => set({ validUntil: event.target.value })} />
        </Field>
        <Field label="Prioridade">
          <input
            type="number"
            min={1}
            value={tranche.priority}
            onChange={event => set({ priority: Number(event.target.value) || 1 })}
          />
        </Field>
        <label className="rg-check">
          <input
            type="checkbox"
            checked={tranche.allowSharing}
            onChange={event => set({ allowSharing: event.target.checked })}
          />{" "}
          Permitir remanejamento entre tranches
        </label>
      </div>
    </article>
  );
}

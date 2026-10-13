"use client";

/**
 * Formulário completo de cadastro de pessoa (PF ou PJ): identificação, papéis e suas fichas,
 * endereço, contatos por área, contas bancárias e situação. A validação roda enquanto o
 * usuário digita; erros bloqueiam a gravação, avisos só orientam.
 */
import { useRegistry } from "@/src/app/registry-context";
import { consultCnpj, consultLeadCnpj } from "@/src/app/cnpj-enrichment-client";
import { consultCep, listPublicBanks } from "@/src/app/public-enrichment-client";
import { cnpjEvidenceChanges, type CnpjEvidence } from "@/src/domain/integrations/cnpj";
import { formatBankLabel, type BankEvidence } from "@/src/domain/integrations/public-data";
import {
  defaultRoleData,
  formatDocument,
  formatZip,
  onlyDigits,
  partyRoles,
  validateParty,
  type Party,
  type PartyBankAccount,
  type PartyContact,
  type PartyRole,
} from "@/src/domain/registry/parties";
import { Field, Modal, br } from "@/src/features/finance/finance-ui";
import { AlertIcon, CheckIcon, CloseIcon, PlusIcon } from "@/src/ui/icons";
import { useEffect, useMemo, useState } from "react";
import { PartyRoleFields } from "./party-role-fields";
import { CedentProfileFields } from "./cedent-profile-fields";

type PartySection =
  "overview" | "responsibilities" | "relationship" | "contract" | "parameters" | "limits" | "compliance" | "history";

const baseSections: Array<{ id: PartySection; label: string; hint: string }> = [
  { id: "overview", label: "Identificação", hint: "Dados principais" },
  { id: "responsibilities", label: "Papéis e responsáveis", hint: "Função e gestão" },
  { id: "relationship", label: "Relacionamento", hint: "Endereço, contatos e bancos" },
];
const cedentSections: Array<{ id: PartySection; label: string; hint: string }> = [
  { id: "contract", label: "Contrato", hint: "Vigência e produtos" },
  { id: "parameters", label: "Parâmetros", hint: "Taxas, tarifas e lastro" },
  { id: "limits", label: "Limites e tranches", hint: "Crédito e alocação" },
  { id: "compliance", label: "Risco e conformidade", hint: "KYC, COAF e revisões" },
];

type Props = {
  party: Party;
  onClose: () => void;
  onSaved: (message: string) => void;
  onOpenExisting: (party: Party) => void;
};

const areas = ["Operações", "Financeiro", "Cobrança", "Jurídico", "Contabilidade", "Diretoria"];
const newId = (prefix: string) => `${prefix}-${Math.random().toString(36).slice(2, 8)}`;
const auditFieldLabels: Record<string, string> = {
  cadastro: "Cadastro",
  kind: "Tipo de pessoa",
  document: "CPF/CNPJ",
  name: "Razão social / nome",
  tradeName: "Nome fantasia",
  birthOrFoundation: "Nascimento / abertura",
  stateRegistration: "Inscrição estadual",
  email: "E-mail principal",
  phone: "Telefone",
  roles: "Papéis",
  status: "Situação",
  inactiveReason: "Motivo da inativação",
  notes: "Observações",
  "address.zipCode": "Endereço · CEP",
  "address.street": "Endereço · logradouro",
  "address.number": "Endereço · número",
  "address.complement": "Endereço · complemento",
  "address.district": "Endereço · bairro",
  "address.city": "Endereço · cidade",
  "address.state": "Endereço · UF",
  "roleData.cedente.creditLimit": "Cedente · limite de crédito",
  "roleData.cedente.monthlyRate": "Cedente · taxa mensal",
  "roleData.cedente.repId": "Cedente · comercial responsável",
  "roleData.cedente.managerId": "Cedente · gerente da conta",
  "roleData.cedente.contractUntil": "Cedente · vigência do contrato",
  "roleData.cedente.guarantee": "Cedente · garantia",
  "roleData.sacado.creditLimit": "Sacado · limite de crédito",
  "roleData.sacado.confirmationContact": "Sacado · contato de confirmação",
};
const auditFieldLabel = (field: string) =>
  auditFieldLabels[field] ??
  field
    .replace(/^roleData\./, "")
    .replace(/^contacts\[/, "Contato [")
    .replace(/^bankAccounts\[/, "Conta bancária [")
    .replaceAll(".", " · ");

export function PartyFormModal({ party, onClose, onSaved, onOpenExisting }: Props) {
  const { parties, saveParty, operationalDefaults } = useRegistry();
  const [draft, setDraft] = useState<Party>(party);
  const [error, setError] = useState("");
  const [changeReason, setChangeReason] = useState("");
  const [attempted, setAttempted] = useState(false);
  const [activeSection, setActiveSection] = useState<PartySection>("overview");
  const [cnpjEvidence, setCnpjEvidence] = useState<CnpjEvidence>();
  const [cnpjLoading, setCnpjLoading] = useState(false);
  const [cnpjError, setCnpjError] = useState("");
  const [cepLoading, setCepLoading] = useState(false);
  const [publicDataError, setPublicDataError] = useState("");
  const [banks, setBanks] = useState<BankEvidence[]>([]);
  const set = (patch: Partial<Party>) => setDraft(current => ({ ...current, ...patch }));
  const setAddress = (patch: Partial<Party["address"]>) =>
    setDraft(current => ({ ...current, address: { ...current.address, ...patch } }));
  const issues = useMemo(() => validateParty(draft, parties), [draft, parties]);
  const issueFor = (field: string) => (attempted || !isNew ? issues.find(i => i.field === field)?.message : undefined);
  const duplicate = parties.find(
    p =>
      p.id !== draft.id &&
      onlyDigits(p.document) === onlyDigits(draft.document) &&
      onlyDigits(draft.document).length >= 11,
  );
  const isNew = !parties.some(p => p.id === party.id);
  const isCedent = draft.roles.includes("cedente");
  const sections = [
    ...baseSections,
    ...(isCedent ? cedentSections : []),
    ...(!isNew ? [{ id: "history" as const, label: "Histórico", hint: "Alterações e auditoria" }] : []),
  ];
  const requiredChecks = [
    Boolean(draft.document),
    Boolean(draft.name),
    draft.roles.length > 0,
    Boolean(draft.address.city),
  ];
  const completeness = Math.round((requiredChecks.filter(Boolean).length / requiredChecks.length) * 100);

  const requestCnpjEvidence = async () => {
    setCnpjLoading(true);
    setCnpjError("");
    try {
      setCnpjEvidence(isNew ? await consultLeadCnpj(draft.document) : await consultCnpj(draft.id));
    } catch (reason) {
      setCnpjError(reason instanceof Error ? reason.message : "Não foi possível consultar o CNPJ.");
    } finally {
      setCnpjLoading(false);
    }
  };

  const requestCepEvidence = async () => {
    setCepLoading(true);
    setPublicDataError("");
    try {
      const evidence = await consultCep(draft.address.zipCode);
      setAddress({
        zipCode: evidence.zipCode,
        street: evidence.street || draft.address.street,
        district: evidence.district || draft.address.district,
        city: evidence.city,
        state: evidence.state,
      });
      if (!changeReason && !isNew) setChangeReason("Endereço conferido em fonte pública de CEP");
    } catch (reason) {
      setPublicDataError(reason instanceof Error ? reason.message : "Não foi possível consultar o CEP.");
    } finally {
      setCepLoading(false);
    }
  };

  useEffect(() => {
    if (activeSection !== "relationship" || banks.length) return;
    let active = true;
    listPublicBanks()
      .then(items => {
        if (active) setBanks(items);
      })
      .catch(reason => {
        if (active)
          setPublicDataError(reason instanceof Error ? reason.message : "Não foi possível carregar os bancos.");
      });
    return () => {
      active = false;
    };
  }, [activeSection, banks.length]);

  const applyCnpjEvidence = () => {
    if (!cnpjEvidence) return;
    setDraft(current => ({
      ...current,
      name: cnpjEvidence.legalName || current.name,
      tradeName: cnpjEvidence.tradeName || current.tradeName,
      birthOrFoundation: cnpjEvidence.openedAt || current.birthOrFoundation,
      email: cnpjEvidence.email || current.email,
      phone: cnpjEvidence.phones[0] || current.phone,
      address: {
        zipCode: cnpjEvidence.address.zipCode || current.address.zipCode,
        street: cnpjEvidence.address.street || current.address.street,
        number: cnpjEvidence.address.number || current.address.number,
        complement: cnpjEvidence.address.complement || current.address.complement,
        district: cnpjEvidence.address.district || current.address.district,
        city: cnpjEvidence.address.city || current.address.city,
        state: cnpjEvidence.address.state || current.address.state,
      },
      notes: current.notes.includes("Consulta CNPJ")
        ? current.notes
        : `${current.notes}${current.notes ? "\n" : ""}Consulta CNPJ: ${cnpjEvidence.provider} em ${cnpjEvidence.fetchedAt.slice(0, 10)}.`,
    }));
    if (!changeReason) setChangeReason("Atualização cadastral conferida com fonte CNPJ externa");
  };

  const toggleRole = (role: PartyRole) =>
    setDraft(current => {
      const has = current.roles.includes(role);
      return {
        ...current,
        roles: has ? current.roles.filter(r => r !== role) : [...current.roles, role],
        roleData:
          has || current.roleData[role] ? current.roleData : { ...current.roleData, [role]: defaultRoleData(role) },
      };
    });
  const updateContact = (id: string, patch: Partial<PartyContact>) =>
    set({ contacts: draft.contacts.map(c => (c.id === id ? { ...c, ...patch } : c)) });
  const updateAccount = (id: string, patch: Partial<PartyBankAccount>) =>
    set({
      bankAccounts: draft.bankAccounts.map(a =>
        a.id === id ? { ...a, ...patch } : patch.main ? { ...a, main: false } : a,
      ),
    });

  function submit() {
    setAttempted(true);
    if (!isNew && !changeReason.trim()) {
      setError("Informe o motivo da alteração para manter a auditoria.");
      return;
    }
    if (issues.some(i => i.blocking)) return;
    const result = saveParty(draft, changeReason);
    if (result.error) {
      setError(result.error);
      return;
    }
    onSaved(result.message ?? "Cadastro salvo.");
  }

  const blocking = issues.filter(i => i.blocking);
  const warnings = issues.filter(i => !i.blocking);

  return (
    <Modal
      wide
      title={isNew ? "Novo cadastro" : draft.name || "Cadastro"}
      subtitle={
        isNew
          ? "Uma pessoa por CPF/CNPJ. Marque todos os papéis que ela tem na empresa."
          : `${draft.document} · atualizado em ${br(draft.updatedAt)} · origem: ${draft.origin}`
      }
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button className="fn-btn primary" onClick={submit}>
            {isNew ? "Cadastrar" : "Salvar alterações"}
          </button>
        </>
      }
    >
      <div className="rg-form-workspace">
        <aside className="rg-form-sidebar">
          <div className="rg-form-status">
            <span>{isNew ? "NOVO CADASTRO" : "CADASTRO EXISTENTE"}</span>
            <strong>{completeness}% essencial preenchido</strong>
            <i>
              <b style={{ width: `${completeness}%` }} />
            </i>
            <small>Complete os dados essenciais e avance pelas etapas.</small>
          </div>
          <nav className="rg-profile-tabs" aria-label="Seções do cadastro">
            {sections.map((section, index) => (
              <button
                type="button"
                key={section.id}
                className={activeSection === section.id ? "active" : ""}
                onClick={() => setActiveSection(section.id)}
              >
                <b>{String(index + 1).padStart(2, "0")}</b>
                <span>
                  {section.label}
                  <small>{section.hint}</small>
                </span>
              </button>
            ))}
          </nav>
        </aside>
        <div className="rg-form-content">
          {activeSection === "overview" && (
            <fieldset className="rg-fieldset">
              <legend>Identificação</legend>
              <div className="fn-form">
                <Field label="Tipo de pessoa">
                  <div className="fn-seg" role="group" aria-label="Tipo de pessoa">
                    {(["PJ", "PF"] as const).map(kind => (
                      <button
                        key={kind}
                        type="button"
                        className={draft.kind === kind ? "active" : ""}
                        onClick={() => set({ kind })}
                      >
                        {kind === "PJ" ? "Pessoa jurídica" : "Pessoa física"}
                      </button>
                    ))}
                  </div>
                </Field>
                <Field label={draft.kind === "PJ" ? "CNPJ" : "CPF"} hint={issueFor("document")}>
                  <input
                    id="party-doc"
                    inputMode="numeric"
                    value={draft.document}
                    onChange={e => set({ document: formatDocument(e.target.value) })}
                    placeholder={draft.kind === "PJ" ? "00.000.000/0000-00" : "000.000.000-00"}
                  />
                </Field>
                {draft.kind === "PJ" && onlyDigits(draft.document).length === 14 && (
                  <div className="rg-inline-alert">
                    <span>
                      <b>Consulta cadastral externa</b>
                      <br />
                      Busque razão social, situação, endereço, atividades e quadro societário em fonte pública.
                    </span>
                    <button
                      type="button"
                      className="fn-btn small ghost"
                      disabled={cnpjLoading}
                      onClick={() => void requestCnpjEvidence()}
                    >
                      {cnpjLoading ? "Consultando…" : cnpjEvidence ? "Atualizar consulta" : "Consultar CNPJ"}
                    </button>
                  </div>
                )}
                {cnpjError && <p className="rg-issue bad">{cnpjError}</p>}
                {cnpjEvidence && (
                  <div className="rg-inline-alert">
                    <CheckIcon />
                    <span>
                      <b>
                        {cnpjEvidence.registrationStatus.label} · {cnpjEvidence.provider}
                      </b>
                      <br />
                      {cnpjEvidenceChanges(draft, cnpjEvidence).length
                        ? `${cnpjEvidenceChanges(draft, cnpjEvidence).join(", ")} com atualização disponível.`
                        : "O cadastro já coincide com os principais dados consultados."}
                    </span>
                    <button type="button" className="fn-btn small ghost" onClick={applyCnpjEvidence}>
                      Aplicar dados conferidos
                    </button>
                  </div>
                )}
                {duplicate && (
                  <div className="rg-inline-alert">
                    <AlertIcon />{" "}
                    <span>
                      Este documento já pertence a <b>{duplicate.name}</b>.
                    </span>
                    <button type="button" className="fn-btn small ghost" onClick={() => onOpenExisting(duplicate)}>
                      Abrir cadastro existente
                    </button>
                  </div>
                )}
                <Field label={draft.kind === "PJ" ? "Razão social" : "Nome completo"} wide hint={issueFor("name")}>
                  <input id="party-name" value={draft.name} onChange={e => set({ name: e.target.value })} />
                </Field>
                {draft.kind === "PJ" && (
                  <Field label="Nome fantasia">
                    <input
                      id="party-trade"
                      value={draft.tradeName}
                      onChange={e => set({ tradeName: e.target.value })}
                    />
                  </Field>
                )}
                <Field label={draft.kind === "PJ" ? "Data de abertura" : "Data de nascimento"}>
                  <input
                    id="party-birth"
                    type="date"
                    value={draft.birthOrFoundation}
                    onChange={e => set({ birthOrFoundation: e.target.value })}
                  />
                </Field>
                {draft.kind === "PJ" && (
                  <Field label="Inscrição estadual">
                    <input
                      id="party-ie"
                      value={draft.stateRegistration}
                      onChange={e => set({ stateRegistration: e.target.value })}
                      placeholder="Isento, se for o caso"
                    />
                  </Field>
                )}
                <Field label="E-mail principal" hint={issueFor("email")}>
                  <input
                    id="party-email"
                    type="email"
                    value={draft.email}
                    onChange={e => set({ email: e.target.value })}
                  />
                </Field>
                <Field label="Telefone">
                  <input
                    id="party-phone"
                    inputMode="tel"
                    value={draft.phone}
                    onChange={e => set({ phone: e.target.value })}
                  />
                </Field>
              </div>
            </fieldset>
          )}

          {activeSection === "responsibilities" && (
            <>
              <fieldset className="rg-fieldset">
                <legend>Papéis</legend>
                <div className="rg-role-picker" role="group" aria-label="Papéis da pessoa">
                  {partyRoles.map(role => (
                    <button
                      key={role.id}
                      type="button"
                      aria-pressed={draft.roles.includes(role.id)}
                      className={draft.roles.includes(role.id) ? "active" : ""}
                      onClick={() => toggleRole(role.id)}
                      title={role.hint}
                    >
                      {draft.roles.includes(role.id) ? <CheckIcon /> : <PlusIcon />} {role.label}
                    </button>
                  ))}
                </div>
                {issueFor("roles") && <p className="rg-issue bad">{issueFor("roles")}</p>}
              </fieldset>

              <PartyRoleFields party={draft} onChange={roleData => set({ roleData })} issueFor={issueFor} />
            </>
          )}

          {isCedent && ["contract", "parameters", "limits", "compliance"].includes(activeSection) && (
            <CedentProfileFields
              section={activeSection as "contract" | "parameters" | "limits" | "compliance"}
              data={draft.roleData.cedente ?? (defaultRoleData("cedente") as NonNullable<Party["roleData"]["cedente"]>)}
              defaults={operationalDefaults}
              onChange={cedente => set({ roleData: { ...draft.roleData, cedente } })}
            />
          )}

          {activeSection === "relationship" && (
            <>
              <fieldset className="rg-fieldset">
                <legend>Endereço</legend>
                <div className="fn-form">
                  <Field label="CEP" hint={issueFor("zipCode")}>
                    <div className="rg-input-action">
                      <input
                        id="addr-zip"
                        inputMode="numeric"
                        value={draft.address.zipCode}
                        onChange={e => setAddress({ zipCode: formatZip(e.target.value) })}
                        placeholder="00000-000"
                      />
                      <button
                        type="button"
                        className="fn-btn small ghost"
                        disabled={cepLoading || onlyDigits(draft.address.zipCode).length !== 8}
                        onClick={() => void requestCepEvidence()}
                      >
                        {cepLoading ? "Buscando…" : "Buscar CEP"}
                      </button>
                    </div>
                  </Field>
                  <Field label="Logradouro" wide>
                    <input
                      id="addr-street"
                      value={draft.address.street}
                      onChange={e => setAddress({ street: e.target.value })}
                    />
                  </Field>
                  <Field label="Número">
                    <input
                      id="addr-number"
                      value={draft.address.number}
                      onChange={e => setAddress({ number: e.target.value })}
                    />
                  </Field>
                  <Field label="Complemento">
                    <input
                      id="addr-comp"
                      value={draft.address.complement}
                      onChange={e => setAddress({ complement: e.target.value })}
                    />
                  </Field>
                  <Field label="Bairro">
                    <input
                      id="addr-district"
                      value={draft.address.district}
                      onChange={e => setAddress({ district: e.target.value })}
                    />
                  </Field>
                  <Field label="Cidade" hint={issueFor("city")}>
                    <input
                      id="addr-city"
                      value={draft.address.city}
                      onChange={e => setAddress({ city: e.target.value })}
                    />
                  </Field>
                  <Field label="UF">
                    <input
                      id="addr-uf"
                      maxLength={2}
                      value={draft.address.state}
                      onChange={e => setAddress({ state: e.target.value.toUpperCase() })}
                    />
                  </Field>
                </div>
              </fieldset>

              <fieldset className="rg-fieldset">
                <legend>Contatos por área</legend>
                {draft.contacts.map(contact => (
                  <div className="rg-row" key={contact.id}>
                    <input
                      aria-label="Nome do contato"
                      placeholder="Nome"
                      value={contact.name}
                      onChange={e => updateContact(contact.id, { name: e.target.value })}
                    />
                    <select
                      aria-label="Área"
                      value={contact.area}
                      onChange={e => updateContact(contact.id, { area: e.target.value })}
                    >
                      {areas.map(a => (
                        <option key={a}>{a}</option>
                      ))}
                    </select>
                    <input
                      aria-label="E-mail do contato"
                      placeholder="E-mail"
                      value={contact.email}
                      onChange={e => updateContact(contact.id, { email: e.target.value })}
                    />
                    <input
                      aria-label="Telefone do contato"
                      placeholder="Telefone"
                      value={contact.phone}
                      onChange={e => updateContact(contact.id, { phone: e.target.value })}
                    />
                    <button
                      type="button"
                      className="fn-btn small ghost"
                      aria-label="Remover contato"
                      onClick={() => set({ contacts: draft.contacts.filter(c => c.id !== contact.id) })}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="fn-btn small ghost"
                  onClick={() =>
                    set({
                      contacts: [
                        ...draft.contacts,
                        { id: newId("ct"), name: "", area: "Financeiro", email: "", phone: "" },
                      ],
                    })
                  }
                >
                  <PlusIcon /> Adicionar contato
                </button>
              </fieldset>

              <fieldset className="rg-fieldset">
                <legend>Contas bancárias</legend>
                {issueFor("bankAccounts") && <p className="rg-issue warn">{issueFor("bankAccounts")}</p>}
                {draft.bankAccounts.map(account => (
                  <div className="rg-row" key={account.id}>
                    <input
                      list="public-bank-catalog"
                      aria-label="Banco"
                      placeholder="Banco (ex.: 341 · Itaú)"
                      value={account.bank}
                      onChange={e => updateAccount(account.id, { bank: e.target.value })}
                    />
                    <input
                      aria-label="Agência"
                      placeholder="Agência"
                      value={account.agency}
                      onChange={e => updateAccount(account.id, { agency: e.target.value })}
                    />
                    <input
                      aria-label="Conta"
                      placeholder="Conta com dígito"
                      value={account.account}
                      onChange={e => updateAccount(account.id, { account: e.target.value })}
                    />
                    <input
                      aria-label="Chave Pix"
                      placeholder="Chave Pix"
                      value={account.pixKey}
                      onChange={e => updateAccount(account.id, { pixKey: e.target.value })}
                    />
                    <label className="rg-check">
                      <input
                        type="radio"
                        name="main-account"
                        checked={account.main}
                        onChange={() => updateAccount(account.id, { main: true })}
                      />{" "}
                      Principal
                    </label>
                    <button
                      type="button"
                      className="fn-btn small ghost"
                      aria-label="Remover conta"
                      onClick={() => set({ bankAccounts: draft.bankAccounts.filter(a => a.id !== account.id) })}
                    >
                      <CloseIcon />
                    </button>
                  </div>
                ))}
                <button
                  type="button"
                  className="fn-btn small ghost"
                  onClick={() =>
                    set({
                      bankAccounts: [
                        ...draft.bankAccounts,
                        {
                          id: newId("ba"),
                          bank: "",
                          agency: "",
                          account: "",
                          pixKey: "",
                          holderDocument: draft.document,
                          main: !draft.bankAccounts.length,
                        },
                      ],
                    })
                  }
                >
                  <PlusIcon /> Adicionar conta
                </button>
                <datalist id="public-bank-catalog">
                  {banks.map(bank => (
                    <option key={`${bank.ispb}-${bank.code ?? "ispb"}`} value={formatBankLabel(bank)}>
                      ISPB {bank.ispb} · {bank.fullName}
                    </option>
                  ))}
                </datalist>
                <small className="rg-public-source-note">
                  Catálogo bancário público do Banco Central via BrasilAPI. A instituição é conferida; agência, conta e
                  chave Pix dependem de validação bancária própria.
                </small>
              </fieldset>
            </>
          )}

          {activeSection === "responsibilities" && (
            <fieldset className="rg-fieldset">
              <legend>Situação e observações</legend>
              <div className="fn-form">
                <Field label="Situação">
                  <select
                    id="party-status"
                    value={draft.status}
                    onChange={e => set({ status: e.target.value as Party["status"] })}
                  >
                    <option>Ativo</option>
                    <option>Inativo</option>
                  </select>
                </Field>
                {draft.status === "Inativo" && (
                  <Field label="Motivo da inativação" wide>
                    <input
                      id="party-inactive"
                      value={draft.inactiveReason ?? ""}
                      onChange={e => set({ inactiveReason: e.target.value })}
                      placeholder="O cadastro não é apagado; fica consultável"
                    />
                  </Field>
                )}
                <Field label="Observações" wide>
                  <textarea
                    id="party-notes"
                    rows={3}
                    value={draft.notes}
                    onChange={e => set({ notes: e.target.value })}
                  />
                </Field>
                {!isNew && (
                  <Field label="Motivo da alteração" wide hint="Obrigatório. Será gravado em cada campo alterado.">
                    <textarea
                      id="party-change-reason"
                      rows={2}
                      value={changeReason}
                      onChange={e => {
                        setChangeReason(e.target.value);
                        setError("");
                      }}
                      placeholder="Ex.: atualização solicitada pelo cliente em 09/10/2026"
                    />
                  </Field>
                )}
              </div>
            </fieldset>
          )}

          {(!isCedent || activeSection === "history") && (draft.history ?? []).length > 0 && (
            <fieldset className="rg-fieldset">
              <legend>Histórico e auditoria</legend>
              <ul className="rg-list rg-history">
                {[...(draft.history ?? [])].reverse().map((h, i) => (
                  <li key={i}>
                    <span>
                      {br(h.at)} · {h.by}
                    </span>
                    <b>
                      {h.field ? `${auditFieldLabel(h.field)}: ${h.from ?? "—"} → ${h.to ?? "—"}` : h.action}
                      {h.reason && <small> · {h.reason}</small>}
                      {h.origin && <small> · origem: {h.origin}</small>}
                    </b>
                  </li>
                ))}
              </ul>
            </fieldset>
          )}

          {isCedent && activeSection === "history" && !(draft.history ?? []).length && (
            <p className="fn-note">O histórico será iniciado quando o cadastro for salvo.</p>
          )}

          {(attempted || !isNew) && (blocking.length > 0 || warnings.length > 0 || error) && (
            <div className="rg-issues" aria-live="polite">
              {error && <p className="rg-issue bad">{error}</p>}
              {blocking.map(i => (
                <p key={i.field + i.message} className="rg-issue bad">
                  {i.message}
                </p>
              ))}
              {warnings.map(i => (
                <p key={i.field + i.message} className="rg-issue warn">
                  {i.message}
                </p>
              ))}
            </div>
          )}
          {publicDataError && <p className="rg-issue warn">{publicDataError}</p>}
        </div>
      </div>
    </Modal>
  );
}

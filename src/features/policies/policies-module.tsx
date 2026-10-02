"use client";

import { destinations } from "@/src/domain/core/demo/companies";
import { masterRuleCatalog } from "@/src/domain/eligibility/master-rule-catalog";
import {
  type EligibilityAction,
  type EligibilityOutcome,
  type EligibilityPolicy,
} from "@/src/domain/eligibility/model";
import { importPolicyCsv, policyImportTemplate } from "@/src/domain/eligibility/policy-import";
import {
  activatePolicyVersion,
  addPolicyRule,
  createBlankPolicy,
  createPolicyVersion,
  type EligibilityPolicyState,
  updatePolicyBinding,
} from "@/src/domain/eligibility/policy-library";
import { useMemo, useRef, useState } from "react";

const statusLabel = { RASCUNHO: "Rascunho", ATIVA: "Ativa", ENCERRADA: "Encerrada" } as const;
const readinessLabel = {
  DISPONIVEL: "Disponível agora",
  REQUER_DADO: "Requer dado",
  REQUER_INTEGRACAO: "Requer integração",
} as const;
const outcomeOptions: Array<Exclude<EligibilityOutcome, "APROVADO" | "NAO_AVALIADO">> = [
  "ALERTA",
  "EXCECAO",
  "REPROVADO",
];
const actionOptions: EligibilityAction[] = ["CONTINUAR", "SINALIZAR", "SOLICITAR_DECISAO", "BLOQUEAR"];

function parameterInput(value: EligibilityPolicy["bindings"][number]["parameter"], raw: string) {
  if (typeof value === "number") return Number(raw.replace(",", "."));
  if (typeof value === "boolean") return raw === "true";
  const numeric = Number(raw.replace(",", "."));
  return raw.trim() && Number.isFinite(numeric) ? numeric : raw;
}

export default function PoliciesModule({
  state,
  onState,
  embedded = false,
}: {
  state: EligibilityPolicyState;
  onState: (state: EligibilityPolicyState) => void;
  embedded?: boolean;
}) {
  const [selectedId, setSelectedId] = useState(state.policies.find(policy => policy.status === "ATIVA")?.id ?? "");
  const [message, setMessage] = useState("");
  const [showCreate, setShowCreate] = useState(false);
  const [catalogSearch, setCatalogSearch] = useState("");
  const [detailSection, setDetailSection] = useState<"rules" | "catalog">("rules");
  const [draft, setDraft] = useState({
    name: "",
    version: "v1.0",
    company: destinations[0].name,
    product: "",
    effectiveFrom: new Date().toISOString().slice(0, 10),
  });
  const fileInput = useRef<HTMLInputElement>(null);
  const selected = state.policies.find(policy => policy.id === selectedId) ?? state.policies[0];
  const catalog = useMemo(() => new Map(masterRuleCatalog.map(rule => [rule.id, rule])), []);
  const today = new Date().toISOString().slice(0, 10);
  const replacePolicy = (policy: EligibilityPolicy) =>
    onState({ ...state, policies: state.policies.map(item => (item.id === policy.id ? policy : item)) });
  const selectedDestination = destinations.find(destination => destination.name === draft.company)!;
  const unboundRules = masterRuleCatalog.filter(
    rule =>
      !selected?.bindings.some(binding => binding.ruleId === rule.id) &&
      (!catalogSearch.trim() ||
        `${rule.id} ${rule.name} ${rule.category} ${rule.level}`
          .toLocaleLowerCase()
          .includes(catalogSearch.toLocaleLowerCase())),
  );

  const createVersion = () => {
    if (!selected) return;
    const next = createPolicyVersion(selected, today);
    const existing = state.policies.find(policy => policy.id === next.id);
    if (existing) {
      setSelectedId(existing.id);
      setMessage("Já existe um rascunho para essa próxima versão.");
      return;
    }
    onState({ ...state, policies: [next, ...state.policies] });
    setSelectedId(next.id);
    setMessage("Nova versão criada como rascunho. A política ativa continua controlando o motor.");
  };

  const createPolicy = () => {
    if (!draft.name.trim()) {
      setMessage("Informe o nome da nova política.");
      return;
    }
    const policy = createBlankPolicy({ ...draft, modality: selectedDestination.institution });
    onState({ ...state, policies: [policy, ...state.policies] });
    setSelectedId(policy.id);
    setShowCreate(false);
    setMessage("Política criada como rascunho. Agora selecione as regras e preencha os parâmetros institucionais.");
  };

  const activate = () => {
    if (!selected || selected.status !== "RASCUNHO") return;
    if (!selected.bindings.some(binding => binding.enabled && binding.parameter !== null)) {
      setMessage("Ative e parametrize ao menos uma regra antes de publicar a política.");
      return;
    }
    onState({ ...state, policies: activatePolicyVersion(state.policies, selected.id, selected.effectiveFrom) });
    setMessage("Versão ativada. Novas análises usarão esta vigência; execuções anteriores permanecem congeladas.");
  };

  const downloadTemplate = () => {
    const url = URL.createObjectURL(new Blob([policyImportTemplate()], { type: "text/csv;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "modelo-politica-elegibilidade.csv";
    anchor.click();
    URL.revokeObjectURL(url);
  };

  const importFile = async (file?: File) => {
    if (!file) return;
    try {
      const policy = importPolicyCsv(await file.text());
      const destination = destinations.find(item => item.name === policy.company);
      if (!destination) throw new Error("A empresa informada não existe no ambiente multiempresa.");
      if (destination.institution !== policy.modality)
        throw new Error("A modalidade não corresponde à empresa escolhida.");
      onState({ ...state, policies: [policy, ...state.policies] });
      setSelectedId(policy.id);
      setMessage(`Política importada como rascunho com ${policy.bindings.length} regra(s) habilitada(s).`);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Não foi possível importar o arquivo.");
    } finally {
      if (fileInput.current) fileInput.current.value = "";
    }
  };

  const Heading = embedded ? "h2" : "h1";
  return (
    <main className={`policies-page ${embedded ? "is-embedded" : ""}`}>
      <header className="ds-page-head policies-head">
        <div>
          <span>{embedded ? "POLÍTICAS E MOTOR" : "MOTOR UNIVERSAL · GOVERNANÇA"}</span>
          <Heading>Matriz Mestre de Elegibilidade</Heading>
          <p>
            Políticas por empresa, regras reutilizáveis, parâmetros institucionais e vigências separados. Nenhum limite
            é universal.
          </p>
        </div>
        <div className="policy-head-actions">
          <button type="button" onClick={downloadTemplate}>
            Baixar modelo
          </button>
          <button type="button" onClick={() => fileInput.current?.click()}>
            Importar arquivo
          </button>
          <input
            ref={fileInput}
            hidden
            type="file"
            accept=".csv,text/csv"
            onChange={event => void importFile(event.target.files?.[0])}
          />
          <button type="button" className="policy-primary-action" onClick={() => setShowCreate(true)}>
            Nova política
          </button>
          <button type="button" onClick={createVersion} disabled={!selected}>
            Nova versão
          </button>
        </div>
      </header>

      <section className="policy-governance-summary" aria-label="Resumo das políticas">
        <div>
          <strong>{masterRuleCatalog.length}</strong>
          <span>regras no catálogo mestre</span>
        </div>
        <div>
          <strong>{masterRuleCatalog.filter(rule => !rule.readiness || rule.readiness === "DISPONIVEL").length}</strong>
          <span>executáveis com dados atuais</span>
        </div>
        <div>
          <strong>{state.policies.filter(policy => policy.status === "ATIVA").length}</strong>
          <span>políticas ativas</span>
        </div>
        <div>
          <strong>{destinations.length}</strong>
          <span>empresas e veículos</span>
        </div>
      </section>

      {message && (
        <div className="policy-module-message" role="status">
          {message}
        </div>
      )}

      <div className="policies-layout">
        <aside className="policy-version-list" aria-label="Versões de política">
          <div className="policy-section-title">
            <span>POLÍTICAS E VERSÕES</span>
            <small>Escopo por empresa e produto</small>
          </div>
          {state.policies.map(policy => (
            <button
              type="button"
              key={policy.id}
              className={policy.id === selected?.id ? "selected" : ""}
              onClick={() => {
                setSelectedId(policy.id);
                setMessage("");
              }}
            >
              <span className={`policy-version-status ${policy.status.toLocaleLowerCase()}`}>
                {statusLabel[policy.status]}
              </span>
              <strong>{policy.name}</strong>
              <small>
                {policy.version} · {policy.layer}
              </small>
              <small>{policy.company ?? "Todas as empresas"}</small>
              <small>
                {policy.modality ?? "Todas as modalidades"}
                {policy.product ? ` · ${policy.product}` : ""}
              </small>
            </button>
          ))}
        </aside>

        {selected && (
          <section className="policy-editor">
            <header>
              <div>
                <span>
                  {selected.layer} · {selected.modality ?? "UNIVERSAL"}
                </span>
                <h2>
                  {selected.name} <small>{selected.version}</small>
                </h2>
                <p>
                  {selected.company ?? "Aplicável a todas as empresas"} · vigência desde{" "}
                  {new Date(`${selected.effectiveFrom}T12:00:00`).toLocaleDateString("pt-BR")}
                  {selected.effectiveTo
                    ? ` até ${new Date(`${selected.effectiveTo}T12:00:00`).toLocaleDateString("pt-BR")}`
                    : ""}
                  .
                </p>
              </div>
              <span className={`policy-editor-status ${selected.status.toLocaleLowerCase()}`}>
                {statusLabel[selected.status]}
              </span>
            </header>

            {selected.status === "RASCUNHO" && (
              <div className="policy-draft-controls">
                <label>
                  Empresa / veículo
                  <select
                    value={selected.company ?? ""}
                    onChange={event => {
                      const destination = destinations.find(item => item.name === event.target.value)!;
                      replacePolicy({ ...selected, company: destination.name, modality: destination.institution });
                    }}
                  >
                    {destinations.map(destination => (
                      <option key={destination.name}>{destination.name}</option>
                    ))}
                  </select>
                </label>
                <label>
                  Início da vigência
                  <input
                    type="date"
                    value={selected.effectiveFrom}
                    onChange={event => replacePolicy({ ...selected, effectiveFrom: event.target.value })}
                  />
                </label>
                <label>
                  Versão
                  <input
                    value={selected.version}
                    onChange={event => replacePolicy({ ...selected, version: event.target.value })}
                  />
                </label>
                <button type="button" onClick={activate}>
                  Ativar versão
                </button>
              </div>
            )}

            <nav className="policy-detail-tabs" aria-label="Detalhes da política">
              <button
                type="button"
                className={detailSection === "rules" ? "active" : ""}
                onClick={() => setDetailSection("rules")}
              >
                Regras aplicadas <span>{selected.bindings.length}</span>
              </button>
              <button
                type="button"
                className={detailSection === "catalog" ? "active" : ""}
                onClick={() => setDetailSection("catalog")}
              >
                Catálogo mestre <span>{masterRuleCatalog.length}</span>
              </button>
            </nav>

            {detailSection === "rules" && (
              <>
                <div className="policy-editor-section-head">
                  <div>
                    <span>REGRAS DA POLÍTICA</span>
                    <small>{selected.bindings.length} regra(s) selecionada(s)</small>
                  </div>
                </div>
                <div className="policy-rules-table-wrap">
                  <table className="policy-rules-table">
                    <thead>
                      <tr>
                        <th>Ativa</th>
                        <th>Regra</th>
                        <th>Nível</th>
                        <th>Parâmetro</th>
                        <th>Resultado</th>
                        <th>Ação</th>
                        <th>Override</th>
                      </tr>
                    </thead>
                    <tbody>
                      {selected.bindings.length === 0 && (
                        <tr>
                          <td colSpan={7} className="policy-table-empty">
                            Nenhuma regra adicionada. Use o catálogo abaixo ou importe o modelo preenchido.
                          </td>
                        </tr>
                      )}
                      {selected.bindings.map(binding => {
                        const rule = catalog.get(binding.ruleId);
                        const editable = selected.status === "RASCUNHO";
                        return (
                          <tr key={binding.ruleId}>
                            <td>
                              <input
                                type="checkbox"
                                disabled={!editable}
                                checked={binding.enabled}
                                onChange={event =>
                                  replacePolicy(
                                    updatePolicyBinding(selected, binding.ruleId, { enabled: event.target.checked }),
                                  )
                                }
                              />
                            </td>
                            <td>
                              <strong>{rule?.name ?? binding.ruleId}</strong>
                              <small>{binding.ruleId}</small>
                            </td>
                            <td>
                              <span>{rule?.level ?? "—"}</span>
                              <small>{rule?.category ?? ""}</small>
                            </td>
                            <td>
                              {typeof binding.parameter === "boolean" ? (
                                <select
                                  disabled={!editable}
                                  value={String(binding.parameter)}
                                  onChange={event =>
                                    replacePolicy(
                                      updatePolicyBinding(selected, binding.ruleId, {
                                        parameter: event.target.value === "true",
                                      }),
                                    )
                                  }
                                >
                                  <option value="true">Sim</option>
                                  <option value="false">Não</option>
                                </select>
                              ) : (
                                <input
                                  disabled={!editable}
                                  placeholder="Definir"
                                  value={String(binding.parameter ?? "")}
                                  onChange={event =>
                                    replacePolicy(
                                      updatePolicyBinding(selected, binding.ruleId, {
                                        parameter: parameterInput(binding.parameter, event.target.value),
                                      }),
                                    )
                                  }
                                />
                              )}
                            </td>
                            <td>
                              <select
                                disabled={!editable}
                                value={binding.failureOutcome}
                                onChange={event =>
                                  replacePolicy(
                                    updatePolicyBinding(selected, binding.ruleId, {
                                      failureOutcome: event.target.value as typeof binding.failureOutcome,
                                    }),
                                  )
                                }
                              >
                                {outcomeOptions.map(option => (
                                  <option key={option}>{option}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <select
                                disabled={!editable}
                                value={binding.action}
                                onChange={event =>
                                  replacePolicy(
                                    updatePolicyBinding(selected, binding.ruleId, {
                                      action: event.target.value as EligibilityAction,
                                    }),
                                  )
                                }
                              >
                                {actionOptions.map(option => (
                                  <option key={option}>{option}</option>
                                ))}
                              </select>
                            </td>
                            <td>
                              <label className="policy-override-toggle">
                                <input
                                  type="checkbox"
                                  disabled={!editable}
                                  checked={binding.overrideAllowed}
                                  onChange={event =>
                                    replacePolicy(
                                      updatePolicyBinding(selected, binding.ruleId, {
                                        overrideAllowed: event.target.checked,
                                      }),
                                    )
                                  }
                                />
                                <span>
                                  {binding.overrideAllowed
                                    ? (binding.overrideAuthority ?? "Permitido")
                                    : "Não permitido"}
                                </span>
                              </label>
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {detailSection === "catalog" && (
              <section className="policy-catalog-browser">
                <header>
                  <div>
                    <span>CATÁLOGO MESTRE</span>
                    <strong>Adicione regras sem duplicar lógica</strong>
                  </div>
                  <input
                    value={catalogSearch}
                    onChange={event => setCatalogSearch(event.target.value)}
                    placeholder="Buscar regra, nível ou categoria"
                  />
                </header>
                <div className="policy-catalog-grid">
                  {unboundRules.map(rule => {
                    const readiness = rule.readiness ?? "DISPONIVEL";
                    return (
                      <article key={rule.id}>
                        <div>
                          <span>
                            {rule.level} · {rule.category}
                          </span>
                          <em className={readiness.toLocaleLowerCase()}>{readinessLabel[readiness]}</em>
                        </div>
                        <strong>{rule.name}</strong>
                        <small>{rule.id}</small>
                        <p>{rule.description}</p>
                        {rule.requiredData && <small>Dado necessário: {rule.requiredData}</small>}
                        <button
                          type="button"
                          disabled={selected.status !== "RASCUNHO"}
                          onClick={() => replacePolicy(addPolicyRule(selected, rule.id))}
                        >
                          Adicionar à política
                        </button>
                      </article>
                    );
                  })}
                </div>
              </section>
            )}
            <footer>
              <strong>Rastreabilidade preservada</strong>
              <span>
                Somente rascunhos podem ser alterados. Políticas são resolvidas por empresa, modalidade, produto e
                vigência.
              </span>
            </footer>
          </section>
        )}
      </div>

      {showCreate && (
        <div className="modal-backdrop" role="presentation">
          <section
            className="settings-modal policy-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="policy-create-title"
          >
            <div className="modal-head">
              <div>
                <span>NOVA POLÍTICA</span>
                <h2 id="policy-create-title">Defina o escopo institucional</h2>
                <p>A política nasce como rascunho. Nenhuma regra controla operações antes da ativação.</p>
              </div>
            </div>
            <div className="policy-create-form">
              <label>
                Nome da política
                <input
                  value={draft.name}
                  onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                  placeholder="Ex.: Política Comercial FIDC Prime"
                />
              </label>
              <label>
                Empresa / veículo
                <select
                  value={draft.company}
                  onChange={event => setDraft(current => ({ ...current, company: event.target.value }))}
                >
                  {destinations.map(destination => (
                    <option key={destination.name}>{destination.name}</option>
                  ))}
                </select>
                <small>
                  {selectedDestination.institution} · {selectedDestination.detail}
                </small>
              </label>
              <label>
                Produto ou carteira (opcional)
                <input
                  value={draft.product}
                  onChange={event => setDraft(current => ({ ...current, product: event.target.value }))}
                  placeholder="Ex.: Antecipação mercantil"
                />
              </label>
              <div>
                <label>
                  Versão
                  <input
                    value={draft.version}
                    onChange={event => setDraft(current => ({ ...current, version: event.target.value }))}
                  />
                </label>
                <label>
                  Início da vigência
                  <input
                    type="date"
                    value={draft.effectiveFrom}
                    onChange={event => setDraft(current => ({ ...current, effectiveFrom: event.target.value }))}
                  />
                </label>
              </div>
            </div>
            <div className="modal-actions">
              <button className="secondary-action" onClick={() => setShowCreate(false)}>
                Cancelar
              </button>
              <button className="primary-action" onClick={createPolicy}>
                Criar política
              </button>
            </div>
          </section>
        </div>
      )}
    </main>
  );
}

"use client";

import {
  authenticatedUser,
  can,
  permissionsForAreas,
  startUserPreview,
  stopUserPreview,
  updateAccessUser,
  type AccessState,
  type AccessUser,
  type Permission,
} from "@/src/domain/access/model";
import {
  createAccessChangeRequest,
  createManagedUser,
  decideAccessChangeRequest,
  loadAccessChangeRequests,
  saveAccessUser,
} from "@/src/app/access-directory-client";
import { useCompanyDestinations } from "@/src/app/company-context";
import { getStratoTenantId } from "@/src/app/tenant";
import { userFunctionalAreas, type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { formatCpf, normalizeCpf } from "@/src/domain/access/identity";
import { criticalAccessChanges, type AccessChangeRequest } from "@/src/domain/access/governance";
import { type FormEvent, useEffect, useMemo, useState } from "react";

const departments: UserDepartment[] = [
  "Diretoria",
  "Operações",
  "Risco e crédito",
  "Controladoria",
  "Financeiro",
  "Comercial",
  "Cadastro",
];

const permissionLabels: Record<Permission, string> = {
  "dashboard:view": "Visualizar visão geral",
  "operations:view": "Visualizar operações",
  "operations:edit": "Atuar nas operações",
  "risk:decide": "Registrar decisões de risco",
  "controlleria:formalize": "Formalizar operações",
  "portfolio:manage": "Gerenciar carteira",
  "finance:view": "Consultar financeiro",
  "finance:release": "Realizar pagamentos e estornos",
  "registry:view": "Consultar cadastros",
  "registry:edit": "Editar cadastros",
  "settings:view": "Consultar empresa e políticas",
  "settings:manage": "Alterar configurações",
  "users:manage": "Administrar usuários",
};

const initials = (name: string) =>
  name
    .split(" ")
    .slice(0, 2)
    .map(part => part[0])
    .join("");

const statusLabel: Record<AccessUser["status"], string> = {
  pending: "Aguardando aprovação",
  active: "Ativo",
  suspended: "Suspenso",
};

export function UsersAccessPanel({
  state,
  onState,
  demoMode = false,
}: {
  state: AccessState;
  onState: (state: AccessState) => void;
  demoMode?: boolean;
}) {
  const destinations = useCompanyDestinations();
  const [selectedId, setSelectedId] = useState(state.previewUserId ?? state.authenticatedUserId);
  const [creating, setCreating] = useState(false);
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [createError, setCreateError] = useState("");
  const [approvalFeedback, setApprovalFeedback] = useState<{ tone: "success" | "error"; message: string }>();
  const [changeRequests, setChangeRequests] = useState<AccessChangeRequest[]>([]);
  const [pendingProposal, setPendingProposal] = useState<{ subjectUserId: string; proposed: AccessUser }>();
  const [requestReason, setRequestReason] = useState("");
  const [decisionReasons, setDecisionReasons] = useState<Record<string, string>>({});
  const [submittingChange, setSubmittingChange] = useState<string>();
  const [savingProfile, setSavingProfile] = useState(false);
  const [draft, setDraft] = useState({
    name: "",
    loginName: "",
    cpf: "",
    email: "",
    password: "",
    department: "Operações" as UserDepartment,
  });
  const persistedSelected = state.users.find(user => user.id === selectedId) ?? state.users[0];
  const selected =
    pendingProposal?.subjectUserId === persistedSelected.id ? pendingProposal.proposed : persistedSelected;
  const active = state.users.find(user => user.id === state.previewUserId) ?? authenticatedUser(state);
  const actor = authenticatedUser(state);
  const canManage = can(actor, "users:manage");
  const directAdmin = actor.status === "active" && actor.access === "admin";
  const managers = useMemo(
    () => state.users.filter(user => user.access !== "operator" && user.status === "active"),
    [state.users],
  );

  const selectedPendingRequest = changeRequests.find(request => request.subjectUserId === persistedSelected.id);
  const persistProfile = async (proposed: AccessUser) => {
    if (!canManage || savingProfile) return;
    setSavingProfile(true);
    setApprovalFeedback(undefined);
    try {
      const saved = await saveAccessUser(getStratoTenantId(), state, proposed);
      onState({ ...saved, previewUserId: state.previewUserId });
      setPendingProposal(undefined);
      setApprovalFeedback({ tone: "success", message: "Acessos salvos e confirmados pelo servidor." });
    } catch (error) {
      setApprovalFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível salvar os acessos.",
      });
    } finally {
      setSavingProfile(false);
    }
  };
  const save = (patch: Partial<AccessUser>) => {
    if (!canManage || savingProfile) return;
    if (!demoMode && selectedPendingRequest && !directAdmin) {
      setApprovalFeedback({
        tone: "error",
        message: "Este perfil está congelado enquanto a alteração crítica aguarda decisão.",
      });
      return;
    }
    const proposed = { ...selected, ...patch };
    if (!demoMode && directAdmin) {
      setPendingProposal({ subjectUserId: persistedSelected.id, proposed });
      setApprovalFeedback(undefined);
      return;
    }
    if (!demoMode && criticalAccessChanges(persistedSelected, proposed).length) {
      setPendingProposal({ subjectUserId: persistedSelected.id, proposed });
      setApprovalFeedback(undefined);
      return;
    }
    setPendingProposal(undefined);
    if (demoMode) onState(updateAccessUser(state, proposed));
    else void persistProfile(proposed);
  };
  const setProfile = (department: UserDepartment, access: AccessUser["access"]) => {
    const areas = [...new Set([department, ...userFunctionalAreas(selected)])];
    save({ department, functionalAreas: areas, access, permissions: permissionsForAreas(areas, access) });
  };
  const toggleFunctionalArea = (area: UserDepartment) => {
    const current = userFunctionalAreas(selected);
    const areas = current.includes(area) ? current.filter(item => item !== area) : [...current, area];
    const normalized = [...new Set([selected.department, ...areas])];
    save({ functionalAreas: normalized, permissions: permissionsForAreas(normalized, selected.access) });
  };

  useEffect(() => {
    if (demoMode || !canManage) return;
    let cancelled = false;
    loadAccessChangeRequests(getStratoTenantId())
      .then(requests => {
        if (!cancelled) setChangeRequests(requests);
      })
      .catch(error => {
        if (!cancelled)
          setApprovalFeedback({
            tone: "error",
            message: error instanceof Error ? error.message : "Não foi possível carregar as aprovações de acesso.",
          });
      });
    return () => {
      cancelled = true;
    };
  }, [demoMode, canManage]);

  const submitCriticalChange = async () => {
    if (!canManage || !pendingProposal) return;
    setSubmittingChange("request");
    setApprovalFeedback(undefined);
    try {
      const result = await createAccessChangeRequest(
        getStratoTenantId(),
        pendingProposal.subjectUserId,
        pendingProposal.proposed,
        requestReason,
      );
      setChangeRequests(result.requests ?? []);
      if (result.state) onState({ ...result.state, previewUserId: state.previewUserId });
      setPendingProposal(undefined);
      setRequestReason("");
      setApprovalFeedback({
        tone: "success",
        message: result.applied
          ? "Alteração administrativa aplicada e confirmada pelo servidor."
          : "Alteração crítica enviada. Um administrador deve conferir e decidir.",
      });
    } catch (error) {
      setApprovalFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível enviar a alteração para aprovação.",
      });
    } finally {
      setSubmittingChange(undefined);
    }
  };

  const decideCriticalChange = async (request: AccessChangeRequest, decision: "APPROVED" | "REJECTED") => {
    if (!canManage || !directAdmin) return;
    setSubmittingChange(request.id);
    setApprovalFeedback(undefined);
    try {
      const result = await decideAccessChangeRequest(
        getStratoTenantId(),
        request.id,
        decision,
        decisionReasons[request.id] ?? "",
      );
      setChangeRequests(result.requests ?? []);
      if (result.state) onState({ ...result.state, previewUserId: state.previewUserId });
      setApprovalFeedback({
        tone: "success",
        message: decision === "APPROVED" ? "Alteração crítica aprovada e aplicada." : "Alteração crítica rejeitada.",
      });
    } catch (error) {
      setApprovalFeedback({
        tone: "error",
        message: error instanceof Error ? error.message : "Não foi possível decidir a alteração.",
      });
    } finally {
      setSubmittingChange(undefined);
    }
  };

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canManage || savingNewUser) return;
    setSavingNewUser(true);
    setCreateError("");
    try {
      const result = await createManagedUser(getStratoTenantId(), draft);
      onState(result.state);
      setSelectedId(result.createdUserId);
      setDraft({ name: "", loginName: "", cpf: "", email: "", password: "", department: "Operações" });
      setCreating(false);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : "Não foi possível adicionar o usuário.");
    } finally {
      setSavingNewUser(false);
    }
  };

  return (
    <div className="settings-section-card access-panel">
      <header>
        <span>IDENTIDADE E AUTORIZAÇÃO · IA-0</span>
        <h2>Usuários, perfis e carteiras</h2>
        <p>
          Defina quem acessa cada empresa, departamento e cliente. O mesmo escopo controla telas, Copiloto, Central do
          Dia e histórico de tarefas.
        </p>
      </header>

      {!canManage && <p role="status">Somente consulta. Seu perfil não permite administrar usuários.</p>}

      <section className="access-summary" aria-label="Resumo dos acessos">
        <article>
          <b>{state.users.filter(user => user.status === "active").length}</b>
          <span>usuários ativos</span>
        </article>
        <article>
          <b>{state.users.filter(user => user.status === "pending").length}</b>
          <span>aguardando aprovação</span>
        </article>
        <article>
          <b>{departments.filter(area => state.users.some(user => userFunctionalAreas(user).includes(area))).length}</b>
          <span>áreas cobertas</span>
        </article>
        <article>
          <b>{destinations.length}</b>
          <span>escopos empresariais</span>
        </article>
      </section>

      {!demoMode && changeRequests.length > 0 && (
        <section className="access-approval-queue" aria-label="Alterações críticas aguardando aprovação">
          <header>
            <div>
              <small>SOLICITAÇÕES DE ACESSO</small>
              <b>Alterações aguardando decisão administrativa</b>
            </div>
            <span>{changeRequests.length} pendente(s)</span>
          </header>
          {changeRequests.map(request => {
            const changes = criticalAccessChanges(request.previous, request.proposed);
            const cannotDecide = !directAdmin;
            return (
              <article key={request.id}>
                <div>
                  <strong>{request.proposed.name}</strong>
                  <span>{changes.join(" · ")}</span>
                  <small>
                    Solicitado por {request.requestedBy} em {new Date(request.requestedAt).toLocaleString("pt-BR")}
                  </small>
                  <p>{request.reason}</p>
                </div>
                <div className="access-approval-comparison">
                  <span>
                    <small>ANTES</small>
                    <b>{request.previous.access}</b>
                    <em>{request.previous.status}</em>
                    <em>{request.previous.permissions.length} permissões</em>
                    <em>{request.previous.companyScopes.length} empresas</em>
                  </span>
                  <span>
                    <small>PROPOSTA</small>
                    <b>{request.proposed.access}</b>
                    <em>{request.proposed.status}</em>
                    <em>{request.proposed.permissions.length} permissões</em>
                    <em>{request.proposed.companyScopes.length} empresas</em>
                  </span>
                </div>
                <div className="access-approval-decision">
                  <input
                    value={decisionReasons[request.id] ?? ""}
                    disabled={cannotDecide}
                    onChange={event =>
                      setDecisionReasons(current => ({ ...current, [request.id]: event.target.value }))
                    }
                    placeholder={cannotDecide ? "Aguardando administrador" : "Justificativa da decisão"}
                  />
                  <button
                    type="button"
                    disabled={cannotDecide || submittingChange === request.id}
                    onClick={() => void decideCriticalChange(request, "APPROVED")}
                  >
                    Aprovar e aplicar
                  </button>
                  <button
                    type="button"
                    className="secondary-action"
                    disabled={cannotDecide || submittingChange === request.id}
                    onClick={() => void decideCriticalChange(request, "REJECTED")}
                  >
                    Rejeitar
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div className="access-active-user">
        <div>
          <small>{state.previewUserId ? "VISÃO EM TESTE" : "SESSÃO ATUAL"}</small>
          <b>{active.name}</b>
          <span>
            {active.role} · {userFunctionalAreas(active).join(" + ")}
          </span>
        </div>
        {state.previewUserId ? (
          <button type="button" onClick={() => onState(stopUserPreview(state))}>
            Encerrar teste e voltar para {actor.name}
          </button>
        ) : (
          <p>
            Testar um perfil atualiza Copiloto, módulos, busca e Central do Dia sem alterar a sessão do administrador.
          </p>
        )}
      </div>

      <div className="access-workspace">
        <aside className="access-users" aria-label="Usuários cadastrados">
          <header>
            <div>
              <small>EQUIPE</small>
              <b>Usuários cadastrados</b>
            </div>
            {canManage && (
              <button type="button" onClick={() => setCreating(true)}>
                + Adicionar usuário
              </button>
            )}
          </header>
          {state.users.map(user => (
            <button
              type="button"
              key={user.id}
              className={selected.id === user.id ? "is-selected" : ""}
              onClick={() => {
                setSelectedId(user.id);
                setApprovalFeedback(undefined);
              }}
            >
              <i>{initials(user.name)}</i>
              <span>
                <b>{user.name}</b>
                <small>
                  {user.role} · {userFunctionalAreas(user).join(" + ")}
                </small>
              </span>
              <em data-status={user.status}>{statusLabel[user.status]}</em>
            </button>
          ))}
        </aside>

        <fieldset className="access-editor" disabled={!canManage}>
          <header>
            <div>
              <small>PERFIL SELECIONADO</small>
              <h3>{selected.name}</h3>
              <p>
                {selected.loginName ? `@${selected.loginName}` : "Sem login personalizado"}
                {selected.cpf ? ` · CPF ${formatCpf(selected.cpf)}` : ""}
                {selected.email ? ` · ${selected.email}` : ""}
              </p>
            </div>
            {selected.status === "pending" ? (
              <button
                type="button"
                disabled={!!selectedPendingRequest && !directAdmin}
                onClick={() => save({ status: "active" })}
              >
                {selectedPendingRequest && !directAdmin
                  ? "Aguardando outro administrador"
                  : demoMode || directAdmin
                    ? "Aprovar e ativar acesso"
                    : "Solicitar ativação do acesso"}
              </button>
            ) : canManage ? (
              <button
                type="button"
                disabled={selected.status !== "active" || selected.id === active.id}
                onClick={() => onState(startUserPreview(state, selected.id))}
              >
                {selected.id === active.id ? "Visão atual" : "Testar visão deste usuário"}
              </button>
            ) : null}
          </header>

          {approvalFeedback && (
            <p
              className="access-approval-feedback"
              data-tone={approvalFeedback.tone}
              role={approvalFeedback.tone === "error" ? "alert" : "status"}
            >
              {approvalFeedback.message}
            </p>
          )}

          {!demoMode && directAdmin && pendingProposal?.subjectUserId === persistedSelected.id && (
            <section className="access-critical-proposal">
              <div>
                <small>ALTERAÇÕES NÃO SALVAS</small>
                <p>O administrador pode salvar diretamente. As mudanças ficam registradas no histórico.</p>
              </div>
              <button
                type="button"
                disabled={savingProfile}
                onClick={() => void persistProfile(pendingProposal.proposed)}
              >
                {savingProfile ? "Salvando acessos…" : "Salvar acessos"}
              </button>
              <button type="button" disabled={savingProfile} onClick={() => setPendingProposal(undefined)}>
                Descartar alterações
              </button>
            </section>
          )}

          {!demoMode && !directAdmin && pendingProposal?.subjectUserId === persistedSelected.id && (
            <section className="access-critical-proposal">
              <div>
                <small>ALTERAÇÃO CRÍTICA PREPARADA</small>
                <b>{criticalAccessChanges(persistedSelected, pendingProposal.proposed).join(" · ")}</b>
                <p>O perfil vigente não será alterado até a decisão de outro administrador.</p>
              </div>
              <input
                value={requestReason}
                onChange={event => setRequestReason(event.target.value)}
                placeholder="Motivo e evidência da alteração"
              />
              <button
                type="button"
                disabled={submittingChange === "request"}
                onClick={() => void submitCriticalChange()}
              >
                Enviar para aprovação
              </button>
              <button
                type="button"
                className="secondary-action"
                onClick={() => {
                  setPendingProposal(undefined);
                  setRequestReason("");
                }}
              >
                Descartar proposta
              </button>
            </section>
          )}

          <div className="access-form-grid">
            <label>
              Situação do acesso
              <select
                value={selected.status}
                onChange={event => save({ status: event.target.value as AccessUser["status"] })}
              >
                <option value="pending">Em análise</option>
                <option value="active">Ativo</option>
                <option value="suspended">Suspenso</option>
              </select>
            </label>
            <label>
              Função
              <input value={selected.role} onChange={event => save({ role: event.target.value })} />
            </label>
            <label>
              Área principal
              <select
                value={selected.department}
                onChange={event => setProfile(event.target.value as UserDepartment, selected.access)}
              >
                {departments.map(department => (
                  <option key={department}>{department}</option>
                ))}
              </select>
            </label>
            <label>
              Nível de acesso
              <select
                value={selected.access}
                onChange={event => setProfile(selected.department, event.target.value as AccessUser["access"])}
              >
                <option value="operator">Operador</option>
                <option value="manager">Gestor</option>
                <option value="admin">Administrador</option>
              </select>
            </label>
            <label>
              Gestor direto
              <select
                value={selected.managerUserId ?? ""}
                onChange={event => save({ managerUserId: event.target.value || undefined })}
              >
                <option value="">Sem gestor</option>
                {managers
                  .filter(user => user.id !== selected.id)
                  .map(user => (
                    <option key={user.id} value={user.id}>
                      {user.name}
                    </option>
                  ))}
              </select>
            </label>
          </div>

          <section className="access-permissions">
            <header>
              <div>
                <small>ÁREAS DE ATUAÇÃO</small>
                <b>Funções acumuladas pelo usuário</b>
              </div>
              <span>{userFunctionalAreas(selected).length} área(s)</span>
            </header>
            <div>
              {departments.map(area => {
                const checked = userFunctionalAreas(selected).includes(area);
                return (
                  <label key={area}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={area === selected.department || selected.access === "admin"}
                      onChange={() => toggleFunctionalArea(area)}
                    />
                    <span>
                      {area}
                      {area === selected.department ? " · principal" : ""}
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          {userFunctionalAreas(selected).includes("Comercial") && (
            <div className="access-link-fields">
              <label>
                Agente/comercial vinculado
                <input
                  value={selected.commercialRepId ?? ""}
                  onChange={event => save({ commercialRepId: event.target.value || undefined })}
                  placeholder="Ex.: rep-1"
                />
              </label>
              <label>
                Gerente da conta vinculado
                <input
                  value={selected.accountManagerId ?? ""}
                  onChange={event => save({ accountManagerId: event.target.value || undefined })}
                  placeholder="Ex.: rep-3"
                />
              </label>
            </div>
          )}

          <section className="access-scopes">
            <header>
              <div>
                <small>ESCOPO EMPRESARIAL</small>
                <b>Empresas e veículos permitidos</b>
              </div>
              <span>
                {selected.companyScopes.length} de {destinations.length}
              </span>
            </header>
            <div>
              {destinations.map(destination => {
                const checked = selected.companyScopes.includes(destination.name);
                return (
                  <label key={destination.name}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() =>
                        save({
                          companyScopes: checked
                            ? selected.companyScopes.filter(scope => scope !== destination.name)
                            : [...selected.companyScopes, destination.name],
                        })
                      }
                    />
                    <span>
                      <b>{destination.name}</b>
                      <small>{destination.institution}</small>
                    </span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="access-permissions">
            <header>
              <div>
                <small>PERMISSÕES EFETIVAS</small>
                <b>{selected.access === "admin" ? "Administrador · todas as ações liberadas" : "Ações liberadas"}</b>
              </div>
              <span>{selected.permissions.length} permissões</span>
            </header>
            <div>
              {(Object.entries(permissionLabels) as Array<[Permission, string]>).map(([permission, label]) => {
                const checked = selected.permissions.includes(permission);
                return (
                  <label key={permission}>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={selected.access === "admin"}
                      onChange={() =>
                        save({
                          permissions: checked
                            ? selected.permissions.filter(item => item !== permission)
                            : [...selected.permissions, permission],
                        })
                      }
                    />
                    <span>{label}</span>
                  </label>
                );
              })}
            </div>
          </section>

          <section className="access-permissions">
            <header>
              <div>
                <small>ALÇADAS FORMAIS</small>
                <b>Competências de decisão</b>
              </div>
              <span>{selected.authorityIds?.length ?? 0} alçada(s)</span>
            </header>
            <div>
              <label>
                <input
                  type="checkbox"
                  checked={selected.authorityIds?.includes("credit-director") ?? false}
                  onChange={() => {
                    const assigned = selected.authorityIds ?? [];
                    save({
                      authorityIds: assigned.includes("credit-director")
                        ? assigned.filter(item => item !== "credit-director")
                        : [...assigned, "credit-director"],
                    });
                  }}
                />
                <span>Diretoria de crédito · aprovar ou rejeitar exceções</span>
              </label>
            </div>
          </section>
        </fieldset>
      </div>

      {canManage && creating && (
        <div className="access-create-backdrop" role="presentation">
          <section
            className="access-create-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="access-create-title"
          >
            <header>
              <div>
                <small>NOVO ACESSO</small>
                <h3 id="access-create-title">Adicionar usuário</h3>
                <p>Crie o login inicial e depois configure permissões, empresas e alçadas.</p>
              </div>
              <button type="button" onClick={() => setCreating(false)} aria-label="Fechar">
                ×
              </button>
            </header>
            <form onSubmit={addUser}>
              <label>
                Nome completo
                <input
                  value={draft.name}
                  onChange={event => setDraft(current => ({ ...current, name: event.target.value }))}
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                Login personalizado
                <input
                  value={draft.loginName}
                  onChange={event => setDraft(current => ({ ...current, loginName: event.target.value }))}
                  placeholder="ex.: joao.silva"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                CPF
                <input
                  value={formatCpf(draft.cpf)}
                  onChange={event => setDraft(current => ({ ...current, cpf: normalizeCpf(event.target.value) }))}
                  placeholder="000.000.000-00"
                  inputMode="numeric"
                  autoComplete="off"
                  required
                />
              </label>
              <label>
                E-mail para contato (opcional)
                <input
                  type="email"
                  value={draft.email}
                  onChange={event => setDraft(current => ({ ...current, email: event.target.value }))}
                  placeholder="nome@empresa.com.br"
                  autoComplete="off"
                />
              </label>
              <label>
                Senha inicial
                <input
                  type="password"
                  value={draft.password}
                  onChange={event => setDraft(current => ({ ...current, password: event.target.value }))}
                  placeholder="10+ caracteres, maiúscula e número"
                  autoComplete="new-password"
                  required
                />
              </label>
              <label>
                Departamento inicial
                <select
                  value={draft.department}
                  onChange={event =>
                    setDraft(current => ({ ...current, department: event.target.value as UserDepartment }))
                  }
                >
                  {departments.map(department => (
                    <option key={department}>{department}</option>
                  ))}
                </select>
              </label>
              {createError && <p className="access-create-error">{createError}</p>}
              <aside>
                O usuário será criado em análise. Complete o perfil e use <b>Aprovar e ativar acesso</b> quando estiver
                pronto.
              </aside>
              <footer>
                <button type="button" onClick={() => setCreating(false)}>
                  Cancelar
                </button>
                <button type="submit" disabled={savingNewUser}>
                  {savingNewUser ? "Criando…" : "Criar usuário"}
                </button>
              </footer>
            </form>
          </section>
        </div>
      )}
    </div>
  );
}

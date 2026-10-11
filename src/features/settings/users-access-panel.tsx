"use client";

import {
  authenticatedUser,
  permissionsFor,
  startUserPreview,
  stopUserPreview,
  updateAccessUser,
  type AccessState,
  type AccessUser,
  type Permission,
} from "@/src/domain/access/model";
import { createManagedUser } from "@/src/app/access-directory-client";
import { getStratoTenantId } from "@/src/app/tenant";
import { destinations } from "@/src/domain/core/demo/companies";
import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { type FormEvent, useMemo, useState } from "react";

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
  "finance:release": "Preparar liberações",
  "registry:edit": "Editar cadastros",
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

export function UsersAccessPanel({ state, onState }: { state: AccessState; onState: (state: AccessState) => void }) {
  const [selectedId, setSelectedId] = useState(state.previewUserId ?? state.authenticatedUserId);
  const [creating, setCreating] = useState(false);
  const [savingNewUser, setSavingNewUser] = useState(false);
  const [createError, setCreateError] = useState("");
  const [draft, setDraft] = useState({ name: "", email: "", password: "", department: "Operações" as UserDepartment });
  const selected = state.users.find(user => user.id === selectedId) ?? state.users[0];
  const active = state.users.find(user => user.id === state.previewUserId) ?? authenticatedUser(state);
  const actor = authenticatedUser(state);
  const managers = useMemo(
    () => state.users.filter(user => user.access !== "operator" && user.status === "active"),
    [state.users],
  );

  const save = (patch: Partial<AccessUser>) => onState(updateAccessUser(state, { ...selected, ...patch }));
  const setProfile = (department: UserDepartment, access: AccessUser["access"]) =>
    save({ department, access, permissions: permissionsFor(department, access) });

  const addUser = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setSavingNewUser(true);
    setCreateError("");
    try {
      const result = await createManagedUser(getStratoTenantId(), draft);
      onState(result.state);
      setSelectedId(result.createdUserId);
      setDraft({ name: "", email: "", password: "", department: "Operações" });
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
          <b>{departments.filter(department => state.users.some(user => user.department === department)).length}</b>
          <span>departamentos</span>
        </article>
        <article>
          <b>{destinations.length}</b>
          <span>escopos empresariais</span>
        </article>
      </section>

      <div className="access-active-user">
        <div>
          <small>{state.previewUserId ? "VISÃO EM TESTE" : "SESSÃO ATUAL"}</small>
          <b>{active.name}</b>
          <span>
            {active.role} · {active.department}
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
            <button type="button" onClick={() => setCreating(true)}>
              + Adicionar usuário
            </button>
          </header>
          {state.users.map(user => (
            <button
              type="button"
              key={user.id}
              className={selected.id === user.id ? "is-selected" : ""}
              onClick={() => setSelectedId(user.id)}
            >
              <i>{initials(user.name)}</i>
              <span>
                <b>{user.name}</b>
                <small>
                  {user.role} · {user.department}
                </small>
              </span>
              <em data-status={user.status}>{statusLabel[user.status]}</em>
            </button>
          ))}
        </aside>

        <section className="access-editor">
          <header>
            <div>
              <small>PERFIL SELECIONADO</small>
              <h3>{selected.name}</h3>
              <p>{selected.email}</p>
            </div>
            {selected.status === "pending" ? (
              <button type="button" onClick={() => save({ status: "active" })}>
                Aprovar e ativar acesso
              </button>
            ) : (
              <button
                type="button"
                disabled={selected.status !== "active" || selected.id === active.id}
                onClick={() => onState(startUserPreview(state, selected.id))}
              >
                {selected.id === active.id ? "Visão atual" : "Testar visão deste usuário"}
              </button>
            )}
          </header>

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
              Departamento
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

          {selected.department === "Comercial" && (
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
                <b>Ações liberadas</b>
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
        </section>
      </div>

      {creating && (
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
                Login (e-mail)
                <input
                  type="email"
                  value={draft.email}
                  onChange={event => setDraft(current => ({ ...current, email: event.target.value }))}
                  placeholder="nome@empresa.com.br"
                  autoComplete="off"
                  required
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

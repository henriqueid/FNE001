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
import { destinations } from "@/src/domain/core/demo/companies";
import { type UserDepartment } from "@/src/domain/copilot/daily-briefing";
import { useMemo, useState } from "react";

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

export function UsersAccessPanel({ state, onState }: { state: AccessState; onState: (state: AccessState) => void }) {
  const [selectedId, setSelectedId] = useState(state.previewUserId ?? state.authenticatedUserId);
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
          <b>{state.users.filter(user => user.access === "manager").length}</b>
          <span>gestores</span>
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
            <small>EQUIPE</small>
            <b>Usuários cadastrados</b>
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
              <em data-status={user.status}>{user.status === "active" ? "Ativo" : "Suspenso"}</em>
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
            <button
              type="button"
              disabled={selected.status !== "active" || selected.id === active.id}
              onClick={() => onState(startUserPreview(state, selected.id))}
            >
              {selected.id === active.id ? "Visão atual" : "Testar visão deste usuário"}
            </button>
          </header>

          <div className="access-form-grid">
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
    </div>
  );
}

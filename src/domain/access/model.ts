import { destinations } from "@/src/domain/core/demo/companies";
import { type AppUserProfile, type UserDepartment } from "@/src/domain/copilot/daily-briefing";

export type Permission =
  | "dashboard:view"
  | "operations:view"
  | "operations:edit"
  | "risk:decide"
  | "controlleria:formalize"
  | "portfolio:manage"
  | "finance:view"
  | "finance:release"
  | "registry:edit"
  | "settings:manage"
  | "users:manage";

export type AccessUser = AppUserProfile & {
  email: string;
  loginName?: string;
  cpf?: string;
  status: "pending" | "active" | "suspended";
  tenantIds: string[];
  authorityIds?: string[];
  companyScopes: string[];
  managerUserId?: string;
  substituteUserId?: string;
  permissions: Permission[];
};

export type AccessState = {
  version: 2;
  /** Identidade real da sessão. Não muda durante uma simulação administrativa. */
  authenticatedUserId: string;
  /** Perfil cuja experiência está sendo simulada pelo administrador. */
  previewUserId?: string;
  users: AccessUser[];
};

export type AccessView =
  | "home"
  | "operations"
  | "controlleria"
  | "portfolio"
  | "commercial"
  | "finance"
  | "registry"
  | "policies"
  | "integrations"
  | "settings";

const allCompanies = destinations.map(destination => destination.name);
const adminPermissions: Permission[] = [
  "dashboard:view",
  "operations:view",
  "operations:edit",
  "risk:decide",
  "controlleria:formalize",
  "portfolio:manage",
  "finance:view",
  "finance:release",
  "registry:edit",
  "settings:manage",
  "users:manage",
];

const basePermissions: Record<UserDepartment, Permission[]> = {
  Diretoria: adminPermissions,
  Operações: ["dashboard:view", "operations:view", "operations:edit"],
  "Risco e crédito": ["dashboard:view", "operations:view", "risk:decide"],
  Controladoria: ["dashboard:view", "operations:view", "controlleria:formalize"],
  Financeiro: ["dashboard:view", "finance:view", "finance:release"],
  Comercial: ["dashboard:view", "operations:view", "portfolio:manage"],
  Cadastro: ["dashboard:view", "registry:edit"],
};

export function permissionsFor(department: UserDepartment, access: AppUserProfile["access"]): Permission[] {
  const base = basePermissions[department];
  if (access === "admin") return adminPermissions;
  if (access === "manager" && !base.includes("users:manage")) return [...base, "users:manage"];
  return base;
}

export const seedAccessState = (): AccessState => ({
  version: 2,
  authenticatedUserId: "user-henrique-admin",
  users: [
    {
      id: "user-henrique-admin",
      name: "Henrique",
      email: "henrique@strato.local",
      loginName: "henrique",
      role: "Administrador",
      department: "Diretoria",
      access: "admin",
      status: "active",
      tenantIds: ["strato-demo"],
      authorityIds: ["credit-director"],
      responsibilities: ["Visão consolidada", "Alçadas", "Metas", "Risco", "Liquidez"],
      companyScopes: allCompanies,
      permissions: adminPermissions,
    },
    {
      id: "user-marina-ops",
      name: "Marina Alves",
      email: "marina.alves@strato.local",
      loginName: "marina.alves",
      role: "Analista operacional",
      department: "Operações",
      access: "operator",
      status: "active",
      tenantIds: ["strato-demo"],
      responsibilities: ["Esteira", "Pendências operacionais"],
      operationOwner: "Marina Alves",
      companyScopes: allCompanies,
      managerUserId: "user-gestor-ops",
      permissions: permissionsFor("Operações", "operator"),
    },
    {
      id: "user-gestor-ops",
      name: "Eduardo Martins",
      email: "eduardo.martins@strato.local",
      loginName: "eduardo.martins",
      role: "Gerente de operações",
      department: "Operações",
      access: "manager",
      status: "active",
      tenantIds: ["strato-demo"],
      responsibilities: ["Equipe operacional", "SLA", "Escalonamentos"],
      companyScopes: allCompanies,
      permissions: permissionsFor("Operações", "manager"),
    },
    {
      id: "user-rafael-comercial",
      name: "Rafael Menezes",
      email: "rafael.menezes@strato.local",
      loginName: "rafael.menezes",
      role: "Executivo comercial",
      department: "Comercial",
      access: "operator",
      status: "active",
      tenantIds: ["strato-demo"],
      responsibilities: ["Originação", "Relacionamento"],
      commercialRepId: "rep-1",
      companyScopes: allCompanies,
      managerUserId: "user-bruno-contas",
      permissions: permissionsFor("Comercial", "operator"),
    },
    {
      id: "user-bruno-contas",
      name: "Bruno Teixeira",
      email: "bruno.teixeira@strato.local",
      loginName: "bruno.teixeira",
      role: "Gerente de contas",
      department: "Comercial",
      access: "manager",
      status: "active",
      tenantIds: ["strato-demo"],
      responsibilities: ["Operações recorrentes", "Pós-venda", "Carteira"],
      accountManagerId: "rep-3",
      companyScopes: allCompanies,
      permissions: permissionsFor("Comercial", "manager"),
    },
    {
      id: "user-lucas-risco",
      name: "Lucas Ribeiro",
      email: "lucas.ribeiro@strato.local",
      loginName: "lucas.ribeiro",
      role: "Analista de risco",
      department: "Risco e crédito",
      access: "operator",
      status: "active",
      tenantIds: ["strato-demo"],
      responsibilities: ["Elegibilidade", "Exceções"],
      companyScopes: [allCompanies[0], allCompanies[1]],
      permissions: permissionsFor("Risco e crédito", "operator"),
    },
  ],
});

export function activeUser(state: AccessState): AccessUser {
  const userId = state.previewUserId ?? state.authenticatedUserId;
  return state.users.find(user => user.id === userId && user.status === "active") ?? authenticatedUser(state);
}

export function authenticatedUser(state: AccessState): AccessUser {
  return state.users.find(user => user.id === state.authenticatedUserId && user.status === "active") ?? state.users[0];
}

export function can(user: AccessUser, permission: Permission) {
  return user.status === "active" && user.permissions.includes(permission);
}

const viewPermissions: Record<AccessView, Permission[]> = {
  home: ["dashboard:view"],
  operations: ["operations:view"],
  controlleria: ["controlleria:formalize"],
  portfolio: ["portfolio:manage"],
  commercial: ["portfolio:manage"],
  finance: ["finance:view"],
  registry: ["registry:edit"],
  policies: ["settings:manage"],
  integrations: ["settings:manage"],
  settings: ["settings:manage"],
};

export function canAccessView(user: AccessUser, view: AccessView) {
  return viewPermissions[view].some(permission => can(user, permission));
}

export function defaultViewFor(user: AccessUser): AccessView {
  const preferred: AccessView[] = [
    "home",
    "operations",
    "controlleria",
    "portfolio",
    "commercial",
    "finance",
    "registry",
    "settings",
  ];
  return preferred.find(view => canAccessView(user, view)) ?? "home";
}

export function updateAccessUser(state: AccessState, user: AccessUser): AccessState {
  return { ...state, users: state.users.map(current => (current.id === user.id ? user : current)) };
}

export function addAccessUser(state: AccessState, user: AccessUser): AccessState {
  if (
    state.users.some(
      current =>
        current.id === user.id ||
        (!!user.email && current.email.toLowerCase() === user.email.toLowerCase()) ||
        (!!user.loginName && current.loginName?.toLowerCase() === user.loginName.toLowerCase()) ||
        (!!user.cpf && current.cpf === user.cpf),
    )
  )
    return state;
  return { ...state, users: [...state.users, user] };
}

export function startUserPreview(state: AccessState, userId: string): AccessState {
  const user = state.users.find(candidate => candidate.id === userId);
  const actor = authenticatedUser(state);
  if (!user || user.status !== "active" || !can(actor, "users:manage")) return state;
  return { ...state, previewUserId: user.id === actor.id ? undefined : user.id };
}

export function stopUserPreview(state: AccessState): AccessState {
  return state.previewUserId ? { ...state, previewUserId: undefined } : state;
}

export function migrateAccessState(value: unknown): AccessState {
  const seeded = seedAccessState();
  if (!value || typeof value !== "object") return seeded;
  const candidate = value as Omit<Partial<AccessState>, "version"> & { version?: number; activeUserId?: string };
  if ((candidate.version !== 1 && candidate.version !== 2) || !Array.isArray(candidate.users)) return seeded;
  const known = new Map(candidate.users.map(user => [user.id, user]));
  const users = seeded.users.map(user => ({ ...user, ...known.get(user.id) }));
  const legacyActiveUserId = candidate.activeUserId;
  const requestedActor = candidate.authenticatedUserId ?? seeded.authenticatedUserId;
  const authenticatedUserId = users.some(user => user.id === requestedActor && user.status === "active")
    ? requestedActor
    : seeded.authenticatedUserId;
  const requestedPreview =
    candidate.previewUserId ?? (legacyActiveUserId !== authenticatedUserId ? legacyActiveUserId : undefined);
  const previewUserId = users.some(user => user.id === requestedPreview && user.status === "active")
    ? requestedPreview
    : undefined;
  return { version: 2, authenticatedUserId, previewUserId, users };
}

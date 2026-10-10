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
  status: "active" | "suspended";
  companyScopes: string[];
  managerUserId?: string;
  substituteUserId?: string;
  permissions: Permission[];
};

export type AccessState = {
  version: 1;
  activeUserId: string;
  users: AccessUser[];
};

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
  version: 1,
  activeUserId: "user-henrique-admin",
  users: [
    {
      id: "user-henrique-admin",
      name: "Henrique",
      email: "henrique@strato.local",
      role: "Administrador",
      department: "Diretoria",
      access: "admin",
      status: "active",
      responsibilities: ["Visão consolidada", "Alçadas", "Metas", "Risco", "Liquidez"],
      companyScopes: allCompanies,
      permissions: adminPermissions,
    },
    {
      id: "user-marina-ops",
      name: "Marina Alves",
      email: "marina.alves@strato.local",
      role: "Analista operacional",
      department: "Operações",
      access: "operator",
      status: "active",
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
      role: "Gerente de operações",
      department: "Operações",
      access: "manager",
      status: "active",
      responsibilities: ["Equipe operacional", "SLA", "Escalonamentos"],
      companyScopes: allCompanies,
      permissions: permissionsFor("Operações", "manager"),
    },
    {
      id: "user-rafael-comercial",
      name: "Rafael Menezes",
      email: "rafael.menezes@strato.local",
      role: "Executivo comercial",
      department: "Comercial",
      access: "operator",
      status: "active",
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
      role: "Gerente de contas",
      department: "Comercial",
      access: "manager",
      status: "active",
      responsibilities: ["Operações recorrentes", "Pós-venda", "Carteira"],
      accountManagerId: "rep-3",
      companyScopes: allCompanies,
      permissions: permissionsFor("Comercial", "manager"),
    },
    {
      id: "user-lucas-risco",
      name: "Lucas Ribeiro",
      email: "lucas.ribeiro@strato.local",
      role: "Analista de risco",
      department: "Risco e crédito",
      access: "operator",
      status: "active",
      responsibilities: ["Elegibilidade", "Exceções"],
      companyScopes: [allCompanies[0], allCompanies[1]],
      permissions: permissionsFor("Risco e crédito", "operator"),
    },
  ],
});

export function activeUser(state: AccessState): AccessUser {
  return state.users.find(user => user.id === state.activeUserId && user.status === "active") ?? state.users[0];
}

export function can(user: AccessUser, permission: Permission) {
  return user.status === "active" && user.permissions.includes(permission);
}

export function updateAccessUser(state: AccessState, user: AccessUser): AccessState {
  return { ...state, users: state.users.map(current => (current.id === user.id ? user : current)) };
}

export function activateUser(state: AccessState, userId: string): AccessState {
  const user = state.users.find(candidate => candidate.id === userId);
  return user?.status === "active" ? { ...state, activeUserId: userId } : state;
}

export function migrateAccessState(value: unknown): AccessState {
  const seeded = seedAccessState();
  if (!value || typeof value !== "object") return seeded;
  const candidate = value as Partial<AccessState>;
  if (candidate.version !== 1 || !Array.isArray(candidate.users)) return seeded;
  const known = new Map(candidate.users.map(user => [user.id, user]));
  const users = seeded.users.map(user => ({ ...user, ...known.get(user.id) }));
  const activeUserId = users.some(user => user.id === candidate.activeUserId && user.status === "active")
    ? candidate.activeUserId!
    : seeded.activeUserId;
  return { version: 1, activeUserId, users };
}

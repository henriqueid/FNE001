import type { AccessUser, Permission } from "./model";
import { cpfValidationError, loginNameValidationError } from "./identity";
import type { UserDepartment } from "@/src/domain/copilot/daily-briefing";

export type AccessChangeRequest = {
  id: string;
  subjectUserId: string;
  previous: AccessUser;
  proposed: AccessUser;
  reason: string;
  status: "PENDING" | "APPROVED" | "REJECTED";
  requestedById: string;
  requestedBy: string;
  requestedAt: string;
  decidedById?: string;
  decidedBy?: string;
  decidedAt?: string;
  decisionReason?: string;
};

const added = <T>(previous: T[] = [], proposed: T[] = []) => proposed.filter(item => !previous.includes(item));
const accessRank: Record<AccessUser["access"], number> = { operator: 0, manager: 1, admin: 2 };

export function criticalAccessChanges(previous: AccessUser, proposed: AccessUser): string[] {
  const changes: string[] = [];
  if (previous.id !== proposed.id) changes.push("identidade interna");
  if (previous.status !== "active" && proposed.status === "active") changes.push("ativação do acesso");
  if (accessRank[proposed.access] > accessRank[previous.access]) changes.push("elevação do nível de acesso");
  if (added(previous.permissions, proposed.permissions).length) changes.push("novas permissões");
  if (added(previous.authorityIds, proposed.authorityIds).length) changes.push("novas alçadas");
  if (added(previous.companyScopes, proposed.companyScopes).length) changes.push("ampliação do escopo empresarial");
  if (added(previous.functionalAreas, proposed.functionalAreas).length) changes.push("nova área de atuação");
  if (previous.email !== proposed.email) changes.push("e-mail de acesso");
  if (previous.loginName !== proposed.loginName) changes.push("login personalizado");
  if (previous.cpf !== proposed.cpf) changes.push("CPF de acesso");
  return [...new Set(changes)];
}

export function accessProfileError(user: AccessUser, permissions: readonly Permission[]): string | null {
  const departments: UserDepartment[] = [
    "Diretoria",
    "Operações",
    "Risco e crédito",
    "Controladoria",
    "Financeiro",
    "Comercial",
    "Cadastro",
  ];
  if (
    !user ||
    typeof user.id !== "string" ||
    typeof user.name !== "string" ||
    typeof user.role !== "string" ||
    !user.id.trim() ||
    !user.name.trim() ||
    !user.role.trim()
  )
    return "O perfil de acesso está incompleto.";
  if (
    !Array.isArray(user.functionalAreas) ||
    !Array.isArray(user.tenantIds) ||
    !Array.isArray(user.companyScopes) ||
    !Array.isArray(user.permissions) ||
    (user.authorityIds !== undefined && !Array.isArray(user.authorityIds))
  )
    return "Os escopos e permissões do perfil são inválidos.";
  if (
    [...user.tenantIds, ...user.companyScopes, ...(user.authorityIds ?? [])].some(
      value => typeof value !== "string" || !value.trim(),
    )
  )
    return "Os identificadores de empresas e alçadas devem ser textos não vazios.";
  if (!departments.includes(user.department) || user.functionalAreas?.some(area => !departments.includes(area)))
    return "O perfil contém área de atuação inválida.";
  if (!["operator", "manager", "admin"].includes(user.access)) return "O nível de acesso é inválido.";
  if (!["pending", "active", "suspended"].includes(user.status)) return "A situação do acesso é inválida.";
  if (!user.functionalAreas?.includes(user.department)) return "A área principal deve permanecer nas áreas de atuação.";
  if (typeof user.email !== "string" || (user.email && !/^\S+@\S+\.\S+$/.test(user.email)))
    return "O e-mail de acesso é inválido.";
  if (user.loginName !== undefined && typeof user.loginName !== "string") return "O login personalizado é inválido.";
  if (user.cpf !== undefined && typeof user.cpf !== "string") return "O CPF de acesso é inválido.";
  if (user.loginName) {
    const loginError = loginNameValidationError(user.loginName);
    if (loginError) return loginError;
  }
  if (user.cpf) {
    const cpfError = cpfValidationError(user.cpf);
    if (cpfError) return cpfError;
  }
  if (user.permissions.some(permission => !permissions.includes(permission)))
    return "O perfil contém permissão inválida.";
  if (new Set(user.permissions).size !== user.permissions.length) return "O perfil contém permissões duplicadas.";
  if (new Set(user.companyScopes).size !== user.companyScopes.length) return "O perfil contém empresas duplicadas.";
  if (new Set(user.authorityIds ?? []).size !== (user.authorityIds ?? []).length)
    return "O perfil contém alçadas duplicadas.";
  return null;
}

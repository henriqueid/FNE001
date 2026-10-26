import type { CommercialState, Prospect } from "@/src/domain/commercial/types";
import { defaultRoleData, emptyParty, onlyDigits, type Party } from "./parties";

export function approvedProspectToParty(prospect: Prospect, commercial: CommercialState, actor: string): Party | null {
  const dossier = prospect.dossier;
  if (!prospect.convertedAt || !dossier || onlyDigits(dossier.document).length !== 14) return null;
  const link = commercial.links.find(item => onlyDigits(item.document) === onlyDigits(dossier.document));
  if (!link) return null;
  const base = emptyParty("cedente");
  return {
    ...base,
    id: `pty-${onlyDigits(dossier.document)}`,
    document: dossier.document,
    name: dossier.legalName || prospect.name,
    tradeName: dossier.tradeName,
    email: dossier.email,
    phone: dossier.phone,
    address: { ...base.address, city: dossier.city, state: dossier.state },
    contacts: dossier.contactName
      ? [
          {
            id: `contact-${onlyDigits(dossier.document)}`,
            name: dossier.contactName,
            area: dossier.contactRole,
            email: dossier.email,
            phone: dossier.phone,
          },
        ]
      : [],
    roleData: {
      cedente: {
        ...(defaultRoleData("cedente") as NonNullable<Party["roleData"]["cedente"]>),
        creditLimit: link.approvedLimit,
        monthlyRate: dossier.proposedRate,
        repId: prospect.repId,
        managerId: link.managerId ?? "",
      },
    },
    notes: `Originado pelo Comercial. ${dossier.commercialSummary}`.trim(),
    origin: "Comercial",
    createdAt: prospect.convertedAt,
    updatedAt: prospect.convertedAt,
    history: [
      {
        at: prospect.convertedAt,
        by: actor,
        action: "Cedente criado",
        field: "cadastro",
        from: "Lead comercial",
        to: "Cedente em onboarding",
        reason: "Aprovação do comitê",
        origin: "Comercial",
      },
    ],
  };
}

/** Reconstitui fichas ausentes da demonstração sem reaplicar o dossiê sobre cadastros revisados. */
export function syncCommercialOnboardingParties(parties: Party[], commercial: CommercialState, actor: string): Party[] {
  const result = [...parties];
  for (const prospect of commercial.prospects) {
    const generated = approvedProspectToParty(prospect, commercial, actor);
    if (!generated) continue;
    const index = result.findIndex(party => onlyDigits(party.document) === onlyDigits(generated.document));
    if (index < 0) result.push(generated);
    else if (!result[index].roles.includes("cedente")) {
      const registered = result[index];
      result[index] = {
        ...registered,
        roles: [...registered.roles, "cedente"],
        roleData: { ...registered.roleData, cedente: generated.roleData.cedente },
        history: [...registered.history, ...generated.history],
        updatedAt: generated.updatedAt,
      };
    }
  }
  return result;
}

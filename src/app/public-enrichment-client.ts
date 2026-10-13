import type {
  BankEvidence,
  CepEvidence,
  HolidayEvidence,
  PixParticipantEvidence,
} from "@/src/domain/integrations/public-data";
import { getStratoTenantId } from "./tenant";

const headers = () => ({ "x-strato-tenant-id": getStratoTenantId() });

async function lookup<T>(params: URLSearchParams, key: string): Promise<T> {
  const response = await fetch(`/api/integrations/public-data?${params}`, { cache: "no-store", headers: headers() });
  const body = (await response.json().catch(() => ({}))) as Record<string, unknown> & { error?: string };
  if (!response.ok || body[key] == null) throw new Error(body.error ?? "Não foi possível consultar a fonte pública.");
  return body[key] as T;
}

export const consultCep = (zipCode: string) =>
  lookup<CepEvidence>(new URLSearchParams({ kind: "cep", value: zipCode }), "evidence");

export const listPublicBanks = () => lookup<BankEvidence[]>(new URLSearchParams({ kind: "banks" }), "banks");

export const listPublicHolidays = (year: number, state?: string) => {
  const params = new URLSearchParams({ kind: "holidays", year: String(year) });
  if (state) params.set("state", state);
  return lookup<HolidayEvidence[]>(params, "holidays");
};

export const listPixParticipants = () =>
  lookup<PixParticipantEvidence[]>(new URLSearchParams({ kind: "pix-participants" }), "participants");

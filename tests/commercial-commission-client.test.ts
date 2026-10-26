import { afterEach, describe, expect, it, vi } from "vitest";
import { sendCommission } from "@/src/app/commercial-client";

afterEach(() => vi.unstubAllGlobals());

describe("envio de comissão pelo cliente", () => {
  it("envia somente intenção e versões, repetindo corpo após perda da resposta", async () => {
    const result = { commercial: { persistenceVersion: 3 }, finance: { persistenceVersion: 4 }, replayed: true };
    const fetchMock = vi
      .fn()
      .mockRejectedValueOnce(new TypeError("network"))
      .mockResolvedValueOnce(Response.json(result));
    vi.stubGlobal("fetch", fetchMock);
    expect(await sendCommission("2026-09", 1, 2)).toEqual(result);
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock.mock.calls[0][0]).toBe("/api/commercial/commissions");
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toEqual({
      month: "2026-09",
      expectedCommercialVersion: 1,
      expectedFinanceVersion: 2,
    });
    expect(fetchMock.mock.calls[1][1].body).toBe(fetchMock.mock.calls[0][1].body);
  });
  it("propaga recusa do servidor sem anunciar sucesso", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(Response.json({ error: "Sem permissão" }, { status: 403 })));
    await expect(sendCommission("2026-09", 1, 2)).rejects.toThrow("Sem permissão");
  });
});

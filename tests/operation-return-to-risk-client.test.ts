/** Resposta autoritativa é encaminhada sem novo PUT e retentativa mantém a chave da intenção. */
import { afterEach, expect, it, vi } from "vitest";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { consumeOperationServerResult } from "@/src/app/operation-server-result";
import { returnApprovalToRisk } from "@/src/features/operations/approval/return-to-risk-client";
afterEach(() => vi.unstubAllGlobals());
it("envia somente intenção e entrega recibo que dispensa persistência redundante", async () => {
  const requests: { url: string; body: Record<string, unknown> }[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (url: string, options: RequestInit) => {
      requests.push({ url, body: JSON.parse(String(options.body)) });
      return Response.json({ operation: { ...initialOperations[0], stage: 2, persistenceVersion: 4 } });
    }),
  );
  const saved = await returnApprovalToRisk("CHURUME op", 3, "CHURUME revisar lastro");
  expect(requests).toHaveLength(1);
  expect(requests[0].url).toBe("/api/operations/return-to-risk");
  expect(requests[0].body).toEqual({
    operationId: "CHURUME op",
    expectedVersion: 3,
    reason: "CHURUME revisar lastro",
    commandId: expect.any(String),
  });
  expect(saved.stage).toBe(2);
  expect(consumeOperationServerResult(saved)).toBe(true);
});
it("retenta transporte com mesma intenção e mesma chave; erro HTTP não vira sucesso", async () => {
  const bodies: string[] = [];
  vi.stubGlobal(
    "fetch",
    vi.fn(async (_url: string, options: RequestInit) => {
      bodies.push(String(options.body));
      if (bodies.length === 1) throw new Error("rede");
      return Response.json({ error: "Versão obsoleta" }, { status: 409 });
    }),
  );
  await expect(returnApprovalToRisk("CHURUME op", 3, "CHURUME revisar lastro")).rejects.toThrow("Versão obsoleta");
  expect(bodies).toHaveLength(2);
  expect(bodies[0]).toBe(bodies[1]);
});

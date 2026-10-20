/** Baixa orienta configuração da conta e explicita insuficiência sem bloquear registro. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it, vi } from "vitest";
import { seedFinance } from "@/src/domain/finance/setup";
import { TitleActionModal } from "@/src/features/finance/finance-ui";

const state = seedFinance("2026-10-20");
const title = state.titles.find(t => t.kind === "Pagar" && t.status === "Em aberto")!;
const account = state.accounts.find(a => a.company === title.company && a.usage.payments)!;
const render = (accounts: typeof state.accounts) =>
  renderToStaticMarkup(
    createElement(TitleActionModal, {
      action: { type: "settle", title },
      state: { ...state, accounts, movements: [] },
      onClose: vi.fn(),
      onApply: vi.fn(),
      onConfigureAccount: vi.fn(),
    }),
  );

describe("conta pagadora", () => {
  it("explica conta indisponível e oferece configuração sem seletor vazio", () => {
    const html = render([]);
    expect(html).toContain("Nenhuma conta habilitada");
    expect(html).toContain("Configurar conta bancária");
    expect(html).toMatch(/<select[^>]*disabled/);
    expect(html).toMatch(/<button[^>]*disabled[^>]*>Confirmar pagamento/);
  });

  it("não oferece contas de outra empresa, inativas ou sem finalidade de pagamento", () => {
    const html = render([
      { ...account, id: "outra", company: "Outra empresa", nickname: "Conta indevida" },
      { ...account, id: "inativa", active: false, nickname: "Conta inativa" },
      { ...account, usage: { ...account.usage, payments: false }, nickname: "Só cobrança" },
    ]);
    expect(html).toContain("Nenhuma conta habilitada");
    expect(html).not.toContain("Conta indevida");
    expect(html).not.toContain("Conta inativa");
    expect(html).not.toContain("Só cobrança");
  });

  it("avisa saldo insuficiente e mantém registro de pagamento disponível", () => {
    const html = render([{ ...account, openingBalance: 0, minimumBalance: 0 }]);
    expect(html).toContain("Saldo insuficiente");
    expect(html).toContain("saldo negativo");
    expect(html).toContain("Saldo após pagamento");
    expect(html).toContain(`cc ${account.account}`);
    expect(html).not.toMatch(/<button[^>]*disabled[^>]*>Confirmar pagamento/);
  });

  it("avisa quando pagamento consome saldo mínimo, sem alegar insuficiência", () => {
    const html = render([{ ...account, openingBalance: title.amount + 10, minimumBalance: 100 }]);
    expect(html).toContain("abaixo do mínimo");
    expect(html).not.toContain("Saldo insuficiente");
  });

  it("mostra saldo suficiente sem aviso de insuficiência", () => {
    const html = render([{ ...account, openingBalance: title.amount + 100, minimumBalance: 0 }]);
    expect(html).toContain("Saldo após pagamento");
    expect(html).not.toContain("Saldo insuficiente");
    expect(html).not.toContain("abaixo do mínimo");
  });
});

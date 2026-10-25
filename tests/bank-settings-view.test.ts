/** Cadastro bancário fica em Configurações; Financeiro consulta contas sem edição. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { seedFinance } from "@/src/domain/finance/setup";
import { BanksTab, AccountModal } from "@/src/features/finance/tabs/banks-tab";

const state = seedFinance("2026-10-25");
const company = state.accounts[0].company;

it("consulta bancos sem oferecer cadastro nem edição", () => {
  const html = renderToStaticMarkup(createElement(BanksTab, { state, scope: company }));
  expect(html).toContain("Bancos configurados");
  expect(html).toContain(state.accounts[0].nickname);
  expect(html).not.toContain("Nova conta");
  expect(html).not.toContain(">Editar<");
  expect(html).not.toContain(state.accounts.find(account => account.company !== company)!.nickname);
});

it("gestão habilita cadastro e edição das mesmas contas", () => {
  const html = renderToStaticMarkup(
    createElement(BanksTab, { state, scope: company, editable: true, onApply: vi.fn() }),
  );
  expect(html).toContain("Bancos e remessas");
  expect(html).toContain("Nova conta");
  expect(html).toContain(">Editar<");
});

it("organiza cadastro em seções sem ocultar campos obrigatórios da remessa", () => {
  const account = {
    ...state.accounts[0],
    usage: { payments: true, receipts: true, collection: true },
    collection: { agreement: "123", wallet: "109", layout: "CNAB 400" as const, nextOurNumber: 1 },
  };
  const html = renderToStaticMarkup(
    createElement(AccountModal, { account, isNew: false, hasMoves: true, onClose: vi.fn(), onSave: vi.fn() }),
  );
  expect(html).toContain("Dados da conta");
  expect(html).toContain("Remessas de cobrança");
  expect(html).toContain("Juros, multa e instruções");
  expect(html).toContain("Beneficiário");
  expect(html).toContain('disabled=""');
  expect(html).toContain('required=""');
});

/** Cobrança expõe arquivos e situação bancária respeitando empresa selecionada. */
import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { expect, it, vi } from "vitest";
import { seedFinance } from "@/src/domain/finance/setup";
import { seedPortfolio, type PortfolioState } from "@/src/domain/portfolio/model";
import FinanceModule from "@/src/features/finance/finance-module";
import { CollectionTab } from "@/src/features/finance/tabs/collection-tab";

const state = seedFinance("2026-10-20");
const base = seedPortfolio([]).titles[0];
const company = state.accounts[0].company;
const portfolio: PortfolioState = {
  version: 3,
  titles: [
    { ...base, id: "sem-boleto", company, documentNumber: "DOC-SEM", bankStatus: "Sem boleto", ourNumber: undefined },
    { ...base, id: "registrado", company, documentNumber: "DOC-REG", bankStatus: "Registrado", ourNumber: "12345678" },
    { ...base, id: "outra", company: "Outra empresa", documentNumber: "DOC-OUTRA" },
    { ...base, id: "cancelado", company, status: "Cancelado", documentNumber: "DOC-CANCELADO" },
  ],
};

it("oferece aba Cobrança na navegação financeira", () => {
  const html = renderToStaticMarkup(
    createElement(FinanceModule, {
      state,
      onState: vi.fn(),
      onEffects: vi.fn(),
      onPatchOperation: vi.fn(),
      operations: [],
      carteira: [],
      companyScope: company,
      onOpenOperation: vi.fn(),
    }),
  );
  expect(html).toMatch(/role="tab"[^>]*>.*?<span>Cobrança<\/span>/);
});

it("abre cobrança diretamente quando acionada pela Carteira", () => {
  const html = renderToStaticMarkup(
    createElement(FinanceModule, {
      state,
      onState: vi.fn(),
      onEffects: vi.fn(),
      onPatchOperation: vi.fn(),
      operations: [],
      carteira: [],
      companyScope: company,
      onOpenOperation: vi.fn(),
      initialTab: "cobranca",
    }),
  );
  expect(html).toContain("Carteira bancária indisponível neste ambiente");
  expect(html).toContain("CNAB 400 Itaú e Bradesco");
});

it("reúne remessa, retorno e posição bancária somente da empresa selecionada", () => {
  const html = renderToStaticMarkup(
    createElement(CollectionTab, { state, portfolio, scope: company, onCommitted: vi.fn(), onConfigureBanks: vi.fn() }),
  );
  expect(html).toContain("Arquivos de cobrança CNAB 400");
  expect(html).toContain("Situação bancária da carteira");
  expect(html).toContain("DOC-SEM");
  expect(html).toContain("DOC-REG");
  expect(html).toContain("Registrado");
  expect(html).toContain("12345678");
  expect(html).not.toContain("DOC-OUTRA");
  expect(html).not.toContain("DOC-CANCELADO");
});

it("oferece configuração e estado vazio sem inventar situação bancária", () => {
  const html = renderToStaticMarkup(
    createElement(CollectionTab, {
      state: { ...state, accounts: [] },
      portfolio: { version: 3, titles: [] },
      scope: company,
      onCommitted: vi.fn(),
      onConfigureBanks: vi.fn(),
    }),
  );
  expect(html).toContain("Configurar contas de cobrança");
  expect(html).toContain("Nenhum título na empresa selecionada");
  expect(html).toContain("Configure uma conta ativa CNAB 400");
});

it("mostra indisponibilidade explícita se carteira não foi fornecida", () => {
  const html = renderToStaticMarkup(createElement(CollectionTab, { state, scope: company, onConfigureBanks: vi.fn() }));
  expect(html).toContain("Carteira bancária indisponível neste ambiente");
  expect(html).not.toContain("Gerar remessa selecionada");
});

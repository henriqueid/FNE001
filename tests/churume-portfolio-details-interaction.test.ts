/** Componentes e handlers reais com hooks controlados; sem navegador/serviço externo. */
import type { ReactElement } from "react";
import type * as ReactModule from "react";
import { beforeEach, expect, it, vi } from "vitest";
const runtime = vi.hoisted(() => ({
  slots: [] as unknown[],
  cursor: 0,
  cleanups: [] as (() => void)[],
  parties: [] as unknown[],
}));
vi.mock("react", async original => ({
  ...(await original<typeof ReactModule>()),
  useMemo: (factory: () => unknown) => factory(),
  useState(initial: unknown) {
    const i = runtime.cursor++;
    if (!(i in runtime.slots)) runtime.slots[i] = typeof initial === "function" ? initial() : initial;
    return [
      runtime.slots[i],
      (value: unknown) => {
        runtime.slots[i] = typeof value === "function" ? value(runtime.slots[i]) : value;
      },
    ];
  },
  useRef(initial: unknown) {
    const i = runtime.cursor++;
    if (!(i in runtime.slots)) runtime.slots[i] = { current: initial };
    return runtime.slots[i];
  },
  useEffect(effect: () => (() => void) | void) {
    const cleanup = effect();
    if (cleanup) runtime.cleanups.push(cleanup);
  },
}));
vi.mock("react-dom", () => ({ createPortal: (children: unknown) => children }));
vi.mock("@/src/app/registry-context", () => ({ useRegistry: () => ({ parties: runtime.parties }) }));
import { initialOperations } from "@/src/domain/core/demo/operations";
import { seedPortfolio } from "@/src/domain/portfolio/model";
import { PortfolioTitleDetails } from "@/src/features/portfolio/portfolio-title-details";
import type { PortfolioGridRow } from "@/src/features/portfolio/portfolio-title-grid";
type Element = ReactElement<Record<string, unknown>>;
function elements(value: unknown): Element[] {
  if (Array.isArray(value)) return value.flatMap(elements);
  if (!value || typeof value !== "object" || !("props" in value)) return [];
  const element = value as Element;
  return [element, ...elements(element.props.children)];
}
function text(value: unknown): string {
  if (Array.isArray(value)) return value.map(text).join(" ");
  if (value && typeof value === "object" && "props" in value) return text((value as Element).props.children);
  return typeof value === "string" || typeof value === "number" ? String(value) : "";
}
function field(tree: unknown, label: string) {
  const section = elements(tree).find(item => item.type === "label" && text(item).includes(label));
  expect(section, label).toBeDefined();
  return elements(section).find(item => ["input", "textarea", "select"].includes(String(item.type)))!;
}
function change(tree: unknown, label: string, value: string) {
  (field(tree, label).props.onChange as (e: unknown) => void)({ target: { value } });
}
function submit(tree: unknown) {
  return (elements(tree).find(item => item.type === "form")!.props.onSubmit as (e: unknown) => Promise<void>)({
    preventDefault() {},
  });
}
function fixture(
  tab: "cobranca" | "controladoria" = "cobranca",
  commit: (state: ReturnType<typeof seedPortfolio>) => Promise<boolean> = async () => true,
) {
  const portfolio = seedPortfolio(initialOperations);
  const row: PortfolioGridRow = {
    ...portfolio.titles[0],
    id: portfolio.titles[0].id,
    source: "Carteira",
    amount: 100,
    reference: "CHURUME",
    originLabel: "CHURUME",
    displayStatus: "Em aberto",
    late: 0,
  };
  const onPortfolio = vi.fn(commit);
  let key: string | null = null;
  const render = (title = row) => {
    runtime.cursor = 0;
    let tree: unknown = PortfolioTitleDetails({
      title,
      portfolio,
      repName: () => "CHURUME",
      onPortfolio,
      onClose: vi.fn(),
      initialTab: tab,
    });
    if ((tree as Element).key !== null && typeof (tree as Element).type === "function") {
      const child = tree as Element;
      if (key !== child.key) {
        runtime.cleanups.forEach(cleanup => cleanup());
        runtime.cleanups = [];
        runtime.slots = [];
        key = child.key;
      }
      tree = (child.type as (props: unknown) => unknown)(child.props);
    }
    return tree;
  };
  return { row, portfolio, onPortfolio, render };
}
beforeEach(() => {
  runtime.slots = [];
  runtime.cursor = 0;
  runtime.cleanups = [];
  runtime.parties = [];
  vi.stubGlobal("document", { body: {} });
});
it.each(["cobranca", "controladoria"] as const)("%s bloqueia submit duplicado no mesmo ciclo", async tab => {
  let resolve!: (value: boolean) => void;
  const { render, onPortfolio } = fixture(
    tab,
    () =>
      new Promise<boolean>(yes => {
        resolve = yes;
      }),
  );
  change(render(), tab === "cobranca" ? "Resumo da conversa" : "Parecer geral", "CHURUME registro");
  const tree = render();
  const pending = submit(tree);
  void submit(tree);
  expect(onPortfolio).toHaveBeenCalledTimes(1);
  resolve(true);
  await pending;
});
it.each([false, "reject", true])("cobrança mantém rascunho até confirmação %s", async result => {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: Error) => void;
  const { render, onPortfolio } = fixture(
    "cobranca",
    () =>
      new Promise<boolean>((yes, no) => {
        resolve = yes;
        reject = no;
      }),
  );
  change(render(), "Resumo da conversa", "CHURUME conversa");
  const pending = submit(render());
  expect(field(render(), "Resumo da conversa").props.value).toBe("CHURUME conversa");
  expect(elements(render()).find(item => item.type === "button" && item.props.type === "submit")!.props.disabled).toBe(
    true,
  );
  if (result === "reject") reject(new Error("CHURUME falha"));
  else resolve(result === true);
  await pending;
  expect(field(render(), "Resumo da conversa").props.value).toBe(result === true ? "" : "CHURUME conversa");
  expect(onPortfolio.mock.calls[0][0].titles[0].collectionOccurrences.at(-1)?.notes).toBe("CHURUME conversa");
});
it("troca título descarta rascunho e retorno tardio não contamina novo formulário", async () => {
  let resolve!: (value: boolean) => void;
  const { render, row } = fixture(
    "cobranca",
    () =>
      new Promise<boolean>(yes => {
        resolve = yes;
      }),
  );
  change(render(), "Resumo da conversa", "Título A");
  const pending = submit(render());
  const other = { ...row, id: "CHURUME-B", documentNumber: "B" };
  expect(field(render(other), "Resumo da conversa").props.value).toBe("");
  change(render(other), "Resumo da conversa", "Título B");
  resolve(true);
  await pending;
  expect(field(render(other), "Resumo da conversa").props.value).toBe("Título B");
  expect(text(render(other))).not.toContain("Cobrança registrada");
});
it.each(["Data e hora da cobrança", "Próximo contato", "Data prometida"])(
  "cobrança recusa %s vazio no handler",
  async label => {
    const { render, onPortfolio } = fixture();
    change(render(), "Resumo da conversa", "CHURUME");
    if (label === "Data prometida") change(render(), "Resultado do contato", "Promessa de pagamento");
    change(render(), label, "");
    await submit(render());
    expect(onPortfolio).not.toHaveBeenCalled();
  },
);
it("checagem recusa data vazia no handler", async () => {
  const { render, onPortfolio } = fixture("controladoria");
  change(render(), "Parecer geral", "CHURUME");
  change(render(), "Data e hora do contato", "");
  await submit(render());
  expect(onPortfolio).not.toHaveBeenCalled();
});
it("desfecho sem promessa não persiste data prometida anterior", async () => {
  const { render, onPortfolio } = fixture();
  change(render(), "Resultado do contato", "Promessa de pagamento");
  change(render(), "Data prometida", "2026-11-01");
  change(render(), "Resultado do contato", "Sem resposta");
  change(render(), "Resumo da conversa", "CHURUME");
  await submit(render());
  expect(onPortfolio.mock.calls[0][0].titles[0].collectionOccurrences.at(-1)?.promiseDate).toBeUndefined();
});
it.each([
  ["(55) 99999-1234", "5555999991234"],
  ["+55 11 99999-1234", "5511999991234"],
])("WhatsApp normaliza %s sem perder DDD", (phone, expected) => {
  const { render, row } = fixture();
  runtime.parties = [{ document: row.debtorDocument, phone }];
  const link = elements(render()).find(item => item.type === "a" && text(item).includes("Cobrar no WhatsApp"))!;
  expect(link.props.href).toContain(`https://wa.me/${expected}?text=`);
});
it.each([false, "reject", true])("checagem mantém parecer e só anuncia sucesso após %s", async result => {
  let resolve!: (value: boolean) => void;
  let reject!: (reason: Error) => void;
  const { render, onPortfolio } = fixture(
    "controladoria",
    () =>
      new Promise<boolean>((yes, no) => {
        resolve = yes;
        reject = no;
      }),
  );
  change(render(), "Parecer geral", "CHURUME divergência");
  change(render(), "Status da confirmação", "Divergente");
  const pending = submit(render());
  expect(text(render())).not.toContain("Confirmação da Controladoria atualizada");
  if (result === "reject") reject(new Error("CHURUME falha"));
  else resolve(result === true);
  await pending;
  expect(field(render(), "Parecer geral").props.value).toBe("CHURUME divergência");
  expect(text(render()).includes("Confirmação da Controladoria atualizada")).toBe(result === true);
  expect(onPortfolio.mock.calls[0][0].titles[0].confirmation?.status).toBe("Divergente");
});
it("sacado com contato secundário usa telefone/e-mail quando principais vazios", () => {
  const { render, row } = fixture();
  runtime.parties = [
    {
      document: row.debtorDocument,
      phone: "",
      email: "",
      contacts: [{ phone: "11999991234", email: "financeiro+qa@example.test" }],
    },
  ];
  const links = elements(render()).filter(item => item.type === "a");
  expect(links.find(item => text(item).includes("Cobrar no WhatsApp"))!.props.href).toContain(
    "https://wa.me/5511999991234?",
  );
  expect(links.find(item => text(item).includes("Cobrar por e-mail"))!.props.href).toContain(
    "mailto:financeiro+qa@example.test?",
  );
});
it("Central não chama título quitado de promessa ativa e preserva acordo histórico", async () => {
  const { CollectionCenter } = await import("@/src/features/portfolio/collection-center");
  const { row, portfolio } = fixture();
  const rows = [
    {
      ...row,
      amount: 0,
      collectionOccurrences: [
        {
          id: "negotiation",
          chargedAt: "2026-10-01T10:00",
          channel: "Telefone" as const,
          contactPerson: "CHURUME",
          outcome: "Negociação em andamento" as const,
          notes: "histórico",
          nextContactAt: "2026-10-02T09:00",
          createdAt: "2026-10-01T10:00",
          createdBy: "CHURUME",
        },
        {
          id: "promise",
          chargedAt: "2026-10-02T10:00",
          channel: "Telefone" as const,
          contactPerson: "CHURUME",
          outcome: "Promessa de pagamento" as const,
          notes: "Quitada",
          promiseDate: "2026-10-03",
          nextContactAt: "2026-10-03T09:00",
          createdAt: "2026-10-02T10:00",
          createdBy: "CHURUME",
        },
      ],
    },
  ];
  const screen = () => {
    runtime.cursor = 0;
    return CollectionCenter({ rows, today: "2026-10-26", portfolio, onPortfolio: vi.fn(), repName: () => "CHURUME" });
  };
  const tree = screen();
  const tabs = elements(tree).find(item => item.props.label === "Recursos da cobrança")!;
  const options = tabs.props.tabs as { id: string; count?: number }[];
  expect(options.find(item => item.id === "promessas")?.count).toBe(0);
  expect(options.find(item => item.id === "acordos")?.count).toBe(1);
  (tabs.props.onChange as (value: string) => void)("acordos");
  expect(text(screen())).toContain("Quitada");
});
it.each(["cobranca", "controladoria"] as const)("%s não envia texto obrigatório em branco", async tab => {
  const { render, onPortfolio } = fixture(tab);
  change(render(), tab === "cobranca" ? "Resumo da conversa" : "Parecer geral", "  ");
  await submit(render());
  expect(onPortfolio).not.toHaveBeenCalled();
});
it("sem contatos não gera links acionáveis de cobrança", () => {
  const { render } = fixture();
  for (const label of ["Cobrar no WhatsApp", "Cobrar por e-mail", "Enviar boleto"]) {
    const link = elements(render()).find(item => item.type === "a" && text(item).trim() === label)!;
    expect(link.props.href).toBeUndefined();
  }
});
it("troca título inicia checagem do novo título sem parecer anterior", () => {
  const { render, row } = fixture("controladoria");
  change(render(), "Parecer geral", "CHURUME parecer A");
  const other = {
    ...row,
    id: "CHURUME-B",
    confirmation: {
      status: "Pendente" as const,
      contactedAt: "2026-10-26T09:00",
      channel: "E-mail" as const,
      contactPerson: "QA B",
      notes: "CHURUME parecer B",
    },
  };
  expect(field(render(other), "Parecer geral").props.value).toBe("CHURUME parecer B");
  expect(field(render(other), "Status da confirmação").props.value).toBe("Pendente");
});
it.each([
  ["Data e hora da cobrança", "2026-02-29T09:00"],
  ["Próximo contato", "2026-04-31T09:00"],
  ["Data prometida", "2026-02-29"],
])("cobrança recusa calendário impossível em %s", async (label, value) => {
  const { render, onPortfolio } = fixture();
  change(render(), "Resumo da conversa", "CHURUME");
  if (label === "Data prometida") change(render(), "Resultado do contato", "Promessa de pagamento");
  change(render(), label, value);
  await submit(render());
  expect(onPortfolio).not.toHaveBeenCalled();
});
it("checagem recusa 31/04 sem normalizar para maio", async () => {
  const { render, onPortfolio } = fixture("controladoria");
  change(render(), "Parecer geral", "CHURUME");
  change(render(), "Data e hora do contato", "2026-04-31T09:00");
  await submit(render());
  expect(onPortfolio).not.toHaveBeenCalled();
});

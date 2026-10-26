/** Fixtures independentes montadas pelas posições dos manuais oficiais, sem banco real. */
import { describe, expect, it } from "vitest";
import {
  generateCnab400Remittance,
  parseCnab400Return,
  bradescoOurNumberDigit,
  type Cnab400Account,
  type Cnab400Title,
} from "@/src/domain/banking/cnab400";

const accounts: Cnab400Account[] = [
  {
    bankCode: "341",
    agency: "1234",
    account: "12345",
    accountDigit: "6",
    wallet: "109",
    mode: "registered-client-issued",
    beneficiary: { document: "11222333000181", name: "Empresa Teste" },
  },
  {
    bankCode: "237",
    agency: "1234",
    account: "1234567",
    accountDigit: "8",
    wallet: "19",
    agreementCode: "123456789",
    mode: "registered-client-issued",
    beneficiary: { document: "11222333000181", name: "Empresa Teste" },
  },
];
const title: Cnab400Title = {
  controlId: "OP-001",
  documentNumber: "DUP-001",
  ourNumber: "2",
  amountCents: 123456,
  issuedOn: "2026-10-01",
  dueOn: "2026-11-01",
  dailyInterestCents: 25,
  discount: { until: "2026-10-25", amountCents: 1000 },
  payer: {
    document: "52998224725",
    name: "Jose da Silva",
    address: "Rua Um 123",
    neighborhood: "Centro",
    postalCode: "01001000",
    city: "Sao Paulo",
    state: "SP",
  },
};

describe("Itaú escritural 112 e complementos", () => {
  const account = { ...accounts[0], wallet: "112", mode: "registered-bank-issued" as const };
  const input = (titles: Cnab400Title[]) => ({ account, generatedOn: "2026-10-18", remittanceSequence: 42, titles });
  it("envia nosso número zerado e controles distintos em múltiplos títulos", () => {
    const first = { ...title, ourNumber: "00000000" };
    const second = { ...first, controlId: "SECOND", documentNumber: "DUP-002" };
    const rows = generateCnab400Remittance(input([first, second]))
      .trimEnd()
      .split("\r\n");
    expect(rows).toHaveLength(4);
    expect(field(rows[1], 63, 70)).toBe("00000000");
    expect(field(rows[2], 63, 70)).toBe("00000000");
    expect(field(rows[1], 84, 86)).toBe("112");
  });
  it("não aceita número próprio na carteira112 nem modalidade escritural na109", () => {
    expect(() => generateCnab400Remittance(input([title]))).toThrow(/número/i);
    expect(() => generateCnab400Remittance({ ...input([title]), account: { ...account, wallet: "109" } })).toThrow(
      /modalidade/i,
    );
  });
  it("codifica multa2% em registro2 com data DDMMAAAA e mantém sequencial", () => {
    const rows = generateCnab400Remittance(
      input([{ ...title, ourNumber: "00000000", lateFine: { percent: 2, from: "2026-11-02" } }]),
    )
      .trimEnd()
      .split("\r\n");
    expect(rows[2][0]).toBe("2");
    expect(field(rows[2], 2, 2)).toBe("2");
    expect(field(rows[2], 3, 10)).toBe("02112026");
    expect(field(rows[2], 11, 23)).toBe("0000000000200");
    expect(field(rows[3], 395, 400)).toBe("000004");
  });
  it("envia email preservado no registro5 junto ao sacador, antes do complemento de multa", () => {
    const item = {
      ...title,
      ourNumber: "00000000",
      payer: { ...title.payer, email: "Jose.Silva@example.com" },
      finalBeneficiary: { ...title.payer, name: "Cedente Teste" },
      lateFine: { percent: 2, from: "2026-11-02" },
    };
    const rows = generateCnab400Remittance(input([item]))
      .trimEnd()
      .split("\r\n");
    expect(rows.map(row => row[0])).toEqual(["0", "1", "5", "2", "9"]);
    expect(field(rows[2], 2, 121).trim()).toBe("Jose.Silva@example.com");
    expect(field(rows[2], 122, 123)).toBe("01");
    expect(rows.every(row => Buffer.byteLength(row, "ascii") === 400)).toBe(true);
    expect(rows.map(row => field(row, 395, 400))).toEqual(["000001", "000002", "000003", "000004", "000005"]);
  });
  it("gera registro5 só com email e rejeita endereço inválido ou truncado", () => {
    const item = { ...title, ourNumber: "00000000", payer: { ...title.payer, email: "Contato@example.com" } };
    const rows = generateCnab400Remittance(input([item]))
      .trimEnd()
      .split("\r\n");
    expect(rows[2][0]).toBe("5");
    expect(field(rows[2], 122, 137)).toBe("0000000000000000");
    for (const email of ["invalido", "a\r\nb@example.com", "a".repeat(120) + "@example.com"])
      expect(() => generateCnab400Remittance(input([{ ...item, payer: { ...item.payer, email } }]))).toThrow(/mail/i);
  });
  it("recusa multa fora dos limites e antes do vencimento", () => {
    for (const lateFine of [
      { percent: 100, from: "2026-11-02" },
      { percent: 2, from: "2026-10-31" },
      { percent: 2.001, from: "2026-11-02" },
    ])
      expect(() => generateCnab400Remittance(input([{ ...title, ourNumber: "00000000", lateFine }]))).toThrow(/multa/i);
  });
  it("retorno112 aceita rejeição sem número, mas confirmação deve trazer número atribuído", () => {
    const returned = (occurrence: string, number: string) =>
      fixture(accounts[0], occurrence)
        .split("\r\n")
        .map((row, index) =>
          index !== 1
            ? row
            : row.slice(0, 62) +
              number +
              row.slice(70, 82) +
              "112" +
              number +
              row.slice(93, 126) +
              number +
              row.slice(134),
        )
        .join("\r\n");
    expect(parseCnab400Return(returned("03", "00000000"), account).events[0].kind).toBe("rejection");
    expect(parseCnab400Return(returned("02", "87654321"), account).events[0].ourNumber).toBe("87654321");
    expect(() => parseCnab400Return(returned("02", "00000000"), account)).toThrow(/número/i);
  });
});
function field(record: string, start: number, end: number) {
  return record.slice(start - 1, end);
}
function fixture(account: Cnab400Account, occurrence = "06") {
  const rec = () => Array<string>(400).fill(" ");
  const put = (r: string[], start: number, value: string) => {
    for (let i = 0; i < value.length; i++) r[start - 1 + i] = value[i];
  };
  const header = rec(),
    detail = rec(),
    trailer = rec();
  put(header, 1, "02RETORNO01COBRANCA       ");
  put(header, 77, account.bankCode);
  put(header, 95, "181026");
  put(header, 109, "00042");
  put(header, 395, "000001");
  put(detail, 1, "1");
  put(detail, 2, "02");
  put(detail, 4, "11222333000181");
  put(detail, 38, "OP-001");
  put(detail, 109, occurrence);
  put(detail, 111, "181026");
  put(detail, 117, "DUP-001");
  put(detail, 147, "011126");
  for (const start of [153, 176, 215, 228, 241, 254, 267, 280]) put(detail, start, "0000000000000");
  put(detail, 153, "0000000123456");
  put(detail, 176, "0000000000123");
  put(detail, 241, "0000000001000");
  put(detail, 254, occurrence === "06" ? "0000000122481" : "0000000000000");
  put(detail, 267, "0000000000025");
  put(detail, 296, occurrence === "06" ? "191026" : "000000");
  put(detail, 395, "000002");
  if (account.bankCode === "341") {
    put(header, 27, "123400123456");
    put(detail, 18, "123400123456");
    put(detail, 63, "00000002");
    put(detail, 83, "109000000020");
    put(detail, 108, "I");
    put(detail, 127, "00000002");
    put(detail, 378, "00000000");
  } else {
    put(header, 27, "00000000000123456789");
    put(detail, 21, "00190123412345678");
    put(detail, 71, "000000000028");
    put(detail, 105, "000");
    put(detail, 108, "9");
    put(detail, 127, "000000000028");
    put(detail, 189, "0000000000000");
    put(detail, 319, "0000000000");
  }
  put(trailer, 1, `9201${account.bankCode}`);
  put(trailer, 395, "000003");
  return (
    [header.join(""), detail.join(""), trailer.join("")].join("\r\n") +
    "\r\n" +
    (account.bankCode === "237" ? "\x1a" : "")
  );
}

describe.each(accounts)("CNAB400 banco $bankCode", account => {
  it("gera entrada de duplicata em posições exatas e registros ASCII de 400 bytes", () => {
    const input = { account, generatedOn: "2026-10-18", remittanceSequence: 42, titles: [title] };
    const content = generateCnab400Remittance(input);
    expect(content).toBe(generateCnab400Remittance(input));
    const lines = (content.endsWith("\x1a") ? content.slice(0, -1) : content).trimEnd().split("\r\n");
    expect(lines).toHaveLength(3);
    expect(lines.every(line => Buffer.byteLength(line, "ascii") === 400 && /^[\x20-\x7e]+$/.test(line))).toBe(true);
    expect(field(lines[0], 77, 79)).toBe(account.bankCode);
    expect(field(lines[1], 109, 110)).toBe("01");
    expect(field(lines[1], 121, 126)).toBe("011126");
    expect(field(lines[1], 127, 139)).toBe("0000000123456");
    expect(field(lines[1], 148, 149)).toBe("01");
    expect(field(lines[1], 157, 160)).toBe("0000");
    expect(field(lines[1], 219, 234)).toBe("0100052998224725");
    expect(field(lines[1], 395, 400)).toBe("000002");
    expect(field(lines[2], 395, 400)).toBe("000003");
    if (account.bankCode === "341") {
      expect(field(lines[1], 84, 86)).toBe("109");
      expect(field(lines[1], 108, 108)).toBe("I");
      expect(field(lines[1], 63, 70)).toBe("00000002");
    } else {
      expect(field(lines[0], 109, 117)).toBe("MX0000042");
      expect(field(lines[1], 21, 37)).toBe("00190123412345678");
      expect(field(lines[1], 71, 82)).toBe("000000000028");
      expect(field(lines[1], 93, 93)).toBe("2");
      expect(content.endsWith("\r\n\x1a")).toBe(true);
    }
  });
  it("lê liquidação, valores, conta e rastreio de repetição", () => {
    const parsed = parseCnab400Return(fixture(account), account);
    expect(parsed.events).toHaveLength(1);
    expect(parsed.events[0]).toMatchObject({
      kind: "settlement",
      bankOccurrence: "06",
      amountCents: 123456,
      paidAmountCents: 122481,
      interestCents: 25,
      discountCents: 1000,
      feeCents: 123,
      occurredOn: "2026-10-18",
      creditedOn: "2026-10-19",
      controlId: "OP-001",
      documentNumber: "DUP-001",
      recordSequence: 2,
    });
    expect(parsed.events[0].idempotencyKey).toBe(
      parseCnab400Return(fixture(account), account).events[0].idempotencyKey,
    );
  });
  it.each([
    ["02", "entry"],
    ["03", "rejection"],
    ["09", "writeoff"],
  ])("classifica ocorrência %s sem transformar baixa em pagamento", (occurrence, kind) => {
    const event = parseCnab400Return(fixture(account, occurrence), account).events[0];
    expect(event.kind).toBe(kind);
    expect(event.paidAmountCents).toBe(0);
  });
  it("recusa banco ou conta divergente e arquivo truncado", () => {
    expect(() => parseCnab400Return(fixture(account), { ...account, account: "99999" })).toThrow(/conta|beneficiário/i);
    expect(() => parseCnab400Return(fixture(account).slice(0, 700), account)).toThrow();
    expect(() => parseCnab400Return(fixture(account).replace(/RETORNO/, "REMESSA"), account)).toThrow();
  });
  it("recusa valores, documentos e variantes não implementados", () => {
    const make = (change: Partial<Cnab400Title>) =>
      generateCnab400Remittance({
        account,
        generatedOn: "2026-10-18",
        remittanceSequence: 42,
        titles: [{ ...title, ...change }],
      });
    expect(() => make({ amountCents: 1.5 })).toThrow();
    expect(() => make({ dueOn: "2026-02-30" })).toThrow();
    expect(() => make({ ourNumber: "" })).toThrow();
    expect(() => make({ payer: { ...title.payer, document: "11111111111" } })).toThrow();
    expect(() =>
      generateCnab400Remittance({
        account: { ...account, wallet: "999" },
        generatedOn: "2026-10-18",
        remittanceSequence: 42,
        titles: [title],
      }),
    ).toThrow(/carteira/i);
    expect(() => parseCnab400Return(fixture(account, "99"), account)).toThrow(/ocorrência/i);
  });
});
it("calcula DAC Bradesco pelos exemplos oficiais 19/2=8, 19/1=P, 19/6=0", () => {
  expect(bradescoOurNumberDigit("19", "00000000002")).toBe("8");
  expect(bradescoOurNumberDigit("19", "00000000001")).toBe("P");
  expect(bradescoOurNumberDigit("19", "00000000006")).toBe("0");
});

it.each(accounts)("expõe semântica bancária do valor em $bankCode", account => {
  const event = parseCnab400Return(fixture(account), account).events[0];
  expect(event.paidAmountSemantics).toBe(account.bankCode === "341" ? "account-credit" : "gross-received");
});
it.each(accounts)("não completa CEP incompleto com zeros em $bankCode", account => {
  expect(() =>
    generateCnab400Remittance({
      account,
      generatedOn: "2026-10-18",
      remittanceSequence: 42,
      titles: [{ ...title, payer: { ...title.payer, postalCode: "1001000" } }],
    }),
  ).toThrow(/CEP/i);
});
it.each(accounts)("recusa sequência quebrada, data inválida e ocorrência desconhecida em $bankCode", account => {
  const broken = fixture(account).replace(/000002\r\n/, "000008\r\n");
  expect(() => parseCnab400Return(broken, account)).toThrow(/sequência/i);
  const badDate = fixture(account).slice(0, 512) + "300226" + fixture(account).slice(518);
  expect(() => parseCnab400Return(badDate, account)).toThrow(/data/i);
  expect(() => parseCnab400Return(fixture(account, "40"), account)).toThrow(/ocorrência/i);
});

it.each(accounts)("gera complemento oficial do sacador e numeração contínua em $bankCode", account => {
  const drawer = { ...title.payer, name: "Cedente Original" };
  const content = generateCnab400Remittance({
    account: { ...account, finalBeneficiaryEnabled: true },
    generatedOn: "2026-10-18",
    remittanceSequence: 42,
    titles: [
      { ...title, finalBeneficiary: drawer },
      { ...title, controlId: "OP-002", ourNumber: "3", finalBeneficiary: drawer },
    ],
  });
  const rows = (content.endsWith("\x1a") ? content.slice(0, -1) : content).slice(0, -2).split("\r\n");
  expect(rows).toHaveLength(6);
  expect(rows.map(row => field(row, 395, 400))).toEqual(["000001", "000002", "000003", "000004", "000005", "000006"]);
  expect(rows.every(row => row.length === 400)).toBe(true);
  if (account.bankCode === "341") {
    expect(field(rows[1], 352, 381)).toBe("CEDENTE ORIGINAL              ");
    expect(rows[2][0]).toBe("5");
    expect(field(rows[2], 122, 137)).toBe("0100052998224725");
    expect(field(rows[2], 138, 177).trim()).toBe("RUA UM 123");
    expect(field(rows[2], 190, 197)).toBe("01001000");
    expect(field(rows[2], 213, 214)).toBe("SP");
  } else {
    expect(field(rows[1], 335, 349)).toBe("529982247000025");
    expect(field(rows[1], 350, 351)).toBe("  ");
    expect(field(rows[1], 352, 394).trim()).toBe("CEDENTE ORIGINAL");
    expect(rows[2][0]).toBe("7");
    expect(field(rows[2], 2, 46).trim()).toBe("RUA UM 123");
    expect(field(rows[2], 47, 54)).toBe("01001000");
    expect(field(rows[2], 367, 394)).toBe("0190123412345678000000000028");
  }
});
it("não presume cadastro Bradesco para enviar beneficiário final", () => {
  expect(() =>
    generateCnab400Remittance({
      account: accounts[1],
      generatedOn: "2026-10-18",
      remittanceSequence: 42,
      titles: [{ ...title, finalBeneficiary: title.payer }],
    }),
  ).toThrow(/cadastro|habilita/i);
});

it("respeita limite de desconto Itaú de noventa por cento", () => {
  expect(() =>
    generateCnab400Remittance({
      account: accounts[0],
      generatedOn: "2026-10-18",
      remittanceSequence: 42,
      titles: [{ ...title, discount: { until: "2026-10-25", amountCents: 120000 } }],
    }),
  ).toThrow(/desconto/i);
});
it.each(accounts)("deduplica mesmo evento presente em arquivos bancários diferentes $bankCode", account => {
  const original = fixture(account),
    another = original.slice(0, 94) + "191026" + original.slice(100, 108) + "00043" + original.slice(113);
  expect(parseCnab400Return(another, account).bankFileId).toBe("00043");
  expect(parseCnab400Return(another, account).events[0].idempotencyKey).toBe(
    parseCnab400Return(original, account).events[0].idempotencyKey,
  );
});

describe("baixa de registro existente", () => {
  it.each([accounts[0], accounts[1], { ...accounts[0], wallet: "112", mode: "registered-bank-issued" as const }])(
    "gera ocorrência02 sem novo registro em $bankCode/$wallet",
    account => {
      const rows = generateCnab400Remittance({
        account,
        generatedOn: "2026-10-25",
        remittanceSequence: 2,
        titles: [
          {
            instruction: "writeoff",
            controlId: "ORIGINAL",
            documentNumber: "DOC-01",
            ourNumber: "2",
            amountCents: 100000,
          },
        ],
      }).split("\r\n");
      expect(rows[1].slice(108, 110)).toBe("02");
      expect(rows[1].slice(37, 62).trim()).toBe(account.bankCode === "341" ? "" : "ORIGINAL");
      if (account.bankCode === "341") {
        expect(rows[1].slice(1, 17)).toBe("0000000000000000");
        expect(rows[1].slice(110, 120)).toBe("          ");
      }
      expect(rows[1].slice(account.bankCode === "341" ? 62 : 70, account.bankCode === "341" ? 70 : 81)).toBe(
        account.bankCode === "341" ? "00000002" : "00000000002",
      );
      expect(rows[1].slice(126, 139)).toBe("0000000100000");
      expect(rows[2][0]).toBe("9");
    },
  );
});

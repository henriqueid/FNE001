/** Cobrança CNAB400: entrada de duplicata registrada e retorno bancário estrito. */
import { isValidCpf, isValidCnpj } from "@/src/domain/registry/parties";
export type Cnab400Account = {
  bankCode: "341" | "237";
  agency: string;
  account: string;
  accountDigit: string;
  wallet: string;
  agreementCode?: string;
  finalBeneficiaryEnabled?: boolean;
  mode: "registered-client-issued" | "registered-bank-issued";
  beneficiary: { document: string; name: string };
};
export type Cnab400Title = {
  controlId: string;
  documentNumber: string;
  ourNumber: string;
  amountCents: number;
  issuedOn: string;
  dueOn: string;
  dailyInterestCents: number;
  lateFine?: { percent: number; from: string };
  discount?: { until: string; amountCents: number };
  finalBeneficiary?: Cnab400Title["payer"];
  payer: {
    document: string;
    name: string;
    address: string;
    neighborhood: string;
    postalCode: string;
    city: string;
    state: string;
    email?: string;
  };
};
export type Cnab400ReturnEvent = {
  kind: "entry" | "rejection" | "settlement" | "writeoff";
  bankOccurrence: string;
  controlId: string;
  documentNumber: string;
  ourNumber: string;
  amountCents: number;
  paidAmountCents: number;
  paidAmountSemantics: "account-credit" | "gross-received";
  interestCents: number;
  discountCents: number;
  feeCents: number;
  abatementCents: number;
  iofCents: number;
  otherCreditsCents: number;
  otherExpensesCents: number;
  occurredOn: string;
  dueOn?: string;
  creditedOn?: string;
  rejectionCodes: string[];
  idempotencyKey: string;
  recordSequence: number;
  rawRecord: string;
};
export type Cnab400Return = {
  bankCode: Cnab400Account["bankCode"];
  generatedOn: string;
  bankFileId: string;
  events: Cnab400ReturnEvent[];
};
export type Cnab400Remittance = {
  account: Cnab400Account;
  generatedOn: string;
  remittanceSequence: number;
  titles: Cnab400Title[];
};
function fail(message: string): never {
  throw new Error(`CNAB400: ${message}`);
}
function digits(value: string, width: number, label: string, positive = false) {
  if (typeof value !== "string" || !/^\d+$/.test(value) || value.length > width || (positive && /^0+$/.test(value)))
    fail(`${label} inválido.`);
  return value.padStart(width, "0");
}
function text(value: string, width: number, label: string) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} obrigatório.`);
  const normalized = value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toUpperCase()
    .trim();
  if (!/^[\x20-\x7e]+$/.test(normalized) || normalized.length > width)
    fail(`${label} excede tamanho ou contém caracteres não suportados.`);
  return normalized.padEnd(width, " ");
}
function cents(value: number, label: string, positive = false) {
  if (!Number.isSafeInteger(value) || value < (positive ? 1 : 0) || value > 9999999999999)
    fail(`${label} deve ser inteiro em centavos dentro do limite.`);
  return String(value).padStart(13, "0");
}
function date(value: string) {
  if (
    typeof value !== "string" ||
    !/^20\d{2}-\d{2}-\d{2}$/.test(value) ||
    !Number.isFinite(Date.parse(value + "T00:00:00Z")) ||
    new Date(value + "T00:00:00Z").toISOString().slice(0, 10) !== value
  )
    fail("Data inválida; suportado somente 2000–2099.");
  return value.slice(8, 10) + value.slice(5, 7) + value.slice(2, 4);
}
function readDate(value: string, optional = false): string | undefined {
  if (optional && /^(000000| {6})$/.test(value)) return undefined;
  if (!/^\d{6}$/.test(value)) fail("Data de retorno inválida.");
  const iso = `20${value.slice(4, 6)}-${value.slice(2, 4)}-${value.slice(0, 2)}`;
  date(iso);
  return iso;
}
function document(value: string) {
  if (
    typeof value !== "string" ||
    !/^\d+$/.test(value) ||
    !(value.length === 11 ? isValidCpf(value) : value.length === 14 && isValidCnpj(value))
  )
    fail("CPF/CNPJ inválido; informar somente dígitos.");
  return { type: value.length === 11 ? "01" : "02", number: value.padStart(14, "0") };
}
function accountFields(account: Cnab400Account) {
  const itau = account.bankCode === "341";
  if (!itau && account.bankCode !== "237") fail("Banco não implementado.");
  const bankIssued = itau && account.wallet === "112";
  if (account.mode !== (bankIssued ? "registered-bank-issued" : "registered-client-issued"))
    fail("Modalidade incompatível com a carteira de cobrança.");
  if (itau ? !["109", "112"].includes(account.wallet) : !["09", "19"].includes(account.wallet))
    fail("Carteira não implementada.");
  const agency = digits(account.agency, itau ? 4 : 5, "Agência", true);
  const number = digits(account.account, itau ? 5 : 7, "Conta", true);
  const digit = digits(account.accountDigit, 1, "Dígito da conta");
  const agreement = itau ? undefined : digits(account.agreementCode ?? "", 20, "Convênio", true);
  const beneficiary = document(account.beneficiary.document);
  text(account.beneficiary.name, 30, "Nome do beneficiário");
  return {
    itau,
    bankIssued,
    agency,
    number,
    digit,
    agreement,
    beneficiary,
    identity: itau ? agency + "00" + number + digit : "0" + account.wallet.padStart(3, "0") + agency + number + digit,
  };
}
function record(type: string) {
  const row = Array<string>(400).fill(" ");
  row[0] = type;
  return row;
}
function put(row: string[], start: number, value: string) {
  for (let i = 0; i < value.length; i++) row[start - 1 + i] = value[i];
}
function field(row: string, start: number, end: number) {
  return row.slice(start - 1, end);
}
function numeric(row: string, start: number, end: number) {
  const value = field(row, start, end);
  if (!/^\d+$/.test(value) || !Number.isSafeInteger(Number(value)))
    fail(`Campo numérico inválido nas posições ${start}–${end}.`);
  return Number(value);
}

function validateLocation(party: Cnab400Title["payer"]) {
  if (!/^\d{8}$/.test(party.postalCode) || /^0+$/.test(party.postalCode))
    fail("CEP deve conter exatamente oito dígitos.");
  if (!/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(party.state))
    fail("UF inválida.");
}

function finalBeneficiaryRecord(account: Cnab400Account, title: Cnab400Title, row: string[], sequence: number) {
  const party = title.finalBeneficiary!;
  const registration = document(party.document),
    a = accountFields(account);
  validateLocation(party);
  if (a.itau) {
    put(row, 352, text(party.name, 30, "Nome do sacador"));
    const extra = record("5");
    put(extra, 122, registration.type + registration.number);
    put(extra, 138, text(party.address, 40, "Endereço do sacador"));
    put(extra, 178, text(party.neighborhood, 12, "Bairro do sacador"));
    put(extra, 190, party.postalCode);
    put(extra, 198, text(party.city, 15, "Cidade do sacador"));
    put(extra, 213, party.state);
    put(extra, 395, String(sequence).padStart(6, "0"));
    return extra.join("");
  }
  if (account.finalBeneficiaryEnabled !== true)
    fail("O Bradesco exige cadastro prévio habilitado para beneficiário final.");
  const registration15 =
    party.document.length === 11
      ? party.document.slice(0, 9) + "0000" + party.document.slice(9)
      : party.document.padStart(15, "0");
  put(row, 335, registration15 + "  " + text(party.name, 43, "Nome do beneficiário final"));
  const extra = record("7");
  put(extra, 2, text(party.address, 45, "Endereço do beneficiário final"));
  put(extra, 47, party.postalCode);
  put(extra, 55, text(party.city, 20, "Cidade do beneficiário final"));
  put(extra, 75, party.state);
  put(
    extra,
    367,
    account.wallet.padStart(3, "0") +
      a.agency +
      a.number +
      a.digit +
      digits(title.ourNumber, 11, "Nosso número", true) +
      bradescoOurNumberDigit(account.wallet, title.ourNumber),
  );
  put(extra, 395, String(sequence).padStart(6, "0"));
  return extra.join("");
}

export function bradescoOurNumberDigit(wallet: string, ourNumber: string): string {
  const source = digits(wallet, 2, "Carteira") + digits(ourNumber, 11, "Nosso número", true);
  let sum = 0,
    weight = 2;
  for (let i = source.length - 1; i >= 0; i--) {
    sum += Number(source[i]) * weight;
    weight = weight === 7 ? 2 : weight + 1;
  }
  const remainder = sum % 11;
  return remainder === 0 ? "0" : remainder === 1 ? "P" : String(11 - remainder);
}

export function generateCnab400Remittance(input: Cnab400Remittance): string {
  const { account, titles } = input,
    a = accountFields(account);
  const generated = date(input.generatedOn);
  if (
    !Number.isSafeInteger(input.remittanceSequence) ||
    input.remittanceSequence <= 0 ||
    input.remittanceSequence > 9999999
  )
    fail("Sequencial de remessa inválido.");
  if (!Array.isArray(titles) || !titles.length || titles.length > 999997) fail("Quantidade de títulos inválida.");
  const header = record("0");
  put(header, 2, "1REMESSA01COBRANCA       ");
  put(header, 27, a.itau ? a.identity : a.agreement!);
  put(header, 47, text(account.beneficiary.name, 30, "Nome do beneficiário"));
  put(header, 77, account.bankCode);
  put(header, 80, text(a.itau ? "BANCO ITAU SA" : "BRADESCO", 15, "Banco"));
  put(header, 95, generated);
  if (!a.itau) {
    put(header, 109, "MX");
    put(header, 111, String(input.remittanceSequence).padStart(7, "0"));
  }
  put(header, 395, "000001");
  const seenNumbers = new Set<string>(),
    seenControls = new Set<string>();
  let sequence = 1;
  const details = titles.flatMap(title => {
    const detailSequence = ++sequence;
    const row = record("1"),
      ourNumber = digits(title.ourNumber, a.itau ? 8 : 11, "Nosso número", !a.bankIssued);
    if (a.bankIssued && ourNumber !== "00000000")
      fail("Nosso número da carteira112 deve ser zerado na remessa; será atribuído pelo banco.");
    const control = text(title.controlId, 25, "Controle do título"),
      payer = document(title.payer.document);
    validateLocation(title.payer);
    if ((!a.bankIssued && seenNumbers.has(ourNumber)) || seenControls.has(control))
      fail("Título duplicado na remessa.");
    seenNumbers.add(ourNumber);
    seenControls.add(control);
    const due = date(title.dueOn),
      issued = date(title.issuedOn);
    if (title.issuedOn > title.dueOn || title.issuedOn > input.generatedOn || title.dueOn < input.generatedOn)
      fail("Datas do título incompatíveis com entrada de duplicata a vencer.");
    if (a.itau) {
      put(row, 2, a.beneficiary.type + a.beneficiary.number);
      put(row, 18, a.identity);
      put(row, 34, "0000");
      put(row, 63, ourNumber);
      put(row, 71, "0000000000000");
      put(row, 84, account.wallet);
      put(row, 108, "I");
      put(row, 140, "34100000");
      put(row, 386, "00000000");
    } else {
      put(row, 2, "0000000000000000000");
      put(row, 21, a.identity);
      put(row, 63, "00000000");
      put(row, 71, ourNumber + bradescoOurNumberDigit(account.wallet, ourNumber));
      put(row, 83, "0000000000");
      put(row, 93, "2");
      put(row, 140, "00000000");
    }
    put(row, 38, control);
    put(row, 109, "01");
    put(row, 111, text(title.documentNumber, 10, "Número do documento"));
    put(row, 121, due);
    put(row, 127, cents(title.amountCents, "Valor do título", true));
    put(row, 148, "01N" + issued + "0000");
    put(row, 161, cents(title.dailyInterestCents, "Juros diários"));
    put(row, 174, "000000");
    put(row, 180, "0000000000000");
    if (title.discount) {
      if (
        title.discount.until > title.dueOn ||
        title.discount.until < input.generatedOn ||
        title.discount.amountCents >= title.amountCents ||
        (a.itau && title.discount.amountCents * 100 > title.amountCents * 90)
      )
        fail("Desconto inválido.");
      put(row, 174, date(title.discount.until));
      put(row, 180, cents(title.discount.amountCents, "Desconto", true));
    }
    put(row, 193, "00000000000000000000000000");
    put(row, 219, payer.type + payer.number);
    put(row, 235, text(title.payer.name, a.itau ? 30 : 40, "Nome do pagador"));
    put(row, 275, text(title.payer.address, 40, "Endereço do pagador"));
    if (a.itau) {
      put(row, 315, text(title.payer.neighborhood, 12, "Bairro"));
      put(row, 335, text(title.payer.city, 15, "Cidade"));
      if (
        !/^(AC|AL|AP|AM|BA|CE|DF|ES|GO|MA|MT|MS|MG|PA|PB|PR|PE|PI|RJ|RN|RS|RO|RR|SC|SP|SE|TO)$/.test(title.payer.state)
      )
        fail("UF inválida.");
      put(row, 350, title.payer.state);
    }
    put(row, 327, digits(title.payer.postalCode, 8, "CEP", true));
    put(row, 395, String(detailSequence).padStart(6, "0"));
    const supplements: string[] = [];
    if (title.payer.email && !a.itau) fail("Envio de e-mail não implementado para este banco.");
    if (title.finalBeneficiary || title.payer.email) {
      let extra: string[];
      if (title.finalBeneficiary) extra = finalBeneficiaryRecord(account, title, row, ++sequence).split("");
      else {
        extra = record("5");
        put(extra, 122, "0000000000000000");
        put(extra, 190, "00000000");
        put(extra, 395, String(++sequence).padStart(6, "0"));
      }
      if (title.payer.email) {
        const email = title.payer.email;
        if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !/^[\x21-\x7e]+$/.test(email) || email.length > 120)
          fail("E-mail do pagador inválido para o registro5.");
        put(extra, 2, email.padEnd(120, " "));
      }
      supplements.push(extra.join(""));
    }
    if (title.lateFine) {
      if (!a.itau) fail("Complemento de multa não implementado para este banco.");
      const percent = title.lateFine.percent;
      if (
        !Number.isFinite(percent) ||
        percent <= 0 ||
        percent >= 100 ||
        Math.abs(Math.round(percent * 100) / 100 - percent) > 1e-9 ||
        title.lateFine.from < title.dueOn
      )
        fail("Percentual ou data de multa inválidos.");
      const encoded = date(title.lateFine.from);
      const extra = record("2");
      put(extra, 2, "2");
      put(extra, 3, encoded.slice(0, 4) + "20" + encoded.slice(4));
      put(extra, 11, cents(Math.round(percent * 100), "Percentual de multa", true));
      put(extra, 395, String(++sequence).padStart(6, "0"));
      supplements.push(extra.join(""));
    }
    return [row.join(""), ...supplements];
  });
  if (details.length > 999997) fail("Quantidade total de registros excede o sequencial de seis dígitos.");
  const trailer = record("9");
  put(trailer, 395, String(details.length + 2).padStart(6, "0"));
  return [header.join(""), ...details, trailer.join("")].join("\r\n") + "\r\n" + (a.itau ? "" : "\x1a");
}

export function parseCnab400Return(content: string, account: Cnab400Account): Cnab400Return {
  const a = accountFields(account);
  let source = content;
  if (account.bankCode === "237" && source.endsWith("\x1a")) source = source.slice(0, -1);
  if (!source.endsWith("\r\n")) fail("Retorno deve conter CRLF após cada registro.");
  const rows = source.slice(0, -2).split("\r\n");
  if (rows.length < 3 || rows.some(row => row.length !== 400 || !/^[\x20-\x7e]{400}$/.test(row)))
    fail("Arquivo truncado ou fora do formato ASCII de 400 bytes.");
  rows.forEach((row, index) => {
    if (numeric(row, 395, 400) !== index + 1) fail("Sequência de registros inválida.");
  });
  const header = rows[0],
    trailer = rows[rows.length - 1];
  if (
    field(header, 1, 11) !== "02RETORNO01" ||
    field(header, 12, 26).trim() !== "COBRANCA" ||
    field(header, 77, 79) !== account.bankCode
  )
    fail("Banco ou header de retorno divergente.");
  if (field(header, 27, a.itau ? 38 : 46) !== (a.itau ? a.identity : a.agreement))
    fail("Conta/convênio do beneficiário divergente no header.");
  if (field(trailer, 1, 7) !== `9201${account.bankCode}`) fail("Trailer ou banco divergente.");
  const generatedOn = readDate(field(header, 95, 100))!;
  const bankFileId = String(numeric(header, 109, 113)).padStart(5, "0");
  const events = rows.slice(1, -1).map((row, index): Cnab400ReturnEvent => {
    if (row[0] !== "1") fail(`Tipo de registro ${row[0]} não implementado (rateio/PIX/complemento).`);
    if (field(row, a.itau ? 18 : 21, a.itau ? 29 : 37) !== a.identity)
      fail("Conta do beneficiário divergente no detalhe.");
    if (field(row, 2, 3) !== a.beneficiary.type || field(row, 4, 17) !== a.beneficiary.number)
      fail("Documento do beneficiário divergente.");
    if (a.itau) {
      if (field(row, 83, 85) !== account.wallet || field(row, 108, 108) !== "I") fail("Carteira divergente.");
    } else if (field(row, 105, 105) === "R" || !["00", "  "].includes(field(row, 106, 107)))
      fail("Rateio/pagamento parcial não implementado.");
    const bankOccurrence = field(row, 109, 110);
    const kinds: Record<string, Cnab400ReturnEvent["kind"]> = a.itau
      ? { "02": "entry", "03": "rejection", "06": "settlement", "09": "writeoff" }
      : { "02": "entry", "03": "rejection", "06": "settlement", "09": "writeoff", "10": "writeoff", "24": "rejection" };
    const kind = kinds[bankOccurrence];
    if (!kind) fail(`Ocorrência ${bankOccurrence} não implementada; requer revisão manual.`);
    const ourNumber = field(row, a.itau ? 86 : 71, a.itau ? 93 : 81);
    digits(ourNumber, a.itau ? 8 : 11, "Nosso número", !(a.bankIssued && kind === "rejection"));
    if (!a.itau && field(row, 82, 82) !== bradescoOurNumberDigit(account.wallet, ourNumber))
      fail("DAC do nosso número divergente.");
    const occurredOn = readDate(field(row, 111, 116))!,
      dueOn = readDate(field(row, 147, 152), true),
      creditedOn = readDate(field(row, 296, 301), true);
    const amountCents = numeric(row, 153, 165),
      paidAmountCents = numeric(row, 254, 266);
    if (kind === "settlement" && (paidAmountCents <= 0 || !creditedOn))
      fail("Liquidação sem valor positivo ou data de crédito.");
    if (kind !== "settlement" && paidAmountCents !== 0)
      fail("Ocorrência sem liquidação contém pagamento; requer revisão manual.");
    const event = {
      kind,
      bankOccurrence,
      controlId: field(row, 38, 62).trim(),
      documentNumber: field(row, 117, 126).trim(),
      ourNumber,
      amountCents,
      paidAmountCents,
      paidAmountSemantics: (a.itau ? "account-credit" : "gross-received") as Cnab400ReturnEvent["paidAmountSemantics"],
      interestCents: numeric(row, 267, 279),
      discountCents: numeric(row, 241, 253),
      feeCents: numeric(row, 176, 188),
      abatementCents: numeric(row, 228, 240),
      iofCents: numeric(row, 215, 227),
      otherCreditsCents: numeric(row, 280, 292),
      otherExpensesCents: a.itau ? 0 : numeric(row, 189, 201),
      occurredOn,
      dueOn,
      creditedOn,
      rejectionCodes:
        field(row, a.itau ? 378 : 319, a.itau ? 385 : 328)
          .match(/.{2}/g)
          ?.filter(code => code !== "00" && code !== "  ") ?? [],
      idempotencyKey: "",
      recordSequence: index + 2,
      rawRecord: row,
    };
    // A sequência do arquivo fica no rastreio, não na identidade econômica do evento.
    event.idempotencyKey =
      "cnab400:v1:" +
      JSON.stringify([
        account.bankCode,
        a.identity,
        ourNumber,
        bankOccurrence,
        occurredOn,
        creditedOn ?? null,
        event.controlId,
        event.documentNumber,
        amountCents,
        paidAmountCents,
        event.interestCents,
        event.discountCents,
        event.feeCents,
        event.abatementCents,
        event.iofCents,
        event.otherCreditsCents,
        event.otherExpensesCents,
        event.rejectionCodes,
      ]);
    return event;
  });
  return { bankCode: account.bankCode, generatedOn, bankFileId, events };
}

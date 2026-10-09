import { describe, expect, it } from "vitest";
import { initialDebtors } from "@/src/domain/core/demo/debtors";
import { initialCedents } from "@/src/domain/core/demo/cedents";
import { destinations } from "@/src/domain/core/demo/companies";
import { initialOperations } from "@/src/domain/core/demo/operations";
import { seedCommercial } from "@/src/domain/commercial/seed";
import { buildNewOperation } from "@/src/domain/operations/create-operation";
import { intakeCsvTemplate, normalizeOperationIntake } from "@/src/domain/operations/intake";

const debtor = initialDebtors[0];
const header = "documento;valor;vencimento;emissao;sacado_cnpj;sacado_nome;chave_nfe;cfop;uf;cidade;observacao";

describe("entrada e normalização de operações", () => {
  it("normaliza CSV, converte valores e associa o sacado cadastrado", () => {
    const csv = `${header}\nNF-100/01;12.500,45;30/11/2026;04/10/2026;${debtor.document};Nome do arquivo;12345678901234567890123456789012345678901234;5102;SP;São Paulo;Pedido 100`;
    const result = normalizeOperationIntake({
      source: "Planilha",
      fileName: "operacao.csv",
      text: csv,
      debtors: initialDebtors,
      importedAt: "2026-10-04T10:00:00Z",
    });
    expect(result.intake).toMatchObject({
      format: "CSV",
      status: "PRONTO",
      originalRows: 1,
      acceptedRows: 1,
      rejectedRows: 0,
      matchedDebtors: 1,
    });
    expect(result.data.entries[0]).toMatchObject({
      documentNumber: "NF-100/01",
      amount: 12500.45,
      dueDate: "2026-11-30",
      issueDate: "2026-10-04",
      debtorId: debtor.id,
      debtorName: debtor.name,
    });
  });

  it("rejeita duplicidades dentro do arquivo e contra operações existentes", () => {
    const document = debtor.document;
    const csv = `${header}\nNF-200;1000;30/11/2026;04/10/2026;${document};Teste;;;;;\nNF-200;1000;30/11/2026;04/10/2026;${document};Teste;;;;;\nNF-EXISTENTE;1000;30/11/2026;04/10/2026;${document};Teste;;;;;`;
    const result = normalizeOperationIntake({
      source: "Planilha",
      fileName: "duplicados.csv",
      text: csv,
      debtors: initialDebtors,
      knownTitles: [{ documentNumber: "NF-EXISTENTE", debtorDocument: document }],
      importedAt: "2026-10-04T10:00:00Z",
    });
    expect(result.intake).toMatchObject({ status: "ATENCAO", originalRows: 3, acceptedRows: 1, rejectedRows: 2 });
    expect(result.intake.issues.map(item => item.code)).toEqual(
      expect.arrayContaining(["DUPLICIDADE_NO_ARQUIVO", "DUPLICIDADE_NA_BASE"]),
    );
  });

  it("extrai duplicatas e evidência de um XML de NF-e", () => {
    const document = debtor.document.replace(/\D/g, "");
    const xml = `<NFe Id="NFe12345678901234567890123456789012345678901234"><infNFe><ide><nNF>98341</nNF><dhEmi>2026-10-04T09:00:00-03:00</dhEmi></ide><dest><CNPJ>${document}</CNPJ><xNome>Nome XML</xNome><enderDest><xMun>São Paulo</xMun><UF>SP</UF></enderDest></dest><det><prod><CFOP>5102</CFOP></prod></det><cobr><dup><nDup>001</nDup><dVenc>2026-11-04</dVenc><vDup>7800.50</vDup></dup><dup><nDup>002</nDup><dVenc>2026-12-04</dVenc><vDup>7800.50</vDup></dup></cobr></infNFe></NFe>`;
    const result = normalizeOperationIntake({
      source: "XML NF-e",
      fileName: "nfe.xml",
      text: xml,
      debtors: initialDebtors,
      importedAt: "2026-10-04T10:00:00Z",
    });
    expect(result.intake).toMatchObject({ format: "XML", status: "PRONTO", acceptedRows: 2, matchedDebtors: 2 });
    expect(result.data.entries.map(item => item.documentNumber)).toEqual(["001", "002"]);
    expect(result.data.entries.every(item => item.nfeKey?.length === 44)).toBe(true);
  });

  it("cadastra automaticamente o sacado do XML que não existe na base, uma vez por CNPJ", () => {
    const xml = `<NFe Id="NFe35261011222333000181550010000771231000771230"><infNFe><ide><nNF>77123</nNF><dhEmi>2026-10-05T09:00:00-03:00</dhEmi></ide><dest><CNPJ>11222333000181</CNPJ><xNome>Comercial Novo Sacado Ltda</xNome><xFant>Novo Sacado</xFant><enderDest><xLgr>Rua das Flores</xLgr><nro>120</nro><xBairro>Centro</xBairro><xMun>Campinas</xMun><UF>SP</UF><CEP>13010000</CEP><fone>1932345678</fone></enderDest><email>financeiro@novosacado.com.br</email></dest><det><prod><CFOP>5102</CFOP></prod></det><cobr><dup><nDup>001</nDup><dVenc>2026-11-05</dVenc><vDup>5400.00</vDup></dup><dup><nDup>002</nDup><dVenc>2026-12-05</dVenc><vDup>5400.00</vDup></dup></cobr></infNFe></NFe>`;
    const result = normalizeOperationIntake({
      source: "XML NF-e",
      fileName: "nfe-novo.xml",
      text: xml,
      debtors: initialDebtors,
      importedAt: "2026-10-05T10:00:00Z",
    });
    expect(result.intake).toMatchObject({ status: "PRONTO", acceptedRows: 2, matchedDebtors: 0, issues: [] });
    expect(result.intake.newDebtors).toHaveLength(1);
    expect(result.intake.newDebtors?.[0]).toMatchObject({
      id: "deb-imp-11222333000181",
      document: "11.222.333/0001-81",
      name: "Comercial Novo Sacado Ltda",
      tradeName: "Novo Sacado",
      address: "Rua das Flores",
      number: "120",
      district: "Centro",
      city: "Campinas",
      state: "SP",
      zipCode: "13010000",
      phone: "1932345678",
      email: "financeiro@novosacado.com.br",
      source: "Integração",
      registrationStatus: "Completo",
    });
    expect(result.data.entries.every(item => item.debtorId === "deb-imp-11222333000181")).toBe(true);
  });

  it("sacado novo sem endereço no arquivo fica provisório até completar", () => {
    const csv = `${header}\nNF-200/01;1.000,00;30/11/2026;04/10/2026;11222333000181;Sacado Planilha;;5102;PR;Curitiba;`;
    const result = normalizeOperationIntake({
      source: "Planilha",
      fileName: "novo.csv",
      text: csv,
      debtors: initialDebtors,
      importedAt: "2026-10-05T10:00:00Z",
    });
    expect(result.intake.newDebtors?.[0]).toMatchObject({
      name: "Sacado Planilha",
      city: "Curitiba",
      state: "PR",
      registrationStatus: "Provisório",
    });
  });

  it("não finge processar XLSX ou CNAB sem leiaute configurado", () => {
    const xlsx = normalizeOperationIntake({
      source: "Planilha",
      fileName: "operacao.xlsx",
      text: "conteúdo binário",
      debtors: initialDebtors,
      importedAt: "2026-10-04T10:00:00Z",
    });
    const cnab = normalizeOperationIntake({
      source: "CNAB",
      fileName: "retorno.rem",
      text: "0".repeat(400),
      debtors: initialDebtors,
      importedAt: "2026-10-04T10:00:00Z",
    });
    expect(xlsx.intake).toMatchObject({ status: "BLOQUEADO", acceptedRows: 0 });
    expect(cnab.intake).toMatchObject({ status: "BLOQUEADO", acceptedRows: 0 });
    expect(xlsx.intake.issues[0].code).toBe("XLSX_REQUER_LEITOR");
    expect(cnab.intake.issues[0].code).toBe("CNAB_SEM_LAYOUT");
  });

  it("oferece modelo com todas as colunas esperadas", () => {
    expect(intakeCsvTemplate()).toContain("documento;valor;vencimento;emissao;sacado_cnpj");
  });

  it("cria a operação já alimentada pelo lote normalizado", () => {
    const csv = `${header}\nNF-300;25000;30/11/2026;04/10/2026;${debtor.document};Teste;;;;;`;
    const normalized = normalizeOperationIntake({
      source: "Planilha",
      fileName: "nova-operacao.csv",
      text: csv,
      debtors: initialDebtors,
      importedAt: "2026-10-04T10:00:00Z",
    });
    const operation = buildNewOperation(
      {
        source: "Planilha",
        operationType: "Duplicatas em leiaute validado",
        destination: destinations[0],
        cedent: initialCedents[0],
        importedData: normalized.data,
        entryIntake: normalized.intake,
      },
      initialOperations,
      seedCommercial(),
      "2026-10-04",
    );
    expect(operation).toMatchObject({
      amount: 25000,
      netAmount: 25000,
      titleCount: 1,
      manualEntry: { receivableType: "Duplicata" },
      entryIntake: { fileName: "nova-operacao.csv", acceptedRows: 1 },
    });
    expect(operation.automation).toBeGreaterThan(75);
  });
});

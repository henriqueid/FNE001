/** Serviço bancário autenticado: arquivos auditáveis e liquidação na mesma transação de tenant. */
import {
  generateCnab400Remittance,
  parseCnab400Return,
  type Cnab400Account,
  type Cnab400Title,
} from "@/src/domain/banking/cnab400";
import { resolveCollectionCharges } from "@/src/domain/banking/charges";
import type { CompanyBankAccount, FinanceState } from "@/src/domain/finance/model";
import { portfolioBalance, type PortfolioState } from "@/src/domain/portfolio/model";
import { settleReceivable } from "@/src/domain/portfolio/settlement";
import { onlyDigits, type Party } from "@/src/domain/registry/parties";
import type { ServerPrincipal } from "@/src/server/access/repository";
import { principalHasCompanyScope } from "@/src/server/access/scope";
import type { DecisionDatabase } from "@/src/server/decisions/repository";
import { inTenantFinanceTransaction } from "@/src/server/database/transactions";
import { loadFinanceState, saveFinanceState, financeRequestHash } from "@/src/server/finance/repository";
import { loadCurrentPortfolio, savePortfolioState, portfolioRequestHash } from "@/src/server/portfolio/repository";
import { findRegistryPartyByDocument } from "@/src/server/registry/repository";
import { appendBankEvent, bankEvent, bankAccountEvents, bankingHash } from "./repository";

export type BankingCommand =
  | { action: "remittance"; accountId: string; commandId: string; titleIds: string[] }
  | { action: "return"; accountId: string; commandId: string; content: string };
export type BankingResult = {
  action: BankingCommand["action"];
  commandId: string;
  filename?: string;
  content?: string;
  sequence?: number;
  processed: number;
  repeated: number;
  message: string;
};
type Binding = {
  titleId: string;
  controlId: string;
  ourNumber: string;
  amountCents: number;
  documentNumber: string;
  dueOn?: string;
};
type RemittanceEvent = {
  accountId: string;
  bindings: Binding[];
  sequence: number;
  nextOurNumber: number;
  result: BankingResult;
  createdAt: string;
  commandId: string;
};
type CommandEvent = { accountId: string; requestHash: string; result: BankingResult };
export class BankingError extends Error {
  constructor(
    message: string,
    readonly status = 409,
  ) {
    super(message);
  }
}
function fail(message: string, status = 409): never {
  throw new BankingError(message, status);
}
function permission(principal: ServerPrincipal) {
  if (!principal.permissions.includes("finance:release"))
    fail("Sem permissão para gerar ou importar arquivos bancários.", 403);
}
function accountFor(finance: FinanceState | null, principal: ServerPrincipal, accountId: string) {
  const account = finance?.accounts.find(a => a.id === accountId);
  if (!account || !principalHasCompanyScope(principal, account.company))
    return fail("Conta indisponível no seu escopo.", 403);
  if (!account.active || !account.usage.collection || !account.collection || account.collection.layout !== "CNAB 400")
    fail("Configure conta ativa de cobrança CNAB 400.");
  return account;
}
function cnabAccount(account: CompanyBankAccount): Cnab400Account {
  const c = account.collection!;
  if (!c.accountDigit || !c.beneficiaryDocument || !c.beneficiaryName)
    fail("Preencha dígito da conta e documento/nome real do beneficiário na configuração de bancos.");
  if (!["341", "237"].includes(account.bankCode)) fail("Banco não implementado: utilize Itaú ou Bradesco.");
  return {
    bankCode: account.bankCode as Cnab400Account["bankCode"],
    agency: account.agency,
    account: account.account,
    accountDigit: c.accountDigit,
    wallet: c.wallet,
    agreementCode: c.agreement,
    mode: account.bankCode === "341" && c.wallet === "112" ? "registered-bank-issued" : "registered-client-issued",
    beneficiary: { document: onlyDigits(c.beneficiaryDocument), name: c.beneficiaryName },
    finalBeneficiaryEnabled: c.finalBeneficiaryEnabled,
  };
}
function partyData(party: Party | null): Cnab400Title["payer"] {
  if (!party || party.status !== "Ativo" || !party.address.street.trim() || !party.address.number.trim())
    return fail("Complete e ative o cadastro do sacado/cedente, incluindo endereço e número, antes da remessa.");
  const a = party.address;
  return {
    document: onlyDigits(party.document),
    name: party.name,
    address: [a.street, a.number, a.complement].filter(Boolean).join(" "),
    neighborhood: a.district,
    postalCode: onlyDigits(a.zipCode),
    city: a.city,
    state: a.state,
  };
}
async function persist(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  finance: FinanceState,
  portfolio: PortfolioState,
  commandId: string,
) {
  const fv = finance.persistenceVersion ?? 0,
    pv = portfolio.persistenceVersion ?? 0;
  const fh = await financeRequestHash({
    tenantId: principal.tenantId,
    actorId: principal.id,
    expectedVersion: fv,
    state: finance,
  });
  const ph = await portfolioRequestHash({
    tenantId: principal.tenantId,
    actorId: principal.id,
    expectedVersion: pv,
    state: portfolio,
  });
  if (!(await saveFinanceState(db, principal.tenantId, principal.id, finance, fv, `bank-finance:${commandId}`, fh)))
    fail("O financeiro mudou durante o comando; atualize e repita.");
  if (
    !(await savePortfolioState(db, principal.tenantId, principal, portfolio, pv, `bank-portfolio:${commandId}`, ph, {
      financialCommand: true,
    }))
  )
    fail("A carteira mudou durante o comando; atualize e repita.");
}
async function remittance(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: Extract<BankingCommand, { action: "remittance" }>,
  finance: FinanceState,
  portfolio: PortfolioState,
  account: CompanyBankAccount,
): Promise<BankingResult> {
  const c = account.collection!,
    a = cnabAccount(account),
    bankAssigned = a.mode === "registered-bank-issued";
  if (
    !Array.isArray(command.titleIds) ||
    !command.titleIds.length ||
    command.titleIds.length > 1000 ||
    new Set(command.titleIds).size !== command.titleIds.length
  )
    fail("Selecione entre um e mil títulos distintos.", 400);
  if (
    (!bankAssigned && (!Number.isSafeInteger(c.nextOurNumber) || c.nextOurNumber <= 0)) ||
    !Number.isSafeInteger(c.nextRemittanceSequence) ||
    Number(c.nextRemittanceSequence) <= 0
  )
    fail("Informe sequência de remessa válida e, para emissão pelo cliente, o próximo nosso número.");
  if (c.sendPayerEmail && account.bankCode !== "341")
    fail("Envio de e-mail do pagador está implementado somente para o Itaú.");
  const history = await bankAccountEvents<RemittanceEvent>(db, principal.tenantId, "BankRemittance", account.id);
  if (
    history.some(e => e.sequence >= c.nextRemittanceSequence! || (!bankAssigned && e.nextOurNumber > c.nextOurNumber))
  )
    fail("A numeração configurada já foi reservada; restaure o próximo sequencial do histórico bancário.");
  const state = structuredClone(portfolio),
    bindings: Binding[] = [],
    titles: Cnab400Title[] = [];
  let next = c.nextOurNumber;
  let itemIndex = 0;
  const generatedOn = new Date().toISOString().slice(0, 10);
  for (const id of [...command.titleIds].sort()) {
    const title = state.titles.find(t => t.id === id);
    if (!title || title.company !== account.company || !principalHasCompanyScope(principal, title.company))
      fail("Título fora do escopo da conta selecionada.", 403);
    if (title.positionReviewRequired)
      fail(`A posição do título exige revisão antes de gerar remessa: ${title.positionReviewRequired}`);
    if (title.bankStatus !== "Sem boleto" || title.ourNumber || portfolioBalance(title) <= 0)
      fail(`Título ${title.documentNumber} já possui vínculo bancário ou não tem saldo para registrar.`);
    if (!title.issueDate) fail(`Informe a data de emissão real do título ${title.documentNumber}.`);
    const payerParty = await findRegistryPartyByDocument(db, principal.tenantId, title.debtorDocument);
    const payer = partyData(payerParty);
    if (c.sendPayerEmail === true) {
      const email = payerParty?.email?.trim();
      if (!email)
        fail(`Cadastre o e-mail real do pagador do título ${title.documentNumber} antes de solicitar envio pelo Itaú.`);
      payer.email = email;
    }
    const finalBeneficiary =
      onlyDigits(title.ownerDocument) !== a.beneficiary.document
        ? partyData(await findRegistryPartyByDocument(db, principal.tenantId, title.ownerDocument))
        : undefined;
    const ourNumber = bankAssigned ? "00000000" : String(next++).padStart(a.bankCode === "341" ? 8 : 11, "0"),
      controlId = bankAssigned
        ? `T${String(c.nextRemittanceSequence).padStart(7, "0")}${String(++itemIndex).padStart(6, "0")}`
        : `T${ourNumber}`,
      amountCents = Math.round(portfolioBalance(title) * 100);
    const charges = resolveCollectionCharges(c, amountCents, title.dueDate);
    titles.push({
      controlId,
      ourNumber,
      documentNumber: title.documentNumber,
      amountCents,
      issuedOn: title.issueDate,
      dueOn: title.dueDate,
      ...charges,
      payer,
      finalBeneficiary,
    });
    bindings.push({
      titleId: title.id,
      controlId,
      ourNumber,
      amountCents,
      documentNumber: title.documentNumber,
      dueOn: title.dueDate,
    });
    Object.assign(title, {
      ourNumber: bankAssigned ? undefined : ourNumber,
      bank: account.bankCode,
      agency: account.agency,
      account: account.account,
      wallet: c.wallet,
      agreement: c.agreement,
      bankStatus: "Pendente de integração",
    });
    title.events.push({
      id: `bank-remittance:${command.commandId}:${title.id}`,
      at: new Date().toISOString(),
      by: principal.name,
      action: "Remessa bancária gerada",
      detail: `${account.bankCode} · conta ${account.id} · nosso número ${ourNumber} · sequência ${c.nextRemittanceSequence}`,
    });
  }
  const sequence = c.nextRemittanceSequence!,
    content = generateCnab400Remittance({ account: a, generatedOn, remittanceSequence: sequence, titles });
  const nextFinance = structuredClone(finance);
  nextFinance.accounts = nextFinance.accounts.map(item =>
    item.id === account.id
      ? { ...item, collection: { ...c, nextOurNumber: next, nextRemittanceSequence: sequence + 1 } }
      : item,
  );
  const result: BankingResult = {
    action: "remittance",
    commandId: command.commandId,
    sequence,
    filename: `CNAB400_${account.bankCode}_${sequence}.REM`,
    content,
    processed: titles.length,
    repeated: 0,
    message: "Remessa gerada e reservada. Arquivo ainda não foi transmitido ao banco.",
  };
  await persist(db, principal, nextFinance, state, command.commandId);
  await appendBankEvent(db, principal.tenantId, principal.id, "BankRemittance", command.commandId, {
    accountId: account.id,
    bindings,
    sequence,
    nextOurNumber: next,
    result,
    createdAt: new Date().toISOString(),
    commandId: command.commandId,
  });
  return result;
}
async function bankReturn(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: Extract<BankingCommand, { action: "return" }>,
  finance: FinanceState,
  portfolio: PortfolioState,
  account: CompanyBankAccount,
): Promise<BankingResult> {
  if (typeof command.content !== "string" || !command.content.length || command.content.length > 4_000_000)
    fail("Arquivo retorno vazio ou maior que 4 MB.", 400);
  const parsed = parseCnab400Return(command.content, cnabAccount(account));
  const bankAssigned = account.bankCode === "341" && account.collection!.wallet === "112";
  const history = await bankAccountEvents<RemittanceEvent>(db, principal.tenantId, "BankRemittance", account.id);
  const previousReturns = bankAssigned
    ? await bankAccountEvents<{ titleId: string; event: { ourNumber: string } }>(
        db,
        principal.tenantId,
        "BankReturn",
        account.id,
      )
    : [];
  let nextFinance = finance,
    nextPortfolio = structuredClone(portfolio),
    processed = 0,
    repeated = 0;
  for (const event of parsed.events) {
    const eventHash = await bankingHash(event.idempotencyKey);
    if (await bankEvent(db, principal.tenantId, "BankReturn", eventHash)) {
      repeated++;
      continue;
    }
    const matches = history
      .flatMap(h => h.bindings)
      .filter(
        b =>
          (bankAssigned ? /^0+$/.test(b.ourNumber) : b.ourNumber === event.ourNumber) &&
          b.controlId === event.controlId &&
          b.documentNumber === event.documentNumber,
      );
    if (matches.length !== 1)
      fail("O retorno não possui remessa única desta conta com título e nosso número correspondentes.");
    const binding = matches[0],
      title = nextPortfolio.titles.find(t => t.id === binding.titleId);
    if (!title || title.company !== account.company || !principalHasCompanyScope(principal, title.company))
      fail("Título do retorno fora do escopo da conta.", 403);
    if (title.positionReviewRequired)
      fail(`A posição do título exige revisão antes de importar retorno: ${title.positionReviewRequired}`);
    if (
      (!bankAssigned && title.ourNumber !== event.ourNumber) ||
      title.bank !== account.bankCode ||
      title.agency !== account.agency ||
      title.account !== account.account ||
      title.wallet !== account.collection!.wallet
    )
      fail("O vínculo bancário atual diverge da remessa original.");
    if (bankAssigned) {
      const newest = history
        .slice()
        .sort((left, right) => right.sequence - left.sequence)
        .flatMap(remittance => remittance.bindings)
        .find(candidate => candidate.titleId === title.id);
      if (newest?.controlId !== event.controlId)
        fail("O retorno se refere a uma remessa anterior deste título; confira a remessa vigente.");
      const assigned = title.ourNumber && !/^0+$/.test(title.ourNumber) ? title.ourNumber : undefined;
      if (event.kind === "entry") {
        if (
          event.amountCents !== binding.amountCents ||
          !binding.dueOn ||
          event.dueOn !== binding.dueOn ||
          title.dueDate !== binding.dueOn
        )
          fail("O valor ou vencimento da confirmação diverge da remessa original.");
        if (!/^\d{8}$/.test(event.ourNumber) || /^0+$/.test(event.ourNumber))
          fail("Confirmação Itaú112 exige nosso número não zero atribuído pelo banco.");
        if (assigned && assigned !== event.ourNumber)
          fail("O nosso número já atribuído pelo banco não pode ser reatribuído.");
        const collision =
          nextPortfolio.titles.some(
            candidate =>
              candidate.id !== title.id &&
              candidate.company === account.company &&
              candidate.bank === account.bankCode &&
              candidate.agency === account.agency &&
              candidate.account === account.account &&
              candidate.ourNumber?.padStart(8, "0") === event.ourNumber,
          ) ||
          previousReturns.some(
            previous => previous.titleId !== title.id && previous.event.ourNumber === event.ourNumber,
          ) ||
          history.some(remittance =>
            remittance.bindings.some(
              candidate =>
                candidate.titleId !== title.id &&
                !/^0+$/.test(candidate.ourNumber) &&
                candidate.ourNumber === event.ourNumber,
            ),
          );
        if (collision) fail("O nosso número atribuído já está vinculado a outro título nesta conta.");
        title.ourNumber = event.ourNumber;
      } else if (event.kind !== "rejection" || !/^0+$/.test(event.ourNumber)) {
        if (
          !assigned ||
          assigned !== event.ourNumber ||
          (event.kind === "settlement" && title.bankStatus !== "Registrado")
        )
          fail("Confirme a entrada Itaú112 e o nosso número atribuído antes de processar a ocorrência ou liquidação.");
      } else if (assigned) fail("Uma rejeição sem número não pode apagar a atribuição bancária já confirmada.");
    }
    if (
      [event.feeCents, event.iofCents, event.abatementCents, event.otherCreditsCents, event.otherExpensesCents].some(
        value => value !== 0,
      )
    )
      fail(
        "Retorno contém tarifa, IOF, abatimento ou outros componentes que exigem conciliação/lançamentos auxiliares configurados. Nenhum valor foi descartado; importação bloqueada para conferência.",
      );
    if (event.kind === "settlement") {
      if (
        event.amountCents !== binding.amountCents ||
        Math.round(portfolioBalance(title) * 100) !== event.amountCents ||
        event.paidAmountCents !== event.amountCents + event.interestCents - event.discountCents
      )
        fail("Valores do retorno divergem do título ou saldo; confira principal, juros e desconto antes de liquidar.");
      const settled = settleReceivable(
        nextFinance,
        nextPortfolio,
        title.id,
        {
          accountId: account.id,
          date: event.creditedOn!,
          principal: event.amountCents / 100,
          interest: event.interestCents / 100,
          discount: event.discountCents / 100,
          method: `CNAB400 ${account.bankCode}`,
        },
        principal.name,
        `bank-settlement:${eventHash}`,
      );
      if (settled.error) fail(settled.error);
      nextFinance = settled.finance;
      nextPortfolio = settled.portfolio;
    } else {
      const repeatedConfirmation =
        bankAssigned &&
        event.kind === "entry" &&
        (title.status === "Pago" ||
          title.status === "Cancelado" ||
          title.bankStatus === "Liquidado" ||
          title.bankStatus === "Baixado");
      if (!repeatedConfirmation && (title.status === "Pago" || title.bankStatus === "Liquidado"))
        fail("Ocorrência cadastral não pode desfazer título já liquidado.");
      if (!repeatedConfirmation)
        title.bankStatus = event.kind === "entry" ? "Registrado" : event.kind === "writeoff" ? "Baixado" : "Sem boleto";
      title.events.push({
        id: `bank-return:${eventHash}`,
        at: new Date().toISOString(),
        by: principal.name,
        action: `Retorno bancário ${event.bankOccurrence}`,
        detail: `${event.kind} · nosso número ${event.ourNumber} · ${event.rejectionCodes.join(", ") || "sem motivo adicional"}`,
      });
    }
    await appendBankEvent(db, principal.tenantId, principal.id, "BankReturn", eventHash, {
      accountId: account.id,
      titleId: title.id,
      event,
      bankFileId: parsed.bankFileId,
      generatedOn: parsed.generatedOn,
      commandId: command.commandId,
    });
    processed++;
  }
  if (processed) await persist(db, principal, nextFinance, nextPortfolio, command.commandId);
  return {
    action: "return",
    commandId: command.commandId,
    processed,
    repeated,
    message: `Retorno processado: ${processed} evento(s), ${repeated} repetido(s) sem novo efeito financeiro.`,
  };
}
export async function executeBankingCommand(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  command: BankingCommand,
): Promise<BankingResult> {
  permission(principal);
  if (
    !command ||
    !["remittance", "return"].includes(command.action) ||
    typeof command.accountId !== "string" ||
    !command.accountId.trim() ||
    typeof command.commandId !== "string" ||
    !/^[A-Za-z0-9._:-]{8,160}$/.test(command.commandId)
  )
    fail("Comando bancário inválido.", 400);
  if (!db.transaction) fail("Transação bancária indisponível.", 503);
  const requestHash = await bankingHash([principal.id, command]);
  let scoped = false;
  try {
    return await inTenantFinanceTransaction(db, principal.tenantId, async tx => {
      const finance = await loadFinanceState(tx, principal.tenantId),
        account = accountFor(finance, principal, command.accountId);
      scoped = true;
      const prior = await bankEvent<CommandEvent>(tx, principal.tenantId, "BankCommand", command.commandId);
      if (prior) {
        if (prior.requestHash !== requestHash) fail("Chave de comando bancário já usada com outro conteúdo.");
        return prior.result;
      }
      const portfolio = await loadCurrentPortfolio(tx, principal.tenantId);
      const result =
        command.action === "remittance"
          ? await remittance(tx, principal, command, finance!, portfolio, account)
          : await bankReturn(tx, principal, command, finance!, portfolio, account);
      await appendBankEvent(tx, principal.tenantId, principal.id, "BankCommand", command.commandId, {
        accountId: account.id,
        requestHash,
        result,
      });
      return result;
    });
  } catch (error) {
    if (command.action === "return" && scoped) {
      const contentHash = await bankingHash(command.content);
      await inTenantFinanceTransaction(db, principal.tenantId, tx =>
        appendBankEvent(tx, principal.tenantId, principal.id, "BankReturnBlock", crypto.randomUUID(), {
          accountId: command.accountId,
          commandId: command.commandId,
          requestHash,
          contentHash,
          reason: error instanceof Error ? error.message : "Falha na importação",
          content:
            typeof command.content === "string" && command.content.length <= 4_000_000 ? command.content : undefined,
        }),
      );
    }
    throw error;
  }
}
export async function downloadBankingRemittance(
  db: DecisionDatabase,
  principal: ServerPrincipal,
  accountId: string,
  commandId: string,
) {
  permission(principal);
  accountFor(await loadFinanceState(db, principal.tenantId), principal, accountId);
  const event = await bankEvent<RemittanceEvent>(db, principal.tenantId, "BankRemittance", commandId);
  if (!event || event.accountId !== accountId) fail("Remessa não encontrada nesta conta.", 404);
  return event.result;
}

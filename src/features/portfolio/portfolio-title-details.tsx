"use client";

import { type FormEvent, type ReactNode, useMemo, useState } from "react";
import { createPortal } from "react-dom";
import { useRegistry } from "@/src/app/registry-context";
import { digits } from "@/src/domain/commercial/calendar";
import {
  addCollectionOccurrence,
  type CollectionChannel,
  type CollectionOutcome,
  type ConfirmationStatus,
  portfolioBalance,
  type PortfolioState,
  updatePortfolioConfirmation,
} from "@/src/domain/portfolio/model";
import { br, money } from "@/src/features/finance/finance-ui";
import { CloseIcon } from "@/src/ui/icons";
import { type PortfolioGridRow } from "./portfolio-title-grid";

type DetailTab = "resumo" | "historico" | "cobranca" | "controladoria" | "recebivel";
const empty = <span className="pf-empty">Não informado</span>;
const channels: CollectionChannel[] = ["WhatsApp", "Telefone", "E-mail", "Presencial", "Outro"];
const outcomes: CollectionOutcome[] = [
  "Contato realizado",
  "Sem resposta",
  "Boleto solicitado",
  "Promessa de pagamento",
  "Negociação em andamento",
  "Recusa de pagamento",
];
const confirmationStatuses: ConfirmationStatus[] = [
  "Não iniciada",
  "Pendente",
  "Confirmado",
  "Divergente",
  "Não localizado",
];

function Info({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="pf-detail-info">
      <span>{label}</span>
      <b>{children || empty}</b>
    </div>
  );
}

function copy(value?: string) {
  if (value) void navigator.clipboard?.writeText(value);
}

function statusTone(status: string) {
  if (["Pago", "Recomprado"].includes(status)) return "ok";
  if (["Protestado", "Em cartório"].includes(status)) return "bad";
  if (["Liquidado parcial", "Recomprado parcial", "Em cobrança"].includes(status)) return "warn";
  return "";
}

function localDateTime(date = new Date()) {
  const shifted = new Date(date.getTime() - date.getTimezoneOffset() * 60_000);
  return shifted.toISOString().slice(0, 16);
}

function suggestedReturn(outcome: CollectionOutcome, promiseDate: string) {
  if (outcome === "Promessa de pagamento" && promiseDate) return `${promiseDate}T09:00`;
  const days = outcome === "Boleto solicitado" ? 1 : outcome === "Sem resposta" ? 2 : 3;
  const next = new Date();
  next.setDate(next.getDate() + days);
  next.setHours(9, 0, 0, 0);
  return localDateTime(next);
}

function displayDateTime(value?: string) {
  if (!value) return "Não programado";
  const [date, time] = value.split("T");
  return `${br(date)}${time ? ` às ${time.slice(0, 5)}` : ""}`;
}

function whatsappNumber(phone?: string) {
  const number = digits(phone ?? "");
  if (!number) return "";
  return number.startsWith("55") ? number : `55${number}`;
}

export function PortfolioTitleDetails({
  title,
  repName,
  portfolio,
  onPortfolio,
  onClose,
}: {
  title: PortfolioGridRow;
  repName: (id?: string) => string;
  portfolio: PortfolioState;
  onPortfolio: (state: PortfolioState) => void;
  onClose: () => void;
}) {
  const { parties } = useRegistry();
  const [tab, setTab] = useState<DetailTab>("resumo");
  const [notice, setNotice] = useState("");
  const cedent = parties.find(party => digits(party.document) === digits(title.ownerDocument));
  const debtor = parties.find(party => digits(party.document) === digits(title.debtorDocument));
  const payments = title.payments ?? [];
  const lastPayment = payments.at(-1);
  const balance = portfolioBalance(title);
  const events = [...title.events].reverse();
  const occurrences = [...(title.collectionOccurrences ?? [])].reverse();
  const lastOccurrence = occurrences[0];
  const [chargedAt, setChargedAt] = useState(localDateTime());
  const [channel, setChannel] = useState<CollectionChannel>("WhatsApp");
  const [contactPerson, setContactPerson] = useState("");
  const [outcome, setOutcome] = useState<CollectionOutcome>("Contato realizado");
  const [notes, setNotes] = useState("");
  const [promiseDate, setPromiseDate] = useState("");
  const [nextContactAt, setNextContactAt] = useState(() => suggestedReturn("Contato realizado", ""));
  const [confirmationStatus, setConfirmationStatus] = useState<ConfirmationStatus>(
    title.confirmation?.status ?? "Não iniciada",
  );
  const [confirmationChannel, setConfirmationChannel] = useState<CollectionChannel>(
    title.confirmation?.channel ?? "Telefone",
  );
  const [confirmationAt, setConfirmationAt] = useState(title.confirmation?.contactedAt ?? localDateTime());
  const [confirmationContact, setConfirmationContact] = useState(title.confirmation?.contactPerson ?? "");
  const [confirmationNotes, setConfirmationNotes] = useState(title.confirmation?.notes ?? "");
  const phone = debtor?.phone ?? debtor?.contacts?.find(contact => contact.phone)?.phone ?? "";
  const email = debtor?.email ?? debtor?.contacts?.find(contact => contact.email)?.email ?? "";
  const waNumber = whatsappNumber(phone);
  const message = `Olá, estamos entrando em contato sobre o título ${title.documentNumber}, no valor atual de ${money(balance)}, com vencimento em ${br(title.dueDate)}.`;
  const whatsappHref = waNumber ? `https://wa.me/${waNumber}?text=${encodeURIComponent(message)}` : "";
  const emailHref = email
    ? `mailto:${email}?subject=${encodeURIComponent(`Título ${title.documentNumber} · cobrança`)}&body=${encodeURIComponent(message)}`
    : "";
  const returnRule = useMemo(() => {
    if (outcome === "Promessa de pagamento") return "Retornar na data prometida para confirmar a liquidação.";
    if (outcome === "Boleto solicitado") return "Retorno sugerido em 1 dia para confirmar recebimento do boleto.";
    if (outcome === "Sem resposta") return "Nova tentativa sugerida em 2 dias, preferencialmente por outro canal.";
    return "Retorno sugerido em 3 dias enquanto o título permanecer em aberto.";
  }, [outcome]);

  function chooseOutcome(value: CollectionOutcome) {
    setOutcome(value);
    setNextContactAt(suggestedReturn(value, promiseDate));
  }

  function saveOccurrence(event: FormEvent) {
    event.preventDefault();
    if (!notes.trim() || !nextContactAt) {
      setNotice("Informe o resumo da conversa e a data do próximo contato.");
      return;
    }
    onPortfolio(
      addCollectionOccurrence(portfolio, title.id, {
        chargedAt,
        channel,
        contactPerson: contactPerson.trim() || "Contato financeiro",
        outcome,
        notes: notes.trim(),
        nextContactAt,
        promiseDate: promiseDate || undefined,
        createdAt: new Date().toISOString(),
        createdBy: "Henrique",
      }),
    );
    setNotice("Cobrança registrada no histórico e no GRID.");
    setNotes("");
    setContactPerson("");
    setChargedAt(localDateTime());
  }

  function saveConfirmation(event: FormEvent) {
    event.preventDefault();
    if (!confirmationNotes.trim()) {
      setNotice("Registre a conclusão ou divergência encontrada pela Controladoria.");
      return;
    }
    onPortfolio(
      updatePortfolioConfirmation(portfolio, title.id, {
        status: confirmationStatus,
        contactedAt: confirmationAt,
        channel: confirmationChannel,
        contactPerson: confirmationContact.trim() || "Contato do cliente",
        notes: confirmationNotes.trim(),
        updatedAt: new Date().toISOString(),
        updatedBy: "Henrique",
      }),
    );
    setNotice("Confirmação da Controladoria atualizada e incluída no histórico.");
  }

  const partyCard = (kind: "Cedente" | "Sacado", party: typeof cedent, fallbackName: string, document: string) => (
    <section className="pf-party-card">
      <header>
        <span>{kind}</span>
        {party?.status && <i className={party.status === "Ativo" ? "ok" : "bad"}>{party.status}</i>}
      </header>
      <h3>{party?.name ?? fallbackName}</h3>
      <div className="pf-detail-info-grid">
        <Info label="CPF / CNPJ">{party?.document ?? document}</Info>
        <Info label="Nome fantasia">{party?.tradeName}</Info>
        <Info label="E-mail">{kind === "Sacado" && email ? <a href={emailHref}>{email}</a> : party?.email}</Info>
        <Info label="Telefone">
          {kind === "Sacado" && phone ? (
            <button type="button" className="pf-inline-contact" onClick={() => copy(phone)} title="Copiar telefone">
              {phone}
            </button>
          ) : (
            party?.phone
          )}
        </Info>
        <Info label="Cidade / UF">
          {party?.address?.city ? `${party.address.city} / ${party.address.state}` : undefined}
        </Info>
        <Info label="Endereço">
          {party?.address?.street
            ? `${party.address.street}, ${party.address.number} · ${party.address.district}`
            : undefined}
        </Info>
      </div>
    </section>
  );

  return createPortal(
    <div
      className="modal-backdrop pf-detail-backdrop"
      role="presentation"
      onMouseDown={event => event.target === event.currentTarget && onClose()}
    >
      <section className="pf-detail-modal" role="dialog" aria-modal="true" aria-labelledby="pf-detail-title">
        <header className="pf-detail-head">
          <div>
            <span>DETALHES DO TÍTULO</span>
            <h2 id="pf-detail-title">{title.documentNumber}</h2>
            <p>
              {title.debtorName} · {title.debtorDocument}
            </p>
          </div>
          <div className="pf-detail-head-actions">
            <span className={`fn-chip ${statusTone(title.displayStatus)}`}>{title.displayStatus}</span>
            <span className="fn-chip">Controladoria: {title.confirmation?.status ?? "Não iniciada"}</span>
            <button type="button" onClick={onClose} aria-label="Fechar detalhes do título">
              <CloseIcon />
            </button>
          </div>
        </header>

        <div className="pf-detail-summary">
          <div>
            <span>Valor original</span>
            <b>{money(title.originalAmount)}</b>
          </div>
          <div>
            <span>Recebido</span>
            <b>{money(title.paidAmount)}</b>
            <small>{lastPayment ? br(lastPayment.date) : "Sem pagamento"}</small>
          </div>
          <div>
            <span>Saldo atual</span>
            <b className={balance > 0 ? "warn" : "ok"}>{money(balance)}</b>
          </div>
          <div>
            <span>Última cobrança</span>
            <b>{lastOccurrence ? br(lastOccurrence.chargedAt.slice(0, 10)) : "Não realizada"}</b>
            <small>{lastOccurrence?.channel ?? "Sem contato"}</small>
          </div>
          <div>
            <span>Próximo contato</span>
            <b className={lastOccurrence ? "warn" : ""}>{displayDateTime(lastOccurrence?.nextContactAt)}</b>
          </div>
          <div>
            <span>Vencimento</span>
            <b>{br(title.dueDate)}</b>
            <small>
              {title.late > 0
                ? `${title.late} dia(s) em atraso`
                : title.late === 0
                  ? "Vence hoje"
                  : `Vence em ${-title.late} dia(s)`}
            </small>
          </div>
        </div>

        <nav className="pf-detail-tabs" aria-label="Seções dos detalhes do título">
          {(
            [
              ["resumo", "Visão geral"],
              ["historico", `Histórico (${events.length})`],
              ["cobranca", "Cobrança"],
              ["controladoria", "Controladoria"],
              ["recebivel", "Detalhes do recebível"],
            ] as [DetailTab, string][]
          ).map(([id, label]) => (
            <button
              key={id}
              type="button"
              className={tab === id ? "active" : ""}
              onClick={() => {
                setTab(id);
                setNotice("");
              }}
            >
              {label}
            </button>
          ))}
        </nav>

        {notice && (
          <div className="pf-detail-notice" role="status">
            {notice}
          </div>
        )}

        <div className="pf-detail-body">
          {tab === "resumo" && (
            <div className="pf-detail-overview">
              <section className="pf-contact-hub">
                <div>
                  <span>CONTATO RÁPIDO DO SACADO</span>
                  <b>{debtor?.name ?? title.debtorName}</b>
                  <small>Abra o canal e registre a conversa na aba Cobrança.</small>
                </div>
                <div className="pf-contact-actions">
                  <a
                    className={`fn-btn small ${!whatsappHref ? "disabled" : ""}`}
                    href={whatsappHref || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setChannel("WhatsApp")}
                  >
                    WhatsApp
                  </a>
                  <button
                    type="button"
                    className="fn-btn ghost small"
                    disabled={!phone}
                    onClick={() => {
                      copy(phone);
                      setNotice("Telefone copiado para realizar a ligação.");
                      setChannel("Telefone");
                    }}
                  >
                    Copiar telefone
                  </button>
                  <a
                    className={`fn-btn ghost small ${!emailHref ? "disabled" : ""}`}
                    href={emailHref || undefined}
                    onClick={() => setChannel("E-mail")}
                  >
                    Abrir e-mail
                  </a>
                  <button type="button" className="fn-btn ghost small" onClick={() => setTab("cobranca")}>
                    Registrar cobrança
                  </button>
                </div>
              </section>
              <div className="pf-party-grid">
                {partyCard("Cedente", cedent, title.ownerName, title.ownerDocument)}
                {partyCard("Sacado", debtor, title.debtorName, title.debtorDocument)}
              </div>
              <section className="pf-detail-panel">
                <header>
                  <span>Pagamento e posição</span>
                  <b>{payments.length} recebimento(s)</b>
                </header>
                <div className="pf-detail-info-grid three">
                  <Info label="Status do título">{title.displayStatus}</Info>
                  <Info label="Valor pago">{money(title.paidAmount)}</Info>
                  <Info label="Saldo">{money(balance)}</Info>
                  <Info label="Data do último pagamento">{lastPayment ? br(lastPayment.date) : undefined}</Info>
                  <Info label="Banco do recebimento">{lastPayment?.bank}</Info>
                  <Info label="Forma / referência">
                    {lastPayment ? `${lastPayment.method ?? "—"} · ${lastPayment.reference ?? "—"}` : undefined}
                  </Info>
                </div>
              </section>
              <section className="pf-detail-panel">
                <header>
                  <span>Origem da operação</span>
                  <b>{title.originLabel}</b>
                </header>
                <div className="pf-detail-info-grid three">
                  <Info label="Proposta">{title.proposal}</Info>
                  <Info label="Aditivo">{title.aditivoNumber}</Info>
                  <Info label="Borderô">{title.borderoNumber}</Info>
                  <Info label="Empresa / veículo">{title.company}</Info>
                  <Info label="Instituição">{title.institution}</Info>
                  <Info label="Comercial">{repName(title.repId)}</Info>
                </div>
              </section>
            </div>
          )}

          {tab === "historico" && (
            <section className="pf-detail-panel">
              <header>
                <span>Linha do tempo completa</span>
                <b>{events.length} ocorrência(s)</b>
              </header>
              <div className="pf-timeline">
                {events.map(event => (
                  <article key={event.id}>
                    <i />
                    <div>
                      <b>{event.action}</b>
                      <p>{event.detail}</p>
                      <small>
                        {displayDateTime(event.at)} · {event.by}
                      </small>
                    </div>
                  </article>
                ))}
              </div>
            </section>
          )}

          {tab === "cobranca" && (
            <div className="pf-workbench">
              <section className="pf-contact-hub compact">
                <div>
                  <span>CANAIS DO SACADO</span>
                  <b>{phone || "Telefone não cadastrado"}</b>
                  <small>{email || "E-mail não cadastrado"}</small>
                </div>
                <div className="pf-contact-actions">
                  <a
                    className={`fn-btn small ${!whatsappHref ? "disabled" : ""}`}
                    href={whatsappHref || undefined}
                    target="_blank"
                    rel="noreferrer"
                    onClick={() => setChannel("WhatsApp")}
                  >
                    Cobrar no WhatsApp
                  </a>
                  <button
                    type="button"
                    className="fn-btn ghost small"
                    disabled={!phone}
                    onClick={() => {
                      copy(phone);
                      setChannel("Telefone");
                      setNotice("Telefone copiado.");
                    }}
                  >
                    Copiar para ligar
                  </button>
                  <a
                    className={`fn-btn ghost small ${!emailHref ? "disabled" : ""}`}
                    href={emailHref || undefined}
                    onClick={() => setChannel("E-mail")}
                  >
                    Cobrar por e-mail
                  </a>
                </div>
              </section>
              <div className="pf-workbench-grid">
                <form className="pf-detail-panel pf-action-form" onSubmit={saveOccurrence}>
                  <header>
                    <span>Registrar cobrança</span>
                    <b>Atualiza histórico e GRID</b>
                  </header>
                  <div className="pf-form-grid">
                    <label>
                      <span>Data e hora da cobrança</span>
                      <input
                        type="datetime-local"
                        value={chargedAt}
                        onChange={event => setChargedAt(event.target.value)}
                        required
                      />
                    </label>
                    <label>
                      <span>Canal utilizado</span>
                      <select value={channel} onChange={event => setChannel(event.target.value as CollectionChannel)}>
                        {channels.map(item => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    <label>
                      <span>Com quem falou</span>
                      <input
                        value={contactPerson}
                        onChange={event => setContactPerson(event.target.value)}
                        placeholder="Nome e setor"
                      />
                    </label>
                    <label>
                      <span>Resultado do contato</span>
                      <select
                        value={outcome}
                        onChange={event => chooseOutcome(event.target.value as CollectionOutcome)}
                      >
                        {outcomes.map(item => (
                          <option key={item}>{item}</option>
                        ))}
                      </select>
                    </label>
                    {outcome === "Promessa de pagamento" && (
                      <label>
                        <span>Data prometida</span>
                        <input
                          type="date"
                          value={promiseDate}
                          onChange={event => {
                            setPromiseDate(event.target.value);
                            setNextContactAt(suggestedReturn(outcome, event.target.value));
                          }}
                          required
                        />
                      </label>
                    )}
                    <label>
                      <span>Próximo contato</span>
                      <input
                        type="datetime-local"
                        value={nextContactAt}
                        onChange={event => setNextContactAt(event.target.value)}
                        required
                      />
                    </label>
                    <label className="wide">
                      <span>Resumo da conversa</span>
                      <textarea
                        value={notes}
                        onChange={event => setNotes(event.target.value)}
                        placeholder="Resposta do sacado, negociação, prazo e providências..."
                        rows={4}
                        required
                      />
                    </label>
                  </div>
                  <div className="pf-rule-hint">
                    <b>Régua sugerida</b>
                    <span>{returnRule}</span>
                  </div>
                  <footer>
                    <button type="submit" className="fn-btn">
                      Salvar ocorrência
                    </button>
                  </footer>
                </form>
                <div className="pf-workbench-side">
                  <section className="pf-detail-panel">
                    <header>
                      <span>Boleto e cobrança bancária</span>
                      <b>{title.bankStatus}</b>
                    </header>
                    <div className="pf-detail-info-grid">
                      <Info label="Nosso número">{title.ourNumber}</Info>
                      <Info label="Banco">{title.bank}</Info>
                      <Info label="Carteira / convênio">
                        {title.wallet || title.agreement
                          ? `${title.wallet ?? "—"} / ${title.agreement ?? "—"}`
                          : undefined}
                      </Info>
                      <Info label="Instrução atual">{title.collectionInstruction}</Info>
                    </div>
                    <div className="pf-boleto-actions">
                      <button
                        type="button"
                        className="fn-btn ghost small"
                        disabled={!title.digitableLine}
                        onClick={() => {
                          copy(title.digitableLine);
                          setNotice("Linha digitável copiada para envio.");
                        }}
                      >
                        Copiar linha digitável
                      </button>
                      <a
                        className={`fn-btn ghost small ${!whatsappHref || !title.digitableLine ? "disabled" : ""}`}
                        href={
                          whatsappHref && title.digitableLine
                            ? `https://wa.me/${waNumber}?text=${encodeURIComponent(`${message} Linha digitável: ${title.digitableLine}`)}`
                            : undefined
                        }
                        target="_blank"
                        rel="noreferrer"
                      >
                        Enviar boleto
                      </a>
                    </div>
                  </section>
                  <section className="pf-detail-panel">
                    <header>
                      <span>Acompanhamentos</span>
                      <b>{occurrences.length}</b>
                    </header>
                    <div className="pf-mini-history">
                      {occurrences.length ? (
                        occurrences.slice(0, 5).map(item => (
                          <article key={item.id}>
                            <b>
                              {br(item.chargedAt.slice(0, 10))} · {item.channel}
                            </b>
                            <p>
                              {item.outcome}: {item.notes}
                            </p>
                            <small>
                              Retorno {displayDateTime(item.nextContactAt)} · {item.createdBy}
                            </small>
                          </article>
                        ))
                      ) : (
                        <p className="fn-note">Nenhuma cobrança registrada.</p>
                      )}
                    </div>
                  </section>
                </div>
              </div>
            </div>
          )}

          {tab === "controladoria" && (
            <div className="pf-workbench-grid control">
              <form className="pf-detail-panel pf-action-form" onSubmit={saveConfirmation}>
                <header>
                  <span>Confirmação do título</span>
                  <b
                    className={
                      confirmationStatus === "Confirmado" ? "ok" : confirmationStatus === "Divergente" ? "bad" : "warn"
                    }
                  >
                    {confirmationStatus}
                  </b>
                </header>
                <div className="pf-confirmation-steps">
                  <span className="done">1. Identificar</span>
                  <span className={confirmationStatus !== "Não iniciada" ? "done" : ""}>2. Contatar</span>
                  <span className={confirmationStatus === "Confirmado" ? "done" : ""}>3. Confirmar</span>
                </div>
                <div className="pf-form-grid">
                  <label>
                    <span>Status da confirmação</span>
                    <select
                      value={confirmationStatus}
                      onChange={event => setConfirmationStatus(event.target.value as ConfirmationStatus)}
                    >
                      {confirmationStatuses.map(item => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Data e hora do contato</span>
                    <input
                      type="datetime-local"
                      value={confirmationAt}
                      onChange={event => setConfirmationAt(event.target.value)}
                      required
                    />
                  </label>
                  <label>
                    <span>Forma de contato</span>
                    <select
                      value={confirmationChannel}
                      onChange={event => setConfirmationChannel(event.target.value as CollectionChannel)}
                    >
                      {channels.map(item => (
                        <option key={item}>{item}</option>
                      ))}
                    </select>
                  </label>
                  <label>
                    <span>Pessoa que confirmou</span>
                    <input
                      value={confirmationContact}
                      onChange={event => setConfirmationContact(event.target.value)}
                      placeholder="Nome, cargo ou setor"
                    />
                  </label>
                  <label className="wide">
                    <span>Parecer geral da Controladoria</span>
                    <textarea
                      value={confirmationNotes}
                      onChange={event => setConfirmationNotes(event.target.value)}
                      placeholder="Confirme entrega, valor, vencimento, mercadoria/serviço, divergências e providências..."
                      rows={6}
                      required
                    />
                  </label>
                </div>
                <footer>
                  <button type="submit" className="fn-btn">
                    Salvar confirmação
                  </button>
                </footer>
              </form>
              <div className="pf-workbench-side">
                <section className="pf-detail-panel">
                  <header>
                    <span>Checklist de confirmação</span>
                    <b>Operacional</b>
                  </header>
                  <ul className="pf-check-list">
                    <li>Empresa e pessoa contatada</li>
                    <li>Recebimento da mercadoria ou serviço</li>
                    <li>Reconhecimento do valor e do título</li>
                    <li>Vencimento e condição de pagamento</li>
                    <li>Divergência, devolução ou contestação</li>
                    <li>Evidência e observação final</li>
                  </ul>
                </section>
                <section className="pf-detail-panel">
                  <header>
                    <span>Contato disponível</span>
                  </header>
                  <div className="pf-detail-info-grid">
                    <Info label="Telefone">{phone}</Info>
                    <Info label="E-mail">{email}</Info>
                    <Info label="Cedente">{title.ownerName}</Info>
                    <Info label="Comercial">{repName(title.repId)}</Info>
                  </div>
                  <div className="pf-contact-actions">
                    <a
                      className={`fn-btn ghost small ${!whatsappHref ? "disabled" : ""}`}
                      href={whatsappHref || undefined}
                      target="_blank"
                      rel="noreferrer"
                    >
                      WhatsApp
                    </a>
                    <button type="button" className="fn-btn ghost small" disabled={!phone} onClick={() => copy(phone)}>
                      Copiar telefone
                    </button>
                    <a className={`fn-btn ghost small ${!emailHref ? "disabled" : ""}`} href={emailHref || undefined}>
                      E-mail
                    </a>
                  </div>
                </section>
              </div>
            </div>
          )}

          {tab === "recebivel" && (
            <div className="pf-detail-columns">
              <section className="pf-detail-panel">
                <header>
                  <span>Recebível e documento fiscal</span>
                </header>
                <div className="pf-detail-info-grid">
                  <Info label="Tipo">{title.receivableType}</Info>
                  <Info label="Número do documento">{title.documentNumber}</Info>
                  <Info label="Emissão">{title.issueDate ? br(title.issueDate) : undefined}</Info>
                  <Info label="Vencimento original">{br(title.originalDueDate)}</Info>
                  <Info label="Vencimento atual">{br(title.dueDate)}</Info>
                  <Info label="CFOP">{title.cfop}</Info>
                  <Info label="Chave da NF-e">{title.nfeKey}</Info>
                  <Info label="CMC7">{title.cmc7}</Info>
                </div>
                {title.nfeKey && (
                  <button type="button" className="fn-btn ghost small" onClick={() => copy(title.nfeKey)}>
                    Copiar chave da NF-e
                  </button>
                )}
              </section>
              <section className="pf-detail-panel">
                <header>
                  <span>Composição financeira</span>
                </header>
                <div className="pf-detail-info-grid">
                  <Info label="Valor de face">{money(title.originalAmount)}</Info>
                  <Info label="Valor pago">{money(title.paidAmount)}</Info>
                  <Info label="Valor recomprado">{money(title.repurchasedAmount ?? 0)}</Info>
                  <Info label="Desconto">{money(title.discountAmount)}</Info>
                  <Info label="Abatimento">{money(title.abatementAmount)}</Info>
                  <Info label="Saldo">{money(balance)}</Info>
                  <Info label="Praça">
                    {title.city || title.state ? `${title.city ?? "—"} / ${title.state ?? "—"}` : undefined}
                  </Info>
                  <Info label="Compensação">{title.compensation}</Info>
                </div>
                <div className="pf-detail-observation">
                  <span>Observação</span>
                  <p>{title.observation ?? "Nenhuma observação registrada."}</p>
                </div>
              </section>
            </div>
          )}
        </div>
      </section>
    </div>,
    document.body,
  );
}

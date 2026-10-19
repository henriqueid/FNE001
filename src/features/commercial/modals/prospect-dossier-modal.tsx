"use client";

import { consultLeadCnpj } from "@/src/app/cnpj-enrichment-client";
import { dossierReadiness, emptyProspectDossier, saveProspectDossier } from "@/src/domain/commercial/actions";
import type { CResult, CommercialState, Prospect, ProspectDossier } from "@/src/domain/commercial/types";
import { inputMoney, num } from "@/src/features/commercial/commercial-ui";
import { BY, Field, Modal } from "@/src/features/finance/finance-ui";
import { useMemo, useState } from "react";

const documentLabels: Record<keyof ProspectDossier["documents"], string> = {
  companyRegistration: "Contrato social e cartão CNPJ",
  partnerDocuments: "Documentos dos sócios",
  financialStatements: "Balanço, DRE e faturamento",
  receivablesSample: "Amostra da carteira de recebíveis",
  bankStatements: "Extratos bancários",
};

export function ProspectDossierModal({
  state,
  prospect,
  onClose,
  onApply,
  onCommittee,
}: {
  state: CommercialState;
  prospect: Prospect;
  onClose: () => void;
  onApply: (result: CResult) => boolean | Promise<boolean>;
  onCommittee: (prospect: Prospect) => void;
}) {
  const initial = prospect.dossier ?? { ...emptyProspectDossier(), document: prospect.document ?? "" };
  const [dossier, setDossier] = useState(initial);
  const [lookup, setLookup] = useState<{ loading: boolean; error?: string }>({ loading: false });
  const [money, setMoney] = useState({
    monthlyRevenue: inputMoney(initial.monthlyRevenue),
    requestedLimit: inputMoney(initial.requestedLimit || prospect.potential),
  });
  const candidate = useMemo(
    () => ({
      ...dossier,
      monthlyRevenue: num(money.monthlyRevenue),
      requestedLimit: num(money.requestedLimit),
    }),
    [dossier, money],
  );
  const readiness = dossierReadiness({ ...prospect, dossier: candidate });

  const save = async () => {
    const result = saveProspectDossier(state, prospect.id, candidate, BY);
    return { ok: await onApply(result), result };
  };

  return (
    <Modal
      wide
      title="Dossiê técnico e proposta"
      subtitle={`${prospect.name} · ${state.reps.find(rep => rep.id === prospect.repId)?.name ?? "Sem responsável"}`}
      onClose={onClose}
      footer={
        <>
          <button className="fn-btn ghost" onClick={onClose}>
            Cancelar
          </button>
          <button
            className="fn-btn ghost"
            onClick={async () => {
              if ((await save()).ok) onClose();
            }}
          >
            Salvar proposta e dossiê
          </button>
          <button
            className="fn-btn primary"
            disabled={!readiness.ready}
            title={readiness.ready ? "Levar o dossiê ao comitê" : "Conclua os itens obrigatórios"}
            onClick={async () => {
              const saved = await save();
              const updated = saved.result.state.prospects.find(item => item.id === prospect.id);
              if (saved.ok && updated) onCommittee(updated);
            }}
          >
            Enviar ao comitê
          </button>
        </>
      }
    >
      <div className="cm-dossier-hero">
        <div>
          <span>PRONTIDÃO TÉCNICA PARA O COMITÊ</span>
          <strong>{readiness.percent}%</strong>
          <p>
            {readiness.ready
              ? "Dossiê completo para decisão."
              : `${readiness.total - readiness.completed} item(ns) ainda precisam de atenção.`}
          </p>
        </div>
        <div className="cm-dossier-progress" aria-label={`${readiness.percent}% completo`}>
          <i style={{ width: `${readiness.percent}%` }} />
        </div>
        <div className="cm-dossier-checks">
          {readiness.checks.map(check => (
            <span key={check.id} className={check.ready ? "ready" : "pending"}>
              {check.ready ? "✓" : "○"} {check.label}
            </span>
          ))}
        </div>
      </div>

      <section className="cm-proposal-summary">
        <header>
          <div>
            <span>PROPOSTA COMERCIAL</span>
            <strong>{candidate.legalName || prospect.name}</strong>
          </div>
          <span className={`fn-chip ${readiness.ready ? "ok" : "warn"}`}>
            {readiness.ready ? "Pronta para deliberação" : "Em preparação"}
          </span>
        </header>
        <div>
          <span>
            Limite proposto <b>R$ {inputMoney(candidate.requestedLimit) || "0"}</b>
          </span>
          <span>
            Taxa <b>{String(candidate.proposedRate || 0).replace(".", ",")}% a.m.</b>
          </span>
          <span>
            Prazo médio <b>{candidate.averageTermDays} dias</b>
          </span>
          <span>
            Carteira <b>{candidate.receivableType}</b>
          </span>
          <span>
            Concentração máxima observada <b>{candidate.largestDebtorPercent}%</b>
          </span>
        </div>
        <p>
          {candidate.commercialSummary ||
            "O parecer comercial consolidará o contexto, a oportunidade, os riscos observados e a recomendação para o comitê."}
        </p>
      </section>

      <div className="cm-form-section">
        <div className="cm-form-section-head">
          <b>1. Empresa e contato</b>
          <span>Identidade jurídica e interlocutor da negociação.</span>
        </div>
        <div className="fn-form">
          <Field label="CNPJ">
            <div className="cm-cnpj-lookup">
              <input
                value={dossier.document}
                onChange={e => setDossier({ ...dossier, document: e.target.value })}
                placeholder="00.000.000/0000-00"
              />
              <button
                type="button"
                className="fn-btn ghost small"
                disabled={lookup.loading}
                onClick={async () => {
                  setLookup({ loading: true });
                  void consultLeadCnpj(dossier.document)
                    .then(evidence => {
                      setDossier(current => ({
                        ...current,
                        document: evidence.registrationNumber,
                        legalName: evidence.legalName,
                        tradeName: evidence.tradeName,
                        segment: evidence.mainActivity.description || current.segment,
                        city: evidence.address.city,
                        state: evidence.address.state,
                        email: evidence.email || current.email,
                        phone: evidence.phones[0] || current.phone,
                      }));
                      setLookup({ loading: false });
                    })
                    .catch(reason =>
                      setLookup({
                        loading: false,
                        error: reason instanceof Error ? reason.message : "Consulta indisponível.",
                      }),
                    );
                }}
              >
                {lookup.loading ? "Consultando…" : "Consultar CNPJ"}
              </button>
            </div>
            {lookup.error && <small className="cm-field-error">{lookup.error}</small>}
          </Field>
          <Field label="Razão social">
            <input value={dossier.legalName} onChange={e => setDossier({ ...dossier, legalName: e.target.value })} />
          </Field>
          <Field label="Nome fantasia">
            <input value={dossier.tradeName} onChange={e => setDossier({ ...dossier, tradeName: e.target.value })} />
          </Field>
          <Field label="Segmento">
            <input value={dossier.segment} onChange={e => setDossier({ ...dossier, segment: e.target.value })} />
          </Field>
          <Field label="Cidade">
            <input value={dossier.city} onChange={e => setDossier({ ...dossier, city: e.target.value })} />
          </Field>
          <Field label="UF">
            <input
              maxLength={2}
              value={dossier.state}
              onChange={e => setDossier({ ...dossier, state: e.target.value.toUpperCase() })}
            />
          </Field>
          <Field label="Contato">
            <input
              value={dossier.contactName}
              onChange={e => setDossier({ ...dossier, contactName: e.target.value })}
            />
          </Field>
          <Field label="Cargo">
            <input
              value={dossier.contactRole}
              onChange={e => setDossier({ ...dossier, contactRole: e.target.value })}
            />
          </Field>
          <Field label="E-mail">
            <input
              type="email"
              value={dossier.email}
              onChange={e => setDossier({ ...dossier, email: e.target.value })}
            />
          </Field>
          <Field label="Telefone">
            <input value={dossier.phone} onChange={e => setDossier({ ...dossier, phone: e.target.value })} />
          </Field>
        </div>
      </div>

      <div className="cm-form-section">
        <div className="cm-form-section-head">
          <b>2. Perfil econômico e operação pretendida</b>
          <span>Base objetiva para o limite e a precificação.</span>
        </div>
        <div className="fn-form">
          <Field label="Faturamento mensal (R$)">
            <input
              inputMode="decimal"
              value={money.monthlyRevenue}
              onChange={e => setMoney({ ...money, monthlyRevenue: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </Field>
          <Field label="Limite solicitado (R$)">
            <input
              inputMode="decimal"
              value={money.requestedLimit}
              onChange={e => setMoney({ ...money, requestedLimit: e.target.value.replace(/[^\d.,]/g, "") })}
            />
          </Field>
          <Field label="Taxa proposta (% a.m.)">
            <input
              inputMode="decimal"
              value={String(dossier.proposedRate || "").replace(".", ",")}
              onChange={e => setDossier({ ...dossier, proposedRate: num(e.target.value) })}
            />
          </Field>
          <Field label="Prazo médio (dias)">
            <input
              type="number"
              min={1}
              value={dossier.averageTermDays}
              onChange={e => setDossier({ ...dossier, averageTermDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Tipo de recebível">
            <input
              value={dossier.receivableType}
              onChange={e => setDossier({ ...dossier, receivableType: e.target.value })}
            />
          </Field>
          <Field label="Quantidade de sacados">
            <input
              type="number"
              min={0}
              value={dossier.debtorCount}
              onChange={e => setDossier({ ...dossier, debtorCount: Number(e.target.value) })}
            />
          </Field>
          <Field label="Maior sacado (%)">
            <input
              type="number"
              min={0}
              max={100}
              value={dossier.largestDebtorPercent}
              onChange={e => setDossier({ ...dossier, largestDebtorPercent: Number(e.target.value) })}
            />
          </Field>
        </div>
      </div>

      <div className="cm-form-section">
        <div className="cm-form-section-head">
          <b>3. Risco observado e parecer</b>
          <span>O comitê recebe o contexto, não apenas números.</span>
        </div>
        <label className="cm-check-row">
          <input
            type="checkbox"
            checked={dossier.hasRestrictiveIssues}
            onChange={e => setDossier({ ...dossier, hasRestrictiveIssues: e.target.checked })}
          />
          <span>
            <b>Há apontamentos ou restrições conhecidos</b>
            <small>Descreva abaixo a natureza e a mitigação proposta.</small>
          </span>
        </label>
        {dossier.hasRestrictiveIssues && (
          <Field label="Restrições identificadas">
            <textarea
              rows={3}
              value={dossier.restrictiveIssues}
              onChange={e => setDossier({ ...dossier, restrictiveIssues: e.target.value })}
            />
          </Field>
        )}
        <Field label="Parecer comercial">
          <textarea
            rows={5}
            value={dossier.commercialSummary}
            onChange={e => setDossier({ ...dossier, commercialSummary: e.target.value })}
            placeholder="Contexto da empresa, qualidade da carteira, oportunidade, riscos e recomendação do comercial."
          />
        </Field>
      </div>

      <div className="cm-form-section">
        <div className="cm-form-section-head">
          <b>4. Checklist documental</b>
          <span>Marque somente o que foi recebido e conferido.</span>
        </div>
        <div className="cm-document-grid">
          {(Object.keys(documentLabels) as (keyof ProspectDossier["documents"])[]).map(key => (
            <label key={key} className={dossier.documents[key] ? "complete" : ""}>
              <input
                type="checkbox"
                checked={dossier.documents[key]}
                onChange={e => setDossier({ ...dossier, documents: { ...dossier.documents, [key]: e.target.checked } })}
              />
              <span>{documentLabels[key]}</span>
            </label>
          ))}
        </div>
      </div>
    </Modal>
  );
}

"use client";

import type { StateCommit } from "@/src/ui/confirmed-state";
import { useMemo, useState } from "react";
import { type Operation } from "@/src/domain/core/types";
import { todayIso } from "@/src/domain/finance/ledger";
import { daysBetween } from "@/src/domain/home/metrics";
import { portfolioBalance, portfolioDisplayStatus, type PortfolioState } from "@/src/domain/portfolio/model";
import { buildControlChecks, buildFormalizationQueue, buildReconciliationQueue } from "@/src/domain/controlleria/model";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { PortfolioTitleDetails } from "@/src/features/portfolio/portfolio-title-details";
import { type PortfolioGridRow } from "@/src/features/portfolio/portfolio-title-grid";
import { useRegistry } from "@/src/app/registry-context";
import { repAt } from "@/src/domain/commercial/rules";
import { ChartIcon, CheckIcon, ClockIcon, ListIcon, ReceiptIcon, ScaleIcon, ShieldIcon } from "@/src/ui/icons";
import { ReportExport } from "@/src/ui/report-export";
import { buildControlReport } from "@/src/domain/reports/controlleria";
import { ModuleTabs } from "@/src/ui/module-tabs";

type Tab = "painel" | "checagem" | "formalizacao" | "conciliacao" | "auditoria" | "relatorios";

export default function ControlleriaModule({
  operations,
  portfolio,
  onPortfolio,
  companyScope,
  onOpenOperation,
}: {
  operations: Operation[];
  portfolio: PortfolioState;
  onPortfolio: StateCommit<PortfolioState>;
  companyScope: string;
  onOpenOperation: (operation: Operation) => void;
}) {
  const [tab, setTab] = useState<Tab>("painel");
  const [detailId, setDetailId] = useState<string | null>(null);
  const [auditPage, setAuditPage] = useState(1);
  const { commercial } = useRegistry();
  const today = todayIso();
  const titles = useMemo(
    () => portfolio.titles.filter(title => companyScope === "Consolidado" || title.company === companyScope),
    [companyScope, portfolio.titles],
  );
  const rows = useMemo<PortfolioGridRow[]>(
    () =>
      titles.map(title => ({
        ...title,
        amount: portfolioBalance(title),
        reference: title.documentNumber,
        source: title.source === "Operação liberada" ? "Operação liberada" : "Carteira",
        originLabel: title.importSource ?? title.source,
        displayStatus: portfolioDisplayStatus(title, today),
        late: daysBetween(title.dueDate, today),
        repId: repAt(commercial, title.ownerDocument, today),
      })),
    [commercial, titles, today],
  );
  const checks = useMemo(() => buildControlChecks(titles, today), [titles, today]);
  const formalization = useMemo(
    () =>
      buildFormalizationQueue(operations.filter(op => companyScope === "Consolidado" || op.vehicle === companyScope)),
    [companyScope, operations],
  );
  const reconciliation = useMemo(() => buildReconciliationQueue(titles), [titles]);
  const detail = rows.find(row => row.id === detailId);
  const divergent = checks.filter(item => item.status === "Divergente");
  const confirmed = checks.filter(item => item.status === "Confirmado");
  const pendingForm = formalization.filter(item => item.progress < 100);
  const audit = [
    ...titles.flatMap(title => title.events.map(event => ({ ...event, ref: title.documentNumber, area: "Carteira" }))),
    ...operations
      .filter(operation => companyScope === "Consolidado" || operation.vehicle === companyScope)
      .flatMap(operation =>
        (operation.approvalReview?.audit ?? []).map((event, index) => ({
          ...event,
          id: `${operation.id}-${index}`,
          ref: operation.proposal,
          area: "Formalização",
        })),
      ),
  ].sort((a, b) => b.at.localeCompare(a.at));
  const auditPages = Math.max(1, Math.ceil(audit.length / 30));
  const page = Math.min(auditPage, auditPages);
  const auditStart = (page - 1) * 30;
  const visibleAudit = audit.slice(auditStart, auditStart + 30);
  const repName = (id?: string) => commercial.reps.find(rep => rep.id === id)?.name ?? "Sem comercial";

  const openCheck = (id: string) => setDetailId(id);

  return (
    <div className="page-wrap fn-page ct-page">
      <div className="fn-heading">
        <div>
          <span className="hd-eyebrow">
            <ShieldIcon /> CONTROLE E CONFORMIDADE
          </span>
          <h1>Controladoria</h1>
          <p>
            Uma visão independente da operação: checagem de lastro, formalização, conciliação e trilha de auditoria.
          </p>
        </div>
        <div className="ct-scope">
          <span>ESCOPO ATIVO</span>
          <b>{companyScope}</b>
          <small>posição de {br(today)}</small>
        </div>
      </div>

      <ModuleTabs
        label="Seções da Controladoria"
        value={tab}
        onChange={setTab}
        tabs={[
          { id: "painel", label: "Painel", icon: <ChartIcon /> },
          {
            id: "checagem",
            label: "Checagem",
            icon: <CheckIcon />,
            count: checks.filter(i => i.status !== "Confirmado").length,
            tone: "alert",
          },
          {
            id: "formalizacao",
            label: "Formalização",
            icon: <ReceiptIcon />,
            count: pendingForm.length,
            tone: "alert",
          },
          { id: "conciliacao", label: "Conciliação", icon: <ScaleIcon />, count: reconciliation.length, tone: "alert" },
          { id: "auditoria", label: "Auditoria", icon: <ListIcon /> },
          { id: "relatorios", label: "Relatórios", icon: <ChartIcon /> },
        ]}
      />

      <section className="fn-kpis ct-kpis">
        <div>
          <span>Checagens pendentes</span>
          <strong className={checks.length - confirmed.length ? "warn" : ""}>{checks.length - confirmed.length}</strong>
          <small>
            {money(checks.filter(i => i.status !== "Confirmado").reduce((s, i) => s + i.balance, 0))} sob análise
          </small>
        </div>
        <div>
          <span>Divergências críticas</span>
          <strong className={divergent.length ? "bad" : ""}>{divergent.length}</strong>
          <small>exigem saneamento antes do avanço</small>
        </div>
        <div>
          <span>Formalizações abertas</span>
          <strong>{pendingForm.length}</strong>
          <small>{pendingForm.filter(i => i.pendingApprovals > 0).length} aguardando alçada</small>
        </div>
        <div>
          <span>Itens a conciliar</span>
          <strong>{reconciliation.length}</strong>
          <small>{money(reconciliation.reduce((s, i) => s + i.balance, 0))} em exposição</small>
        </div>
        <div>
          <span>Conformidade da checagem</span>
          <strong>{checks.length ? Math.round((confirmed.length / checks.length) * 100) : 100}%</strong>
          <small>{confirmed.length} títulos confirmados</small>
        </div>
      </section>

      {tab === "painel" && (
        <div className="ct-dashboard">
          <section className="fn-card ct-worklist">
            <header className="fn-card-head">
              <div>
                <h2>Fila prioritária</h2>
                <p>Itens que impedem ou elevam o risco do ciclo operacional</p>
              </div>
              <button className="fn-btn small" onClick={() => setTab("checagem")}>
                Ver toda a fila
              </button>
            </header>
            {checks
              .filter(i => i.status !== "Confirmado")
              .slice(0, 6)
              .map(item => (
                <CheckRow key={item.id} item={item} onOpen={() => openCheck(item.titleId)} />
              ))}
          </section>
          <section className="fn-card ct-health">
            <header className="fn-card-head">
              <div>
                <h2>Saúde dos controles</h2>
                <p>Cobertura dos pontos críticos</p>
              </div>
            </header>
            <Health label="Títulos checados" value={checks.length ? (confirmed.length / checks.length) * 100 : 100} />
            <Health
              label="Pacotes formalizados"
              value={
                formalization.length
                  ? (formalization.filter(i => i.progress === 100).length / formalization.length) * 100
                  : 100
              }
            />
            <Health
              label="Conciliação sem pendência"
              value={titles.length ? ((titles.length - reconciliation.length) / titles.length) * 100 : 100}
            />
            <div className="ct-callout">
              <ClockIcon />
              <div>
                <b>SLA sob controle</b>
                <span>
                  {checks.filter(i => i.priority === "critica" || i.priority === "alta").length} itens prioritários para
                  hoje
                </span>
              </div>
            </div>
          </section>
        </div>
      )}

      {tab === "checagem" && (
        <section className="fn-card ct-table-card">
          <header className="fn-card-head">
            <div>
              <h2>Central de checagem</h2>
              <p>Confirmação com o sacado, evidências e divergências no mesmo registro</p>
            </div>
          </header>
          <div className="ct-list">
            {checks.map(item => (
              <CheckRow key={item.id} item={item} onOpen={() => openCheck(item.titleId)} />
            ))}
          </div>
        </section>
      )}

      {tab === "formalizacao" && (
        <section className="fn-card ct-table-card">
          <header className="fn-card-head">
            <div>
              <h2>Esteira de formalização</h2>
              <p>Documentos, assinaturas e aprovações por operação</p>
            </div>
          </header>
          <div className="ct-list">
            {formalization.map(item => (
              <article className="ct-form-row" key={item.operation.id}>
                <div>
                  <b>{item.operation.cedent}</b>
                  <span>
                    {item.operation.proposal} · {item.operation.vehicle}
                  </span>
                </div>
                <div>
                  <b>
                    {item.readyDocuments}/{item.requiredDocuments}
                  </b>
                  <span>documentos</span>
                </div>
                <div>
                  <b>
                    {item.signed}/{item.signatures}
                  </b>
                  <span>assinaturas</span>
                </div>
                <div className="ct-progress">
                  <span>
                    <i style={{ width: `${item.progress}%` }} />
                  </span>
                  <b>{item.progress}%</b>
                </div>
                <span className={`fn-chip ${item.progress === 100 ? "ok" : item.pendingApprovals ? "warn" : ""}`}>
                  {item.status}
                </span>
                <button className="fn-btn small" onClick={() => onOpenOperation(item.operation)}>
                  Abrir operação
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "conciliacao" && (
        <section className="fn-card ct-table-card">
          <header className="fn-card-head">
            <div>
              <h2>Conciliação operacional</h2>
              <p>Diferenças entre carteira, pagamentos e retorno bancário</p>
            </div>
          </header>
          <div className="ct-list">
            {reconciliation.map(item => (
              <article className={`ct-recon-row ${item.severity}`} key={item.title.id}>
                <div>
                  <b>{item.title.documentNumber}</b>
                  <span>{item.title.debtorName}</span>
                </div>
                <div>
                  <b>{item.issue}</b>
                  <span>
                    {item.title.bankStatus} · {item.title.status}
                  </span>
                </div>
                <div>
                  <b>{money(item.balance)}</b>
                  <span>saldo</span>
                </div>
                <button className="fn-btn small" onClick={() => openCheck(item.title.id)}>
                  Analisar
                </button>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "auditoria" && (
        <section className="fn-card ct-table-card">
          <header className="fn-card-head">
            <div>
              <h2>Trilha de auditoria</h2>
              <p>Eventos operacionais com responsável, momento e referência</p>
            </div>
          </header>
          <nav className="fn-toolbar" aria-label="Páginas da trilha de auditoria">
            <span>
              Mostrando {audit.length ? auditStart + 1 : 0} a {Math.min(auditStart + 30, audit.length)} de{" "}
              {audit.length} eventos · Página {page} de {auditPages}
            </span>
            <button type="button" className="fn-btn ghost" disabled={page === 1} onClick={() => setAuditPage(page - 1)}>
              Anterior
            </button>
            <button
              type="button"
              className="fn-btn ghost"
              disabled={page === auditPages}
              onClick={() => setAuditPage(page + 1)}
            >
              Próxima
            </button>
          </nav>
          <div className="ct-audit">
            {visibleAudit.map(event => (
              <article key={event.id}>
                <span className="ct-audit-dot" />
                <div>
                  <b>{event.action}</b>
                  <span>{event.detail}</span>
                  <small>
                    {event.area} · {event.ref}
                  </small>
                </div>
                <div>
                  <b>{event.by}</b>
                  <span>{event.at}</span>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}

      {tab === "relatorios" && (
        <>
          <div className="fn-toolbar">
            <ReportExport
              report={() => buildControlReport(companyScope, today, checks, formalization, reconciliation)}
            />
          </div>
          <div className="ct-report-grid">
            <Report
              title="Checagem por resultado"
              rows={[
                ["Confirmados", confirmed.length],
                ["Pendentes", checks.filter(i => ["Não iniciada", "Pendente"].includes(i.status)).length],
                ["Não localizados", checks.filter(i => i.status === "Não localizado").length],
                ["Divergentes", divergent.length],
              ]}
            />
            <Report
              title="Formalização por progresso"
              rows={[
                ["Concluída", formalization.filter(i => i.progress === 100).length],
                ["Acima de 75%", formalization.filter(i => i.progress >= 75 && i.progress < 100).length],
                ["Entre 25% e 74%", formalization.filter(i => i.progress >= 25 && i.progress < 75).length],
                ["Abaixo de 25%", formalization.filter(i => i.progress < 25).length],
              ]}
            />
            <Report
              title="Exposição dos controles"
              rows={[
                [
                  "Checagem pendente",
                  compact(checks.filter(i => i.status !== "Confirmado").reduce((s, i) => s + i.balance, 0)),
                ],
                ["Divergências", compact(divergent.reduce((s, i) => s + i.balance, 0))],
                ["Conciliação", compact(reconciliation.reduce((s, i) => s + i.balance, 0))],
                ["Títulos monitorados", titles.length],
              ]}
            />
          </div>
        </>
      )}

      {detail && (
        <PortfolioTitleDetails
          title={detail}
          repName={repName}
          portfolio={portfolio}
          onPortfolio={onPortfolio}
          onClose={() => setDetailId(null)}
          initialTab="controladoria"
        />
      )}
    </div>
  );
}

function CheckRow({ item, onOpen }: { item: ReturnType<typeof buildControlChecks>[number]; onOpen: () => void }) {
  return (
    <article className={`ct-check-row ${item.priority}`}>
      <div className="ct-priority">
        <b>{item.priority}</b>
        <span>{item.status}</span>
      </div>
      <div>
        <b>{item.debtorName}</b>
        <span>
          {item.ownerName} · {item.documentNumber}
        </span>
      </div>
      <div>
        <b>{item.issue}</b>
        <span>vencimento {br(item.dueDate)}</span>
      </div>
      <div>
        <b>{money(item.balance)}</b>
        <span>saldo do título</span>
      </div>
      <button className="fn-btn small action-warning" onClick={onOpen}>
        Checar
      </button>
    </article>
  );
}

function Health({ label, value }: { label: string; value: number }) {
  const pct = Math.max(0, Math.min(100, Math.round(value)));
  return (
    <div className="ct-health-row">
      <div>
        <b>{label}</b>
        <span>{pct}%</span>
      </div>
      <span>
        <i style={{ width: `${pct}%` }} />
      </span>
    </div>
  );
}

function Report({ title, rows }: { title: string; rows: Array<[string, string | number]> }) {
  return (
    <section className="fn-card ct-report">
      <header>
        <h2>{title}</h2>
        <p>Visão consolidada do escopo ativo</p>
      </header>
      {rows.map(([label, value]) => (
        <div key={label}>
          <span>{label}</span>
          <b>{value}</b>
        </div>
      ))}
    </section>
  );
}

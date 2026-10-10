"use client";

import { daysBetween, digits, inRange } from "@/src/domain/commercial/calendar";
import { isAccountManager, type CommercialState, type Deal } from "@/src/domain/commercial/types";
import { type PortfolioTitle } from "@/src/domain/home/metrics";
import { Avatar } from "@/src/features/commercial/commercial-ui";
import { br, compact, money } from "@/src/features/finance/finance-ui";
import { ArrowIcon, CheckIcon, ClockIcon, HandshakeIcon, UsersIcon } from "@/src/ui/icons";

export function TeamDynamicsTab({
  state,
  deals,
  titles,
  from,
  to,
  today,
  repFilter,
  onSelectRep,
}: {
  state: CommercialState;
  deals: Deal[];
  titles: PortfolioTitle[];
  from: string;
  to: string;
  today: string;
  repFilter: string;
  onSelectRep: (repId: string) => void;
}) {
  const activeReps = state.reps.filter(rep => rep.active);
  const managers = activeReps.filter(isAccountManager);
  const agents = activeReps.filter(rep => !isAccountManager(rep));
  const repById = new Map(activeReps.map(rep => [rep.id, rep]));
  const linksByDocument = new Map(state.links.map(link => [digits(link.document), link]));

  const agentFor = (preferred?: string) => (preferred ? repById.get(preferred) : undefined);
  const managerFor = (preferred?: string) => (preferred ? repById.get(preferred) : undefined);

  const periodDeals = deals.filter(deal => inRange(deal.date, from, to));
  const totalVop = periodDeals.reduce((sum, deal) => sum + deal.face, 0);
  const totalRevenue = periodDeals.reduce((sum, deal) => sum + deal.revenue, 0);
  const pipeline = state.prospects.filter(prospect => !prospect.lost && prospect.stage !== "Aprovado");
  const newLinks = state.links.filter(link => inRange(link.since, from, to));
  const activeLinks = state.links.filter(link => link.status === "Ativo");
  const overdue30 = titles
    .filter(title => daysBetween(title.dueDate, today) > 30)
    .reduce((sum, title) => sum + title.amount, 0);

  const agentRows = agents
    .filter(rep => !repFilter || rep.id === repFilter)
    .map(rep => {
      const prospects = state.prospects.filter(prospect => agentFor(prospect.repId)?.id === rep.id);
      const open = prospects.filter(prospect => !prospect.lost && prospect.stage !== "Aprovado");
      const won = prospects.filter(prospect => !prospect.lost && prospect.stage === "Aprovado");
      const repLinks = state.links.filter(link => agentFor(link.repId)?.id === rep.id);
      const repDeals = periodDeals.filter(
        deal => agentFor(linksByDocument.get(digits(deal.document))?.repId)?.id === rep.id,
      );
      const newAccounts = repLinks.filter(link => inRange(link.since, from, to));
      return {
        rep,
        prospects: prospects.length,
        open: open.length,
        pipeline: open.reduce((sum, prospect) => sum + prospect.potential, 0),
        conversion: prospects.length ? (won.length / prospects.length) * 100 : 0,
        newAccounts: newAccounts.length,
        handoffs: repLinks.filter(link => link.status !== "Em onboarding").length,
        vop: repDeals.reduce((sum, deal) => sum + deal.face, 0),
        revenue: repDeals.reduce((sum, deal) => sum + deal.revenue, 0),
      };
    })
    .sort((a, b) => b.vop - a.vop || b.pipeline - a.pipeline);

  const managerRows = managers
    .filter(rep => !repFilter || rep.id === repFilter)
    .map(rep => {
      const links = state.links.filter(link => managerFor(link.managerId)?.id === rep.id);
      const documents = new Set(links.map(link => digits(link.document)));
      const managedDeals = periodDeals.filter(deal => documents.has(digits(deal.document)));
      const managedTitles = titles.filter(title => documents.has(digits(title.ownerDocument)));
      const recurring = links.filter(
        link => periodDeals.filter(deal => digits(deal.document) === digits(link.document)).length >= 2,
      );
      const relationshipVisits = state.visits.filter(visit => {
        if (!inRange(visit.date, from, to) || visit.kind === "Prospecção") return false;
        const link = visit.document
          ? linksByDocument.get(digits(visit.document))
          : state.links.find(item => item.clientName === visit.target);
        return visit.repId === rep.id || (link && managerFor(link.managerId)?.id === rep.id);
      });
      return {
        rep,
        clients: links.length,
        active: links.filter(link => link.status === "Ativo").length,
        vop: managedDeals.reduce((sum, deal) => sum + deal.face, 0),
        revenue: managedDeals.reduce((sum, deal) => sum + deal.revenue, 0),
        openPortfolio: managedTitles.reduce((sum, title) => sum + title.amount, 0),
        overdue30: managedTitles
          .filter(title => daysBetween(title.dueDate, today) > 30)
          .reduce((sum, title) => sum + title.amount, 0),
        recurrence: links.length ? (recurring.length / links.length) * 100 : 0,
        visits: relationshipVisits.filter(visit => visit.status === "Realizada").length,
      };
    })
    .sort((a, b) => b.vop - a.vop || b.openPortfolio - a.openPortfolio);

  const handoffs = [...state.links]
    .filter(link => {
      const agent = agentFor(link.repId);
      const manager = managerFor(link.managerId);
      return !repFilter || agent?.id === repFilter || manager?.id === repFilter;
    })
    .sort((a, b) => b.since.localeCompare(a.since))
    .slice(0, 8);

  return (
    <div className="cm-team-page">
      <section className="cm-role-flow" aria-label="Dinâmica entre agente comercial e gerente de carteira">
        <article className="agent">
          <span className="cm-role-icon">
            <UsersIcon />
          </span>
          <div>
            <small>1 · PROSPECÇÃO E CONVERSÃO</small>
            <h2>Agente comercial</h2>
            <p>Encontra oportunidades, qualifica, conduz proposta e entrega uma conta pronta para operar.</p>
          </div>
          <dl>
            <div>
              <dt>Pipeline</dt>
              <dd>{compact(pipeline.reduce((sum, item) => sum + item.potential, 0))}</dd>
            </div>
            <div>
              <dt>Novas contas</dt>
              <dd>{newLinks.length}</dd>
            </div>
          </dl>
        </article>
        <div className="cm-handoff-step">
          <HandshakeIcon />
          <b>Passagem de bastão</b>
          <small>contexto, limite, acordo comercial e próximo passo</small>
          <ArrowIcon />
        </div>
        <article className="manager">
          <span className="cm-role-icon">
            <HandshakeIcon />
          </span>
          <div>
            <small>2 · RELACIONAMENTO E PRODUÇÃO</small>
            <h2>Gerente de carteira</h2>
            <p>Ativa recorrência, acompanha operações, antecipa risco e amplia o relacionamento com o cliente.</p>
          </div>
          <dl>
            <div>
              <dt>VOP gerenciado</dt>
              <dd>{compact(totalVop)}</dd>
            </div>
            <div>
              <dt>Clientes ativos</dt>
              <dd>{activeLinks.length}</dd>
            </div>
          </dl>
        </article>
      </section>

      <section className="fn-kpis cm-team-kpis">
        <div>
          <span>VOP · volume operado</span>
          <strong>{compact(totalVop)}</strong>
          <small>
            valor de face das operações entre {br(from)} e {br(to)}
          </small>
        </div>
        <div>
          <span>Receita do período</span>
          <strong>{compact(totalRevenue)}</strong>
          <small>
            {totalVop ? `${((totalRevenue / totalVop) * 100).toFixed(2).replace(".", ",")}% do VOP` : "sem produção"}
          </small>
        </div>
        <div>
          <span>Passagens realizadas</span>
          <strong>{state.links.filter(link => link.status !== "Em onboarding").length}</strong>
          <small>{state.links.filter(link => link.status === "Em onboarding").length} aguardando ativação</small>
        </div>
        <div>
          <span>Carteira vencida &gt; 30d</span>
          <strong className={overdue30 > 0 ? "bad" : ""}>{compact(overdue30)}</strong>
          <small>atenção compartilhada entre gerente, cobrança e risco</small>
        </div>
      </section>

      <div className="cm-team-columns">
        <section className="fn-card cm-role-ranking agent">
          <header className="fn-card-head">
            <div>
              <h2>Desempenho dos agentes</h2>
              <p>Prospecção, conversão e VOP originado no período</p>
            </div>
          </header>
          <div className="cm-role-list">
            {agentRows.map(row => (
              <button key={row.rep.id} onClick={() => onSelectRep(row.rep.id)}>
                <header>
                  <Avatar rep={row.rep} />
                  <span>
                    <b>{row.rep.name}</b>
                    <small>
                      {row.rep.kind} · {row.rep.region}
                    </small>
                  </span>
                  <strong>{compact(row.vop)}</strong>
                </header>
                <dl>
                  <div>
                    <dt>Leads</dt>
                    <dd>{row.open}</dd>
                  </div>
                  <div>
                    <dt>Pipeline</dt>
                    <dd>{compact(row.pipeline)}</dd>
                  </div>
                  <div>
                    <dt>Conversão</dt>
                    <dd>{Math.round(row.conversion)}%</dd>
                  </div>
                  <div>
                    <dt>Contas novas</dt>
                    <dd>{row.newAccounts}</dd>
                  </div>
                  <div>
                    <dt>Receita</dt>
                    <dd>{money(row.revenue)}</dd>
                  </div>
                </dl>
                <span className="cm-role-progress">
                  <i style={{ width: `${Math.min(100, row.conversion)}%` }} />
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="fn-card cm-role-ranking manager">
          <header className="fn-card-head">
            <div>
              <h2>Desempenho dos gerentes</h2>
              <p>Relacionamento, recorrência, carteira e qualidade</p>
            </div>
          </header>
          <div className="cm-role-list">
            {managerRows.map(row => (
              <button key={row.rep.id} onClick={() => onSelectRep(row.rep.id)}>
                <header>
                  <Avatar rep={row.rep} />
                  <span>
                    <b>{row.rep.name}</b>
                    <small>
                      {row.rep.role} · {row.rep.region}
                    </small>
                  </span>
                  <strong>{compact(row.vop)}</strong>
                </header>
                <dl>
                  <div>
                    <dt>Clientes ativos</dt>
                    <dd>
                      {row.active}/{row.clients}
                    </dd>
                  </div>
                  <div>
                    <dt>Carteira aberta</dt>
                    <dd>{compact(row.openPortfolio)}</dd>
                  </div>
                  <div>
                    <dt>Recorrência</dt>
                    <dd>{Math.round(row.recurrence)}%</dd>
                  </div>
                  <div>
                    <dt>Visitas</dt>
                    <dd>{row.visits}</dd>
                  </div>
                  <div>
                    <dt>Vencido &gt;30d</dt>
                    <dd className={row.overdue30 ? "bad" : ""}>{compact(row.overdue30)}</dd>
                  </div>
                </dl>
                <span className="cm-role-progress">
                  <i style={{ width: `${Math.min(100, row.recurrence)}%` }} />
                </span>
              </button>
            ))}
          </div>
        </section>
      </div>

      <section className="fn-card cm-handoff-board">
        <header className="fn-card-head">
          <div>
            <h2>Passagem de bastão e corresponsabilidade</h2>
            <p>Quem trouxe, quem cuida e qual é o próximo movimento de cada conta</p>
          </div>
          <span className="fn-chip">VOP = volume operado no período</span>
        </header>
        <div className="fn-table-scroll">
          <table className="fn-table">
            <thead>
              <tr>
                <th>Cliente</th>
                <th>Agente comercial</th>
                <th>Gerente de carteira</th>
                <th>Situação</th>
                <th className="num">VOP</th>
                <th>Próximo movimento</th>
              </tr>
            </thead>
            <tbody>
              {handoffs.map(link => {
                const agent = agentFor(link.repId);
                const manager = managerFor(link.managerId);
                const clientDeals = periodDeals.filter(deal => digits(deal.document) === digits(link.document));
                const vop = clientDeals.reduce((sum, deal) => sum + deal.face, 0);
                const last = deals.filter(deal => digits(deal.document) === digits(link.document)).at(-1)?.date;
                const waiting = link.status === "Em onboarding";
                return (
                  <tr key={link.id}>
                    <td>
                      <b>{link.clientName}</b>
                      <small>
                        {link.segment} · desde {br(link.since)}
                      </small>
                    </td>
                    <td>
                      {agent ? (
                        <div className="cm-rep">
                          <Avatar rep={agent} small />
                          <span>{agent.name}</span>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {manager ? (
                        <div className="cm-rep">
                          <Avatar rep={manager} small />
                          <span>{manager.name}</span>
                        </div>
                      ) : (
                        "Definir gerente"
                      )}
                    </td>
                    <td>
                      <span className={`fn-chip ${waiting ? "warn" : "ok"}`}>
                        {waiting ? <ClockIcon /> : <CheckIcon />}
                        {waiting ? "Aguardando aceite" : "Carteira assumida"}
                      </span>
                    </td>
                    <td className="num">
                      <b>{compact(vop)}</b>
                      <small>{last ? `última ${br(last)}` : "sem operação"}</small>
                    </td>
                    <td>
                      {waiting
                        ? "Concluir onboarding e combinar 1ª operação"
                        : vop
                          ? "Manter recorrência e ampliar share"
                          : "Reativar relacionamento"}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

"use client";
/**
 * Cabeçalho do painel de precificação: apresentação e ajuda contextual, atalhos
 * de navegação entre seções, situação da carteira de origem e barra de versão
 * (condição salva/protegida ou revisão em andamento).
 */
import { preciseMoney } from "@/src/domain/core/format";
import { type PricingDraft } from "@/src/domain/operations/pricing";
import { Badge, InfoTip } from "@/src/features/operations/components/status";
import { type PricingCalculation, sourceStatusHint } from "./pricing-model";

function scrollToPricingSection(id: string) {
  document.getElementById(id)?.scrollIntoView({ behavior: "smooth", block: "start" });
}

type PricingHeroProps = {
  status: PricingDraft["status"];
};

/** Título do simulador, status do rascunho e faixa de ajuda contextual. */
export function PricingHero({ status }: PricingHeroProps) {
  return (
    <>
      <div className="pricing-hero">
        <div>
          <Badge tone="eyebrow">PREÇO E ESTRUTURA</Badge>
          <h3>Simulador da condição comercial</h3>
          <p>
            Transforme o fluxo aprovado em taxa, valor líquido e retorno. O detalhamento por título fica disponível sem
            poluir a decisão.
          </p>
        </div>
        <Badge tone={status === "Condição salva" ? "ready" : "attention"}>{status}</Badge>
      </div>
      <div className="pricing-help-strip">
        <span>AJUDA CONTEXTUAL</span>
        <div>
          <b>Condição financeira</b>
          <InfoTip text="Define método de cálculo, taxa, custo de capital, float, prazo mínimo e forma de rateio das tarifas." />
        </div>
        <div>
          <b>Tarifas e retenções</b>
          <InfoTip text="Configura os componentes descontados do valor liberado, incluindo tarifas, tributos, garantia e retenções." />
        </div>
        <div>
          <b>Tarifas esporádicas</b>
          <InfoTip text="Inclui cobranças específicas e auditáveis que se aplicam somente a esta operação." />
        </div>
        <div>
          <b>Regresso</b>
          <InfoTip text="Define a responsabilidade do cedente e o prazo para recomprar ou regularizar recebíveis inadimplidos." />
        </div>
      </div>
    </>
  );
}

/** Atalhos que rolam a página até cada seção do painel. */
export function PricingQuickNav() {
  return (
    <nav className="pricing-quick-nav" aria-label="Atalhos da precificação">
      <span>IR PARA</span>
      <button type="button" onClick={() => scrollToPricingSection("pricing-condition")}>
        Condição
      </button>
      <button type="button" onClick={() => scrollToPricingSection("pricing-fees")}>
        Tarifas
      </button>
      <button
        type="button"
        className="repurchase-nav-action"
        onClick={() => scrollToPricingSection("pricing-repurchase-overview")}
      >
        Recompra
      </button>
      <button type="button" onClick={() => scrollToPricingSection("pricing-responsibility")}>
        Responsabilidade
      </button>
      <button type="button" onClick={() => scrollToPricingSection("pricing-memory")}>
        Memória e auditoria
      </button>
    </nav>
  );
}

type PricingSourceStripProps = {
  calculated: PricingCalculation;
  ready: boolean;
};

/** Situação da carteira recebida da Entrada e deliberada em Risco. */
export function PricingSourceStrip({ calculated, ready }: PricingSourceStripProps) {
  return (
    <section className={`pricing-source-strip ${ready ? "ready" : "blocked"}`}>
      <div>
        <span>CARTEIRA DE ORIGEM</span>
        <strong>{ready ? "Pronta para precificar" : "Origem incompleta"}</strong>
        <small>
          {calculated.sourceTitleCount} título(s) recebidos da Entrada · {calculated.approvedTitleCount} aprovado(s) em
          Risco · {calculated.excludedTitleCount} excluído(s)
        </small>
      </div>
      <div>
        <span>FACE APROVADA</span>
        <strong>{preciseMoney.format(calculated.face)}</strong>
        <small>{sourceStatusHint(calculated, ready)}</small>
      </div>
    </section>
  );
}

type PricingVersionBarProps = {
  pricing: PricingDraft;
  activeVersionReason: string;
  versionReason: string;
  onVersionReasonChange: (value: string) => void;
  onStartNewVersion: () => void;
};

/** Versão da condição: protegida quando salva, com motivo para liberar nova revisão. */
export function PricingVersionBar({
  pricing,
  activeVersionReason,
  versionReason,
  onVersionReasonChange,
  onStartNewVersion,
}: PricingVersionBarProps) {
  return (
    <section className={`pricing-version-bar ${pricing.locked ? "locked" : "editing"}`}>
      <div>
        <span>{pricing.locked ? "CONDIÇÃO COMERCIAL SALVA" : "REVISÃO EM ANDAMENTO"}</span>
        <strong>
          {pricing.locked ? `Condição v${pricing.version ?? 0} protegida` : "Valores liberados para edição"}
        </strong>
        <small>
          {pricing.locked
            ? `Salva por ${pricing.savedBy ?? "Usuário"} em ${pricing.savedAt ?? "data não informada"}. Para alterar taxa ou tarifas, informe o motivo e libere a edição. A condição atual continuará no histórico.`
            : activeVersionReason
              ? `Motivo da revisão: ${activeVersionReason}`
              : "Ao salvar, esta revisão será registrada sem apagar a condição anterior."}
        </small>
      </div>
      {pricing.locked && (
        <div className="pricing-version-action">
          <label>
            <span>MOTIVO DA REVISÃO</span>
            <input
              aria-label="Motivo da revisão da condição"
              value={versionReason}
              placeholder="Ex.: renegociação da taxa"
              onChange={event => onVersionReasonChange(event.target.value)}
            />
          </label>
          <button type="button" className="pricing-edit-action" onClick={onStartNewVersion}>
            Editar taxa e tarifas
          </button>
        </div>
      )}
    </section>
  );
}

"use client";

/**
 * Página de escopo dos módulos ainda em desenho (Políticas e Integrações), com atalhos para onde as funções estão.
 */
import { type AppView, ShellContext } from "./shell-context";
import { ArrowIcon } from "@/src/ui/icons";
import { useContext } from "react";

export const moduleRoadmap: Record<
  "portfolio" | "registry" | "policies" | "integrations",
  {
    eyebrow: string;
    title: string;
    lead: string;
    blocks: { title: string; items: string[] }[];
    today: { label: string; view: AppView; detail: string }[];
  }
> = {
  portfolio: {
    eyebrow: "Carteira e cobrança",
    title: "Carteira",
    lead: "Onde o título vive depois da liberação: vencimentos, liquidação, atraso, cobrança e recompra, com retorno automático para o score e o limite do cedente.",
    blocks: [
      {
        title: "Posição",
        items: [
          "Títulos a vencer, vencidos e liquidados por cedente, sacado e veículo",
          "Aging por faixa e safra de originação",
          "Concentração e limites comprometidos",
        ],
      },
      {
        title: "Liquidação e cobrança",
        items: [
          "Remessa e retorno CNAB 240/400 por banco",
          "Crédito a identificar e baixa pelo extrato",
          "Régua de cobrança, protesto, prorrogação e acordo",
        ],
      },
      {
        title: "Ciclo fechado",
        items: [
          "Recompra com débito na conta gráfica",
          "Conta gráfica do cedente com extrato",
          "Eventos de atraso realimentando score e política",
        ],
      },
    ],
    today: [
      { label: "Carteira por atraso e concentração", view: "home", detail: "Visão geral › perfil Risco e cobrança" },
      { label: "Remessa e confirmação da cobrança", view: "finance", detail: "Financeiro › Liberações de operações" },
    ],
  },
  registry: {
    eyebrow: "Cadastro e KYC",
    title: "Cadastros",
    lead: "Fonte única de cedentes, sacados, grupos econômicos, contas favorecidas e signatários — usada por todas as etapas sem redigitação.",
    blocks: [
      {
        title: "Pessoas",
        items: [
          "Cedente e sacado com preenchimento pelo CNPJ e validação de dígitos",
          "Quadro societário, sócios em comum e grupo econômico",
          "Documentos com vencimento e prontidão para operar",
        ],
      },
      {
        title: "Relacionamento",
        items: [
          "Comercial responsável pelo cliente",
          "Contas favorecidas validadas (titularidade)",
          "Quadro de assinantes e contatos por área",
        ],
      },
      {
        title: "Conformidade",
        items: [
          "PLD/KYC com trilha de revisão",
          "Limite aprovado pelo comitê refletido no cadastro",
          "Sacados provisórios criados na digitação",
        ],
      },
    ],
    today: [
      { label: "Cadastro rápido de sacado", view: "operations", detail: "Operação › etapa Entrada (digitação manual)" },
      { label: "Carteira de clientes por comercial", view: "commercial", detail: "Comercial › Comerciais e carteira" },
    ],
  },
  policies: {
    eyebrow: "Motor de decisão",
    title: "Políticas",
    lead: "Regras versionadas que o sistema aplica sozinho: o usuário atua só nas exceções. Cada parâmetro com vigência, autor e histórico.",
    blocks: [
      {
        title: "Crédito e elegibilidade",
        items: [
          "Prazo mínimo, teto de concentração e limites por cedente, sacado e grupo",
          "Faixas verde, amarela, laranja e vermelha",
          "Alçadas e aprovadores por valor e risco",
        ],
      },
      {
        title: "Lastro",
        items: [
          "Amostra de checagem por risco",
          "Dispensas (SEFAZ confirmada, bom pagador, valor baixo)",
          "Travas que não podem ser liberadas",
        ],
      },
      {
        title: "Preço e tributos",
        items: [
          "Piso de taxa por risco, método de deságio e tarifas padrão",
          "Tributos travados por tipo de empresa (factoring, securitizadora, FIDC, ESC)",
          "Retenções por prioridade",
        ],
      },
    ],
    today: [
      {
        label: "Parâmetros aplicados na operação",
        view: "operations",
        detail: "Hoje fixos no código das etapas Risco, Lastro e Preço",
      },
    ],
  },
  integrations: {
    eyebrow: "Conectores",
    title: "Integrações",
    lead: "Consultas e trocas de arquivos que alimentam a decisão automática. No protótipo todas são simuladas; aqui ficarão credenciais, status e logs.",
    blocks: [
      {
        title: "Dados cadastrais e fiscais",
        items: [
          "Receita Federal (CNPJ)",
          "SEFAZ: distribuição de NF-e e manifestação do destinatário",
          "Registradoras de duplicata",
        ],
      },
      { title: "Crédito", items: ["Bureaus (score, restritivos, protestos)", "Consulta de cheques", "Open Finance"] },
      {
        title: "Bancos e formalização",
        items: [
          "CNAB de cobrança e de pagamentos, Pix e OFX",
          "Assinatura eletrônica",
          "Exportação contábil e administrador fiduciário",
        ],
      },
    ],
    today: [
      { label: "Importação de OFX e conciliação", view: "finance", detail: "Financeiro › Conciliação bancária" },
      { label: "Consultas simuladas de risco", view: "operations", detail: "Operação › etapa Risco" },
    ],
  },
};

export function ModuleRoadmap({ view }: { view: "portfolio" | "registry" | "policies" | "integrations" }) {
  const context = useContext(ShellContext);
  const data = moduleRoadmap[view];
  return (
    <div className="ds-page">
      <header className="ds-page-head">
        <div>
          <span className="ds-eyebrow">{data.eyebrow}</span>
          <h1>{data.title}</h1>
          <p>{data.lead}</p>
        </div>
        <span className="ds-chip ds-chip-accent">Fase 2 · em desenho</span>
      </header>
      <section className="ds-roadmap-grid">
        {data.blocks.map(block => (
          <article className="ds-card" key={block.title}>
            <h2>{block.title}</h2>
            <ul className="ds-checklist">
              {block.items.map(item => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </article>
        ))}
      </section>
      <section className="ds-card ds-today">
        <div>
          <h2>Onde isso está hoje</h2>
          <p>Enquanto o módulo não chega, estas funções já existem em outras telas.</p>
        </div>
        <div className="ds-today-links">
          {data.today.map(link => (
            <button type="button" key={link.label} onClick={() => context?.navigate(link.view)}>
              <span>
                <b>{link.label}</b>
                <small>{link.detail}</small>
              </span>
              <ArrowIcon />
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}

export type PortfolioTab = "cobranca" | "titulos" | "cedentes" | "comerciais" | "aging";
export type PortfolioSituation = "todos" | "avencer" | "vencidos" | "d30";

/** Recorte solicitado por um atalho de outro módulo ao abrir a Carteira. */
export type PortfolioFocus = {
  tab: PortfolioTab;
  situation?: PortfolioSituation;
  query?: string;
};

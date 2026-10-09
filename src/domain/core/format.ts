/**
 * Formatadores monetários compartilhados (pt-BR).
 */
export const money = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

export const preciseMoney = new Intl.NumberFormat("pt-BR", { style: "currency", currency: "BRL" });

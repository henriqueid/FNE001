/** Cadastro persistido não fornece histórico/uso de limite; zeros do adaptador não são fatos. */
import type { DeskReply } from "./desk-assistant";
import type { SystemKnowledge } from "./system-query";
const money = (value: number) => value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
export function registryFacts(
  reply: DeskReply,
  knowledge: SystemKnowledge,
  availability: { portfolio: boolean; operations: boolean },
): DeskReply {
  if (reply.tool === "consultar_cadastro(ordenar=uso_do_limite)")
    return {
      tool: reply.tool,
      paragraphs: [
        "Limites cadastrais informados. O uso e o limite disponível não são fornecidos por esta fonte; não serão preenchidos com zero.",
      ],
      table: {
        head: ["Cedente", "CPF/CNPJ", "Limite cadastral"],
        rows: knowledge.cedents
          .filter(cedent => cedent.creditLimit > 0)
          .sort((a, b) => b.creditLimit - a.creditLimit)
          .map(cedent => [cedent.name, cedent.document, money(cedent.creditLimit)]),
      },
    };
  if (reply.tool === "consultar_cadastro(ordenar=score)")
    return {
      tool: reply.tool,
      paragraphs: [
        "O cadastro persistido não fornece um score calculado e validado para esta consulta. Não vou substituir ausência de score por zero nem aplicar faixas de demonstração.",
      ],
    };
  const cedent = knowledge.cedents.find(cedent => reply.tool === `consultar_cadastro(cedente="${cedent.name}")`);
  if (!cedent) return reply;
  const document = cedent.document.replace(/\D/g, "");
  const titles = knowledge.titles.filter(title => title.ownerDocument.replace(/\D/g, "") === document);
  const sum = (rows: typeof titles) => rows.reduce((total, title) => total + Math.round(title.amount * 100), 0) / 100;
  const overdue = titles.filter(title => title.dueDate < knowledge.today);
  const operations = knowledge.operations.filter(
    operation =>
      operation.document.replace(/\D/g, "") === document &&
      !["Cancelada", "Liberada ao financeiro"].includes(operation.status),
  );
  return {
    tool: reply.tool,
    paragraphs: [
      `${cedent.name} (${cedent.document}). ${cedent.creditLimit > 0 ? `Limite cadastral informado: ${money(cedent.creditLimit)}.` : "Limite cadastral não informado."}`,
      availability.portfolio
        ? `Carteira autorizada: ${titles.length} títulos com saldo de ${money(sum(titles))}; ${overdue.length} vencidos, somando ${money(sum(overdue))}.`
        : "A Carteira não foi consultada porque seu perfil não possui essa permissão.",
      availability.operations
        ? `${operations.length} operações abertas no recorte consultado.`
        : "Operações não foram consultadas por falta de permissão.",
      "Score, uso do limite, histórico consolidado de liquidações e atraso médio não estão disponíveis nesta fonte. Consulte comportamento para pagamentos e promessas efetivamente registrados.",
    ],
  };
}

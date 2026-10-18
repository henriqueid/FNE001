/** Consultas verificáveis com interpretação sujeita ao orçamento server-side. */
import { copilotRequestContext, copilotFailure } from "@/src/server/copilot/http";
import { answerCopilotQuestion } from "@/src/server/copilot/service";

export async function POST(request: Request) {
  try {
    const { db, principal } = await copilotRequestContext(request);
    const body = (await request.json().catch(() => null)) as {
      question?: unknown;
      allowInterpretation?: unknown;
      previousReportId?: unknown;
      refreshReportId?: unknown;
      filters?: unknown;
    } | null;
    const question = typeof body?.question === "string" ? body.question.trim() : "";
    if (!question || question.length > 2000)
      return Response.json({ error: "Escreva uma pergunta com até 2.000 caracteres." }, { status: 400 });
    if (
      body?.previousReportId !== undefined &&
      (typeof body.previousReportId !== "string" || body.previousReportId.length > 100)
    )
      return Response.json({ error: "Referência de conversa inválida." }, { status: 400 });
    if (
      body?.refreshReportId !== undefined &&
      (typeof body.refreshReportId !== "string" || body.refreshReportId.length > 100)
    )
      return Response.json({ error: "Referência de atualização inválida." }, { status: 400 });
    const filters = body?.filters as { company?: unknown; document?: unknown } | undefined;
    if (
      filters !== undefined &&
      (!filters ||
        typeof filters !== "object" ||
        Array.isArray(filters) ||
        (filters.company !== undefined && (typeof filters.company !== "string" || filters.company.length > 200)) ||
        (filters.document !== undefined && (typeof filters.document !== "string" || filters.document.length > 30)))
    )
      return Response.json({ error: "Filtros inválidos." }, { status: 400 });
    return Response.json(
      await answerCopilotQuestion(db, principal, question, {
        allowInterpretation: body?.allowInterpretation !== false,
        previousReportId: body?.previousReportId as string | undefined,
        refreshReportId: body?.refreshReportId as string | undefined,
        filters: filters
          ? { company: filters.company as string | undefined, document: filters.document as string | undefined }
          : undefined,
      }),
    );
  } catch (error) {
    return copilotFailure(error);
  }
}

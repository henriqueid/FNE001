/** Recupera snapshots próprios após revalidar acesso atual às fontes. */
import { copilotRequestContext, copilotFailure, CopilotHttpError } from "@/src/server/copilot/http";
import { readReport, recentReports } from "@/src/server/copilot/memory-repository";
import { loadCopilotSources } from "@/src/server/copilot/sources";
import { replyFromReport } from "@/src/server/copilot/service";
export async function GET(request: Request) {
  try {
    const { db, principal } = await copilotRequestContext(request);
    const id = new URL(request.url).searchParams.get("id");
    if (id && id.length > 100) throw new CopilotHttpError("Referência inválida.", 400);
    const sources = await loadCopilotSources(db, principal);
    if (id) {
      const report = await readReport(db, principal, id, sources.entityCompanies);
      if (!report) throw new CopilotHttpError("Análise não encontrada ou fora do seu acesso atual.", 404);
      return Response.json({ report });
    }
    const reports = await recentReports(db, principal, sources.entityCompanies);
    return Response.json({
      history: reports.reverse().map(report => ({ question: report.question, reply: replyFromReport(report) })),
    });
  } catch (error) {
    return copilotFailure(error);
  }
}

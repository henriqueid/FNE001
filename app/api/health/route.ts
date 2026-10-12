import { getDatabase } from "@/src/server/database/postgres";

export async function GET() {
  try {
    const probe = await getDatabase().prepare("SELECT 1 AS ok").first<{ ok: number }>();
    if (Number(probe?.ok) !== 1) throw new Error("Resposta inesperada do banco.");
    return Response.json({ status: "ok" });
  } catch {
    return Response.json({ status: "degraded" }, { status: 503 });
  }
}

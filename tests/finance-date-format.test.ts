/** Formatação de datas não pode produzir valores malformados nem aceitar calendário impossível. */
import { expect, it } from "vitest";
import { br } from "@/src/features/finance/finance-ui";
it.each([
  ["2026-10-26", "26/10/2026"],
  ["26/10/2026", "26/10/2026"],
  ["2024-02-29", "29/02/2024"],
  ["29/02/2024", "29/02/2024"],
  ["2026-10-26T10:20:30.000Z", "26/10/2026"],
  ["2026-10-26T10:20:30-03:00", "26/10/2026"],
  ["2026-02-29", "—"],
  ["29/02/2026", "—"],
  ["31/04/2026", "—"],
  ["2026-13-01", "—"],
  ["2026-10-26lixo", "—"],
  ["2026-10-26T25:00:00Z", "—"],
  ["2026-10-26T10:99:00Z", "—"],
  ["lixo", "—"],
  ["", "—"],
  [undefined, "—"],
])("br(%s) = %s", (input, expected) => expect(br(input)).toBe(expected));

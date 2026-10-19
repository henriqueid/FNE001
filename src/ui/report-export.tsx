"use client";
/** Downloads locais dos dados do relatório ativo, sem alterar o estado operacional. */
import { useState } from "react";
import type { ExportReport } from "@/src/domain/reports/model";
import { reportToPdf } from "@/src/domain/reports/pdf";
import { reportToXlsx } from "@/src/domain/reports/xlsx";
export function ReportExport({ report }: { report: () => ExportReport }) {
  const [error, setError] = useState("");
  function download(format: "pdf" | "xlsx") {
    try {
      setError("");
      const data = report();
      const bytes = format === "pdf" ? reportToPdf(data) : reportToXlsx(data);
      const blob = new Blob([bytes as BlobPart], {
        type:
          format === "pdf" ? "application/pdf" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      });
      const url = URL.createObjectURL(blob),
        link = document.createElement("a");
      const name = `${data.title}-${data.to}`
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[^a-z0-9-]/gi, "-")
        .toLowerCase();
      link.href = url;
      link.download = `${name}.${format}`;
      link.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Não foi possível exportar este relatório.");
    }
  }
  return (
    <div className="fn-head-actions">
      <button className="fn-btn ghost" onClick={() => download("pdf")}>
        Exportar PDF
      </button>
      <button className="fn-btn ghost" onClick={() => download("xlsx")}>
        Exportar Excel
      </button>
      {error && <span role="alert">{error}</span>}
    </div>
  );
}

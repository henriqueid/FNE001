"use client";

/**
 * Cabeçalho da Central de Operações (título, trilha com a empresa em foco e nova operação).
 * A empresa é escolhida na barra superior.
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { Badge } from "@/src/features/operations/components/status";
import { PlusIcon, SparkIcon } from "@/src/ui/icons";

export function CentralHeader({ companyScope, onNew }: { companyScope: string; onNew: () => void }) {
  return (
    <div className="page-heading">
      <div>
        <Badge tone="eyebrow">
          <SparkIcon /> Central operacional ·{" "}
          {companyScope === "Consolidado" ? `Consolidado · ${destinations.length} empresas` : companyScope}
        </Badge>
        <h1>Operações em andamento</h1>
        <p>Filas, etapas e responsáveis das operações abertas.</p>
      </div>
      <div className="heading-actions">
        <button className="primary-action" onClick={onNew}>
          <PlusIcon /> Nova operação
        </button>
      </div>
    </div>
  );
}

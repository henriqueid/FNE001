"use client";

/**
 * Cabeçalho da Central de Operações (título, recorte por empresa e nova operação).
 */
import { destinations } from "@/src/domain/core/demo/companies";
import { Badge } from "@/src/features/operations/components/status";
import { PlusIcon, SparkIcon } from "@/src/ui/icons";

export function CentralHeader({
  companyScope,
  onCompanyScopeChange,
  onNew,
}: {
  companyScope: string;
  onCompanyScopeChange: (scope: string) => void;
  onNew: () => void;
}) {
  return (
    <div className="page-heading">
      <div>
        <Badge tone="eyebrow">
          <SparkIcon /> CENTRAL OPERACIONAL
        </Badge>
        <h1>Operações em andamento</h1>
        <p>Tudo o que exige atenção, decisão ou acompanhamento — em um só lugar.</p>
      </div>
      <div className="heading-actions">
        <label className="company-scope">
          <span>VISÃO</span>
          <select
            aria-label="Selecionar empresa ou visão consolidada"
            value={companyScope}
            onChange={e => onCompanyScopeChange(e.target.value)}
          >
            <option value="Consolidado">Consolidado · todas as empresas</option>
            {destinations.map(destination => (
              <option value={destination.name} key={destination.name}>
                {destination.name}
              </option>
            ))}
          </select>
        </label>
        <button className="primary-action" onClick={onNew}>
          <PlusIcon /> Nova operação
        </button>
      </div>
    </div>
  );
}

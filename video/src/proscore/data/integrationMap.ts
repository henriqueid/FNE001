// Onde a proScore poderia agregar, por módulo do STRATO, e qual encaixe já existe hoje.
// Base: pesquisa pública (docs/proscore/01-pesquisa-publica-proscore.md) e evidências do sistema.
// Todas as integrações são propostas sujeitas a validação técnica, comercial e jurídica.
export type HookState = "existente" | "demonstração" | "planejado";

export const INTEGRATION_MAP: { module: string; adds: string; hook: string; hookState: HookState }[] = [
  {
    module: "Cadastro",
    adds: "Validação e enriquecimento de cedentes e sacados",
    hook: "cadastro único por CNPJ; Receita e CEP em demonstração",
    hookState: "demonstração",
  },
  {
    module: "Compliance",
    adds: "PEP, grupos econômicos e vínculos societários",
    hook: "integração de PEP e compliance prevista no catálogo",
    hookState: "demonstração",
  },
  {
    module: "Crédito",
    adds: "Score, restrições, protestos e indicadores externos",
    hook: "score interno já reserva bureau e protestos",
    hookState: "existente",
  },
  {
    module: "Operações",
    adds: "Sinais de revisão antes da formalização",
    hook: "consulta ao bureau com autorização na análise do sacado",
    hookState: "demonstração",
  },
  {
    module: "Carteira",
    adds: "Monitoramento de mudanças no perfil de risco",
    hook: "radar de score e alertas da carteira",
    hookState: "existente",
  },
  {
    module: "Cobrança",
    adds: "Localização, segmentação e priorização",
    hook: "central de cobrança com régua por título",
    hookState: "existente",
  },
  {
    module: "Comercial",
    adds: "Identificação de empresas com potencial",
    hook: "funil comercial e contas novas",
    hookState: "existente",
  },
];

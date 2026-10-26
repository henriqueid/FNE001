# Score interno e responsabilidades da IA

## Score interno

O STRATO calcula hoje um **índice de qualidade de 0 a 1000** para cedentes e sacados, por **regras e pesos
configuráveis** (política de qualidade versionada). Não é um modelo estatístico calibrado nem preditivo.

| Camada | Estado |
|---|---|
| 1. Indicadores descritivos de carteira (liquidez no prazo, atraso médio, recompras, vencido > 30 dias, concentração, uso do limite) | Existente |
| 2. Classificação e regras internas (pesos, faixas, crítico/atenção/saudável, variação no tempo) | Existente |
| 3. Modelo preditivo estatisticamente validado | Não existe; exigiria base histórica, metodologia e validação |

Componentes externos já previstos na política: **Score de bureau (externo)** (peso 5) e **Protestos e apontamentos**
(peso 8), hoje sem provedor conectado. No vídeo, o termo “score preditivo” não é usado.

## Responsabilidades da IA

| Papel | Estado | Pode | Não pode |
|---|---|---|---|
| Copiloto operacional | Existente | Interpretar a pergunta, consultar dados autorizados, explicar com fontes | Fornecer números por conta própria; alterar decisões |
| Agente de análise | Planejado | Investigar pendências e organizar evidências | Aprovar crédito |
| Agente de carteira | Planejado | Detectar mudança de comportamento e sugerir acompanhamento | Alterar limites |
| Agente de cobrança | Planejado | Preparar ações e comunicações para aprovação | Enviar sem política/aprovação |
| Agente de conciliação | Planejado | Investigar divergências | Baixar títulos |
| Agente de compliance | Planejado | Organizar evidências e sinalizar inconsistências | Liberar operações |
| Agente executivo | Planejado | Sínteses gerenciais | Mudar parâmetros |

Regra transversal: a IA não executa pagamentos, não altera limites, não libera operações, não aprova crédito e não
movimenta valores fora dos fluxos determinísticos, das permissões e das alçadas (níveis de autonomia em
`docs/architecture/PLANO_ESTRUTURA_IA.md`, nível 4 “proibido à IA”).

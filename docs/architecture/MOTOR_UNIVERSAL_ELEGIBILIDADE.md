# Motor Universal de Elegibilidade — fundação V7

## Objetivo desta etapa

Introduzir o motor na etapa de Risco sem substituir o fluxo manual existente. Ele avalia os dados já disponíveis,
explica o resultado e congela a execução com as versões de política aplicadas. Nenhuma operação é bloqueada ou aprovada
automaticamente nesta fase.

## Separação de responsabilidades

- **Catálogo mestre:** define identidade, variável, origem e significado de cada regra. Não contém limites.
- **Política versionada:** ativa regras, fornece operador, parâmetro, severidade, ação e alçada de override.
- **Resolvedor:** combina as camadas Universal → Modalidade → Instituição → Produto → Carteira, com a camada mais
  específica prevalecendo para a mesma regra.
- **Motor:** compara fatos e parâmetros de forma determinística e gera resultado, explicação e evidência.
- **Adaptador da operação:** traduz os dados atuais da V7 para fatos de Título, Sacado e Cedente.
- **Interface:** mostra primeiro o que exige atenção e permite aprofundar até regra e evidência.
- **Snapshot da execução:** preserva o resultado original e as políticas usadas; mudanças futuras não recalculam o
  histórico silenciosamente.
- **Override:** registra decisão, justificativa, alçada, usuário, data, valores e evidência sem apagar a exceção original.
- **Métricas:** contabiliza operações e títulos processados, enquadramento direto, exceções e intervenções humanas.
- **Perfis:** Factoring, FIDC e Securitizadora ativam regras sobre o mesmo motor e declaram suas fontes documentais.
- **Score futuro:** coleta observações e resultados históricos sem produzir uma nota arbitrária nesta fase.
- **Telemetria:** deriva eventos de execução, exceção e override para futura persistência analítica.

## Regras ligadas aos dados atuais

| ID                                       | Nível     | Variável                              |
| ---------------------------------------- | --------- | ------------------------------------- |
| `TITLE-AMOUNT-MIN-001`                   | Título    | Valor de face                         |
| `TITLE-TERM-MAX-001`                     | Título    | Prazo corrido                         |
| `TITLE-DUPLICATE-001`                    | Título    | Duplicidade dentro da operação        |
| `TITLE-FISCAL-EVIDENCE-001`              | Título    | Presença de chave fiscal              |
| `DEBTOR-OPERATION-CONCENTRATION-MAX-001` | Sacado    | Concentração na operação              |
| `CEDENT-PROJECTED-LIMIT-USAGE-MAX-001`   | Cedente   | Utilização projetada do limite        |
| `OPERATION-TITLE-SUM-MATCH-001`          | Operação  | Conciliação da soma dos títulos       |
| `OPERATION-NET-AMOUNT-VALID-001`         | Operação  | Consistência entre bruto e líquido    |
| `PORTFOLIO-CEDENT-OVERDUE-MAX-001`       | Carteira  | Inadimplência da carteira do cedente  |
| `STRUCTURE-DEFINED-001`                  | Estrutura | Modalidade e veículo definidos        |
| `FIDC-FUND-CLASS-REQUIRED-001`           | Estrutura | Classe ou subclasse do FIDC informada |

## Limite consciente da demonstração

Os parâmetros usados na visualização são configurações demonstrativas versionadas, isoladas em `demo-policy.ts`. Eles
não representam limites universais nem recomendação de mercado. Antes de o motor influenciar o fluxo, devem ser
substituídos pela tradução formal da política aplicável e aprovados pela instituição.

## Estrutura implementada nesta fundação

1. Catálogo mestre desacoplado dos parâmetros.
2. Políticas por camadas e vigência.
3. Motor determinístico com cinco estados de resultado.
4. Adaptador dos seis níveis: Título, Sacado, Cedente, Operação, Carteira e Estrutura.
5. Execução congelada por operação.
6. Override append-only com justificativa obrigatória.
7. Contadores operacionais do motor.
8. Painel executivo com drill-down até evidência.
9. Perfis de Factoring, FIDC e Securitizadora sobre o mesmo núcleo.
10. Dataset de aprendizado para score proprietário, inicialmente sem cálculo de nota.
11. Eventos de telemetria para execução, exceção e override.

## Gestão por exceção na esteira (fase 3)

| Situação do motor | Lastro | Preço | Aprovação |
| --- | --- | --- | --- |
| Dentro da política / com alertas | Avança se evidências validadas e amostra confirmada; senão para e diz quantos títulos faltam | Avança com a condição salva, ou salva a condição padrão se respeitar piso, líquido e spread | Sempre humana (Tela Final) |
| Exceção ou análise incompleta | Para | Para | Para |
| Inelegível | Para | Para | Para |

- Implementação: `src/domain/operations/auto-advance.ts`, chamado a cada gravação no workspace.
- Fila da Central "Exceções por alçada": `src/domain/eligibility/authority-queue.ts`.
- Leitura de parâmetros do motor pelas etapas antigas: `src/domain/eligibility/policy-parameter.ts` (snapshot primeiro, depois a política vigente).
- Parâmetros que ainda não têm regra no catálogo: `src/domain/eligibility/operational-parameters.ts`.

## Fechamento do motor no protótipo

- Cada execução recebe uma assinatura determinística dos fatos e parâmetros usados.
- Mudanças de dados ou de política não recalculam o histórico: a tela sinaliza a divergência e exige uma reexecução
  explícita na etapa de Risco.
- Ao reexecutar, o snapshot anterior e todos os seus overrides são arquivados em uma trilha append-only.
- A trilha completa pode ser exportada em JSON para homologação e auditoria.
- O adaptador já expõe fatos disponíveis de título, sacado, grupo econômico, cedente, operação e carteira projetada;
  cada implantação escolhe quais regras ativar e quais parâmetros aplicar.
- A Tela Final usa o resultado efetivo do motor como requisito, mas continua exigindo a decisão humana configurada.

## Próximas etapas após homologação dos dados reais

1. Substituir o armazenamento local do protótipo por persistência transacional no backend.
2. Substituir a política demonstrativa pela política real da instituição/produto.
3. Substituir os dados demonstrativos de exposição por posições oficiais da carteira, registradora e custodiante.
4. Integrar autenticação e validar a alçada efetiva do usuário antes do override.
5. Homologar formalmente os parâmetros e cenários antes de usar o motor como decisão produtiva.

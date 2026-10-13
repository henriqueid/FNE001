# QProf — resumo da extração estrutural

> Ambiente demonstrativo QProf 2.33.0.0, inspecionado em 12/10/2026.

## Resultado

- 34 módulos catalogados.
- 330 rotas abertas e validadas.
- 245 telas com conteúdo funcional legível.
- 85 rotas vazias para o perfil utilizado ou dependentes de configuração/permissão.
- Nenhuma rota falhou durante a navegação final.
- 6.973 controles de formulário identificados.
- 833 ações/botões identificados.
- 397 ocorrências de abas identificadas.
- 1.669 cabeçalhos de grade identificados.

A extração coletou apenas metadados de interface: nomes das telas, rotas, abas, grupos, campos, ações e colunas. Linhas de negócio, dados pessoais e valores operacionais não foram preservados.

## Cobertura por módulo

| Módulo | Rotas | Com conteúdo | Vazias/condicionais | Campos | Ações | Abas | Colunas |
|---|---:|---:|---:|---:|---:|---:|---:|
| Acordo de cobrança | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Agente de negócio | 22 | 2 | 20 | 41 | 5 | 9 | 15 |
| Arquivamento | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Assinatura digital | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Cadastros básicos | 106 | 99 | 7 | 1.932 | 364 | 102 | 423 |
| Cartão de crédito | 3 | 3 | 0 | 81 | 16 | 0 | 39 |
| Cedente | 26 | 22 | 4 | 497 | 76 | 17 | 234 |
| Cobrança | 19 | 11 | 8 | 845 | 47 | 26 | 146 |
| Compras | 8 | 6 | 2 | 214 | 19 | 7 | 37 |
| Confissão de dívida | 1 | 1 | 0 | 33 | 6 | 8 | 12 |
| Consultas | 20 | 13 | 7 | 351 | 31 | 44 | 141 |
| Controladoria | 6 | 3 | 3 | 75 | 10 | 16 | 10 |
| Documentos digitais | 1 | 1 | 0 | 0 | 1 | 0 | 0 |
| Extrator | 2 | 2 | 0 | 0 | 2 | 0 | 0 |
| Fundo | 21 | 13 | 8 | 228 | 36 | 11 | 122 |
| Garantia | 1 | 0 | 1 | 0 | 0 | 0 | 0 |
| Gestão de investimentos | 5 | 5 | 0 | 9 | 16 | 0 | 38 |
| Governança corporativa | 4 | 2 | 2 | 16 | 2 | 18 | 0 |
| Help desk | 9 | 8 | 1 | 148 | 17 | 7 | 43 |
| IEPTB-CRA | 4 | 3 | 1 | 0 | 3 | 0 | 0 |
| Integrações | 2 | 2 | 0 | 0 | 2 | 0 | 0 |
| Mobile | 2 | 2 | 0 | 96 | 6 | 5 | 15 |
| Monkey Exchange | 1 | 1 | 0 | 12 | 3 | 2 | 0 |
| OData | 1 | 1 | 0 | 5 | 1 | 0 | 3 |
| Operação | 6 | 5 | 1 | 173 | 21 | 28 | 63 |
| Painel inteligente | 2 | 1 | 1 | 2 | 1 | 0 | 3 |
| Parâmetros gerais | 8 | 2 | 6 | 261 | 4 | 0 | 4 |
| Pessoas | 21 | 19 | 2 | 1.174 | 83 | 64 | 155 |
| Portal do investidor | 1 | 1 | 0 | 0 | 0 | 0 | 0 |
| Pós-venda | 4 | 4 | 0 | 178 | 10 | 3 | 34 |
| Relatórios | 4 | 4 | 0 | 116 | 13 | 8 | 26 |
| Simulação de operação | 2 | 1 | 1 | 15 | 2 | 0 | 6 |
| Tesouraria | 10 | 8 | 2 | 471 | 36 | 22 | 100 |
| Workflow | 5 | 0 | 5 | 0 | 0 | 0 | 0 |

## Padrões recorrentes

As ações dominantes são `Buscar`, `Cancelar` e `Inserir`, presentes principalmente nas telas legadas de manutenção. Também aparecem com frequência `Salvar`, `Efetivar`, `Excluir`, `Calcular`, `Imprimir`, `Exportar`, `Estornar` e ações de boleto.

As abas mais recorrentes representam:

- consulta e histórico;
- dados cadastrais e complementares;
- contatos, representantes, endereços e referências;
- títulos, carteira, liquidez, atraso e PDD;
- concentração por cedente e sacado;
- documentos, garantias, contrato e eventos;
- usuários, filtros, exceções e logs.

## Interpretação para o STRATO

O volume de telas não deve ser convertido em igual quantidade de rotas. A extração mostra famílias repetidas de manutenção, consulta e grade que podem ser atendidas por componentes e domínios compartilhados:

- cadastro único multi-papel;
- catálogos parametrizáveis;
- central de consultas e auditoria;
- central de cobrança e instruções;
- gestão documental;
- conectores com observabilidade;
- motor transversal de workflow;
- administração de fundos e investidores.

Consulte `QPROF_VS_STRATO_GAP_ANALYSIS.md` para a matriz de cobertura e prioridades.

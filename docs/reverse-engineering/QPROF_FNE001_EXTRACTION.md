# Extração funcional do QProf — FNE001 Operação

> Fonte: ambiente demonstrativo QProf, versão 2.33.0.0, inspecionado em 12/10/2026.
> Objetivo: apoiar a engenharia reversa do projeto FNE001 sem reproduzir literalmente documentação proprietária.

## Estado da extração

- O catálogo geral do ambiente contém 34 módulos e 330 telas acessíveis ao usuário da demonstração.
- A tela em escopo é `Operação (FNE001)`, rota `/Trading/FNE001`.
- O comando global `Tópicos de ajuda` não apresentou painel, modal, nova aba ou texto de ajuda na tela inicial nem no FNE001 durante a inspeção.
- A documentação abaixo distingue fatos observados da interface e inferências de produto.
- A extração detalhada está completa para `Agenda > Previsão`; as demais etapas exigem seleção manual no controle legado do QProf para que o servidor carregue seu conteúdo.

## Arquitetura de navegação do FNE001

O FNE001 funciona como uma esteira operacional com doze áreas principais:

1. Agenda
2. Importação
3. Digitação
4. Aditivos
5. Conferência
6. Análise
7. Efetivação
8. Cobrança
9. Liberação
10. Consulta
11. NPs
12. Operação Crédito Estruturado

A tela oferece ainda:

- favorito da página;
- navegação automática ativável/desativável;
- busca global;
- acesso a tópicos de ajuda e suporte;
- notificações, mensagens e configurações;
- identificação da empresa/fundo e do usuário;
- breadcrumb `Página Inicial / Operação (FNE001)`.

## Agenda

A etapa Agenda possui duas visões:

- `Previsão`;
- `Disponíveis`.

### Agenda > Previsão

#### Finalidade observada

Registrar e consultar previsões de operações por usuário e cedente, comparar valores previstos e realizados e relacionar a previsão às operações e aos lançamentos em conta-corrente.

#### Campos de entrada e filtro

| Campo | Tipo inferido | Observação |
|---|---|---|
| Usuário | pesquisa assistida | Possui código, botão de procura e descrição bloqueada para edição direta. |
| Cedente | pesquisa assistida | Possui código, botão de procura e descrição bloqueada para edição direta. |
| Valor Previsão | monetário | Valor esperado para a operação. |
| Previsão para | data | Data-alvo da previsão. |
| Taxa / Deságio (%) | percentual | Taxa esperada associada à previsão. |
| Rótulo | pesquisa assistida | Classificação da previsão. |
| Observações | texto multilinha | Comentários livres. |
| De | data | Início do período de consulta. |
| Até | data | Fim do período de consulta. |

#### Ações

- Imprimir
- Adicionar
- Buscar
- Cancelar

#### Grade Cedentes

Colunas observadas:

- Código
- Cedente
- Usuário Previsão
- Data Previsão
- Valor Previsto
- Valor Realizado
- Diferença
- Taxa %
- Rótulo

Totais exibidos:

- Total Previsto
- Total Realizado
- Total Diferença

#### Grade Operações

Colunas observadas:

- Código
- Data de geração
- Data de efetivação
- Valor pago
- Aditivo
- Cobrança

#### Grade Lançamentos C/C

Colunas observadas:

- Recibo
- Valor
- Data de geração
- Aditivo

#### Regras funcionais inferidas

- Uma previsão pertence a um usuário e a um cedente.
- O valor realizado é derivado das operações efetivamente vinculadas, não informado manualmente na grade.
- A diferença é calculada entre valor previsto e valor realizado.
- O sistema permite acompanhar uma previsão até sua realização e rastrear tanto a operação quanto os lançamentos financeiros gerados.
- Datas de previsão e período de consulta são conceitos distintos.
- A impressão usa o mesmo conjunto de filtros da consulta.
- As grades são paginadas e ordenáveis.

#### Entidades sugeridas para o modelo de domínio

- `OperationForecast`
- `Transferer` ou `Cedente`
- `User`
- `Label`
- `Operation`
- `CurrentAccountEntry`

Relacionamentos mínimos sugeridos:

- `OperationForecast.userId -> User.id`
- `OperationForecast.transfererId -> Transferer.id`
- `OperationForecast.labelId -> Label.id`
- `Operation.forecastId -> OperationForecast.id`
- `CurrentAccountEntry.operationId -> Operation.id`

## Requisitos transversais confirmados

- Componentes de pesquisa assistida para entidades referenciais.
- Datas com calendário.
- Valores monetários e percentuais com formatação local brasileira.
- Grades com ordenação, paginação, estado vazio e totais.
- Separação entre comandos de inclusão, pesquisa e cancelamento.
- Navegação por etapas da operação.
- Compatibilidade com fluxos de operação comum e operação de crédito estruturado.
- Rastreabilidade entre previsão, operação e conta-corrente.

## Pontos ainda pendentes

Para completar a engenharia reversa de todo o FNE001, ainda precisam ser carregadas e registradas as seguintes áreas:

- Agenda > Disponíveis
- Importação
- Digitação
- Aditivos
- Conferência
- Análise
- Efetivação
- Cobrança
- Liberação
- Consulta
- NPs
- Operação Crédito Estruturado

Para cada área, a próxima rodada deve registrar:

- finalidade;
- abas e subtelas;
- campos, tipos e obrigatoriedade;
- botões e efeitos;
- grades e colunas;
- mensagens e validações;
- pré-condições e transições de estado;
- permissões aparentes;
- entidades e relacionamentos;
- regras confirmadas e regras apenas inferidas.

## Limitações e cautelas

- O ambiente é demonstrativo; dados, permissões e parâmetros podem diferir da produção.
- Rótulos visuais não comprovam sozinhos regras de backend.
- Não foram executadas inclusões, alterações, exclusões, efetivações ou liberações.
- Nenhuma informação pessoal ou registro operacional foi copiado para este documento.
- O conteúdo foi reescrito como especificação técnica; não é uma cópia do manual proprietário.

# Changelog

## Não lançado — 02/10/2026 · Menu responsivo, painel de Risco e indicadores de mercado (v11)

**Menu**
- Desktop: módulos com nome na barra superior (Visão geral, Operações, Carteira, Comercial, Financeiro, Cadastros) e "Plataforma ▾" com Integrações e Configurações. Notebook: versão compacta. Tablet: botão "Menu" com painel agrupado (Operação, Gestão, Plataforma) e descrição de cada módulo. Celular: barra inferior + menu completo em folha.
- Empresa de trabalho e tema (claro, escuro, sistema) passam para o menu do usuário. Sai a gaveta lateral antiga.

**Risco e cobrança**
- `src/domain/risk/`: índice de qualidade explicável (0–100) por cliente, comparando a janela recente com a anterior; motivos em linguagem direta ("atraso médio subiu de 3 para 14 dias") com o impacto em pontos; ação sugerida. Rolagem (roll rate), safras (vintage), concentração com HHI e cobrança do mês.
- Política de qualidade (`quality-policy.ts`) com pesos, valores bom/ruim, janela, variação mínima, tamanho do ranking, patamar saudável, faixas de HHI e parâmetros dos indicadores (PDD por faixa, probabilidades do funil, prazos de revisão cadastral e de limite, faixas de inatividade). Editável na tela (botão de critérios) e guardada no navegador. Valores de demonstração, não referência de mercado.
- Painel: top 10 cedentes e sacados piorando × melhorando com motivos e ação, cobrança do mês contra o anterior, rolagem, safras e HHI na concentração. Indicadores do perfil Risco incluem PDD estimada e cedentes piorando.
- Histórico mensal de demonstração (`src/domain/core/demo/quality-history.ts`), coerente com a posição atual de cada cliente.

**Indicadores de mercado por tela** (`src/domain/indicators/`, componente `IndicatorGrid` com a fonte de cada número)
- Visão geral (Gestão): ticket médio, prazo médio ponderado, spread sobre captação, liquidez no vencimento, índice de recompra, vencido > 30/60/90, PDD estimada, 10 maiores cedentes e sacados.
- Carteira: prazo médio remanescente, vencido por faixa, PDD, liquidez no vencimento, 10 maiores sacados, recomprado, prorrogados, cartório e protesto.
- Operações: conversão até liberar, tempo de ciclo × padrão, operações sem intervenção, exceções decididas e regras do motor que mais param operações.
- Comercial: clientes sem operar por faixa, funil ponderado, taxa média e qualidade da carteira trazida por comercial.
- Financeiro: DRE do mês (receitas, despesas, resultado), spread sobre captação e giro da carteira.
- Cadastros: revisão cadastral vencida/a vencer, limite com revisão vencida, cedentes sem operar e distribuição de score.
- Taxa e custo de captação vêm da precificação da etapa Preço (parâmetros operacionais da modalidade): Visão geral e Financeiro mostram o mesmo número.

**Qualidade**
- 17 testes novos (83 no total): índice, motivos, rankings, rolagem, safras, HHI, PDD e indicadores de cada tela.

## Não lançado — 02/10/2026 · Visual Ledger (v10)

**Moldura**
- Sai o menu lateral no desktop: barra superior com os módulos em ícones quadrados (o ativo em preto, com o nome), busca, alertas, empresa e usuário. No celular continuam a gaveta e a barra inferior.
- Títulos de página grandes e finos; na Visão geral, trilha com empresa e perfil e abas de texto para perfil e período.

**Visão geral**
- Bloco principal de caixa (`src/features/home/cash-hero.tsx`): saldo em número grande, 30 dias realizados + 60 projetados em barras finas com as linhas dos cenários, régua de seleção do intervalo (mouse e teclado), cartão com entradas, saídas e variação. Janela em `homeSettings.timeline`.
- Saem o resumo em texto e o cartão "Caixa e capacidade de compra" (o caixa subiu para o bloco principal).
- Indicadores com rótulo em caixa alta e atalho para o módulo; originação em barras finas pareadas (realizado × ritmo da meta); composição da receita e carteira por atraso em gauge semicircular; legendas em bolinhas.

**Ajustes da revisão**
- Demonstração com datas relativas (`src/domain/core/demo/relative-dates.ts`): operações, carteira e pagamentos das sementes andam junto com o dia de hoje; as operações em andamento entram "hoje". Nos testes o deslocamento é zero.
- Bloco de caixa: número grande fixo = saldo em bancos hoje; o fim do intervalo selecionado aparece embaixo, com variação "vs. hoje". Barras = entradas (para cima) e saídas (para baixo) por dia; linhas = saldo dos cenários. A queda de hoje vem marcada (liberações prontas e em formalização).
- Empresa escolhida só na barra superior (saíram os seletores repetidos da Visão geral, Operações e Financeiro).
- Mais contraste nos textos secundários e rótulos; em telas largas (≥ 1720 px) todos os módulos aparecem com nome.

**Módulos**
- Operações, Carteira, Comercial, Financeiro, Cadastros, Configurações e Integrações no mesmo padrão: título grande com trilha ao lado, filtros em pílula, abas de texto, primeiro indicador como número de destaque, cartões sem borda, tabelas com cabeçalho em caixa alta, filas da Central com a ativa em preto, receita do Comercial em barras finas pareadas.

**Visual**
- Paleta monocromática com verde-menta para destaque positivo, fonte Urbanist auto-hospedada, cartões sem borda sobre fundo cinza, sem gradientes, brilhos e sombras decorativas (`app/styles/ledger.css`, `tools/ledger_palette.py`).

## Não lançado — 02/10/2026 · Gestão por exceção (fase 3) e parâmetros operacionais

**Gestão por exceção**
- Avanço automático (`domain/operations/auto-advance.ts`): com o motor liberando a operação (snapshot dentro da política ou exceções já deliberadas), Lastro e Preço concluem sozinhos e a operação chega à Tela Final (Aprovação). Lastro só avança com evidências validadas e amostra confirmada; Preço usa a condição já salva ou salva a condição padrão da modalidade quando respeita o piso e gera líquido e spread positivos. Aprovação, formalização e liberação nunca avançam sozinhas. Cada avanço fica registrado em nome do "Motor de elegibilidade", com o motivo; a esteira diz onde e por que parou. Desligável por `autoAdvanceWithinPolicy`.
- Central: nova fila **Exceções por alçada** (`domain/eligibility/authority-queue.ts`), com resumo por alçada clicável e "Aguarda: …" na linha da operação. Lê só o snapshot e os overrides.

**Parâmetros operacionais**
- Novo `src/domain/eligibility/operational-parameters.ts`: fonte única, por modalidade, dos números que as etapas atuais usavam fixos no código (faixas de score 600/700, prazo mínimo de 15 dias, CFOP 5xxx/6xxx, amostra de lastro 25/50/100%, participação relevante de 25%, piso de taxa 1,4/1,8/2,4% a.m., automação 70 e 80, condição comercial padrão e garantia por risco). Mesmos valores, mesmo comportamento; são configuração de demonstração, não referência de mercado.
- Risco, Lastro, Preço, Aprovação, Central, Cadastros e Visão geral passam a ler essa fonte.
- Concentração da etapa de Risco passa a ler o limite da regra `DEBTOR-OPERATION-CONCENTRATION-MAX-001` do motor (`policy-parameter.ts`): primeiro o valor congelado no snapshot da análise, senão a política vigente configurada em Políticas. Acaba a divergência entre 20% (tela antiga) e 35% (política demo do motor).
- Prazo do título em dias de calendário (antes somava um dia por arredondamento de fuso).
- Teste comercial deixou de depender da data fixa 30/09/2026.
- `tests/operational-parameters.test.ts`: paridade com a v7 para "Aprovar elegíveis", amostra de lastro, piso de taxa e condição padrão.

## 0.7.0 — 30/09/2026

**Código**
- Reorganização em camadas: `src/domain` (regras puras), `src/features` (telas por módulo), `src/app` (estado global e persistência), `src/ui`.
- Arquivos grandes divididos por responsabilidade (o antigo `operations-mvp.tsx`, com ~290 KB, foi dividido em cerca de 100 arquivos pequenos entre `src/app`, `src/domain/operations` e `src/features/operations`). Painéis de etapa separados em subcomponentes, hook de estado e modelo puro.
- Cabeçalho explicativo em todos os arquivos; `docs/ARCHITECTURE.md` e `docs/CONVENTIONS.md`.
- ESLint sem erros nem avisos, Prettier em todo o código, 28 testes unitários (Vitest) e `npm run check`.
- Acessibilidade: fundos de modal com `role="presentation"`, itens clicáveis acessíveis por teclado (`pressable`), rótulos em botões só com ícone.
- Remoção de código morto (recomendação de risco fixa, funções sem uso).

**Produto**
- Cadastro completo de pessoas com papéis (cedente, sacado, fornecedor, representante, debenturista, cotista, avalista, prestador), validação de CPF/CNPJ, endereço, contatos, contas bancárias, inativação com motivo e histórico.
- Gravar no Cadastro propaga: cedente aparece na Nova operação e ganha vínculo com o comercial; sacado entra na digitação; representante vira comercial.
- CNPJs de demonstração corrigidos para dígitos verificadores válidos.

## 0.6.0 — 30/09/2026

- Design system claro/escuro, shell novo com busca global e alertas, Cadastros e Carteira v1, vínculo único Cadastro → Operação → Carteira → Comercial → Tesouraria e correções da revisão (ver `docs/produto/REVISAO_V6.md`).

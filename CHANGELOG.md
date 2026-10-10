# Changelog

## Não lançado — 09/10/2026 · Cadastro P0 — auditoria por campo

- Toda edição cadastral exige motivo e grava uma linha imutável para cada campo alterado, com valor anterior, novo valor, autor, data e origem.
- A ficha mostra a linha do tempo completa com nomes de campos legíveis e mantém compatibilidade com eventos antigos que possuíam apenas uma descrição geral.
- A comparação cobre identificação, endereço, papéis, dados específicos de cada papel, contatos e contas bancárias, inclusive valores removidos.
- Três testes novos cobrem alterações simples e aninhadas, preservação de histórico legado e obrigatoriedade do motivo; suíte ampliada para 139 testes.

## Não lançado — 09/10/2026 · Copiloto flutuante e Mesa Inteligente (demonstração)

- O Copiloto vira um ícone redondo flutuante que abre uma caixa de diálogo de conversa no canto da tela, no lugar do botão largo antigo. A sugestão do momento continua no topo da conversa.
- Nova análise assistida: escolher o cedente e enviar XML de NF-e, CNAB 240/400 ou XLS no layout padrão de extrato (reconhecidos pela extensão; nesta versão os títulos são de exemplo).
- Tarefa em segundo plano por etapas, com pedido de autorização para consulta ao birô e aviso discreto ao terminar; a análise continua com a caixa fechada.
- Analista de Mesa: explica apontamentos com regra e versão da política, simula taxa, retira ou inclui títulos e compara cenários. Cada mudança gera uma versão nova; os valores vêm sempre do motor (`src/domain/copilot/desk-engine.ts`, que usa o `pricingAdjustment` do STRATO).
- Aprovação rápida só sem impedimentos e dentro da alçada; caso contrário, envio para alçada. Formalização e pagamento seguem manuais.
- "Expandir" abre a análise completa (valores, apontamentos, score, títulos e histórico de cenários) ao lado da conversa.
- Perguntas livres sobre a base: resumo da carteira, vencidos, vencimentos, maiores sacados, cedente ou sacado por nome ou CNPJ, uso de limite, score, operações na mesa e regras da política ativa (`src/domain/copilot/system-query.ts`). Cada resposta mostra a fonte consultada.
- Botão "Nova conversa" no topo do Copiloto e "Nova análise" no cartão do resultado: limpam a conversa e cancelam a tarefa em curso.
- Análise completa vira resumo da operação (`src/domain/copilot/desk-summary.ts`, `copilot-summary.tsx`): líquido e indicadores, composição do valor, score do cedente em gauge com as faixas da política, motivos do score, posição do cedente (limite usado, esta operação e disponível depois; carteira e vencidos), sacados da operação (participação contra o limite da política e posição de cada um na carteira), prazos e checagem da política.
- Títulos de exemplo usam sacados que existem na carteira de demonstração, para o cruzamento com a carteira aparecer.
- A barra de jornada ("Você está em" e "Entenda esta tela") fica oculta por padrão; liga em Configurações › Interface › "Barra de jornada e ajuda" (preferência salva no navegador). O Copiloto continua disponível com ela desligada.
- Prefixo de CSS `cpl-` (o `cp-` já era usado no painel de cliente do Risco).
- 20 testes novos (`tests/copilot-desk.test.ts`, `tests/copilot-system-query.test.ts`, `tests/copilot-desk-summary.test.ts`); suíte com 136 testes.

## Não lançado — 08/10/2026 · Central de cobrança e checagem

- Nova agenda operacional da carteira com priorização automática por promessa vencida, retorno atrasado, faixa de atraso, vencimento e confirmação do sacado.
- Filas separadas para cobrança e controladoria, filtros rápidos, valor único em tratamento e acesso direto à aba correta do título pelo botão **Atuar**.
- Régua visível de D−3 a D+31, com orientação de contato preventivo, cobrança amigável, cobrança formal e escalonamento.
- Cobertura automatizada das regras de prioridade e exclusão de títulos encerrados; suíte ampliada para 116 testes.

## Não lançado — 08/10/2026 · Manutenção de dependências

- Atualização coordenada de React 19.3, Vite 8.3, vinext 1.1, Vitest 5 e ferramentas de deploy da Cloudflare.
- Remoção de `drizzle-orm` e `drizzle-kit`, que ainda não eram usados pelo protótipo e mantinham uma cadeia vulnerável de build.
- Correção transitiva de `fflate` por override de patch compatível.
- Auditoria das dependências de produção sem vulnerabilidades; as ocorrências restantes são exclusivas do ambiente de desenvolvimento e vêm da cadeia de `braces`, ainda sem versão corrigida publicada.

## Não lançado — 02/10/2026 · Menu responsivo, painel de Risco e indicadores de mercado (v11)

**Menu**

- Desktop: módulos com nome na barra superior (Visão geral, Operações, Carteira, Comercial, Financeiro, Cadastros) e "Plataforma ▾" com Integrações e Configurações. Notebook: versão compacta. Tablet: botão "Menu" com painel agrupado (Operação, Gestão, Plataforma) e descrição de cada módulo. Celular: barra inferior + menu completo em folha.
- Empresa de trabalho e tema (claro, escuro, sistema) passam para o menu do usuário. Sai a gaveta lateral antiga.

- Abas das seções dos módulos (Financeiro, Carteira, Comercial, Cadastros) em barra de pílulas com ícone e contador (`src/ui/module-tabs.tsx`); contadores de pendência em vermelho, a aba ativa em preto.

**Risco e cobrança**

- Score de qualidade único na escala 0–1000: o número do cadastro, da análise da operação, do painel de Risco e do panorama é o mesmo, calculado pela política de qualidade sobre o histórico do cliente (`src/domain/risk/quality-scores.ts`). A faixa positiva vem das faixas de score dos parâmetros operacionais (crítico < 600, positivo ≥ 700 na demonstração). O score do bureau externo fica num campo próprio (`bureauScore`) e entra no cálculo só como um componente. Política, históricos e scores ficam num contexto único do app (`QualityContext`); a política salva no navegador passou para a chave `strato-quality-policy-v2`.
- `src/domain/risk/`: índice de qualidade explicável (0–100) por cliente, comparando a janela recente com a anterior; motivos em linguagem direta ("atraso médio subiu de 3 para 14 dias") com o impacto em pontos; ação sugerida. Rolagem (roll rate), safras (vintage), concentração com HHI e cobrança do mês.
- Política de qualidade (`quality-policy.ts`) com pesos, valores bom/ruim, janela, variação mínima, tamanho do ranking, patamar saudável, faixas de HHI e parâmetros dos indicadores (PDD por faixa, probabilidades do funil, prazos de revisão cadastral e de limite, faixas de inatividade). Editável na tela (botão de critérios) e guardada no navegador. Valores de demonstração, não referência de mercado.
- Painel: top 10 cedentes e sacados piorando × melhorando com motivos e ação, cobrança do mês contra o anterior, rolagem, safras e HHI na concentração. Indicadores do perfil Risco incluem PDD estimada e cedentes piorando.
- Panorama do cliente: clicar num cliente do top 10 (piorando ou melhorando) abre um painel lateral para apresentação, com resumo em uma frase (quanto caiu, de onde vem a queda, posição frente ao patamar saudável), índice antes → agora, exposição, vencido > 30 dias, uso do limite ou score, "o que moveu o índice" (barras de impacto por componente, antes → agora), evolução do índice em 6 meses com a linha do patamar saudável, componentes mês a mês coloridos pelas faixas bom/ruim da política, carteira por faixa de atraso, títulos em aberto, operações e ação sugerida. Setas ← → passam para o próximo cliente da lista; Esc fecha.
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

- 22 testes novos (88 no total): índice, motivos, rankings, rolagem, safras, HHI, PDD, panorama do cliente e indicadores de cada tela.

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

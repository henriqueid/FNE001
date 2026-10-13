# QProf Help — extração dos manuais e impacto no STRATO

> Checkpoint da extração em 12/10/2026. Fonte: Cadastro de Ajuda autenticado do portal administrativo QProf, e não apenas as telas operacionais.

## Resultado do índice

O Cadastro de Ajuda contém **868 entradas em 29 páginas**. Cada entrada possui código, descrição, pai, função associada e indicação de visibilidade. A hierarquia completa do índice foi percorrida.

| Família raiz | Entradas |
|---|---:|
| Manual funcional Q'Prof | 676 |
| Notas de versão | 136 |
| Documentação | 26 |
| Principais regras do sistema | 20 |
| Padrões de ajuda | 2 |
| Leis e diretrizes | 2 |
| Outros conteúdos técnicos isolados | 6 |

O índice contém conteúdo interno/oculto, inclusive versões 2.34.0 e 2.35.0, enquanto o ambiente operacional observado está na versão 2.33.0.0. Conteúdo oculto ou de versão futura deve ser tratado como referência e confirmado antes de virar requisito.

## Profundidade por módulo funcional

Os 676 itens do manual funcional se distribuem assim:

| Módulo do Help | Entradas | Módulo do Help | Entradas |
|---|---:|---|---:|
| Cadastros Básicos | 152 | Pessoas | 92 |
| Tesouraria | 35 | Principais Dúvidas e Vídeos | 34 |
| Cobrança | 33 | Parâmetros Gerais | 31 |
| Fundo | 30 | Agente de Negócio | 28 |
| Operação | 28 | Controladoria | 25 |
| Cliente | 24 | Relatórios | 23 |
| Governança Corporativa | 22 | Consultas | 21 |
| Securitização | 15 | Confissão de Dívida | 10 |
| Simulação de Operação | 10 | Compras | 9 |
| Help Desk | 9 | Fomento | 6 |
| Pós-Vendas | 5 | IEPTB | 5 |
| Arquivamento | 4 | Qconecta | 4 |
| Integração Bancária | 4 | Assinatura Digital | 2 |
| Documentos Digitais | 2 | Acordo de Cobrança | 2 |
| Operação de Crédito Estruturado | 2 | Portal do Investidor | 2 |
| OData | 2 | Cartão de Crédito | 2 |
| Gestão de Garantias | 2 |  |  |

Foram identificadas inicialmente **194 entradas de alto interesse** por palavras-chave relacionadas a cobrança, banco, boleto, CNAB, remessa, retorno, acordo, protesto, documentos, assinatura, workflow, fundo, cotas, custodiante, PDD, COAF, relatórios, integrações e conciliação.

## Regras centrais encontradas

A família interna **Principais Regras Sistema** possui artigos específicos para:

- consulta e cálculo de PDD;
- baixa automática na Controladoria;
- elegibilidade do acompanhamento de cobrança;
- monitoramento de nota fiscal;
- reciprocidade Serasa;
- baixa parcial;
- recompra;
- relatórios;
- alteração automática de carteira;
- comissões;
- geração de cartas na Controladoria;
- propagação de informações de visitas;
- qualificação do cedente;
- parametrização Serasa na operação;
- telefone do sacado em arquivos CNAB;
- cadastramento e destino das ocorrências;
- simulação e correção de fomento;
- rastreamento de pagamento;
- históricos/códigos operacionais principais.

Esses artigos comprovam que o conhecimento mais valioso do Help está nas condições de inclusão/exclusão, efeitos automáticos e exceções — não nos campos das telas.

## Primeiro aprofundamento: FCO001 — Remessa Bancária

O artigo completo de Remessa Bancária possui aproximadamente 12,7 mil caracteres e descreve um processo muito mais amplo que “gerar CNAB”. As capacidades observadas incluem:

### Seleção e composição da remessa

- banco e valor são filtros obrigatórios;
- título e instrução vêm selecionados por padrão, sendo obrigatório enviar pelo menos um dos dois;
- o valor disponível é distribuído entre os bancos adicionados;
- a geração respeita a carteira configurada para o banco;
- títulos ainda não enviados ou ainda em remessa são candidatos;
- títulos classificados como especiais não entram na remessa;
- inconsistências, como ausência de agência na praça de pagamento, impedem seleção automática.

### Operações estruturadas/CCB

- remessas de CCB são individualizadas por operação, mesmo para o mesmo cedente;
- retorno e aprovação são tratados por operação;
- rejeição de duplicata em CCB pode gerar baixa automática;
- determinadas entradas/baixas de CCB-Duplicata não geram contabilização;
- instruções como prorrogação e abatimento podem ser enviadas sem tarifa ao cedente e sem lançamento contábil, conforme o produto;
- há regras específicas para cálculo de exposição aberta em CCB-NP e CCB-Duplicata.

### Cheques, controle e custódia

- baixa de cheque ao custodiante possui seleção, totalização e geração de arquivo;
- cheques devolvidos são descartados da pendência de baixa;
- a aba de controle acompanha arquivos a enviar/enviados;
- detalhes da remessa mantêm títulos, ocorrências e informações analíticas;
- existe processo de baixa avulsa ao custodiante, separado da remessa do banco cobrador.

### Nosso Número e boletos

- geração de Nosso Número depende de faixa cadastrada por banco/agência/carteira;
- pode gerar somente o número ou número mais boleto em PDF;
- há envio de boleto por e-mail;
- existe geração automática após pagamento da operação quando parametrizada;
- boletos em lote podem ser PDF único ou ZIP com arquivo individual por sacado/número.

### Conectores bancários

O artigo registra implementações para Arbi, Sofisa e Sicoob, além de processo antigo para Deutsche Bank que foi construído, mas não homologado. Isso demonstra a necessidade de distinguir claramente no STRATO os estados:

- projetado;
- em desenvolvimento;
- em homologação;
- homologado;
- ativo em produção;
- suspenso/legado.

Um simples estado “ativo” não é suficiente para integração bancária.

## Outros exemplos de regras extraídas

### Acompanhamento de cobrança

O título só entra no acompanhamento quando atende a condições como estar aberto, pertencer a operação paga e não estar em tipos de cobrança excluídos. Portanto, uma fila de cobrança precisa explicar **por que entrou** e também **por que não entrou**.

### Recompra

Um título marcado como incobrável não aparece na recompra. Apenas alterar sua classificação de recompra não remove o estado de incobrável; é necessário um evento/histórico próprio que reverta essa condição. Isso evidencia a diferença entre:

- classificação;
- estado operacional;
- evento que autoriza a transição.

O STRATO deve modelar essas três dimensões explicitamente, evitando códigos históricos opacos como mecanismo primário.

### PDD

O Help liga a consulta de PDD à parametrização do módulo de Fundo e à posição estática, considerando prazo vencido e regras cadastradas. No STRATO, PDD precisa ter versão de política, data-base, origem da posição e memória do cálculo.

### Baixa automática na Controladoria

O comportamento depende do tipo de ativo e de parametrizações de cartas/entrega. Isso reforça que automação deve ser orientada por política e produzir evidência, em vez de depender de uma marcação isolada na interface.

### Serasa

Há periodicidade de reciprocidade e formas diferentes de tarifar consultas feitas na operação ou disparadas por parâmetros. O STRATO deve separar:

- política de consulta;
- execução da consulta;
- resultado normalizado;
- custo/tarifação;
- validade/recência do dado;
- obrigação de reciprocidade.

### Comissões

As regras consideram o agente ligado ao cedente e o efeito de mudanças do responsável sobre negócios anteriores. O STRATO já possui atribuição temporal (`repAt`) e está bem posicionado; deve preservar a vigência histórica e tornar a regra configurável por política de comissão.

### Ocorrências

O tipo da ocorrência determina em quais áreas ela aparece, como Controladoria e cobrança. Em vez de replicar códigos e telas, o STRATO deve usar eventos tipados com projeções por departamento.

### Rastreamento de pagamento

O processo utiliza base de agência/praça atualizada por retorno bancário. Para o STRATO, isso deve virar enriquecimento versionado e observável, não uma tabela silenciosamente modificada pelo retorno.

## O que o Help acrescenta à análise anterior

1. **Integração é um processo operacional**, não apenas um conector: seleção, validação, arquivo, transmissão, retorno, rejeição, baixa, conciliação e evidência.
2. **Produto financeiro altera contabilização e tarifa**: a mesma instrução tem efeitos diferentes em CCB, duplicata, fomento ou carteira própria.
3. **Estados precisam ser explicáveis**: incobrável, especial, em remessa, rejeitado e baixado modificam filas e ações possíveis.
4. **Configuração exige vigência e escopo**: banco, carteira, veículo, produto, cedente e tipo de ativo mudam a regra.
5. **Históricos são comandos de negócio disfarçados** no legado. No STRATO, devem virar eventos e transições tipadas.
6. **Homologação faz parte do domínio de integração**: construído não significa disponível para produção.
7. **As regras negativas são essenciais**: “não aparece”, “não contabiliza”, “não tarifa”, “não envia” e “não permite” devem ter motivo visível e auditável.

## Capacidades que passam a ser prioritárias no STRATO

### 1. Banking Orchestration

Serviço único para remessa, instrução, retorno, boleto, Nosso Número, baixa, custódia e conciliação, com adaptadores por banco/layout e regras por produto.

### 2. Máquina de estados do título

Estado do título separado de classificação, cobrança, situação bancária, custódia, protesto e contabilidade. Cada transição deve validar pré-condições e registrar evento.

### 3. Motor de políticas com explicação negativa

Além do resultado, registrar regras avaliadas, versão e motivos que excluíram um título de uma fila, remessa, recompra ou relatório.

### 4. Catálogo temporal de configurações bancárias

Banco, agência, carteira, convênio, faixa de Nosso Número, layout, produto aceito, tarifas e vigência, com homologação por ambiente.

### 5. Ledger de arquivos e mensagens externas

Arquivo original, hash, lote, itens, status, rejeições, reprocessamentos e correlação com títulos/operações. O retorno nunca deve atualizar silenciosamente um cadastro sem evento e auditoria.

## Próximas ondas de leitura

1. Cobrança completa: pesquisa, instruções, retorno, preventivo, externa, rastreamento, acordo e IEPTB.
2. Operação, Controladoria e Tesouraria: efeitos cruzados, baixa, contabilização e conciliação.
3. Fundo/Securitização: PDD, curva, cotas, aporte, retirada, amortização e custodiante.
4. Pessoas/Cadastros: KYC, limites, relacionamentos, documentos e qualificações.
5. Integração Bancária, Assinatura, Documentos, Qconecta e portal.
6. Notas de versão relevantes, separando funcionalidade ativa, homologação e conteúdo futuro.

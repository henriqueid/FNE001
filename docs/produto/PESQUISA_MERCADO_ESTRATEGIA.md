# Lastro — pesquisa de mercado e estratégia de produto

Data-base da pesquisa: 25/09/2026

## 1. Conclusão executiva

O Lastro não deve disputar o mercado como mais um ERP com muitos módulos, menus e parâmetros. WBA, OrderBy/NetFactor e Stand já possuem grande cobertura funcional, histórico e integrações. Tentar vencê-los pela quantidade de telas produziria um sistema parecido, mais novo e inicialmente menos completo.

A oportunidade é outra: criar o **sistema operacional da antecipação de recebíveis**, orientado por eventos e exceções. O usuário acompanha a operação inteira numa única área de trabalho; o sistema coleta dados, valida documentos, aplica políticas, calcula condições, monta a formalização, monitora assinaturas, prepara a liberação e concilia o retorno. Pessoas entram somente quando existe divergência, risco, alçada ou decisão comercial.

> Proposta central: **do recebível ao caixa, com o mínimo de intervenção e cada decisão explicável.**

O produto precisa combinar quatro qualidades que hoje aparecem separadas no mercado:

1. profundidade operacional dos ERPs especializados;
2. experiência simples de uma plataforma moderna;
3. automação e conectividade de uma infraestrutura financeira;
4. controle, segurança e rastreabilidade exigidos por uma operação regulada.

## 2. O que o mercado oferece

### WBA

A WBA se apresenta como ERP nacional para FIDC, securitizadora e factoring, com mais de 30 anos, módulos operacionais, cadastro, multiempresa, multicarteira, relatórios e integrações. Atualizações recentes incluem consentimento para SCR, Serasa por API, CCB, notificações de assinaturas pendentes, registradoras, agenda de recebíveis e rastreabilidade.

**Força:** profundidade, aderência ao segmento e grande quantidade de rotinas prontas.

**Espaço para o Lastro:** transformar recursos distribuídos em uma jornada única, com automação visível, menos configuração por operação e gestão por exceção.

Fontes: [WBA](https://wba.com.br/), [atualizações de 2024](https://ajuda.wba.com.br/pt/article/atualizacoes-wba-web-versao-01-11-2024) e [atualizações de 2025](https://ajuda.wba.com.br/pt/article/atualizacoes-wba-web-versao-25-04-2025).

### OrderBy / NetFactor

O NetFactor cobre operação, cobrança, integração bancária, crédito, NF-e e gestão comercial. A documentação pública mostra cadastros e parametrizações extensos, incluindo contratos, tributos, comissões, limites, contas, documentos, bloqueios, garantidores e regras de cobrança. Também oferece visão consolidada do cedente, painel de cobrança e remessa/retorno bancário.

**Força:** amplitude de configuração e domínio das rotinas clássicas.

**Espaço para o Lastro:** cadastro progressivo, preenchimento por fontes externas, política herdada por perfil e uma visão de prontidão que peça apenas o dado necessário para a próxima ação.

Fontes: [OrderBy](https://orderby.com.br/), [cadastro de cedente](https://ajuda.orderby.com.br/cadastro-de-cedente/), [painel do cedente](https://ajuda.orderby.com.br/painel-geral-do-cedente/) e [integração bancária](https://ajuda.orderby.com.br/instrucao-bancaria-do-netfactor/).

### Stand

A Stand oferece ERP em nuvem ou local, integrações com bureaus, registradoras, bancos e assinatura, além de importações por API, XML, CNAB, planilha e digitação. Também cobre CCB, CVM, custódia, debêntures e contabilidade.

**Força:** ecossistema de integrações e suporte a diferentes estruturas financeiras.

**Espaço para o Lastro:** uma camada de orquestração que esconda a complexidade das integrações, monitore a saúde de cada conector e reconcilie automaticamente os eventos.

Fonte: [Stand](https://www.stand.com.br/).

### Plataformas de infraestrutura

FidLink e Glass destacam automação, motor de crédito, registradoras e integração com adquirentes. Celcoin disponibiliza contas, Pix, boletos, Open Finance, extrato e webhooks por APIs. Serasa oferece APIs para KYC, fraude, monitoramento, score e verificação cadastral.

**Leitura estratégica:** esses fornecedores podem ser infraestrutura do Lastro. Eles resolvem partes importantes, mas não substituem uma estação operacional que conecte cadastro, política, risco, formalização, pagamento, carteira e cobrança.

Fontes: [FidLink](https://fidlink.com.br/), [Glass](https://glassgroup.com.br/segmentos/fidic-securitizadoras), [Celcoin BaaS](https://www.celcoin.com.br/cel_banking/banking-as-a-service/) e [APIs Serasa Experian](https://developer.serasaexperian.com.br/api).

## 3. Mudança estrutural do mercado

A Resolução CVM 175 consolidou o marco dos fundos de investimento e mantém regras específicas para FIDC no Anexo Normativo II. Como a norma continua recebendo alterações, regras regulatórias não podem ficar espalhadas no código: precisam de versão, vigência, responsável e histórico.

A Duplicata Escritural cria uma oportunidade ainda maior. Segundo o Banco Central, a infraestrutura entra em autorização em 2026, com operação esperada no fim de 2026 e adoção obrigatória gradual para grandes, médias e pequenas empresas entre 2027 e 2028. A duplicata passa a ter emissão, registro, negociação, gravames e pagamento tratados eletronicamente.

Consequência: o Lastro deve nascer com um **modelo de ativo e eventos**, no qual NF-e, duplicata, registro, cessão, gravame, boleto, Pix, liquidação e baixa são estados relacionados do mesmo recebível. CNAB continua necessário durante a transição, mas não pode ser o centro da arquitetura.

Fontes: [Resolução CVM 175](https://conteudo.cvm.gov.br/legislacao/resolucoes/resol175.html), [interpretações da CVM para FIDC](https://www.gov.br/cvm/pt-br/assuntos/noticias/2024/area-tecnica-da-cvm-divulga-oficio-circular-com-interpretacoes-da-resolucao-cvm-175-para-os-fidc-e-fii), [Duplicatas Escriturais — Banco Central](https://www.bcb.gov.br/estabilidadefinanceira/duplicatas-escriturais) e [Resolução BCB 339](https://www.bcb.gov.br/estabilidadefinanceira/exibenormativo?numero=339&tipo=Resolu%C3%A7%C3%A3o+BCB).

## 4. A tese do produto

### Categoria

**Receivables Operations Platform** — uma plataforma operacional de recebíveis, e não apenas um ERP administrativo.

### Promessa

O Lastro transforma documentos e recebíveis em operações liberadas e monitoradas, com regras configuráveis, evidência de lastro, controle de risco e conciliação automática.

### Cliente inicial

O Lastro deve atender desde a primeira versão comercial **factorings, securitizadoras e FIDCs**, especialmente estruturas de pequeno e médio porte com equipes operacionais de 5 a 30 usuários e alto custo de retrabalho, planilhas e sistemas fragmentados. O mesmo núcleo de cadastro, recebíveis, risco, operação, formalização, liquidação e cobrança será compartilhado, enquanto o tipo de veículo ativa regras, participantes, documentos, tributos, alçadas e controles próprios.

No FIDC, o Lastro deve funcionar como plataforma operacional da gestora, consultoria ou estrutura autorizada, integrando-se ao administrador fiduciário, custodiante, registradora e demais participantes. Ele não deve presumir que substitui funções regulatórias legalmente atribuídas a esses participantes. O escopo exato de responsabilidade será configurável e registrado em cada fundo.

O segmento prioritário para as primeiras entrevistas e implantações ainda precisa ser validado, mas **o modelo de dados e o fluxo não poderão tratar FIDC como adaptação futura**.

### Trabalho que o produto vende

- cadastrar uma empresa uma vez e reutilizar sua identidade em todo o ciclo;
- receber uma operação por portal, API, XML, PDF ou digitação;
- informar imediatamente o que está pronto, o que falta e por quê;
- decidir automaticamente o que estiver dentro da política;
- encaminhar apenas exceções para a pessoa e alçada corretas;
- formalizar, pagar, registrar e conciliar sem redigitação;
- aprender com liquidação, atraso, recusa, fraude, recompra e divergência.

## 5. Experiência que muda o jogo

### 5.1 Central de operações em andamento

É a tela inicial de trabalho. Mostra operações por etapa, responsável, risco, valor, tempo parado, SLA e próximo bloqueio. Ao selecionar uma operação, abre a mesma área de trabalho contínua — sem navegar por módulos separados.

Visões essenciais:

- minhas pendências;
- aguardando cliente, sacado, assinatura ou integração;
- prontas para aprovação ou liberação;
- exceções críticas;
- todas as operações, com filtros salvos e ações em lote.

### 5.2 Área de trabalho única da operação

O fluxo mantém seis macroetapas, mas não se comporta como um assistente rígido. Cada etapa é um bloco recolhível na mesma tela:

1. Entrada e pré-validação;
2. Risco e elegibilidade;
3. Lastro e confirmação;
4. Preço e estrutura;
5. Aprovação e formalização;
6. Registro, pagamento e conciliação.

O sistema avança sozinho quando todas as regras são satisfeitas. O usuário pode abrir qualquer bloco já concluído, mas alterações relevantes invalidam de forma explícita as aprovações dependentes.

### 5.3 Gestão por exceção

Cada pendência precisa responder quatro perguntas:

- o que aconteceu?
- por que bloqueia ou alerta?
- o que o sistema recomenda?
- quem pode resolver e até quando?

Alertas genéricos são proibidos. Uma crítica deve apontar o título, a regra, o valor observado, o limite aplicável, a evidência e a ação possível.

### 5.4 Cadastro progressivo e operacional

O cadastro deixa de ser um formulário enorme e passa a ser um grafo de relacionamento:

- empresa, pessoas, beneficiários finais e grupo econômico;
- sócios, administradores, procuradores, signatários e garantidores;
- contatos por responsabilidade;
- contas favorecidas, titularidade, origem da validação e limites;
- documentos, consentimentos e evidências, com validade;
- contratos, produtos permitidos, política e alçadas;
- histórico de mudanças e vínculo com operações.

O painel de prontidão mostra o mínimo necessário para cadastrar, simular, operar e liberar. Dados adicionais são pedidos somente quando uma regra ou modalidade os exige.

### 5.5 Explicabilidade

Toda decisão automática tem um botão **Entenda a decisão**, que exibe:

- versão da política;
- dados e evidências usados;
- regras aprovadas, alertadas e bloqueadas;
- cálculo reproduzível;+
- quem alterou ou aprovou uma exceção;
- impacto da mudança.

## 6. Automação sem perder controle

Cada empresa escolhe o nível de automação por processo e alçada:

| Nível | Comportamento |
|---|---|
| Assistido | O sistema organiza e recomenda; uma pessoa executa. |
| Supervisionado | O sistema executa e pede confirmação nas etapas definidas. |
| Automático por limite | Executa sozinho quando todas as regras, valores e confiança estão dentro da política. |
| Exceção | Interrompe, explica e direciona somente quando algo foge da política. |

A inteligência artificial deve extrair documentos, resumir dossiês, identificar inconsistências e apoiar investigações. Ela **não substitui o motor determinístico de política**, nem aprova crédito sem regras, evidências e alçada claramente definidas.

## 7. Núcleo funcional recomendado

### 7.1 Grafo de identidade

Uma fonte única para cedente, sacado, grupo econômico, pessoas relacionadas, signatários, garantidores, contas, contatos, consentimentos e documentos.

### 7.2 Grafo do ativo

Relaciona pedido, nota fiscal, CT-e, duplicata, contrato, título, registro, cessão, gravame, cobrança, pagamento e baixa. Isso evita tratar cada integração como um cadastro isolado.

### 7.3 Motor de políticas versionado

Elegibilidade, concentração, limite, preço, alçada, PLD, lastro e liberação devem ser regras com vigência. Cada decisão conserva a versão usada. Um laboratório permite testar uma política nova contra a carteira histórica antes de publicá-la.

### 7.4 Orquestrador de fluxo

Máquina de estados, tarefas, responsáveis, prazos, dependências e compensações. Integrações assíncronas usam eventos, idempotência, repetição segura e fila de falhas.

### 7.5 Livro de eventos

Uma linha do tempo imutável registra entradas, decisões, alterações, assinaturas, registros, pagamentos e conciliações. O estado atual pode ser reconstruído e auditado.

### 7.6 Hub de integrações

Adaptadores independentes para:

- Receita, bureaus, antifraude e PLD;
- SEFAZ, NF-e, NFS-e e CT-e;
- registradoras de recebíveis e Duplicata Escritural;
- bancos, BaaS, Pix, boleto, CNAB e Open Finance;
- assinatura eletrônica;
- contabilidade, custódia, administrador e sistemas do cliente.

Uma central de integrações informa disponibilidade, latência, última sincronização, erro, fila e reconciliação. A operação não pode ficar silenciosamente inconsistente.

### 7.7 Copiloto operacional

O copiloto trabalha somente sobre dados autorizados e rastreáveis. Casos de uso iniciais:

- leitura e classificação de documentos;
- resumo do dossiê e das mudanças desde a última análise;
- explicação em linguagem simples das críticas do motor;
- sugestão da próxima ação;
- detecção de anomalias e relacionamentos incomuns;
- rascunho de contato com cliente ou sacado.

## 8. Segurança como característica comercial

O produto precisa oferecer desde a primeira versão real:

- isolamento entre empresas e carteiras;
- autenticação forte, MFA e sessões controladas;
- perfis e atributos, com menor privilégio;
- segregação de funções e maker-checker para dados sensíveis e pagamentos;
- criptografia em trânsito e repouso, gestão segura de segredos;
- trilha imutável de acesso, alteração e decisão;
- webhooks assinados, idempotência e proteção contra repetição;
- reconciliação financeira e operacional contínua;
- mascaramento e retenção de dados conforme finalidade;
- plano de continuidade, backups testados e observabilidade;
- gestão de incidentes e exportação de evidências de auditoria.

A LGPD deve estar embutida no modelo: finalidade, base legal, consentimentos quando aplicáveis, minimização, retenção, atendimento ao titular e registro dos operadores. A ANPD mantém guias oficiais sobre agentes de tratamento e segurança da informação: [materiais da ANPD](https://www.gov.br/anpd/pt-br/centrais-de-conteudo/materiais-educativos-e-publicacoes).

## 9. O que aproveitar e o que evitar

### Aproveitar

- cobertura de regras, documentos e modalidades dos sistemas maduros;
- robustez de CNAB, cobrança, contabilidade e carteira;
- multiempresa, multicarteira, alçadas e segregação de funções;
- integrações especializadas já disponíveis no ecossistema;
- indicadores de concentração, liquidez, atraso e exposição;
- exigência de evidência, crítica e auditoria em cada fase.

### Evitar

- reproduzir menus, nomes, telas, sequência ou regras proprietárias de concorrentes;
- cadastro monolítico antes de o cliente conseguir testar o produto;
- status mantido manualmente em vários módulos;
- a mesma informação digitada por operação, cadastro e contrato;
- alertas sem causa e ação;
- automação opaca que apenas troca trabalho operacional por risco;
- dependência estrutural de um único banco, bureau, registradora ou assinatura;
- IA como substituta de política, crédito ou responsabilidade humana.

## 10. Roadmap recomendado

### Fase 0 — descoberta dirigida

Entrevistar e observar 10 a 15 empresas. Medir o fluxo real, não apenas opiniões: tempo, intervenções, redigitação, falhas, planilhas, sistemas e responsáveis. Selecionar três parceiros de desenho, sem prometer customização individual.

### Fase 1 — cunha operacional

Entregar o ciclo completo de duplicata mercantil para factoring, securitizadora e FIDC:

- onboarding e KYB do cedente;
- cadastro do veículo, fundo, classe e subclasse quando aplicável;
- participantes e responsabilidades: gestora, consultoria, administrador, custodiante e registradora;
- regulamento e política de investimento versionados;
- portal de envio;
- entrada por XML/API/planilha;
- pré-validação e duplicidade;
- política de elegibilidade, limites, concentração e critérios do regulamento;
- checagem e evidências;
- preço, alçada e aprovação;
- documentos e assinatura;
- ordem de pagamento e trilha de auditoria;
- pacote de cessão, evidências e integração com os participantes do FIDC;
- central de operações e exceções.

Objetivo: colocar uma operação válida do arquivo à liberação em minutos, com poucas intervenções.

### Fase 2 — fechar o ciclo do dinheiro

- API bancária, Pix, boleto e CNAB real por parceiros prioritários;
- retorno e conciliação;
- conta gráfica, retenções e recompra;
- cobrança, protesto e acordos;
- eventos contábeis e exportação;
- portal do cedente e comprovantes.

### Fase 3 — aprofundamento do ativo e da escala regulada

- Duplicata Escritural e registradoras;
- multiempresa, multicarteira e cessões;
- integrações de custódia e administração;
- cobertura avançada de FIDC: múltiplas classes, regulamentos complexos, prestação de informações, conciliação com custodiante e administrador e pacotes regulatórios;
- Open Finance e monitoramento contínuo.

### Fase 4 — inteligência de rede

- laboratório e simulação de políticas;
- análise de safras e previsão de liquidez;
- detecção de fraude e relacionamento;
- benchmarking anonimizado e autorizado;
- copiloto avançado com avaliação de qualidade e governança.

## 11. Métricas que provam valor

O produto deve acompanhar automaticamente:

- tempo entre entrada e liberação;
- intervenções humanas por operação;
- percentual processado sem toque;
- retrabalho e operações devolvidas;
- tempo parado por responsável ou integração;
- divergências e duplicidades identificadas antes da compra;
- percentual conciliado automaticamente;
- prazo entre pagamento e baixa;
- custo operacional por operação e por título;
- atraso, recompra, perda e recuperação por política vigente;
- disponibilidade e taxa de erro de cada integração.

A métrica norteadora é: **percentual de operações liberadas dentro da política, sem retrabalho e com trilha completa**.

## 12. Modelo comercial inicial

Cobrança recomendada:

- assinatura da plataforma por faixa de uso;
- volume de operações, títulos ou eventos processados;
- conectores e serviços de terceiros repassados de forma transparente;
- implantação e migração separadas quando houver trabalho relevante.

Evitar vender uma coleção de módulos e cobrar por cada tela. O cliente deve comprar uma operação mais rápida, segura e controlada. Planos podem diferenciar volume, automação, integrações, ambientes, SLA e governança.

## 13. Hipóteses que ainda precisam de validação

1. Qual é o primeiro perfil com maior urgência e menor barreira de troca?
2. Qual integração é decisiva para a primeira venda?
3. Quantas intervenções e quanto tempo uma operação consome hoje?
4. Qual limite de valor o cliente aceita automatizar?
5. Quais decisões exigem dupla aprovação?
6. O portal do cedente substitui e-mail e WhatsApp de fato?
7. Qual modalidade representa pelo menos 70% do volume inicial?
8. Migração histórica é obrigatória ou basta carteira aberta e saldos?
9. Que evidência cada auditor, custodiante e administrador exige?
10. Como os clientes estão se preparando para Duplicata Escritural?

## 14. Decisão de produto

O protótipo atual deve evoluir nessa ordem:

1. tornar a Central de Operações a porta de entrada principal;
2. transformar cada operação em uma única área de trabalho por blocos;
3. adotar pendências explicáveis, responsável e SLA;
4. reconstruir cadastro como prontidão progressiva e grafo de relações;
5. documentar o motor de políticas versionado;
6. desenhar o modelo de ativo preparado para Duplicata Escritural;
7. só então ampliar módulos periféricos.

Esse caminho preserva o conhecimento operacional já reunido, mas muda a categoria do produto: de um ERP reorganizado para uma plataforma que orquestra a operação inteira.

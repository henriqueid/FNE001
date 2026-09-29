# Lastro: contexto completo para continuar o desenvolvimento

Versão: MVP v0.1 + protótipo funcional v5 · 25/09/2026 · Autor do produto: Henrique

## 1. Origem e decisões

1. **A ideia** surgiu numa conversa com um amigo do setor. Faltava no mercado uma ferramenta de controle e checagem de carteira, com relatórios de liquidez e aprovação automática de operações.
2. **Primeiro formato:** um sistema complementar a um ERP de fomento existente, integrado por planilha ou API.
3. **Formato atual:** um **produto independente** para pequenas e médias empresas do segmento, construído **só com conhecimento de mercado**.
   - Não se usa código, regra nem estrutura de sistemas de terceiros, especialmente o Q'Prof, da Quick Soft.
   - Antes de comercializar, é preciso revisar com um advogado o contrato de trabalho do Henrique (confidencialidade, não concorrência e propriedade intelectual).
4. **Formato do MVP escolhido:** protótipo funcional navegável, com o fluxo principal de ponta a ponta. É feito para validar com o amigo e com clientes antes de investir num código de produção.
5. **O diferencial do produto é o ciclo fechado.** O que a checagem, a cobrança e a controladoria descobrem volta para o score, o limite e a aprovação da próxima operação.
6. **Diretriz central de experiência:** o Lastro deve ser semiautomático. O sistema busca, cruza, valida, calcula e prepara a decisão; o usuário atua nas exceções, nas aprovações e nos casos em que existe julgamento real. Não reproduzir a sequência de telas dos ERPs atuais.
7. **Direção estratégica de mercado:** o Lastro será uma plataforma operacional de recebíveis orientada por eventos e exceções, e não uma coleção de módulos. A análise de concorrentes, arquitetura-alvo, segurança, diferenciais e roadmap estão em [PESQUISA_MERCADO_ESTRATEGIA.md](./PESQUISA_MERCADO_ESTRATEGIA.md).
8. **Direção visual:** aparência corporativa e institucional, com azul-marinho, azul aço, branco e cinzas frios. Verde, âmbar e vermelho ficam reservados para estados semânticos. Tipografia sans-serif nítida, textos operacionais legíveis e alta densidade sem fontes minúsculas.

## 2. Público e tipos de empresa

O sistema atende factorings (fomento mercantil), securitizadoras, FIDCs (pelo lado da gestora, consultoria ou estrutura operacional autorizada) e ESCs, todas de pequeno e médio porte, com 2 a 50 usuários. **FIDC faz parte do núcleo desde a primeira versão comercial**, não de uma adaptação futura. O sistema deve modelar fundo, classe/subclasse, regulamento, participantes e responsabilidades, integrando-se ao administrador fiduciário, custodiante e registradora sem presumir que substitui atribuições regulatórias desses participantes.

O tipo de empresa **trava** os tributos e o padrão da operação. É uma configuração com cadeado:

| Regra | Factoring | Securitizadora | FIDC | ESC |
|---|---|---|---|---|
| IOF na operação | Sim: 0,0041% ao dia (PJ) + 0,38%, até 365 dias, sobre o líquido | Não incide | Alíquota zero na carteira (0,38% na aquisição primária de cotas, do lado do cotista) | Sim |
| PIS/COFINS | Não cumulativo (9,25%) | Cumulativo (4,65%) | O fundo não recolhe | Conforme o regime |
| IRPJ/CSLL | Lucro real obrigatório | Lucro real obrigatório | O fundo não recolhe | Real ou presumido |
| Ad valorem | Sim (ISS; retenções de IRRF 1,5%, CSLL 1%, COFINS 3% e PIS 0,65% sobre serviços, nunca sobre o deságio) | Não | Não | Não |
| Padrão | Deságio + ad valorem; cedente PJ | Lastro por emissão ou série | Elegibilidade e concentração do regulamento (máximo de 20% no protótipo) | Só atende MEI, ME ou EPP, com limite pelo capital |

Os números acima são **padrões iniciais que precisam ser validados com o contador**. Fontes: Tributo Devido, Decisão Sistemas, HS Invest (jun/2025), Capital Aberto e VRi Consulting.

## 3. Módulos (visão completa do produto)

1. **Cadastro e KYC:** cedente e sacado, preenchimento automático pelo CNPJ, quadro societário, documentos com vencimento, PLD.
2. **Crédito e limites:** por cedente, por sacado, por grupo e por concentração; comitê e alçadas.
3. **Operação e borderô:** detalhes na seção 5.
4. **Checagem e lastro:** SEFAZ, manifestação do destinatário, CT-e ou canhoto, confirmação com o sacado, amostragem, dispensa.
5. **Formalização:** termo de cessão, aditivo, notificação ao sacado, assinatura eletrônica.
6. **Motor de decisão:** gatilhos, faixas (verde, amarela, laranja, vermelha) e alçadas.
7. **Financeiro, tesouraria e contabilidade:** conta gráfica, retenções, escrow, fluxo de caixa, conciliação por OFX ou API, tributos, eventos contábeis e exportação.
8. **Gestão de títulos e cobrança:** fluxo de títulos, remessa e retorno CNAB 240/400, régua de cobrança, protesto, acordos.
9. **Recompra e jurídico.**
10. **Risco e controladoria:** monitoramento, liquidez, provisão para perdas, auditoria de lastro.
11. **Painel do cliente (cedente) e portal do sacado:** subir operações, ver carteira, extrato e relatórios.
12. **Gestão, BI e liquidez.**

Modalidades a cobrir: convencional com ou sem regresso, trustee, comissária, fomento à produção, empréstimo (ESC), cessão a FIDC e **escrow** (conta vinculada com cascata e índice de cobertura).

Recebíveis a cobrir: duplicata mercantil e de serviço, **cheque**, CCB e contratos, cartão.

## 4. O que o protótipo já faz (v5)

### Fundação do MVP v0.1

- A página inicial deixou de redirecionar para o protótipo monolítico e passou a carregar a nova aplicação React.
- A **Central de Operações** é a porta de entrada, com volume em processamento, prontas para liberar, exceções, automação média, distribuição por etapa, SLA, responsável e próxima ação.
- Filtros funcionais por escopo, busca e tipo de instituição: FIDC, securitizadora e factoring.
- A Central separa o trabalho em duas filas claras: **Intervenção necessária** (bloqueios, decisões ou ritmo fora do padrão histórico) e **Prontas para formalização** (processamento automático concluído e dentro da política). Evitar os rótulos genéricos “Minhas” e “Exceções”.
- O tempo operacional não usa SLA fixo. O sistema calcula um **padrão histórico por cliente**, informa a média e o tamanho da amostra e classifica a operação como mais rápida, dentro do padrão, mais lenta ou ainda aprendendo. Operações significativamente mais lentas entram automaticamente na fila de intervenção.
- Cada operação abre no mesmo **workspace contínuo**, com as seis etapas, resumo financeiro, política, veículo, participantes, próxima ação e atividade recente.
- A operação FIDC demonstra classe/subclasse, gestora, administrador fiduciário e custodiante.
- A exceção de concentração explica a regra, compara observado e permitido e oferece ajuste recomendado.
- O fluxo já é testável: bloqueios impedem avanço; aplicar a recomendação recalcula valor, quantidade, alertas e automação; concluir a etapa atualiza a Central; o estado persiste no navegador. Há uma ação para restaurar os dados de demonstração.
- O modal **Nova operação** inicia estruturas de FIDC, securitizadora ou factoring e carrega o veículo correspondente.
- O protótipo funcional anterior continua preservado em `/lastro.html` enquanto as rotinas são migradas para a nova fundação.

## 4.1 O que o protótipo funcional anterior faz (v5)

### Painel

- Indicadores: carteira em aberto, vencidos, caixa e capacidade de compra.
- Alertas de atenção.
- Gatilhos da carteira com um botão para executar: recompra automática no fim do regresso, protesto automático e lastro pendente.

### Nova operação: 6 etapas contínuas

Cada etapa só abre quando a anterior está concluída. Os botões Voltar e Continuar ficam fixos no rodapé, e o resumo fica sempre visível na lateral.

1. **Entrada**
   - Uma faixa mostra os dados do cedente: limite disponível, taxa, vencidos, contrato-mãe e documentos.
   - Modalidades: duplicata mercantil, duplicata de serviço ou cheque.
   - Formas de entrada:
     - **Importar XML:** lote de exemplo.
     - **Digitar títulos:** para pedidos. Tem parcelas a cada 30 dias e chave de acesso opcional; sem a chave, o título entra com alerta e checagem obrigatória. Um sacado novo pode ser cadastrado pelo CNPJ, com limite zero.
     - **Importar PDF da DANFE:** o pdf.js lê o texto e o sistema extrai NF, chave, CFOP, emissão, CNPJ do destinatário e duplicatas. Há uma tabela de conferência antes de incluir.
     - **Digitar cheques:** pelo CMC7, validado por mod10 nos 3 dígitos verificadores, com extração de banco, agência, conta e número.
     - **Importar PDF com CMC7:** acha as linhas CMC7 e extrai valor, bom para e emitente.
   - **Pré-checagem de duplicata:** NF autorizada ou cancelada na SEFAZ (simulado), manifestação do destinatário, CFOP de venda (5910/5949 não servem de lastro), emitente igual ao cedente, CT-e, duplicidade, idade da NF.
   - **Pré-checagem de cheque:** CMC7, consulta de devolução (simulada), duplicidade, custódia física, bom para acima de 180 dias.
2. **Análise**
   - Tabela de elegibilidade: título, sacado, resultado com motivos, status de checagem e botão **"Mudar decisão"** na própria linha (elegível, inelegível ou automático, com motivo obrigatório).
   - Cards de sacado recolhíveis (os que têm alerta ficam abertos), com a comparação entre o cadastro da base e o do XML (atualizar ou manter).
   - Tela **"Carteira do sacado"**: exposição, limite, vencidos, histórico, concentração por cedente, títulos na base, pré-análise automática e decisão manual para o sacado inteiro ou título a título.
   - **Travas que não podem ser liberadas:** NF cancelada, duplicidade, operação não realizada, CMC7 inválido, emitente diferente do cedente, CNPJ irregular.
3. **Checagem**
   - Os títulos a checar são definidos pelos gatilhos (sacado novo, valor alto, sem manifestação, NF antiga, amostragem).
   - **Dispensa pela política:** NF confirmada na SEFAZ, sacado bom pagador (50 ou mais pagos, menos de 5% de atraso, sem recusas) ou valor abaixo de R$ 3.000. Cheques também são dispensados.
   - Registro de um clique por linha: Confirmou, Divergência, Recusou, Sem contato, Dispensar (motivo obrigatório).
   - Em "Detalhes": canal, contato, as 4 perguntas e a mensagem pronta para WhatsApp ou e-mail.
   - Botão para marcar todos os pendentes como confirmados.
   - Uma recusa exclui o título e, ao efetivar, bloqueia o sacado em toda a base.
4. **Preço e condições**
   - Método de deságio simples ou composto; taxa; rateio de tarifas por valor ou por valor × prazo; exibição all-in.
   - Tabela de cálculo título a título.
   - Tarifas por título, por operação e esporádicas.
   - Regresso (com ou sem, prazo D+N) e coobrigação.
5. **Aprovação**
   - A decisão do motor aparece com a tabela de gatilhos avaliados.
   - A aprovação de analista ou gerente é invalidada se títulos, taxa, tarifas ou regresso mudarem depois dela (assinatura de conteúdo `sigOf`).
6. **Formalização e liberação**
   1. Documentos (termo de cessão, aditivo, notificação, demonstrativo) e signatários vindos automaticamente do cadastro, com regra de assinatura, vigência, envio e simulação de assinatura. A assinatura também é invalidada por mudanças posteriores.
   2. Retenções, aplicadas por prioridade: recompra de vencidos, tarifas em aberto, pendência de lastro, garantia em % e retenção manual com motivo.
   3. Liberação: data, Pix ou TED e conta favorecida previamente validada. Conta de terceiro é exceção e exige alçada.
   4. Efetivar, que gera títulos, retenções, conta gráfica, movimento bancário, IOF e lançamento contábil.

### Títulos

- Fluxo de títulos com filtros, ficha e linha do tempo: compra, checagem, decisão manual, assinatura, instruções ao banco, liquidação.
- Ações: prorrogar (com tarifa), protestar, recompra.
- Aba "Lançamentos do fluxo", com os lançamentos de compra, retenção, uso de retenção, liberação, liquidação, recompra, diferença e tarifa.

### Cobrança e CNAB

- Remessa com validação antes de gerar (CEP, CNPJ, vencimento) e instruções 01, 02, 06 e 09.
- **O leiaute é ilustrativo**, parecido com o CNAB 400; cada banco real precisa de configuração própria.
- Simulação do banco, que gera o retorno.
- Importação do retorno com ocorrências 02, 03, 06, 09, 14 e 23, baixa automática, pagamento a menor debitado na conta gráfica e bloqueio de importar o mesmo arquivo duas vezes (por hash).
- Cheques ficam em "Custódia" e não vão para o CNAB.

### Financeiro

- Conta gráfica por cliente.
- **Retenções:** usar para quitar a conta gráfica, recomprar um título vencido, marcar o lastro como regularizado, liberar ao cliente. O gatilho de liberação da garantia é a liquidação de todos os títulos da operação.
- **Fluxo de caixa de 30 dias:** gráfico em SVG, cenários conservador, base e otimista (curva de liquidez), saldo mínimo e capacidade de compra.
- **Conciliação:**
  - importação de **OFX** (arquivo ou colado, com deduplicação pelo FITID e comparação com o saldo informado no LEDGERBAL);
  - conciliação automática (valor, data ±2 dias, sentido);
  - "crédito a identificar": o Pix que o sacado pagou fora do boleto baixa o título;
  - débito lançado como despesa bancária.

### Contábil

- Lançamentos automáticos por evento, balancete no plano modelo e conferências automáticas entre contabilidade e operação (títulos, bancos, conta gráfica, retenções).
- Fechamento do período só com tudo conferido.
- Exportação em CSV (;) ou TXT posicional, controlando o que já foi exportado.

### Cadastros

- Cedente e sacado com **busca pelo CNPJ**: valida os dígitos verificadores e preenche pela base de teste que simula a Receita. Os CNPJs de teste aparecem no formulário, incluindo uma empresa baixada e uma aberta há 3 meses.
- Alertas: situação diferente de ativa (bloqueia o cadastro), empresa com menos de 12 meses, sócio em comum entre cedente e sacado (pelo quadro societário), porte fora do permitido para ESC, documentos pendentes.
- O cedente tem limite, taxa, contrato-mãe e vigência, conta de liberação e documentos. O sacado tem limite, consulta de score (simulada) e contato para checagem.
- O cadastro do cedente mede a prontidão operacional e mostra o que falta para operar.
- **Contas favorecidas:** múltiplas contas, indicação da principal, titular, CPF/CNPJ, banco, agência, conta, Pix, tipo de conta e validação. Somente contas validadas aparecem na liberação.
- **Quadro de assinantes:** importação a partir do quadro societário, CPF, cargo, contato, regra de assinatura, validade e situação. Os signatários alimentam automaticamente a formalização.
- **Contatos por área:** Operações, Financeiro, Cobrança, Jurídico e Contabilidade, para direcionar pendências e comprovantes sem redigitação.

### Configuração

- Tipo de empresa, com as regras fixas mostradas com cadeado.
- Checklist de itens obrigatórios, que bloqueia a efetivação.
- Empresa e bancos; preço, tarifas e caixa; elegibilidade padrão.
- **17 gatilhos**, cada um com liga/desliga e parâmetro:
  - operação: valor, limite, vencidos do cliente, liberação manual;
  - checagem: obrigatoriedades, amostragem, dispensas, sem contato, bloqueio por recusa, dispensa manual;
  - carteira: recompra automática, protesto, lastro.

## 5. Regras de negócio implementadas (referência)

- **Dias de cálculo:** `n = max(vencimento − hoje + float, prazo mínimo)`. O padrão é float D+1 e prazo mínimo de 5 dias.
- **Deságio simples:** `VF × i × n/30`. **Deságio composto:** `VF × [1 − (1+i)^(−n/30)]`.
- **IOF (factoring e ESC):** `(VF − deságio) × (0,000041 × min(n,365) + 0,0038)`.
- **Taxa efetiva:** TIR mensal calculada por bisseção entre o líquido antes das retenções e os vencimentos (`VL = Σ VFk/(1+i)^(nk/30)`).
- **Taxa all-in por título:** `(VF/líquido)^(30/n) − 1`, com as tarifas fixas rateadas.
- **Faixas do motor:**
  - vermelha: há um gatilho do tipo bloqueio (checagem pendente, vencidos antigos sem retenção de recompra);
  - laranja: há um gatilho crítico (valor acima do teto, limite acima de 90%, liberação manual, dispensa manual de checagem obrigatória, checagem sem contato, liberação maior que o caixa);
  - amarela: há um título com ressalva;
  - verde: nenhum dos anteriores.
- **Capacidade de caixa:** o menor saldo projetado em 7 dias (cenário base), menos o saldo mínimo.
- **Contabilização da compra:**
  - débito: títulos adquiridos (valor de face);
  - crédito: bancos (líquido), receita de deságio, receita de ad valorem, IOF a recolher, receita de tarifas, retenções de clientes; e, quando a retenção já quita algo na hora, títulos (recompra) e conta gráfica (tarifas).

## 6. Limitações conhecidas

- Os dados ficam só no navegador (`localStorage`). Não há usuário, perfil, trilha de auditoria real nem multiusuário.
- São simulados: Receita, SEFAZ, bureau, consulta de cheques, banco (retorno), assinatura eletrônica, registradora.
- O leiaute CNAB não segue nenhum banco real. O plano de contas é ilustrativo. Os tributos precisam de validação.
- A leitura de PDF só funciona com PDF que tem texto (sem OCR), e o leiaute de DANFE varia.
- Ainda não existem: portal do cedente e do sacado, escrow operacional, modalidades trustee, comissária e fomento, cessão a FIDC, régua de cobrança por WhatsApp, provisão para perdas, NFS-e, guia de IOF, relatórios de liquidez por safra, comitê de crédito, PLD/COAF.
- A tela de preço e condições ainda está pesada, com uma tabela larga.

## 7. Backlog priorizado

**A. Refinar o protótipo, para validar com clientes**

1. Simplificar a UX da etapa de preço: um simulador com o resultado em destaque e a tabela recolhida.
2. Painel do cedente: subir operação, ver carteira, extrato, recompra e relatórios.
3. Régua de cobrança com modelos de mensagem, e protesto e negativação.
4. Relatórios de liquidez por cedente, sacado e safra.
5. Escrow: conta vinculada, cascata e índice de cobertura.

**B. Passar para aplicação real**

1. Arquitetura sugerida:
   - backend com API REST;
   - banco relacional (PostgreSQL);
   - frontend web (React ou Vue);
   - fila para eventos, porque o ciclo fechado depende de eventos;
   - autenticação com perfis e alçadas;
   - trilha de auditoria.
2. Modelo de dados central:
   - pessoa, cedente e sacado;
   - operação e título;
   - evento do título;
   - retenção, com usos;
   - conta gráfica;
   - movimento bancário e linha de extrato;
   - lançamento contábil;
   - gatilho e configuração com vigência.
3. Integrações reais:
   - consulta de CNPJ (API pública ou paga);
   - SEFAZ (distribuição de NF-e e manifestação);
   - bancos (CNAB por banco, API de cobrança, Pix);
   - Open Finance ou OFX;
   - assinatura eletrônica;
   - bureaus;
   - registradoras.
4. LGPD: base legal, controle de acesso e retenção de dados.
5. Validar os tributos com o contador e o jurídico com um advogado.

**C. Validação de mercado (em paralelo)**

Perguntas para 5 a 10 factorings e securitizadoras pequenas:

- Quais três tarefas mais consomem tempo?
- Quantas operações fazem por mês, e com quantos usuários?
- Quanto pagam hoje?
- O cedente usaria um portal?
- Quais modalidades são obrigatórias já no MVP?
- Aceitariam aprovação automática? Até que valor?

## 8. Histórico de feedback do usuário (o que ele pediu e já foi atendido)

- Módulos de gestão de títulos, CNAB, financeiro e contábil completos, fáceis de usar e conectados.
- Fluxo de caixa e conciliação bancária. Importação de OFX.
- Configuração por tipo de empresa, com tributos travados e itens obrigatórios.
- Retenções na operação, lançadas no fluxo de títulos.
- Tela de checagem na operação. Checagem dispensável pela política ou manualmente com motivo.
- Operação mais completa: análise de sacados (endereço, comparação de cadastro, documentos), elegibilidade título a título, tarifas incluindo esporádicas, métodos de cálculo padrão e com valor agregado, pré-checagem, regresso, resumo fixo.
- Fluxo contínuo e lógico: dados de liberação só no fim.
- Análise manual da carteira do sacado, com liberação ou exclusão e motivo.
- Digitação manual de pedido e importação de PDF, para duplicatas e cheques.
- Cadastro com importação automática pelo CNPJ.
- **Pendência atual:** o usuário acha a UX ruim e quer tudo mais fácil. A v5 simplificou checagem, análise, entrada e resumo. Continue nessa direção: menos texto, ações de um clique, detalhes recolhidos.
- **Diretriz multiempresa:** FIDC, securitizadora e factoring são naturezas das empresas cadastradas, não tipos escolhidos ao abrir uma operação. A central deve permitir visão consolidada ou filtrada por empresa/veículo.
- **Entrada de nova operação:** começa pela origem/formato do negócio (XML NF-e, CNAB, planilha, digitação manual ou crédito estruturado/CCB). O sistema identifica ou solicita o tipo do recebível; a empresa/veículo é escolhida apenas como destino da operação.
- **Identificação operacional:** cada operação gera um aditivo no padrão `AAAAMMDDSSS`, com sequência diária iniciada em `001`, e um borderô vinculado com sequência geral contínua. Ambos aparecem na central, no workspace e participam da busca global da operação.
- **Busca operacional:** a central pesquisa todos os campos da operação e oferece filtros por etapa, status e origem, além do recorte consolidado ou por empresa/veículo.
- **Cancelamento:** qualquer etapa pode cancelar a operação, sempre com categoria e motivo detalhado. O registro preserva aditivo, borderô, etapa, usuário, horário e uma assinatura dos dados/títulos para reconhecimento em futuras reimportações. Operações encerradas não compõem os indicadores ativos e permanecem consultáveis na fila “Canceladas”.
- **Digitação manual:** o modal de nova operação não solicita o tipo do recebível. A escolha ocorre na etapa de entrada e vale para toda a operação; cheques nunca podem ser misturados com duplicatas, notas ou pedidos. Para papel, o usuário pode informar o valor total e gerar parcelas mensais ou digitar título por título, com atalho para copiar a linha anterior. Após salvar títulos, o tipo fica bloqueado.
- **Sacado na digitação:** todo título manual exige sacado. A busca aceita CPF/CNPJ e consulta primeiro o cadastro do sistema; quando encontra, preenche identificação e endereço. Quando não encontra, oferece cadastro rápido na própria operação. Identificação e endereço são sempre obrigatórios; e-mail e telefone podem ser marcados como obrigatórios pela política. Sacados novos ficam disponíveis para buscas futuras.
- **Leiaute compacto da digitação:** a etapa usa exatamente as abas Duplicatas, Cheques, Promissórias, Transferibilidade e Garantia. O sacado fica na primeira linha, com documento formatado, busca discreta, nome/documento encontrados ao lado e um botão compacto para novo cadastro. Valores monetários, CPF/CNPJ, CEP, telefone, dados bancários, CMC7 e chave NF-e recebem formatação ou restrição automática conforme o campo. Duplicatas incluem face, desconto, emissão, vencimento, documento, nosso número, chave NF-e, CFOP e observação; cheques incluem CMC7, banco, agência, conta, compensação, número, valor, emissão, bom para e praça. O cadastro completo do sacado só expande quando necessário.
- **Editor recolhível e grade completa:** o formulário de digitação pode ser aberto ou fechado sem perder o rascunho. Fechado, mantém apenas a carteira digitada; ao editar uma linha, reabre no topo com sacado e todos os campos preenchidos. A grade compacta apresenta documento, sacado/CPF-CNPJ, valor, desconto, datas, nosso número, NF-e/CFOP, observação e ações; para cheques, troca as colunas pelos dados bancários, CMC7, praça e bom para.
- **Etapas sem duplicação e dirigidas pela entrada:** existe uma única navegação superior, distinguindo concluída, atual e etapa consultada. A lista repetida de etapas foi removida. Risco calcula concentração, sacados e prazo dos títulos; lastro mede a cobertura de evidências; preço usa face, descontos e prazo; aprovação consolida os requisitos; liquidação projeta ativos e valor. Etapas com pendência calculada não avançam.
- **Automação assistida explicável:** o percentual não representa avanço da esteira. Para digitação manual, ele soma dados essenciais (30 pontos), sacados identificados (20), evidências (20), consistência/duplicidade (15) e origem dos dados (até 15). O resumo lateral apresenta cada parcela e sua justificativa.
- **Gestão dos títulos digitados:** a grade exibe todos os títulos adicionados, com documento, sacado, valor e vencimento. Cada linha pode ser carregada novamente no formulário para edição ou excluída. Na duplicata, “Seu número” foi substituído por “Documento”; chave NF-e e CFOP permanecem. A busca do sacado não reserva um campo grande para o nome: o resultado aparece em uma linha curta abaixo do CPF/CNPJ.
- **Mesa de risco e elegibilidade:** a etapa não trata os títulos da nova operação como “carteira vencida/a vencer”. Ela separa análise do cedente e análise dos sacados, usando o histórico já existente no ambiente: score, limite aprovado/utilizado/disponível, carteira anterior, vencidos históricos, liquidações, atrasos, recompras e apontamentos. Sacado sem relacionamento anterior aparece explicitamente como “novo”, com carteira zerada.
- **Decisão de risco:** todos os sacados da operação ficam selecionáveis. O usuário pode consultar o cadastro público demonstrativo, acionar a consulta Serasa demonstrativa, abrir o histórico completo, aprovar ou reprovar cada sacado e decidir título a título. A etapa só avança quando cedente, sacados e títulos tiverem aprovação registrada.
- **Aprovação em cascata:** aprovar um sacado aprova automaticamente todos os títulos vinculados a ele. Os títulos continuam disponíveis para revisão e alteração individual depois da decisão em lote.
- **Drill-down de sacado e títulos:** ao selecionar um sacado, o painel atualiza score, carteira, vencidos históricos, atraso, recompras e consultas. “Grupo econômico” abre exposição consolidada, vencidos, empresas relacionadas e score do grupo. A grade de títulos exibe vencimento e dias até o vencimento contra o prazo mínimo configurado, chave NF-e, CFOP, status de monitoramento e decisão. “Analisar” abre um modal do título com os dados fiscais e permite aprovar ou rejeitar diretamente.
- **Score e apontamentos explicáveis:** notas de cedentes e sacados exibem os fatores que formaram o score ao passar o mouse ou navegar por teclado. A quantidade de apontamentos também revela os registros nominais; a análise completa do cedente mantém a lista visível para decisão e auditoria.
- **Legibilidade da mesa de risco:** a etapa ganhou escala tipográfica maior, respiro entre blocos, score e limites destacados, linhas de sacados mais altas, métricas históricas mais legíveis e uma grade de títulos que mantém documento, prazo, monitoramento e todas as ações visíveis no desktop. A hierarquia continua responsiva em telas menores.
- **Extrato comportamental do sacado:** a análise selecionada segue a lógica operacional de “Baixados” e “Em aberto”, apresentando quantidade e valor por situação. Baixados separa pagos no prazo, pagos com atraso, recompras, protestos, liquidações em cartório e prorrogações liquidadas; em aberto separa a vencer, vencidos, prorrogados e em negociação. O painel destaca ainda exposição, atraso médio, concentração e totais, usando cores somente para sinalizar qualidade ou risco.
- **Visão completa do cedente:** “Abrir análise completa” apresenta score, limite aprovado, utilizado e disponível, barra de comprometimento, posição da carteira por situação e quantidade, comportamento de liquidações, recompras e protestos, maior concentração por sacado, atraso médio e a lista nominal de apontamentos. O modal diferencia visualmente uma carteira saudável de uma exposição pressionada.
- **Cedente obrigatório:** toda nova operação exige a escolha do cedente antes da origem do arquivo ou da digitação. O modal já apresenta score, limite disponível e apontamentos; a operação nasce vinculada ao CPF/CNPJ correto.
- **Saneamento de operações antigas:** qualquer rascunho legado sem cedente abre uma trava obrigatória. O usuário precisa escolher um cedente cadastrado para acessar e avançar; pode apenas voltar à central sem alterar a operação. Após o vínculo, score, limite, histórico e apontamentos são incorporados imediatamente.
- **Fila completa:** “Todas em andamento” é a visão inicial da central e inclui toda operação ativa, inclusive simulações. Intervenção, formalização e canceladas permanecem como recortes especializados, sem esconder operações que não se encaixem neles.
- **Responsividade:** em desktop compacto e tablet, o resumo da operação passa para baixo do conteúdo para não comprimir formulários e análises. Em celular, a navegação lateral vira barra inferior, cards e indicadores reorganizam-se em uma coluna, a esteira ganha rolagem horizontal controlada, as operações viram cartões, modais respeitam a altura da tela e digitação, cadastro de sacado e mesa de risco deixam de provocar estouro horizontal.

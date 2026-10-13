# QProf x STRATO — análise profunda de valor, diferenciação e lacunas

> Diagnóstico de produto e arquitetura em 12/10/2026, baseado nas 330 rotas/34 módulos extraídos do QProf e na implementação atual do STRATO. O objetivo não é buscar paridade de telas, mas identificar capacidades que aumentam valor operacional, segurança e vantagem competitiva.

> A leitura posterior do Help autenticado acrescentou 868 entradas hierárquicas e regras internas que não eram visíveis nas telas. Consulte `QPROF_HELP_MANUAL_ANALYSIS.md` para as evidências dos manuais.

## Conclusão executiva

O QProf agrega valor ao STRATO principalmente como **mapa de completude operacional**. Ele evidencia rotinas de retaguarda que um sistema maduro precisa sustentar — cobrança bancária e jurídica, documentos, integrações, dados mestres, fundos, investidores e relatórios. Porém, sua organização em centenas de telas de manutenção não deve ser copiada.

O STRATO já possui uma base conceitualmente mais forte em cinco pontos:

1. fluxo de recebíveis orientado a resultado, em seis etapas integradas;
2. cadastro único de pessoas com múltiplos papéis;
3. regras de domínio compartilhadas entre Operação, Carteira, Financeiro, Comercial e Controladoria;
4. gestão por exceção, com filas priorizadas e explicações;
5. decisões versionadas, alçadas, idempotência e outbox persistentes.

A principal lacuna não é funcional nem visual: é a distância entre **modelo demonstrativo** e **operação produtiva multiusuário**. Operações, Carteira, Financeiro, Comercial, políticas, tarefas e integrações ainda dependem de estado local. Antes de ampliar muito o catálogo, o STRATO precisa tornar persistente e transacional o ciclo operacional que já desenhou bem.

Depois dessa fundação, as capacidades do QProf que mais elevam o produto são, nesta ordem:

1. plataforma produtiva de integrações;
2. cobrança bancária e jurídica de ponta a ponta;
3. gestão documental e formalização com evidências;
4. workflow/SLA transversal;
5. dados mestres e parâmetros com vigência;
6. relatórios operacionais governados;
7. administração de fundos e investidores, apenas se fizer parte do posicionamento estratégico.

## 1. O que a extração realmente revela

A extração encontrou 330 rotas, 245 telas com conteúdo, 6.973 controles, 833 ações, 397 ocorrências de abas e 1.669 cabeçalhos de grade. O volume está concentrado em Cadastros básicos, Pessoas, Cobrança, Cedente, Tesouraria e Fundo.

Esse volume não representa 330 requisitos independentes. Três padrões explicam grande parte das telas:

- manutenção de cadastros auxiliares;
- pesquisa/consulta com filtros e grade;
- processamento especializado com estados, arquivos e retorno.

Assim, o ganho para o STRATO vem de absorver as **regras e capacidades** por trás desses padrões, usando componentes comuns e domínios coerentes. Reproduzir a topologia do QProf criaria custo de navegação, treinamento e manutenção sem aumentar proporcionalmente o valor.

## 2. Onde o STRATO já é superior e deve ser preservado

### 2.1 Esteira orientada à decisão

O STRATO organiza a operação em Entrada, Risco, Lastro, Preço, Aprovação e Liberação. Isso oferece uma narrativa operacional única e cria pontos claros de bloqueio, decisão e passagem de responsabilidade.

As áreas observadas no FNE001 — como agenda, importação, consultas e relatórios — não devem virar novas etapas. Devem ser serviços, filas ou visões contextuais dentro da etapa que consome seu resultado. Essa distinção mantém o processo inteligível.

### 2.2 Cadastro único multi-papel

O STRATO permite que a mesma pessoa seja cedente, sacado, fornecedor, representante, debenturista, cotista, avalista ou prestador. Isso é arquiteturalmente superior à repetição de cadastros por papel observada no QProf.

O caminho correto é aprofundar a ficha única com:

- relacionamentos, grupo econômico e beneficiário final;
- documentos, validade e pendências;
- contratos e vínculos;
- contas bancárias e validação de titularidade;
- KYC/PLD e revisões periódicas;
- histórico temporal dos papéis.

Não se recomenda criar um segundo cadastro de “cedente”, “agente” ou “investidor”. Cada módulo deve projetar a mesma pessoa conforme o contexto.

### 2.3 Ciclo fechado entre módulos

No STRATO, a liberação gera efeitos financeiros e de carteira; eventos de carteira repercutem no Comercial; limites aprovados repercutem no Cadastro; atraso e recompra podem realimentar risco. Esse encadeamento reduz redigitação e divergência entre departamentos.

Essa é uma vantagem de produto importante sobre um catálogo de rotinas isoladas. As novas capacidades devem publicar eventos e ampliar esse ciclo, e não criar ilhas funcionais.

### 2.4 Gestão por exceção

A Central de Cobrança já deriva agenda, promessas, negociações e escalonamentos da carteira. A Central do Dia e o motor de tarefas também transformam eventos em trabalho priorizado. Esse desenho é mais valioso que uma coleção de consultas estáticas.

A evolução correta é tornar essa inteligência persistente, configurável e mensurável: responsável, fila, prazo, SLA, motivo, evidência, desfecho e reabertura.

### 2.5 Governança de decisão

O núcleo já implementa eventos de decisão versionados, validação de permissão e alçada, chave de idempotência e publicação por outbox. É uma fundação forte para crédito, exceções, liberações e futuros processos regulatórios.

Ela deve virar o padrão transversal: ações materiais de cobrança, documentos, liquidação, alteração de parâmetros e integrações também precisam produzir eventos auditáveis.

## 3. O que está faltando de fato

### 3.1 Fundação produtiva do ciclo operacional — prioridade máxima

**Estado atual.** Identidade, sessões, usuários, permissões, alçadas, decisões, notificações, perfil da empresa e cadastro de pessoas já possuem estrutura PostgreSQL/API. Operações, sacados operacionais, Financeiro, Comercial, Carteira, políticas, integrações, parâmetros, tarefas e inteligência ainda são carregados e gravados no navegador.

**Risco.** Sem persistência transacional não há concorrência segura, recuperação central, integração assíncrona confiável nem uma fonte operacional única. Acrescentar rotinas do QProf sobre essa base aumentaria a superfície de demonstração, não a prontidão do produto.

**O que implementar.**

- agregados persistentes por tenant e empresa/veículo;
- controle de versão e concorrência otimista;
- comandos idempotentes para efeitos financeiros e externos;
- eventos imutáveis para mudanças materiais;
- projeções de leitura para filas, painéis e relatórios;
- transações que preservem o ciclo Operação → Financeiro → Carteira;
- migração controlada do estado local e estados vazios reais;
- backup, retenção, recuperação e observabilidade.

**Critério de conclusão.** Dois usuários conseguem atuar simultaneamente no mesmo ambiente, recarregar em outro dispositivo e reproduzir a origem de cada saldo, título, decisão e tarefa.

### 3.2 Plataforma de integrações — maior multiplicador de valor

**Estado atual.** O STRATO possui catálogo de provedores e modos de demonstração/não configurado, além de uma outbox real para decisões. Receita, SEFAZ, bureaus, registradoras, bancos, custodiante, Open Finance, assinatura e notificações ainda não são conectores operacionais.

**O que o QProf evidencia.** Integrações maduras não são apenas um campo de credencial; exigem importação/exportação, estados intermediários, logs, rejeições, retornos e reprocessamento.

**Recomendação.** Construir uma infraestrutura comum antes dos conectores individuais:

- cofre de credenciais no servidor e rotação;
- adaptadores versionados por provedor;
- fila de execução, idempotência, retry e fila de falhas;
- correlação por operação/título/pessoa;
- armazenamento seguro do payload bruto e do resultado normalizado;
- painel de saúde, latência, sucesso, rejeição e última execução;
- reprocessamento autorizado e trilha completa;
- webhooks assinados e proteção contra repetição;
- ambiente de homologação separado de produção.

**Primeiros conectores recomendados.** Bancos/CNAB/Pix/OFX, assinatura, SEFAZ/recebíveis e notificações. Eles fecham processos existentes; Receita e bureau enriquecem o risco logo depois.

### 3.3 Cobrança bancária e jurídica — completar uma base já boa

**Estado atual.** O STRATO já possui títulos, aging, agenda, ocorrências, promessas, negociações, escalonamento, recompra, baixa e conciliação demonstrativa. “Acordos” são inferidos de ocorrências de negociação, e protesto/jurídico aparecem como escalonamento, não como processos completos.

**O que falta.**

- emissão, alteração, baixa e segunda via de boleto;
- remessa e retorno CNAB produtivos por banco/carteira;
- instruções bancárias com protocolo e rejeição;
- régua multicanal com consentimento e comprovante de entrega;
- acordo como entidade: parcelas, juros, desconto, aprovação e quebra;
- prorrogação formal e seus efeitos financeiros/contábeis;
- confissão de dívida vinculada a títulos e garantias;
- protesto/IEPTB com remessa, retorno, custas, cancelamento e evidências;
- negativação, cobrança externa e processo jurídico;
- estratégia configurável por faixa de atraso, risco, cedente e veículo;
- indicadores de recuperação por safra, canal, operador e estratégia.

**Decisão de design.** Agenda, promessa, acordo, protesto e jurídico devem compartilhar um “caso de cobrança” com linha do tempo, responsáveis e documentos. Isso evita módulos desconectados para cada fase.

### 3.4 Gestão documental e formalização — transformar status em evidência

**Estado atual.** O pacote de formalização permite alternar documento entre Pronto/Pendente. Assinatura manual registra metadados e apenas o nome do anexo; o provedor eletrônico aguarda configuração.

**O que falta.**

- objeto documental persistente com arquivo, hash, tipo, versão e origem;
- templates versionados e geração a partir de dados da operação;
- checklist por produto, veículo, valor e política;
- relação entre documento, pessoa, operação, título, garantia e decisão;
- antivírus, OCR e extração somente quando houver caso de uso;
- assinantes, ordem, autenticação, recusas, expiração e reenvio;
- evidência do provedor, certificado e validação de integridade;
- retenção, legal hold, descarte e arquivamento;
- permissões por classificação e registro de acesso/download.

**Valor.** Esse hub serve simultaneamente Aprovação, Cadastro, Cobrança, Controladoria, Fundo e portais externos. Por isso, deve ser transversal e não apenas um componente da etapa 5.

### 3.5 Workflow e SLA — elevar a gestão por exceção

**Estado atual.** Há tarefas automáticas/manuais, responsável, departamento, vencimento, adiamento, conclusão, histórico e regras de visibilidade. Porém, o estado de tarefas ainda é local e não existe um motor de fluxo configurável.

**O que falta.**

- fila persistente e transacional;
- templates de fluxo por evento/processo;
- estados, transições, guardas e ações automáticas;
- grupos, filas, distribuição, aceite e delegação;
- calendário útil, SLA, escalonamento e substituição;
- formulários e evidências exigidos por etapa;
- vínculo com permissões e alçadas;
- métricas de tempo, retrabalho, gargalo e abandono.

**Limite importante.** O motor deve orquestrar domínios, não guardar suas regras. Aprovação de crédito continua no domínio de decisão; o workflow somente coordena o trabalho necessário.

### 3.6 Dados mestres e parâmetros — absorver 106 telas sem herdar sua fragmentação

**Estado atual.** O QProf possui 106 telas de Cadastros básicos, com 1.932 campos. O STRATO já tem políticas, parâmetros operacionais, bancos, veículos e configurações, mas vários valores ainda estão no código ou no estado local.

**Recomendação.** Criar um serviço de catálogos parametrizáveis com:

- código estável, nome, status e vigência;
- escopo global, tenant, empresa, veículo e produto;
- validação por tipo e relacionamentos;
- importação/exportação controlada;
- aprovação para parâmetros críticos;
- histórico, comparação de versões e data futura de ativação;
- cache e referência segura por ID, sem copiar descrições nos processos.

**Não tornar genérico demais.** Regras financeiras, fiscais e de elegibilidade que exigem invariantes próprias devem manter modelos tipados. O catálogo genérico é adequado para classificações e listas, não para toda regra de negócio.

### 3.7 Relatórios e consultas — projeções governadas, não telas duplicadas

**Estado atual.** Há painéis e relatórios dentro dos módulos, mas não um catálogo corporativo de relatórios, execução, distribuição e auditoria.

**O que falta.**

- catálogo por domínio e permissão;
- filtros salvos e compartilháveis;
- exportação assíncrona para volumes grandes;
- agendamento e distribuição com destinatários autorizados;
- snapshot de parâmetros, horário, versão e resultado;
- mascaramento de dados sensíveis;
- formatos operacionais (CSV/XLSX) e documentos (PDF) conforme o uso;
- API analítica governada para BI.

Consultas recorrentes do QProf devem virar projeções e filtros reutilizáveis. Uma nova tela só se justifica quando há uma decisão ou ação própria, não apenas outra combinação de colunas.

## 4. Capacidades condicionais à estratégia

### 4.1 FIDC, fundos e investimentos

A direção estratégica do STRATO já resolve parte desta decisão: FIDC pertence ao núcleo desde a primeira versão comercial, na perspectiva operacional da gestora, consultoria ou estrutura autorizada. O produto deve modelar fundo, classe/subclasse, regulamento, participantes, responsabilidades, elegibilidade, concentração, pacotes de cessão, posições e conciliações com administrador/custodiante.

O que permanece condicionado a decisão jurídica e comercial é administrar oficialmente o passivo do fundo: cálculo de cota/PL oficial, escrituração de cotistas, movimentações, obrigações e prestação regulatória atribuída ao administrador fiduciário. Isso é um produto adicional, não uma pequena extensão.

A recomendação é tornar o FIDC nativo no grafo de estrutura e de políticas, integrando posições e eventos dos participantes regulados, sem criar telas isoladas de fundo nem assumir responsabilidades que pertençam a terceiros.

### 4.2 Portal do investidor e portal do cedente

Devem vir depois de identidade externa, documentos e fonte operacional persistente. O portal deve ser uma projeção segura do mesmo domínio, com autenticação forte, consentimento, segregação por vínculo, documentos, posição e solicitações. Não deve possuir uma segunda base de dados de negócio.

### 4.3 Recebíveis de cartão/UR

Agenda de recebíveis, unidades de recebíveis, registradora, gravames e conciliação formam um domínio próprio. Só agrega se o mercado-alvo incluir antecipação de cartão. Caso contrário, o custo regulatório e de integração desvia o foco do núcleo atual.

### 4.4 Governança corporativa e regulatória

Reuniões, atas, obrigações, COAF e rotinas estatutárias podem agregar a uma suíte completa, mas devem reutilizar Workflow, Documentos, Pessoas e Relatórios. Não precisam nascer como módulos independentes.

## 5. O que não vale copiar

- **330 rotas equivalentes:** aumentariam fragmentação e treinamento.
- **Cadastros duplicados por papel:** contradizem a ficha única do STRATO.
- **Consultas como telas fixas:** filtros, projeções, busca e relatórios salvos cobrem melhor o problema.
- **Help desk próprio:** integrar uma ferramenta especializada, salvo se atendimento for parte central do produto.
- **Compras, RDV e orçamento genéricos:** são adjacentes, não diferenciadores do ciclo de recebíveis.
- **OData como interface principal:** preferir API versionada, webhooks e exportações governadas.
- **Estados manuais sem evidência:** “Pronto”, “Enviado” ou “Assinado” só devem valer quando ligados a artefato, evento ou retorno verificável.
- **IA antes da infraestrutura:** copilotos devem interpretar e recomendar; dados, regras, efeitos e auditoria continuam determinísticos.

## 6. Matriz de priorização

Escala de 1 a 5. Valor mede impacto no cliente e diferenciação; urgência mede dependência/riscos atuais; esforço é relativo. A ordem considera também dependências.

| Capacidade | Valor | Urgência | Esforço | Recomendação |
|---|---:|---:|---:|---|
| Persistência transacional do ciclo operacional | 5 | 5 | 5 | P0 — iniciar imediatamente |
| Plataforma de integrações e observabilidade | 5 | 5 | 4 | P0 — fundação comum e bancos primeiro |
| Cobrança bancária/jurídica ponta a ponta | 5 | 4 | 4 | P0 — completa a Carteira existente |
| Gestão documental e assinatura | 5 | 4 | 4 | P0 — transversal à formalização e cobrança |
| Workflow, filas e SLA | 4 | 4 | 4 | P1 — sobre estado persistente |
| Dados mestres e parâmetros versionados | 4 | 4 | 3 | P1 — reduz código e absorve cadastros QProf |
| Relatórios, exportação e distribuição | 4 | 3 | 3 | P1 — depois das projeções persistentes |
| Administração de fundos/investimentos | 5* | 3* | 5 | Decisão estratégica; valor/urgência dependem do posicionamento |
| Portal externo | 3 | 2 | 4 | P2 — depende de documentos, identidade e dados produtivos |
| Recebíveis de cartão/UR | 4* | 2* | 5 | Somente se o segmento estiver no ICP |
| Help desk/compras/RDV genérico | 1 | 1 | 3 | Não construir como core; integrar |

## 7. Roadmap recomendado por ondas

### Onda 0 — consolidar a fronteira regulatória

O STRATO já se posiciona como sistema operacional de recebíveis com FIDC nativo, integrado ao administrador/custodiante. A decisão pendente é documentar, por fundo e contrato, quais responsabilidades pertencem ao STRATO, à gestora/consultoria, ao administrador, ao custodiante e à registradora.

Somente depois dessa matriz de responsabilidades deve ser avaliada uma eventual expansão para administração do passivo de fundos e investidores.

### Onda 1 — tornar real o que já diferencia

- persistir Operações, Carteira, Financeiro, Comercial, políticas e tarefas;
- consolidar tenant, empresa, veículo, permissões e escopo em todas as APIs;
- versionar comandos, eventos e projeções;
- fechar testes de concorrência, idempotência, recuperação e autorização;
- remover dependência de seeds em ambiente real.

**Resultado esperado:** o STRATO deixa de ser uma demonstração funcional e vira um núcleo operacional confiável.

### Onda 2 — fechar o ciclo externo

- infraestrutura comum de conectores;
- CNAB/Pix/OFX produtivos e instruções bancárias;
- hub documental, templates e assinatura;
- notificações multicanal auditáveis;
- acordo, prorrogação, protesto/IEPTB, recompra e jurídico como processos completos.

**Resultado esperado:** uma operação nasce, é decidida, formalizada, paga, cobrada, conciliada e auditada sem controles paralelos.

### Onda 3 — escalar operação e governança

- workflow/SLA transversal;
- catálogos e parâmetros com vigência;
- relatórios assíncronos, agenda e distribuição;
- métricas operacionais e de integração;
- API externa e webhooks governados.

**Resultado esperado:** o sistema sustenta volume, equipes e exceções sem multiplicar telas.

### Onda 4 — ampliar o produto

- administração de fundo/investimentos, se aprovada na Onda 0;
- portais externos;
- recebíveis de cartão/UR ou conectores de ecossistema conforme o mercado.

## 8. Sequência concreta dos próximos épicos

1. **Persistência de Operações** — agregado, eventos, concorrência e API.
2. **Persistência de Carteira e Financeiro** — liquidação, baixa, estorno, conciliação e razão com invariantes transacionais.
3. **Persistência de Comercial, políticas e tarefas** — projeções e histórico.
4. **Integration Runtime** — jobs, credenciais, logs, retry, falhas e painel.
5. **Cobrança Bancária** — conta/carteira, remessa, retorno, boleto, instrução e conciliação.
6. **Document Hub** — arquivo, metadados, hash, versões, templates e permissões.
7. **Assinatura** — provedor, envelopes, eventos e evidências.
8. **Caso de Cobrança** — acordo, parcelas, prorrogação, protesto, recompra e jurídico.
9. **Workflow/SLA** — filas, distribuição, escalonamento e métricas.
10. **Catálogo e Reporting** — dados mestres, relatórios salvos/agendados e API analítica.

## 9. Indicadores para validar que a evolução agregou valor

- percentual de operações processadas sem planilha ou redigitação;
- tempo da entrada à liberação, separado por espera e trabalho;
- percentual de decisões automáticas, exceções e overrides;
- taxa de falha/reprocessamento por integração;
- tempo para resolver rejeições bancárias/documentais;
- percentual de formalizações com evidência integral;
- recuperação por faixa de atraso, estratégia e canal;
- promessas quebradas e acordos reincidentes;
- conciliações automáticas versus manuais;
- cumprimento de SLA por fila e departamento;
- número de cadastros duplicados por documento;
- capacidade de reproduzir saldo, decisão e documento em auditoria.

## 10. Parecer final

O QProf mostra ao STRATO **onde um produto maduro precisa chegar**, mas não necessariamente **como deve chegar**. A melhor oportunidade não é ser um QProf com interface mais nova. É combinar a completude operacional observada no QProf com as vantagens já presentes no STRATO: domínio integrado, ficha única, decisões explicáveis, ciclo fechado e gestão por exceção.

Se houver apenas uma prioridade, ela deve ser tornar persistente e transacional o ciclo já existente. Se houver três, acrescentam-se integrações produtivas e o conjunto Cobrança + Documentos. Essas frentes transformam diretamente a proposta do produto; Fundo, Portal e módulos corporativos só devem avançar depois de uma decisão clara de posicionamento.

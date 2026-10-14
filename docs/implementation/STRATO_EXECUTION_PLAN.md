# STRATO — plano de ação executável

Atualizado em 14/10/2026. Este plano transforma o blueprint de capacidades em entregas pequenas, verificáveis e acompanhadas por material de apoio ao usuário.

## Regra de execução

Cada tarefa só é concluída quando entrega, no mesmo recorte:

1. modelo de domínio e persistência;
2. autorização, auditoria e tratamento de concorrência;
3. integração com a experiência existente;
4. testes automatizados e verificação técnica;
5. guia de uso e procedimento operacional;
6. atualização deste quadro com evidências e pendências.

## Onda A — substrato produtivo

### A1. Operação persistente e versionada — IMPLEMENTADA / HOMOLOGAÇÃO MULTIUSUÁRIO PENDENTE

- [x] modelar tabela do agregado `Operation` por tenant;
- [x] adicionar versão otimista para impedir sobrescrita silenciosa;
- [x] criar histórico imutável e outbox transacional;
- [x] expor leitura e gravação autenticadas;
- [x] conectar criação e alterações do modo real ao servidor;
- [x] manter a demonstração isolada em `localStorage`;
- [x] criar guia operacional;
- [x] aplicar a migração no ambiente alvo;
- [ ] validar o fluxo com dois usuários e dois navegadores;
- [x] executar e corrigir toda a suíte de qualidade.

### A2. Recebível/título como agregado próprio — IMPLEMENTADA

- [x] separar título do payload da operação;
- [x] modelar vínculo operação–recebível–documento fiscal;
- [x] criar identidade e deduplicação do ativo;
- [x] persistir eventos de inclusão, alteração, exclusão lógica e cessão;
- [x] migrar a carteira para projeções dos títulos persistidos;
- [x] criar guia “Do arquivo ao título”.

### A3. Financeiro persistente — IMPLEMENTAÇÃO TÉCNICA CONCLUÍDA / HOMOLOGAÇÃO VISUAL PENDENTE

- [x] persistir plano de contas, contas bancárias, títulos e lançamentos;
- [x] garantir partidas balanceadas e estornos compensatórios;
- [x] tornar liberação e baixa transações idempotentes;
- [x] criar conciliação inicial e fechamento por data-base;
- [x] criar procedimentos de liberação, baixa, estorno e conferência.

Progresso A3.1 — fundação do ledger:

- [x] criar tabelas privadas para estado financeiro, plano, categorias, bancos, títulos, movimentos, diário, extratos e vínculo da aquisição;
- [x] impor partidas dobradas balanceadas no PostgreSQL;
- [x] tornar cabeçalhos e linhas contábeis imutáveis, permitindo correção somente por vínculo de estorno;
- [x] adicionar índices para todas as chaves estrangeiras identificadas pelo Advisor;
- [x] validar o estado financeiro no domínio antes da persistência;
- [x] publicar o guia inicial do livro financeiro e contábil;
- [x] conectar leitura e gravação autenticadas do Financeiro;
- [x] homologar tecnicamente concorrência, idempotência, baixa, estorno e conciliação;
- [ ] homologar visualmente o fluxo completo em duas sessões reais.

Evidências A3.1:

- migrações `create_finance_ledger_storage`, `add_finance_foreign_key_indexes` e `add_finance_state_snapshot` aplicadas no Supabase;
- ensaio completo da migração executado e revertido antes da aplicação;
- PostgreSQL aceitou lançamento balanceado e recusou diferença de R$ 1,00;
- tentativa de alterar o histórico de um lançamento foi recusada pelo banco;
- testes descartáveis foram revertidos e deixaram zero registros de homologação;
- Advisor sem chaves estrangeiras não indexadas após a correção;
- repositório transacional confirmou criação, atualização, leitura, projeções normalizadas e recusa de versão obsoleta, com rollback integral;
- API `/api/finance` conectada à sessão, permissões e escopo do tenant; modo de demonstração continua isolado no navegador;
- TypeScript, lint, formatação e build aprovados; 212 testes automatizados aprovados em 37 arquivos;
- guia publicado em `docs/user-guides/LIVRO_FINANCEIRO_E_CONTABIL.md`.

Progresso A3.2 — comandos confiáveis e fechamento:

- [x] registrar uma chave de idempotência imutável para cada gravação financeira;
- [x] repetir com segurança uma resposta perdida sem gerar segunda baixa ou segundo lançamento;
- [x] recusar reutilização da mesma chave com conteúdo diferente;
- [x] impedir fechamento com extrato ou movimento pendente até a data-base;
- [x] tornar o fechamento imutável e impedir inclusão, alteração ou exclusão retroativa;
- [x] expor fechamento e histórico na tela contábil;
- [x] documentar importação, conciliação, fechamento, estorno e tratamento de conflitos.

Evidências A3.2:

- migrações `create_finance_command_idempotency` e `create_finance_period_closures` aplicadas e reconciliadas com o histórico remoto;
- repetição da mesma chave e conteúdo devolveu o resultado anterior; mesma chave com conteúdo diferente foi recusada;
- versão obsoleta foi recusada sem sobrescrever a gravação concorrente;
- o PostgreSQL recusou lançamento retroativo em período encerrado;
- ensaios transacionais foram revertidos e a conferência final encontrou zero estados, fechamentos e lançamentos de teste;
- Advisor sem chave estrangeira não indexada; avisos de índices sem uso são esperados antes de carga produtiva;
- navegação visual no modo demonstração confirmou a tela de fechamento e o bloqueio explícito diante de 5 linhas de extrato e 3 movimentos pendentes, sem erro no console;
- guia operacional ampliado com procedimentos e respostas a erros.

### A4. Estado operacional complementar

- [x] persistir Comercial e vínculos históricos;
- [x] persistir políticas e versões aprovadas;
- [x] persistir tarefas, responsáveis, prazos e histórico;
- [x] persistir Carteira sem depender do navegador;
- [x] criar manuais por perfil para Comercial, Risco, Controladoria e Financeiro.

Progresso A4.1 — Central do Dia persistente:

- [x] preservar o motor e a experiência existentes da Central do Dia;
- [x] persistir agregado, tarefas, responsáveis, prazos e histórico por tenant;
- [x] usar o diretório ativo do tenant na delegação;
- [x] aplicar versão otimista, comandos idempotentes, eventos e outbox;
- [x] impedir remoção de tarefas, reescrita de histórico e autoria incompatível com a sessão;
- [x] manter demonstração no navegador e modo real no servidor autenticado;
- [x] publicar o guia operacional da Central do Dia;
- [ ] homologar visualmente a concorrência com duas sessões reais.

Evidências A4.1:

- migrações `create_task_workflow_storage` e `add_task_owner_foreign_key_index` aplicadas no Supabase;
- ensaio da migração executado em transação e revertido antes da aplicação;
- repositório confirmou criação, replay idempotente, conflito de chave, conclusão, trava de versão e projeções normalizadas;
- rollback integral confirmado com zero tenants, estados, tarefas, históricos e comandos descartáveis;
- Advisor sem chaves estrangeiras não indexadas após a correção;
- testes automatizados cobrem integridade do agregado, autoria e imutabilidade do histórico;
- inspeção visual confirmou fila, filtros, responsável, prazo, histórico e delegação usando os seis usuários ativos do tenant, sem erro no console;
- guia publicado em `docs/user-guides/CENTRAL_DO_DIA_E_TAREFAS.md`.

Progresso A4.2 — políticas versionadas e aprovadas:

- [x] persistir agregado, versões, escopos, vigências e parâmetros por tenant;
- [x] exigir aprovação identificada, data e justificativa para ativação;
- [x] tornar versões ativas e encerradas imutáveis;
- [x] encerrar automaticamente a vigência anterior do mesmo escopo;
- [x] aplicar versão otimista, comandos idempotentes, eventos e outbox;
- [x] manter demonstração no navegador e modo real no servidor autenticado;
- [x] publicar o guia de políticas de elegibilidade;
- [ ] homologar visualmente a concorrência com duas sessões reais.

Evidências A4.2:

- migração `create_eligibility_policy_governance` aplicada no Supabase e reconciliada com o histórico remoto;
- ensaio completo da migração executado em transação e revertido antes da aplicação;
- repositório confirmou criação, replay idempotente, aprovação, conflito de chave, trava de versão e projeções normalizadas;
- rollback integral confirmado com zero tenants, estados, políticas, aprovações e comandos descartáveis;
- Advisor sem chaves estrangeiras não indexadas; índices novos ainda sem uso são esperados antes da carga produtiva;
- testes automatizados cobrem validação, autoria da aprovação, vigência, imutabilidade e hash do comando;
- inspeção visual confirmou versão ativa imutável, autoria/justificativa visíveis e novo rascunho com o comando “Aprovar e ativar”, sem erros no console;
- guia publicado em `docs/user-guides/POLITICAS_DE_ELEGIBILIDADE.md`.

Progresso A4.3 — manutenção persistente da Carteira:

- [x] unir títulos originados no STRATO e posições importadas na leitura do servidor;
- [x] persistir cobranças, confirmações, situação e histórico por tenant;
- [x] preservar dados de origem do título e tornar ocorrências/eventos append-only;
- [x] atribuir ações à identidade autenticada, inclusive fora do usuário de demonstração;
- [x] aplicar versão otimista, comandos idempotentes, eventos e outbox;
- [x] manter demonstração no navegador e modo real no servidor autenticado;
- [x] publicar o guia operacional da Carteira;
- [ ] homologar visualmente a concorrência com duas sessões reais.

Evidências A4.3:

- migração `create_portfolio_maintenance_storage` aplicada no Supabase e reconciliada com o histórico remoto;
- ensaio completo da migração executado e revertido antes da aplicação;
- repositório confirmou cobrança, confirmação, replay idempotente, conflito de chave, trava de versão e projeções normalizadas;
- rollback integral confirmado com zero tenants, estados, ocorrências, confirmações e comandos descartáveis;
- Advisor sem chaves estrangeiras não indexadas; avisos de índices sem uso são esperados antes da carga produtiva;
- testes automatizados cobrem autoria, imutabilidade da origem, histórico append-only e hash do comando;
- inspeção visual confirmou a Central de cobrança, 18 títulos, prioridades, agenda e régua de recuperação sem erros no console;
- guia publicado em `docs/user-guides/CARTEIRA_COBRANCA_E_CONFIRMACAO.md`.

Progresso A4.4 — originação Comercial persistente:

- [x] persistir o agregado Comercial e suas projeções de leads e comitês por tenant;
- [x] manter dossiê, responsável, visitas, vínculos, comissões e histórico entre sessões;
- [x] exigir decisão favorável do comitê antes da conversão;
- [x] separar a autoria comercial da alçada de decisão de risco;
- [x] criar automaticamente o cedente e o vínculo após aprovação válida;
- [x] aplicar versão otimista, comandos idempotentes, eventos e outbox;
- [x] manter demonstração no navegador e modo real no servidor autenticado;
- [x] publicar o guia do funil, comitê e onboarding;
- [ ] homologar visualmente a concorrência com duas sessões reais.

Evidências A4.4:

- migração `create_commercial_origination_storage` aplicada no Supabase e reconciliada com o histórico remoto;
- tabelas privadas com RLS forçado e privilégios de clientes revogados;
- projeções normalizadas permitem consultar funil por etapa, CNPJ e pautas por situação/data;
- API autenticada aplica permissão comercial e exige `risk:decide` para registrar decisões;
- validações preservam pautas, decisões e históricos e impedem conversão sem aprovação;
- ensaio transacional confirmou estado, lead, comitê, evento, outbox, recibo idempotente e bloqueio de alteração do recibo, seguido de rollback com zero resíduos;
- TypeScript, lint, formatação e build aprovados; 237 testes automatizados aprovados em 42 arquivos;
- testes específicos cobrem integridade da transição e estabilidade da chave idempotente;
- guia publicado em `docs/user-guides/COMERCIAL_FUNIL_COMITE_E_ONBOARDING.md`.
- guia transversal por perfil publicado em `docs/user-guides/GUIA_RAPIDO_POR_PERFIL.md`, com rotinas, limites de atuação e passagens de bastão para Comercial, Risco, Controladoria e Financeiro.

### A5. Segurança e comandos materiais

- [ ] unificar idempotência, event ledger e outbox;
- [ ] aplicar escopo por empresa/veículo em todas as APIs;
- [ ] implementar maker-checker nos comandos críticos;
- [ ] testar acesso cruzado entre tenants e empresas;
- [ ] publicar matriz de perfis, permissões e alçadas.

Progresso A5.1 — isolamento de Operações e Decisões:

- [x] carregar `company_scopes` na identidade autenticada do backend;
- [x] filtrar a leitura de operações por empresa/veículo autorizado;
- [x] validar veículo atual e solicitado antes de alterar uma operação;
- [x] bloquear leitura e criação de decisão fora do escopo da operação;
- [x] documentar a matriz atual de APIs, permissões, escopos e lacunas;
- [x] testar escopo vazio, curinga explícito, filtragem, vínculo ao tenant e tentativa de mover operação alheia;
- [x] propagar o escopo de empresa para Carteira, Recebíveis e notificações operacionais;
- [x] propagar o escopo de empresa para Financeiro, tarefas e reprocessamento da outbox;
- [ ] homologar ataques cruzados com duas sessões reais e dois tenants.

Evidências A5.1:

- identidade de servidor agora deriva empresas autorizadas diretamente do vínculo `tenant_memberships`;
- consulta de escopo da operação usa sempre `tenant_id + operation_id`;
- atualização recusa tanto origem fora do escopo quanto destino fora do escopo;
- Decisões validam o veículo da operação antes de ler ou registrar eventos;
- matriz publicada em `docs/security/MATRIZ_DE_ACESSO_E_ESCOPO.md`.

Progresso A5.2 — escopo em Carteira, Recebíveis e notificações:

- [x] exigir `dashboard:view` na leitura da Carteira e capacidade operacional na leitura de Recebíveis;
- [x] filtrar títulos por empresa sem expor a contagem global;
- [x] recompor o agregado completo no servidor ao salvar uma parcela visível da Carteira;
- [x] recusar injeção, remoção ou manutenção de título fora do escopo;
- [x] filtrar Recebíveis pelo veículo da operação de origem;
- [x] filtrar notificações pela empresa da operação associada;
- [x] testar preservação de dados não visíveis e bloqueio de notificações cruzadas.

Progresso A5.3 — escopo em Financeiro, tarefas e outbox:

- [x] filtrar contas, títulos, movimentos, extratos, lançamentos, fechamentos e vínculos operacionais do Financeiro por empresa;
- [x] recompor o agregado financeiro completo no servidor, preservando integralmente empresas não visíveis;
- [x] recusar referências cruzadas para contas, títulos, lançamentos ou operações fora do escopo;
- [x] reservar plano de contas, categorias e de-para globais a usuários com `settings:manage`;
- [x] impedir que tarefas ligadas a operações de outra empresa sejam exibidas ou alteradas, inclusive por administradores de escopo restrito;
- [x] limitar publicação, saúde e reprocessamento administrativo da outbox às empresas atribuídas;
- [x] testar filtragem, preservação do agregado oculto, injeção cruzada e consultas SQL parametrizadas por empresa.

Progresso A5.4 — segregação maker-checker:

- [x] impedir que o solicitante decida a própria exceção de risco;
- [x] exigir solicitação aberta antes de aprovar ou rejeitar uma exceção e impedir segunda decisão terminal;
- [x] separar preparação e aprovação da liberação financeira entre duas identidades autenticadas;
- [x] atribuir preparador e aprovador pela sessão do servidor, ignorando autoria enviada pelo navegador;
- [x] tornar a liberação aprovada imutável, exigindo cancelamento ou estorno para correção;
- [x] orientar a experiência da etapa de Liberação com os estados “concluir preparação”, “aguardar segundo aprovador” e “aprovar e liberar”;
- [ ] aplicar maker-checker a alterações críticas de configuração e dados bancários;
- [ ] homologar o fluxo com duas sessões reais e usuários distintos.

Progresso A5.5 — escopos residuais de APIs:

- [x] separar consulta (`registry:view`) de manutenção (`registry:edit`) no Cadastro;
- [x] propagar a leitura cadastral explícita para evidências CNPJ e fontes públicas;
- [x] migrar os editores existentes sem perda de acesso e publicar a nova capacidade na administração de usuários;
- [x] reduzir no backend o contexto do Copiloto por empresa/veículo e por contrato de campos permitido;
- [x] limitar cedentes do Copiloto aos documentos alcançáveis por operações ou títulos visíveis;
- [x] publicar guia de escopo e fontes do Copiloto;
- [x] segmentar o agregado Comercial por responsável/gerente com merge seguro dos dados não visíveis;
- [x] separar consulta de empresa/políticas (`settings:view`) da manutenção administrativa (`settings:manage`);
- [x] substituir o contexto do Copiloto montado no cliente por projeções lidas integralmente no servidor;
- [x] homologar Cadastro, Comercial, Integrações e Configurações com sessões reais de administrador e executivo segmentado; o Copiloto permanece coberto por testes automatizados sem consumir o provedor externo.

Progresso A5.6 — maker-checker residual:

- [x] congelar favorecidos, contas, chaves, valores, data e observação entre preparação e aprovação;
- [x] validar no backend favorecidos e distribuição integral antes de concluir a preparação;
- [x] recriar no backend os lançamentos a pagar, descartando lançamentos e auditoria forjados pelo navegador;
- [x] publicar o guia de aprovação de favorecidos e tratamento de divergências;
- [x] persistir solicitação e dupla aprovação de contas bancárias com antes/depois, motivo e segregação por tenant;
- [x] impedir alteração bancária pela API comum e invalidar aprovação sobre cadastro concorrente;
- [x] proteger a fila no banco com RLS forçada, privilégios revogados, decisão terminal e uma pendência por cadastro;
- [x] publicar o procedimento de conferência, rejeição e reapresentação de contas bancárias;
- [x] disponibilizar no Cadastro a solicitação, comparação antes/depois, fila pendente, aprovação e rejeição;
- [x] aplicar dupla aprovação à publicação de políticas de elegibilidade, com congelamento, aprovação ou rejeição independente;
- [ ] estender dupla aprovação às demais configurações materiais que alterem cálculo, integração ou segurança;
- [ ] proteger elevação de privilégios e alterações administrativas de credenciais;
- [ ] homologar o fluxo residual com duas sessões reais e usuários distintos.

Relatório consolidado de pendências e estimativas: `docs/implementation/STRATO_REMAINING_WORK_REPORT.md`.

## Ondas seguintes

### Onda B — cunha comercial completa

Estrutura institucional/FIDC, onboarding e prontidão, entrada produtiva, enriquecimento, políticas reais, documentos, assinatura e pacote de cessão/registro/pagamento.

### Onda C — ciclo do dinheiro

Runtime de integrações, primeiro banco produtivo, boleto/remessa/retorno, conciliação, conta gráfica, cobrança, acordo, protesto e exportação contábil.

### Onda D — escala, FIDC e controle

Posições de custodiante/administrador, PDD, registradoras, workflow/SLA, relatórios, portal do cedente e classes/subclasses.

### Onda E — aprendizado

Laboratório de políticas, safras, roll rates, liquidez, shadow mode, anomalias e copiloto governado.

## Ordem das próximas tarefas

1. concluir A1 no ambiente real e no teste concorrente;
2. homologar A2 com uma operação real e seu documento fiscal;
3. executar A3 pelo ledger antes das telas de tesouraria;
4. executar A4 na ordem tarefas → políticas → carteira → comercial;
5. fechar A5 antes de integrar banco, assinatura ou registradora.

## Registro de decisões

- O QProf é fonte de necessidades e exceções operacionais, não modelo de telas ou arquitetura.
- FIDC permanece nativo, com responsabilidades configuráveis e sem assumir atribuições reguladas de terceiros.
- Operação real não usa `localStorage`; demonstração permanece local e isolada.
- Nenhuma alteração concorrente pode ser sobrescrita silenciosamente.
- Toda ação material deve produzir evento auditável e saída publicável.

## Evidências da execução A1

- migração `create_operation_storage` aplicada no Supabase do STRATO;
- migração `add_operation_foreign_key_indexes` aplicada após revisão do Advisor;
- teste transacional no PostgreSQL confirmou gravação, evento, outbox e recusa de versão obsoleta;
- teste de homologação foi revertido integralmente; nenhuma operação fictícia ficou no banco;
- TypeScript, lint e formatação aprovados;
- build de produção aprovado com a rota `/api/operations`;
- 203 testes automatizados aprovados em 34 arquivos;
- guia operacional publicado em `docs/user-guides/OPERACOES_PERSISTENTES.md`.

Pendência controlada: homologação visual concorrente com duas sessões reais. O backend e o banco já recusam a atualização obsoleta; falta validar a comunicação completa dessa ocorrência na experiência dos dois usuários.

## Evidências da execução A2

- migração `create_receivable_asset_graph` aplicada no Supabase do STRATO;
- títulos removidos do JSON persistido da operação e reconstituídos a partir do agregado `Receivable`;
- identidade canônica e restrição única impedem o mesmo ativo em operações diferentes;
- vínculo operação–recebível–NF-e persistido em tabelas próprias;
- eventos de domínio imutáveis e outbox transacional registram inclusão, alteração, remoção e cessão;
- Carteira deriva os títulos cedidos da fonte persistida de recebíveis;
- teste transacional no PostgreSQL confirmou gravação conjunta, vínculo fiscal, outbox, bloqueio de duplicidade e imutabilidade do evento;
- teste de homologação foi revertido integralmente; nenhum registro fictício ficou no banco;
- TypeScript, formatação e 207 testes automatizados aprovados; lint corrigido antes do fechamento;
- guia operacional publicado em `docs/user-guides/DO_ARQUIVO_AO_TITULO.md`.

Observação de arquitetura: as tabelas ficam no schema privado, com RLS forçado, privilégios dos clientes revogados e acesso somente pelo backend autenticado. Por isso o Advisor informa “RLS sem política” como aviso informativo esperado para esse desenho. A proteção contra senhas vazadas permanece uma ação da A5.

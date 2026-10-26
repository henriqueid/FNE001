# STRATO — contexto de continuidade

## Validação por etapas ·26/10/2026 · novo lote local

Usuário autorizou seguir por etapas após publicação6bf67f8. Etapa1 executou jornadas principais do Financeiro em demonstração exclusiva5182, com dados CHURUME. Duas falhas novas corrigidas localmente: teclado/foco do Modal compartilhado e moeda da mensagem de diferença. Evidências e limites: `docs/testing/churume/2026-10-26-etapa1-financeiro/resultado.md`; sequência no plano `2026-10-26-validacao-por-etapas.md`. **Estas duas correções ainda não foram publicadas.** Próximo bloco: Carteira/cobrança; autenticação e permissões reais exigem servidor isolado, nunca certificar pela demo.

## Retomada Churume ·26/10/2026 · publicado

Após publicação aa1aa8b, corrigidos novos defeitos reproduzidos em conciliação/OFX/transferência, cobrança/checagem/contatos e entradas financeiras. Datas civis usam calendário canônico; parcelas inteiras preservam total. Gravação pendente, mudança de contexto e reabertura de modal recebem regressões. Acordos históricos preservados. Relatório: `docs/testing/churume/2026-10-26-retomada/resultado.md`. Revisão independente realizada; check, build e PostgreSQL descartável registrados no relatório. **Lote publicado: `3b99d42`.** Check exato 1.177 aprovados/30 ignorados; build local/remoto, PostgreSQL/recuperação e saúde interna/pública aprovados. Registro `docs/deployments/2026-10-26-retomada-churume.md`; seções locais anteriores à publicação são históricas. Cobertura de handlers não certifica telas completas no navegador.

## Publicação integral autorizada ·26/10/2026

Publicado código `c132acd`: limites gerais/individuais de IA, correções Churume25/26, recompra com escolha de baixa, tarefas autoritativas, usuários/permissões/sessões e configuração IA versionada. Visual aprovado preservado. Check do lote1.105pass/30skip; PostgreSQL29/29+documentos/recuperação/HTTP; build local/remoto aprovados; dependências produtivas sem vulnerabilidades. Serviço reiniciado11:49:13 de26/10 (America/Sao_Paulo), saúde interna/pública e página pública OK; novas APIs negam acesso sem sessão. Sem migração ou movimentação real. Registro: `docs/deployments/2026-10-26-churume-acessos-ia.md`. As seções “local/não publicado” anteriores à retomada são históricas; esses lotes agora foram incluídos nesta publicação. Editor livre de departamentos/autoridades e tetos de alçada por valor continuam planejados; cobertura visual individual total e fornecedores externos seguem os limites do dossiê.

## Campanha Churume e acessos · 26/10/2026 · local

Correções do dossiê25/10 integradas com ciclo completo de usuário, autorização server-side, auditoria cadastral, tarefas autoritativas e CAS da licença IA. PostgreSQL18 instalado localmente para clusters descartáveis; runner aplica migrações e valida transações, backup/restauração e HTTP autenticado. Navegador com duas sessões locais confirmou solicitação pendente, aprovação, login, consulta sem edição, revogação de módulo, suspensão de sessão e reativação exigindo login novo. Corridas de login/suspensão e configuração IA receberam regressões SQL. Novos achados de onboarding SQL/contexto/identidade demonstrativa no acesso real foram corrigidos. Relatório consolidado em `docs/testing/churume/2026-10-26-correcoes/resultado.md`; detalhes por frente na mesma pasta. Sem publicação, migração ou conexão produtiva. Departamentos/módulos/alçadas existentes preservados; extensão de catálogo livre e tetos por valor está planejada em `departamentos-modulos-alcadas.md`. Acordos mantém histórico completo por decisão explícita do usuário26/10.

## Churume · 25/10/2026 · correções locais

Perfil em `docs/testing/agents/churume.md`; diagnóstico original preservado e resultado em `docs/testing/churume/2026-10-25-correcoes.md`. C01–C07 corrigidos com regressões; limites/histórico Comercial e envio transacional de comissões protegidos no servidor. Recompra real recebeu escolha explícita Sim/Não autorizada pelo usuário: principal aberto, mesma empresa/cedente, reserva contra repetição, aplicação/estorno coordenados e instrução bancária 02 quando cabível. Não presume encargos, parcial, compensações avulsas ou liberação automática de retenção posterior. Autoridade, fontes transitórias e fila bancária protegidas; confirmação somente retorno. Contrato em `docs/ARCHITECTURE.md` e `docs/integrations/CNAB400.md`.

Verificação: `npm run check` 869 aprovados/18 ignorados; build passou. Teste oscilante de devolução corrigido para usar o comando realmente vencedor, sem alterar regra financeira. Revisão independente e conferência visual realizadas; SQL nativo e integrações externas não homologados. Sem publicação ou migração. Prévia isolada porta 5175, `?screen=repurchase` para simular escolhas; não executa efeitos reais.

## Limites de IA · 25/10/2026 · implementação local

Pedido: teto geral e distribuição por usuário. Unidade: tokens mensais UTC. Nova API `/api/intelligence/budget` e painel de limites em Inteligência e IA; modo compartilhado preserva comportamento atual, modo individual exige cota. Política versionada em `IntelligenceBudgetPolicy/monthly`, uso por ator derivado da última reserva/liquidação. Ambos os tetos sob lock do tenant antes do provedor; autoria, vínculo e permissão server-side, sem reset de uso e sem migração. Save legado de licença agora transacional, adquire lock antes de consultar política, evitando restaurar teto com snapshot antigo. Revisão independente encontrou essa corrida; corrigida com teste RED→GREEN. Verificação: typecheck/lint/formatação e build aprovados, suíte final 770 aprovados/16 ignorados. Teste preexistente de devolução oscilou antes de passar isolado e na suíte final; não alterado. PostgreSQL nativo indisponível localmente, incluindo dois novos casos reais preparados mas ignorados. Sem publicação deste novo lote. Plano: `docs/superpowers/plans/2026-10-25-limites-ia.md`.

## Refinamento, bancos e copiloto · 25/10/2026 · publicado

Código `3f0e588`: visual aprovado, bancos/remessas em Configurações e respostas pontuais do copiloto; cabeçalho e botão interativo com degradê original. Lote isolado com 744 testes aprovados/14 ignorados, builds local/remoto aprovados, serviço ativo e saúde interna/pública OK. Sem migração ou movimentação real. Correção paralela da Agenda Inteligente preservada localmente e excluída desta publicação. Registro em `docs/deployments/2026-10-25-refinamento-bancos-copiloto.md`. Checkout principal mantém alterações locais; publicação saiu de worktree isolado para origin/main.

## Agenda Inteligente · 20/10/2026 · correção local

Relato de pendências que somem como concluídas. Efeito de reconciliação rodava após carregar tarefas, antes de operações/carteira/notificações; lista vazia era tratada como resolução. Banco produtivo confirmou `portfolio-overdue` concluída por evento automático `resolved`, sem conclusão humana. `reconcileTasks` agora preserva estado com `sourcesReady: false` e reabre somente conclusão automática cujo alerta reaparece. Raiz exige fontes carregadas sem erro e notificações do tenant atual; simulação de usuário não reconcilia. Rebase preserva comando humano concorrente; resolução automática limpa adiamento. Check: 732 aprovados/14 ignorados, build e revisão independente aprovados. Sem migração nem correção SQL de dados. Publicação pendente.

## Pagamentos e cobrança · 20/10/2026 · publicado

Desenho aprovado: orientar ausência de conta pagadora habilitada, explicitar saldo e reunir cobrança no Financeiro. `finance-ui.tsx` mostra opção explícita quando não há conta ativa da empresa e atalho para Bancos; saldo projetado avisa insuficiência/mínimo sem mudar a regra de registro com saldo negativo. `tabs/collection-tab.tsx` reúne BankingPanel existente e posição bancária da carteira filtrada por empresa; aba Cobrança e atalho nas liberações. Sem migração, alteração de autorização ou transmissão bancária. Regressões de interface em `tests/finance-payment-view.test.ts` e `tests/finance-collection-view.test.ts`. Publicado código `b4fe8f5`; check integrado com 727 testes aprovados/14 ignorados, build local/remoto aprovados e saúde pública OK. Evidência em `docs/deployments/2026-10-20-financeiro-cobranca.md`.

## Radar e score · 20/10/2026 · publicado

Usuário aprovou cards compactos e fontes oficiais BCB, CVM e Agência Brasil. Corrigida união por CNPJ formatado em `use-home-metrics` via `qualityHistoriesForExposure`, preservando contrato de `cedentExposure`; regressão reproduziu score ausente e passou após correção. Radar usa abas Interno/Score/Mercado, média ponderada por exposição, alertas de carteira e componentes da nota. `src/server/home/market-news.ts` lê somente três feeds oficiais fixos com cache público de dez minutos, timeout, limite de bytes, validação de links e datas. Fontes reais consultadas e parser validado com RSS/Atom; relevância é classificação temática determinística, sem IA nem envio de dados internos. Sem nova migração. Check isolado: 718 aprovados/14 ignorados; build aprovado. Revisão independente sem bloqueios após restringir normalização à união de histórico/exposição. Publicado código `861cd07` em produção. Serviço e saúde interna/pública ok; radar com tenant sem sessão retorna 401. Verificação somente leitura da carteira real: 36.998 títulos, 69 cedentes expostos e 69 scores calculados, posição 02/10/2026. Oito notícias das três fontes oficiais retornaram no servidor, sem fonte indisponível. Evidência em `docs/deployments/2026-10-20-radar-score.md`.

## Decisões administrativas · 20/10/2026

Logs produtivos confirmaram `23514` nas constraints legadas `access_change_requests_check1/check2`, incompatíveis com decisão própria do ADMIN já autorizada no servidor. Migração `20261020115441_allow_admin_access_change_decisions.sql` aplicada e registrada em produção; substitui ambas por trigger que confere ADMIN ativo e vínculo ao tenant. Decisão é registrada antes de aplicar perfil, na mesma transação, permitindo validar privilégios vigentes. Cliente trata respostas vazias/inválidas sem erro cru de JSON. Regressão SQL em `tests/access-admin-decisions.sql` usa apenas tabela temporária, sem decidir pedidos reais. Check: 711 aprovados/14 ignorados; build aprovado; regressão SQL aprovada antes e depois da aplicação.

## Complemento de pendências de acesso · 19/10/2026

Relato humano confirmou pedido próprio de Henrique pendente: o lote anterior não havia coberto POST/PUT legado nem notificação. Administrador vigente agora decide solicitação própria preservando conferência do perfil original; POST legado aplica diretamente a alteração administrativa. Solicitações pendentes projetadas na Central por tenant, inclusive as antigas, com resolução automática do aviso. Check 700 testes aprovados/14 ignorados; build aprovado e revisão independente sem bloqueios. Publicado b110080, serviço ativo e saúde pública ok; solicitação real preservada para decisão do usuário.

## Correção administrativa · 19/10/2026

Usuário determinou acesso completo para administradores e edição direta de usuários. Administrador ativo recebe todas as permissões efetivas no servidor e no cliente, preservando tenants, empresas e alçadas. Edição administrativa usa Salvar acessos com confirmação e auditoria; gestores conservam aprovação independente para mudanças críticas. Removido autosave global que ocultava erros. Mensagem da liberação esclarece atuação do administrador no Financeiro. Check: 695 testes aprovados/14 ignorados; build e runner PostgreSQL isolado aprovados. Publicado código 4f96d0f, serviço ativo e saúde pública ok; registro em docs/deployments/2026-10-19-acesso-administrativo.md.

## Copiloto publicado · 18/10/2026

- O usuário aprovou as três camadas (dados, comportamento, aprendizado), respostas verificáveis e “Ver mais”. Implementação em `src/server/copilot/`, `src/domain/copilot/` e componentes de relatório/memória da feature.
- A rota de chat passa a consultar fatos completos autorizados e a usar o modelo somente como interpretador restrito de intenção, com confirmação para sugestões novas. A reserva de orçamento server-side de outro lote foi preservada.
- Memória, revisões e snapshots exigem `20261018054805_copilot_evidence_memory.sql`. Migração validada com PostgreSQL isolado de teste; **aplicada e registrada em produção**. Sem as tabelas novas, a API informa indisponibilidade.
- O conector de mercado fica desativado por padrão; `STRATO_MARKET_INDICATORS_ENABLED=true` libera somente CDI diário/SGS 12 e meta Selic/SGS 432, sem dados do cliente na requisição. Outras bases externas são bloqueadas no Copiloto.
- Contrato e limites canônicos: seção 10 de `docs/ARCHITECTURE.md`. Não confundir histórico comportamental com regra de crédito ou treinamento de modelo.
- Verificação deste lote: `npm run check` aprovado com 657 testes passando e 12 ignorados; build aprovado. Persistência/imutabilidade/RLS verificadas em PostgreSQL isolado e interface conferida com fixture local em navegador. Publicação autorizada concluída com código `2696f34`: lote isolado aprovado com 427 testes, build remoto e saúde pública confirmados. Registro em `docs/deployments/2026-10-18-copilot.md`. As demais melhorias operacionais locais continuam fora desse lote.

Este arquivo é o ponto de retomada para Claude Code e outros agentes. Antes de alterar o projeto, leia também `README.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md` e `docs/DEPLOY_HOSTINGER.md`.

## Ajuste de liberação — 18/10/2026

Preparador autorizado pode enviar a OP ao financeiro sem segunda pessoa obrigatória; pagamentos e estornos preservam a permissão financeira.

## Onde paramos

Última atualização: **19/10/2026**. Publicação integral das correções operacionais concluída, código 7a8af46, serviço e saúde pública verificados. Integração preserva o Copiloto já publicado; resultado final em `docs/deployments/2026-10-19-operacional.md`.

## Melhoria local após auditoria

- Ajuste local de condução individual da OP: criador autorizado pode aprovar e preparador pode enviar ao financeiro sem segunda pessoa obrigatória. Permissões e alçadas de aprovação permanecem; pagamento e estorno exigem `finance:release`. Ainda sem publicação.

- `src/domain/finance/persistence.ts` preserva lançamentos anteriores em períodos abertos e fechados, permitindo apenas acrescentar um vínculo de estorno válido e imutável após o registro.
- Estornos precisam ter referências recíprocas, mesma empresa e partidas integralmente opostas. A comparação dos fatos tolera reordenação das chaves pelo JSONB.
- `src/domain/finance/chart-import.ts` recusa reclassificação de partidas históricas; o plano pode preservar os códigos existentes ou receber novas contas.
- Regressões em `tests/finance-journal-integrity.test.ts` e `tests/finance-repository-integrity.test.ts` cobrem alterações indevidas, estornos legítimos e bloqueio antes da escrita no banco.
- O lote foi ampliado: liberação, pagamento, liquidação de ativo e devolução usam coordenação transacional no servidor, versões e idempotência. Reaquisição preserva ciclos anteriores; snapshots genéricos não podem forjar compra, registro bancário, baixa ou autoria.
- Há inicialização autorizada do Financeiro, aprovação por alçada/evidência no servidor, documentos privados com hash, OFX com ambiguidades explícitas e proveniência que não considera configuração ativa como evidência oficial.
- CNAB400 Itaú109/112 e Bradesco09/19 têm comandos próprios e arquivos auditados, sem transmissão ao banco nesta execução. Usuário informou carteira112 em captura e confirmou juros8%a.m.; a112 usa numeração atribuída no retorno02, juros mensal com base30, multa percentual/reg2 e e-mail/reg5. Usuário confirmou multa de2% a partir do dia seguinte ao vencimento (`lateFineDaysAfterDue: 1`). Dados Bradesco e homologação bancária permanecem externos; bureau e provedor de assinatura não foram informados.
- PDF/XLSX foram abertos por leitores independentes e revisados visualmente. Importação anuncia somente formatos processados. PWA oferece aviso offline, sem finanças offline. Worker de notificações é opcional e desabilitado por padrão.
- `scripts/test-postgres-isolated.mjs` cria um cluster local novo, aplica migrações e verifica coordenação/concorrência/rollback. Nunca usa a `DATABASE_URL` existente. Supabase gerenciado, deploy, volume privado produtivo e homologação externa não foram testados por esse comando.
- Alterações externas concorrentes do Copiloto e suas migrações foram preservadas. As verificações finais precisam incluir o estado conjunto antes de qualquer publicação.

O STRATO é uma aplicação operacional de recebíveis em React 19 + Vite/vinext, com APIs no mesmo processo Node e PostgreSQL privado no Supabase. O tenant produtivo padrão é `strato-demo`. O navegador nunca deve receber `DATABASE_URL`, `OPENAI_API_KEY` ou credenciais administrativas.

## Estado funcional atual

- Radar lateral da Visão geral publicado em 19/10/2026 (`dd8d4c8`): endpoint somente de leitura `/api/home/radar`, filtro server-side por módulo/empresa, consulta a cada 30 segundos, novidades pendentes e posição de score existente. Lateral a partir de 1600 px e cards adaptados à largura disponível. CDI/Selic dependem de `STRATO_MARKET_INDICATORS_ENABLED=true`; notícias dependem de fonte aprovada. Sem migração. Build remoto aprovado, serviço ativo e saúde interna/pública ok; radar sem sessão retorna 401. Evidência em `docs/deployments/2026-10-19-radar-home.md`.

- Autenticação, sessões, permissões, empresas, cadastros, operações, carteira, financeiro, comercial, tarefas, políticas, integrações e parâmetros operacionais possuem persistência server-side em diferentes níveis de maturidade.
- O Copiloto usa a OpenAI Responses API somente para interpretação e síntese. Cálculos, elegibilidade, preço, alçadas e movimentações financeiras continuam determinísticos.
- Licença, ativação, estado, orçamento e consumo da IA agora são persistidos por tenant em `private.intelligence_states`.
- O consumo de tokens é somado somente no servidor (`recordIntelligenceUsage`, chamado por `/api/copilot/chat`); o `PUT /api/intelligence/state` (exige `settings:manage`) nunca altera `used_tokens`.
- Parâmetros operacionais usam gravação direta com `settings:manage` por decisão do Henrique (15/10/2026); não reintroduzir maker-checker sem pedido explícito.
- Central do Dia: `taskSyncVisibleTo`/`syncTaskState` definem o recorte de sincronização; GET, validação do PUT e resposta do PUT devem usar o mesmo recorte, e o escopo de empresa vale também para administradores.
- Lastro: operação sem `lastroPrecheckRequired` nunca é dispensada pelo motor; a exigência é resolvida pelo cadastro do cedente (`withResolvedLastroPrecheck`).
- Abrir a tela de Inteligência e IA não dispara mais um teste automático de conexão. O teste é explícito, evitando oscilações de estado por falhas transitórias.
- Atualizações assíncronas da IA usam setters funcionais para não sobrescrever orçamento, licença ou consumo alterados enquanto uma requisição estava em andamento.
- A migração `20261015043300_persist_intelligence_configuration.sql` já foi aplicada ao projeto Supabase de produção STRATO.
- O lote atual também consolida melhorias em gestão por exceção, delegação de decisões, métricas da home, validações de lastro, preço, risco e parâmetros cadastrais.

## Arquivos centrais da correção de IA

- `app/api/intelligence/state/route.ts` — leitura e gravação autenticada da configuração.
- `src/server/intelligence/repository.ts` — repositório PostgreSQL privado.
- `src/app/intelligence-client.ts` — cliente da API de estado e da conexão OpenAI.
- `src/app/strato-app.tsx` — carga inicial e persistência serializada/debounced.
- `src/features/settings/ai-configuration-panel.tsx` — teste manual e apresentação do estado.
- `src/domain/intelligence/model.ts` — modelo e validação server-side.
- `tests/intelligence-state.test.ts` — cobertura de validação e orçamento.

## Banco e segurança

- Projeto Supabase de produção: `STRATO` (`uxiftdglkajfexpqelzu`), região São Paulo.
- As tabelas de negócio ficam no schema `private`, com RLS forçada e sem grants para `public`, `anon` ou `authenticated`.
- O aplicativo acessa o PostgreSQL somente no servidor por `DATABASE_URL`.
- A autorização das APIs deve continuar usando a sessão interna (`sessionPrincipal`) e permissões do STRATO; não confiar em tenant ou usuário enviados no corpo.
- Migrações ficam em `supabase/migrations/`. Não recriar ou renomear migrações já aplicadas.

## Produção

- URL: `https://strato.2.25.193.82.sslip.io`
- Servidor SSH configurado localmente com o alias `servidor`.
- Aplicação: `/srv/strato/app`
- Serviço: `strato.service`
- Usuário do processo: `strato`
- Proxy: Caddy → `127.0.0.1:3002`
- Variáveis secretas ficam somente em `/srv/strato/app/.env`; nunca versionar esse arquivo.

Fluxo seguro de publicação:

1. Validar localmente com `npm run check`, `npm run build` e, quando aplicável, `npm run audit:production`.
2. Publicar `main` no GitHub.
3. No servidor, confirmar que `/srv/strato/app` está limpo e executar como usuário `strato`: `git pull --ff-only origin main`, `npm ci` e `npm run build`.
4. Reiniciar com `systemctl restart strato.service`.
5. Confirmar `systemctl is-active strato.service`, `http://127.0.0.1:3002/api/health` e a URL pública `/api/health`.

## Como retomar

Ao receber a pergunta “onde paramos?”, responda com este resumo e depois confira o estado real antes de prometer qualquer coisa:

1. `git status --short` e `git log -5 --oneline --decorate`.
2. Testes/build atuais, sem confiar apenas neste documento.
3. Migrações locais versus Supabase antes de criar nova DDL.
4. Saúde do serviço e logs recentes se o assunto for produção.

## Pendências conhecidas

- A chave OpenAI está configurada no servidor produtivo, mas não no `.env.local`; o desenvolvimento local mostra “Credencial ausente” até receber uma chave própria.
- O status de disponibilidade da IA é validado manualmente na tela. Falhas de resposta do Copiloto não devem apagar licença ou orçamento.
- Os avisos globais dos advisors do Supabase sobre tabelas privadas sem policies são esperados neste desenho: o schema é privado, os grants públicos foram revogados e o acesso ocorre pelo servidor. Ainda assim, revisar qualquer novo aviso de nível `WARN` ou `ERROR`.
- Não remover nem reformatar alterações de domínio sem confirmar o impacto cruzado: operação, carteira, financeiro, cadastro, home e Copiloto compartilham modelos.

## Critério de encerramento de qualquer próxima tarefa

- Preservar alterações não relacionadas.
- Adicionar ou atualizar testes para regressões.
- Rodar verificação completa imediatamente antes de commit/deploy.
- Registrar no `CHANGELOG.md` e atualizar este arquivo quando o ponto de retomada mudar materialmente.

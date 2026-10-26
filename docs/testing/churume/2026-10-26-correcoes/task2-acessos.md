# Task2 — ciclo de acesso, departamento, módulos e alçadas

Data: 26/10/2026. Escopo exclusivo acesso/auth/painéis autorizados, checkout compartilhado. Sem migração, commit, deploy, banco remoto ou credencial real.

## Correções

| ID | Causa comprovada | Correção | RED → GREEN |
| --- | --- | --- | --- |
| CFG-03 | UsersAccessPanel renderizava criação/edição sem users:manage | `can(authenticatedUser(state), "users:manage")`; editor fieldset desabilitado, criação/preview ocultos, handlers também recusam; painel de alçadas recebe `canManage` com default false | access-readonly-view: 2 falhas iniciais; consulta/suspenso/gestor/alçadas aprovados após correção |
| ACC-01 | authenticatedUser desconsiderava usuário suspenso e assumia primeiro usuário (admin na seed); identidade ausente fazia mesmo | identidade real preservada independente de status; ausência devolve perfil suspenso sem concessões | access-control: 2 falhas→12 aprovados; readonly suspenso passou |
| ACC-02 | authenticateCredentials procurava COALESCE(cpf,'')='' para login textual; dígitos removendo letras podiam atingir CPF de outra identidade | lookup CPF recebe null salvo identificador estritamente numérico/formatado com CPF válido; email/login continuam comparação exata | access-identity: regressão falhou '' versus null; 4 aprovados depois; prova SQL real preparada |
| ACC-03 | criar usuário com email opcional omitido consultava igualdade email='' e colidia com outro sem email | parâmetro null na comparação, mantendo login/CPF únicos | access-managed-creation falhou→passou; cenário dois usuários reais no teste PG |
| ACC-04 | JSON null, campo de texto numérico, membro null e motivo numérico escapavam validação e lançavam TypeError | validação formato/tipos nas rotas auth/session, auth/requests, access/users e access/change-requests | access-route-validation: 8 falhas iniciais; 12 aprovados depois |
| ACC-05 | suspensão bloqueava consulta naquele instante, mas sessão não era revogada; reativação restaurava cookie antigo | aplicar perfil não ativo revoga todas sessões abertas desse usuário; reativação exige autenticação nova | access-session-revocation falhou→passou; PG confere cookie antigo após reativação |
| ACC-06 | arrays tenantIds/companyScopes/authorityIds aceitavam números, objetos e string vazia | governança exige identificadores textuais não vazios | access-governance: 5 regressões falharam→7 casos passaram |

CPF/login: a correção não elimina autenticação por CPF formatado. Comparação aceita CPF válido informado integralmente; um nome arbitrário com dígitos não é convertido em identidade CPF.

Suspensão: estado e credencial já eram checados no servidor por consulta. ACC-01 era fallback incorreto na identidade/autorizações locais, não demonstração de bypass no servidor. ACC-05 evita reutilização de sessão após reativar.

Usuário administrativo criado pending mantém permissões padrão **armazenadas**, mas essas permissões não produzem sessão/efeito antes da ativação. Cadastro público pending começa sem permissões. Não removi padrões de criação administrativa nem classifiquei armazenamento sem efetividade como concessão indevida.

## Interfaces para agente principal

- `PolicyApprovalPanel` ganhou `canManage?: boolean`, default false. `SettingsModule` deve passar `canManage={can(authenticatedUser(access), "settings:manage")}`; agente principal é dono desse arquivo.
- `UsersAccessPanel` mantém props anteriores; calcula autorização internamente. Gestor com users:manage pode preparar alterações críticas; admin vigente mantém exceções administrativas já previstas nos testes. Nenhuma redução de maker-checker de políticas/integrações/operações.
- `authenticatedUser` agora devolve usuário suspenso correto ou objeto sem privilégios quando identidade ausente. Chamar `can()` para efetividade; não assumir que objeto retornado significa sessão ativa.
- Rotas mantêm contratos de sucesso. Corpos inválidos respondem 400, edição sem users:manage continua 403, duplicidade gerenciada continua 409.
- `principalForSession` já recarrega permissões, alçadas vigentes e empresas a cada requisição; não foi introduzido cache de autorização.

## Execução e verificação

1. Primeira suíte RED de readonly/payloads: 10 falhas, 5 aprovados. Isso separou causas e confirmou testes antes de alterar produto.
2. RED adicionais observados: identidade ausente/suspensa (2), CPF textual (1), email omitido (1), sessão não revogada (1), identificadores inválidos (5), mensagem readonly alçadas (1).
3. Execução dirigida final após ACC-07: **67 testes aprovados em13 arquivos; 3 testes PostgreSQL pulados por ausência da variável isolada (um quarto cenário PG foi acrescentado depois, pendente do runner)** (14 arquivos totais). Inclui todos testes access modificados/existentes, operation-server-approval-policy, internal-password e postgres-access-lifecycle. Somar apenas casos únicos, não reexecuções.
4. Lint dirigido nos arquivos desta frente e `git diff --check` executados sem falha. Typecheck global foi executado; última saída não contém erros desta frente, mas aponta arquivos de outras frentes ainda em edição. Principal executará check/build integrado.
5. **PostgreSQL e navegador ainda dependem do agente principal.** Testes com mocks/SSR não são evidência de clique ou PostgreSQL.

## Cenário PostgreSQL/HTTP preparado

Arquivo: `tests/postgres-access-lifecycle.test.ts`. Usa handlers HTTP reais importados, `Request`/`Response`, sessões/cookies/PBKDF2/repositório/SQL reais; não substitui autenticação nem banco por mock. Não equivale a HTTP sobre socket ou navegação.

Guardas: só habilita com `STRATO_TEST_DATABASE_URL`; hostname exatamente 127.0.0.1; porta explícita diferente de5432; conexão de processo `DATABASE_URL` deve ser exatamente a variável isolada. O runner de cluster descartável do agente principal fornece conexão e migrações. Nunca extrair/reutilizar conexão existente.

Cada cenário cria tenant/admin/identidades com prefixo CHURUME e sufixos únicos. Dados ficam no cluster descartável, sem limpeza destrutiva de dados anteriores. Senha sintética exclusiva dos testes: `ChurumeLocal2026Aa`. Nenhuma credencial real é usada ou exibida.

| Cenário real preparado | Asserções |
| --- | --- |
| Cadastro público completo | pending, sem sessão antes aprovação; duplicidade não cria outro cadastro; permissões públicas vazias; aprovação só via admin |
| Login/escopo/revogação | senha errada recusa; login/CPF/email corretos; cookie HttpOnly; usuário sem users:manage recebe403 ao editar diretório mesmo enviando access=admin; módulo sem permissão negado; troca empresa/revogação afeta mesma sessão; tenant estrangeiro401 |
| Suspender/reativar/logout | sessão aberta fica401; login suspenso401; reativação exige login novo e cookie velho continua401; DELETE logout revoga token |
| Criação administrativa | senha fraca400; duplicidade409; dois usuários sem email criados201; pending não autentica; login inexistente não atinge usuário com CPF vazio |
| Gestor/autoelevação | users:manage alcança módulo; PUT autoelevação409; proposta cria pendência sem aplicar; aprovação própria403; administrador independente aplica200 e sessão aberta recebe concessão autorizada |
| Competência decisória | usuário Cadastro com áreas Cadastro+Risco e risk:decide inicialmente sem autoridade; atribuir credit-director aparece em mesma sessão; expirar assignment remove competência; remover risk:decide não remove autoridade mas impede decisão que exige ambos; revogar autoridade afeta sessão aberta |
| Rastreabilidade | eventos consultados no PG por tenant/subject; autoria da aprovação/alterações corresponde admin autenticado |

Para interface real, principal deve preparar perfil/tenant também no servidor local e executar criação→configuração→ativação→login→suspensão. Os tenants únicos do teste PG podem ser consultados pelo prefixo CHURUME no banco descartável; não divulgar hashes/cookies.

## Modelo existente e limites

- Departamento: enum de sete áreas em `daily-briefing.ts`; área principal + `functionalAreas`, persistidas em user_function_assignments. Não existe tela CRUD para criar departamentos arbitrários.
- Módulo/ação: catálogo `allPermissions` e `viewPermissions` em domain/access/model.ts. Permissões são explícitas; área sugere defaults quando administrador muda perfil. Não são prova de autoridade decisória.
- Autoridade: `AccessUser.authorityIds`, authority_assignments com validade. UI de atribuição existente oferece credit-director. API aceita identificadores textuais; regra por empresa oferece autoridades vigentes existentes no banco, validada no servidor.
- Alçadas por empresa: `PolicyApprovalPanel` + `/api/operations/approval-policy`; slots incluem identificador, autoridade e permissão Risco/Controladoria; proposta/conferência, versão/idempotência e escopo empresarial. Testes `operation-server-approval-policy` cobrem autoaprovação, autoridade inexistente, empresa fora escopo, concorrência e slots duplicados.
- Aprovar operação exige permissão do slot **e** authorityId **e** assignment vigente **e** empresa do principal (`src/server/operations/approval.ts:107`). Departamento sozinho ou admin com permissões não substitui autoridade vigente.
- Não existe teto monetário livre por usuário no AccessUser ou ApprovalSlot. `AuthorityGrant.maximumAdditionalExposureCents` é concessão de exceção específica de operação/cedente/política/versão/validade, com regras determinísticas existentes. Não inventei limite monetário global no painel de acesso.
- ACC-07: navegação agora permite Configurações para users:manage sem settings:manage, exclusivamente para alcançar gestão de usuários. Regressão nova falhou antes e passou após alterar viewPermissions; settings:view isolado continua sem abrir módulo. Agente principal restringe SettingsModule à seção Usuários e acesso nesse perfil; concessão de settings:manage não foi adicionada.

## Extensão futura concreta, sem novo produto nesta correção

Se cadastro livre de departamentos/alçadas/tetos por valor for requisito: uma definição canônica versionada por tenant, inativação lógica e histórico, referências por ID nas atribuições; publicação governada de regras por empresa; verificação de vigência/escopo/valor exclusivamente servidor. Migrar os IDs existentes sem renomear migrações aplicadas; preservar snapshots das decisões. Teto monetário exige definir base (bruto/líquido/exposição adicional), moeda, faixa e combinação de aprovadores antes de modelar. Não criar catálogo só no navegador nem confundir teto de usuário com limite de crédito do cedente.

## Complemento autorizado — isolamento da navegação, CFG-05 e integração IA

Arquivos adicionais autorizados pelo principal: `src/features/settings/settings-module.tsx`, `src/features/registry/bank-account-approval-panel.tsx`.

- SettingsModule deriva seção efetiva das permissões atuais: users:manage sem settings:manage monta somente Usuários e acesso. Menu, breadcrumb, atalhos e modal empresarial não expõem demais seções. Pedido bancário inicial não contorna restrição; revogação de settings:manage desmonta seção anterior imediatamente. Carga e gravação de padrões operacionais não executam sem autorização de configuração.
- Integração IA mantém prop `PolicyApprovalPanel.canManage` anterior. Novas props: `intelligenceReady?: boolean` (default true), `intelligenceError?: string`, `onRetryIntelligence?: () => void`. Erro/carga não confirmada aparecem em alerta/status, com repetição; licença/uso ficam bloqueados inclusive nos handlers. Demonstração informa “Demonstração · sem conexão real”, não recebe data-ready, e repassa demoMode a AIConfigurationPanel e OutboxHealthPanel. Estados/rollback/persistência globais continuam pertencendo ao principal.
- **CFG-05 corrigido:** erro ao carregar fila bancária permanece visível com “Tentar novamente”; atualização manual disponível. Snapshot anterior continua exibido; decisões ficam bloqueadas durante atualização ou após falha, até reconfirmação bem-sucedida. Erro inicial não se confunde com fila vazia.
- RED: quatro testes de fronteira SettingsModule e dois da fila falharam antes das alterações. GREEN: os seis passaram. Harness executa componente com hooks controlados, callbacks e promessas; não é navegador nem banco real.
- Lint dirigido e formatação passaram nos quatro arquivos. Typecheck global posterior apontou somente `src/app/strato-app.tsx:1546` (ManagedTask.operationId, integração de outra frente); nenhum erro nos arquivos deste complemento.
- Verificação cruzada final do complemento: **31 testes aprovados em6 arquivos** (settings-access-boundary, bank-approval-queue-recovery, access-readonly-view, access-control, bank-account-maker-checker, bank-settings-view). `git diff --check` dos arquivos adicionais passou.

# Task1 — revisão cruzada de acessos e operações

26/10/2026. Revisão independente de Task2/Task3 e suplemento pontual da raiz. Excluídos R1 registry e R3 intelligence em edição. Sem publicação, migração ou banco externo. Única correção de produto desta revisão: corrida de sessão, autorizada pelo principal após reprodução.

## Achados

### RC-01 · P1 · suspensão concorrente não revogava sessão emitida depois · corrigido

Antes: `loginSession` verificava senha e inseria sessão em comandos separados. Suspensão concluía entre ambos e revogava somente sessões já existentes. Login em trânsito criava sessão posterior; reativação restaurava validade desse cookie, contrariando exigência de nova autenticação.

Reprodução com PostgreSQL descartável real, PBKDF2, `loginSession`, `applyAccessUserProfile` e `principalForSession`: pausar sucesso da senha antes do reset de tentativas; concluir suspensão; retomar login; reativar; consultar principal com token emitido pelo login em trânsito. RED recebeu principal ativo onde esperava `null`. Cinco cenários existentes passaram; novo cenário falhou.

Correção em `src/server/access/session.ts:36`: transação bloqueia usuário antes de autenticar e mantém lock até inserir sessão. Suspensão atualiza mesma linha antes de revogar sessões; portanto espera emissão e revoga também cookie recém-emitido. Aquisição antes de UPDATE da credencial evita inversão usuário/credencial. Sem suporte transacional, login recusa emissão.

Regressão durável: `tests/postgres-access-lifecycle.test.ts:165`, cenário “suspensão concorrente ao login revoga também sessão emitida durante autenticação”. Interceptador apenas coordena momento da chamada; SQL, locks, hash, persistência e validação de sessão são reais. Teste observa suspensão concluída ou bloqueio real antes de liberar login. GREEN: seis testes PostgreSQL aprovados.

Evidência: `evidencias-revisao-cruzada/session-race-red.log` e `session-race-green.log`.

### RC-02 · P2 · criação CCB bloqueada permite conversão de rascunho existente · encaminhado Task3

`src/server/operations/governance.ts:117` verificava origem CCB somente quando `!current`. Operador autorizado cria rascunho manual, depois atualiza `source: "Crédito estruturado"` e `operationType: "CCB"`. Validação do payload, permissão operacional e guarda de transição aceitam conversão; criação direta com mesmo objeto é recusada.

Sonda executou `validatePersistedOperation`, `operationMutationPermissionError` e `assertOperationTransition` reais, conforme sequência da rota PUT. Conversão aceita com `operations:edit`; criação direta rejeitada. Evidência durável: `evidencias-revisao-cruzada/ccb-conversion.test.ts.txt`. Não equivale a requisição HTTP/SQL desse cenário, nem demonstra liberação financeira de CCB. Risco comprovado: modalidade declarada indisponível contorna bloqueio pela alteração de origem.

Principal autorizou correção e recebeu localização; Task3 notificado. Consulta/cancelamento de legado devem continuar permitidos. Estado descrito corresponde à reprodução anterior à correção subsequente da outra frente.

## Demais verificações

- Retorno ao Risco: sessão/permissão/empresa, comando estrito, lock financeiro e da operação, versão, replay vinculado a ator/conteúdo/tenant; recusa liberação preparada; corte de concessões anteriores, preservação de auditoria e reconstrução de operação. Sem novo P1/P2 fechado. Replay histórico não foi tratado como bug: recibo do servidor integra sem PUT adicional e raiz protege versão atual contra snapshot mais antigo.
- Readonly/CCB: guardas de operação encerrada mantêm recusa de reescrita; seletor/construtor recusam criação direta CCB; encontrada exceção RC-02 na atualização. SSR não certificado como clique.
- Acesso: identidade ausente/suspensa não assume administrador, permissões e empresa consultadas por sessão, usuários sem gestão não gravam diretório, formulário readonly bloqueia controles/handlers. Onboarding e GET self-only pertencem a correções paralelas do principal/Task3.
- Raiz, inspeção estática `strato-app.tsx:680–1110`: `emptyAccessState` vazio, falha limpa perfil, gates aguardam acesso confirmado, mudança de status/permissões/empresas limpa domínios e cancelamento de efeitos evita aplicar loads anteriores. Nenhum P1/P2 adicional reproduzido. Concorrência entre refresh por foco/intervalo sem contador de requisição comunicada como observação, sem promovê-la a achado.

## Verificação e limites

- Sete arquivos dirigidos: **38 testes aprovados**, incluindo sonda CCB, retorno ao Risco servidor/cliente, controles Churume, access-control, readonly e revogação.
- Quatro arquivos adicionais: **20 testes aprovados**, internal-password, access-identity, access-bootstrap e access-route-validation.
- PostgreSQL lifecycle: **6 aprovados** após correção; documentos backup/restore: **2 aprovados** na sequência do runner.
- Runner isolado não terminou integralmente verde: etapa posterior de recuperação HTTP falhou com “Fixtures de recuperação/login ausentes”, pois execução selecionou somente lifecycle. Não altera resultado dos seis testes de acesso. Cluster encerrado pelo runner. Log preservado integralmente.
- Typecheck global, lint dos dois arquivos corrigidos, formatação e diff-check dirigidos passaram.
- Banco local descartável com 40 migrações históricas; nenhuma migração criada/aplicada em banco externo. Sem testes de navegador desta frente, serviços pagos ou envio externo.

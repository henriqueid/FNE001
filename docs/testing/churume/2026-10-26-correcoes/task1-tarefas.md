# Task1 — tarefas e notificações — 26/10/2026

## Resultado

Corrigidos F01–F05, F07, F09–F11 no escopo de tarefas/notificações. Complementos: I04 (adiamento inválido), visibilidade por módulo/alçada, devolução à fila após revogação e autoria nominal por ID de sessão. Sem alteração financeira, raiz, acesso ou outras frentes. Sem commit, publicação, migração ou banco externo. Mudanças anteriores em `tasks/model.ts` e testes existentes preservadas.

## Alterações

| Área | Arquivos | Comportamento |
| --- | --- | --- |
| Fontes e comandos | `app/api/tasks/route.ts`; `src/server/tasks/service.ts`, `sources.ts`, `assignees.ts` | GET inicializa/reconcilia no servidor; operações/carteira/notificações/pedidos de acesso são lidos das fontes internas, nunca do navegador. Erro de fonte retorna503 sem concluir pendências. Lock transacional por tenant evita reconciliador sobrescrever comando humano. PUT extrai apenas intenção humana e recria evento/instante/autoria canônicos. |
| Isolamento e destinatário | `src/server/tasks/access.ts`; `src/domain/tasks/assignment.ts`; `src/domain/copilot/attention-center.ts` | Vencidos agregados por empresa, ID próprio por empresa. Escopo, permissão de módulo, permissão da ação e alçada verificados antes de entregar tarefa. Agregado legado sem empresa fica oculto. Destinatário consultado no servidor precisa estar ativo, pertencer ao tenant e possuir empresa/módulo/permissão/alçada compatíveis. |
| Histórico e episódios | `src/domain/tasks/model.ts`, `persistence.ts`; `src/server/tasks/repository.ts` | Snapshot, origem e prazo imutáveis em comando humano. Status/responsável não mudam sem evento. Conclusão humana permanece no mesmo episódio; reaparecimento ou novos títulos vencidos reabrem com histórico preservado. Redução da carteira, isoladamente, não reabre. Igualdade semântica ignora ordem de chaves JSONB. Novos eventos humanos registram ID real da sessão, sem escolher autor por nome. |
| Revogação posterior | mesmos arquivos de tarefas | Destinatário que perde acesso, empresa, vínculo ou status deixa de reter pendência ativa. GET devolve à fila original com evento automático; não reabre tarefa já concluída. Flag interna impede histórico nominal antigo de ocultar tarefa devolvida. |
| Notificações | `src/server/outbox/publisher.ts` | Limite100 aplicado após empresa/permissão/alçada/área. Reconciliador interno recebe fonte integral com audiência preservada. Notificação operacional sem operação correspondente não vira tarefa geral. |
| Central UI | `src/features/copilot/attention-center.tsx`; `src/features/shell/shell.tsx` | Recebe `AccessUser[]` e tenant; filtra destinatários por tarefa. Sem fallback para perfil sem metadados; seleção nominal explícita. Assumir/Delegar indisponíveis quando incompatíveis. Adiamento vazio, inválido, passado ou data inexistente é bloqueado antes de converter para ISO. |

Corpos parciais/nominais inválidos são recusados sem exceção de acesso a `null`. Respostas de tarefa usam `Cache-Control: no-store`. Novos eventos, inclusive SQL de projeção do histórico, usam `actorUserId` da sessão; eventos antigos permanecem intactos, sem atribuição retroativa inventada.

## RED → GREEN

Evidências: [evidencias-task1](evidencias-task1/).

- `red-dominio.txt`: seis regressões falharam antes da primeira correção: agregado entre empresas, legado sem empresa, episódio novo, alteração sem evento, corpo parcial e limite antes do escopo.
- `red-api.txt`: GET inicial não criava estado/novos alertas e não tratava erro das fontes; demais casos dependiam dessa inicialização. Sondas anteriores preservadas em `2026-10-25-campanha-total/evidencias-transversal/sondas-transversal.test.ts.txt` documentam aceitação original das adulterações/delegações. Testes finais executam os caminhos negativos com estado inicial real do novo serviço, usando adaptador de banco.
- `red-episodios.txt`, `red-concorrencia.txt`: falhas de recorrência sem janela vazia, revogação de módulo em legado, tipo de data e atualizações fictícias por ordem JSONB.
- `red-snapshot.txt`, `red-audiencia.txt`, `red-apresentacao.txt`: snapshot junto com evento, permissão de ação sem módulo, destinatário inválido, notificação órfã e metadados perdidos antes do sino. A sonda de snapshot foi ajustada para clonar o estado e não compartilhar referência entre antes/depois; regressão final testa objetos independentes.
- `red-ui.txt`: Central permitia destinatário incompatível/fallback; helper de adiamento ainda ausente. `red-revogacao.txt`, `red-cache.txt`, `red-autoria-nominal.txt`: atribuição retida após revogação, cache sem proteção explícita e ausência do ID da sessão no evento humano.
- `green-final.txt`: **10 arquivos, 84 testes aprovados**, sem ignorados nesse recorte.
- `typecheck-final.txt`: TypeScript aprovado no checkout integrado no instante da verificação.
- `lint-final.txt`: lint dirigido aprovado.
- `format-final.txt`: formatação dirigida aprovada.
- `git diff --check` dirigido aprovado.

Testes novos: `tests/task-security.test.ts`, `task-route-security.test.ts`, `task-attention-view.test.ts`, `task-snooze.test.ts`.

Comando final dirigido: `env -u DATABASE_URL -u OPENAI_API_KEY npx vitest run tests/task*.test.ts tests/copilot-attention-center.test.ts tests/outbox*.test.ts`.

Também executada suíte integral durante implementação: **957 aprovados,25 ignorados,2 falhas**. Falhas pertenciam à frente principal ainda em edição: `churume-live-provenance.test.ts` (presença desconhecida não implementada naquele instante) e `churume-portfolio-coverage.test.ts` (`seedPortfolio` chamado com objeto, `ops.find` inválido). Log `suite-antes-revisao.txt` preservado; esse resultado intermediário não é apresentado como aprovação integral final. Integração principal executará suíte global/check/build após estabilização das frentes.

## Contrato para integração

API preservada:

- GET `/api/tasks` → `{ tasks: TaskState }`, com estado já inicializado, reconciliado e recortado. Qualquer fonte indisponível →503, sem alterações automáticas.
- PUT `/api/tasks` recebe `{ tasks, expectedVersion, commandId }`. Payload serve como intenção, não como estado autorizado. Para cada tarefa alterada exige exatamente um evento humano adicional; não admite IDs novos, histórico reescrito ou snapshot adulterado. Evento, instante e ID do autor são refeitos no servidor.403 indica destinatário/escopo;409 indica adulteração/conflito. Chave idempotente repetida não duplica evento/versão.
- Somente reconciliador interno usa opção `automatic:true` do repositório. Não exposta ao navegador.

Metadados novos, opcionais no JSON existente, sem migração:

- `AttentionItem`/`TaskSnapshot`: `company`, `requiredPermission`, `authorityId`, `episodeKey`.
- `TaskRecord`: `sourceActive`, `assignmentActive`.
- `TaskHistoryEntry`: `actorUserId` nos eventos humanos novos.
- `ManagedTask`: `operationId?: string`, para hidratar apenas objeto de navegação.

Interface cliente segura:

```ts
taskAssigneeError(
  task: { view, company?, requiredPermission?, authorityId? },
  user: AccessUser,
  tenantId: string,
): string | null

taskSnoozeError(until: string, now?: string): string | null
```

Ambas em `src/domain/tasks/assignment.ts`, sem importar servidor. `Shell.taskAssignees` passou para `AccessUser[]`; shell repassa `intelligence.tenantId` à Central.

Ajuste de raiz entregue ao principal, sem edição por esta frente: reconciliação client-side exclusivamente demo; real usa snapshots do GET, sem mesclar conteúdo com builder local. `managedTasks(tasks, [])` pode receber depois apenas `operation` encontrado por `snapshot.operationId` em operações autorizadas, preservando snapshot/metadados. Raiz deve passar usuários completos ativos do tenant à shell, não reduzir a `{id,name,department}`. Backend continua validando qualquer intenção direta.

## Limites

Regras, APIs, serialização, idempotência, conflitos e rollback foram executados em adaptador isolado; fontes externas de banco substituídas por fixtures. SSR confirmou estado dos botões e mensagens da Central; não equivale a interação de navegador. PostgreSQL nativo, clique/teclado, persistência real por cookie, escopo após login de usuário criado e suíte global final ficam para integração principal. Nenhuma chamada paga, cobrança, remessa real ou conexão produtiva foi usada.

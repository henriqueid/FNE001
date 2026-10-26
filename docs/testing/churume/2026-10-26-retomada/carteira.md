# Retomada — Carteira, cobrança e checagem

Data: 2026-10-26. Ambiente: checkout local compartilhado. Escopo exclusivo: `portfolio-title-details.tsx`, `collection-center.tsx` e teste dirigido. Alterações anteriores preservadas. Sem produção, publicação, migração, banco ou serviços externos.

Método: componentes/handlers reais executados com hooks controlados; somente React hooks, portal e contexto de cadastro substituídos por harness local. Transformações `addCollectionOccurrence`, `updatePortfolioConfirmation`, `buildCollectionQueue` reais. Não houve navegador. Harness simula troca de chave React e desmontagem; não constitui prova de reconciliação React no navegador. Autoria autenticada/HTTP pertencem à fronteira da raiz, não foram revalidados nesta frente.

## Achados reproduzidos e corrigidos

| ID | Prioridade | RED observado | Correção mínima | Evidência GREEN |
| --- | --- | --- | --- | --- |
| RC01 | P2 | Dois submits do mesmo handler antes de rerender chamam persistência duas vezes; cobrança e checagem | Ref síncrona compartilhada pelos dois formulários; botão mantém estado pendente | Dois casos executados; apenas uma chamada por gravação pendente |
| RC02 | P1 | Trocar título conserva rascunho do anterior; retorno tardio pode limpar/avisar no contexto seguinte | Formulário com identidade empresa+título; guarda de desmontagem após await | Troca A→B reinicia campos; resolução de A preserva rascunho B e não anuncia sucesso em B |
| RC03 | P2 | Handler aceita data da cobrança, data prometida e data da checagem vazias | Validar presença no handler; próximo contato e notas continuam obrigatórios | Quatro casos de campos vazios recusados; dois de notas em branco recusados |
| RC04 | P2 | Trocar promessa por “Sem resposta” conserva `promiseDate` oculta no registro | Enviar data prometida somente no desfecho de promessa | Registro real do domínio não contém data prometida residual |
| RC05 | P2 | Número nacional com DDD 55 perde prefixo de país no link | Distinguir telefone nacional de número já internacional pelo comprimento | Links DDD 55 e +55 11 corretos; nenhum link aberto |
| RC06 | P2 | Telefone/e-mail principais vazios impedem usar contatos secundários cadastrados | Selecionar primeiro contato não vazio, com trim | WhatsApp e mailto secundários gerados |
| RC07 | P2 | Título com saldo zero e última ocorrência de promessa conta como promessa ativa | Exigir saldo positivo na lista de promessas | Quitado não conta; negociação histórica permanece em Acordos |

RED inicial: 13 casos, 8 falhas observadas; callbacks de falha/sucesso já preservavam corretamente campos e passaram. RED seguinte: contato secundário vazio, 1 falha. RED seguinte: promessa quitada, 1 falha. Todos corrigidos antes da execução final. RC03 demonstra defesa adicional do handler: inputs já possuem `required`; não afirmar que navegador permite submit normal de campo vazio.

## Matriz de execução

| Rotina/cenário | Estado | Limite |
| --- | --- | --- |
| Cobrança: callback pendente, true, false e rejeição | APROVADO | Handler real; nenhum servidor conectado |
| Checagem: callback pendente, true, false e rejeição | APROVADO | Parecer mantido; sucesso somente confirmado |
| Duplo submit cobrança/checagem no mesmo ciclo | APROVADO | Bloqueio síncrono real; sem clique de navegador |
| Troca título: cobrança pendente e novo rascunho | APROVADO | Hooks/key/desmontagem controlados |
| Troca título: parecer/status próprios do novo título | APROVADO | Sem reconciliação do navegador |
| Datas obrigatórias e notas em branco | APROVADO | Presença e calendário real no handler; sem introduzir regra de intervalo |
| Promessa→outro desfecho | APROVADO | Não persiste data oculta |
| WhatsApp nacional DDD55 e prefixo +55 | APROVADO | Só inspecionado href gerado; sem rede |
| Contatos secundários e ausência de contatos | APROVADO | Links ausentes sem cadastro; clipboard não executado |
| Promessa quitada | APROVADO | Não aparece como ativa |
| Acordos históricos | APROVADO | Decisão explícita preservada: `.some` no histórico; não mudar para última ocorrência |
| Fila com retorno futuro | APROVADO | Testes reais de domínio existentes dirigidos |
| Troca escopo mantendo mesmo título | NÃO EXECUTADO nesta frente | Dependência: chamador deve desmontar grade/central por companyScope; coordenação enviada à raiz |
| Subtelas completas Painel/Agenda/Promessas/Escalonamento/Relatórios por navegador | NÃO EXECUTADO | Teste de Central executou contagens e mudança para Acordos; não homologar restante |
| Clipboard real, envio WhatsApp/mailto/boleto, HTTP, CAS/autoria e banco | NÃO EXECUTADO | Fora do lote local autorizado |

## Verificação

- `npx vitest run tests/churume-portfolio-details-interaction.test.ts tests/churume-portfolio-coverage.test.ts tests/collection-future-follow-up.test.ts tests/portfolio.test.ts`: 4 arquivos, 40 casos aprovados.
- `npx eslint src/features/portfolio/portfolio-title-details.tsx src/features/portfolio/collection-center.tsx tests/churume-portfolio-details-interaction.test.ts`: aprovado.
- Prettier dirigido nesses três arquivos: aprovado.
- Typecheck conjunto inicialmente detectou dois tipos do teste desta frente (`resolve(result)`); corrigidos para boolean explícito. Também encontrou fixtures paralelas ainda em elaboração em `churume-reconcile-interaction.test.ts` e `finance-date-entry-integrity.test.ts`; comunicadas à raiz. Resultado consolidado pertence à verificação final da raiz.
- Complemento RED→GREEN: quatro casos adicionais recusam 29/02/2026 e 31/04/2026 em cobrança, retorno, promessa e checagem. Reuso de `isFinanceDate` canônico com validação de hora local; quatro falhas observadas antes da correção.
- Sem suíte global repetida nesta frente. Sem alteração de cálculo, domínio, regra de acordo, servidor ou persistência.

## Pendências para homologação

Executar navegador real para troca escopo/título com gravação pendente, foco/teclado, campos nativos de data, responsividade e clipboard. Confirmar persistência/concorrência e autoria em ambiente local isolado autorizado. Não confundir estas evidências de handler com certificação produtiva.

## Revisão independente da frente conciliação/transferência

Revisados relatório `conciliacao.md` e diffs de `reconcile-tab.tsx`/`statement-tab.tsx`. Reproduzido P2 com handler real: transferência pendente, fechar modal, reabrir no mesmo escopo/conta, resolver confirmação antiga com true. Novo modal fecha indevidamente. Teste exclusivo `tests/churume-reconcile-independent-review.test.ts`: RED de um caso, esperado modal aberto, observado fechado. Causa: token só muda com conta/escopo, não ao encerrar sessão do modal. Achado enviado à raiz e ao dono; nenhum arquivo da outra frente alterado. Dono assumiu correção e verificação GREEN posterior.

Limite adicional da revisão: efeitos do harness são descarregados logo após render; não comprova janela entre commit React e efeitos passivos nem desmontagem real. Nenhum defeito adicional foi aprovado por inspeção.

## Integração final pela raiz

Grade e Central receberam `key={companyScope}` no chamador. Revisão independente final da frente financeira executou cinco arquivos/61 casos sem novo defeito concreto. Conjunto global final e limites de navegador constam em `resultado.md`; nenhum resultado desta frente equivale a homologação visual.

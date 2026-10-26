# Evidências operações/comercial/políticas

Prova local em 25/10/2026; árvore de trabalho existente preservada. Node/Vitest locais, DATABASE_URL e OPENAI_API_KEY removidas do processo. Sem banco remoto/fornecedor. Probes reproduzem defeitos; passar o probe confirma o defeito, não aprovação da rotina.

- `churume-operations-controls-probe.test.ts.txt`: código exato executado para OP-01/02/03/04. Extensão `.txt` impede descoberta automática por Vitest. Mock de `useState` permite construir árvore e executar handlers sem navegador; fontes de integração ATIVA e `useCedents` foram controladas. SSR somente para Entrada. Nenhum teste de clique real.
- `inventario-fontes.md/json`: todos 151 arquivos do escopo; handlers com linhas. Ocorrências incluem disabled e não equivalem a número de controles.

Para reproduzir probes: copiar `.ts.txt` para `tests/churume-operations-controls-probe.test.ts`, executar comando abaixo, remover cópia ao terminar. Não sobrescrever arquivo existente.

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/churume-operations-controls-probe.test.ts
```

Resultado observado: 1 arquivo, 4 testes aprovados; execução final após adicionar OP-04: 26/10/2026 00:01:17, duração 738ms. Execução anterior: 3 testes, 23:57:03, 666ms.

Testes dirigidos executados:

```sh
env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/operation-consistency.test.ts tests/operation-workflow-guardrails.test.ts tests/operation-server-eligibility-command.test.ts tests/operation-server-exception-evidence.test.ts tests/operation-server-approval-command.test.ts tests/operation-server-formalization.test.ts tests/release-approval-integrity.test.ts tests/operation-return-server.test.ts tests/real-repurchase.test.ts tests/real-repurchase-pricing.test.ts tests/commercial.test.ts tests/commercial-access.test.ts tests/commercial-persistence.test.ts tests/commercial-history.test.ts tests/commercial-onboarding.test.ts tests/commercial-commission-command.test.ts tests/commercial-commission-client.test.ts tests/commercial-route.test.ts tests/pricing.test.ts tests/lastro-exceptions.test.ts
# 20 arquivos / 133 testes aprovados; 23:55:41; 941ms

env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/eligibility.test.ts tests/eligibility-policy-persistence.test.ts tests/policy-parameter-presentation.test.ts tests/operation-server-approval-policy.test.ts tests/operation-server-validation.test.ts tests/operation-server-approval.test.ts tests/operation-documents.test.ts tests/operation-documents-route.test.ts tests/operation-return-domain.test.ts tests/operation-finance-coordination.test.ts tests/operational-parameters.test.ts tests/operational-parameter-governance.test.ts tests/operation-persistence.test.ts
# 13 arquivos / 80 testes aprovados; 23:56:50; 685ms

env -u DATABASE_URL -u OPENAI_API_KEY npm test -- tests/intake.test.ts tests/repurchase-availability-view.test.ts tests/repurchase-bank-writeoff.test.ts
# 3 arquivos / 20 testes aprovados; 23:57:19; 388ms
```

Primeira execução do grupo de 20 teve identificador de sessão não preservado pelo wrapper; grupo repetido uma vez para guardar conclusão. Nenhuma suíte completa repetida. Relatório usa somente resultado observado da repetição, sem dupla contagem.

# Evidência dirigida de Configurações/Cadastros

Data operacional: 25/10/2026. Execução local: 23:55–23:57 UTC de 25/10. Sem `DATABASE_URL` e `OPENAI_API_KEY`; nenhuma consulta externa ou banco real.

`probes.test.ts.txt` preserva seis probes executados. Reprodução, da raiz: copiar para `tests/churume-settings-probe.tmp.test.ts`; executar `env -u DATABASE_URL -u OPENAI_API_KEY npx vitest run tests/churume-settings-probe.tmp.test.ts`; remover somente essa cópia temporária. Resultado observado: 6/6 passaram. Os testes de reprodução esperam a falha atual do produto; passar significa reproduzir o comportamento descrito, não homologar o produto.

Fronteiras: sessão e repositório substituídos por mocks, validadores e handlers HTTP reais. SSR comprova HTML renderizado, não interação de navegador. A persistência da auditoria foi inspecionada em `src/server/registry/repository.ts:281`; probes capturam o objeto entregue a essa persistência.

Suíte dirigida inicial: 22 arquivos, 105 testes, todos passaram. Complemento: `bank-account-maker-checker`, `public-data-provider`, `enrichment-provenance`, `enrichment`, `eligibility`: 5 arquivos, 28 testes, todos passaram. Seis probes únicos adicionais: total 139 casos únicos em 28 arquivos lógicos. Cinco probes foram executados antes do sexto e repetidos na execução final; não somar essa repetição.

Arquivos iniciais: access-control, access-change-maker-checker, access-governance, access-identity, access-profile-client, access-scope, access-notifications, company-destination, registry, registry-format, operational-profile, operational-parameters, operational-parameter-governance, integration-configuration, integration-provider-governance, bank-settings-view, intelligence-budget-configuration, intelligence-budget-routes, intelligence-user-budget, operation-server-approval-policy, eligibility-policy-persistence, policy-parameter-presentation (todos `tests/<nome>.test.ts`).

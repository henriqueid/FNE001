# Publicação Churume, acessos e limites IA ·26/10/2026

Publicação autorizada pelo usuário após campanha de correções. Base produtiva anterior: `47d34650ba524ffdf2a28bdfb3c3682af322ba65`. Checkout de trabalho preservado; lote isolado preparado a partir de origin/main.

## Escopo

- Limite mensal geral da IA e cotas por usuário, com reserva/consumo server-side e configuração versionada.
- Correções Churume25/26: comercial/comissões, recompra com escolha de baixa, retorno governado ao risco, cadastros/histórico, tarefas e atribuições, ciclo de usuários/permissões/sessões.
- Carteira/auditoria paginadas, importações confirmadas, proveniência/IA/datas e navegação corrigidas. Visual/degradê já publicados preservados.
- Departamentos/módulos/alçadas existentes; cadastro livre e tetos de aprovação por valor continuam planejados.
- Nenhuma migração, troca de dependências, alteração de segredo/worker ou movimentação financeira nesta publicação. Evidências/screenshots temporários e prévias locais não fazem parte do artefato produtivo.

## Verificação do lote exato

`npm run check`:1.105 aprovados/30 ignorados. Build aprovado. `npm run audit:production`:0 vulnerabilidades. Instalação aponta2 avisos em dependências de desenvolvimento, sem atualização de versões.

PostgreSQL18 novo/descartável:40 migrações,29/29 testes reais; documentos2/2. Backup/restauração:74 tabelas/1.464 linhas e hashes/metadados iguais. Login HTTP, cookie, APIs autorizadas, isolamento e logout confirmados no banco restaurado. Logs locais da publicação: `/tmp/strato-publicacao-{check,build,postgres,audit}.log`.

A cobertura visual individual total e homologações de fornecedores continuam delimitadas pelo relatório `docs/testing/churume/2026-10-26-correcoes/resultado.md`. Não transformar publicação em certificação de todos os controles ou cenários.

## Produção

Código publicado: `c132acda73718b2e03f2f760dcd8a209d97aa046`. Instalação e build remotos aprovados; serviço `strato.service` reiniciado em26/10/2026 às11:49:13 (America/Sao_Paulo), ativo. Checkout produtivo limpo no código conferido.

Saúde interna/pública respondeu `status: ok`; página pública HTTP200 com `st-refined`. `/api/intelligence/budget`, `/api/tasks` e `/api/access/users` retornaram401 sem sessão. Tela pública de login conferida no navegador; entrada demonstrativa não oferecida. Nenhum login produtivo, alteração de usuário, pagamento, transmissão bancária, migração ou segredo alterado nesta conferência.

URL: https://strato.2.25.193.82.sslip.io . Screenshot local: `docs/deployments/evidencias-2026-10-26/login-publico.png` (não versionado). Homologação externa e cobertura individual total permanecem delimitadas pelo dossiê; publicação não as declara concluídas.

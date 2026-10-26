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

Preparação validada; resultado remoto será registrado após instalação, build, reinício e conferência de saúde. Nenhuma credencial produtiva foi incluída no lote.

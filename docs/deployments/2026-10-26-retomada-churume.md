# Publicação — retomada Churume ·26/10/2026

Autorização explícita do usuário: “pode publicar”. Base produtiva `aa1aa8ba767c8dc322adfeffa34506db3f148681`. Checkout isolado para preservar alterações locais não relacionadas.

## Escopo

Calendário financeiro válido na entrada e persistência; importação de títulos; centavos/quantidade inteira no parcelamento. Conciliação, OFX e transferência com confirmação, trava síncrona e invalidação de contexto/sessão. Cobrança/checagem por título/empresa, datas, contatos e promessas ativas. Acordos conserva histórico completo.

Sem migração, dependências novas, credenciais, provedor pago, transmissão bancária ou movimentação financeira real. Homologação visual individual total permanece pendente conforme `docs/testing/churume/2026-10-26-retomada/resultado.md`.

## Evidências

Pacote exato verificado antes do commit/publicação. Logs da publicação: `/tmp/strato-retomada-publicacao-{check,build,postgres,audit}.log`. Dossiê inclui evidências anteriores RED→GREEN e revisão independente. Check completo: 1.177 aprovados/30 ignorados; build aprovado; auditoria produtiva: zero vulnerabilidades. PostgreSQL18 descartável: 40 migrações, 29 testes SQL e 2 de documentos aprovados; restauração de 74 tabelas/1.464 linhas, hashes/metadados e HTTP autenticado confirmados. Cluster encerrado.

## Produção confirmada

Código `3b99d428f78497bf02e4382fd8d004ba546246ce`, publicado em26/10/2026. Instalação/build remotos aprovados; serviço ativo desde14:26:01 (America/Sao_Paulo). Checkout produtivo limpo no código conferido. Saúde interna/pública: `{"status":"ok"}`; página pública HTTP200, visual `st-refined`. APIs Financeiro/Usuários:400 sem tenant,401 com tenant fictício sem sessão; nenhum dado exposto.

URL: https://strato.2.25.193.82.sslip.io . Conferência produtiva somente leitura, sem login real ou operações. Sem nova execução de navegador; esta publicação não certifica cobertura visual individual total. Logs da conferência de publicação preservados em `docs/testing/churume/2026-10-26-retomada/evidencias/publicacao-*.log`.

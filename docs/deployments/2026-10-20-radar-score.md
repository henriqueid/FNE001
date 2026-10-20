# Radar e score · 20/10/2026

Publicação autorizada pelo usuário após revisão da prévia. Código `861cd07` enviado a `origin/main` e aplicado por fast-forward em `/srv/strato/app`, com checkout produtivo limpo. Build remoto aprovado; serviço reiniciado e ativo; saúde interna/pública respondeu `status: ok`. API `/api/home/radar` com tenant e sem sessão retornou HTTP 401.

Score ausente era causado por comparação literal entre CNPJ formatado da exposição e documento normalizado do histórico. Normalização restrita à união via `qualityHistoriesForExposure`, preservando os contratos de alertas existentes. Abas Interno/Score/Mercado, score ponderado, componentes explicáveis e alertas por atraso. Notícias vêm dos feeds oficiais BCB, CVM e Agência Brasil, com cache público, validação de domínio/data, limite de bytes e timeout. Nenhum dado interno enviado às fontes; sem nova migração.

Check isolado aprovado com 718 testes e 14 ignorados, build aprovado e revisão independente sem bloqueios. Tela conferida em navegador, inclusive 390 px sem transbordamento horizontal, com dados fictícios. Alterações financeiras simultâneas ficaram fora do lote publicado.

Validação produtiva somente leitura usando o carregador de carteira e o mesmo motor de qualidade: 36.998 títulos, 69 cedentes expostos e 69 scores calculados; posição de origem 02/10/2026. Verificação retornou somente contagens, sem registros pessoais ou segredos. No servidor, consulta editorial retornou oito notícias das três fontes oficiais, sem falha de fonte.

Limite: não foi executada jornada autenticada no navegador produtivo. Notas reais do usuário respeitam sua política e filtro empresarial. A verificação agregada não criou usuários, não alterou carteira e não persistiu decisões de crédito.

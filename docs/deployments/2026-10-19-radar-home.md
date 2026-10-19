# Radar da Visão geral · 19/10/2026

Publicação autorizada pelo usuário após aprovação do ajuste de UX. Código publicado: `dd8d4c8`, enviado a `origin/main` e aplicado por fast-forward em `/srv/strato/app` como usuário `strato`, com diretório produtivo limpo antes da atualização.

Radar com eventos auditados/notificações, autorização no servidor por sessão, módulo e empresa, consulta a cada 30 segundos e novidades pendentes de leitura. Score reaproveita a posição calculada existente sem fabricar histórico. Lateral a partir de 1600 px; abaixo disso ocupa o fluxo da página, com cards ajustados à largura efetiva e sem rolagem interna. Não houve migração, alteração de credenciais ou ativação de conectores.

Verificação local: `npm run check` aprovado (709 testes aprovados, 14 ignorados), build aprovado e auditoria de dependências de produção sem vulnerabilidades. Layout conferido no navegador em 390, 1024, 1366 e 1600 px. A consulta real local retornou 200 após correção da serialização do filtro de empresas; o teste de chegada durante o aceite confirmou que o evento posterior permanece pendente.

Verificação produtiva: `npm ci` e build remoto aprovados; auditoria de dependências de produção sem vulnerabilidades. Após reiniciar `strato.service`, serviço ativo; saúde interna e pública HTTP 200 com `status: ok`, página inicial interna/pública HTTP 200 e radar sem sessão interna/pública HTTP 401.

Limites: não foi executada jornada autenticada no navegador produtivo. CDI/Selic continuam condicionados ao conector existente; não foi alterada sua configuração. Notícias dependem de fonte editorial aprovada. Os alertas de dependências de desenvolvimento reportados pelo `npm ci` não foram tratados neste escopo; a auditoria com `--omit=dev` passou.

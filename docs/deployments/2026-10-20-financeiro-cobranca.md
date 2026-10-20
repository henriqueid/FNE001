# Pagamentos e cobrança · 20/10/2026

Publicação autorizada pelo usuário, código `b4fe8f55a01070a90113fc87087b15ad3629bcac`. Integra lote Financeiro sobre radar já publicado (`861cd07`); alterações paralelas preservadas.

Conta pagadora sem opção exibe orientação e atalho para Bancos na empresa do lançamento. Registro de pagamento mostra saldo atual/projetado, insuficiência e mínimo, preservando regra vigente de saldo negativo. Financeiro → Cobrança reúne remessa/retorno CNAB400 existentes e posição bancária dos títulos por empresa; liberações oferecem atalho. Sem migração ou alteração de autorização.

Validação do lote isolado: check com 720 testes aprovados/14 ignorados e build aprovado. Após integração à main atual: check com 727 aprovados/14 ignorados e build aprovado. Revisão independente sem achados. Fixture local em navegador confirmou conta vazia, atalho para Bancos e navegação da Cobrança, sem movimentação real. Login demonstrativo local dependia de DATABASE_URL ausente; não foi usado como evidência de autenticação produtiva.

Servidor `/srv/strato/app` limpo antes da atualização, `npm ci` e build remoto aprovados, serviço `strato.service` reiniciado e ativo. Saúde interna e pública retornaram `{"status":"ok"}`; página inicial HTTP 200 e Financeiro com tenant/sem sessão HTTP 401. Artefato público do Financeiro verificado com textos de Cobrança, configuração de conta e avisos de saldo.

Não executados pagamentos, geração/importação de arquivos reais ou homologação bancária. Confirmação autenticada com dados reais permanece para sessão do usuário.

# Respostas pontuais do copiloto

**Objetivo:** perguntas singulares sobre menor score e melhor liquidez retornam o resultado, sem relatório geral.
**Causa:** consulta de score devolve todos os clientes; liquidez cai no roteamento genérico de carteira. Comparações devem preceder esses atalhos.

- [x] Reproduzir perguntas do usuário em testes; cobrir empates e métricas ausentes.
- [x] Responder extremos de score e liquidez com nome, valor e critério; manter rankings quando explicitamente pedidos.
- [x] Liquidez no vencimento usa somente valores históricos fornecidos (pontual ÷ pontual + atrasado); sem histórico não há índice presumido. Fontes reais que não fornecem métricas continuam retornando indisponibilidade explícita.
- [x] Impedir roteamento de liquidez para saldo de carteira; manter permissões e proteção contra zeros do adaptador.
- [x] Validar testes, check/build e as duas perguntas na prévia.

**Verificação:** 14 casos novos; suíte completa com 749 aprovados e 14 ignorados. Check, build do aplicativo e build da prévia concluídos. Duas perguntas conferidas no navegador com dados fictícios. Revisão corrigiu plural da população e recortes históricos sem suporte.

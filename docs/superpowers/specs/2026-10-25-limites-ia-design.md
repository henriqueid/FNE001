# Limites de consumo da IA

Pedido: configurar teto geral e distribuir cotas por usuário. Implementação local autorizada após planejamento; publicação não incluída neste novo pedido.

- Unidade: tokens de entrada e saída; orçamento mensal UTC já usado pelo STRATO. Reais não serão exibidos como custo presumido.
- Modos: compartilhado (comportamento atual) ou individual. Individual exige cota explícita; zero/ausência bloqueiam chamadas. Soma das cotas <= limite geral. Saldo não distribuído não é emprestado automaticamente.
- Configurações → Inteligência e IA: teto mensal, modo, divisão igual entre usuários ativos, cotas editáveis e consumo/saldo por usuário. Salvar explícito, erros visíveis, recarregar consumo. Usuários inativos não recebem nova cota; consumo histórico é preservado.
- Ambos os limites são verificados dentro da transação existente antes de chamar o provedor. Ator vem da sessão. Reservas incertas continuam debitadas; liquidação é idempotente, virada UTC não transfere crédito entre meses. Reduzir limite abaixo do uso bloqueia novas chamadas e não apaga consumo.
- Política versionada em private.domain_events, sem migração; contador global em intelligence_states. Consumo por ator deriva da última versão de cada reserva na competência. Contadores do cliente são ignorados.
- API exige settings:view para leitura ou settings:manage; gravação exige settings:manage, vínculo dos usuários ao tenant e versão da política. Mudanças concorrentes retornam conflito. Configuração antiga de licença não sobrescreve teto após existir política de distribuição.

Alternativas: moeda exigiria precificação/câmbio e conciliação; coluna/tabela nova exigiria migração. Escolhida extensão do ledger existente, com verificações reais em PostgreSQL isolado quando runtime local disponível.

# Segregação de funções: preparar, conferir e aprovar

O STRATO usa o princípio de dupla conferência nos comandos de maior risco. A pessoa que prepara ou solicita não pode ser a mesma que aprova.

## Exceção de risco

1. O analista registra a solicitação de exceção com justificativa, evidências e alçada.
2. Um usuário diferente, com `risk:decide` e a alçada exigida, revisa a solicitação.
3. O segundo usuário aprova ou rejeita. A decisão fica terminal e não pode ser repetida para a mesma solicitação.
4. Se o solicitante tentar decidir a própria exceção, o servidor recusa a ação.

## Liberação financeira

1. O preparador informa favorecidos, contas, valores, data e observação.
2. Selecione **Concluir preparação**. O STRATO registra a identidade autenticada como preparador.
3. Outra pessoa do Financeiro abre a operação, confere os dados e seleciona **Aprovar e liberar para o financeiro**.
4. O STRATO registra o segundo usuário como aprovador e cria os lançamentos pendentes.
5. O preparador verá **Aguardando segundo aprovador** e não conseguirá aprovar a própria preparação.

Depois da aprovação, a liberação não pode ser reescrita. Correções devem usar cancelamento ou estorno, preservando a trilha.

## Tratamento de mensagens

| Mensagem | O que significa | Como resolver |
| --- | --- | --- |
| “Quem solicitou a exceção não pode decidir...” | A mesma sessão tentou solicitar e decidir | Peça a decisão a outro usuário com alçada |
| “A exceção precisa ser solicitada...” | Não existe solicitação aberta | Registre primeiro a solicitação e suas evidências |
| “Quem preparou a liberação não pode aprovar...” | Preparador e aprovador são a mesma identidade | Abra a operação com outro usuário do Financeiro |
| “A liberação precisa ser preparada e salva...” | Tentativa de aprovação direta | Conclua a preparação e depois faça a conferência independente |
| “Uma liberação aprovada não pode ser reescrita...” | Tentativa de alterar um fato já aprovado | Use o fluxo de cancelamento ou estorno |

Nunca compartilhe credenciais para contornar a dupla conferência. A identidade vem da sessão do servidor e compõe a auditoria permanente.

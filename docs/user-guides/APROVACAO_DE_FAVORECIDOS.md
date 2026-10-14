# Aprovação de favorecidos e liberação financeira

Atualizado em 14/10/2026.

## Objetivo

Impedir que uma única pessoa prepare, altere e aprove o destino do pagamento. O pacote submetido à conferência contém favorecidos, CPF/CNPJ, método, conta ou chave PIX, valor, data e observação.

## Como o fluxo funciona

1. O preparador informa os favorecidos, distribui integralmente o valor líquido e conclui a preparação.
2. O STRATO registra a identidade do preparador a partir da sessão autenticada e congela o pacote para conferência.
3. Outra pessoa do Financeiro confere o pacote salvo. Ela não pode trocar favorecido, conta, chave PIX, valor ou data durante a aprovação.
4. Na aprovação, o backend recria os lançamentos a pagar a partir do pacote congelado. Dados de lançamento enviados pelo navegador são descartados.
5. O STRATO registra aprovador, horário e evento de auditoria. Depois disso, a liberação não pode ser reescrita; correções seguem cancelamento ou estorno.

## Se algum dado estiver errado

Não aprove. O pacote precisa voltar para nova preparação. O preparador corrige os dados, salva uma nova versão e a segunda pessoa realiza outra conferência. Nunca use a aprovação para “ajustar rapidamente” uma chave ou conta.

## Bloqueios automáticos

- mesma pessoa tentando preparar e aprovar;
- ausência de favorecido ou data de pagamento;
- CPF/CNPJ incompleto;
- PIX sem chave ou TED sem banco, agência e conta;
- pagamento a terceiro sem justificativa;
- soma dos favorecidos diferente do líquido da operação;
- alteração do pacote pelo aprovador;
- lançamento forjado ou modificado pelo navegador.

## Evidência de auditoria

A operação conserva quem preparou, quem aprovou, os horários, o pacote de favorecidos, os lançamentos produzidos pelo servidor e o evento de liberação. A baixa ou o estorno posterior não autoriza mudar a identidade original do pagamento.

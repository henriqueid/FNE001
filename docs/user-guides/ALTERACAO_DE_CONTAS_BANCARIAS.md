# Alteração de contas bancárias no Cadastro

Atualizado em 14/10/2026.

## Por que existe uma aprovação separada

Uma alteração de banco, agência, conta, chave PIX, titular ou conta principal muda o destino potencial de pagamentos. Por isso, o STRATO não aplica essa mudança junto com a edição comum do cadastro.

## Fluxo operacional

1. Uma pessoa com manutenção de Cadastro prepara a proposta, informa o motivo e envia a solicitação.
2. A conta vigente continua válida enquanto a solicitação estiver pendente.
3. Outra pessoa com a mesma responsabilidade confere documentos, titularidade e destino e então aprova ou rejeita.
4. Na aprovação, o STRATO verifica novamente se a conta vigente ainda é a mesma observada na solicitação.
5. Somente após essa conferência a nova lista de contas substitui a anterior.

No ambiente real, as solicitações pendentes aparecem no topo do módulo Cadastro. Cada cartão mostra as contas anteriores e a proposta lado a lado, o solicitante, o motivo e o campo obrigatório para justificar a decisão. Após uma aprovação, a ficha é recarregada automaticamente com a conta vigente.

Para um cadastro novo, conclua primeiro a identificação sem dados bancários. Em seguida, reabra a ficha e envie a conta pelo fluxo de aprovação; isso garante que a solicitação esteja ligada a uma pessoa já persistida e auditável.

## Controles automáticos

- o solicitante não pode decidir a própria solicitação;
- cada cadastro admite somente uma solicitação bancária pendente;
- uma solicitação aprovada ou rejeitada não pode ser reaberta nem reescrita;
- o registro pertence ao mesmo tenant do cadastro;
- banco, agência, conta e CPF/CNPJ do titular são obrigatórios;
- quando há contas, exatamente uma deve ser principal;
- uma mudança concorrente invalida a aprovação e exige nova solicitação;
- alterações bancárias feitas pela API comum do Cadastro são recusadas.

## Conferência recomendada

- compare o CPF/CNPJ do titular com a documentação recebida;
- confirme a instituição, agência, conta e dígitos;
- para PIX, confirme o tipo e a chave por canal independente;
- verifique se a conta principal indicada é realmente a conta preferencial;
- registre na decisão a evidência utilizada e nunca aprove apenas com base em mensagem instantânea.

## Em caso de divergência

Rejeite a solicitação e descreva objetivamente a inconsistência. Não tente corrigir os dados durante a aprovação. O solicitante deve preparar uma nova proposta, preservando a trilha completa.

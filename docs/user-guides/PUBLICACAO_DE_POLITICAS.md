# Publicação de políticas de elegibilidade

Atualizado em 14/10/2026.

## Por que a publicação exige duas pessoas

Uma política ativa pode aprovar, sinalizar, encaminhar para decisão ou bloquear operações. Para evitar que uma única pessoa altere o critério e o coloque em produção sem revisão, o STRATO separa a preparação da aprovação.

## Fluxo operacional

1. A primeira pessoa cria ou edita o rascunho, define empresa, vigência, regras e parâmetros.
2. Ela registra o motivo e seleciona **Enviar para aprovação**.
3. O conteúdo fica congelado. A política ativa anterior continua controlando as análises.
4. Outra pessoa com permissão de administrar configurações confere o escopo, a vigência, cada regra e a justificativa.
5. O revisor escolhe **Aprovar e ativar** ou **Rejeitar publicação**, sempre com justificativa.
6. Na aprovação, a nova versão entra em vigor e a versão anterior do mesmo escopo é encerrada na véspera.
7. Na rejeição, o rascunho volta a aceitar correções e pode ser enviado novamente.

## Controles automáticos

- o solicitante não pode aprovar nem rejeitar a própria solicitação;
- identidade e horário de solicitação, aprovação e rejeição vêm da sessão autenticada no servidor;
- uma política pendente não aceita alteração de regra, parâmetro, empresa, versão ou vigência;
- não é possível ativar um rascunho sem uma solicitação anterior;
- a versão ativa e a versão encerrada permanecem imutáveis;
- comandos repetidos não duplicam a publicação;
- alterações concorrentes exigem atualização da tela antes de nova tentativa;
- toda mudança permanece no histórico de eventos e na fila de integração.

## Conferência recomendada pelo aprovador

- confirme empresa, modalidade, produto e início da vigência;
- compare a nova versão com a política ativa;
- confira regras habilitadas, parâmetros, resultado, ação e possibilidade de exceção;
- valide se os dados exigidos por cada regra realmente estão disponíveis;
- rejeite quando houver dúvida ou evidência incompleta; não corrija o conteúdo durante a aprovação.

## Ambiente de demonstração

O modo de demonstração mantém a ativação simplificada por uma única identidade para facilitar a navegação. A segregação é obrigatória no ambiente real autenticado.

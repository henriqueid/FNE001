# STRATO — Central do Dia e tarefas

A Central do Dia reúne alertas automáticos, notificações e trabalho operacional em uma fila única. No modo real, tarefas, responsáveis, prazos e histórico ficam persistidos por tenant e são compartilhados entre sessões autorizadas.

## O que vira tarefa

- decisão ou exceção que exige atuação humana;
- operação pronta para avançar;
- liberação financeira pendente;
- atraso, concentração ou mudança relevante da carteira;
- desvio de ritmo ou prazo detectado pelo STRATO;
- notificação publicada por um processo interno.

O STRATO cria e encerra tarefas automáticas conforme o fato de origem. A conclusão manual registra o trabalho realizado, mas não altera o documento, a operação ou o título que originou a pendência.

## Abrir e filtrar

1. Acione **Alertas** ou **Central do Dia** no cabeçalho.
2. Use **Pendentes**, **Em andamento**, **Adiadas**, **Concluídas** ou **Todas**.
3. Selecione uma tarefa para conferir causa, impacto, próxima ação, responsável, prazo e histórico.
4. Use **Abrir contexto em nova aba** para trabalhar na origem sem perder a fila.

A fila já respeita o perfil, o departamento, a carteira nominal e o escopo de empresa disponível para o usuário.

## Assumir ou delegar

- **Assumir** coloca a tarefa em andamento com o usuário atual.
- **Delegar** usa o diretório ativo de usuários do tenant; escolha a pessoa e registre uma observação quando houver contexto importante.
- O nome exibido é acompanhado, no banco, pelo identificador estável do usuário sempre que ele pertence ao tenant.
- A atribuição anterior permanece no histórico; ela não é sobrescrita.

Não delegue para contornar alçada. A tarefa coordena o trabalho; a autorização material continua no comando de negócio correspondente.

## Adiar com responsabilidade

1. Acione **Adiar**.
2. Informe quando o item deve voltar à fila.
3. Registre o motivo quando depender de documento, terceiro ou prazo combinado.
4. Confirme. Até o horário indicado, a tarefa fica na aba **Adiadas**; depois volta às pendências.

Adiar não muda o prazo do contrato, do título ou da operação. Ele altera somente o lembrete de trabalho.

## Concluir e reabrir

1. Confira se a ação foi realmente executada na tela de origem.
2. Acione **Concluir** e descreva a evidência ou o resultado.
3. Verifique a nova entrada no histórico.
4. Se o item voltar a exigir ação, use **Reabrir tarefa**; não crie uma segunda tarefa para o mesmo fato.

Quando o próprio fato de origem deixa de existir, o STRATO pode concluir a tarefa automaticamente como **Resolvida na origem**.

## Concorrência e repetição segura

Cada alteração usa versão otimista e uma chave idempotente:

- se duas pessoas alterarem a mesma fila, a versão antiga é recusada sem sobrescrever a mais nova;
- se a rede cair depois da gravação, o mesmo comando pode ser repetido sem duplicar histórico ou evento;
- a mesma chave nunca pode representar dois conteúdos diferentes;
- eventos anteriores e tarefas existentes não podem ser removidos nem reescritos pelo cliente.

Ao receber aviso de conflito, atualize a Central do Dia, confira o histórico e repita somente a ação ainda necessária.

## Conferência do gestor

- tarefas vencidas sem responsável;
- itens adiados repetidamente;
- tarefas em andamento sem atualização;
- delegações fora do departamento adequado;
- conclusão sem evidência suficiente;
- tarefa concluída enquanto o fato de origem permanece pendente;
- concentração de fila em uma única pessoa;
- conflitos de versão recorrentes, que podem indicar trabalho duplicado.

## Limites desta entrega

Esta etapa persiste a fila atual, os comandos e a trilha de auditoria. Templates de processo, calendário útil, SLA escalonado, substituição programada e criação manual governada entram nas ondas seguintes do workflow.

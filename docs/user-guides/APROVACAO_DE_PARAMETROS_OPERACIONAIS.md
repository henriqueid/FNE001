# Aprovação de parâmetros operacionais

## Para que serve

Os padrões operacionais definem o que novas operações e clientes herdam: taxas, método de cálculo, prazos, limites, confirmação, concentração, tarifas, reserva, recompra, mora e metas de originação e receita.

No ambiente real, uma edição não entra em vigor imediatamente. O STRATO cria uma proposta congelada, registra o motivo e exige a decisão de outra pessoa com permissão `settings:manage`.

## Como propor uma alteração

1. Acesse **Configurações → Padrões operacionais**.
2. Confira a versão efetiva exibida no início da tela.
3. Ajuste somente os valores que precisam mudar.
4. Informe um motivo com pelo menos 10 caracteres, incluindo o objetivo e o impacto esperado.
5. Selecione **Enviar para aprovação**.

Enquanto a proposta estiver pendente, os parâmetros efetivos continuam sendo usados e os campos ficam congelados. Só pode existir uma proposta pendente por organização.

## Como conferir e decidir

1. Entre com outra conta autorizada a administrar configurações.
2. Acesse **Configurações → Padrões operacionais**.
3. Confira o motivo, a versão de origem e todos os valores propostos.
4. Registre uma justificativa de decisão com pelo menos 5 caracteres.
5. Use **Aprovar e aplicar** ou **Rejeitar**.

O solicitante não pode decidir a própria proposta. Na aprovação, o STRATO confere novamente a versão efetiva; se alguém tiver alterado o estado durante a espera, a aplicação é bloqueada.

## Resultado e auditoria

- A aprovação cria uma nova versão efetiva e passa a orientar novas operações e os painéis de metas.
- A rejeição encerra a proposta sem alterar nenhum parâmetro efetivo.
- Solicitação, decisão, identidade, horário, motivo e versão ficam registrados no histórico técnico e na fila transacional de eventos.
- As cinco decisões mais recentes ficam visíveis na própria tela, incluindo versão de origem, versão aplicada, solicitante, aprovador e justificativa.
- O ambiente de demonstração continua permitindo edição direta para treinamento; esse comportamento não se aplica ao ambiente real.

## Em caso de divergência

Rejeite a proposta, explique a divergência e prepare uma nova versão. Não tente corrigir uma proposta pendente: seu conteúdo é intencionalmente imutável para preservar a conferência feita pelo aprovador.

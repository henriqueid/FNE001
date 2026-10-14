# Aprovação de integrações

Este guia descreve como ativar, suspender, priorizar ou trocar provedores sem permitir que uma única pessoa prepare e aprove a mesma mudança.

## Antes de propor

1. Confirme que o conector foi implementado, contratado e homologado no ambiente correto.
2. Verifique se a fonte é pública ou institucional. Fonte pública não equivale a evidência oficial.
3. Defina a ordem de prioridade sem repetir números dentro da mesma capacidade.
4. Prepare uma justificativa com impacto, evidência de homologação e plano de contingência.

Credenciais, URLs privadas e demais detalhes técnicos não são editados nem exibidos no navegador. A inclusão de um novo conector e o provisionamento de segredos continuam sendo atividades controladas de implantação.

## Propor a mudança

Em **Configurações > Integrações**:

1. escolha a capacidade;
2. ajuste o estado e a prioridade dos provedores já cadastrados;
3. informe a justificativa;
4. envie a proposta.

O STRATO congela o retrato anterior e o proposto de todos os provedores daquela capacidade. Nada é ativado nessa etapa. Só pode existir uma proposta pendente por empresa e capacidade.

## Conferir e decidir

Outro administrador com `settings:manage` deve comparar o antes e o depois, conferir a homologação e registrar o motivo da decisão.

- **Aprovar:** aplica estados e prioridades em conjunto, na mesma transação.
- **Rejeitar:** encerra a solicitação sem alterar a configuração efetiva.
- **Estado alterado:** se a configuração mudou depois da proposta, a aprovação é bloqueada; rejeite a pendência e crie uma nova proposta.
- **Mesmo usuário:** o solicitante nunca pode decidir a própria proposta.

## Após a aprovação

1. Confirme o estado em **Configurações > Integrações**.
2. Execute uma consulta controlada da capacidade alterada.
3. Se o conector não existir ou estiver indisponível, o STRATO bloqueia a chamada sem fallback silencioso.
4. Em incidente, suspenda o provedor por uma nova proposta e preserve horários, capacidade, empresa e evidências do erro.

Solicitação e decisão geram eventos e saídas transacionais auditáveis. A fila fica no schema privado, com RLS forçada, sem acesso direto por `anon` ou `authenticated`, e decisões concluídas não podem ser reescritas ou apagadas.

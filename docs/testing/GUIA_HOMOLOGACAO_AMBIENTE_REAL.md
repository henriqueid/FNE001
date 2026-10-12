# Homologação do ambiente real

Este roteiro deve ser executado sempre no acesso interno. O modo demonstração é um ambiente separado e nunca pode
alimentar cálculos, listas, notificações ou decisões do ambiente real.

## Critérios gerais de aprovação

- A tela deve começar vazia quando não houver registro real.
- Nenhum número pode ser criado apenas para preencher um gráfico ou card.
- Recurso sem integração deve aparecer como **não configurado** e não pode simular sucesso.
- Alterações críticas devem sobreviver a recarregamento, novo login e acesso por outro computador.
- Toda decisão, alteração de cadastro e movimentação financeira deve registrar usuário, data e origem.
- Escopos de empresa, departamento, cliente, comercial e gerente devem limitar telas, tarefas e notificações.

## Ordem de homologação

### 1. Acesso e empresa

- [ ] Login e logout.
- [ ] Empresa cadastrada aparece no menu e em todos os seletores.
- [ ] Não aparecem empresas ou usuários de demonstração.
- [ ] Perfil sem permissão não acessa o módulo pela interface nem pela API.

### 2. Configurações

- [ ] Metas começam em zero.
- [ ] Políticas começam vazias.
- [ ] Integrações começam como não configuradas.
- [ ] IA começa desativada e sem orçamento fictício.
- [ ] Parâmetros gerais são herdados pelo cliente; personalizações do cliente têm prioridade.

### 3. Cadastros

- [ ] Criar, editar, consultar e recarregar cedente, sacado, representante e favorecido.
- [ ] Validar vínculo entre cliente, comercial e gerente da conta.
- [ ] Validar contrato, limites, tranches, confirmação mínima, taxas e tarifas.
- [ ] Confirmar que um cadastro não aparece em outro tenant.

### 4. Operações

- [ ] Criar operação manual e por arquivo.
- [ ] Confirmar que nenhum campo nasce com dados de outra operação.
- [ ] Validar títulos, sacados, lastro, preço, política, alçada, formalização e liberação.
- [ ] Recarregar a página e confirmar persistência integral.

### 5. Carteira e PDD

- [ ] Carteira vazia apresenta todos os valores em zero.
- [ ] PDD usa somente títulos reais e a política ativa.
- [ ] Liquidação, atraso, recompra e renegociação atualizam posição e histórico.
- [ ] A data-base altera a posição sem misturar dados futuros.

### 6. Financeiro e controladoria

- [ ] Criar conta bancária apenas para empresa cadastrada.
- [ ] Lançar contas a pagar/receber, baixar, conciliar e reabrir.
- [ ] Validar saldos, DRE, fluxo de caixa e trilha de auditoria.
- [ ] Recarregar e confirmar que nenhum lançamento desaparece.

### 7. Comercial

- [ ] Cadastrar equipe, carteira, visitas, funil, comissão e comitê.
- [ ] Validar agente e gerente da conta na operação e no pós-venda.
- [ ] Confirmar metas e resultados sem dados comerciais simulados.

### 8. Central do Dia e Copiloto

- [ ] Sem dados reais, sino, tarefas, PDD e resumo permanecem zerados.
- [ ] Tarefas aparecem somente a partir de eventos reais e respeitam o escopo do usuário.
- [ ] Recurso sem IA contratada informa indisponibilidade sem inventar resposta.
- [ ] Análise de arquivos fica bloqueada até o processador real estar conectado.
- [ ] Ao resolver a origem, a tarefa é encerrada e a trilha é preservada.

## Estado técnico em 12/10/2026

Validado automaticamente:

- separação entre empresas reais e empresas demonstrativas;
- estado inicial vazio de carteira, PDD, notificações, políticas, integrações, IA e metas;
- criação de operação sem herdar uma operação fictícia;
- bloqueio de consultas externas não configuradas;
- bloqueio da análise simulada de arquivos no Copiloto real;
- 191 testes automatizados, tipagem, lint, formatação e build de produção.

Pendências bloqueadoras para considerar o sistema persistente de ponta a ponta:

- operações, financeiro, comercial, carteira, políticas e parâmetros ainda precisam de persistência no banco;
- integrações oficiais precisam de credenciais, contratos e homologação com cada provedor;
- análise de arquivos do Copiloto precisa do processador real e de uma fila de execução no servidor.

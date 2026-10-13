# Políticas de elegibilidade — versões, aprovação e vigência

Este guia orienta administradores e responsáveis de Risco na manutenção das regras usadas pelo Motor Universal de Elegibilidade do STRATO.

## O que mudou

No ambiente real, políticas, regras e aprovações ficam registradas no servidor do tenant. Uma versão publicada não pode ser editada ou apagada. Qualquer alteração exige uma nova versão, preservando as análises e os parâmetros usados no passado.

## Fluxo recomendado

1. Acesse **Configurações → Políticas e motor**.
2. Selecione **Nova política** para um novo escopo ou **Nova versão** para revisar uma política existente.
3. Confirme empresa/veículo, modalidade, produto, versão e início da vigência.
4. Adicione regras pelo catálogo ou importe o modelo CSV.
5. Habilite as regras necessárias e preencha parâmetro, resultado, ação e eventual alçada de exceção.
6. Revise o resumo e registre uma justificativa clara para a aprovação.
7. Selecione **Aprovar e ativar**.

A nova versão passa a controlar somente as análises alcançadas por sua vigência. Se já existir uma versão ativa no mesmo escopo, o STRATO encerra essa versão no dia anterior ao novo início.

## Estados

- **Rascunho:** editável; ainda não influencia o motor.
- **Ativa:** aprovada e vigente; imutável.
- **Encerrada:** versão histórica substituída; imutável.

Cada versão ativa ou encerrada exibe quem aprovou, quando aprovou e por quê.

## Boas práticas de governança

- Use uma versão nova para qualquer mudança de limite, ação, alçada ou escopo.
- Defina o início da vigência antes de aprovar; não tente corrigir uma versão já publicada.
- Na justificativa, informe a origem da decisão, por exemplo: “Revisão anual aprovada pela Diretoria em ata de 10/10/2026”.
- Antes da ativação, confira se há ao menos uma regra habilitada e parametrizada.
- Para regras com exceção, identifique a autoridade necessária e mantenha a evidência da decisão no processo correspondente.
- Exporte e revise o modelo CSV antes de importar lotes grandes.

## Conflitos e mensagens

**“As políticas foram alteradas por outra pessoa”**

Outra sessão salvou uma versão mais recente. Atualize a página, confira as alterações e reaplique somente o que ainda for necessário.

**“A aprovação da política não corresponde à sessão autenticada”**

A identidade enviada não é a identidade da sessão. Saia de eventual simulação de usuário, atualize a página e faça a aprovação com seu próprio acesso.

**“Só pode existir uma política ativa por escopo”**

Revise empresa, modalidade, produto e camada. A ativação normal encerra automaticamente a versão anterior do mesmo escopo.

**“Registre uma justificativa de aprovação”**

Informe uma justificativa objetiva com pelo menos dez caracteres. Esse texto fará parte da trilha permanente.

## Segurança e auditoria

- Apenas usuários com permissão de administrar configurações acessam a API de políticas.
- O tenant vem da sessão e do cabeçalho controlado pela aplicação.
- Toda gravação usa versão otimista e chave idempotente.
- Aprovações e recibos de comando são append-only.
- Eventos materiais entram no ledger de domínio e na outbox transacional.
- As tabelas ficam no schema privado, com acesso de clientes revogado e RLS forçado.

## Checklist antes de publicar

- [ ] Escopo e modalidade corretos.
- [ ] Data de início correta.
- [ ] Regras habilitadas e parâmetros revisados.
- [ ] Resultado e ação compatíveis com o risco.
- [ ] Alçada de exceção definida quando aplicável.
- [ ] Justificativa de aprovação completa.
- [ ] Responsável está usando a própria sessão.

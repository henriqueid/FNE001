# Carteira — cobrança, confirmação e histórico

Este guia descreve a manutenção operacional da Carteira no ambiente real do STRATO.

## Fonte e manutenção

O título nasce de uma operação liberada ou de uma posição importada. Esses dados de origem — cedente, sacado, documento, valor original e vínculo com a operação — não podem ser reescritos pela tela da Carteira.

O STRATO persiste separadamente a manutenção feita pelos usuários: ocorrências de cobrança, confirmação de lastro, situação operacional e histórico. Assim, atualizar a página ou trocar de navegador não apaga o trabalho.

## Registrar uma cobrança

1. Acesse **Carteira** e abra o título.
2. Informe data/hora, canal, pessoa contatada e resultado.
3. Registre um resumo objetivo da conversa.
4. Defina o próximo contato e, quando houver, a promessa de pagamento.
5. Salve a ocorrência.

A ocorrência entra no histórico com a identidade da sessão. Registros anteriores não podem ser alterados ou excluídos; uma correção deve ser feita por uma nova ocorrência explicativa.

## Confirmar o lastro

1. Abra o título e localize a área de confirmação da Controladoria.
2. Selecione **Pendente**, **Confirmado**, **Divergente** ou **Não localizado**.
3. Informe canal, contato e conclusão.
4. Salve a confirmação.

A última confirmação fica visível no título e cada mudança gera um evento no histórico.

## Conflitos

Se aparecer **“A Carteira foi alterada por outra pessoa”**, atualize a página, confira o registro mais recente e repita somente a informação que ainda falta. O STRATO não sobrescreve silenciosamente a gravação concorrente.

Se aparecer uma mensagem de autoria incompatível, encerre eventual simulação de usuário e repita a ação com sua própria sessão.

## Controles de segurança

- Leitura exige sessão válida e tenant explícito.
- Gravação exige permissão de Carteira ou Controladoria.
- Toda gravação usa versão otimista e comando idempotente.
- Ocorrências e eventos são append-only.
- Eventos materiais entram no ledger de domínio e na outbox transacional.
- As tabelas privadas têm RLS forçado e não são acessíveis diretamente pelo cliente.

## Checklist diário

- [ ] Priorizar vencidos e promessas para hoje.
- [ ] Registrar cada contato com resumo e próximo passo.
- [ ] Conferir divergências de lastro com a Controladoria.
- [ ] Não alterar dados de origem para corrigir cobrança; corrigir na fonte adequada.
- [ ] Atualizar a página antes de reaplicar uma ação após conflito.

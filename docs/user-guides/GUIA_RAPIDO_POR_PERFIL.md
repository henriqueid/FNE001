# STRATO — guia rápido por perfil

Este guia mostra o que cada área recebe, executa, confere e entrega à próxima etapa. Use os guias detalhados citados em cada seção quando precisar tratar uma exceção.

## Comercial

**Objetivo:** transformar oportunidade em cedente pronto para onboarding, sem aprovar o próprio risco.

### Rotina

1. Abra **Comercial > Funil** e priorize leads sem próximo passo ou sem atualização recente.
2. Complete o dossiê, consulte o CNPJ e registre visitas, resultados e documentos recebidos.
3. Leve o lead até Proposta e envie o limite inicial ao Comitê com parecer comercial objetivo.
4. Após a decisão, acompanhe ressalvas e confira se o vínculo e o cedente foram criados corretamente.
5. Na carteira ativa, mantenha comercial responsável e gerente da conta separados.

### Pode / não pode

- Pode criar e atualizar leads, visitas, propostas, vínculos e responsáveis.
- Não pode registrar decisão de risco sem a alçada `risk:decide`.
- Não deve criar um segundo vínculo para CNPJ já existente; deve transferir o responsável.

### Entrega para a próxima área

Dossiê completo, parecer comercial, CNPJ validado, limite solicitado, taxa pretendida e documentos mínimos. Consulte [Comercial — funil, comitê e onboarding](COMERCIAL_FUNIL_COMITE_E_ONBOARDING.md).

## Risco e crédito

**Objetivo:** decidir com evidência, política identificada e condições rastreáveis.

### Rotina

1. Confira na Central do Dia as análises e pautas atribuídas ao perfil.
2. No Comitê, revise dossiê, concentração, documentação, parecer comercial e alertas cadastrais.
3. Registre aprovação, aprovação com ressalvas, reprovação ou adiamento; informe valor, taxa, condições e parecer.
4. Em Operações, trate exceções de elegibilidade sem alterar silenciosamente a política.
5. Ao publicar política, registre versão, escopo, vigência, justificativa e aprovador.

### Pode / não pode

- Pode decidir quando possui `risk:decide` e aprovar políticas quando possui `settings:manage`.
- Não deve decidir com dossiê incompleto ou fora da própria alçada.
- Não pode reescrever versão de política já ativa nem apagar decisão registrada.

### Entrega para a próxima área

Decisão identificada, limite/taxa aprovados, ressalvas, validade e evidências. Consulte [Políticas de elegibilidade](POLITICAS_DE_ELEGIBILIDADE.md) e o guia Comercial.

## Controladoria

**Objetivo:** garantir que a operação formalizada corresponda ao que foi analisado, aprovado e adquirido.

### Rotina

1. Abra as operações liberadas e confira cedente, veículo, documentos, recebíveis e decisão aplicável.
2. Valide a identidade de cada título e os vínculos com operação e documento fiscal.
3. Formalize somente quando as pendências impeditivas estiverem resolvidas.
4. Na Carteira, acompanhe confirmação, ocorrências de cobrança, divergências e situação do título.
5. Encaminhe ajustes financeiros por estorno/compensação; não altere histórico material.

### Pode / não pode

- Pode formalizar quando possui `controlleria:formalize` e registrar manutenção autorizada da carteira.
- Não pode substituir decisão de risco nem liberar pagamento financeiro.
- Não deve excluir eventos, cobranças ou confirmações já registrados.

### Entrega para a próxima área

Operação formalizada, ativos identificados, documentos vinculados e pendências claramente sinalizadas. Consulte [Do arquivo ao título](DO_ARQUIVO_AO_TITULO.md) e [Carteira, cobrança e confirmação](CARTEIRA_COBRANCA_E_CONFIRMACAO.md).

## Financeiro

**Objetivo:** liberar, liquidar, conciliar e fechar o ciclo do dinheiro com partidas balanceadas.

### Rotina

1. Confira operações formalizadas aguardando liberação e valide conta, valor líquido e veículo.
2. Libere uma única vez; se houver dúvida de resposta, atualize a tela antes de repetir.
3. Importe o extrato e concilie movimentos com títulos e lançamentos.
4. Registre baixa ou estorno compensatório; nunca apague lançamento histórico.
5. Antes do fechamento, elimine linhas de extrato e movimentos pendentes até a data-base.

### Pode / não pode

- Pode liberar e liquidar quando possui `finance:release`.
- Não pode reabrir histórico por edição direta; correções usam estorno.
- Não deve fechar competência com pendências de conciliação.

### Entrega para a próxima área

Pagamento identificado, títulos atualizados, diário balanceado, conciliação concluída e período fechado. Consulte [Livro financeiro e contábil](LIVRO_FINANCEIRO_E_CONTABIL.md).

## Passagem de bastão

| Origem             | Destino                | Critério mínimo                                                  |
| ------------------ | ---------------------- | ---------------------------------------------------------------- |
| Comercial          | Risco                  | Dossiê pronto, parecer e documentos mínimos                      |
| Risco              | Cadastro/Comercial     | Decisão, limite, taxa, ressalvas e validade                      |
| Cadastro/Operações | Controladoria          | Cedente validado, operação analisada e recebíveis identificados  |
| Controladoria      | Financeiro             | Formalização concluída e valor líquido conferido                 |
| Financeiro         | Carteira/Controladoria | Liberação contabilizada e ativos disponíveis para acompanhamento |

## Em caso de conflito de versão

Quando o STRATO informar que outra pessoa alterou o registro, não force um novo envio. Atualize a tela, compare o estado mais recente e reaplique apenas a mudança ainda necessária. Esse procedimento evita sobrescrita silenciosa entre áreas.

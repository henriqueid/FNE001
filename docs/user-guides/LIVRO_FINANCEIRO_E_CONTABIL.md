# STRATO — livro financeiro e contábil

Este guia orienta a operação do Financeiro persistente: plano de contas, bancos, títulos, movimentos, diário, conciliação, estorno e fechamento por data-base.

## Princípios do STRATO

- um fato financeiro nasce como título a pagar ou a receber, ou como evento operacional identificado;
- a competência gera um lançamento contábil;
- a baixa gera movimento bancário e lançamento de caixa;
- nenhum lançamento contábil é apagado ou reescrito;
- uma correção é feita por estorno, com débitos e créditos invertidos;
- todo lançamento precisa fechar: soma dos débitos igual à soma dos créditos.

## Estruturas já protegidas no banco

- plano de contas e categorias;
- contas bancárias por empresa ou veículo;
- títulos a pagar e a receber;
- movimentos bancários;
- diário e partidas contábeis;
- linhas de extrato para conciliação;
- vínculo entre operação e lançamento da aquisição.

## Partidas dobradas

Cada lançamento deve possuir pelo menos duas linhas. Em cada linha, informe débito ou crédito, nunca ambos. O banco verifica o equilíbrio no fechamento da transação e rejeita o conjunto inteiro se houver diferença.

Exemplo de saldo de abertura de R$ 100,00:

| Conta | Débito | Crédito |
| --- | ---: | ---: |
| Banco | R$ 100,00 | — |
| Contrapartida do saldo de abertura | — | R$ 100,00 |

## Estorno

Não altere o histórico, a data, a origem ou as partidas de um lançamento já gravado. Use a ação de estorno. O STRATO cria um novo lançamento com as partidas invertidas e liga os dois registros, preservando a trilha de auditoria.

## Contas bancárias e títulos

Cada conta bancária pertence a uma empresa ou veículo e aponta para uma conta analítica do plano. Cada título registra competência, vencimento, valor, contraparte, situação e conta de liquidação. Uma baixa só pode referenciar conta bancária, título e lançamento existentes.

## Conciliação

As linhas do extrato são identificadas pela conta e pelo `FITID`, evitando importar duas vezes o mesmo movimento bancário. A conciliação associa extrato e movimento interno sem alterar o lançamento original.

### Procedimento: importar e conciliar

1. Abra **Financeiro → Conciliação** e selecione a empresa e a conta bancária corretas.
2. Importe o arquivo OFX. Confira banco, conta, período e quantidade de linhas antes de confirmar.
3. Analise as sugestões automáticas. O STRATO usa data, valor e referência para aproximar extrato e movimento interno.
4. Confirme apenas pares que representam o mesmo fato. Quando não houver correspondência segura, faça a vinculação manual ou mantenha a linha pendente.
5. Confira se o movimento e a linha de extrato ficaram marcados como conciliados.
6. Investigue diferenças de valor ou data; não crie um lançamento apenas para “zerar” a tela sem documento que explique o ajuste.
7. Reimporte o mesmo OFX somente quando necessário: o `FITID` protege contra duplicação da mesma linha.

Se uma linha estiver incorreta, preserve o histórico: desfaça o vínculo ainda não fechado, corrija o fato de origem e concilie novamente. Em período fechado, use estorno e ajuste no período aberto.

## Liberação e baixa

1. Localize o título e confira empresa, contraparte, competência, vencimento, valor e conta de liquidação.
2. Libere apenas depois da aprovação prevista na alçada operacional.
3. Na baixa, informe data efetiva, conta bancária e valor realmente liquidado.
4. Confira o movimento bancário e o lançamento contábil gerados; o total de débitos deve ser igual ao total de créditos.
5. Concilie o movimento com a linha correspondente do extrato.

Cada gravação material recebe uma chave única. Se a conexão cair depois do envio, o STRATO repete a solicitação com a mesma chave e devolve o primeiro resultado, sem produzir uma segunda baixa. Não tente contornar uma mensagem de conflito refazendo o fato por outra tela; atualize os dados e confira o histórico.

## Fechamento por data-base

O fechamento protege tudo o que já foi conferido até uma data. Ele é separado por empresa ou veículo e não pode ser apagado ou alterado.

### Antes de fechar

- termine a importação dos extratos do período;
- deixe todas as linhas até a data-base conciliadas;
- deixe todos os movimentos bancários até a data-base conciliados;
- confira saldos de abertura, títulos baixados, estornos e diário;
- confirme que não existe diferença entre débitos e créditos;
- registre a evidência da conferência prevista no procedimento interno.

### Procedimento de fechamento

1. Abra **Financeiro → Contábil → Fechamento**.
2. Selecione a empresa ou o veículo e informe a data-base.
3. Revise o resumo de movimentos, linhas de extrato e lançamentos abrangidos.
4. Acione **Fechar período**.
5. Confira a nova entrada no histórico, com responsável, horário e totais protegidos.

O sistema recusa o fechamento enquanto existir linha de extrato ou movimento não conciliado até a data informada. Resolva as pendências e tente novamente. Depois de fechado, fatos retroativos são bloqueados no domínio e no banco de dados.

## Como corrigir depois do fechamento

- não altere nem exclua lançamento, movimento, extrato ou saldo de abertura fechado;
- crie um estorno no primeiro período aberto, referenciando o lançamento original;
- registre o lançamento correto também no período aberto;
- documente o motivo e mantenha os dois vínculos na trilha de auditoria;
- se houver necessidade formal de reabertura, trate-a como procedimento excepcional com aprovação e implementação controlada — a versão atual não reabre períodos pela interface.

## Mensagens importantes

| Mensagem | O que significa | O que fazer |
| --- | --- | --- |
| “Outra pessoa alterou os dados” ou conflito de versão | A tela está com uma versão anterior à persistida | Atualize a tela, confira as mudanças e refaça somente a ação ainda necessária |
| “Comando já utilizado com conteúdo diferente” | A mesma chave chegou com outra solicitação | Não repita manualmente; atualize a tela e confira o histórico |
| “Itens bancários pendentes” | Há extrato ou movimento não conciliado antes da data-base | Volte à Conciliação, resolva os itens e tente fechar novamente |
| “Período fechado” | A data pertence a um período protegido | Use estorno/ajuste no período aberto |
| “Lançamento desbalanceado” | Débitos e créditos não fecham | Corrija as partidas antes de gravar |

## Situação da implantação

A fundação do banco, as salvaguardas contábeis, a idempotência, a conciliação inicial, o fechamento e a conexão das telas do Financeiro estão ativos. No modo real, leitura e gravação passam pelo servidor autenticado e usam versão otimista: se outra pessoa salvar antes, o STRATO recusa a versão antiga e pede atualização da tela.

A validação técnica automatizada e transacional está concluída. Resta a homologação visual do fluxo completo com duas sessões reais; até ela terminar, execute o primeiro fechamento produtivo de cada empresa de forma assistida e confira o diário após cada lote operacional.

## Conferência recomendada

- plano de contas aprovado e contas-chave mapeadas;
- cada banco associado à empresa/veículo correto;
- saldos de abertura conferidos na data-base;
- títulos com competência, vencimento e contraparte válidos;
- diário sem diferença entre débitos e créditos;
- estornos vinculados ao lançamento original;
- extratos sem `FITID` duplicado;
- aviso de concorrência tratado com atualização e nova conferência;
- nenhuma linha de extrato ou movimento pendente até a data-base;
- fechamento visível no histórico com empresa, responsável, data-base e totais;
- primeira execução produtiva acompanhada até a homologação visual em duas sessões.

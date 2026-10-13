# STRATO — do arquivo ao título

Este guia explica como o STRATO transforma uma entrada operacional em um recebível rastreável, sem duplicar o mesmo ativo entre operações.

## O que mudou

O título deixou de existir apenas dentro da operação. Agora cada recebível possui identidade, situação e histórico próprios. A operação continua sendo o processo de análise e aprovação; o recebível é o ativo que poderá chegar à Carteira.

O vínculo é mantido entre:

- operação de origem;
- recebível/título;
- cedente e sacado;
- documento fiscal, quando houver chave de NF-e;
- eventos de inclusão, alteração, reprovação, cessão ou remoção lógica.

## Fluxo operacional

1. Na etapa de entrada da operação, escolha o tipo de recebível e informe os títulos.
2. Preencha ao menos número do documento, documento do sacado, valor de face e vencimento.
3. Para duplicatas, informe a chave da NF-e sempre que disponível. O STRATO cria o documento fiscal e o associa ao título.
4. Salve a operação. O STRATO grava a operação e seus recebíveis na mesma transação: ou todo o conjunto é salvo, ou nada é salvo.
5. Durante a análise, cada título acompanha a decisão de risco.
6. Quando a operação é liberada ao Financeiro, os títulos aprovados passam ao estado cedido e alimentam a projeção de Carteira.

## Situações do recebível

| Situação interna | Significado para a operação |
| --- | --- |
| `DRAFT` | Título informado, ainda em análise. |
| `APPROVED` | Título aprovado ou em formalização. |
| `REJECTED` | Título reprovado individualmente pelo Risco. |
| `ASSIGNED` | Título cedido após a liberação ao Financeiro. |
| `REMOVED` | Título retirado ou pertencente a operação cancelada; o histórico é preservado. |

## Como o STRATO evita duplicidade

A identidade canônica combina tipo do recebível, documento do cedente, documento do sacado e número do documento. Pontuação, acentuação, espaços e diferenças entre maiúsculas e minúsculas não criam um título novo.

Se o recebível já pertencer a outra operação, o STRATO recusa a gravação e informa a operação existente. Não altere artificialmente o número para contornar o bloqueio. Confirme primeiro se é:

- uma tentativa repetida de entrada;
- uma substituição legítima do título;
- um documento diferente com numeração coincidente que exige tratamento cadastral.

## Documento fiscal

Quando uma chave de NF-e é informada, o STRATO registra uma evidência fiscal separada e cria o vínculo de origem com o recebível. A chave deve conter 44 dígitos. Cedente, sacado, data de emissão, CFOP e observação ficam disponíveis para conferência e auditoria.

## Carteira

A Carteira exibe somente recebíveis cedidos. Títulos em rascunho, reprovados ou removidos não entram na projeção. A tela mantém a navegação pela operação, mas os dados dos títulos são reconstituídos da fonte única de recebíveis persistidos.

## Auditoria e segurança

Cada mudança relevante gera um evento imutável e uma saída transacional para integrações futuras. Os dados ficam em área privada do banco, sem acesso direto pelo navegador; a leitura e a gravação passam pela sessão autenticada e pelo escopo da empresa.

## Mensagens e ação recomendada

| Mensagem | O que fazer |
| --- | --- |
| “Este recebível já pertence à operação…” | Abra a operação indicada e confirme a duplicidade antes de continuar. |
| “Documento do sacado inválido” | Corrija CPF/CNPJ; informe somente um documento válido. |
| “Valor de face inválido” | Informe um valor maior que zero. |
| “Vencimento inválido” | Informe uma data de vencimento completa. |
| “A operação foi alterada por outra pessoa” | Atualize a tela, revise a versão mais recente e repita apenas a alteração necessária. |
| “Alterações da operação ainda não foram salvas” | Não feche a tela; verifique a conexão e tente salvar novamente. |

## Conferência antes da liberação

- quantidade e soma dos títulos conferem com a operação;
- cedente e sacado estão corretos;
- número do documento não foi reutilizado;
- vencimento e valor de face conferem com o lastro;
- decisão individual de risco está registrada;
- chave da NF-e foi informada quando aplicável;
- apenas títulos aprovados seguem para cessão.

## Limite atual conhecido

A importação histórica precisa trazer o detalhamento completo dos títulos. Totais agregados da operação são preservados, mas não criam títulos inexistentes. Quando um arquivo contém apenas uma amostra, a Carteira projeta somente os recebíveis detalhados e sinaliza a necessidade de completar a carga.

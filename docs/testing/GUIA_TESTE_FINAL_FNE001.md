# Guia final de homologação — FNE001

## Objetivo

Validar o fluxo completo do Motor de Operações: entrada, normalização, enriquecimento, política, elegibilidade,
gestão por exceção, análise final, formalização e disponibilização para o financeiro.

Este roteiro usa dados demonstrativos salvos no navegador. Integrações marcadas como **Demo**, **Pendente** ou
**Indisponível** não representam consultas oficiais. Não use o botão **Liberar para o financeiro** fora de um ambiente
de demonstração controlado.

## Preparação

1. Abra a aplicação no endereço informado pelo ambiente de desenvolvimento.
2. Se quiser repetir todos os cenários desde o início, use **Restaurar demonstração** somente após confirmar que os
   dados locais podem ser descartados.
3. Mantenha uma segunda aba disponível para conferir **Configurações > Políticas e motor**.
4. Registre em cada cenário: operação, resultado obtido, evidência visual e eventual divergência.

## 1. Políticas por empresa

1. Abra **Configurações > Políticas e motor**.
2. Confirme que cada empresa ou veículo possui sua própria política ativa, sem duplicidades ativas para a mesma
   vigência.
3. Crie uma nova política e selecione a empresa na estrutura multiempresa.
4. Baixe o modelo CSV, preencha uma cópia e importe o arquivo.
5. Crie uma nova versão de uma política ativa.

Resultado esperado: políticas ativas são somente leitura; alterações nascem como rascunho; empresa, modalidade,
versão e vigência ficam explícitas; importações inválidas são bloqueadas com motivo compreensível.

## 2. Entrada e normalização

1. Abra **Operações > Nova operação**.
2. Importe um CSV ou XML válido dos arquivos de teste.
3. Confira cedente, sacados, títulos, valores, vencimentos e origem antes de confirmar.
4. Tente importar o mesmo arquivo novamente.
5. Tente um arquivo inválido ou um formato ainda não suportado.

Resultado esperado: o sistema mostra uma prévia normalizada antes de criar a operação, identifica duplicidade e não
finge processar XLSX, CNAB ou conteúdo inválido. A operação criada preserva a origem e a trilha da entrada.

## 3. Enriquecimento e qualidade dos dados

1. Abra uma operação nova na etapa **Risco**.
2. Localize **Enriquecimento e fontes**.
3. Confira o resumo fechado e depois abra os detalhes.
4. Verifique fonte, situação, horário, cobertura e proveniência de cada dado.
5. Ative ou desative uma fonte demonstrativa e reexecute quando solicitado.

Resultado esperado: fonte interna, demo, oficial, pendente e indisponível são distinguidas claramente. Mudança de
fonte invalida a fotografia anterior e exige nova execução; dados ausentes nunca aparecem como consultados.

## 4. Motor Universal de Elegibilidade

1. Ainda em **Risco**, localize **Resultado da política**.
2. Com o painel fechado, confirme resultado geral e contadores.
3. Abra os detalhes e filtre alertas, exceções, inelegíveis e aprovadas.
4. Em pelo menos uma avaliação, confira regra, entidade, valor encontrado, parâmetro, política, versão e evidência.
5. Reexecute o motor após uma mudança permitida e confirme que a execução anterior permanece no histórico.

Resultado esperado: o motor usa a política vigente da empresa e produz **Aprovado**, **Alerta**, **Exceção** ou
**Inelegível**. Nenhuma explicação aparece sem uma regra e uma evidência realmente executadas.

## 5. Override e gestão por exceção

1. Abra uma regra que permita override.
2. Tente concluir a decisão sem justificativa suficiente.
3. Informe justificativa e registre a decisão com a alçada exigida.
4. Reabra o detalhe da regra.

Resultado esperado: o sistema bloqueia decisão incompleta e preserva resultado original, decisão humana, usuário,
data/hora, alçada, justificativa e evidências. Operações normais fluem; alertas informam; exceções param para decisão;
inelegíveis continuam impeditivos.

## 6. Lastro e preço

1. Avance uma operação liberada pelo motor.
2. Em **Lastro**, valide evidências e confirmações da amostra.
3. Deixe uma confirmação pendente e tente continuar.
4. Conclua as pendências e confira o avanço.
5. Em **Preço**, confira taxa, deságio, tarifas, líquido, spread, recompras e memória de cálculo.

Resultado esperado: confirmação humana pendente interrompe o fluxo. Quando tudo está regular, etapas mecânicas podem
avançar automaticamente e registram o responsável técnico. Condições abaixo do piso ou sem resultado positivo param
para análise.

## 7. Tela Final de Análise

1. Abra a etapa **Aprovação**.
2. Confira resumo da operação, resultado da política, cedente, sacados, enriquecimento, impacto na carteira e
   exceções.
3. Abra uma exceção até chegar à regra e à evidência.
4. Abra uma operação histórica sem snapshot do motor.

Resultado esperado: a tela prioriza o que exige atenção e permite o caminho **visão executiva > exceção > detalhe >
evidência**. Histórico sem fotografia aparece como **Não avaliado**, sem presumir aprovação.

## 8. Decisão e alçadas

1. Tente devolver ou reprovar com justificativa menor que oito caracteres.
2. Registre uma justificativa válida e confirme a trilha.
3. Em outro cenário, aprove todas as alçadas e depois aprove a operação.

Resultado esperado: devolução e reprovação exigem justificativa; aprovação depende das alçadas; toda decisão grava
resultado, responsável, data/hora e motivo. O sistema não decide crédito no lugar do humano.

## 9. Assinaturas e disponibilização

1. Após aprovar a operação, clique em **Enviar para assinaturas**.
2. Registre apenas uma assinatura e confirme que a etapa continua em **Aprovação**.
3. Registre a última assinatura obrigatória.

Resultado esperado: após a última assinatura, a operação muda automaticamente para **Pronta para liberar** e abre a
etapa **Liberação**. A conclusão aparece na trilha como ação do **Orquestrador FNE001**. Nenhum pagamento é criado.

## 10. Liberação controlada

1. Confira valor líquido, favorecido, forma de pagamento, conta, distribuição e data.
2. Altere a distribuição para deixar saldo ou exceder o líquido.
3. Confirme que o envio fica bloqueado e corrija os valores.
4. Em ambiente exclusivamente demonstrativo, clique em **Liberar para o financeiro**.

Resultado esperado: a soma precisa fechar exatamente o líquido e os dados dos favorecidos devem estar completos. A
ação explícita cria uma pendência financeira auditável; ela não simula pagamento bancário concluído.

## 11. Persistência e histórico

1. Recarregue a página após executar regras, override, decisão e assinatura.
2. Volte às etapas concluídas.
3. Confira versões de política e fotografias usadas na época.

Resultado esperado: estado, trilha e decisões permanecem salvos. Política atual não recalcula silenciosamente uma
operação histórica.

## 12. Visão geral e inteligência operacional

1. Abra **Visão geral**.
2. Confira carteira, caixa, concentrações, aging, deterioração, exceções e indicadores de produtividade.
3. Navegue dos indicadores para os detalhes disponíveis.

Resultado esperado: os gráficos contam uma história coerente, não repetem o mesmo número sem contexto e ajudam a
identificar risco, caixa e trabalho que exige atenção.

## Critérios finais de aceite

- [ ] Existe uma política versionada e vinculada a cada empresa/veículo.
- [ ] Entrada e normalização rejeitam dados inválidos sem criar informação fictícia.
- [ ] Fontes e qualidade do enriquecimento são transparentes.
- [ ] Toda conclusão do motor possui regra, política, versão e evidência.
- [ ] Override exige autorização e deixa trilha permanente.
- [ ] Operações normais fluem e exceções param para decisão humana.
- [ ] A Tela Final permite entender a operação em poucos segundos.
- [ ] Aprovação, reprovação, devolução e assinaturas continuam humanas.
- [ ] A última assinatura apenas disponibiliza a operação para Liberação.
- [ ] Nenhum pagamento é criado sem autorização financeira explícita.
- [ ] Histórico nunca é recalculado silenciosamente com a política atual.
- [ ] A interface permanece legível nos temas claro e escuro e em largura reduzida.

## Registro da homologação

| Item                   | Preenchimento                                 |
| ---------------------- | --------------------------------------------- |
| Empresa/veículo        |                                               |
| Responsável pelo teste |                                               |
| Data                   |                                               |
| Versão avaliada        |                                               |
| Resultado              | Aprovado / Aprovado com ressalvas / Reprovado |
| Pendências encontradas |                                               |
| Evidências anexadas    |                                               |

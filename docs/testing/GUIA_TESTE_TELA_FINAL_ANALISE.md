# Guia de teste — Tela Final de Análise

## Objetivo

Validar a leitura executiva apresentada na etapa **Aprovação**, confirmando que o operador compreende a operação em
poucos segundos e aprofunda somente exceções, regras e evidências quando necessário.

## 1. Acesso à tela

1. Abra **Operações**.
2. Selecione uma operação que já alcançou a etapa **Aprovação**.
3. Clique em **Aprovação** na esteira superior.
4. Localize o bloco **Análise final da operação** logo após o cabeçalho do pacote decisório.

Resultado esperado: a análise final aparece antes do resumo financeiro, das alçadas, dos documentos e das assinaturas.

## 2. Resumo executivo

Confirme a apresentação de:

- cedente e documento;
- valor bruto e líquido;
- taxa final;
- prazo médio;
- quantidade de títulos;
- resultado da política.

Resultado esperado: os números correspondem aos dados preservados da operação. Informações ausentes devem aparecer
como **Não registrada** ou **Não registrado**, nunca como um valor inventado.

## 3. Operação histórica sem snapshot do motor

1. Na demonstração, abra o aditivo **20260924001**.
2. Entre na etapa concluída **Aprovação**.
3. Confira o resultado da política.
4. Confira o bloco **Exceções e alertas**.

Resultado esperado:

- o resultado aparece como **Não avaliado**;
- a tela informa **Operação histórica sem execução registrada**;
- a explicação deixa claro que o sistema não presume enquadramento sem snapshot;
- os valores bruto, líquido e a quantidade histórica de títulos continuam visíveis.

## 4. Operação nova com execução do motor

1. Use uma operação que tenha títulos detalhados e execução congelada na etapa **Risco**.
2. Conclua Risco, Lastro e Preço conforme as pendências apresentadas.
3. Entre em **Aprovação**.
4. Confira os contadores de títulos analisados, elegíveis, pendentes e inelegíveis.
5. Compare os contadores do motor com o painel preservado na etapa Risco.

Resultado esperado: a análise final utiliza o mesmo snapshot da etapa Risco; ela não recalcula a operação com uma
política mais recente.

## 5. Cedente e impacto no limite

Confira:

- limite aprovado;
- limite utilizado;
- limite disponível;
- saldo projetado após a operação;
- score interno;
- vencido histórico.

Resultado esperado: o impacto projetado considera a nova operação e não altera o cadastro do cedente.

## 6. Sacados e concentração

1. Compare os principais sacados com os títulos da entrada.
2. Confira quantidade de títulos, valor e concentração percentual.
3. Verifique se os maiores valores aparecem primeiro.

Resultado esperado: a concentração é calculada sobre o valor bruto da operação e permite identificar rapidamente os
maiores riscos.

## 7. Exceção, detalhe e evidência

1. Localize **Exceções e alertas**.
2. Abra um item.
3. Confira regra, entidade analisada, explicação, evidência, política e versão.
4. Quando houver override, confira decisão humana, responsável e justificativa.

Resultado esperado: toda explicação deriva de uma regra executada e de uma evidência registrada. O override não apaga
o resultado original.

## 8. Decisão humana preservada

1. Confira a análise final.
2. Role até **Alçadas**.
3. Verifique que as ações de aprovação continuam no fluxo já existente.

Resultado esperado: a análise final informa e explica; ela não aprova, reprova ou avança a operação automaticamente.

## 9. Apresentação

1. Alterne entre tema claro e escuro.
2. Redimensione a janela.
3. Confira cabeçalho, métricas, cedente, sacados e exceções.

Resultado esperado: os blocos reorganizam sem sobreposição e o detalhamento continua legível.

## Critérios de aprovação

- [ ] A análise final aparece antes das ações decisórias.
- [ ] Valores e quantidades correspondem à operação.
- [ ] Histórico sem snapshot não é apresentado como enquadrado.
- [ ] O resultado utiliza a política e a versão congeladas na execução.
- [ ] Cedente e impacto de limite são compreensíveis em uma leitura rápida.
- [ ] Principais concentrações por sacado aparecem em ordem decrescente.
- [ ] Apenas alertas, exceções, impeditivos e decisões de override exigem aprofundamento.
- [ ] Regra, explicação e evidência permanecem rastreáveis.
- [ ] Nenhuma decisão humana é executada automaticamente.
- [ ] A tela permanece legível em tema escuro e largura reduzida.

## Limite desta etapa

Esta entrega consolida informações já disponíveis e preserva o comportamento atual das alçadas. A integração do
resultado do motor como bloqueio determinístico da aprovação só deve ocorrer após homologação das políticas, dos
parâmetros e dos cenários de exceção.

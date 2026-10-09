# Guia de teste — Motor de Elegibilidade versionado

## Objetivo

Homologar a integração do Motor Universal de Elegibilidade na V7 sem alterar automaticamente o andamento da operação.
O painel calcula, explica, congela a execução e permite registrar uma decisão humana sobre exceções quando a etapa de
Risco ainda está ativa.

## Preparação

1. Abra `http://localhost:3000/`.
2. Entre em **Operações**.
3. Abra o aditivo **20260925004 — GZ Transportes Ltda**.
4. Selecione a etapa **Risco**. Ela pode aparecer como etapa atual ou concluída, conforme o estado já salvo no navegador.
5. Localize **Resultado da política · execução versionada**.

Se essa operação já foi aberta antes desta ampliação, ela pode continuar exibindo o snapshot anterior com **16**
avaliações e a política universal **v0.1**. Isso é intencional: o histórico não é recalculado silenciosamente. Para
executar o cenário novo com **21** avaliações e a política **v0.2**, use uma operação ainda não analisada ou restaure os
dados de demonstração somente se puder descartar as alterações locais do protótipo.

## Cenário 1 — leitura executiva

Confirme primeiro com o motor fechado:

- resultado geral visível sem abrir os detalhes;
- contadores essenciais de avaliações, aprovadas, alertas, exceções e inelegíveis;
- botão **Abrir detalhes**.

Clique em **Abrir detalhes** e confirme no painel:

- resultado geral **Exceção**;
- **21** avaliações;
- **19** aprovadas;
- **1** alerta;
- **1** exceção;
- **0** inelegíveis;
- identificação das políticas **Regras universais demonstrativas v0.2** e **FIDC Mercantil v4.2**.

Resultado esperado: o operador entende em poucos segundos que há duas situações que merecem atenção e que nenhuma
regra impeditiva foi encontrada.

Clique em **Fechar detalhes** e confirme que o resultado executivo continua visível, enquanto regras e evidências são
recolhidas.

## Cenário 2 — alerta de evidência fiscal

1. Expanda **Título NF-66420/01**.
2. Confirme que a regra é `TITLE-FISCAL-EVIDENCE-001`.
3. Confirme que o valor encontrado é **não**, o parâmetro é **sim** e a evidência informa que a chave NF-e está vazia.
4. Confirme que a ação é **Sinalizar** e que não há override.

Resultado esperado: **Alerta**. O item chama atenção, mas não impede sozinho a continuidade.

## Cenário 3 — exceção de concentração

1. Expanda **Supermercado Haag Ltda**.
2. Confirme que a regra é `DEBTOR-OPERATION-CONCENTRATION-MAX-001`.
3. Confirme **37,23%** encontrado contra parâmetro demonstrativo de **35,00%**.
4. Confirme a evidência **R$ 132.000,00 de R$ 354.528,02**.
5. Confirme a ação **Solicitar decisão humana**, política **FIDC Mercantil v4.2** e override para **Gerente de crédito**.

Resultado esperado: **Exceção**, não reprovação automática.

## Cenário 4 — gestão por exceção

1. Confirme que, inicialmente, somente o alerta e a exceção estão visíveis.
2. Clique em **Ver 19 aprovadas**.
3. Inspecione algumas regras aprovadas e confirme que também possuem regra, encontrado, parâmetro, política e evidência.
4. Clique em **Ocultar aprovadas**.

Resultado esperado: a tela privilegia o que exige atenção sem esconder a trilha completa.

## Cenário 5 — ausência de efeito colateral

1. Observe a etapa e o status atual da operação.
2. Expanda e recolha resultados do motor.
3. Navegue para outra etapa e volte ao Risco.
4. Confirme que nenhuma decisão de cedente, sacado ou título foi alterada pelo painel.

Resultado esperado: o motor não altera automaticamente o fluxo ou as decisões existentes.

## Cenário 6 — snapshot e histórico

1. Confirme que o painel informa a data da execução e as versões de política usadas.
2. Navegue para outra etapa e volte ao Risco.
3. Confirme que os mesmos resultados permanecem associados à operação.

Resultado esperado: a execução anterior é reutilizada, sem recalcular o histórico silenciosamente.

## Cenário 7 — override auditável

Este cenário só fica editável enquanto **Risco** for a etapa atual. Em uma etapa já concluída, o painel deve mostrar
somente a consulta histórica.

1. Expanda uma regra em **Exceção**.
2. Confirme a alçada indicada.
3. Clique em **Aprovar override** ou **Rejeitar exceção**.
4. Informe uma justificativa com pelo menos oito caracteres.
5. Confirme a decisão.
6. Verifique que o resultado original continua visível e que a decisão humana aparece com usuário, data, alçada e
   justificativa.

Resultado esperado: a decisão é acrescentada à trilha, sem apagar ou modificar o resultado original do motor.

## Cenário 8 — apresentação

1. Alterne entre tema claro e escuro.
2. Redimensione a janela para uma largura menor.
3. Confirme que os indicadores reorganizam sem sobreposição e que os detalhes continuam legíveis.

## Critérios de aprovação desta etapa

- [ ] Resultado executivo correto e compreensível.
- [ ] Alerta de NF-e explicado por regra e evidência reais.
- [ ] Exceção de concentração explicada com valor, parâmetro, política e alçada.
- [ ] Aprovadas ocultas por padrão e acessíveis sob demanda.
- [ ] Nenhuma alteração automática no fluxo ou nas decisões existentes.
- [ ] Execução e versões preservadas ao sair e retornar à operação.
- [ ] Override exige justificativa e mantém a exceção original visível.
- [ ] Parâmetros claramente identificados como demonstrativos.
- [ ] Aparência coerente com a V7 em tema claro, escuro e tela estreita.

## Observação importante

Os limites desta demonstração são configurações versionadas usadas para validar a arquitetura. Eles não representam
limites universais ou de mercado. A próxima etapa só deve substituir esses valores pela política real depois da
homologação deste comportamento.

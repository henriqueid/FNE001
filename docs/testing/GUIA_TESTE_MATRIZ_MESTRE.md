# Guia de homologação — Matriz Mestre de Elegibilidade

## Objetivo

Validar que a política deixou de ser apenas uma configuração interna e passou a ser administrável, versionada e
conectada ao Motor Universal, sem alterar silenciosamente execuções históricas.

## Preparação

1. Abra `http://localhost:3000/`.
2. No menu lateral, clique em **Configurações**.
3. Selecione **Políticas e motor**.
4. Confirme o título **Matriz Mestre de Elegibilidade**.

## 1. Visão executiva

Confirme os quatro indicadores no topo:

- **58** regras no catálogo mestre;
- **11** regras executáveis com os dados atuais;
- **4** políticas ativas na carga demonstrativa, uma por empresa/veículo;
- **4** empresas e veículos disponíveis.

Resultado esperado: regras e políticas aparecem como conceitos separados. O catálogo informa o que pode ser
avaliado; cada política fornece seus próprios parâmetros.

## 2. Criação de uma política por empresa

1. Clique em **Nova política**.
2. Informe nome, empresa/veículo, produto ou carteira, versão e início da vigência.
3. Confirme que a modalidade acompanha a empresa selecionada.
4. Clique em **Criar política**.

Resultado esperado: a política nasce como rascunho, vinculada à empresa escolhida e sem controlar operações até ser
parametrizada e ativada.

## 3. Modelo de importação

1. Clique em **Baixar modelo** e abra o arquivo CSV em um editor de planilhas.
2. Preencha os campos institucionais repetidos e marque `enabled` como `true` nas regras desejadas.
3. Informe parâmetros, resultado, ação, override e alçada.
4. Salve em CSV e clique em **Importar arquivo**.

Resultado esperado: o arquivo é validado e entra como rascunho. Empresa inexistente, modalidade incompatível ou regra
desconhecida devem impedir a importação com uma mensagem explicativa.

## 4. Consulta de uma política ativa

1. Selecione **Política Lastro Prime FIDC** na lista de políticas.
2. Confirme versão **v1.0**, camada **INSTITUIÇÃO**, modalidade **FIDC** e situação **Ativa**.
3. Verifique as regras de concentração, limite, carteira e estrutura do fundo.
4. Confirme que os campos estão bloqueados para edição.

Resultado esperado: uma política ativa é somente leitura e preserva a regra vigente.

## 5. Criação de uma nova versão

1. Com **Política Lastro Prime FIDC** selecionada, clique em **Nova versão**.
2. Confirme que foi criada uma versão **Rascunho**.
3. Confirme que a versão ativa anterior continua na lista como **Ativa**.
4. Altere o parâmetro de concentração de um sacado.
5. Altere o resultado ou a ação da regra, se desejar.

Resultado esperado: apenas o rascunho é editável; a versão vigente não muda durante a preparação.

## 6. Catálogo mestre e maturidade das regras

1. Abra um rascunho.
2. Pesquise regras por nome, nível ou categoria.
3. Confirme as indicações **Disponível agora**, **Requer dado** e **Requer integração**.
4. Adicione regras à política e habilite apenas aquelas com parâmetro preenchido.

Resultado esperado: o catálogo cobre título, sacado, cedente, operação, carteira e estrutura sem afirmar que uma regra
dependente de SEFAZ, bureau, registradora ou funding já pode ser executada.

## 7. Override e alçada

1. No rascunho, localize uma regra marcada como exceção.
2. Desmarque e marque novamente a opção de override.
3. Confirme que a informação de alçada permanece associada à regra quando o override está permitido.

Resultado esperado: permitir override não transforma a regra em aprovação automática; apenas habilita decisão humana
na alçada configurada.

## 8. Vigência e ativação

1. Defina a data de início da vigência no rascunho.
2. Revise os parâmetros.
3. Clique em **Ativar versão**.
4. Confirme que a nova versão passa a **Ativa**.
5. Se a vigência já começou, confirme que a versão anterior do mesmo escopo passa a **Encerrada**, com término no dia
   anterior.

Resultado esperado: novas análises passam a resolver a política pela vigência; operações com snapshot continuam
mostrando a versão originalmente executada.

## 9. Integração com a tela de Risco

1. Abra uma operação compatível com a política alterada.
2. Entre na etapa **Risco**.
3. Localize **Motor Universal de Elegibilidade**.
4. Confira o resultado com o painel fechado.
5. Clique em **Abrir detalhes** e valide regra, parâmetro, política, versão e evidência.

Observação: uma operação histórica com snapshot não deve ser recalculada. Para validar uma política recém-ativada,
use uma operação ainda sem execução congelada.

## 10. Persistência

1. Volte para **Políticas**.
2. Atualize a página.
3. Confirme que o rascunho ou a versão ativada permanece disponível.

## Critérios de aprovação

- [ ] Catálogo mestre e parâmetros de política estão visualmente separados.
- [ ] Nova política exige empresa/veículo do ambiente multiempresa.
- [ ] Modelo CSV pode ser baixado, preenchido e importado como rascunho.
- [ ] Catálogo diferencia regra disponível, dependência de dado e dependência de integração.
- [ ] Política ativa é somente leitura.
- [ ] Nova versão nasce como rascunho e não altera a ativa.
- [ ] Parâmetros, resultado, ação e override podem ser configurados no rascunho.
- [ ] Ativação respeita escopo e vigência.
- [ ] Versão anterior é encerrada sem ser apagada.
- [ ] Motor da operação utiliza políticas ativas aplicáveis.
- [ ] Snapshot histórico permanece imutável.
- [ ] Alterações sobrevivem à atualização da página.

## Limite desta etapa

A persistência ainda é local ao navegador da demonstração. A próxima evolução, após homologação, é levar a biblioteca
de políticas para o backend com perfis de acesso, aprovação de publicação e auditoria institucional.

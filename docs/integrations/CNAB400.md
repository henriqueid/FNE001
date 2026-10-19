# Cobrança CNAB400 — Itaú e Bradesco

Implementação local em `src/domain/banking/cnab400.ts`, verificada com fixtures independentes por posição em `tests/cnab400.test.ts`. Não houve transmissão, validação pelo banco ou homologação.

## Fontes primárias

Consultadas em 18/10/2026:

- [Itaú, Cobrança CNAB400, janeiro/2017](https://download.itau.com.br/bankline/layout_cobranca_400bytes_cnab_itau.pdf).
- [Central oficial Bradesco](https://wspf.bradesco.com.br/wsValidadorUniversal/), que identifica a edição agosto/2022 e aponta para o [manual CNAB400 atual](https://banco.bradesco/assets/pessoajuridica/pdf/mpo_arquivos_layout_400P.pdf). PDF de 48 páginas; extraído localmente porque a ferramenta web recusou seu tamanho. O [manual anterior](https://banco.bradesco/assets/pessoajuridica/pdf/4008-524-0121-layout-cobranca-versao-portugues.pdf) foi usado somente para conferência inicial.

Referências abaixo indicam páginas físicas do PDF, começando em 1, e posições inclusivas começando em 1.

| Banco    | Páginas          | Campos utilizados                                                                                                                                                                                                                                                                                                                   |
| -------- | ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Itaú     | 7–8, 12          | Header: agência27–30, conta33–37, DAC38; detalhe: identificação18–29, controle38–62, nosso número63–70, carteira84–86/108, ocorrência109–110; documento111–120, vencimento121–126, valor127–139, espécie148–149, emissão151–156, instruções157–160; juros161–173, desconto174–192, pagador219–351; sequência395–400; trailer tipo9. |
| Itaú     | 13–14, 17–20, 23 | Retorno: arquivo109–113, carteira83–85, nosso número86–93, ocorrência109–110, data111–116, documento117–126, vencimento147–152, nominal153–165; tarifa176–188, IOF215–227, abatimento228–240, desconto241–253, crédito254–266, juros/multa267–279, outros créditos280–292, crédito296–301, motivos378–385. Notas3/5/6/9/10/17.      |
| Bradesco | 7–10, 15–19      | ASCII/CRLF/EOF; header convênio27–46, sistema109–110, remessa111–117; detalhe identidade21–37, controle38–62, nosso número71–82, emissão93; campos comuns109–314, CEP327–334, sequência395–400; DAC módulo11/base7, incluindo P e zero.                                                                                             |
| Bradesco | 32–34, 37–39     | Retorno: aviso109–113; identidade21–37, nosso número71–82, ocorrência109–110, data111–116, documento117–126; valores153–292, data crédito296–301, motivos319–328; trailer tipo9/banco5–7. Ocorrências e semântica do valor recebido.                                                                                                |

## Contrato da implementação

`generateCnab400Remittance({ account, generatedOn, remittanceSequence, titles })` devolve texto ASCII: 400 bytes por registro, CRLF, e EOF `0x1A` adicional no Bradesco. A persistência/transmissão deve manter esses bytes; a sequência de remessa Bradesco deve ser reservada externamente sem repetição. Itaú não possui campo de sequência da remessa neste header.

`parseCnab400Return(content, account)` exige banco, beneficiário, conta/convênio e carteira esperados. Devolve identificação do arquivo e eventos com valores inteiros em centavos, datas ISO, ocorrência original, motivos, registro original, sequência e chave estável de idempotência. A chave identifica fatos do evento, independentemente do nome, data ou ordem do arquivo. O chamador deve persistir sua unicidade e o arquivo original dentro da mesma transação dos efeitos financeiros.

`paidAmountSemantics` distingue crédito em conta Itaú de total recebido Bradesco. Os componentes são preservados sem reconstruir valores brutos ou líquidos. Juros Itaú incluem multa; desconto Bradesco pode agregar abatimento conforme retorno. Não inventar componentes separados.

Para duplicatas adquiridas, `title.finalBeneficiary` recebe os dados cadastrais reais do cedente/sacador (mesmo formato de `payer`). Itaú usa nome352–381 do tipo1 e complemento5, tipo/documento122–137, endereço138–177, bairro178–189, CEP190–197, cidade198–212 e UF213–214 (PDFp12, nota30/p37). Bradesco usa documento335–349 e nome352–394 do tipo1, mais complemento7 com endereço2–46, CEP47–54, cidade55–74, UF75–76 e vínculo367–394 (PDFp15/21). CPF Bradesco preserva nove posições de raiz, quatro zeros de filial e dois dígitos finais. A sequência inclui esses complementos. O Bradesco exige cadastro prévio na agência: `account.finalBeneficiaryEnabled === true` deve representar habilitação efetivamente contratada, nunca um valor presumido pela aplicação.

## Escopo e limites

- Entrada01, espécie01, moeda real: Itaú109 e Bradesco09/19 com emissão pelo cliente; Itaú112 escritural com numeração pelo banco. DAC Bradesco calculado; não gera boleto/código de barras localmente.
- Retorno: entrada02, rejeição03, liquidação06, baixa09; Bradesco também baixa10 e rejeição24. Baixa sem pagamento permanece baixa. Ocorrências diferentes são recusadas para revisão manual, incluindo PIX, estorno, cartório e pagamento parcial.
- Instruções0000: nenhum protesto, negativação, alteração ou baixa automática comandados. Valores não utilizados ficam zerados segundo seu campo; complementos ficam em branco.
- Datas restritas a 2000–2099; título de entrada a vencer, CPF/CNPJ válidos, CEP de oito dígitos, textos sem truncamento. Conversão de acentos é explícita para ASCII.
- Sem desconto múltiplo, IOF de seguro, rateio ou débito automático. Multa percentual Itaú é enviada em registro2; o complemento equivalente Bradesco permanece fora do escopo. Beneficiário final distinto exige os dados completos no complemento implementado; não preencher com os dados do adquirente por conveniência.
- Validar contrato, carteira, faixa de nosso número, credenciais da conta e layout vigente com cada banco e concluir homologação formal antes de uso produtivo. Nenhuma conta fictícia é aplicada por padrão em produção.

## Fluxo autenticado de arquivos

`POST /api/finance/banking` recebe `action: "remittance"`, conta, títulos e chave de comando; ou `action: "return"`, conta, conteúdo original e chave. Exige sessão, tenant, `finance:release` e escopo da empresa da conta e dos ativos. `GET` com conta e chave recupera a remessa persistida. A interface apenas baixa/carrega arquivos, sem transmitir ao banco.

Na mesma transação com lock financeiro do tenant, o servidor carrega cadastros persistidos, reserva nossos números/sequência, atribui o vínculo aos recebíveis, grava Finance/Portfolio e eventos append-only `BankRemittance`/`BankCommand` em `domain_events`. Repetir chave/conteúdo devolve o arquivo exato. Chave reaproveitada com outro conteúdo é recusada. Contadores inferiores aos números já emitidos são rejeitados mesmo após alteração indevida da configuração.

O retorno deve corresponder a uma remessa única desta conta: nosso número, controle e documento. `BankReturn` identifica o fato bancário independentemente de alias ou identificador do arquivo. Apenas06 usa o comando de liquidação integrado, reconciliando nominal, saldo, juros/desconto e valor recebido antes de alterar caixa e carteira juntos. Demais ocorrências alteram somente estado bancário/histórico.

Tarifa, IOF, abatimento e outros créditos/despesas não possuem lançamentos auxiliares configurados neste fluxo. Qualquer valor não zero bloqueia o arquivo inteiro, inclusive tarifa de confirmação de entrada. O rollback preserva caixa/carteira e `BankReturnBlock` registra arquivo, hash e motivo para conferência. Não zerar esses componentes para forçar uma importação.

Configuração real adicional em `CompanyBankAccount.collection`: dígito da conta, CPF/CNPJ e razão social do beneficiário, próxima sequência, juros diários em centavos explícitos e habilitação Bradesco de beneficiário final. Configurar exige `settings:manage`; emissão/importação usa `finance:release`. Contas e cadastros incompletos bloqueiam geração, sem adotar dados demonstrativos por padrão.

## Itaú 112 informado pelo usuário

A captura de configuração identifica carteira112; o usuário confirmou juros8% ao mês. As taxas não são aplicadas automaticamente a outras contas nem embutidas em fixtures. A periodicidade comercial de30dias aparece explicitamente no formulário: o valor diário é calculado por título em centavos, com arredondamento determinístico. Por exemplo, R$1.000 a8% a.m. gera R$2,67/dia. `monthlyInterestPercent` e `dailyInterestCents` são mutuamente exclusivos.

Na112, a remessa envia `00000000` no nosso número. O controle da empresa é único por sequência/item. O retorno02 atribui o número bancário; liquidação requer esse vínculo confirmado. Reatribuição, colisão e retorno de remessa antiga são recusados. A reserva de sequência permanece atômica; não se consome uma faixa local de nossos números.

Para a conta Itaú112 informada pelo usuário, foram confirmados juros de8% ao mês e multa de2% a partir do dia seguinte ao vencimento (`lateFineDaysAfterDue: 1`). Essa confirmação não altera padrões de outras contas nem configura dados em produção.

`lateFinePercent` com `lateFineDaysAfterDue` explícito gera registro2, código2, data DDMMAAAA e percentual com duas casas. `sendPayerEmail` gera registro5 com e-mail cadastrado do sacado, preservando-o e combinando os dados do sacador quando necessário. Sem e-mail válido solicitado, a remessa é recusada.

Fonte: [manual oficial Itaú](https://download.itau.com.br/bankline/layout_cobranca_400bytes_cnab_itau.pdf), notas3/5 (p18), registro2 (p9), registro5 (p12), notas29/35 (p37–39). A numeração pelo banco e os complementos precisam ser homologados no contrato efetivo. A captura não comprova transmissão nem aceite bancário.

# STRATO — roteiro de validação do piloto

Data: 18/10/2026. Referência: [inventário T01–T19](superpowers/plans/2026-10-18-prontidao-operacional.md). Este roteiro distingue testes locais executados de homologação operacional ainda necessária. Não autoriza publicação, transmissão bancária nem movimentação real.

## 1. Preparar o ambiente

Use uma instalação de homologação e dados fictícios. Crie dois tenants e, no primeiro, duas empresas A/B. Separe administrador, Operações, Risco, Controladoria, Financeiro e consulta. O perfil restrito à empresa A nunca pode consultar ou alterar B. Reserve uma segunda pessoa para aprovar mudanças de configuração de alçadas; a condução da operação pode ser individual quando a pessoa possui as permissões e atribuições exatas exigidas.

Cadastre cedente e sacado com documentos válidos de teste, endereço completo e dados bancários de homologação. Configure política de elegibilidade, parâmetros de preço, alçadas e contas contábeis. Use uma conta de recebimentos e uma de pagamentos da mesma empresa dos títulos. Mantenha orçamento de IA pequeno para os testes negativos. Não use chaves ou arquivos produtivos em capturas.

Antes de começar, registre versão do código, data, pessoa responsável, tenant, empresa, navegador e ambiente. Garanta acesso aos eventos, comandos, estados versionados, diário, movimentos e volume privado de anexos. Preserve as evidências antes/depois sem senhas ou tokens.

## 2. Executar as verificações locais

### Evidência executada nesta entrega

- `npm run check`: passou (tipos, lint, formatação e **682 testes**; **14 ignorados** na suíte comum).
- `npm run build`: passou. Avisos do empacotador sobre divisão de módulos/classificação estática não impediram o build.
- Runner PostgreSQL: **39 migrações**, **13 testes** financeiros/bancários/IA/aprovações e **2 testes** de restauração de documentos passaram, incluindo remessa/atribuição de número/liquidação Itaú112. Cluster temporário encerrado. Concessões anteriores à devolução ficam sem efeito, com isolamento entre tenants/operações e preservação dos eventos antigos.
- Dump/restauração mais recente: **74 tabelas e 1.018 linhas**, contagens/SHA-256 e metadados de segurança iguais em outra base do cluster descartável. Evidência local: `C:/Users/henri/AppData/Local/Temp/strato-isolated-pg-YyK1Lp`.
- HTTP após restauração: login com credencial temporária restaurada, cookie HttpOnly/SameSite, leitura autenticada de Financeiro/Operações, recusa sem sessão/em outro tenant e revogação após logout passaram no build de produção em loopback. Servidor e cluster encerrados. Evidência: `restored-http-evidence.json` nessa pasta; sem TLS, navegador ou jornada completa da operação.
- PDF/XLSX: leitores independentes e conferência de totais; QA visual demonstrativa em desktop e celular. Exemplos: `output/playwright/accounting-exports.png`, `controlleria-exports.png`, `settlement-banking-fixed.png` e `settlement-mobile.png`.

Esses resultados não significam que V01–V26 foram todos executados pela interface autenticada. As linhas abaixo continuam sendo a campanha de homologação operacional, com etapas externas explícitas.

Na cópia do projeto:

```text
npm run check
npm run build
node scripts/test-postgres-isolated.mjs
```

O último comando exige binários PostgreSQL locais. `STRATO_TEST_PG_BIN` indica a pasta de `initdb`, `pg_ctl`, `pg_dump`, `createdb` e `pg_restore`. Ele cria outro cluster em porta própria, aplica as migrações versionadas, executa os testes financeiros/bancários/IA, restaura um dump em outra base e encerra o cluster. Não usa a conexão existente da aplicação. Evidências ficam na pasta temporária informada ao terminar.

Os testes PostgreSQL são condicionais na suíte comum: um resultado “ignorado” não é aprovação de SQL. Execute o runner específico. A compatibilidade local de papéis/funções históricas não homologa Supabase gerenciado. PostgreSQL 18 local também não substitui o ensaio na versão/infraestrutura efetivas da implantação.

## 3. Validar os fluxos e as recusas

Cada linha exige evidência antes/depois. Em falha esperada, confirme também ausência de alterações parciais.

| ID | Execução | Resultado esperado |
| --- | --- | --- |
| V01 · T01 | Grave compra e pagamento. Tente editar/remover partida antiga, alterar seu valor ou trocar o de-para histórico. Faça estorno permitido. | Edição recusada inclusive em período aberto. Estorno mantém origem, contrapartidas inversas na mesma empresa e referências recíprocas. Plano pode receber contas novas sem reescrever fatos. |
| V02 · T02 | Libere uma operação com títulos e favorecidos válidos. Feche a tela assim que a resposta chegar e consulte novamente. | Operação, recebíveis, compra, obrigação e eventos persistidos conjuntamente. Abrir a página não é necessário para gerar os registros. Falha de gravação não deixa somente parte deles. |
| V03 · T03 | Pague parcialmente e depois integralmente um favorecido; estorne nos dois cenários de caixa. Tente enviar status “pago” sem movimento/partidas. | Pagamento parcial conserva saldo residual exato; operação acompanha o estado confirmado. Estorno sem caixa real recompõe banco; com caixa real cria recuperação. Snapshot forjado é recusado. |
| V04 · T04 | Em ativo de R$ 1.000, receba principal R$ 400, juros R$ 20 e desconto R$ 10. | Saldo do ativo R$ 600; caixa aumenta R$ 410; principal pago R$ 390 e desconto R$ 10. Diário balanceado. Exposição, atraso e indicadores usam o novo saldo. |
| V05 · T04 | Estorne V04 e receba novamente. Repita o mesmo comando após perder a resposta. | Saldo recomposto, fatos preservados e novo ciclo sem CR aberto duplicado. Replay não cria novo caixa. Estorno repetido com outra chave é recusado. |
| V06 · T04/T17 | Importe posição que mantém o saldo-base, outra que já reflete exatamente a baixa local e uma divergente. | Nenhuma dupla baixa. Divergência ou ausência em nova posição gera aviso e bloqueia movimentação desses títulos; a origem precisa ser reconciliada. Não presumir que mudança de data representa pagamento. |
| V07 · T05 | Devolva operação sem registro bancário ativo, com motivo/data e etapa de destino. Repita após perda de resposta. Depois refaça análise/aprovação/liberação. | Compra e registro anteriores permanecem no histórico. Obrigações/ativos cancelados e contrapartidas na mesma transação. Reaquisição gera nova compra/favorecidos, atualiza projeção e exige aprovações do novo ciclo. |
| V08 · T05 | Tente devolver com título registrado, remessa pendente, recebimento ativo, pagamento conciliado ou data inválida. | Recusa específica; nenhum cancelamento unilateral no banco nem alteração financeira parcial. Regularizar os fatos antes de tentar novamente. |
| V09 · T06 | Modifique valor/preço/resultado de elegibilidade no navegador, pule etapas e tente aprovar sem atribuição. | Servidor recalcula título, preço, exposição e política; rejeita saltos e autoridade indevida. Texto de autoria ou nome de alçada não concede permissão. |
| V10 · T06 | Na etapa Risco, execute análise vigente. Para uma avaliação com exceção permitida, decida com justificativa e alçada correta. Altere os fatos e repita. | Concessão legítima permite o avanço correspondente. Evento vincula avaliação, fatos, política, pessoa e alçada. Fatos/política/ciclo novos invalidam concessão antiga. Dado indisponível permanece explícito, sem zero ou demonstração substitutos. |
| V11 · T06 | Proponha uma configuração de alçadas por empresa e tente aprová-la com a mesma pessoa; depois use outra autorizada. | Autoprovação da configuração recusada. Aprovação distinta persiste regra e eventos. Na operação, cada slot exige permissão e atribuição vigentes; condução individual não ignora essas verificações. |
| V12 · T07 | Entre em tenant sem Financeiro. Inicialize com administrador autorizado; repita o comando. Tente com perfil sem configuração ou versão inicial diferente de zero. | Inicialização válida uma única vez; replay seguro. Sem dados de demonstração no ambiente autenticado. Tentativas não autorizadas/versão incorreta recusadas. |
| V13 · T08 | Duas sessões baixam o mesmo saldo/versão; repita remessa em paralelo. Injete falha após escrever Financeiro e antes de Carteira. | Uma versão válida; concorrente recebe conflito. Numeração não se repete. Rollback remove caixa, projeções e comandos parciais. A resposta perdida é recuperada pela mesma chave. |
| V14 · T09 | Interrompa rede/servidor ao salvar Cadastro, Comercial, ocorrência da Carteira e baixa Financeira. Tente autoria adulterada. | Sem mensagem de sucesso antecipado nem fechamento do formulário; rascunho preservado. Autor dos novos fatos corresponde à sessão. Snapshot antigo não recebe artificialmente versão nova para sobrescrever outro. |
| V15 · T10 | Anexe assinatura manual, recarregue e baixe os mesmos bytes. Tente outro tenant/empresa/operação e corrompa cópia em homologação. | ID estável, hash/tamanho/MIME íntegros e acesso autorizado. Acesso indevido e corrupção recusados. Nunca substituir o anexo por nome/link temporário sem bytes preservados. |
| V16 · T11 | Marque uma integração como ativa sem resposta externa verificável. | Origem continua pendente/não comprovada. Tela não apresenta dado demonstrativo como Receita, SEFAZ ou bureau oficial. |
| V17 · T12 | Importe OFX correto, repetido, com múltiplas contas, FITID conflitante, data/valor inválido e duas correspondências iguais. | Conta confirmada; repetição segura; conflito rejeitado. Conciliação ambígua aguarda decisão. Seleções inexistentes/de outra conta e período fechado são recusados. |
| V18 · T13 | Desative licença/habilitação, exceda orçamento e dispare duas chamadas concorrentes. Simule timeout e virada mensal UTC. | Provedor não é chamado sem reserva válida. Reserva/consumo ficam auditados. Falha ambígua retém reserva; rollover preserva legado na adoção; liquidação antiga não reduz mês novo. Navegador não altera usado. |
| V19 · T14 | Configure conta CNAB400 real de homologação, gere remessa selecionada e recupere pela chave. Reenvie o mesmo comando e tente baixar a sequência. | Mesmos bytes, ordem e nossos números; sequência reservada uma vez e sem retrocesso. Empresa, conta, cedente/sacador e sacado conferidos. Sem transmissão automática. |
| V20 · T14 | Importe retorno original de entrada, rejeição, liquidação e baixa sem pagamento; repita com outro nome de arquivo. | Apenas liquidação suportada movimenta caixa; baixa não significa recebimento. Alias não duplica fato. Conta/documento/nosso número precisam corresponder à remessa. |
| V21 · T14 | Retorno com tarifa/IOF/abatimento ou ocorrência não implementada. | Arquivo bloqueado integralmente com motivo e evidência; não zerar componentes para forçar importação. Homologação permanece pendente para variantes não implementadas. |
| V22 · T15 | Faça dump e cópia do volume; restaure banco e documentos em ambiente isolado e entre pela aplicação restaurada. | Estados, eventos, diário, permissões e bytes conciliados. Verifique hashes, downloads, login e acesso indevido. Registre RPO/RTO e responsável. O ensaio local automatizado não aprova a recuperação produtiva. |
| V23 · T16 | Exporte balancete, DRE, diário e relatório da Controladoria em PDF e XLSX, com filtro de período/empresa. | Arquivos abrem em leitores reais; valores coincidem com a tela/fonte; débitos=créditos. Datas/números tipados e texto não executa fórmulas. PDF preserva páginas e português, com aviso para caracteres incompatíveis. |
| V24 · T17 | Carregue XML/CSV/CNAB aceitos e um XLS/XLSX ou arquivo disfarçado. | Formatos oferecidos correspondem ao processamento. Binários exigem conversão explícita para CSV. Extração comum CNAB na entrada da operação exige revisão e não substitui integração bancária homologada. |
| V25 · T18 | Em HTTPS, instale PWA; fique offline e volte à rede. Inspecione cache. | Aviso offline; sem comandos financeiros offline. APIs/documentos/dados operacionais fora do cache do worker. Instalação precisa ser testada nos dispositivos do piloto. |
| V26 · T18 | Ative worker de notificações em homologação, feche navegadores e produza evento de decisão. Simule falha temporária. | Notificação processada no servidor, sem duplicar com outra instância/tela. Retry controlado; falha permanente fica para revisão. Sem habilitar worker produtivo por este teste. |

## 4. Homologar Itaú e Bradesco

O usuário confirmou **CNAB400** para os dois bancos e forneceu captura Itaú **carteira112**, confirmando depois **juros8% ao mês**. A implementação local abrange Itaú109/112 e Bradesco09/19, nas condições documentadas em [integrations/CNAB400.md](integrations/CNAB400.md). A carteira/convênio Bradesco ainda não foi informada; a captura Itaú não comprova homologação bancária.

Para Itaú112, configure juros de8% ao mês com base comercial de30dias e multa de2% a partir do dia seguinte ao vencimento (`lateFineDaysAfterDue: 1`), conforme confirmação do usuário. Marque envio por e-mail somente com cadastro válido do sacado. A remessa deve conter nosso número zerado e controle da empresa exclusivo por título; após retorno02, confira o número atribuído pelo banco. Só então importe liquidação06. Teste rejeição sem número, dois títulos na mesma remessa, colisão, reatribuição, valor/vencimento divergentes, remessa antiga e repetição02 após liquidação. A numeração local não deve ser consumida pela112. O registro2 codifica multa e início; o registro5 preserva e-mail e dados do sacador.

Para cada banco, obtenha carteira/convênio, conta/dígito, beneficiário, faixa de nosso número, sequência, emissão pelo cliente, regra de juros e habilitação do beneficiário final. Confronte com o manual efetivo do contrato. Gere lote pequeno de homologação, valide no banco, confira entrada/rejeição e depois liquidação/baixa. Guarde arquivos originais, hashes, confirmação bancária e conciliação contábil. Nenhum teste deve movimentar recursos reais sem o processo operacional autorizado.

Bureau e provedor de assinatura eletrônica não foram informados. Registrar escolha, contrato, credenciais de homologação, escopo, callbacks, evidências e testes negativos antes de declarar integração operacional. Anexo manual preservado não equivale a homologação de assinatura eletrônica.

## 5. Evidências e aceite

Para cada V01–V26, registrar: executante, data, ambiente, dado usado, chave de comando/evento, resultado observado, evidência e ocorrência. Classificar como **passou**, **falhou**, **não executado** ou **dependência externa**. Não transformar ausência de teste em aprovação.

O aceite do piloto exige: nenhuma falha de integridade/isolamento em aberto; diferenças contábeis zeradas; conflitos/replays/rollback comprovados; recuperação do ambiente e do volume homologada; contratos bancários e fornecedores definidos; todos os cenários aplicáveis executados por responsáveis operacionais. Limites de formatos, ocorrências bancárias, reservas incertas de IA e fontes indisponíveis precisam estar conhecidos pelo operador.

As verificações automatizadas locais e a QA visual demonstrativa são evidências de implementação. Login autenticado completo, HTTPS/dispositivos, backup produtivo e homologação bancária/fornecedores permanecem etapas próprias de aceite.

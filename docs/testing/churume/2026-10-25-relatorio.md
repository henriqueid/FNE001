# Churume — primeira campanha operacional

Data local: 25/10/2026 · STRATO · ambiente local isolado, com dados fictícios.

**Atualização após autorização de correção:** C01–C07 receberam correções e regressões locais; recompra recebeu as escolhas Sim/Não definidas pelo usuário. Resultado, novas evidências e pendências em [correções do dossiê](2026-10-25-correcoes.md). Este documento preserva o diagnóstico original; não representa o estado posterior às correções.

## Parecer

**Não aprovado para homologação integral.** A campanha percorreu as etapas do Comercial à Cobrança, combinando interface, testes de regras e inspeção. Encontrou sete grupos de defeitos, três de prioridade alta, além de lacunas funcionais e integrações ainda sem homologação.

Não houve uma única operação nova atravessando a jornada inteira: dois bloqueios interromperam o caminho. Para avaliar etapas seguintes, foram usados outros cenários fictícios, identificados abaixo. Visitar uma tela não significa validar todas suas ações.

Agente reutilizável: [perfil Churume](../agents/churume.md), registrado em `AGENTS.md`. Para nova campanha, pedir **“rode o Churume”**. Não foi criado agendamento automático nem agente instalado dentro do produto.

## O que está bom

- Comercial orienta dossiê, visita, proposta e comitê. Tentativa de colocar lead em comitê antes da visita/proposta foi recusada com motivo específico.
- Risco mostra concentração excedida e exige exceção justificada pela alçada. Registro mantém autor, data e decisão original.
- Condição comercial salva fica protegida de edição acidental; revisão passa por ação explícita.
- Aprovação operacional recusou avanço enquanto faltavam alçada, documentos ou assinaturas. Há problema separado na prontidão final, descrito em C06.
- Liberação gera obrigação vinculada à operação. Pagamento de teste usou conta da empresa correta e fechou obrigação, extrato e contabilidade.
- Cobrança preservou ocorrência, autor, canal, próximo contato e promessa, atualizando lista e painel. Há problema separado no texto da fila, C07.
- Indicadores de carteira apresentam fórmula/fonte. Controladoria reúne pendências e eventos de formalização/cobrança.
- Testes existentes exercitam recusas de adulteração financeira, autorização, repetição e isolamento. Isso não elimina as lacunas encontradas nem substitui PostgreSQL real.

## Achados e ordem de correção

P1 = prioridade alta antes do aceite operacional. P2 = inconsistência operacional ou dificuldade recuperável. Reprodução e referências exatas estão na [auditoria técnica](2026-10-25-auditoria-codigo.md).

| ID  | Prioridade       | Problema observado                                                                                                                                                                                                   | Ação recomendada                                                                                                 |
| --- | ---------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| C01 | P1               | Executivo sem autoridade de risco consegue enviar novo comitê já aprovado ou alterar limite por caminhos que escapam à guarda. Handler real aceitou com sessão/persistência simuladas; não houve gravação produtiva. | Exigir autorização em toda concessão/alteração material de limite e vinculá-la à decisão no servidor.            |
| C02 | P1               | Falha entre salvar Financeiro e atualizar Comercial permite repetir envio de comissão: 18 → 22 → 26 títulos candidatos, mantendo competência Fechada. Callbacks de persistência simulados.                           | Comando idempotente e transação Comercial + Financeiro; regressão de falha parcial e duas sessões.               |
| C03 | P1               | Histórico Comercial aceita substituir conteúdo anterior mantendo quantidade de linhas.                                                                                                                               | Preservar conteúdo anterior, autoria e eventos materiais no servidor.                                            |
| C04 | P2               | Soma do “líquido” por título não inclui IOF/retenção manual descontados no total. Caso dirigido mostrou diferença de R$109,57559185. Não demonstrou pagamento errado.                                                | Reconciliar componentes por título e total, ou nomear subtotal e mostrar ponte até líquido final.                |
| C05 | P2, demonstração | Lead aprovado aparece como cedente em onboarding, mas botão Cadastro não abre ficha. Caminho autenticado possui criação transacional inspecionada, ainda sem ensaio SQL.                                             | Criar ficha correspondente na demonstração ou abrir cadastro preenchido; eliminar clique silencioso.             |
| C06 | P2               | Operação manual mostra prontidão 4/4, documentos e assinaturas completos, mas concluir bloqueia genericamente por outro critério de NF-e.                                                                            | Unificar contrato de prontidão e nomear requisito pendente; decidir política de evidência sem presumir dispensa. |
| C07 | P2               | Promessa e próximo contato futuros ficam salvos, mas fila/agenda/escalonamento dizem “Sem retorno agendado após a última cobrança.”                                                                                  | Informar retorno futuro corretamente, preservando prioridade de atraso/escalonamento quando aplicável.           |

**F01 — lacuna de prontidão, P1:** recompra/compensação no preço de operação real não dispõe de seleção autoritativa. Servidor bloqueia; não houve operação indevida. Implementar e homologar antes de anunciar rotina disponível. Devolução/reaquisição é outro fluxo.

Melhorias adicionais:

- Entrada manual habilita Adicionar título antes dos campos obrigatórios; clique incompleto não orienta operador.
- Atalho de comitê pode abrir antes da visita/proposta, embora envio seja corretamente recusado. Antecipar orientação.
- Comitê aceita aprovação simples sem parecer de risco. Avaliar justificativa mínima como decisão de governança; não foi presumida regra obrigatória existente.
- Próximas entregas da Carteira e CNAB precisam distinguir capacidades disponíveis, futuras e dependentes de ambiente autenticado.

## Cobertura por etapa

“Executado” refere-se aos cenários descritos, não a todas combinações. A [matriz técnica de 21 rotinas](2026-10-25-auditoria-codigo.md#matriz-operacional) detalha conjuntos automatizados, limites e exceções.

| Etapa                              | Interface nesta campanha                                                                  | Evidência complementar / pendência                                                                                                                         |
| ---------------------------------- | ----------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Comercial                          | Nove abas abertas; criado lead, dossiê, visita, proposta e decisão de comitê              | Regras/escopo executados; C01/C03. Metas, manutenção de equipe e todas variantes de visita não homologadas pela UI.                                        |
| Comissões                          | Aba inspecionada                                                                          | Handler real com falha parcial reproduziu C02. Fechar/enviar/pagar integrado com servidor não executado.                                                   |
| Cadastros/onboarding               | Cedentes e projeção do lead aprovado; Cadastro inerte                                     | C05. PF/PJ, duplicidade, vínculos e conta bancária com dupla conferência cobertos em regras. Cadastro completo, contrato e todos papéis pela UI pendentes. |
| Entrada                            | Nova operação, sacado, duplicata manual e campos obrigatórios                             | CSV/XML/CNAB em testes. Importações completas pela UI, CCB e todos formatos não executados.                                                                |
| Risco                              | Bloqueio de concentração, justificativa de exceção e aprovação dos elegíveis              | Políticas, autoridade e vínculo com fatos em testes; consultas externas bloqueadas.                                                                        |
| Lastro/checagem                    | Dispensa configurada observada; fila de Controladoria aberta                              | Exigência de parecer/confirmações em testes. Checagem manual completa e SEFAZ não executadas na UI.                                                        |
| Preço                              | Conferidos componentes e salvo líquido de R$866,49                                        | Recálculo/limites testados. C04 e F01; todas combinações de tarifas/garantias não homologadas.                                                             |
| Aprovação/alçadas                  | Recusa inicial; alçada final, aprovação e prontidão                                       | C06 bloqueou conclusão. Autoridade, adulteração e concorrência simulada testadas; locks SQL pendentes.                                                     |
| Formalização                       | Pendências e duas assinaturas manuais fictícias, documentos marcados na demonstração      | Checklist não comprova documento/assinatura real. Upload privado/hash em testes; provedor não homologado.                                                  |
| Liberação                          | Operação seed pronta enviada ao Financeiro; obrigação CP-00088                            | Coordenação/rollback em adaptadores. Não foi continuação da nova operação bloqueada.                                                                       |
| Pagamento/extrato                  | Baixa fictícia integral R$786.934,22; conta BB da Aurora; saldo R$523.065,78              | Conta, valor, origem e contrapartida conferidos. Parciais/replay/estorno cobertos em testes; transferência real não realizada.                             |
| Carteira                           | Cinco abas abertas; títulos, cedentes, comerciais, atraso e fontes de indicadores         | Overlay/exposição/integridade em testes. Não foi comprovada aquisição das 72 posições anunciadas no resumo seed.                                           |
| Cobrança humana                    | Seis recursos abertos; ocorrência Outro + promessa de 28/10 gravada no título RCI-5518/01 | Promessas 0 → 1 e histórico atualizados. C07. Contato externo, negociação completa e acordo não executados.                                                |
| Remessa/retorno                    | Tela informa indisponibilidade de arquivos/carteira bancária na demonstração              | 51 casos CNAB400 locais; banco real bloqueado. Não gerar certificado de homologação por estes testes.                                                      |
| Liquidação de recebível            | Não executada pela interface nesta campanha                                               | Principal/juros/desconto/replay/rollback em testes. Diferente de pagar liberação ao cedente.                                                               |
| Conciliação                        | Conta correta, movimento pendente e saldo; sem OFX importado para BB                      | 19 testes de conciliação; fluxo completo de importação e conferência humana pendente.                                                                      |
| Contabilidade                      | Balancete com banco R$523.065,78, cedentes a pagar zerado e débitos = créditos            | Diário/integridade e exportações em testes. Fechamento/reabertura pela UI e revisão contábil independente pendentes.                                       |
| Controladoria                      | Seis abas abertas: Painel, Checagem, Formalização, Conciliação, Auditoria e Relatórios    | Eventos fictícios de formalização e cobrança aparecem. Todas ações corretivas das filas não executadas.                                                    |
| Devolução/cancelamento/reaquisição | Não executados pela interface nesta campanha                                              | Devolução: 20 execuções × 8 casos, sem falha. SQL real e campanha integrada pendentes.                                                                     |
| Segurança/transversal              | Origem local isolada; alterações de teste identificadas                                   | Suíte cobre tenant/permissões; login real com perfis, celular, acessibilidade completa, offline e recuperação produtiva pendentes.                         |

## Percursos e valores rastreados

### A — Comercial até onboarding

CHURUME — Cliente de Teste, documento fictício 99.888.777/0001-00. Dossiê 0% → 100%, visita realizada, proposta, comitê aprovado em R$100 mil e taxa 2,5%. Conversão aparece em Cedentes. **Interrompido em Cadastro, C05**. Nenhum cliente real contatado.

### B — Nova operação até aprovação

Cerealista Boa Safra, aditivo 20261026001 / borderô 0003409. Duplicata CHURUME-001, face R$1.000, vencimento 25/11/2026, sem NF-e. Concentração de 100% tratada por exceção fictícia justificada. Lastro dispensado pelo cadastro. Deságio R$26,69, tarifas R$84,50, IOF R$4,54, garantia R$17,78, líquido R$866,49. Aprovações 3/3, documentos 6/6 e assinaturas manuais 2/2. **Interrompido em concluir Aprovação, C06**. As marcações da demonstração não foram tratadas como evidência fiscal/contratual válida.

### C — Liberação pronta até efeitos financeiros

Seed Alimentos Horizonte, aditivo 20261024001 / borderô 0003405, empresa Aurora. Liberação R$786.934,22 → obrigação CP-00088 → pagamento fictício → movimento MV-00089. BB inicial R$1.310.000,00 − R$786.934,22 = **R$523.065,78**, igual no extrato, Bancos, conciliação e balancete. Conta Cedentes a pagar com débito/crédito R$786.934,22 e saldo zero. Totais do balancete R$1.935.920,82 em ambos lados. Movimento continua a conciliar, corretamente, sem extrato OFX correspondente.

### D — Cobrança com promessa

Seed RCI-5518/01, saldo R$112.400, vencido 47 dias. Ocorrência identificada CHURUME, canal Outro, sem transmissão externa, promessa de 28/10 e retorno 28/10 às 09h. Histórico, GRID, Controladoria e painel Promessas registraram evento. **Texto da fila inconsistente, C07**. Não representa negociação ou compromisso real.

## Verificações

- Suíte comum executada pelo Churume: **770 aprovados, 16 ignorados, zero falhas**. Resultado JSON conferido pelo agente principal.
- `npm run check`: concluído com sucesso na campanha, incluindo os mesmos 770 testes. Não somar execução repetida como cobertura nova.
- Sondagens dirigidas: **10/10**, reexecutadas pelo agente principal após descoberta C07. Confirmam defeitos/controles; não significam dez rotinas aprovadas.
- Devolução: **160 execuções de casos** em 20 rodadas, sem reproduzir oscilação histórica.
- Exportações condicionais: **9/9**, incluindo PDF/XLSX. Arquivos não receberam homologação visual independente.
- 16 ignorados na suíte comum: 15 dependentes de PostgreSQL e um exportador condicional posteriormente executado.

## Evidências

- [Auditoria técnica e reprodução por achado](2026-10-25-auditoria-codigo.md).
- [55 observações da interface em JSON](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-evidencias-ui.json). Primeiras observações e algumas intermediárias são diferenças da árvore acessível; não usar isoladamente como captura integral de cada tela.
- [Prontidão contraditória](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-prontidao-bloqueada.png).
- [Extrato conferido após pagamento fictício](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-extrato-conferido.png).
- Logs e sondagens temporárias relacionados na auditoria técnica. `/tmp` não é arquivo permanente de homologação.
- Prévia de testes separada: http://127.0.0.1:5175/?design=refined&screen=app. Exige servidor local ativo; não é publicação.

## Pendências para aceite integral

1. Corrigir C01–C03 com regressões de autorização, histórico imutável e falha parcial; revisar C04/C06/C07 e demonstração C05.
2. Definir disponibilidade de recompra/compensação real, F01.
3. Executar PostgreSQL isolado com constraints, locks, rollback e duas sessões. Campanha atual não usou credenciais produtivas.
4. Repetir jornada autenticada com um mesmo cliente/operação, do dossiê ao recebimento, incluindo recusa, devolução, estorno e reaquisição.
5. Homologar arquivos dos bancos efetivos, assinaturas, consultas externas e reconciliação de extratos com responsáveis; sem transmissão real nesta campanha.
6. Cobrir ações ainda não executadas na matriz, celular/acessibilidade e recuperação da infraestrutura antes de declarar cobertura total.

Produto não foi corrigido ou publicado nesta auditoria. Foram criados perfil/instrução e relatórios; dados fictícios foram alterados somente na prévia de testes isolada.

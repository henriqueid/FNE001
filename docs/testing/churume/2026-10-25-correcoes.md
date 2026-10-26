# Churume — correções do dossiê

25/10/2026 · implementação local autorizada pelo usuário. Sem commit, publicação, migração aplicada, credenciais produtivas ou transmissão bancária.

## Resultado por achado

| Item                             | Correção implementada                                                                                                                                                                                           | Evidência / limite                                                                                                                    |
| -------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- |
| C01 · autoridade de limite       | Guarda exige autoridade para comitê novo decidido, decisão posterior e alteração material. Vínculo exige decisão correspondente e valor exato. Revalidação transacional e isolamento de IDs/documentos ocultos. | Regressões de rota, escopo e persistência; sem gravação produtiva.                                                                    |
| C02 · comissão com falha parcial | Intenção servidor grava Financeiro + fechamento sob mesma transação/lock, com versões, replay e validação de memória. UI não executa duas gravações.                                                            | Falha intermediária, retry, concorrência, escopo e endpoint em testes. Dois testes SQL adicionados, ainda não executados sem cluster. |
| C03 · histórico mutável          | Prefixo comparado por conteúdo; decisões finalizadas preservadas. Novos autor/data definidos no servidor.                                                                                                       | Histórico adulterado e autoria falsa recusados.                                                                                       |
| C04 · memória não conciliável    | Memória inclui IOF e retenção manual, rateio em centavos e ajuste explícito. Fórmula agregada preservada.                                                                                                       | VA ligado/desligado, múltiplos títulos e ambos rateios.                                                                               |
| C05 · onboarding demonstrativo   | Conversão gera ficha e reconstitui conversões antigas ausentes na recarga; preserva cadastros já revisados. Atalho indisponível apresenta feedback.                                                             | Quatro testes e abertura da ficha CHURUME preenchida na interface.                                                                    |
| C06 · prontidão contraditória    | Aprovação e bloqueador usam o mesmo checklist; mostra NF-e/CMC7 e automação quando exigidos.                                                                                                                    | Interface mostra NF-e faltante e mensagem nominal. Dispensa de pré-checagem não foi convertida em dispensa documental.                |
| C07 · retorno futuro             | Fila informa data agendada e preserva prioridade do atraso.                                                                                                                                                     | Testes antes/no dia/depois da promessa; UI confirmou 28/10.                                                                           |
| UX · entrada/comitê              | Campos obrigatórios orientados antes de adicionar título/parcelar. Comitê explica necessidade de visita/proposta. Novas aprovações requerem parecer de risco; decisões legadas preservadas.                     | Regressões de entrada e Comercial; feedback visível.                                                                                  |
| UX · bancos/navegação            | Carteira abre Financeiro diretamente na aba Cobrança. Texto distingue CNAB400 Itaú/Bradesco de outras capacidades ainda indisponíveis.                                                                          | Teste de renderização e navegação observada.                                                                                          |
| F01 · recompra                   | Implementadas opções explícitas Baixar título Sim/Não; principal aberto autoritativo, reserva contra repetição e efeitos coordenados.                                                                           | Detalhes e limites abaixo. Compensações avulsas continuam sem fonte autoritativa.                                                     |

## Recompra: comportamento definido pelo usuário

- **Sim:** desconta principal aberto do líquido da nova operação e baixa título no sistema na liberação. Para boleto registrado compatível, enfileira instrução de baixa 02 na próxima remessa; nosso número/registro originais preservados. Banco permanece Registrado até retorno confirmar baixa.
- **Não:** desconta o mesmo principal e mantém título aberto para cobrança do sacado. Reserva vinculada impede descontá-lo novamente em outro borderô.
- Ambas escolhas são obrigatórias por título selecionado, sem valor padrão silencioso. Fonte: carteira do mesmo cedente e empresa; saldo é reconferido no servidor.
- Sem boleto ou já baixado no banco: baixa interna não fabrica instrução bancária desnecessária. Vínculo inconclusivo/liquidado, conta incompatível ou registro original não rastreável impedem a liberação com baixa.
- Rejeição bancária conserva pendência e motivo; confirmação somente por retorno. Liquidação posterior à baixa interna é bloqueada para conciliação, sem apropriar novo caixa automaticamente.
- Aplicação e estorno têm vínculo de origem. Operação de origem não pode ser devolvida enquanto título estiver comprometido em recompra dependente. Recebimento posterior ou remessa de baixa já gerada/confirmada exige regularização antes da devolução.
- Na opção Não, valor descontado permanece retenção no passivo enquanto ativo continua aberto. Sua destinação posterior exige conciliação; esta versão não implementa comando automático de devolução dessa retenção.

Escopo desta implementação: **principal integral, mesma empresa e cedente**. Não foram presumidas regras para juros, mora, VP, recompra parcial, compensações avulsas ou grupo empresarial. Esses controles não são oferecidos no fluxo real. A demonstração antiga preserva simulações identificadas.

Contrato canônico: [Arquitetura](../../ARCHITECTURE.md), [CNAB400](../../integrations/CNAB400.md).

## Revisão independente e regressões adicionais

Revisor encontrou e verificou correção de quatro problemas durante implementação: preservação de negócio oculto no merge segmentado; preservação do principal aplicado na leitura/PUT; prevenção de fila de baixa sem registro original; bloqueio da devolução da operação origem com recompra dependente na opção Não. Nenhum novo P1/P2 confirmado ficou pendente nessa revisão. Isso não equivale a auditoria de segurança completa.

Teste concorrente de devolução apresentava oscilação: depois de aceitar um vencedor, testava conflito de chave sempre contra primeiro comando. Agora identifica comando realmente vencedor, confere replay e recusa conteúdo divergente sem repetir estorno. Não foi alterada regra financeira para acomodar teste.

A interface incorpora aplicações autoritativas na confirmação de gravação sem apagar edição posterior do operador. Criação assistida limpa aplicações/contextos anteriores.

## Validação e prévia

`npm run check` passou: tipos, lint, formatação e **869 testes aprovados, 18 ignorados, zero falhas**, em 144 arquivos aprovados e quatro ignorados. Os ignorados são 17 casos PostgreSQL e um exportador condicional. `npm run build` passou; `git diff --check` sem erros. Logs: `/tmp/strato-churume-fixes-check.log` e `/tmp/strato-churume-fixes-build.log`.

- Testes dirigidos dos achados observados falhando antes das respectivas correções.
- Revisão independente F01: 60 testes dirigidos e sondagem da dependência da operação origem aprovados.
- Interface: cadastro convertido abre preenchido; prontidão nomeia NF-e; cobrança mostra retorno futuro; atalho abre Cobrança.
- Prévia isolada da recompra: dois títulos fictícios de R$9.000 e R$4.000, escolhas Sim/Não, desconto R$13.000 e líquido R$84.218,75. Condição salva como v1 protegida. A tela de prévia não aplica baixa nem transmite arquivo.

Links locais, dependentes do servidor de prévia ativo:

- [Aplicativo de teste](http://127.0.0.1:5175/?design=refined&screen=app).
- [Teste específico de recompra](http://127.0.0.1:5175/?design=refined&screen=repurchase).

Capturas:

- [Cadastro corrigido](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-cadastro-corrigido.png).
- [Prontidão com requisito nominal](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-prontidao-corrigida.png).
- [Recompra Sim/Não](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/churume-recompra-sim-nao.png).

## Pendências reais

PostgreSQL/locks/recuperação reais continuam sem execução: binários locais ausentes. Bancos, convênios, assinatura e consultas externas exigem homologação própria; não houve transmissão nesta campanha. Campanha autenticada completa, todos os dispositivos e ações ainda não executadas na matriz original permanecem pendentes. O código corrigido não transforma esses itens em aprovados.

Compensações avulsas e destinação automatizada da retenção posterior à cobrança na opção Não permanecem fora da implementação. Não estão liberadas por esta entrega. Publicação ainda não realizada.

# Churume — campanha de cobertura integral

25–26/10/2026 · STRATO local · dados fictícios · origem isolada `http://127.0.0.1:5176/?design=refined&screen=app`.

**Resultado: reprovado para homologação integral. A cobertura individual de todos os controles ainda não foi concluída.** Há falhas reproduzidas de isolamento, tarefas, rastreabilidade e continuidade operacional. Inventariar uma ocorrência, abrir uma aba e certificar uma rotina são evidências diferentes.

## Cobertura medida

| Evidência | Resultado | Significado |
| --- | --- | --- |
| Inventário estático | 201 arquivos TSX; 1.399 ocorrências | Botões, links, formulários, campos e componentes delegados. Templates repetidos; não representa 1.399 botões distintos. |
| Interface | 252 cenários registrados | 239 observações aprovadas, 7 falhas, 6 bloqueadas/inconclusivas. Aprovação limitada à ação descrita; navegação não certifica todos os recursos da aba. |
| Verificação completa | typecheck, lint, formatação e testes aprovados | 144 arquivos de teste aprovados, 4 ignorados; 869 testes aprovados, 18 ignorados. |
| Sondas de defeitos | 21 testes em 3 arquivos, todos reproduzidos | Testes esperam o comportamento defeituoso; passar aqui confirma o problema. Sessões/persistência simuladas nas fronteiras indicadas. |

Sem banco PostgreSQL real, provedores externos, IA paga ou transmissão bancária. Nenhuma publicação ou correção de produto nesta campanha. Testes temporários removidos; código das sondas preservado em `.ts.txt`.

## Percursos executados na interface

- Menu superior: oito módulos; busca global; sino; Central do Dia; Copiloto; Operação ao Vivo; visão de Marina e retorno ao administrador.
- Configurações: nove seções; cadastros vazios de usuário, empresa e banco; expansão bancária; preferência de jornada; políticas; orçamento de IA e excesso de cotas.
- Políticas: criação, catálogo de 58 regras, inclusão de concentração, validação de publicação, três versões, encerramento das anteriores e persistência. Política fictícia `CHURUME — Concentração restrita`, vQA-3, Factoring, produto `CHURUME-TESTE`, concentração máxima de 1%, REPROVADO/BLOQUEAR, sem override. Não foi demonstrado o uso desse produto pela criação de operações da interface.
- Comercial: nove abas. Oportunidade CHURUME → dossiê completo → bloqueio por visita pendente → agendamento e relato → proposta → pedido → pauta → parecer de risco obrigatório → aprovação fictícia → cedente em onboarding. Conferência do limite de R$100.000 e origem. Edição cadastral com motivo e histórico; transferência fictícia de Rafael para Camila.
- Cadastros: nove filtros de papéis, oito seções da ficha, formulário genérico, obrigatórios, auditoria e preservação do evento comercial.
- Operações: filas, Kanban/lista, filtros, pesquisa vazia, etapas anteriores/futuras, criação CCB e bloqueio; cinco tipos de entrada manual, busca e cadastro de sacado, cópia de título e duplicidade. Duas linhas iguais avançaram da Entrada, mas o motor reprovou ambas por `TITLE-DUPLICATE-001`; também reprovou valor abaixo do mínimo. Cancelamento manteve identidade e justificativa.
- Preço → pagamento: operação fictícia Mundo das Canecas, aditivo20261025003; preço exigiu gravação; aprovação exigiu alçada; assinaturas manuais somente após aprovação; segunda assinatura encaminhou automaticamente para Liberação. Terceiro incompleto bloqueou envio; remoção restaurou prontidão. Um lançamento de R$97.289,69 chegou ao Financeiro e foi pago apenas na demonstração. Remessa simulada de oito títulos e retorno; diário contábil e crescimento da carteira de16 para24 títulos ativos conferidos. Não foi um percurso novo completo de Entrada até Cobrança: esse trecho começou em operação previamente na etapa Preço.
- Controladoria: seis abas. Carteira: cinco abas, seis recursos de cobrança, ficha, histórico, Controladoria, detalhes técnicos, 21 acionamentos de ordenação, quatro filtros, nove colunas extras e restauração. Ordenação recebeu teste de acionamento/estado; não houve comparação matemática exaustiva de todas as linhas. Cobrança exigiu resumo e data para promessa; contato fictício com retorno29/10 ficou no histórico. Links sem telefone/e-mail não possuíam destino; nenhum contato externo enviado.
- Copiloto: melhor liquidez retornou empate entre Cerealista Boa Safra e Têxtil Serra Gaúcha, fórmula e 100%; menor score retornou Rede Clínica Integra, 416/1000, explicitamente interno. Sem chamada paga.
- IA: teto fictício10.000 tokens, seis cotas somando exatamente10.000; excesso8.334 bloqueado; divisão válida restaurada e consumo atualizado sem executar modelo.

## Achados prioritários reproduzidos

Detalhes, condições, linhas e sondas estão nos três relatórios vinculados abaixo. Não extrapolar mocks/SSR/demonstração para ocorrência observada em produção.

| Prioridade | ID | Problema e consequência |
| --- | --- | --- |
| P0 | F03 | Tarefa agregada de vencidos sem empresa/operação atravessa filtro de escopo. Sonda mantém exposição de B visível ao Financeiro exclusivo de A. Na demonstração, Marina vê zero vencidos no resumo e prioridade global de nove. Depende de agregado amplo previamente persistido. |
| P1 | F01/F02 | Estado de tarefas não inicializa por PUT; IDs novos do reconciliador são rejeitados. Pendências podem não persistir. |
| P1 | F04/F10 | Snapshot, responsável e conclusão de tarefa podem mudar sem novo evento; escopo candidato não é revalidado adequadamente. Não demonstrado acesso à operação proibida. |
| P1 | F05/F11 | Delegação sem compatibilidade de empresa/permissão; tarefa pode desaparecer do remetente e destinatário. A persistência da interface após delegar GZ não foi certificada; sondas reproduzem a combinação incompatível. |
| P1 | F06 | Grade e exportação recebem somente200 títulos, sem paginação para o restante. |
| P1 | F07 | Novo episódio de atraso pode herdar tarefa concluída e ficar sem alerta. |
| P1 | F08 | Presença e tempo conectado são sintetizados, apresentados como ao vivo. Navegação UI testada; fabricação demonstrada pela sonda. |
| P1 | F09 | Limite global de100 notificações precede filtro de escopo, podendo esconder item autorizado. |
| P1 | CFG-01 | API aceita substituir histórico cadastral e autoria do payload; atualização sem motivo passa pelo handler. Não houve escrita em banco real. |
| P1 | OP-01 | CCB anuncia partes/cronograma, cria zero títulos e abre registro somente leitura; fluxo sem caminho de preenchimento. Reproduzido também por clique. |
| P1 | OP-04 | Devolver Aprovação ao Risco usa persistência que rejeita a própria transição no ambiente autenticado. |
| P2 | CFG-02 | Corpo parcial em empresa/destino lança TypeError em vez de erro de validação. |
| P2 | CFG-03 | Perfil de consulta recebe editor administrativo habilitado; servidor continua recusando gravação. |
| P2 | OP-02 | Comitê resolve dossiê por nome, podendo abrir homônimo errado. Caso sem homônimo funcionou na UI. |
| P2 | OP-03 | Consulta marcada como fonte ativa apenas altera indicador local; não consulta provedor nem gera evidência oficial. |
| P2 | UI-01 | “Ver linha do tempo completa” não faz nada. Botão sem handler em `operation-summary-aside.tsx:306`; clique OPS-016. |
| P2 | UI-02 | “Ver estrutura do veículo” não faz nada. Botão sem handler em `operation-summary-aside.tsx:252`; clique OPS-017. |
| P2 | UI-03 | Resumo da Entrada mostra líquido R$100,00, mas subtrai4,29+80,00+0,09+0,31 na composição. Não fecha; valor provisório não explicado. Não foi demonstrado cálculo de pagamento real errado. ENT-009. |
| P2 | UI-04 | Inteligência demonstrativa anuncia “IA disponível” junto de “Credencial ausente”; fila exibe erro técnico cru de JSON. SET-011. Não comprovado no ambiente autenticado. |
| P2 | UI-05 | Ocorrência histórica demonstrativa “Em cartório” exibe data `26//2/25/1`. TIT-002. Outros eventos novos exibiram data correta. |

São18 achados das sondas, mais5 observações novas de interface. IDs agrupados na tabela mantêm seus registros individuais nos relatórios especializados.

## Melhorias e hipóteses, sem promover a defeito confirmado

- Concentração máxima aceitou101% e1.011%. Falta contrato explícito da faixa desse parâmetro; melhorar validação sem impor limite universal a qualquer percentual.
- Atalho financeiro permanece habilitado para Marina, mas não abre módulo proibido nem explica a recusa. A barreira de navegação foi preservada.
- Busca global abre módulo legado Integrações “Fase2”, enquanto Configurações já contém fontes editáveis. Unificar entrada.
- Motivo de alteração cadastral fica em Papéis e responsáveis. Ao salvar em outra seção, erro não leva ao campo obrigatório.
- Pedido ao comitê recebeu limite e parecer do dossiê, mas taxa apareceu vazia; preenchida novamente para continuar teste.
- Fontes CFG-04/05/06 e I01–I06 do relatório transversal continuam INSPECIONADAS. Exigem reprodução específica; não somadas aos23 achados.
- Cliques durante rolagem colocaram alguns controles sob cabeçalho fixo. Casos afetados foram repetidos ou ficaram bloqueados; não classificados como defeito do recurso pretendido.

## Cobertura ainda necessária

1. Concluir execução individual dos controles e estados restantes do inventário. O CSV não atribui aprovação pela simples associação de família. Autenticação/onboarding real, memória assistiva, upload/importação, rotinas avançadas e branches não percorridos permanecem visíveis como pendentes.
2. Ambiente autenticado isolado com dois tenants/empresas e usuários incompatíveis; executar sessões reais, maker-checker, revogação, concorrência e carga/falha/retry. Simulação de perfil não equivale a autenticação separada.
3. PostgreSQL descartável para18 testes ignorados e comandos transacionais reais: orçamento/reservas, comissões, recompra Sim/Não, baixa bancária, liberação, pagamento e estorno.
4. Uploads válidos/inválidos por todos os formatos anunciados; inspecionar arquivos exportados, PDFs e downloads. EXP-001 acionou CSV, mas não certificou conteúdo.
5. Pré-checagem exigida com amostra, resultados excepcionais, anexos e alçadas; UI desta campanha percorreu dispensa, sondas cobriram regras. Um percurso novo completo desde o Comercial até liquidação/cobrança ainda precisa ser fechado com fixture integral.
6. Homologação de banco, assinatura e fontes externas; apenas fixtures ou sandbox. Sem credenciais homologadas, transmissão/entrega real fica BLOQUEADA, nunca aprovada por simulação.
7. Teclado, leitor de tela, celular, carregamento, conexão perdida, dupla ação e recarga em cada mutação; cobertura atual não representa todas as combinações.

## Evidências

- [Índice de252 cenários de interface](2026-10-25-campanha-total/execucao-ui.md) e [árvores completas](2026-10-25-campanha-total/execucao-ui.json).
- [Inventário integral](2026-10-25-campanha-total/inventario-controles.md), [CSV de disposição por controle](2026-10-25-campanha-total/cobertura-controles.csv) e [resumo de métricas](2026-10-25-campanha-total/resumo.json).
- [Operações, Comercial e Políticas](2026-10-25-campanha-total-operacoes.md).
- [Configurações, Cadastros e Acesso](2026-10-25-campanha-total-configuracoes.md).
- [Financeiro, Carteira e Transversal](2026-10-25-campanha-total-financeiro-transversal.md).
- [Verificação completa](2026-10-25-campanha-total/verificacao-completa.txt) e [sondas repetidas pelo agente principal](2026-10-25-campanha-total/verificacao-sondas.txt).

![Operação fictícia conferida no Financeiro](2026-10-25-campanha-total/financeiro-operacao-testada.png)

Fixtures preservadas somente na origem5176: política vQA-3; orçamento10mil/seis cotas; oportunidade/cedente CHURUME11.222.333/0001-81; sacado sintético87.654.321/0001-98; operação CCB20261026001 bloqueada; operação manual20261026002 cancelada por inelegibilidade; operação histórica20261025003 paga e registrada no banco apenas na simulação. Não reutilizar como evidência produtiva.

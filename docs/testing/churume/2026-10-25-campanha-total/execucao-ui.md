# Churume — execução de interface

25–26/10/2026. Origem local isolada: porta5176. Dados fictícios. Uma aprovação vale apenas para a ação/observação descrita; abrir aba não certifica todos os seus recursos. Checagens textuais são smoke checks, não validações integrais de cálculos. Árvores completas, controles observados e horários: `execucao-ui.json`. Casos com expectativa inicial inadequada foram revistos com nota explícita.

| Caso | Ação | Resultado | Expectativa limitada / ressalva |
| --- | --- | --- | --- |
| HOME-001 | Abrir Visão geral | APROVADO | Dashboard e recorte exibidos |
| SHELL-001 | Primeira entrada da sessão | APROVADO | Resumo do dia com prioridades e seis destinos |
| SHELL-002 | Não mostrar mais hoje | APROVADO | Resumo fecha e dashboard permanece |
| SET-001 | Abrir Configurações | APROVADO | Seções administrativas carregadas |
| POL-001 | Atalho Configurar políticas | APROVADO | Matriz mestre e políticas ativas protegidas |
| POL-002 | Criar política sem nome | APROVADO | Recusa sem criar política |
| POL-003 | Criar política CHURUME para Factoring e produto CHURUME-TESTE | APROVADO | Novo rascunho sem ativar produção |
| POL-004 | Abrir catálogo mestre | APROVADO | Catálogo permite selecionar regras executáveis e mostra regras sem fonte |
| POL-005 | Adicionar regra de concentração pelo catálogo | APROVADO | Regra adicionada ao rascunho |
| POL-006 | Ativar regra sem justificativa | APROVADO | Exigir motivo de aprovação |
| POL-007 | Tentar ativar concentração de 101% com justificativa | BLOQUEADO | Execução comprovou aceitação de101%. Faixa máxima desse parâmetro não está formalizada como contrato; registrar melhoria de validação, sem chamar autorização indevida. |
| POL-008 | Criar nova versão de política ativa | APROVADO | Rascunho preserva versão aprovada |
| POL-009 | Gravar rascunho vQA-2 concentração1% REPROVADO/BLOQUEAR | BLOQUEADO | Automação de campo mascarado resultou 1.011,00; não comprova configuração de 1%. Revisar edição antes de atribuir defeito ao produto. |
| POL-010 | Ativar vQA-2 com justificativa | APROVADO | Versão anterior ENCERRADA e nova ATIVA; expectativa lexical corrigida de APOSENTADA para ENCERRADA. |
| POL-011 | Recarregar aplicativo e voltar às políticas | APROVADO | Versão vQA-2 persistida na demonstração |
| POL-012 | Configurar 1% via seleção e teclado; ativar vQA-3 | APROVADO | Árvore confirma vQA-3 ATIVA e campo 1,00; edição via teclado funcionou. Texto auxiliar de aprovação não é critério. |
| SET-002 | Abrir usuários e acesso | APROVADO | Lista de seis usuários e permissões |
| SET-003 | Enviar usuário sem campos | APROVADO | Recusa com validação de obrigatórios |
| SET-004 | Abrir empresas e veículos | APROVADO | Quatro empresas e vínculo às políticas |
| SET-005 | Enviar empresa vazia | APROVADO | Cadastro não concluído; formulário permanece |
| SET-006 | Abrir configurações bancárias | APROVADO | Contas e convênios por empresa |
| SET-007 | Cadastrar conta sem agência/conta | APROVADO | Recusar e preservar formulário |
| SET-008 | Expandir saldos e dados complementares | APROVADO | Campos complementares expandidos |
| SET-009 | Abrir padrões operacionais | APROVADO | Método, faixas, tarifas e metas editáveis |
| SET-010 | Abrir integrações | APROVADO | Estado demonstração separado de fontes não configuradas |
| SET-011 | Abrir inteligência e IA | FALHOU | Demonstração anuncia IA disponível com credencial ausente; fila exibe erro técnico cru de JSON. Não comprova mesmo comportamento em produção. |
| SET-012 | Definir 10.000 tokens e dividir entre seis usuários; salvar | APROVADO | Soma das cotas respeita teto e salva localmente |
| SET-013 | Ativar barra de jornada; salvar | APROVADO | Texto real Configurações salvas. Checkbox marcado e barra de jornada visível nos módulos seguintes. |
| OPS-001 | Abrir Operações no menu superior | APROVADO | Central com seis operações |
| OPS-002 | Abrir nova operação sem cedente/arquivo | APROVADO | Iniciar operação desabilitado |
| OPS-003 | Criar CCB e tentar avançar | FALHOU | OP-01 reproduzido também por clique: CCB nasce sem títulos e mostra registro somente leitura; avanço barrado sem caminho de preenchimento. |
| OPS-004 | Selecionar fila Intervenção necessária Bloqueios, decisões ou ritmo fora do padrão 5 | APROVADO | Fila correspondente apresentada |
| OPS-005 | Selecionar fila Exceções por alçada Decisões do motor aguardando cada alçada 0 | APROVADO | Fila correspondente apresentada |
| OPS-006 | Selecionar fila Prontas para formalização Processadas automaticamente e dentro da política 1 | APROVADO | Fila correspondente apresentada |
| OPS-007 | Selecionar fila Liberadas ao financeiro Resumo e status do pagamento 0 | APROVADO | Fila correspondente apresentada |
| OPS-008 | Selecionar fila Canceladas Memória preservada para novas importações 0 | APROVADO | Fila correspondente apresentada |
| OPS-009 | Selecionar fila Todas em andamento Nenhuma operação ativa fica fora da fila 7 | APROVADO | Fila correspondente apresentada |
| OPS-010 | Alternar para Kanban | APROVADO | Colunas da esteira |
| OPS-011 | Filtrar etapa Risco no Kanban | APROVADO | Filtro aplicado |
| OPS-012 | Buscar operação inexistente | APROVADO | Lista vazia sem erro |
| OPS-013 | Abrir operação GZ em risco | APROVADO | Motor, sacados, evidências e ações |
| OPS-014 | Expandir motor de elegibilidade | APROVADO | Regras e evidências acessíveis |
| OPS-015 | Consultar cadastro demonstrativo | APROVADO | Identificar simulação claramente |
| OPS-016 | Clicar Ver linha do tempo completa | FALHOU | Clique sem efeito; botão sem handler em operation-summary-aside.tsx:306. |
| OPS-017 | Clicar Ver estrutura do veículo | FALHOU | Clique sem efeito; botão sem handler em operation-summary-aside.tsx:252. |
| CTL-001 | Abrir aba Painel | APROVADO | Conteúdo e controles da aba disponíveis |
| CTL-002 | Abrir aba Checagem 16 | APROVADO | Conteúdo e controles da aba disponíveis |
| CTL-003 | Abrir aba Formalização 1 | APROVADO | Conteúdo e controles da aba disponíveis |
| CTL-004 | Abrir aba Conciliação 17 | APROVADO | Conteúdo e controles da aba disponíveis |
| CTL-005 | Abrir aba Auditoria | APROVADO | Conteúdo e controles da aba disponíveis |
| CTL-006 | Abrir aba Relatórios | APROVADO | Conteúdo e controles da aba disponíveis |
| COB-001 | Abrir recurso Painel | APROVADO | Recurso da cobrança apresentado |
| COB-002 | Abrir recurso Agenda 9 | APROVADO | Recurso da cobrança apresentado |
| COB-003 | Abrir recurso Promessas | APROVADO | Recurso da cobrança apresentado |
| COB-004 | Abrir recurso Acordos 0 | APROVADO | Recurso da cobrança apresentado |
| COB-005 | Abrir recurso Escalonamento 3 | APROVADO | Recurso da cobrança apresentado |
| COB-006 | Abrir recurso Relatórios | APROVADO | Recurso da cobrança apresentado |
| CAR-001 | Abrir aba Títulos 16 | APROVADO | Dados e controles disponíveis |
| CAR-002 | Abrir aba Por cedente 6 | APROVADO | Dados e controles disponíveis |
| CAR-003 | Abrir aba Por comercial | APROVADO | Dados e controles disponíveis |
| CAR-004 | Abrir aba Atraso 9 | APROVADO | Dados e controles disponíveis |
| COB-007 | Atalho carteira → Financeiro/Cobrança | APROVADO | Financeiro com aba Cobrança selecionada |
| FIN-001 | Abrir aba Caixa e fluxo | APROVADO | Aba financeira correspondente selecionada |
| FIN-002 | Abrir aba A pagar e a receber 1 | APROVADO | Aba financeira correspondente selecionada |
| FIN-003 | Abrir aba Liberações de operações | APROVADO | Aba financeira correspondente selecionada |
| FIN-004 | Abrir aba Cobrança | APROVADO | Aba financeira correspondente selecionada |
| FIN-005 | Abrir aba Extrato bancário | APROVADO | Aba financeira correspondente selecionada |
| FIN-006 | Abrir aba Conciliação bancária 10 | APROVADO | Aba financeira correspondente selecionada |
| FIN-007 | Abrir aba Contábil | APROVADO | Aba financeira correspondente selecionada |
| FIN-008 | Abrir aba Bancos | APROVADO | Aba financeira correspondente selecionada |
| FIN-009 | Bancos → Gerenciar em Configurações | APROVADO | Abrir configurações bancárias |
| COM-001 | Abrir aba Painel | APROVADO | Aba comercial selecionada com conteúdo |
| COM-002 | Abrir aba Agentes e gerentes | APROVADO | Aba comercial selecionada com conteúdo |
| COM-003 | Abrir aba Carteiras | APROVADO | Aba comercial selecionada com conteúdo |
| COM-004 | Abrir aba Negócios realizados | APROVADO | Aba comercial selecionada com conteúdo |
| COM-005 | Abrir aba Contas novas | APROVADO | Aba comercial selecionada com conteúdo |
| COM-006 | Abrir aba Visitas 6 | APROVADO | Aba comercial selecionada com conteúdo |
| COM-007 | Abrir aba Funil | APROVADO | Aba comercial selecionada com conteúdo |
| COM-008 | Abrir aba Comitês 0 | APROVADO | Aba comercial selecionada com conteúdo |
| COM-009 | Abrir aba Comissões | APROVADO | Aba comercial selecionada com conteúdo |
| COM-010 | Abrir proposta e dossiê do primeiro prospect | APROVADO | Campos e envio bloqueado por pendências |
| COM-011 | Consultar CNPJ vazio | APROVADO | Recusar consulta sem documento |
| CAD-001 | Abrir papel Todos 35 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-002 | Abrir papel Cedentes 16 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-003 | Abrir papel Sacados 6 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-004 | Abrir papel Fornecedores 2 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-005 | Abrir papel Representantes 4 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-006 | Abrir papel Debenturistas 2 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-007 | Abrir papel Cotistas 2 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-008 | Abrir papel Avalistas 1 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-009 | Abrir papel Prestadores 2 | APROVADO | Filtro e lista do papel disponíveis |
| CAD-010 | Enviar novo cadastro vazio | APROVADO | Recusar campos jurídicos obrigatórios |
| CAD-011 | Abrir papéis e responsáveis do novo cadastro | APROVADO | Papéis e responsáveis configuráveis |
| CAD-012 | Abrir relacionamento do novo cadastro | APROVADO | Endereço, contatos e bancos disponíveis |
| ALT-001 | Abrir sino de alertas | APROVADO | Seis notificações e acesso Central do Dia |
| ALT-002 | Abrir alerta de bloqueio GZ | APROVADO | Abre Central do Dia e seleciona tarefa GZ; contexto exige ação explícita Abrir contexto em nova aba. Expectativa inicial corrigida. |
| ALT-003 | Selecionar tarefa GZ na Central | APROVADO | Detalhe, responsável e ações disponíveis |
| ALT-004 | Filtrar Em andamento 0 | APROVADO | Filtro de tarefas correspondente |
| ALT-005 | Filtrar Adiadas 0 | APROVADO | Filtro de tarefas correspondente |
| ALT-006 | Filtrar Concluídas 0 | APROVADO | Filtro de tarefas correspondente |
| ALT-007 | Filtrar Todas 6 | APROVADO | Filtro de tarefas correspondente |
| ALT-008 | Filtrar Pendentes 6 | APROVADO | Filtro de tarefas correspondente |
| ALT-009 | Delegar tarefa GZ para Lucas Risco | BLOQUEADO | GZ saiu da visão nominal após delegar a Lucas. Persistência e visualização pelo destinatário não verificadas neste caso. Sonda F11 comprova separadamente delegação incompatível entre empresas. |
| ALT-010 | Assumir tarefa Integra | APROVADO | Responsável Henrique e histórico de assunção |
| COP-001 | Perguntar cedente com melhor liquidez | APROVADO | Resposta específica com empate, fórmula e fonte |
| COP-002 | Perguntar cliente com menor score | APROVADO | Informação pontual e critério |
| LIVE-001 | Copiloto → Equipe ao vivo | APROVADO | Abrir painel da equipe |
| LIVE-002 | Abrir atividade de Marina | APROVADO | Detalhe da colaboradora |
| BUS-001 | Busca global sem resultado | APROVADO | Estado vazio claro |
| BUS-002 | Busca global → Integrações | APROVADO | Busca abre módulo Integrações legado, com Fase 2 em desenho, distinto das fontes editáveis em Configurações. Oportunidade de unificação. |
| HOME-002 | Alterar perspectiva para Operação | APROVADO | Indicadores e ações da perspectiva |
| HOME-003 | Alterar perspectiva para Risco e cobrança | APROVADO | Indicadores e ações da perspectiva |
| HOME-004 | Alterar perspectiva para Gestão | APROVADO | Indicadores e ações da perspectiva |
| HOME-005 | Expandir Liquidez projetada | APROVADO | Cenários e projeção visíveis |
| HOME-006 | Selecionar cenário Conservador | APROVADO | Simulação correspondente selecionada |
| HOME-007 | Selecionar cenário Otimista | APROVADO | Simulação correspondente selecionada |
| HOME-008 | Selecionar cenário Cenário base | APROVADO | Simulação correspondente selecionada |
| HOME-009 | Expandir resultado e qualidade | APROVADO | Rentabilidade e risco detalhados |
| HOME-010 | Clicar KPI Abrir receita | APROVADO | Detalhar indicador financeiro |
| PRE-001 | Selecionar seção Condição | APROVADO | Seção da precificação disponível |
| PRE-002 | Selecionar seção Tarifas | APROVADO | Seção da precificação disponível |
| PRE-003 | Selecionar seção Recompra | BLOQUEADO | Rolagem automática posicionou botão sob cabeçalho fixo e clique atingiu navegação. Requer repetição com controle visível; não atribuído defeito de recompra. |
| PRE-004 | Selecionar título vencido na recompra demonstrativa | APROVADO | Efeito no líquido e tratamento habilitados |
| PRE-005 | Filtrar créditos após selecionar débito | APROVADO | Reserva da seleção mantida entre filtros |
| ETP-001 | Abrir etapa CONCLUÍDA Entrada Rafael Costa 25/10/2026, 09:11 | APROVADO | Conteúdo da etapa sem avanço automático |
| ETP-002 | Abrir etapa CONCLUÍDA Risco Rafael Costa 25/10/2026, 10:22 | APROVADO | Conteúdo da etapa sem avanço automático |
| ETP-003 | Abrir etapa CONCLUÍDA Lastro Rafael Costa 25/10/2026, 11:33 | APROVADO | Conteúdo da etapa sem avanço automático |
| ETP-004 | Abrir etapa 5 ETAPA 5 Aprovação | APROVADO | Conteúdo da etapa sem avanço automático |
| ETP-005 | Abrir etapa 6 ETAPA 6 Liberação | APROVADO | Conteúdo da etapa sem avanço automático |
| PRE-006 | Tentar avançar preço sem salvar | APROVADO | Bloquear com orientação explícita |
| PRE-007 | Salvar condição comercial fictícia | APROVADO | Versão salva com memória de cálculo |
| APR-001 | Avançar preço salvo | APROVADO | Etapa Aprovação e formalização |
| APR-002 | Configurar fornecedor de assinatura | APROVADO | Abrir configuração ou informar indisponibilidade |
| APR-003 | Abrir prévia Borderô | APROVADO | Documento com dados da operação |
| APR-004 | Abrir TC Termo de cessão Abrir prévia | APROVADO | Prévia da operação correta |
| APR-005 | Abrir MF Memória financeira Abrir prévia | APROVADO | Prévia da operação correta |
| APR-006 | Abrir DO Dossiê da operação Abrir prévia | APROVADO | Prévia da operação correta |
| APR-007 | Aprovar operação com alçada pendente | APROVADO | Recusar e indicar pendência |
| APR-008 | Enviar operação para alçadas | APROVADO | Solicitação registrada com trilha |
| APR-009 | Registrar assinatura antes de aprovação | APROVADO | Recusar por sequência operacional |
| APR-010 | Aprovar operação demonstrativa após alçadas | APROVADO | Decisão e trilha registradas |
| APR-011 | Registrar assinatura manual fictícia após aprovação | APROVADO | Solicitar evidência ou registrar autoria |
| APR-012 | Registrar ambas assinaturas fictícias com motivo e observação | APROVADO | Após segunda assinatura, orquestrador concluiu Aprovação e abriu Liberação automaticamente. Sem envio externo; observações fictícias registradas. |
| LIB-001 | Abrir liberação após formalização | APROVADO | Operação em etapa 6, pagamento e conta cadastrada |
| LIB-002 | Adicionar terceiro sem dados | APROVADO | Bloquear liberação e listar pendências |
| LIB-003 | Liberar operação fictícia de 97.289,69 para financeiro | APROVADO | Criar vínculo financeiro uma única vez |
| FIN-010 | Abrir liberação gerada | APROVADO | Um lançamento pendente com líquido correto |
| FIN-011 | Confirmar pagamento somente na demonstração | APROVADO | Baixa e saldo fictício sem duplicidade |
| BAN-001 | Gerar remessa demonstrativa Bradesco | APROVADO | Oito títulos aguardando retorno, sem transmissão real |
| BAN-002 | Confirmar retorno simulado | APROVADO | Registro demonstrativo atualizado |
| FIN-012 | Conferir Contábil após aquisição e pagamento | APROVADO | Abre Balancete por padrão. Conferência do lançamento feita no Diário em FIN-013. |
| FIN-013 | Abrir Diário após liberação e pagamento | APROVADO | Lançamentos de aquisição e baixa da operação |
| CON-001 | Abrir recurso contábil DRE | APROVADO | Painel correspondente disponível |
| CON-002 | Abrir recurso contábil Plano de contas | APROVADO | Painel correspondente disponível |
| CON-003 | Abrir recurso contábil Fechamento | APROVADO | Painel correspondente disponível |
| CON-004 | Abrir recurso contábil Balancete | APROVADO | Painel correspondente disponível |
| CAR-005 | Conferir carteira após aquisição | APROVADO | 16 anteriores mais 8 adquiridos = 24 |
| TIT-002 | Abrir histórico do título | FALHOU | Histórico abriu, porém ocorrência Em cartório exibe data inválida26//2/25/1. Confirmado em fixture demonstrativa; não extrapolar a datas gravadas pelo servidor. |
| COB-008 | Salvar cobrança sem contato e resumo | APROVADO | Recusar dados insuficientes |
| COB-009 | Salvar promessa sem data prometida | APROVADO | Exigir data da promessa |
| COB-010 | Salvar contato fictício com retorno futuro | APROVADO | Histórico e grade atualizados |
| TIT-003 | Abrir Controladoria do título | APROVADO | Checagens e status disponíveis |
| TIT-004 | Abrir detalhes técnicos do recebível | APROVADO | Origem, documento e identificação disponíveis |
| ORD-001 | Ordenar títulos por Título | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-002 | Ordenar títulos por Situação | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-003 | Ordenar títulos por Cedente | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-004 | Ordenar títulos por Sacado | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-005 | Ordenar títulos por Empresa / veículo | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-006 | Ordenar títulos por Operação de origem | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-007 | Ordenar títulos por Origem / importação | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-008 | Ordenar títulos por Emissão | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-009 | Ordenar títulos por Vencimento | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-010 | Ordenar títulos por Valor original | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-011 | Ordenar títulos por Valor pago | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-012 | Ordenar títulos por Data pagamento | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-013 | Ordenar títulos por Banco pagamento | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-014 | Ordenar títulos por Saldo | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-015 | Ordenar títulos por Chave da NF-e | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-016 | Ordenar títulos por Nosso número | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-017 | Ordenar títulos por Última cobrança | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-018 | Ordenar títulos por Próximo contato | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-019 | Ordenar títulos por Controladoria | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-020 | Ordenar títulos por Último evento | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| ORD-021 | Ordenar títulos por Detalhes | APROVADO | Ordenação acionada sem erro; direção exposta na coluna |
| FLT-001 | Filtrar carteira A vencer | APROVADO | Filtro correspondente aplicado |
| FLT-002 | Filtrar carteira Vencidos | APROVADO | Filtro correspondente aplicado |
| FLT-003 | Filtrar carteira > 30 dias | APROVADO | Filtro correspondente aplicado |
| FLT-004 | Filtrar carteira Todos | APROVADO | Filtro correspondente aplicado |
| COL-001 | Exibir coluna Prazo / atraso | APROVADO | Coluna incluída na grade |
| COL-002 | Exibir coluna Valor recomprado | APROVADO | Coluna incluída na grade |
| COL-003 | Exibir coluna Desconto | APROVADO | Coluna incluída na grade |
| COL-004 | Exibir coluna Abatimento | APROVADO | Coluna incluída na grade |
| COL-005 | Exibir coluna Banco / conta | APROVADO | Coluna incluída na grade |
| COL-006 | Exibir coluna Dados do boleto | APROVADO | Coluna incluída na grade |
| COL-007 | Exibir coluna Comercial | APROVADO | Coluna incluída na grade |
| COL-008 | Exibir coluna CFOP | APROVADO | Coluna incluída na grade |
| COL-009 | Exibir coluna Observação | APROVADO | Coluna incluída na grade |
| COL-010 | Restaurar colunas padrão | APROVADO | 21 colunas padrão preservadas |
| EXP-001 | Acionar exportação CSV da carteira | BLOQUEADO | Clique executado; conteúdo baixado não inspecionado nesta evidência. Defeito de corte em 200 reproduzido por sonda F06. |
| ACL-001 | Testar visão Marina sem alterar identidade real | APROVADO | Modo de teste explícito e módulos conforme perfil |
| ACL-002 | Perfil Marina clicar Abrir Financeiro do dashboard | BLOQUEADO | Resumo diário sobreposto impediu avaliação do atalho; repetido em ACL-004. |
| ACL-003 | Resumo diário de Marina com recorte restrito | FALHOU | Resumo de Marina mostra zero títulos vencidos no recorte, mas prioridade global de nove vencidos; consistente com agregado sem escopo F03. Evidência demonstrativa, sem alegar vazamento produtivo. |
| ACL-004 | Perfil Marina clicar Financeiro após fechar resumo | APROVADO | Módulo Financeiro permaneceu inacessível. Atalho habilitado não explica falta de permissão; oportunidade UX P2. |
| SET-014 | Voltar ao administrador e conferir orçamento de IA | APROVADO | Limite 10 mil e cotas continuam gravados |
| POL-013 | Conferir política após múltiplos módulos e troca de perfil | APROVADO | vQA-3 ativa com 1%, versões anteriores encerradas |
| IA-001 | Distribuir soma superior ao teto geral | APROVADO | Recusar excesso sem alterar limite salvo |
| IA-002 | Restaurar divisão válida após erro | APROVADO | Gravar exatamente 10.000 distribuídos |
| IA-003 | Atualizar consumo sem IA paga | APROVADO | Recarregar orçamento e uso sem executar modelo |
| COM-012 | Criar oportunidade vazia | APROVADO | Obrigatórios impedem criação |
| COM-013 | Criar oportunidade fictícia identificada CHURUME | APROVADO | Novo card com identidade preservada |
| COM-014 | Preencher proposta e documentos fictícios | APROVADO | Pré-requisito de etapa preservado mesmo com dossiê completo. |
| COM-015 | Salvar dossiê fictício completo | APROVADO | Persistir proposta sem pular visita |
| COM-016 | Agendar visita fictícia a prospect CHURUME | APROVADO | Visita vinculada e etapa atualizada |
| COM-017 | Salvar visita sem resultado | APROVADO | Exigir relato da visita |
| COM-018 | Concluir visita fictícia com resultado | APROVADO | Após salvar, visita saiu da agenda pendente; funil mostra CHURUME na etapa Visita com Preparar proposta. Caso complementar a seguir. |
| COM-019 | Preparar proposta após visita | APROVADO | Card segue para Proposta com envio permitido |
| COM-020 | Enviar proposta completa da etapa correta | APROVADO | Abrir pedido ao comitê preservando prospect e limite |
| COM-021 | Incluir pedido fictício na pauta | APROVADO | Pedido e card Em comitê persistidos |
| COM-022 | Ver dossiê a partir do pedido CHURUME | APROVADO | Dossiê do prospect correto |
| COM-023 | Aprovar comitê sem parecer de risco | APROVADO | Recusar por parecer obrigatório |
| COM-024 | Aprovar limite fictício com parecer | APROVADO | Gerar cedente onboarding uma única vez |
| COM-025 | Localizar cedente originado no comitê | APROVADO | Um cadastro de 100 mil, em onboarding |
| FIC-001 | Abrir seção da ficha 01 Identificação Dados principais | APROVADO | Seção correspondente disponível |
| FIC-002 | Abrir seção da ficha 02 Papéis e responsáveis Função e gestão | APROVADO | Seção correspondente disponível |
| FIC-003 | Abrir seção da ficha 03 Relacionamento Endereço, contatos e bancos | APROVADO | Seção correspondente disponível |
| FIC-004 | Abrir seção da ficha 04 Contrato Vigência e produtos | APROVADO | Seção correspondente disponível |
| FIC-005 | Abrir seção da ficha 05 Parâmetros Taxas, tarifas e lastro | APROVADO | Seção correspondente disponível |
| FIC-006 | Abrir seção da ficha 06 Limites e tranches Crédito e alocação | APROVADO | Seção correspondente disponível |
| FIC-007 | Abrir seção da ficha 07 Risco e conformidade KYC, COAF e revisões | APROVADO | Seção correspondente disponível |
| FIC-008 | Abrir seção da ficha 08 Histórico Alterações e auditoria | APROVADO | Seção correspondente disponível |
| CAD-013 | Editar nome fantasia e salvar sem motivo | APROVADO | Exigir justificativa no aplicativo |
| CAD-014 | Salvar alteração de nome fantasia com motivo | APROVADO | Persistir sem apagar auditoria anterior |
| CAD-015 | Reabrir histórico após editar | APROVADO | Evento com nome fantasia e motivo preserva origem comercial |
| CAD-016 | Transferir comercial sem motivo | APROVADO | Recusar transferência sem justificativa |
| CAD-017 | Transferir fixture para Camila com motivo | APROVADO | Atualizar vínculo sem reatribuir negócios anteriores |
| ENT-001 | Selecionar tipo Cheques | APROVADO | Formulário específico de entrada disponível |
| ENT-002 | Selecionar tipo Promissórias | APROVADO | Formulário específico de entrada disponível |
| ENT-003 | Selecionar tipo Transferibilidade | APROVADO | Formulário específico de entrada disponível |
| ENT-004 | Selecionar tipo Garantia | APROVADO | Formulário específico de entrada disponível |
| ENT-005 | Selecionar tipo Duplicatas | APROVADO | Formulário específico de entrada disponível |
| ENT-006 | Buscar sacado cadastrado pelo documento | APROVADO | Nome encontrado na carteira histórica não comprova ficha cadastral. Expectativa inicial corrigida. |
| ENT-007 | Cadastrar sacado fictício com endereço completo | APROVADO | Novo sacado selecionado no formulário |
| ENT-008 | Adicionar duas parcelas de título fictício a R$100 | APROVADO | Campo Parcelas=2 não muda ação Adicionar título. Botão Gerar 2 parcelas disponível separadamente após preenchimento. |
| ENT-009 | Conferir composição do líquido na Entrada após título R$100 | FALHOU | Líquido exibido 100,00; composição mostra deságio4,29, tarifas80,00, IOF0,09, retenção0,31, todos subtraídos. Componentes não fecham com total antes de salvar preço. Prova de UI, sem alegar débito real errado. |
| ENT-010 | Copiar título anterior | APROVADO | Preencher formulário sem duplicar automaticamente |
| ENT-011 | Adicionar cópia idêntica do título | APROVADO | Duplicidade é aceita na Entrada e barrada no Risco por TITLE-DUPLICATE-001 nas duas linhas, sem possibilidade de seguir o fluxo (RIS-002). Expectativa de bloqueio anterior foi ajustada à etapa responsável. |
| ENT-012 | Avançar Entrada com duplicata repetida | APROVADO | Duplicidade é aceita na Entrada e barrada no Risco por TITLE-DUPLICATE-001 nas duas linhas, sem possibilidade de seguir o fluxo (RIS-002). Expectativa de bloqueio anterior foi ajustada à etapa responsável. |
| RIS-001 | Avançar Risco sem decisões | APROVADO | Bloquear cedente/sacados/títulos pendentes |
| RIS-002 | Examinar regras da operação com duplicidade | APROVADO | Motor reprova regra de duplicidade |
| CAN-001 | Cancelar sem motivo detalhado | APROVADO | Confirmar desabilitado e histórico preservado |
| CAN-002 | Cancelar fixture inelegível com categoria e motivo | APROVADO | Status cancelada e memória de reimportação preservados |
| LAS-001 | Abrir Lastro da operação histórica Metalúrgica | APROVADO | Dispensa explicitamente identificada |

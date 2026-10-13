# QProf x STRATO — mapa de cobertura e lacunas

> Análise inicial baseada no catálogo de 330 telas/34 módulos do QProf demonstrativo e na estrutura atual do STRATO em 12/10/2026.

> A priorização aprofundada, com avaliação de valor, esforço, dependências e itens que não devem ser copiados, está em `QPROF_STRATO_DEEP_ANALYSIS.md`.

## Resumo executivo

O QProf apresenta uma arquitetura funcional extensa e fragmentada: muitas rotinas são telas independentes de cadastro, consulta, importação ou processamento. O STRATO organiza capacidades equivalentes em poucos módulos orientados a domínio, com fluxo integrado entre Cadastro, Operação, Carteira, Comercial e Financeiro.

A recomendação não é reproduzir 330 telas. O catálogo deve servir como checklist de capacidades e controles. Quando várias telas QProf representam variações do mesmo processo, o STRATO deve absorvê-las em uma única experiência com filtros, estados, permissões e ações contextuais.

## Evidência da extração

Todas as 330 rotas catalogadas foram abertas. Em 245 delas foi possível capturar conteúdo funcional; 85 ficaram vazias para o perfil utilizado ou dependiam de configuração/permissão. O levantamento estrutural identificou 6.973 controles, 833 ações, 397 ocorrências de abas e 1.669 cabeçalhos de grade. Nenhuma rota falhou na navegação final.

Esses números não representam requisitos distintos: muitas ocorrências são repetições do padrão legado de manutenção e pesquisa. Eles servem para medir abrangência e localizar famílias funcionais.

## Escopo observado

| Indicador | QProf | STRATO atual |
|---|---:|---:|
| Módulos principais | 34 | 10 itens de navegação |
| Telas/rotas catalogadas | 330 | SPA modular por views e abas |
| Esteira de operação | 12 áreas no FNE001 | 6 etapas integradas |
| Cadastro de pessoas | telas separadas por papel | cadastro único PF/PJ com múltiplos papéis |
| Financeiro | Tesouraria + Fundo + cadastros auxiliares | financeiro integrado, razão, títulos, bancos e conciliação |
| Persistência operacional | aplicação QProf | Operações, Carteira, Financeiro, Comercial, políticas, tarefas e integrações ainda locais; identidade, decisões, empresa e cadastro de pessoas já iniciaram persistência PostgreSQL |

## Matriz por módulo QProf

Legenda:

- **Forte**: capacidade central já existe no STRATO.
- **Parcial**: existe base funcional, mas faltam rotinas específicas.
- **Ausente**: não há módulo ou fluxo equivalente identificável.
- **Não replicar**: função técnica/legada deve ser atendida de outra forma.

| Módulo QProf | Telas | Cobertura STRATO | Destino recomendado |
|---|---:|---|---|
| Acordo de cobrança | 1 | Parcial | Carteira > Central de cobrança, com acordos, parcelas e histórico. |
| Agente de negócio | 22 | Parcial | Comercial + Carteira; consolidar consultas, protesto, preventivo e instruções. |
| Arquivamento | 1 | Ausente | Serviço transversal de documentos, retenção e descarte. |
| Assinatura digital | 1 | Parcial | Integrações + Aprovação/Formalização. |
| Cadastros básicos | 106 | Parcial | Distribuir entre Configurações, políticas, catálogo financeiro e dados mestres; evitar 106 telas isoladas. |
| Cartão de crédito | 3 | Ausente | Novo domínio de agenda e conciliação de URs, somente se fizer parte do mercado-alvo. |
| Cedente | 26 | Forte/Parcial | Cadastro, Operações, Carteira e portal externo; faltam serviços self-service específicos. |
| Cobrança | 19 | Parcial | Carteira cobre fila e títulos; faltam boleto, protesto, notificações formais, cobrança externa e rastreamento. |
| Compras | 8 | Ausente | Módulo corporativo opcional; manter fora do núcleo de recebíveis na primeira fase. |
| Confissão de dívida | 1 | Ausente | Produto jurídico/renegociação da Carteira. |
| Consultas | 20 | Parcial | Busca, painéis e auditoria cobrem parte; faltam consultas operacionais e logs centralizados. |
| Controladoria | 6 | Forte/Parcial | STRATO já possui Painel, Checagem, Formalização, Conciliação, Auditoria e Relatórios; faltam rotinas fiscais específicas. |
| Documentos digitais | 1 | Parcial | Formalização possui documentos; falta central documental transversal. |
| Extrator | 2 | Ausente | Substituir por exportação governada, API e relatórios com permissão. |
| Fundo | 21 | Ausente/Parcial | Há conceitos de FIDC, mas faltam cotas, PL, PDD oficial, curva, amortização, aporte, resgate e custodiante. |
| Garantia | 1 | Parcial | Garantias aparecem em operação/cadastro; falta carteira consolidada de garantias. |
| Gestão de investimentos | 5 | Ausente | Novo domínio de investidores, séries, integralizações e resgates. |
| Governança corporativa | 4 | Parcial | Visão geral, indicadores e alçadas cobrem parte; falta governança formal e consolidação estatutária. |
| Help desk | 9 | Ausente | Recomenda-se integração com ferramenta externa, não um módulo core próprio. |
| IEPTB-CRA | 4 | Ausente | Integração regulada de protesto: remessa, retorno, rejeição e rastreabilidade. |
| Integrações | 2 | Parcial | Há área de integrações/configurações; falta operação real, logs, reprocessamento e observabilidade. |
| Mobile | 2 | Não replicar | STRATO deve manter interface responsiva e notificações; relatórios móveis separados só se houver caso concreto. |
| Monkey Exchange | 1 | Ausente | Conector específico, implementado como adaptador opcional. |
| OData | 1 | Ausente/Não replicar | Preferir API versionada e tokens de integração com escopo e auditoria. |
| Operação | 6 | Forte | Núcleo do STRATO; ampliar importação, variações estruturadas e remessas sem copiar a fragmentação. |
| Painel inteligente | 2 | Forte/Parcial | Visão geral e Copiloto já cobrem análise; falta governança de acesso ao painel e fontes produtivas. |
| Parâmetros gerais | 8 | Forte/Parcial | Configurações já cobre empresas, usuários, políticas, integrações e interface; faltam rotinas de e-mail, limpeza e controles de rede quando aplicáveis. |
| Pessoas | 21 | Forte | Cadastro único multi-papel é arquiteturalmente superior; completar avaliações, contratos, pendências, visitas e importações. |
| Portal do investidor | 1 | Ausente | Produto externo com autenticação, posição, documentos e movimentações. |
| Pós-venda | 4 | Parcial | Comercial cobre visitas e carteira; faltam canhotos e rotina formal de pós-venda. |
| Relatórios | 4 | Parcial | Existem relatórios distribuídos; falta catálogo, agendamento, distribuição e trilha de execução. |
| Simulação de operação | 2 | Forte/Parcial | Precificação existe; falta experiência independente de simulação e comparação de cenários. |
| Tesouraria | 10 | Parcial/Forte | Financeiro cobre caixa, títulos, liberações, extrato, conciliação, contábil e bancos; faltam orçamento, RDV, pagamento consolidado e COAF operacional. |
| Workflow | 5 | Parcial | Há etapas, tarefas, decisões, outbox e notificações; falta motor genérico de fluxos, caixa de entrada e acompanhamento transversal. |

## Cobertura atual do STRATO

### Capacidades fortes

- Esteira operacional integrada: Entrada, Risco, Lastro, Preço, Aprovação e Liberação.
- Cadastro único de pessoas com múltiplos papéis.
- Carteira e cobrança operacional com títulos, atraso, PDD estimada, protesto e recompra.
- Comercial com carteira, negócios, visitas, funil, comitês e comissões.
- Financeiro com caixa, contas a pagar/receber, liberações, extrato, conciliação, contábil e bancos.
- Controladoria com checagem, formalização, conciliação, auditoria e relatórios.
- Identidade própria, permissões, alçadas, decisões auditáveis, idempotência e notificações persistidas.

### Lacunas de produto mais relevantes

1. **Administração de fundos e investimentos**: cotistas, séries, PL, curva, amortização, aporte, resgate e custodiante.
2. **Cobrança bancária e jurídica completa**: boleto, CNAB, protesto/IEPTB, notificações, cobrança externa, acordos e confissão de dívida.
3. **Integrações produtivas**: conectores reais, logs, reprocessamento, saúde, credenciais segregadas e observabilidade.
4. **Gestão documental transversal**: documentos, assinatura, arquivamento, retenção, versões e evidências.
5. **Workflow transversal**: caixa de entrada, SLA, responsáveis, delegação e histórico de fluxos fora da operação.
6. **Relatórios corporativos**: catálogo, agendamento, distribuição, exportação e trilha.
7. **Portal externo**: investidor e, posteriormente, cedente/agente.
8. **Dados mestres e parâmetros regulatórios**: impostos, IOF, feriados, bancos, cartórios, instruções, COAF e classificações.

## Prioridade recomendada

### P0 — Fechar o núcleo operacional

- persistir Operação, Carteira, Comercial, Cadastros e Financeiro no backend;
- implantar integrações bancárias essenciais e conciliação produtiva;
- concluir cobrança com ações, acordos, prorrogação, recompra, protesto e notificações;
- consolidar documentos e assinatura na formalização;
- centralizar logs, auditoria e reprocessamento de integrações.

### P1 — Paridade regulatória e de FIDC

- administração de fundo, cotas, PL, PDD e custodiante;
- IEPTB/CRA, COAF e controles regulatórios;
- gestão de investidores, séries, integralizações e resgates;
- relatórios agendados e governança corporativa.

### P2 — Ecossistema e funções periféricas

- portal do investidor;
- conectores específicos como Monkey Exchange;
- compras/RDV/orçamento, se forem parte do posicionamento do produto;
- help desk por integração com plataforma especializada;
- API externa governada no lugar de uma dependência direta de OData.

## Decisões arquiteturais recomendadas

- Não criar uma rota STRATO para cada código QProf.
- Tratar códigos como referência de capacidade e rastreabilidade de requisitos.
- Reunir cadastros auxiliares por contexto, pesquisa e permissão.
- Manter regras de negócio no domínio e interfaces como composição dessas regras.
- Implementar integrações por adaptadores isolados, com fila, idempotência e reprocessamento.
- Usar eventos de domínio para conectar Operação, Carteira, Cobrança, Financeiro e Contabilidade.
- Transformar Workflow em infraestrutura transversal, não em duplicação de fluxos específicos.

## Próxima etapa da extração

O catálogo nominal está completo. A extração de conteúdo de cada tela deve ser feita por ondas, priorizadas pelo impacto no STRATO:

1. Operação, Pessoas, Cedente, Cobrança, Tesouraria e Controladoria.
2. Cadastros básicos que suportam esses fluxos.
3. Fundo, Gestão de investimentos, Garantias e Governança.
4. Integrações, IEPTB, assinatura e documentos.
5. Módulos periféricos.

Para cada tela serão registrados objetivo, campos, ações, grades, estados, validações, dependências e correspondência no STRATO.

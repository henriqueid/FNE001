# Churume — correções e acessos ·26/10/2026

Correções dos23 achados confirmados do dossiê25/10 integradas, com regressões. Ciclo de usuário exercitado em PostgreSQL e navegador. Revisões independentes encontraram problemas adicionais; corrigidos e retestados. Sem publicação, migração ou acesso ao banco produtivo.

## Verificação final

| Verificação | Resultado |
|---|---|
| `npm run check` | typecheck, lint, formatação e testes aprovados; **1.105 passaram/30 ignorados** |
| Build de produção | Aprovado |
| PostgreSQL18 descartável | **29/29** testes em6 arquivos, após40 migrações |
| Documentos/recuperação | 2/2; backup restaurado com igualdade de hashes/metadados em74 tabelas/1.464 linhas |
| HTTP no banco restaurado | Login, cookie HttpOnly/SameSite, APIs autenticadas, isolamento entre tenants e logout aprovados |
| Navegador | Solicitação, recusa pendente, aprovação/gravação, login real, consulta sem edição, revogação de módulo, suspensão com sessão aberta, novo login recusado, reativação e exigência de novo login |
| IA no navegador | Falha SQL controlada reverte licença, exibe erro e bloqueia controles; recuperação recarrega estado confirmado sem reativar alteração rejeitada |
| Revisão independente | R1–R4 e RC01–02 tratados; revisão final sem novoP1/P2 |

Os29 testes PostgreSQL são justamente os cenários ignorados na execução sem banco; não somar novamente os2 testes de documentos à suíte geral. Resta1 teste opcional de exportação de amostras sem diretório QA configurado. Relatórios de frentes têm rodadas intermediárias menores e não substituem os logs finais em `evidencias-validacao/`.

## Destino de cada achado confirmado

A = teste automatizado de domínio/componente/handler, com mocks explicitados no teste. PG = PostgreSQL real descartável. UI = navegador nativo. Uma categoria não substitui outra.

| Achado | Correção | Comprovação |
|---|---|---|
| F01/F02 | Inicialização/criação de tarefas pelo servidor, sem novos IDs fabricados pelo navegador | A, rota/service |
| F03 | Agregados e snapshots respeitam empresa, módulo e escopo | A |
| F04 | Snapshot, prazo/origem e histórico não são autoridade do payload do cliente | A |
| F05 | Destinatário exige status/vínculo/empresa/módulo/alçada; UI filtra elegíveis | A |
| F06 | Carteira integral paginada100; páginas100/100/1 e CSV completo201 comprovados, com filtro/ordem/seleção/colunas | A, SSR+handlers reais |
| F07 | Episódio novo alerta sem apagar conclusão humana anterior | A |
| F08 | Ambiente real não inventa presença, duração ou atividade pelo departamento | A |
| F09 | Limite de notificações aplicado depois do filtro de autorização | A |
| F10 | Autoria/eventos produzidos pelo servidor; histórico não pode ser reescrito | A |
| F11 | Atribuição persiste; destinatário que perde acesso devolve pendência ativa à fila, com trilha | A |
| CFG01 | Motivo/versão original e diferenças/autoria no servidor; prefixo de histórico protegido | A, PG concorrente |
| CFG02 | Payload institucional parcial/tipos inválidos retorna400 sem TypeError | A |
| CFG03 | Consulta sem controles de gestão; users:manage acessa só gestão de usuários sem settings:manage | A, PG |
| OP01 | Criação e conversão para CCB não suportada bloqueadas; legado somente consulta/cancelamento | A, RC02 |
| OP02 | Dossiê comercial por prospectId, sem associação por homônimo | A |
| OP03 | Consulta sem integração não fabrica evidência oficial | A |
| OP04 | Retorno ao risco com motivo/versão/idempotência e invalidação de evidências posteriores | A, PG |
| UI01/UI02 | Linha do tempo/veículo mostram contexto funcional e dados reais disponíveis | A |
| UI03 | Resumo simulado fecha composição antes de preço salvo | A |
| UI04 | Demo IA/outbox explicitamente simulada, sem endpoints reais; erros de transporte legíveis | A; real UI sem credencial claramente indisponível |
| UI05 | Datas ISO/ptBR válidas; inválidas não viram texto truncado | A |

## Hipóteses e revisão adicional

| Item | Destino |
|---|---|
| CFG04 | Erro de persistência IA visível; rollback e recarga confirmados emUI com falha SQL. CAS impede reativação por snapshot antigo (A+PG). |
| CFG05 | Fila bancária mostra erro e repetição; mantém última posição e impede decisão sem reconfirmação (A). |
| CFG06 | Cedente acionável por teclado; regressão de expansão e helper compartilhado (A). |
| I01 | Importação/plano/conta/categoria aguardam confirmação; false/rejeição preservam preparo (A). |
| I02 | **Preservado por decisão do usuário:** Acordos mostra todo histórico de negociações. Não classificar como defeito. |
| I03 | Auditoria Controladoria paginada, sem corte30; respeita empresa (A,65eventos). |
| I04 | Adiamento vazio/inválido/passado bloqueado, sem RangeError (A). |
| I05 | Empresa explícita inválida/ambígua não cai silenciosamente no destino ativo; vazia usa fallback permitido (A). |
| I06 | Tarefas exigem permissão do módulo/autoridade e escopo, além de dashboard (A). |
| R1 | Parâmetros materiais de crédito validados contra modelo canônico; risco+autoridade+escopo obrigatórios. Cadastro comum preservado (A). |
| R2 | Cliente envia updatedAt da ficha aberta, não carimba draft antigo com versão atual da coleção; API recusa obsoleto (inspeção adaptador+A+PG). |
| R3 | Licença IA compara persistenceVersion sob lock;409 preserva licença/teto/consumo (A+PG). |
| R4 | Próxima ação real vem da operação; departamento não simula atividade atual (A). |
| RC01 | Login mantém lock da identidade até emitir sessão; suspensão concorrente não deixa cookie ressurgir após reativação (A+PG concorrente). |
| RC02 | Conversão manual→CCB e disfarce inverso negados; legado preservado nos limites definidos (A). |

Novos achados da jornada nativa: onboarding SQL parcial, operador preso no cadastro institucional e identidade administrativa demonstrativa no acesso real. Todos corrigidos; contexto mínimo e diretório filtrado, gravação atômica, bootstrap vazio/self-only, falha fechada e reconfirmação de permissões. Detalhes/evidências em `navegador-acessos.md`.

Atalho global de Integrações direciona à configuração funcional; motivo cadastral ausente abre seção do campo obrigatório. Não houve criação de regra financeira nova para CCB nem contorno de integração ausente.

## Departamentos, módulos e alçadas

Controle existente aproveitado e testado. Departamento organiza função; permissões liberam módulos/ações; alçada autoriza decisão, com empresa e vigência. Catálogo atual é fechado. Editor livre de departamentos/autoridades e tetos monetários individuais **ainda não existem**; extensão planejada em `departamentos-modulos-alcadas.md`. Sem inventar base monetária ou conceder autoridade pelo nome do departamento.

## Cobertura que permanece aberta

Esta campanha fecha achados e jornadas acima. **Não certifica cada uma das1.399 ocorrências estáticas nem “todos os cenários possíveis”.** Inventário anterior continua em `../2026-10-25-campanha-total/cobertura-controles.csv`, com estados individuais preservados. A associação por família/teste não converte ocorrência não executada em aprovada.

- Homologação de envio/retorno em banco real, bureau, assinatura e respostas reais da IA depende dos fornecedores/credenciais apropriados. Nenhuma movimentação real executada.
- Percurso visual de todas combinações de campos, políticas, alçadas, falhas de rede por controle, dispositivos, foco/leitor de tela e arquivos possíveis continua além da evidência executada. Não atribuir essa cobertura aos testes de regras.
- A infraestrutura PG local valida SQL/coordenação/recuperação; não simula Supabase gerenciado, TLS, fornecedores ou carga produtiva.
- Nova linha de produto CCB permanece bloqueada até contrato financeiro próprio. Cadastro livre de departamentos e alçadas por valor permanece planejado, não implementado.
- Sem benchmark A/B de tokens; nenhuma alegação de economia.

## Fontes

- Plano: `docs/superpowers/plans/2026-10-26-churume-seguranca-acessos.md`.
- Relatórios locais: `task1-tarefas.md`, `task2-acessos.md`, `task3-operacoes.md`, `task2-revisao-independente.md`, `task1-revisao-cruzada.md`.
- Evidências: `evidencias-validacao/`, `evidencias-browser/`, sondas RED/GREEN e revisões nas subpastas.
- Contratos atualizados em `docs/ARCHITECTURE.md`; continuidade em `CLAUDE.md`. Checkout anterior preservado; sem commit/publicação automáticos.

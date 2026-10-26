# Churume — campanha integral: Configurações, Cadastros, acesso e onboarding

Data: 25/10/2026. Escopo: `src/features/settings`, `registry`, `auth`, `onboarding`, `policies`, controles bancários usados por Configurações e respectivas fronteiras. Sem mudanças de produto. Árvore já continha alterações extensas, preservadas.

## Evidência e limites

- 139 testes/casos únicos passaram: 133 existentes em 27 arquivos + 6 probes. [Fonte reproduzível](2026-10-25-campanha-total/evidencias-configuracoes/README.md).
- Testes dirigidos executados com `DATABASE_URL`/`OPENAI_API_KEY` removidos do ambiente. Sem IA paga, fornecedores reais, credenciais ou escrita remota.
- Esta frente executou regras, handlers HTTP com mocks e SSR. **Nenhum controle foi clicado em navegador por esta frente.** UI observada pelo agente principal deve ser vinculada ao relatório consolidado; não converter INSPECIONADO em APROVADO por inferência.
- Repetições por usuário/empresa/provedor/linha/tranche/título estão agrupadas por família abaixo; inventário AST global contém ocorrências individuais. Cada entrada abaixo cobre também estados vazio, carregando, erro e bloqueado quando citados; cobertura visual de cada combinação continua NÃO EXECUTADA aqui.

## Achados reproduzidos

### CFG-01 — P1 — histórico cadastral alterável pelo cliente e motivo dispensável pela API

**FALHOU em handler HTTP real com fronteiras mockadas.** Usuário com `registry:edit` envia `PUT /api/registry/parties` sobre pessoa existente, modifica nome e substitui `history` por `[]`, sem motivo. Retorna 200 e entrega exatamente esse objeto à persistência. Segundo probe envia autor/data fictícios no histórico; também retorna 200. Banco não foi tocado.

Código: `app/api/registry/parties/route.ts:55` valida apenas campos cadastrais e alteração bancária; `src/server/registry/repository.ts:281` grava `jsonParameter(party)` integral; evento do servidor em `:318` registra ator real, porém somente nome/documento/situação/papéis, sem motivo nem diferenças por campo. Tela apresenta `draft.history` como auditoria (`src/features/registry/party-form-modal.tsx:740`). Regra de motivo e histórico append-only está no cliente/domínio (`src/domain/registry/party-save.ts:92`, `:171`). Consequência: editor autorizado consegue apagar/forjar histórico exibido, perder justificativas e detalhes de alteração de limites, taxas ou responsáveis. **Não houve prova de alteração de ator no evento imutável do servidor.**

Proposta: servidor carregar versão anterior, exigir motivo, calcular diferenças e construir histórico com autoria/tempo próprios, sem confiar em `history` recebido. Requer testes de API e persistência reais antes de homologar.

### CFG-02 — P2 — empresa/destino com corpo parcial lança TypeError

**FALHOU em execução dirigida.** `PUT /api/company` e `POST /api/company/destinations`, principal com `settings:manage`, JSON `{}`: handlers lançam `TypeError` no `.trim()` do validador, em vez de responder 400. `app/api/company/route.ts:38`, `app/api/company/destinations/route.ts:69`; validadores `src/domain/company/profile.ts:25` e `destination.ts:37`. Validação ocorre fora do `try`. Sem escrita executada. Proposta: validar formato/tipos antes de acessar campos; cobrir corpos parcial, null, número e array.

### CFG-03 — P2 — perfil somente consulta recebe controles administrativos habilitados

**FALHOU em SSR; não é prova de bypass de autorização.** Renderizar `UsersAccessPanel` com operador sem `users:manage` produz botão habilitado “+ Adicionar usuário”, seletores de nível/situação e editor administrativo. `src/features/settings/users-access-panel.tsx:404`, `:546`; seção acessível sem gate específico em `settings-module.tsx:470`. API exige `users:manage` (`app/api/access/users/route.ts:38`) e probe confirmou que consulta simples não grava cadastro (403). Consequência: ações inúteis/confusas para perfil de leitura; erro aparece apenas após tentativa. Proposta: separar leitura/manutenção na UI, manter guardas server-side. Não classificar como escalada de privilégio comprovada.

## Riscos inspecionados, sem reprodução comportamental

- **CFG-04/P2:** licença/ativação IA altera estado local imediatamente (`settings-module.tsx:519–555`). Persistência debounced silencia erro e mantém memória (`strato-app.tsx:991–1015`); UI pode continuar marcada sem gravação confirmada. Precisa simular 403/409/500/rede e recarregar navegador. INSPECIONADO, não FALHOU executado.
- **CFG-05/P2:** `BankAccountApprovalPanel` oculta painel inteiro em falha de carga (`bank-account-approval-panel.tsx:27–44`), sem aviso/retry. Fila pode parecer vazia. Precisa fixture pendente + falha/retry em navegador.
- **CFG-06/P3:** linha de cedente expande por `tr onClick` sem `pressable`/teclado (`cedents-tab.tsx:156`), diferente da convenção. Não exercitado por teclado.
- Navegação de cedente para Carteira/Comercial envia apenas `onNavigate("portfolio"/"commercial")` (`cedents-tab.tsx:310`), sem filtro do cedente. Destino de módulo correto por inspeção; contexto específico não é transportado. Não chamar link quebrado.
- Cadastro geral salva antes de solicitar aprovação bancária (`party-form-modal.tsx:243–262`); se segunda chamada falha, dados gerais já foram persistidos e modal informa erro da etapa bancária. Atomicidade conjunta não foi prometida/testada; precisa fixture para mensagem de sucesso parcial.

## Matriz integral de famílias — navegação/configurações

Legenda: I = INSPECIONADO código; A = APROVADO somente teste citado; B = BLOQUEADO por ambiente/fixture; N = NÃO EXECUTADO interação navegador nesta frente. Estado “I/N” nunca significa clique aprovado.

| Família / controles | Destino e cenário a provar | Fonte exata | Estado / evidência |
| --- | --- | --- | --- |
| Nove assuntos laterais; oito atalhos; breadcrumb Configurações | overview/access/companies/banks/operational/policies/integrations/intelligence/interface; retorno à visão geral | `settings-module.tsx:318`, `:396`, `:338` | I/N; todos `setSection`, sem rota externa |
| Nova empresa ou veículo; cancelar; cadastrar | abre modal, mantém draft até confirmação, cria destino disponível para políticas/operações; erro/duplicidade | `settings-module.tsx:824`, `:895`, `:974`; `company-context.tsx:65` | I/N; A validador company-destination; F CFG-02 na API |
| Razão social, fantasia, CNPJ, instituição, finalidade | identificação legal, CNPJ válido, escopo empresarial; negativo campo vazio | `settings-module.tsx:915–972` | I/N; A company-destination |
| Empresa/veículo bancário; Nova conta; Editar por linha; cancelar/salvar modal | mesma entidade financeira em Configurações; escopo consolidado ou específico; impedir dupla submissão | `bank-settings-panel.tsx:31–90`; `finance/tabs/banks-tab.tsx:64`, `:135`, `:210` | I/N; A bank-settings-view SSR |
| Empresa banco, banco/código, agência, conta/dígito, apelido, tipo, Pix, abertura/data, saldo mínimo | nova conta válida, banco público, erro de gravação; empresa/saldo bloqueados após movimentos | `finance/tabs/banks-tab.tsx:237–328` | I/N; A SSR bloqueios/obrigatórios; persistência real B |
| Finalidades pagamento/recebimento/cobrança; conta ativa | combinações 2³; cobrança habilita requisitos próprios | `finance/tabs/banks-tab.tsx:336–368` | I/N |
| Convênio, carteira, leiaute, nosso número, dígito, beneficiário, juros, multa, instruções, email pagador | CNAB 240/400 e banco suportado; valores zero explícitos; sem remessa real | `finance/tabs/banks-tab.tsx:378–607` | I/N; A SSR obrigatórios CNAB400; transmissão B |
| Salvar padrões operacionais | draft distinto, versão, espera, erro, confirmação; nenhuma mudança antes de salvar | `settings-module.tsx:274`, `:594` | I/N; A operational-parameters / operational-parameter-governance |
| Método cálculo, base dias, falha confirmação, dias úteis, maiores títulos | Nominal/Efetiva/Mista/Composta Mista; 30/360/365; bloquear/alçada/amostra/alertar | `registry/operational-parameters-editor.tsx:114–191` | I/N; A operational-profile |
| 31 campos numéricos: taxas(3), prazos/títulos(7), confirmação(7), concentração(4), tarifas/reserva/recompra/atraso(10) | limites mínimo/máximo, percentual/inteiro/moeda, zero válido, inválidos | `registry/operational-parameters-editor.tsx:24–81`, `:203–225` | I/N; A relações materiais operational-parameter-governance |
| Metas originação e receita × dia/semana/mês × consolidado/veículo | salvar valor por escopo; zero/inválido; reflexo nos painéis | `settings-module.tsx:643`, `:680`, `:730`, `:765` | I/N; A validação padrões, reflexo UI N |
| Interface: explicações e jornada; salvar | só preferências visuais persistem no navegador; alterado/salvo/refresh | `settings-module.tsx:1058–1121` | I/N; recarga navegador N |
| IA: licença e uso Copiloto | licença off força enabled false; uso desabilitado sem licença | `settings-module.tsx:519–555` | I/N; persistência falha CFG-04 |
| Testar resposta IA; recarregar configuração | endpoint de configuração; teste requer credencial e pode consumir; erro legível | `ai-configuration-panel.tsx:22`, `:55`, `:152–158` | I/N; teste real B/proibido consumir IA |
| Orçamento: atualizar consumo, teto, modo shared/allocated, cota por usuário, distribuir igualmente, salvar | zero bloqueia uso, cotas ≤ teto, inativos sem cota, versão antiga, consumo não reescrito | `ai-budget-panel.tsx:107`, `:120`, `:228–288`, `:343`, `:390` | I/N; A intelligence-budget-configuration/routes/user-budget |
| Outbox: atualizar fila; reprocessar falhas condicional | contagens reais; reprocessar só failed>0, busy; erro visível | `outbox-health-panel.tsx:17`, `:44`, `:63`, `:84` | I/N; A access-notifications (domínio), fila real B |
| Provedor demo: desativar demonstração; usar dados demo | somente providers listados; institucional não ganha falso botão ativar; real governado servidor | `settings-module.tsx:1016–1037` | I/N; A integration-configuration |
| Integrações: estado/prioridade por provedor, motivo proposta; enviar | cinco capacidades, prioridade única/inteira, pendente congela edição, idempotência | `integration-governance-panel.tsx:226–280` | I/N; A integration-provider-governance |
| Integrações: motivo decisão, rejeitar, aprovar/aplicar por pedido | segunda pessoa; concorrência; snapshot sem segredos; aplicar atômico | `integration-governance-panel.tsx:166–194`; `provider-change-repository.ts:249` | I/N; A integration-provider-governance com memória |

## Matriz integral — usuários, atribuições, empresas e alçadas

| Família / controles | Destino e cenário | Fonte exata | Estado / evidência |
| --- | --- | --- | --- |
| Selecionar usuário por linha; testar visão; encerrar teste | muda usuário exibido; preview não altera identidade real da sessão | `users-access-panel.tsx:389`, `:418`, `:465` | I/N; A access-control/access-scope |
| Adicionar usuário; fechar X; cancelar; criar | login/CPF/email/senha/área; pending inicial; duplicado, senha fraca, erro, espera | `users-access-panel.tsx:404`, `:724–828` | I/N; A access-identity; F CFG-03 SSR |
| Situação; ativar pendente; função; área principal; nível; gestor direto | operador/gestor/admin; ativo/suspenso/pendente; impedir auto-gestor | `users-access-panel.tsx:450`, `:546–595` | I/N; A access-governance/change-maker-checker |
| Áreas de atuação por checkbox | principal obrigatória; admin todas; recalcular permissões união | `users-access-panel.tsx:610–638` | I/N; A access-control |
| Comercial vinculado/gerente conta por ID | vinculação comercial e carteira correspondente; ID inexistente/limpo | `users-access-panel.tsx:646–668` | I/N; validação relação real B |
| Empresa/veículo checkbox por destino | escopo vazio/uma/várias; concessão crítica; redução imediata permitida | `users-access-panel.tsx:682–708` | I/N; A access-governance/access-scope |
| 13 permissões efetivas; alçada credit-director | privilégio mínimo; admin bloqueado na UI; alçada não habilita outra empresa | `users-access-panel.tsx:725`, `:760–787` | I/N; A access-control/change-maker-checker |
| Salvar acessos / descartar alterações admin | rascunho só aplicado após resposta; erro preserva draft | `users-access-panel.tsx:108`, `:492–514` | I/N; A access-profile-client |
| Motivo proposta/descartar/enviar aprovação não admin | mudanças críticas congeladas, não aplicadas antecipadamente | `users-access-panel.tsx:519–540`, `:184` | I/N; A access-change-maker-checker |
| Motivo decisão; aprovar/aplicar; rejeitar por pedido | admin vigente pode decidir inclusive pedido próprio, regra atual intencional; não-admin impedido | `users-access-panel.tsx:332–369`; `tests/access-change-maker-checker.test.ts:131` | I/N; A teste admin próprio, não sinalizado falso defeito |
| Alçadas empresa: seletor empresa | carregar configuração por empresa; limpar antes de trocar; falha carga | `policy-approval-panel.tsx:28`, `:78` | I/N; A operation-server-approval-policy |
| Alçadas: identificador, autoridade, área, adicionar/remover | ≥1 slot, IDs únicos, autoridade válida; risco/controladoria | `policy-approval-panel.tsx:96–176` | I/N; A validação slot duplicado/autoridade |
| Alçadas: motivo; enviar proposta; aprovar/rejeitar regra | ≥10 caracteres, versão concorrente, segunda pessoa; demo somente texto | `policy-approval-panel.tsx:178–235` | I/N; A operation-server-approval-policy |

## Matriz integral — políticas e motor

| Família / controles | Destino e cenário | Fonte exata | Estado / evidência |
| --- | --- | --- | --- |
| Gravar política; baixar CSV modelo; importar arquivo | save explícito; download real `saveFile`; import rascunho, empresa/modalidade existentes; limpar file input | `policies-module.tsx:95`, `:217–241`, `:257–280` | I/N; A eligibility / eligibility-policy-persistence |
| Nova política; nome/empresa/produto/versão/vigência; cancelar/criar | draft sem ativação; rejeitar sem nome/destino | `policies-module.tsx:123`, `:728–796` | I/N |
| Nova versão; selecionar política por linha | clonar ativa em rascunho; não duplicar próxima versão; selecionar versão certa | `policies-module.tsx:109–121`, `:319–340` | I/N; A eligibility |
| Empresa, início vigência, versão do rascunho | edição congela na pendência; versão ativa somente leitura | `policies-module.tsx:391–419` | I/N; A eligibility-policy-persistence |
| Justificativa; solicitar/aprovar publicação; rejeitar | salvar antes envio; regra parametrizada; ≥10 caracteres; segunda pessoa; falha servidor | `policies-module.tsx:135–215`, `:430–456` | I/N; A eligibility-policy-persistence |
| Abas Regras aplicadas/Catálogo; busca catálogo; adicionar regra por linha | apenas regras não incluídas; active/pending não editável | `policies-module.tsx:469–482`, `:678–706` | I/N |
| Regra: enabled, parâmetro booleano/número/texto/lista, efeito falha, ação, override permitido | parâmetro correto com unidade; bloqueio/alçada/alerta; exceção com competência | `policies-module.tsx:514–660` | I/N; A policy-parameter-presentation/eligibility |
| Alertas de regra sem dado/integração e publicação pendente/rejeitada | aviso não equivale decisão financeira; falta dado recusa conforme política | `policies-module.tsx:368–385`, `:536–603` | I/N; A eligibility; motor cenário completo outra frente |

## Matriz integral — Cadastros

| Família / controles | Destino e cenário | Fonte exata | Estado / evidência |
| --- | --- | --- | --- |
| Abas Todos e oito papéis; Novo cadastro por papel; filtro comercial/todos/sem | formulário único com papel inicial; contagem ativa; vazio | `registry-module.tsx:65`, `:109–145` | I/N; A registry |
| Toast fechar; retorno/salvar modal | sucesso fecha só após confirmação; erro preserva modal | `registry-module.tsx:154`, `:195–209`; `party-form-modal.tsx:226–265` | I/N; A registry; F CFG-01 fronteira API |
| Todos/outros papéis: mostrar inativos, busca, Abrir por linha | nome/fantasia/CPF/CNPJ/cidade; inativo consultável | `parties-tab.tsx:129–164`, `:207` | I/N |
| Cedentes: busca; expandir linha; Cadastro; Transferir/Vincular | ficha por documento; sem ficha avisa erro; expansão operacional | `cedents-tab.tsx:125`, `:156`, `:206–216`; `registry-module.tsx:60` | I/N; teclado CFG-06 |
| Cedente expandido: operação por linha; Carteira; Comercial | workspace da operação exata; módulos portfolio/commercial sem filtro | `cedents-tab.tsx:296–315` | I/N; contexto não preservado observado em código |
| Sacados: busca; Cadastro por linha; Carregar mais | primeira página/reset busca; documento identifica ficha; offset incremental e erros | `debtors-tab.tsx:115`, `:170`, `:188–201` | I/N; paginação DB B |
| Transferir: destino comercial, motivo, cancelar/fechar/transferir | só ativo diferente, negócios anteriores preservados; motivo obrigatório no domínio; sucesso persistido antes fechar | `commercial-link-modals.tsx:25–62`; `registry-module.tsx:212–223` | I/N; A registry (propagação), jornada UI N |
| Vincular: comercial, gerente, origem, cancelar/fechar/vincular | comercial ativo não gerente; gerente ativo; quatro origens; erro não fecha | `commercial-link-modals.tsx:77–139`; `registry-module.tsx:225–244` | I/N |
| Modal: abas identificação/papéis/relacionamento/contrato/parâmetros/limites/conformidade/histórico | três comuns, quatro cedente, histórico existente; rascunho único entre abas | `party-form-modal.tsx:39–49`, `:303–314` | I/N |
| PF/PJ; CPF/CNPJ; consultar CNPJ; aplicar evidência; abrir cadastro duplicado | dígitos verificadores; duplicidade tenant; fonte não substitui automaticamente; abrir existente pelo ID | `party-form-modal.tsx:326–389`; handlers `:134`, `:182` | I/N; A registry/enrichment/enrichment-provenance |
| Nome/fantasia, nascimento/fundação, inscrição estadual, email, telefone | campos condicionais PF/PJ; validação antes salvar | `party-form-modal.tsx:393–441` | I/N; A registry |
| Oito papéis checkbox/botão | toggle mantendo dados do papel, sem permitir cadastro sem papel | `party-form-modal.tsx:448–457`; `:207` | I/N; A registry |
| Endereço: CEP/consultar, logradouro, número, complemento, bairro, cidade, UF | CEP 8 dígitos e fonte pública; erro; preservar dados não vazios | `party-form-modal.tsx:482–543`; `:146` | I/N; A public-data-provider; fonte externa real B |
| Contatos por linha: nome/área/email/telefone; remover/adicionar | ID novo; várias áreas; exclusão só draft até salvar | `party-form-modal.tsx:550–600` | I/N |
| Contas por linha: banco/agência/conta/titular/Pix/principal; remover/adicionar | apenas uma principal; catálogo público; novo autenticado exige salvar pessoa antes conta | `party-form-modal.tsx:608–673`; `:219`, `:235` | I/N; A bank-account-maker-checker; probe bloqueio banco direto A |
| Situação ativo/inativo, motivo inativação, observações, motivo alteração | exclusão lógica; motivo obrigatório UI/domínio; histórico servidor CFG-01 | `party-form-modal.tsx:694–735` | I/N; A registry; F API CFG-01 |
| Cedente: comercial/gerente, pré-checagem lastro | vínculo comercial ativo; escolha sem comercial/gerente; pré-checagem altera novas operações | `party-role-fields.tsx:82–132` | I/N; A registry/operational-profile; jornada Lastro outra frente |
| Sacado: limite/contato confirmação | zero = sem limite próprio; valores BR | `party-role-fields.tsx:141–155` | I/N; A registry |
| Fornecedor: categoria/prazo | categoria válida/obrigatória; prazo zero permitido | `party-role-fields.tsx:164–184` | I/N; A registry |
| Prestador: serviço/vigência | serviço obrigatoriedade; data vazia/expirada | `party-role-fields.tsx:193–207` | I/N; A registry |
| Representante: CLT/autônomo, região, meta, comissão, empresa pagadora | comissão só autônomo; empresa existente; propagação para comercial | `party-role-fields.tsx:219–265` | I/N; A registry |
| Debenturista: emissora, série, quantidade, PU, remuneração, vencimento, qualificado | emissora Securitizadora; obrigatórios; sem emissora cadastrada | `party-role-fields.tsx:277–345` | I/N; A registry; fixture sem emissora UI N |
| Cotista: fundo, classe/subclasse, quantidade, qualificado | somente FIDC; quatro classes; sem fundo | `party-role-fields.tsx:346–384` | I/N; A registry |
| Avalista: cedente garantido, aval/fiança, limite | selecionar garante documento/nome coerentes | `party-role-fields.tsx:397–428` | I/N; A registry |
| Contrato cedente: número, assinatura, início/fim, renovação, regresso, observações; instituições e recebíveis permitidos | herança contrato e critérios entrada; fim sincroniza contractUntil | `cedent-profile-fields.tsx:104–172` | I/N; A operational-profile |
| Parâmetros cedente: mesmos 31 números e 5 opções; Usar padrão por campo | override zero preservado; herdar remove chave; sem reescrita do geral | `cedent-profile-fields.tsx:70–87`; `operational-parameters-editor.tsx:98`, `:248` | I/N; A operational-profile |
| Limite global/validade; adicionar/remover tranche por linha | soma das tranches; saldo não alocado; validade | `cedent-profile-fields.tsx:191–225` | I/N; A operational-profile |
| Tranche: ativa, nome, valor, instituição, veículo, modalidade, recebível, validade, prioridade, compartilhar | restringir alocação e limites determinísticos; negativo/vencido/empresa inválida | `cedent-profile-fields.tsx:378–441` | I/N; A operational-profile; combinações UI N |
| Conformidade: KYC, sanções/revisões cadastral/crédito, COAF, PEP, beneficiário final | pendente/análise/aprovado/reprovado; data vencida; registro manual não consulta oficial | `cedent-profile-fields.tsx:245–305` | I/N; motor completo outra frente |
| Aprovação bancária: motivo, rejeitar/aprovar por solicitação | compara antes/depois; solicitante impedido servidor; concorrência; segunda pessoa aplica | `bank-account-approval-panel.tsx:46–67`, `:123–143` | I/N; A bank-account-maker-checker; carga erro CFG-05 |

## Matriz integral — autenticação/onboarding

| Família / controles | Destino e cenário | Fonte exata | Estado / evidência |
| --- | --- | --- | --- |
| Login identificador/senha; mostrar/ocultar; entrar | POST sessão aceita login/CPF/email; sucesso monta onboarding; erro não entra | `auth-gate.tsx:98–125`, `:268–323` | I/N; A access-identity (não login browser) |
| Solicitar novo acesso / Já tenho acesso | alterna formulário, limpa mensagem; campos permanecem memória | `auth-gate.tsx:326–337` | I/N |
| Nome/login/CPF/email/departamento/senha/confirmação; enviar aprovação | senha divergente bloqueia antes rede; pending; existente retorna login; erros | `auth-gate.tsx:129–167`, `:222–316` | I/N; A access-identity; email real não enviado |
| Continuar demonstração | só hostname localhost/127.0.0.1; sessão demo, não produção | `auth-gate.tsx:65–67`, `:171–189`, `:340–345` | I/N nesta frente; UI principal separada |
| Sair (contexto acionado shell) | DELETE sessão e signed-out; falha HTTP não é verificada antes limpar UI | `auth-gate.tsx:88–91`; `auth-context.tsx` | I/N; revogação real B |
| Onboarding todos campos identificação/endereço/instituição/email/telefone/data/site | sem empresa pede primeiro cadastro; empresa existente entra aplicação | `company-onboarding.tsx:33–59`, `:154–260` | I/N; servidor {} F CFG-02 |
| Onboarding consultar CNPJ/CEP | habilita 14/8 dígitos; busy único; preenche com evidência e fonte | `company-onboarding.tsx:88–145`, `:181–185`, `:230–234` | I/N; A public-data-provider/enrichment-provenance; rede real B |
| Criar empresa e começar | PUT company e só ready após ok; erro conserva formulário | `company-onboarding.tsx:65–83`, `:265` | I/N; autenticação + DB real B |

## Matriz de permissões, escopo e combinações

| Combinação | Resultado verificado / falta |
| --- | --- |
| Sem sessão / tenant ausente / sessão outro tenant | A nos testes dirigidos access-scope/intelligence-budget-routes; demais rotas inspecionadas; matriz HTTP completa N |
| settings:view apenas | leitura orçamento 200, escrita orçamento 403 A; controles usuários ainda renderizados F/CFG-03; alterar licença UI N |
| registry:view apenas / registry:edit | probe 403 versus 200 em pessoa; alteração banco direta 409 A; server-side história falha CFG-01 |
| users:manage gestor, sem admin vigente | proposta crítica exigida; elevação direta negada A access-change-maker-checker; UI real N |
| Admin vigente ativo / admin suspenso | admin direto permitido e auditado; suspenso não obtém exceção A; requisito geral de segunda pessoa não se aplica às exceções administrativas cobertas pelos testes |
| Preview de outro usuário / encerrar | identidade autenticada distinta de preview A access-control; confirmação de efeitos de UI e APIs sob preview N |
| Mesma empresa, outra empresa, escopo vazio/uma/várias | alçada fora escopo negada e versão antiga negada A operation-server-approval-policy; todas escritas de empresa/veículo em banco real B |
| Integração ativa/degradada/planejada/suspensa; prioridades duplicadas; pedido próprio | governança e conflitos A com memória; cinco capacidades × todas transições UI N |
| Política rascunho/ativa/encerrada; pendente/rejeitada; primeira/segunda pessoa | imutabilidade, sem publicação direta, congelamento e autor diferente A eligibility-policy-persistence; browser outra frente |
| Defaults/override ausente/override zero; taxa mínima>máxima; prazo inválido; metas negativas | A operational-profile/governance; reflexo completo em risco/preço e painéis depende outras frentes |
| IA não contratada/off/sem credencial/indisponível; teto zero/exaurido | orçamento e consumo determinísticos A; chamada paga B/não autorizada; persistência erro de licença apenas I |
| shared/allocated, usuário ativo/pendente/suspenso/sem vínculo, quota zero/soma>teto/versão obsoleta | A intelligence-budget-*; concorrência PostgreSQL real B |
| Conta nova/existente com movimentos; cobrança off/on; bancos/leiautes; usuário solicitante/aprovador | SSR e maker-checker A; fixture banco homologado e remessa reais B |
| PF/PJ × oito papéis × multirrole × duplicado × inativo | validadores/propagação A registry; nenhuma alegação de todas as combinações UI executadas |
| Desktop/celular/teclado/leitor de tela e modal foco/Escape | N nesta frente; tr clicável sem teclado I/CFG-06 |

## Pontos bons executados

- 133 testes existentes aprovados com evidência: validação CPF/CNPJ, unicidade, papéis, propagação de cadastro, limites herdados e override zero.
- Governança de integração mantém proposta congelada, impede remoção/duplicação e preserva sigilo de configuração no retrato de cliente; aplicação por segunda pessoa/conflito coberta por memória.
- Conta de pessoa não pode ser alterada diretamente pela rota normal (probe 409); segunda aprovação, concorrência e decisão terminal cobertas por testes de memória.
- Publicação de política e regra de alçada exigem segunda pessoa/versão válida; tentativa de reescrever histórico de política é recusada nos testes de domínio. Isso não cobre histórico de pessoa, CFG-01.
- Orçamento IA valida cotas, inativos, usuário/tenant, autoria real e consumo não forjável; não depende de contador enviado pelo navegador.
- Configuração bancária e consulta financeira são separadas no HTML SSR; campos obrigatórios de CNAB400 e bloqueios após movimento aparecem nos testes.

## Pendências para homologação

1. Reproduzir CFG-01 em PostgreSQL temporário isolado com histórico anterior real e GET posterior; provas atuais verificam handler/objeto persistido e inspeção do SQL, não banco.
2. Percorrer cada família acima em navegador com perfis admin/gestor/operador/leitura, fixtures CHURUME por empresa e dados anteriores preservados. Incluir erro/retry/loading e recarga após salvar.
3. Executar combinações externas apenas em homologação autorizada: CNPJ/CEP/bancos, teste OpenAI com orçamento aprovado, transporte bancário de homologação. Não executar cobrança ou movimentação real.
4. Validar teclado, foco e celular; comparar valores persistidos e efeitos em operação/Comercial/Carteira/Financeiro nas outras frentes.
5. Nenhuma correção, migração, commit, deploy ou certificação produtiva foi realizada por esta frente.

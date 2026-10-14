# STRATO — relatório consolidado do que ainda falta

Atualizado em 14/10/2026. Este relatório considera a direção completa do STRATO, a análise do Help do QProf e o estado real do repositório. O QProf é referência de cobertura operacional; não é modelo de telas nem produto a ser clonado.

## 1. Resumo executivo

O STRATO já possui um núcleo diferenciado e persistente para Operações, Recebíveis, Financeiro/Contábil, Carteira, Comercial, Políticas, Tarefas, identidade, alçadas, eventos e outbox. O maior trabalho restante não é criar mais telas: é fechar a operação produtiva externa, a formalização documental, o ciclo bancário/cobrança e a homologação multiusuário.

Prioridades:

1. **P0 — fechar segurança e homologação da Onda A:** condição para colocar o núcleo atual em produção controlada.
2. **P0 — completar a cunha comercial até pagamento:** entrada real, documentos, assinatura e pacote de cessão.
3. **P0 — fechar o ciclo do dinheiro:** banco, cobrança, liquidação, recompra, protesto e contabilidade externa.
4. **P1 — escalar operação:** FIDC, workflow/SLA, relatórios e portais.
5. **P2 — aprender e automatizar:** laboratório de políticas, previsões, anomalias e copiloto governado.

As estimativas abaixo são esforço técnico líquido para uma pequena equipe experiente, sem incluir espera contratual de bancos, registradoras, assinatura ou validações jurídicas.

## 2. O que já está entregue

- persistência por tenant com concorrência otimista em Operações, Financeiro, Carteira, Comercial, Políticas e Tarefas;
- recebível como ativo próprio, deduplicado e vinculado à operação/documento fiscal;
- ledger contábil balanceado, estorno, conciliação e fechamento por data-base;
- sessões, usuários, permissões, alçadas e escopo por empresa/veículo;
- decisões versionadas, idempotência, eventos imutáveis, outbox e notificações;
- escopo de empresa em Operações, Decisões, Carteira, Recebíveis, Financeiro, Tarefas, notificações e reprocessamento da outbox;
- maker-checker para exceção de risco, liberação financeira, favorecidos, contas bancárias, políticas, privilégios, parâmetros operacionais globais e provedores de integração;
- leitura cadastral separada da edição e Copiloto alimentado por fontes lidas e filtradas integralmente no backend;
- funil comercial, comitê, onboarding, carteira/cobrança inicial e Central do Dia;
- catálogo de integrações reais ligado à configuração persistida, com bloqueio de chamadas sem provedor ativo e
  separação explícita entre fonte pública e integração institucional;
- guias operacionais por domínio e por perfil.

## 3. Pendências para produção controlada — P0 imediato

| Entrega                    | Situação atual                                                                             | Falta                                                                                        | Estimativa |
| -------------------------- | ------------------------------------------------------------------------------------------ | -------------------------------------------------------------------------------------------- | ---------: |
| Homologação multiusuário   | Operações e Financeiro homologados com duas sessões; gravações vencedoras preservadas            | repetir em Carteira, Comercial, Políticas e Tarefas                                      |   2–3 dias |
| Ataques cruzados           | duas sessões, dois tenants, escopo empresarial e requisições forjadas homologados          | nenhuma pendência funcional neste recorte; repetir no UAT de regressão antes do go-live      |  concluído |
| Escopo residual de APIs    | concluído e homologado com sessões reais temporárias                                       | nenhuma pendência funcional neste recorte; repetir no UAT completo com usuários definitivos  |  concluído |
| Maker-checker residual     | fluxos financeiros, bancários, políticas, privilégios, parâmetros e integrações protegidos | cobrir demais configurações materiais e executar UAT definitivo                              |   1–3 dias |
| Contrato comum de comandos | cada agregado possui implementação confiável                                               | unificar recibo idempotente, event ledger, outbox, correlação e respostas de conflito        |   5–8 dias |
| Segurança de conta         | sessão e bloqueio existem                                                                  | MFA para perfis críticos, política de senha comprometida, recuperação e revisão de sessão    |   4–7 dias |
| Operação de plataforma     | build e banco existem                                                                      | backup/restore ensaiado, métricas, logs, alertas, retenção, runbook e deploy produtivo       |   5–8 dias |
| Estado real vazio          | separação demo/real implementada                                                           | executar checklist integral sem seeds e confirmar zero vazamento de demonstração             |   2–3 dias |

Checkpoint de integrações concluído em 14/10/2026: CNPJ, CEP, diretório bancário, feriados e participantes Pix agora
consultam a configuração do servidor antes da chamada externa. A BrasilAPI está identificada como fonte pública, e
configuração/credenciais não atravessam a API. Ativação, suspensão, prioridade e troca agora passam por maker-checker,
com retrato congelado, aprovador distinto e aplicação atômica. Ainda faltam cofre de credenciais, tentativas, retry,
dead-letter e observabilidade; esses itens permanecem nas estimativas da Onda C.

**Subtotal P0 imediato remanescente:** aproximadamente **19–32 dias úteis**. Parte pode ser executada em paralelo.

## 4. Cunha comercial completa — Onda B

| Capacidade                   | O que falta de fato                                                                             | Estimativa |
| ---------------------------- | ----------------------------------------------------------------------------------------------- | ---------: |
| Estrutura institucional/FIDC | empresa, veículo, fundo, classe/subclasse, participantes e matriz de responsabilidades          |  6–10 dias |
| Onboarding e prontidão       | checklist por produto/veículo, documentos vencidos, bloqueios e pendências por uso              |  6–10 dias |
| Entrada produtiva            | XML/CSV/XLSX/API, preservação do original, prévia, rejeições e lote idempotente                 | 10–15 dias |
| Enriquecimento essencial     | fontes oficiais/bureaus com evidência, validade, qualidade, cache e indisponibilidade explícita |  8–15 dias |
| Política produtiva           | catálogos reais, vigência, herança, simulação e publicação maker-checker                        |   5–8 dias |
| Hub documental               | arquivo, hash, versão, classificação, vínculo, retenção, acesso e trilha de download            | 12–20 dias |
| Assinatura                   | envelopes, ordem, autenticação, webhooks, recusas, expiração e certificado                      |  8–15 dias |
| Cessão/registro/pagamento    | pacote verificável, protocolo, rejeição, retorno e compensação                                  | 10–18 dias |

**Subtotal Onda B:** aproximadamente **65–111 dias úteis**.

## 5. Ciclo do dinheiro — Onda C

| Capacidade               | O que falta de fato                                                                       | Estimativa |
| ------------------------ | ----------------------------------------------------------------------------------------- | ---------: |
| Runtime de integrações   | cofre de credenciais, jobs, retry, dead-letter, webhooks, payload bruto e observabilidade | 10–15 dias |
| Primeiro banco produtivo | homologação de conta/carteira/layout, autenticação e retorno operacional                  | 10–20 dias |
| Cobrança bancária        | boleto/Nosso Número, remessa, retorno, instruções, baixa e rejeição                       | 12–20 dias |
| Conciliação produtiva    | extrato/retorno, matching seguro, divergência e reprocessamento                           |  8–12 dias |
| Conta gráfica e recompra | retenções, compensações, regresso, saldo do cedente e contabilização                      |  8–12 dias |
| Caso de cobrança         | promessa, acordo/parcelas, prorrogação, protesto/IEPTB, negativação e jurídico            | 15–25 dias |
| Exportação contábil      | layouts, centros/classificações, validação, lote, protocolo e reexecução                  |  6–10 dias |

**Subtotal Onda C:** aproximadamente **69–114 dias úteis**, além dos prazos externos de homologação.

## 6. Escala, FIDC e controle — Onda D

- reconciliação com administrador e custodiante;
- PDD oficial por posição, data-base e política;
- Duplicata Escritural, registradoras, gravames e agenda quando aplicável;
- workflow configurável, filas, calendário útil, SLA, delegação e escalonamento;
- catálogo de relatórios, filtros salvos, exportação assíncrona, agendamento e distribuição;
- API analítica governada e webhooks externos;
- portal do cedente com identidade forte e projeções do mesmo domínio;
- classes/subclasses e pacotes regulatórios conforme responsabilidade contratual.

**Estimativa:** **60–100 dias úteis**. Antes de implementar funções reguladas, é obrigatória a matriz jurídica de responsabilidades entre STRATO, gestora/consultoria, administrador, custodiante e registradora.

## 7. Aprendizado e automação — Onda E

- laboratório de políticas e comparação de cenários;
- safras, roll rates e previsão de liquidez;
- shadow mode para comparar decisão sugerida, decisão humana e desfecho;
- fraude/anomalia com explicação e revisão humana;
- copiloto com fontes produtivas, limites de ação e trilha;
- portais adicionais somente após demanda validada.

**Estimativa:** **35–60 dias úteis** após as bases das Ondas B–D.

## 8. Materiais de suporte ainda necessários

- central de ajuda contextual dentro de cada etapa;
- manual do administrador de segurança, escopos, alçadas e maker-checker;
- runbook de integrações, rejeições e reprocessamento;
- procedimentos de contingência, backup e restauração;
- catálogo de mensagens de erro com causa, impacto e ação;
- roteiro de implantação do cliente e migração inicial de dados;
- trilhas curtas por perfil e ambiente de treinamento;
- notas de versão e matriz de mudanças que exigem retreinamento.

Já existe procedimento específico para propor, aprovar, rejeitar e auditar padrões globais em `docs/user-guides/APROVACAO_DE_PARAMETROS_OPERACIONAIS.md`.
O comportamento atual das fontes externas está documentado em `docs/user-guides/DISPONIBILIDADE_DE_INTEGRACOES.md`.
O fluxo maker-checker de provedores está documentado em `docs/user-guides/APROVACAO_DE_INTEGRACOES.md`.

## 9. O que não deve entrar no núcleo agora

- help desk corporativo próprio;
- compras, patrimônio, RDV e orçamento genéricos;
- uma tela para cada consulta do QProf;
- cadastros duplicados por papel;
- administração oficial do passivo de fundo sem decisão jurídica/comercial;
- IA executando liberação de dinheiro, troca de conta ou decisão humana independente.

Essas necessidades devem ser atendidas por integração, projeção, catálogo ou produto adicional quando houver caso comercial.

## 10. Sequência executável recomendada

1. concluir A5: escopos residuais, maker-checker residual, contrato comum e ataque cruzado;
2. homologar todo o núcleo atual com duas sessões e estado real vazio;
3. implantar storage documental e entrada produtiva;
4. construir runtime comum de integrações;
5. conectar assinatura e primeiro banco;
6. fechar cessão, cobrança, conciliação e recompra;
7. adicionar workflow/SLA e reporting;
8. avançar FIDC/portais/IA somente sobre os ciclos produtivos já fechados.

## 11. Horizonte total

- **Produção controlada do núcleo atual:** 6–10 semanas, considerando execução paralela e homologação.
- **Operação ponta a ponta sem planilha, até cobrança/conciliação:** 4–7 meses para uma pequena equipe, condicionado a provedores externos.
- **Visão ampliada com FIDC, escala e aprendizado:** 7–12 meses, conforme fronteira regulatória e tamanho da equipe.

O ganho do QProf que mais eleva o STRATO é a completude dos retornos, exceções e rotinas operacionais. A vantagem que deve ser preservada é fazer isso em um ciclo integrado, orientado por eventos e evidências, sem reproduzir centenas de telas fragmentadas.

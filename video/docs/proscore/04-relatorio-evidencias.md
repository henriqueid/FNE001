# Relatório de evidências — o que o vídeo mostra como existente

Verificação feita em 26/10/2026 no código do repositório e no STRATO rodando localmente em **modo demonstração**
(dados fictícios, banco PostgreSQL descartável). Nenhum dado de produção, cliente real, credencial ou operação de
efeito real foi acessado. Nenhum dado foi alterado.

Classificação: **EXISTENTE** (implementado e funcional) · **PARCIAL** (implementado, incompleto ou dependente de
homologação externa) · **PLANEJADA** (prevista na evolução) · **PROPOSTA** (hipótese de integração com a proScore).

| # | Funcionalidade | Classificação | Evidência | Como aparece no vídeo |
|---|---|---|---|---|
| 1 | Dashboard principal (Visão geral, leitura executiva, radar) | EXISTENTE | tela `visao-geral` | Cena 02 e 14 — tela real |
| 2 | Cadastros de cedentes e sacados (cadastro único por CNPJ, papéis, grupos) | EXISTENTE | tela `cadastros`; `src/domain/registry` | Cena 03 |
| 3 | Análise de crédito e risco do sacado/cedente (score 0–1000, recomendação) | EXISTENTE | tela `operacao-risco` | Cena 03 |
| 4 | Políticas operacionais versionadas (Matriz Mestre, 58 regras no catálogo) | EXISTENTE | telas `politicas`, `politicas-regras`; `src/domain/eligibility` | Cena 05 — tela real |
| 5 | Operações e importação de recebíveis (XML NF-e, CNAB, planilha) | EXISTENTE | `src/features/operations`; Copiloto “mande o lote” | Cena 04 (simulação identificada) |
| 6 | Gestão de títulos | EXISTENTE | Carteira › Títulos | Cena 03 |
| 7 | Análise, elegibilidade e concentração (motor: 21 avaliações, 19 sem intervenção, 1 exceção de concentração 37,2% > 35%) | EXISTENTE | tela `motor-resultado` | Cena 04 — tela real |
| 8 | Aprovações e alçadas | EXISTENTE | etapa Aprovação; alçadas no servidor (CLAUDE.md) | Cena 03 e 05 |
| 9 | Precificação | EXISTENTE | etapa Preço; resumo financeiro do borderô | Cena 03 |
| 9b | Formalização | PARCIAL | Controladoria › Formalização; provedor de assinatura não configurado | Cena 03 (selo Parcial) |
| 9c | Desembolso / liberação | EXISTENTE (sem transmissão bancária) | Financeiro › Liberações; permissão `finance:release` | narração |
| 10 | Carteira e indicadores financeiros | EXISTENTE | telas `carteira`, `carteira-cedente`, `financeiro` | Cena 03 e 12 |
| 11 | Score interno da carteira (índice por regras e pesos, não preditivo) | EXISTENTE | tela `radar-score`; `src/domain/risk/quality-policy.ts` | Cena 06 — tela real e pesos reais |
| 12 | Cobrança e inadimplência (central, régua, CNAB400 local) | PARCIAL | Central de cobrança; homologação bancária pendente (ARCHITECTURE §9) | Cena 03 (selo Parcial) |
| 13 | Conciliação (bancária, OFX) | EXISTENTE | Financeiro › Conciliação; Controladoria | Cena 03 |
| 14 | Recompra | EXISTENTE | trilha de auditoria “Recomprado”; `repurchaseEvents` | Cena 03 |
| 14b | Substituição de títulos | PLANEJADA | não encontrada no código | não exibida como existente |
| 15 | Encerramento da operação | PLANEJADA | não encontrado como fluxo próprio | Cena 03 com selo “Planejada” |
| 16 | Auditoria e registros históricos (trilha, ledger append-only, políticas versionadas) | EXISTENTE | tela `auditoria`; ARCHITECTURE | Cena 03 e 05 |
| 17 | Copiloto de IA (perguntas em linguagem natural, respostas com fontes, aprovação explícita) | EXISTENTE | telas `copiloto`, `copiloto-evidencias`; ARCHITECTURE §10 | Cena 09 — tela real |
| 17b | Agentes especializados (análise, carteira, cobrança, conciliação, compliance, executivo) | PLANEJADA | `docs/architecture/PLANO_ESTRUTURA_IA.md` (fases IA-2 a IA-4) | Cena 10 como “em evolução” |
| 18 | Integrações e configurações (catálogo: 0 ativas, 5 em demonstração, 8 não configuradas) | PARCIAL | tela `integracoes`; `src/domain/integrations/model.ts` | Cena 08 — tela real |
| 19 | Funcionamento sem IA (motores e perguntas conhecidas sem modelo) | EXISTENTE | ARCHITECTURE §10 (“mesmo sem IA”) | Cena 05 e 10 |
| P | Qualquer integração com a proScore | PROPOSTA | — | Cenas 06–08, 11, 13 com selo “Integração proposta” |

## Regras aplicadas na produção

- Toda tela com o selo **“Tela real · ambiente de demonstração”** é um print do sistema, sem números alterados.
  Único retoque: no print do Copiloto foi coberta a nota técnica “Resposta local da sessão atual…”.
- Animações conceituais levam **“Simulação ilustrativa · dados sintéticos”** (cenas 04 e 11) ou **“Visão de evolução”**.
- O score interno é apresentado como classificação por regras; nenhum “score preditivo” é afirmado.
- Nenhuma logomarca da proScore foi usada ou criada; o nome aparece apenas em texto.
- A afirmação da cena 07 sobre a atuação da proScore está alinhada ao que a empresa publica (ver `01-pesquisa-publica-proscore.md`).

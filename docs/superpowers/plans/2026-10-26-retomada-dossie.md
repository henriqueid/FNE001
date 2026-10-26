# Retomada do dossiê — validação de ações e entradas

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:executing-plans e superpowers:dispatching-parallel-agents. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** avançar lacunas de execução do dossiê e corrigir defeitos reproduzidos de importações, persistência e ações operacionais, sem repetir achados já publicados.

**Architecture:** manter contratos determinísticos, APIs autoritativas e React/vinext. Usar fixtures locais e regressões dirigidas; testes de handlers não são navegador nem homologação de banco.

**Tech Stack:** TypeScript, React, Vitest e prévia local quando necessária.

**Spec:** autorização do usuário para retomar dossiê e trabalhar correções; lacunas registradas em `docs/testing/churume/2026-10-26-correcoes/resultado.md` e inventário25/10.

## Global Constraints

- Base funcional confere com publicação aa1aa8b; checkout antigo com alterações preservado. Baseline SHA dos arquivos em `/tmp/strato-retomada-20261026-baseline.json`.
- Sem publicação, migração, consumo pago, serviços externos ou dados produtivos neste novo lote.
- Nenhuma regra financeira nova; corrigir entradas e confirmação respeitando validadores canônicos.
- Reproduzir antes de corrigir, testar recusa e caminho válido; não converter controles inspecionados em aprovados.
- Raiz pertence ao principal; frentes independentes não editam arquivos compartilhados sem coordenação.

## Review Focus

- Datas impossíveis/vazias, centavos e parsing de valores não podem ser aceitos como entrada válida.
- Falha/rejeição de gravação mantém preparo; sucesso somente após confirmação.
- Escopo/conta/destino e filtro não podem trocar silenciosamente.
- Não duplicar ações durante requisição em andamento.
- Falha externa não deve criar dados financeiros fictícios.

## Task1 — entradas financeiras (principal)

- [x] Reproduzir importações com datas inválidas, valores ptBR e linhas mistas; criação/edição/parcelamento com dados inválidos.
- [x] Corrigir causas confirmadas com validação consistente na borda e no domínio quando contrato exigir; testes RED→GREEN.
- [x] Conferir adaptadores de persistência das ações e atualizar relatório da retomada.

## Task2 — conciliação e extrato (frente independente)

- [x] Exercitar handlers com sucesso/false/rejeição/duplo clique e troca de conta/escopo em OFX, conciliação e transferência.
- [x] Corrigir somente defeitos reproduzidos nos componentes exclusivos; manter regras de ledger.
- [x] Registrar cenários, falhas e validação dirigida.

## Task3 — carteira e cobrança (frente independente)

- [x] Exercitar registro/confirmacão/cobrança e links disponíveis com falha/sucesso, troca de título/escopo e campos obrigatórios.
- [x] Corrigir somente defeitos reproduzidos nos componentes exclusivos; preservar Acordos com histórico completo.
- [x] Registrar cenários, falhas e validação dirigida.

## Task4 — integração e revisão

- [x] Revisão independente das correções, teste de integração do lote, `npm run check` e build.
- [x] Atualizar dossiê com casos executados, melhorias, pendências externas e limites; não declarar cobertura total por contagem.

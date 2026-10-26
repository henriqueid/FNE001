# Validação operacional por etapas

**Goal:** validar jornadas pelo navegador local, corrigir falhas reproduzidas e preservar inventário dos cenários ainda não executados.
**Architecture:** componentes reais em demonstração de origem exclusiva, fixtures CHURUME; APIs/autenticação exigem ambiente servidor isolado próprio. Nenhuma publicação automática.
**Tech Stack:** React, navegador nativo, Vitest, Vite/vinext.

## Etapa1 — jornadas financeiras principais

- [x] Matriz antes de executar; dados identificados CHURUME, origem nova5182.
- [x] Lançamento único, parcelas/centavos/fim de mês e importação mista.
- [x] Transferência entre contas da mesma empresa, seleção e contrapartida.
- [x] OFX, conciliação manual/automática, desfazer e diferença de tarifa.
- [x] Reproduzir teclado; corrigir Modal compartilhado com RED→GREEN e verificar navegador.
- [x] Reproduzir moeda da mensagem; corrigir somente apresentação com RED→GREEN.
- [x] Check/build final e registro das evidências/limites.

## Etapas seguintes

- [ ] Carteira/cobrança: escopo/título, checagem, promessa, acordo e contatos.
- [ ] Acessos reais em ambiente servidor descartável: criar/liberar/login/revogar; não usar demonstração como prova.
- [ ] Demais controles do inventário e subcenários pendentes do Financeiro: marcar por execução, nunca por família de componente.

Arquivos deste lote: `finance-ui.tsx` (teclado/foco do modal), `reconciliation.ts` (mensagem monetária), regressões `finance-modal-keyboard.test.ts` e `finance-reconciliation.test.ts`; relatório/evidências em `docs/testing/churume/2026-10-26-etapa1-financeiro/`.

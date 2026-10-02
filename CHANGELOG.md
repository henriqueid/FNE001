# Changelog

## Não lançado — 02/10/2026 · Gestão por exceção (fase 3) e parâmetros operacionais

**Gestão por exceção**
- Avanço automático (`domain/operations/auto-advance.ts`): com o motor liberando a operação (snapshot dentro da política ou exceções já deliberadas), Lastro e Preço concluem sozinhos e a operação chega à Tela Final (Aprovação). Lastro só avança com evidências validadas e amostra confirmada; Preço usa a condição já salva ou salva a condição padrão da modalidade quando respeita o piso e gera líquido e spread positivos. Aprovação, formalização e liberação nunca avançam sozinhas. Cada avanço fica registrado em nome do "Motor de elegibilidade", com o motivo; a esteira diz onde e por que parou. Desligável por `autoAdvanceWithinPolicy`.
- Central: nova fila **Exceções por alçada** (`domain/eligibility/authority-queue.ts`), com resumo por alçada clicável e "Aguarda: …" na linha da operação. Lê só o snapshot e os overrides.

**Parâmetros operacionais**
- Novo `src/domain/eligibility/operational-parameters.ts`: fonte única, por modalidade, dos números que as etapas atuais usavam fixos no código (faixas de score 600/700, prazo mínimo de 15 dias, CFOP 5xxx/6xxx, amostra de lastro 25/50/100%, participação relevante de 25%, piso de taxa 1,4/1,8/2,4% a.m., automação 70 e 80, condição comercial padrão e garantia por risco). Mesmos valores, mesmo comportamento; são configuração de demonstração, não referência de mercado.
- Risco, Lastro, Preço, Aprovação, Central, Cadastros e Visão geral passam a ler essa fonte.
- Concentração da etapa de Risco passa a ler o limite da regra `DEBTOR-OPERATION-CONCENTRATION-MAX-001` do motor (`policy-parameter.ts`): primeiro o valor congelado no snapshot da análise, senão a política vigente configurada em Políticas. Acaba a divergência entre 20% (tela antiga) e 35% (política demo do motor).
- Prazo do título em dias de calendário (antes somava um dia por arredondamento de fuso).
- Teste comercial deixou de depender da data fixa 30/09/2026.
- `tests/operational-parameters.test.ts`: paridade com a v7 para "Aprovar elegíveis", amostra de lastro, piso de taxa e condição padrão.

## 0.7.0 — 30/09/2026

**Código**
- Reorganização em camadas: `src/domain` (regras puras), `src/features` (telas por módulo), `src/app` (estado global e persistência), `src/ui`.
- Arquivos grandes divididos por responsabilidade (o antigo `operations-mvp.tsx`, com ~290 KB, foi dividido em cerca de 100 arquivos pequenos entre `src/app`, `src/domain/operations` e `src/features/operations`). Painéis de etapa separados em subcomponentes, hook de estado e modelo puro.
- Cabeçalho explicativo em todos os arquivos; `docs/ARCHITECTURE.md` e `docs/CONVENTIONS.md`.
- ESLint sem erros nem avisos, Prettier em todo o código, 28 testes unitários (Vitest) e `npm run check`.
- Acessibilidade: fundos de modal com `role="presentation"`, itens clicáveis acessíveis por teclado (`pressable`), rótulos em botões só com ícone.
- Remoção de código morto (recomendação de risco fixa, funções sem uso).

**Produto**
- Cadastro completo de pessoas com papéis (cedente, sacado, fornecedor, representante, debenturista, cotista, avalista, prestador), validação de CPF/CNPJ, endereço, contatos, contas bancárias, inativação com motivo e histórico.
- Gravar no Cadastro propaga: cedente aparece na Nova operação e ganha vínculo com o comercial; sacado entra na digitação; representante vira comercial.
- CNPJs de demonstração corrigidos para dígitos verificadores válidos.

## 0.6.0 — 30/09/2026

- Design system claro/escuro, shell novo com busca global e alertas, Cadastros e Carteira v1, vínculo único Cadastro → Operação → Carteira → Comercial → Tesouraria e correções da revisão (ver `docs/produto/REVISAO_V6.md`).

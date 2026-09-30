# Convenções de código

## Idioma

- Textos de interface, comentários e documentação em português.
- Identificadores em inglês (`pricingCalculation`, `PartyRole`), exceto termos do negócio sem tradução boa, que ficam em português nos valores (`"Em aberto"`, `"cedente"`).

## Arquivos e nomes

- Arquivos em `kebab-case` (`party-form-modal.tsx`); componentes em `PascalCase`; hooks começam com `use`.
- Um arquivo, uma responsabilidade. Cada arquivo abre com um comentário `/** ... */` dizendo o que ele faz e onde se encaixa.
- Componentes de tela: alvo de até ~450 linhas. Quando crescer, divida em subcomponentes na mesma pasta, com um `use-<nome>.ts` para o estado e um `<nome>-model.ts` para funções puras.
- Tipos ficam junto do domínio (`src/domain/<área>/types.ts` ou no próprio arquivo de regra quando são locais).

## Imports

- Entre pastas: alias absoluto `@/src/...`. Na mesma pasta: `./arquivo`.
- Tipos com `import { type X }` (a regra `consistent-type-imports` corrige automaticamente).
- `src/domain` nunca importa React nem nada de `src/features`, `src/app` ou `src/ui`.

## Componentes

- Arquivos de componente começam com `"use client";`.
- Props tipadas explicitamente (`type XProps = { ... }`); sem `prop-types`.
- Estado local o mais perto possível de quem usa; estado compartilhado entre módulos só em `src/app/strato-app.tsx`, exposto por contexto.
- Elementos clicáveis que não são `<button>` usam `pressable()` de `src/ui/a11y.ts` (teclado e papel de botão). Fundos de modal usam `role="presentation"`; o painel do modal tem `role="dialog"` e `aria-modal`.
- Nada de `alert`, `confirm` ou `prompt`: confirmações são feitas na própria página.

## Domínio

- Funções puras que recebem o estado e devolvem `{ state, error?, message? }`. Validação devolve mensagem para o usuário, não exceção.
- Datas no estado sempre em ISO (`AAAA-MM-DD`); formatação na borda.
- Dinheiro: arredondar com `round2` / `roundPricing`; entrada do usuário sempre por `parseMoneyBR`.
- Nada é apagado: exclusão lógica com motivo, estorno por contrapartida e histórico.

## Estilos

- Estilos novos em `app/styles/design-system.css`, usando os tokens `--ds-*` (valem nos dois temas).
- Prefixo por área: `sx-` shell, `ds-` componentes base, `vg-` Visão geral, `fn-` Financeiro, `cm-` Comercial, `rg-` Cadastros, `pf-` Carteira.
- Não escreva cores literais em CSS legado; se precisar, gere o par claro/escuro com `tools/theme_tokens.py` (uso no cabeçalho do script).

## Qualidade

- Antes de subir: `npm run check` (typecheck, lint, formatação e testes) precisa passar.
- `eslint-disable` só com o motivo na mesma linha (`-- motivo`).
- Regras de negócio novas entram com teste em `tests/`.

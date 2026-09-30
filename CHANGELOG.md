# Changelog

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

# STRATO · Receivables OS

Plataforma operacional de recebíveis para factoring, securitizadora, FIDC e ESC (codinome **Lastro**). Este repositório é um protótipo navegável completo: todas as telas funcionam no navegador com dados fictícios e sem backend.

## Rodar

Requer Node.js 22+.

```bash
npm install
npm run preview        # Vite puro, http://localhost:5188 (recomendado para testar)
npm run dev            # Next/vinext (precisa de build/sites-vite-plugin do ambiente de hospedagem)
```

Scripts de qualidade:

```bash
npm run check          # typecheck + lint + formatação + testes
npm test               # testes unitários (Vitest)
npm run format         # Prettier
npm run build:artifact # gera uma página única publicável em .preview/dist-artifact
```

## Módulos

| Menu | O que faz | Código |
|---|---|---|
| Visão geral | Resultado, carteira, caixa, pendências por perfil (Gestão, Operação, Risco) | `src/features/home` |
| Operações | Central, nova operação e workspace com 6 etapas (Entrada, Risco, Lastro, Preço, Aprovação, Liberação) | `src/features/operations` |
| Carteira | Títulos adquiridos, atraso, por cedente e por comercial | `src/features/portfolio` |
| Comercial | Metas, carteira, negócios, visitas, funil, comitês e comissões | `src/features/commercial` |
| Financeiro | Caixa e fluxo, a pagar e a receber, liberações, extrato, conciliação OFX, contábil, bancos | `src/features/finance` |
| Cadastros | Pessoas PF/PJ com papéis: cedente, sacado, fornecedor, representante, debenturista, cotista, avalista, prestador | `src/features/registry` |
| Políticas, Integrações | Escopo da próxima fase | `src/features/shell/module-roadmap.tsx` |

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, mapa de pastas, estado, vínculos entre módulos, estilos, testes.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — padrões de código.
- [INSTRUCOES.md](INSTRUCOES.md) — roteiro de demonstração.
- [docs/produto/](docs/produto/) — contexto de produto, revisão v6 e pesquisa de mercado.
- [CHANGELOG.md](CHANGELOG.md) — o que mudou em cada versão.

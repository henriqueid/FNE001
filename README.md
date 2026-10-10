# STRATO · Receivables OS

Plataforma operacional de recebíveis para factoring, securitizadora, FIDC e ESC. O produto está na transição de protótipo navegável para aplicação persistente: os dados operacionais ainda são fictícios no navegador e a trilha de decisões continua com o adaptador D1 local durante a migração. O login e o diretório de acessos já usam Supabase Auth e PostgreSQL no ambiente definitivo em São Paulo, com esquema privado, RLS, segregação por tenant, trilhas imutáveis, idempotência e outbox transacional.

## Rodar

Requer Node.js 22+.

```bash
npm install
npm run dev            # desenvolvimento com vinext
```

Scripts de qualidade:

```bash
npm run check          # typecheck + lint + formatação + testes
npm test               # testes unitários (Vitest)
npm run format         # Prettier
npm run build          # build de produção
npx supabase --help    # comandos da infraestrutura Supabase
```

Copie `.env.example` para `.env.local` e preencha as variáveis públicas do Supabase. Cada usuário do Supabase Auth deve ser vinculado explicitamente a um perfil autorizado no diretório do STRATO, com o mesmo e-mail corporativo. Chaves secretas e a conexão PostgreSQL são exclusivas do servidor e nunca devem ser expostas no navegador.

## Módulos

| Menu          | O que faz                                                                                                        | Código                    |
| ------------- | ---------------------------------------------------------------------------------------------------------------- | ------------------------- |
| Visão geral   | Resultado, carteira, caixa, pendências por perfil (Gestão, Operação, Risco)                                      | `src/features/home`       |
| Operações     | Central, nova operação e workspace com 6 etapas (Entrada, Risco, Lastro, Preço, Aprovação, Liberação)            | `src/features/operations` |
| Carteira      | Títulos adquiridos, atraso, por cedente e por comercial                                                          | `src/features/portfolio`  |
| Comercial     | Metas, carteira, negócios, visitas, funil, comitês e comissões                                                   | `src/features/commercial` |
| Financeiro    | Caixa e fluxo, a pagar e a receber, liberações, extrato, conciliação OFX, contábil, bancos                       | `src/features/finance`    |
| Cadastros     | Pessoas PF/PJ com papéis: cedente, sacado, fornecedor, representante, debenturista, cotista, avalista, prestador | `src/features/registry`   |
| Configurações | Usuários, acessos, empresas, padrões operacionais, políticas, integrações e interface                            | `src/features/settings`   |
| Copiloto      | Resumo diário, Central do Dia, consultas e Mesa Inteligente demonstrativa                                        | `src/features/copilot`    |

## Documentação

- [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md) — camadas, mapa de pastas, estado, vínculos entre módulos, estilos, testes.
- [docs/architecture/PLANO_ESTRUTURA_IA.md](docs/architecture/PLANO_ESTRUTURA_IA.md) — arquitetura, segurança, governança e fases da inteligência assistiva.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — padrões de código.
- [INSTRUCOES.md](INSTRUCOES.md) — roteiro de demonstração.
- [docs/lastro/](docs/lastro/) — pesquisa de mercado, contexto e histórico da evolução do produto.
- [CHANGELOG.md](CHANGELOG.md) — o que mudou em cada versão.

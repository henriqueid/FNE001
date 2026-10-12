# STRATO · Receivables OS

Plataforma operacional de recebíveis para factoring, securitizadora, FIDC e ESC. O produto está na transição de protótipo navegável para aplicação persistente: os dados operacionais de demonstração ainda ficam no navegador, enquanto autenticação própria, usuários, sessões, permissões, alçadas, trilha de decisões e notificações já usam o PostgreSQL privado do Supabase em São Paulo.

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
npm start              # servidor Node de produção
npm run bootstrap:admin # cria a primeira credencial administrativa, uma única vez
npx supabase --help    # comandos da infraestrutura Supabase
```

Copie `.env.example` para `.env.local` e preencha a conexão PostgreSQL server-only. O STRATO não usa mais o Supabase Auth: cadastro, aprovação, login, sessão, departamento, vínculos, permissões e alçadas pertencem ao próprio sistema. Nunca exponha `DATABASE_URL` no navegador.

Para publicação externa, siga [docs/DEPLOY_HOSTINGER.md](docs/DEPLOY_HOSTINGER.md).

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

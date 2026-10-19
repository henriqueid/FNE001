# STRATO · Receivables OS

Plataforma operacional de recebíveis para factoring, securitizadora, FIDC e ESC. O ambiente autenticado usa APIs no servidor e PostgreSQL privado para operações, carteira, financeiro, cadastros, políticas e acesso. A demonstração explícita usa dados fictícios no navegador. Melhorias locais de prontidão e suas verificações estão registradas no [plano de execução](docs/superpowers/plans/2026-10-18-prontidao-operacional.md); a homologação externa continua sendo um requisito para operar com bancos e fornecedores.

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
node scripts/test-postgres-isolated.mjs # SQL/concorrência em cluster novo local, sem DATABASE_URL existente
npm start              # servidor Node de produção
npm run bootstrap:admin # cria a primeira credencial administrativa, uma única vez
npx supabase --help    # comandos da infraestrutura Supabase
```

O teste PostgreSQL isolado exige os binários locais `initdb`/`pg_ctl`; use `STRATO_TEST_PG_BIN` para indicar sua pasta. Ele cria um cluster temporário em porta própria, aplica as migrações versionadas e encerra o cluster ao finalizar. Os papéis/funções mínimos de compatibilidade Supabase no teste não homologam os serviços gerenciados nem as credenciais de produção.

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
- [docs/TOKENOPS.md](docs/TOKENOPS.md) — protocolo para reduzir contexto e medir uso de tokens sem degradar segurança ou qualidade.
- [docs/architecture/PLANO_ESTRUTURA_IA.md](docs/architecture/PLANO_ESTRUTURA_IA.md) — arquitetura, segurança, governança e fases da inteligência assistiva.
- [docs/CONVENTIONS.md](docs/CONVENTIONS.md) — padrões de código.
- [docs/ROTEIRO_VALIDACAO_PILOTO.md](docs/ROTEIRO_VALIDACAO_PILOTO.md) — cenários de aceite, verificações locais executadas e dependências de homologação.
- [INSTRUCOES.md](INSTRUCOES.md) — roteiro de demonstração.
- [docs/lastro/](docs/lastro/) — pesquisa de mercado, contexto e histórico da evolução do produto.
- [CHANGELOG.md](CHANGELOG.md) — o que mudou em cada versão.

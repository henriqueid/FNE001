# STRATO — contexto de continuidade

Este arquivo é o ponto de retomada para Claude Code e outros agentes. Antes de alterar o projeto, leia também `README.md`, `docs/ARCHITECTURE.md`, `docs/CONVENTIONS.md` e `docs/DEPLOY_HOSTINGER.md`.

## Onde paramos

Última atualização: **15/10/2026**, após a correção da persistência e da estabilidade da IA e a publicação integral do estado de trabalho acumulado na branch `main`.

O STRATO é uma aplicação operacional de recebíveis em React 19 + Vite/vinext, com APIs no mesmo processo Node e PostgreSQL privado no Supabase. O tenant produtivo padrão é `strato-demo`. O navegador nunca deve receber `DATABASE_URL`, `OPENAI_API_KEY` ou credenciais administrativas.

## Estado funcional atual

- Autenticação, sessões, permissões, empresas, cadastros, operações, carteira, financeiro, comercial, tarefas, políticas, integrações e parâmetros operacionais possuem persistência server-side em diferentes níveis de maturidade.
- O Copiloto usa a OpenAI Responses API somente para interpretação e síntese. Cálculos, elegibilidade, preço, alçadas e movimentações financeiras continuam determinísticos.
- Licença, ativação, estado, orçamento e consumo da IA agora são persistidos por tenant em `private.intelligence_states`.
- Abrir a tela de Inteligência e IA não dispara mais um teste automático de conexão. O teste é explícito, evitando oscilações de estado por falhas transitórias.
- Atualizações assíncronas da IA usam setters funcionais para não sobrescrever orçamento, licença ou consumo alterados enquanto uma requisição estava em andamento.
- A migração `20261015043300_persist_intelligence_configuration.sql` já foi aplicada ao projeto Supabase de produção STRATO.
- O lote atual também consolida melhorias em gestão por exceção, delegação de decisões, métricas da home, validações de lastro, preço, risco e parâmetros cadastrais.

## Arquivos centrais da correção de IA

- `app/api/intelligence/state/route.ts` — leitura e gravação autenticada da configuração.
- `src/server/intelligence/repository.ts` — repositório PostgreSQL privado.
- `src/app/intelligence-client.ts` — cliente da API de estado e da conexão OpenAI.
- `src/app/strato-app.tsx` — carga inicial e persistência serializada/debounced.
- `src/features/settings/ai-configuration-panel.tsx` — teste manual e apresentação do estado.
- `src/domain/intelligence/model.ts` — modelo e validação server-side.
- `tests/intelligence-state.test.ts` — cobertura de validação e orçamento.

## Banco e segurança

- Projeto Supabase de produção: `STRATO` (`uxiftdglkajfexpqelzu`), região São Paulo.
- As tabelas de negócio ficam no schema `private`, com RLS forçada e sem grants para `public`, `anon` ou `authenticated`.
- O aplicativo acessa o PostgreSQL somente no servidor por `DATABASE_URL`.
- A autorização das APIs deve continuar usando a sessão interna (`sessionPrincipal`) e permissões do STRATO; não confiar em tenant ou usuário enviados no corpo.
- Migrações ficam em `supabase/migrations/`. Não recriar ou renomear migrações já aplicadas.

## Produção

- URL: `https://strato.2.25.193.82.sslip.io`
- Servidor SSH configurado localmente com o alias `servidor`.
- Aplicação: `/srv/strato/app`
- Serviço: `strato.service`
- Usuário do processo: `strato`
- Proxy: Caddy → `127.0.0.1:3002`
- Variáveis secretas ficam somente em `/srv/strato/app/.env`; nunca versionar esse arquivo.

Fluxo seguro de publicação:

1. Validar localmente com `npm run check`, `npm run build` e, quando aplicável, `npm run audit:production`.
2. Publicar `main` no GitHub.
3. No servidor, confirmar que `/srv/strato/app` está limpo e executar como usuário `strato`: `git pull --ff-only origin main`, `npm ci` e `npm run build`.
4. Reiniciar com `systemctl restart strato.service`.
5. Confirmar `systemctl is-active strato.service`, `http://127.0.0.1:3002/api/health` e a URL pública `/api/health`.

## Como retomar

Ao receber a pergunta “onde paramos?”, responda com este resumo e depois confira o estado real antes de prometer qualquer coisa:

1. `git status --short` e `git log -5 --oneline --decorate`.
2. Testes/build atuais, sem confiar apenas neste documento.
3. Migrações locais versus Supabase antes de criar nova DDL.
4. Saúde do serviço e logs recentes se o assunto for produção.

## Pendências conhecidas

- A chave OpenAI está configurada no servidor produtivo, mas não no `.env.local`; o desenvolvimento local mostra “Credencial ausente” até receber uma chave própria.
- O status de disponibilidade da IA é validado manualmente na tela. Falhas de resposta do Copiloto não devem apagar licença ou orçamento.
- Os avisos globais dos advisors do Supabase sobre tabelas privadas sem policies são esperados neste desenho: o schema é privado, os grants públicos foram revogados e o acesso ocorre pelo servidor. Ainda assim, revisar qualquer novo aviso de nível `WARN` ou `ERROR`.
- Não remover nem reformatar alterações de domínio sem confirmar o impacto cruzado: operação, carteira, financeiro, cadastro, home e Copiloto compartilham modelos.

## Critério de encerramento de qualquer próxima tarefa

- Preservar alterações não relacionadas.
- Adicionar ou atualizar testes para regressões.
- Rodar verificação completa imediatamente antes de commit/deploy.
- Registrar no `CHANGELOG.md` e atualizar este arquivo quando o ponto de retomada mudar materialmente.

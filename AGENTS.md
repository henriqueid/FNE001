# STRATO — instruções para agentes

O STRATO é uma plataforma operacional de recebíveis. Preserve segurança, rastreabilidade e regras determinísticas de negócio.

## Fontes canônicas

- Leia este arquivo primeiro.
- Consulte `README.md` para comandos e mapa geral.
- Abra `docs/ARCHITECTURE.md` e `docs/CONVENTIONS.md` somente quando a tarefa tocar arquitetura ou código.
- Consulte `CLAUDE.md` para continuidade, produção, banco ou inteligência assistiva.
- Use `docs/TOKENOPS.md` para tarefas amplas, pesquisas externas, decisões duráveis ou medição de tokens.

## TokenOps obrigatório

1. Comece pelo pedido, `git status --short` e pelos arquivos diretamente envolvidos; amplie o contexto apenas por uma pergunta concreta.
2. Pesquise com consultas estreitas e abra apenas resultados relevantes. Prefira fontes primárias e registre a origem de afirmações externas importantes.
3. Defina o menor escopo que satisfaz o pedido. Não refatore, atualize dependências, publique, migre banco nem altere contratos fora dele.
4. Preserve segurança e qualidade mesmo quando custarem mais contexto. Nunca exponha segredos; valide autorização, tenant, permissões e limites server-side.
5. Execute primeiro os testes diretamente ligados à mudança. Rode `npm run check` antes de commit, publicação ou quando o risco cruzado justificar.
6. Resuma resultados, não transcrições: decisão, arquivos, evidência, riscos e pendências. Não cole saídas extensas quando contagens e linhas relevantes bastarem.
7. Trate `docs/ARCHITECTURE.md` e decisões já registradas como contratos. Se uma mudança arquitetural for aprovada, atualize a fonte canônica com motivo e impacto; não crie uma segunda verdade.
8. Não prometa economia de tokens sem benchmark comparável. Meça conforme `docs/TOKENOPS.md` e reporte também qualidade, retrabalho e cobertura de verificação.

## Limites invariantes

- Não altere lógica de negócio sem pedido explícito e teste direcionado.
- Preserve mudanças não relacionadas do usuário.
- Cálculos, elegibilidade, preço, alçadas e movimentações financeiras permanecem determinísticos e auditáveis.
- O navegador nunca recebe `DATABASE_URL`, `OPENAI_API_KEY` ou credenciais administrativas.
- Migrações aplicadas não são recriadas nem renomeadas.


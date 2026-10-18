# Copiloto: execução da arquitetura aprovada

Autorização: usuário aprovou em conversa os fluxos de dados, comportamento, aprendizado e análise em tela em 18/10/2026.

## Contratos

- Dados oficiais e cálculos no servidor, com escopo por tenant, empresa e permissão do módulo.
- Rankings por documento, saldo em aberto, data São Paulo e conjunto completo; limites apenas na apresentação.
- Eventos existentes continuam nas fontes canônicas; comportamento os projeta com proveniência. Novas anotações e correções são append-only e privadas por padrão.
- Aprendizado deriva de evidências atuais, separa declaração de fato, permite revisão e expiração; nunca altera regra ou alçada.
- Nenhum acesso externo para enriquecimento. Indicadores financeiros ficam limitados a uma lista explícita; conectores não configurados retornam indisponibilidade.
- Resumo e Ver mais compartilham snapshot persistido, com reautorização antes de recuperar.
- Sem publicação, aplicação de migração remota, commit ou alteração de estados financeiros nesta execução.

## Etapas

- [x] Testar e implementar consulta tipada: concentração, vencidos por quantidade/valor, resumo e filtros explícitos.
- [x] Carregar fontes completas autorizadas no servidor e integrar a rota existente sem remover orçamento server-side.
- [x] Projetar confirmações, cobranças, observações e decisões existentes; testar aprendizado por resultados e isolamento.
- [x] Persistir respostas e eventos novos em tabelas privadas; endpoints autenticados e revisão controlada.
- [x] Integrar conversa, feedback e tela Ver mais com fontes, tabelas, comportamento e aprendizado.
- [x] Testar bordas, permissões e ausência de fontes externas; executar check/build e revisão.
- [x] Atualizar arquitetura, changelog e continuidade com limites verificados.

## Registro

- Ruling: execução no checkout atual para integrar mudanças já presentes; não criar worktree que perderia alterações não commitadas necessárias (orçamento e operação).
- Ruling: aprendizado inicial por memória e regras explicáveis, sem treino de modelo nem promoção de texto livre a fato. Correções revisadas podem orientar intenção; novos fatos exigem alteração na fonte oficial.
- Ruling: migração preparada e validada localmente; ambiente publicado só recebe esquema e código mediante autorização de publicação.
- Revisão independente: corrigidos reautorização de políticas sem operações, perda de filtros em continuação/atualização, troca e limpeza de documento nominal, filtros no caminho local e confusão entre histórico de atraso e concentração atual.
- PostgreSQL isolado (PGlite 0.5.10, ferramenta de teste em output ignorado, sem alterar dependências da aplicação): seis verificações de execução da migração, persistência, privacidade, revisão/revogação, imutabilidade e grants/RLS.
- Navegador: resumo, abertura de Ver mais, abas, anotação privada e largura móvel verificados com fixture local sem chamadas de negócio reais; fonte de dados do fixture é demonstrativa e não valida produção.
- Verificação final: `npm run check` aprovado (118 arquivos de teste aprovados; 657 testes aprovados, 12 ignorados em 3 arquivos). `npm run build` aprovado e diff dos arquivos envolvidos sem erros de whitespace. Revisão independente final sem P1/P2 nos caminhos corrigidos. Publicação e aplicação remota da migração não realizadas.

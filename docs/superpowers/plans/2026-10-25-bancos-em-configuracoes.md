# Bancos e remessas em Configurações

**Objetivo:** centralizar cadastro e edição de contas/remessas em Configurações; Financeiro lista contas sem edição.
**Arquitetura:** reutilizar BanksTab com modo de consulta por padrão e modo de gestão somente em Configurações. Mesmo estado FinanceState, persistência e validações atuais; autorização settings:manage preservada. Atalhos abrem diretamente a nova seção, mantendo recorte de empresa.
**Stack:** React, TypeScript, CSS existente, Vitest.

- [x] Testar lista financeira sem ações de cadastro/edição e modo de gestão com ações; preservar escopo e informações.
- [x] Adicionar seção Bancos e remessas a SettingsModule e conectar estado/persistência existentes em StratoApp.
- [x] Redirecionar atalhos de cobrança/baixa para a seção de configurações. Restringir atalhos conforme permissão existente.
- [x] Agrupar formulário em dados da conta, finalidades, remessa e opções avançadas; preservar valores, regras e campos obrigatórios.
- [x] Validar testes direcionados, check completo, build e navegação visual desktop/celular.

## Validação

- Três testes novos falharam antes da implementação e passaram depois; bateria direcionada: 15 testes aprovados.
- `npm run check`: 735 testes aprovados, 14 ignorados; typecheck, lint e formatação aprovados. Builds do produto e da prévia aprovados.
- Prévia: consulta financeira sem edição; atalho para configuração; filtro por empresa; validação de cadastro vazio dentro do modal; erro limpo ao abrir outro editor.
- Celular 360 px: formulário com 340 px, sem transbordamento; botões acima da navegação inferior e Cancelar retorna a Configurações.
- Revisão independente sem achados acionáveis. Sem commit ou publicação.

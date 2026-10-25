# Validação visual do STRATO

Prévia do aplicativo completo, com componentes reais e dados fictícios. Não conecta banco nem publica. A demonstração salva alterações no `localStorage` deste endereço; recarregar não apaga os dados. A opção Restaurar demonstração reinicia essa base local.

```bash
npx vite --config tools/design-preview/vite.config.mjs --configLoader native
```

Abrir `http://127.0.0.1:5174/`. **Original** e **Refinado** alternam a aparência preservando módulo, filtros e seleção. Links: `?design=original` e `?design=refined`. **Acesso** abre login e solicitação de acesso para conferir a apresentação; autenticação real exige servidor configurado. **Empresa** abre o cadastro inicial para conferência visual, sem exigir criar uma empresa.

Visão geral, Operações, Controladoria, Carteira, Comercial, Financeiro, Cadastros e Configurações usam o mesmo `StratoApp` do produto. O servidor isolado da prévia não implementa APIs: consultas de sessão, provedor de IA, governança de integrações e outros recursos dependentes do backend podem exibir indisponibilidade. Não usar essa prévia para homologar autenticação, permissões, pagamentos ou integrações externas. O produto mantém tema claro fixo; esta entrega não habilita seleção de tema escuro.

Refinamento aprovado incorporado ao produto. Tokens em `app/styles/design-system.css`; regras compartilhadas em `app/styles/ledger.css`; particularidades de acesso, cadastro inicial e governança nos respectivos CSS Modules, sob `.st-refined`. O layout ativa esse escopo globalmente. `refinements.css` contém apenas a barra de comparação. Não duplicar estilos do produto aqui.

Inventário, evidências e limites: [cobertura visual](../../docs/COBERTURA_VISUAL.md).

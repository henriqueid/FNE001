# Cobertura visual — refinamento STRATO

Data: 22/10/2026. Acabamento original preservado, superfícies neutras, navegação ativa preta, azul nas ações primárias/foco e cores semânticas mantidas. Aplicação global por `.st-refined`; a prévia usa o aplicativo completo e os mesmos estilos do produto.

## Inventário auditado

| Área | Cobertura de apresentação no código e navegação da demonstração |
| --- | --- |
| Visão geral | Gestão, Operação, Risco e cobrança; KPIs, gráficos, radar, filtros e agenda |
| Operações | Central em lista/Kanban, filtros e filas; nova operação; seis etapas do workspace; histórico/bloqueio de etapa; risco, lastro e liberação ativos; diálogo de cancelamento |
| Controladoria | Painel, Checagem, Formalização, Conciliação, Auditoria e Relatórios |
| Carteira | Central de cobrança com seis recursos; Títulos, Por cedente, Por comercial e Atraso; cinco abas do detalhe do título |
| Comercial | Nove seções: Painel, Agentes e gerentes, Carteiras, Negócios realizados, Contas novas, Visitas, Funil, Comitês e Comissões |
| Financeiro | Oito seções: Caixa e fluxo, A pagar e a receber, Liberações, Cobrança, Extrato, Conciliação, Contábil e Bancos; formulário de lançamento |
| Cadastros | Nove papéis; oito seções do editor de pessoa, incluindo contrato, parâmetros, limites e conformidade |
| Configurações | Oito assuntos: Visão geral, Acesso, Empresas, Padrões, Políticas, Integrações, Inteligência e Interface; catálogo e criação de política |
| Componentes auxiliares | Busca global e vazio, alertas, menu do usuário/empresas, resumo diário, Central do Dia e copiloto; login, solicitação de acesso e cadastro inicial de empresa |

Auditoria estática incluiu famílias próprias de cartões, tabelas, filtros, botões, modais, formulários desabilitados, confirmação e exclusão. Correções específicas alcançam CSS Modules de autenticação, cadastro inicial de empresa e governança de integrações. Regras de negócio e operações financeiras permanecem inalteradas.

## Evidência executada

- 116 registros de tela/estado em demonstração local, com cabeçalhos e medidas do documento.
- Oito módulos principais conferidos em 360 e 768 px; abas e detalhes registrados em 1440 px. Acesso, cadastro inicial de empresa, risco, cancelamento e detalhe de título também exercitados em 360 px.
- Nenhum registro válido apresentou largura do documento maior que a viewport. Tabelas e faixas de abas podem rolar dentro do próprio contêiner.
- Corrigido corte de números no KPI móvel e contraste dos cabeçalhos do copiloto, resumo diário e Central do Dia. Caixas de seleção de permissões mantêm dimensões próprias, sem altura de campos textuais.
- Corrigida referência instável da lista de empresas: a restauração de estado dependia dessa lista e entrava em ciclo na demonstração completa. Navegação validada após memoização.
- `npm run check`: typecheck, lint, formatação; 732 testes aprovados e 14 ignorados.
- Build do produto e build da prévia aprovados. Prévia mantém aviso de tamanho de alguns chunks; sem alteração de dependências ou arquitetura para eliminá-lo.

Capturas e `registros.json` estão no artefato local desta sessão: `/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/coverage/`.

![Visão geral refinada](/Users/henriquemoura/.codex/visualizations/2026/10/20/01a159c2-b9f0-7ec1-8203-373bdba3f12c/coverage/validacao-final.png)

## Limites da validação

Cobertura global de estilos e navegação dos módulos não significa testar todas as combinações de dados, permissões, filtros e estados transitórios. Não foram confirmados pagamentos, alterações de alçada, decisões de crédito, chamadas a fornecedores nem gravações autenticadas nesta auditoria visual.

A prévia isolada não possui APIs. Estados de sucesso de login/cadastro, conclusão do cadastro inicial, governança real e integrações exigem ambiente com servidor e dados de homologação; podem mostrar erro de indisponibilidade na prévia. A aparência desses componentes foi auditada no código quando não alcançável em demonstração. Tema escuro não foi homologado: o produto mantém tema claro fixo, apesar dos tokens alternativos existentes.

Mudanças permanecem locais, sem commit ou publicação.

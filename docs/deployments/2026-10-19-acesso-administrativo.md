# Correção de acesso administrativo · 19/10/2026

Solicitação: administrador com acesso completo e edição funcional de permissões de usuários durante o teste da produção. Henrique já possuía as 13 permissões; mensagem de liberação era genérica. Diretório exigia segundo administrador para alterações críticas e ocultava erros do autosave.

Administrador ativo recebe catálogo completo de permissões, inclusive no cadastro legado; edição direta depende do ator vigente carregado do banco, preserva vínculo ao tenant, escopos empresariais e auditoria. Operadores não podem se promover enviando um perfil administrativo. UI usa Salvar acessos com confirmação no servidor, feedback de erro e rascunho preservado em falha. Sem migrações ou alteração direta de usuários reais.

Verificação: check aprovado (695 testes, 14 ignorados), build aprovado. Runner isolado: 39 migrações, 13 testes PostgreSQL e 2 documentos; restauração 74 tabelas/1.018 linhas e HTTP autenticado aprovados. Evidência local: C:/Users/henri/AppData/Local/Temp/strato-isolated-pg-MkmGyO.

Publicado código 4f96d0f em /srv/strato/app. Instalação e build remoto aprovados, serviço ativo, saúde interna e pública ok. Página inicial HTTP 200; diretório sem sessão HTTP 401. Revisão independente aprovada após corrigir o envio de perfis antigos: somente o usuário editado é enviado, sem restaurar concessões revogadas de terceiros. Teste autenticado pela interface com usuário real permanece para a sessão do usuário.

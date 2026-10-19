# Publicação do STRATO na Hostinger

## Arquitetura de produção

- Hostinger executa o servidor Node.js do STRATO.
- Supabase hospeda somente o PostgreSQL privado na região de São Paulo.
- O navegador nunca recebe senha, chave administrativa ou string de conexão do banco.
- O login é próprio do STRATO, com cookie `HttpOnly`, senha derivada com PBKDF2 e sessão opaca.

## Variáveis do servidor

Cadastre no ambiente da aplicação:

```text
NEXT_PUBLIC_STRATO_TENANT_ID=strato-demo
DATABASE_URL=<Session pooler do Supabase, porta 5432>
DATABASE_POOL_SIZE=5
DATABASE_SSL=require
```

Na tela **Connect** do projeto Supabase, escolha **Session pooler**. Essa opção funciona em redes IPv4 e é apropriada para um servidor Node persistente. Codifique caracteres especiais da senha na URL.

## Comandos da aplicação

```text
Instalação: npm ci
Build:      npm run build
Início:     npm start
Node.js:    22 ou superior
```

Depois da publicação, `GET /api/health` deve responder `{"status":"ok"}`.

## Primeira senha administrativa

O banco já contém o perfil administrativo, mas a primeira senha deve ser criada fora da interface pública. No terminal seguro do projeto, configure temporariamente:

```text
STRATO_BOOTSTRAP_ADMIN_EMAIL=henriquemdsid2@gmail.com
STRATO_BOOTSTRAP_ADMIN_PASSWORD=<senha forte temporariamente no ambiente>
```

Execute `npm run bootstrap:admin` uma única vez. Em seguida, remova imediatamente `STRATO_BOOTSTRAP_ADMIN_PASSWORD` do ambiente e reinicie a aplicação. O comando se recusa a executar quando já existe qualquer credencial, evitando redefinição silenciosa do administrador.

## Validação final

As melhorias locais de 18/10/2026 não foram publicadas por esta execução. Antes de usá-las no piloto, execute o roteiro de validação, confirme as migrações previstas contra um PostgreSQL **isolado**, e só depois aplique o processo de publicação autorizado. Testes com adaptadores de banco não comprovam execução do SQL em PostgreSQL.

### Documentos privados e recuperação

Configure `STRATO_DOCUMENTS_DIR` com caminho absoluto para um volume privado persistente. Sem a variável, o processo usa `.strato/documents` no diretório do usuário do serviço; isso exige o mesmo cuidado de persistência. O volume não pode ficar em `public/`, em diretório temporário ou dentro de um artefato de build descartável. Todas as instâncias precisam acessar os mesmos bytes e manifestos. O usuário do serviço precisa de leitura/escrita; clientes HTTP não recebem caminhos de disco.

O backup precisa abranger o PostgreSQL e o volume de documentos no mesmo ponto de recuperação. Preserve bytes e manifestos sem renomear IDs. Um backup só fica homologado após restaurar ambos em ambiente isolado, entrar com usuário de teste, recuperar anexos existentes e conferir o hash SHA-256 armazenado. Teste também a recusa de acesso por outro tenant/empresa e registre data, responsável e evidências da restauração. Não copie credenciais produtivas para logs ou relatórios.

### Integrações e infraestrutura do piloto

- Itaú e Bradesco: CNAB400 confirmado pelo usuário. Carteira, convênio, emissão pelo cliente, juros, beneficiário e sequência precisam coincidir com o contrato. Siga [integrations/CNAB400.md](integrations/CNAB400.md), conserve os bytes emitidos e homologue remessa/retorno no ambiente do banco antes de movimentação real. Ocorrências não implementadas e tarifas sem contabilização configurada são bloqueadas explicitamente.
- Bureau e assinatura eletrônica: fornecedor não informado. Configuração ativa não é evidência de consulta ou de assinatura. O anexo manual tem armazenamento privado, sem representar homologação de provedor.
- IA: o contador pertence à competência UTC `AAAA-MM`; a primeira leitura autorizada ou reserva de um mês novo abre a competência automaticamente, em transação. A adoção inicial preserva o consumo legado no mês corrente. `private.domain_events` registra abertura mensal, reserva por chamada e liquidação com ator da sessão; nenhuma migração adicional é exigida. A reserva é confirmada antes da chamada e falha/timeout/consumo ausente conservam seu débito. A liquidação é idempotente em armazenamento e uma reserva de mês anterior nunca desconta o contador do mês novo. O consumo enviado pelo navegador é ignorado. Reservas incertas continuam retidas: não há expiração automática, interface administrativa de reconciliação ou autorização para editar contadores manualmente. Homologue a reconciliação com evidência do provedor antes de liberar valores incertos.
- PWA: exige HTTPS para instalar o worker. O modo offline oferece aviso estático e não executa operações financeiras. Dados, APIs e documentos não devem ser incluídos no cache do worker.
- Notificações: `STRATO_OUTBOX_WORKER_ENABLED=true` ativa processamento no Node a cada `STRATO_OUTBOX_INTERVAL_MS` (padrão 30 segundos). O publicador usa a mesma regra determinística da API, transação e bloqueio por tenant; ciclos do mesmo processo não se sobrepõem. Não requer navegador aberto. Ative após homologar notificações e recuperação de falhas; falhas permanentes continuam na fila de revisão, sem repetição infinita. A execução local desta melhoria não ativou o worker no ambiente produtivo.

1. Abra `/api/health` e confirme `status: ok`.
2. Entre com o administrador inicial.
3. Crie um usuário de teste em **Configurações > Usuários e acessos**.
4. Defina departamento, função, empresas, permissões, alçadas e vínculo comercial/gerencial.
5. Aprove o usuário e teste o acesso em uma janela anônima.
6. Registre uma decisão e confirme que a Central do Dia recebe a notificação.

### Recuperação local verificada em 18/10/2026

Executado por agente Codex no ambiente local Windows em **18/10/2026, 06:22:01 UTC** (03:22:01 em Brasília), sem ler `DATABASE_URL` existente nem acessar ambiente remoto. O runner `node scripts/test-postgres-isolated.mjs` cria um cluster PostgreSQL descartável em porta local própria, aplica as 39 migrações e executa testes reais de persistência. `STRATO_TEST_PG_BIN` permite indicar os binários PostgreSQL 18; `STRATO_TEST_PG_FILES` seleciona somente arquivos permitidos da suíte isolada.

Após os testes, o runner gera um arquivo com [`pg_dump` em formato custom](https://www.postgresql.org/docs/18/app-pgdump.html), cria **outra base**, `strato_restored`, dentro do mesmo cluster temporário e usa [`pg_restore --single-transaction --exit-on-error`](https://www.postgresql.org/docs/18/app-pgrestore.html). O cluster é encerrado no bloco de limpeza mesmo em falha. Não existe comando para restaurar sobre uma base produtiva ou reutilizar o banco configurado na aplicação.

Resultado desta execução: **5 testes PostgreSQL bancários/devolução e 2 testes reais de restauração de documentos passaram**; **74 tabelas e 575 linhas** apresentaram contagens e SHA-256 idênticos antes/depois. Também coincidiram os metadados de RLS, grants de tabelas e schemas, restrições, triggers, funções, índices e sequências. A base restaurada negou SELECT dos estados financeiros e eventos às roles públicas anon/authenticated.

| Evidência comparada   | Linhas |
| --------------------- | -----: |
| Estados financeiros   |      5 |
| Estados da Carteira   |      3 |
| Eventos de domínio    |     47 |
| Lançamentos do diário |     14 |
| Partidas do diário    |     35 |

SHA-256 do arquivo de backup desta execução: `87c08284fa16976a39b32f2c78b3ddb375499efdea9a78ffeca0891b5654b8b0`. SHA-256 dos metadados de segurança/schema: `7fc77b0484f2afa8699c41813032236c14e1a0f8c01582f7ef4df13f981f87e6`.

As evidências locais ficaram em `C:\Users\henri\AppData\Local\Temp\strato-isolated-pg-qed0hU`: `database.backup`, `recovery-before.json`, `recovery-after.json`, `recovery-evidence.json`, `document-recovery-evidence.json` e cópias do volume de documentos. Os manifestos contêm contagens/hashes por tabela; não imprimem linhas do banco nem credenciais. Novas execuções produzem outros IDs, hashes e diretórios; conserve o conjunto completo de cada execução fora do repositório conforme a política de retenção.

O teste do volume preservou **2 documentos/4 arquivos** (bytes e manifestos), removeu somente o subdiretório original pertencente à fixture temporária e recuperou os mesmos IDs, bytes, proveniência e SHA-256 em outro diretório. A API de armazenamento recusou tenant, operação ou empresa divergentes, ausência de permissão de leitura/escrita e adulteração de conteúdo/manifesto. SHA-256 do manifesto desse volume: `34cd44f72ae15d2c5436265fa486dc62405ba946b693cf66ee7ace7874097e8e`. As regressões do comparador também recusam tabelas ausentes e alterações de contagem, conteúdo ou segurança.

**Complemento de verificação:** em nova execução local, o runner restaurou 74 tabelas/896 linhas e executou login HTTP com credencial aleatória preparada antes do dump. O build de produção foi iniciado diretamente em loopback, com conexão explícita à base `strato_restored`, worker/IA desabilitados e sem carregar `.env`. Login, cookie HttpOnly/SameSite, leitura autenticada de Financeiro/Operações, recusas sem sessão/em tenant sem vínculo e revogação por logout passaram. Servidor e cluster encerrados. Evidências em `C:/Users/henri/AppData/Local/Temp/strato-isolated-pg-wECHxU/restored-http-evidence.json`. O runner agora exige `npm run build` antes da execução; não exponha senha/cookie temporários em logs.

**Limites:** trata-se de recuperação local de fixtures, não homologação do backup de produção. Banco e volume foram verificados em testes distintos, sem comprovar um ponto de recuperação coordenado de dados produtivos. A restauração no mesmo cluster reutiliza roles já criadas: não valida recuperação de roles globais, extensões em outra instalação, configurações do serviço ou segredos produtivos. Login HTTP local foi verificado, mas TLS, navegador e jornada completa da operação continuam por homologar. ACLs Windows não foram homologadas; os testes verificam modos privados POSIX quando executados nessa plataforma, ainda a validar no servidor Linux. Também permanecem pendentes retenção externa/cifrada, recuperação fora da máquina, RPO/RTO medidos e ensaio com responsáveis operacionais. Não extrapolar os hashes ou o tempo do ensaio local para garantias produtivas.

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

1. Abra `/api/health` e confirme `status: ok`.
2. Entre com o administrador inicial.
3. Crie um usuário de teste em **Configurações > Usuários e acessos**.
4. Defina departamento, função, empresas, permissões, alçadas e vínculo comercial/gerencial.
5. Aprove o usuário e teste o acesso em uma janela anônima.
6. Registre uma decisão e confirme que a Central do Dia recebe a notificação.

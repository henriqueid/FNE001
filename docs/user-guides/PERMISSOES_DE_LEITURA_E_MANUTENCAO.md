# Permissões de leitura e manutenção

O STRATO separa a capacidade de consultar dados da capacidade de alterá-los. Essa divisão permite que um usuário use informações necessárias ao trabalho sem receber acesso administrativo.

## Cadastro

- `registry:view`: consultar pessoas e evidências cadastrais;
- `registry:edit`: criar e atualizar cadastros.

## Empresa e políticas

- `settings:view`: consultar dados institucionais e políticas efetivas usadas pelos motores;
- `settings:manage`: alterar configurações, publicar políticas e administrar parâmetros.

A tela completa de Configurações continua reservada aos administradores porque ainda contém controles editáveis. Os demais perfis recebem somente a leitura necessária pelas APIs operacionais.

## Comercial

A permissão funcional é combinada com o vínculo do usuário ao executivo ou gerente de conta. Um executivo não recebe registros de outras carteiras, mesmo que tente alterar a requisição no navegador.

## Como revisar um acesso

1. Abra **Configurações > Usuários e acessos**.
2. Confirme a área principal e as funções acumuladas.
3. Revise empresas/veículos permitidos.
4. Para o Comercial, informe o identificador do agente e/ou do gerente de conta.
5. Conceda manutenção somente quando a função exigir alteração de dados.

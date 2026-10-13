# Operações persistentes — guia de uso e conferência

## O que muda para o usuário

No ambiente real, uma operação criada ou alterada passa a ser gravada no banco da organização. Ela deixa de depender do navegador e pode ser retomada em outro computador por um usuário autorizado.

A demonstração continua separada: seus dados fictícios permanecem somente no navegador e podem ser restaurados sem afetar a operação real.

## Como usar

1. Entre no ambiente real com seu usuário.
2. Crie uma operação ou abra uma operação existente.
3. Faça a alteração necessária e conclua a ação na etapa correspondente.
4. Aguarde a tela permanecer sem aviso de falha de gravação.
5. Reabra a operação ou atualize a página para confirmar a posição salva.

## Proteção contra trabalho simultâneo

Cada gravação recebe uma versão. Se outra pessoa salvar a mesma operação antes de você, o STRATO recusa a sobrescrita e informa que a tela precisa ser atualizada. Assim, a alteração mais recente não é apagada silenciosamente.

Quando isso acontecer:

1. copie qualquer justificativa ainda não registrada, se necessário;
2. atualize a tela;
3. confira a alteração feita pela outra pessoa;
4. reaplique somente o que ainda fizer sentido.

## O que fica registrado

- usuário responsável pela gravação;
- data e hora;
- versão do agregado;
- criação, mudança de etapa, mudança de status ou atualização;
- etapa e status resultantes;
- evento pendente de publicação para os demais processos.

O histórico é imutável: correções geram uma nova versão, não apagam o que ocorreu.

## Conferência operacional

Para homologar esta entrega, use dois usuários em navegadores diferentes:

1. os dois abrem a mesma operação;
2. o primeiro altera e salva;
3. o segundo tenta salvar sua cópia antiga;
4. o segundo deve receber o aviso de concorrência;
5. após atualizar, ambos devem visualizar a mesma versão;
6. sair e entrar novamente não pode apagar a operação.

## Em caso de aviso de falha

Não continue acumulando alterações na mesma operação. Registre o horário e o identificador da operação, preserve as informações digitadas e acione o responsável técnico. O aviso diferencia conflito de edição de indisponibilidade do banco.

## Limite desta primeira entrega

Os títulos ainda estão contidos no agregado da operação. A próxima tarefa cria o recebível como entidade própria, com identidade, deduplicação, vínculo fiscal e projeção para Carteira.

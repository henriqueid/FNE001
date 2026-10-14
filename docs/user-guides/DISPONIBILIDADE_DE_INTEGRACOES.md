# Disponibilidade de integrações

Este guia explica como o STRATO apresenta e executa fontes externas no ambiente real.

## O que cada estado significa

- **Fonte pública ativa:** o servidor está autorizado a consultar uma fonte pública, sem tratá-la como fonte oficial ou institucional.
- **Integração institucional ativa:** há um provedor contratado/homologado e sua configuração está ativa no servidor.
- **Indisponível:** a configuração existe, mas foi degradada ou suspensa; novas chamadas externas são bloqueadas.
- **Não configurada:** ainda não há provedor ativo para a capacidade.
- **Demonstração:** somente no ambiente demonstrativo, com dados fictícios claramente identificados.

A BrasilAPI é uma fonte pública. Ela ajuda no preenchimento e na conferência operacional, mas não substitui evidência oficial da Receita Federal, de bancos, registradoras ou de outro participante institucional.

## Regra de execução

Antes de chamar qualquer serviço externo, o backend verifica a capacidade necessária e seleciona o provedor ativo pela prioridade configurada. Se não houver provedor ativo, ou se o conector desse provedor ainda não existir no STRATO, a chamada é recusada sem consultar a internet.

Resultados CNPJ ainda válidos que já estejam armazenados podem ser reutilizados mesmo se o provedor for posteriormente suspenso. Uma atualização forçada exige provedor ativo.

## Segurança

- o navegador recebe apenas provedor, capacidade, estado, tipo da fonte, rótulo e data de atualização;
- o conteúdo técnico de `config` e qualquer futura referência de credencial permanecem no servidor;
- a tabela de configuração fica no schema privado, com acesso direto dos clientes revogado;
- ativar, suspender ou trocar provedores ainda é uma ação de implantação. A administração maker-checker desse cadastro continua como próxima evolução.

## Tratamento de falhas

Quando uma consulta for recusada ou falhar:

1. confirme em **Configurações > Integrações** se a fonte aparece ativa;
2. não interprete uma fonte pública como confirmação oficial;
3. preserve a evidência já registrada e tente novamente somente quando necessário;
4. encaminhe indisponibilidade recorrente ao responsável técnico, informando empresa, capacidade e horário.

## Capacidades públicas atualmente governadas

- consulta cadastral por CNPJ;
- preenchimento por CEP;
- diretório de bancos;
- calendário de feriados;
- diretório de participantes Pix.

As demais integrações do catálogo permanecem não configuradas até contratação, homologação e implementação do conector correspondente.

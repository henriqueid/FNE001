# Correções do dossiê Churume

Autorização: pedido do usuário para executar todos os ajustes do relatório de 25/10/2026. Escopo: C01–C07, usabilidade e disponibilidade explícita das rotinas. Preservar mudanças anteriores, não publicar, não usar banco produtivo nem transmitir arquivos.

## Critérios e execução

- [x] C01/C03: regressões de comitê novo aprovado, limite direto e histórico reescrito devem falhar antes da correção; exigir autoridade em toda alteração material e histórico imutável, autoria do servidor.
- [x] C02: comando servidor por competência, Financeiro + Comercial na mesma transação e repetição recuperável; UI sem sequência de duas gravações; regressões de falha parcial, autorização e repetição.
- [x] C04: memória por título reconciliável com líquido total; teste dirigido com IOF/retenção e centavos; preservar fórmula agregada correta.
- [x] C05: conversão demonstrativa gera ficha sem sobrescrever cadastro existente; atalho dá feedback quando ficha indisponível; regressão de novo cliente e conservação de ficha.
- [x] C06: prontidão única e bloqueios nominais, preservando autoridade do servidor; teste da operação manual com lastro dispensado e dos requisitos ainda obrigatórios.
- [x] C07: retorno futuro corretamente descrito sem remover atraso/escalonamento legítimos; regressão antes/no dia/depois da promessa.
- [x] UX: campos obrigatórios da entrada e orientação do comitê; distinguir capacidade demonstrativa e real de recompra/CNAB, sem habilitar movimentação sem regra autoritativa.
- [x] F01: investigar contrato e integração de recompra real. Não transformar seleção de demonstração em fonte financeira. Se decisão contábil ausente impedir execução segura, registrar e solicitar definição concreta.
- [x] Verificar testes dirigidos, depois `npm run check`; executar SQL isolado se binários disponíveis, nunca substituir por banco produtivo.
- [x] Revisar diff e comportamento visual; atualizar dossiê com resultado por item e pendências externas sem declarar homologação indevida.

Três frentes independentes delegadas conforme skill de trabalho paralelo: controles comerciais; envio de comissões; consistência da esteira. Integração da aplicação, onboarding, cobrança e conferência final pelo agente principal.

## Resultado e decisão de negócio

Usuário definiu Baixar título Sim/Não: ambos descontam principal; Sim baixa internamente e solicita baixa na próxima remessa; Não mantém cobrança. Implementado com fonte autoritativa, reserva e estorno vinculados. Compensações avulsas e liberação posterior de retenção continuam indisponíveis, explicitadas no dossiê.

Verificação final: `npm run check` 869 aprovados/18 ignorados; build passou; revisão independente e interface executadas. PostgreSQL indisponível localmente, sem substituir por produção. Resultado detalhado: `docs/testing/churume/2026-10-25-correcoes.md`.

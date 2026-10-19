# Gravação de parâmetros operacionais

> Desde 15/10/2026, por decisão do responsável pelo produto, os parâmetros operacionais deixaram de exigir dupla aprovação (maker-checker). A gravação é direta para quem tem permissão `settings:manage`, mantendo versão, idempotência e trilha de auditoria. O nome deste arquivo foi preservado para não quebrar referências.

## Para que serve

Os padrões operacionais definem o que novas operações e clientes herdam: taxas, método de cálculo, prazos, limites, confirmação, concentração, tarifas, reserva, recompra, mora e metas de originação e receita.

## Como alterar

1. Acesse **Configurações → Padrões operacionais** com uma conta que tenha `settings:manage`.
2. Confira a versão efetiva exibida no início da tela.
3. Ajuste somente os valores que precisam mudar e salve.

A alteração entra em vigor imediatamente para novas operações e para os painéis de metas. Usuários com apenas `settings:view` consultam os valores, mas não gravam.

## Controles que continuam valendo

- **Versão otimista:** se outra pessoa salvou antes, a gravação é bloqueada e a tela pede para recarregar a versão atual.
- **Idempotência:** reenviar o mesmo comando devolve o resultado original; reutilizar o identificador com conteúdo diferente é recusado.
- **Auditoria:** autor, horário, versão de origem e versão aplicada ficam registrados, com evento na fila transacional (outbox).

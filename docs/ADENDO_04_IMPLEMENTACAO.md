# Adendo 04 Decisões Alçadas e IA Opcional

## Situação da implementação

O STRATO passou a tratar o motor determinístico, a decisão humana e a IA como capacidades separadas. A primeira fatia vertical do Adendo 04 está implementada no protótipo e preparada para migração ao backend transacional.

## Implementado nesta fase

- contrato append-only para eventos de análise, bloqueio, exceção, condição, formalização, pagamento, promessa e revisão;
- esquema mínimo de decisão com tenant, operação, ator, alçada, política, snapshot, motivos, evidências, validade, condições e correlation id;
- cálculo determinístico de exposição que não desconta promessas ainda não liquidadas;
- autorização de exceção escopada por operação, cedente, política, versão, valor máximo e validade;
- proibição de reutilizar uma autorização em outra operação;
- justificativa humana obrigatória e validação de competência antes de aprovar ou rejeitar uma exceção no Copiloto;
- trilha de decisão visível e somente de acréscimo na análise do Copiloto;
- estados `AI_DISABLED`, `AI_AVAILABLE`, `AI_DEGRADED`, `AI_UNAVAILABLE` e `AI_PROCESSING` por organização;
- configuração administrativa de contratação, ativação, estado operacional e orçamento mensal de IA;
- fallback seguro: sem IA, comandos conversacionais ficam indisponíveis e o motor determinístico continua operacional;
- identificação visual entre resultado do motor de políticas e insight com apoio de IA;
- classificação explícita de apontamentos como fato, regra, tendência, hipótese ou sugestão.

## Já existente e preservado

- políticas e regras versionadas;
- snapshots imutáveis de elegibilidade;
- cenários comparáveis sem sobrescrever versões anteriores;
- fila de exceções por alçada;
- RBAC por perfil, departamento e escopo de empresa;
- formalização e pagamento fora do comando conversacional;
- dados de cadastro, operações, carteira, financeiro e integrações separados por domínio.

## Próxima fatia para produção

1. Persistir decisões e eventos em banco relacional com isolamento por tenant.
2. Criar outbox transacional e idempotency keys no servidor.
3. Mover permissões, alçadas e validações de exceção para APIs autenticadas.
4. Implementar condições precedentes e impedir formalização enquanto estiverem pendentes.
5. Registrar liquidações, promessas e desfechos como eventos compensatórios.
6. Conectar o provedor de IA somente depois de entitlement, orçamento, consentimento e autorização por ação.
7. Executar shadow mode comparando decisão humana, motor, tempo, divergência e desfecho.
8. Adicionar testes de isolamento entre tenants, concorrência, timeout e desligamento da IA.

## Limite desta entrega

A governança está funcional no protótipo e coberta por testes de domínio. A persistência ainda usa o navegador; portanto, a trilha atual demonstra o contrato e o comportamento, mas a garantia de imutabilidade, retenção e segregação exigida para produção será concluída na camada de backend.

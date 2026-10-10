# Adendo 04 Decisões Alçadas e IA Opcional

## Situação da implementação

O STRATO passou a tratar o motor determinístico, a decisão humana e a IA como capacidades separadas. A primeira fatia vertical do Adendo 04 está implementada com persistência da trilha no backend Cloudflare D1.

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
- API de decisões com empresa e ator derivados da sessão recebida pelo servidor;
- persistência D1 com sequência por decisão e índices por tenant, decisão e operação;
- gatilhos de banco que recusam `UPDATE` e `DELETE`, preservando o contrato append-only;
- autorização no servidor para leitura, aprovação de exceção, formalização e confirmação de pagamento;
- bloqueio de acesso cruzado entre tenants antes de qualquer consulta ou gravação.

## Já existente e preservado

- políticas e regras versionadas;
- snapshots imutáveis de elegibilidade;
- cenários comparáveis sem sobrescrever versões anteriores;
- fila de exceções por alçada;
- RBAC por perfil, departamento e escopo de empresa;
- formalização e pagamento fora do comando conversacional;
- dados de cadastro, operações, carteira, financeiro e integrações separados por domínio.

## Próxima fatia para produção

1. Trocar a identidade demonstrativa por autenticação real e sessão assinada.
2. Criar outbox transacional e idempotency keys no servidor.
3. Persistir o catálogo de usuários, vínculos, permissões e alçadas no backend.
4. Implementar condições precedentes e impedir formalização enquanto estiverem pendentes.
5. Registrar liquidações, promessas e desfechos como eventos compensatórios.
6. Conectar o provedor de IA somente depois de entitlement, orçamento, consentimento e autorização por ação.
7. Executar shadow mode comparando decisão humana, motor, tempo, divergência e desfecho.
8. Ampliar testes de concorrência, timeout, recuperação e desligamento da IA.

## Limite desta entrega

A trilha de decisões deixou o navegador e está funcional no D1 local, com imutabilidade e segregação aplicadas no banco e na API. Os demais estados operacionais continuam no navegador. Antes do uso produtivo ainda é necessário implantar o banco no ambiente definitivo e substituir os cabeçalhos da sessão demonstrativa por autenticação real e verificável.

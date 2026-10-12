# Adendo 04 Decisões Alçadas e IA Opcional

## Situação da implementação

O STRATO passou a tratar o motor determinístico, a decisão humana e a IA como capacidades separadas. A primeira fatia vertical do Adendo 04 está implementada com persistência no PostgreSQL privado do Supabase.

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
- API de decisões com empresa e ator derivados de sessão opaca validada pelo servidor;
- persistência PostgreSQL com sequência por decisão e índices por tenant, decisão e operação;
- gatilhos de banco que recusam `UPDATE` e `DELETE`, preservando o contrato append-only;
- autorização no servidor para leitura, aprovação de exceção, formalização e confirmação de pagamento;
- bloqueio de acesso cruzado entre tenants antes de qualquer consulta ou gravação.
- sessão em cookie `HttpOnly`, `SameSite=Strict`, com token opaco e somente seu hash persistido;
- diretório PostgreSQL de usuários, vínculos com o tenant, permissões, escopos empresariais e alçadas formais;
- autorização de decisões a partir da permissão e da alçada persistidas, sem confiar em cabeçalhos de identidade do cliente;
- bootstrap demonstrativo de sessão limitado a `localhost`, recusado fora do ambiente local.
- idempotência no servidor com assinatura canônica do tenant, ator e conteúdo da decisão;
- reenvio seguro que devolve o evento original sem duplicar a trilha;
- outbox PostgreSQL gravada atomicamente com o evento e preparada para publicação assíncrona.
- publicador executado pela sincronização autenticada da interface, com estrutura pronta para agendamento externo;
- entrega deduplicada para a Central do Dia conforme permissão, departamento e alçada;
- repetição com backoff de 1 minuto, 5 minutos, 30 minutos, 2 horas e 6 horas;
- fila de falhas após cinco tentativas, com saúde visível e reprocessamento administrativo;
- resolução automática da notificação quando a decisão recebe seu evento de conclusão.

## Já existente e preservado

- políticas e regras versionadas;
- snapshots imutáveis de elegibilidade;
- cenários comparáveis sem sobrescrever versões anteriores;
- fila de exceções por alçada;
- RBAC por perfil, departamento e escopo de empresa;
- formalização e pagamento fora do comando conversacional;
- dados de cadastro, operações, carteira, financeiro e integrações separados por domínio.

## Próxima fatia para produção

1. Publicar o servidor Node na Hostinger e configurar a conexão segura com o Supabase.
2. Conectar destinos externos reais ao publicador usando adaptadores isolados e assinados.
3. Tornar a gravação do diretório de acesso transacional e registrar somente alterações efetivas.
4. Implementar condições precedentes e impedir formalização enquanto estiverem pendentes.
5. Registrar liquidações, promessas e desfechos como eventos compensatórios.
6. Conectar o provedor de IA somente depois de entitlement, orçamento, consentimento e autorização por ação.
7. Executar shadow mode comparando decisão humana, motor, tempo, divergência e desfecho.
8. Ampliar testes de concorrência, timeout, recuperação e desligamento da IA.

## Limite desta entrega

A trilha de decisões, as credenciais, as sessões e o diretório de acesso deixaram o navegador e agora apontam para o PostgreSQL definitivo, com imutabilidade, segregação, idempotência, outbox transacional e publicação resiliente para a Central do Dia. O servidor Node já gera e inicia sem dependências do Cloudflare. Para uso externo ainda é necessário configurar `DATABASE_URL`, criar a primeira credencial administrativa e publicar na Hostinger. Os demais estados operacionais continuam no navegador.

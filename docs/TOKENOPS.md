# TokenOps — protocolo de eficiência de contexto

## Objetivo

Reduzir tokens processados pelo Codex sem degradar segurança, correção, testes ou preservação das decisões arquiteturais do STRATO. TokenOps orienta como selecionar contexto e evidência; não autoriza atalhos sobre controles do produto.

## Princípios

- **Contexto sob demanda:** cada leitura responde a uma pergunta da tarefa.
- **Menor escopo suficiente:** concluir o pedido sem mudanças oportunistas.
- **Evidência proporcional ao risco:** validar primeiro o caminho alterado e ampliar quando houver impacto compartilhado.
- **Fontes canônicas:** referenciar decisões existentes em vez de duplicá-las.
- **Economia comprovada:** comparar uso, qualidade e retrabalho; nunca estimar ganho percentual por intuição.

## Fluxo operacional

### 1. Enquadrar a tarefa

Antes de explorar, registre mentalmente ou em até cinco linhas:

- resultado pedido;
- arquivos ou área provavelmente afetados;
- não objetivos explícitos;
- risco principal;
- evidência que demonstrará conclusão.

Se o pedido estiver claro, não solicite confirmação redundante. Pare para perguntar somente quando uma escolha mudar materialmente o resultado, a segurança ou o escopo autorizado.

### 2. Carregar contexto em camadas

Use esta ordem e pare assim que houver evidência suficiente:

1. `AGENTS.md`, pedido e estado do Git.
2. Arquivos citados pelo usuário e vizinhos diretos importados ou chamados por eles.
3. Testes correspondentes e documentação canônica aplicável.
4. Busca por símbolo, rota, mensagem ou configuração específica.
5. Documentação externa primária, apenas se o repositório não responder ou se a informação puder ter mudado.

Não faça varreduras amplas por hábito. Prefira lista de arquivos, busca textual e trechos localizados a despejar diretórios ou arquivos inteiros. Arquivos pequenos de instrução podem ser lidos integralmente.

### 3. Controlar o escopo

- Declare os arquivos pretendidos antes de editar quando o trabalho envolver mais de uma área.
- Separe descoberta, implementação e verificação.
- Não misture correções incidentais. Registre-as como pendência curta, sem implementá-las.
- Reavalie o escopo se surgir dependência transversal, migração, mudança de contrato, dado sensível ou ação externa.
- Não faça commit, push, deploy, alteração remota ou destrutiva sem autorização compatível com a tarefa.

### 4. Pesquisa seletiva

- Formule uma pergunta verificável antes de cada pesquisa.
- Use termos específicos do erro, símbolo, versão ou comportamento.
- Para assuntos técnicos, legais, financeiros, de segurança ou sujeitos a mudança, use fontes primárias e atuais.
- Abra a fonte; não fundamente decisões apenas em snippets de busca.
- Encerre a pesquisa quando duas fontes independentes convergirem ou uma fonte canônica responder diretamente.
- Guarde no resumo apenas a conclusão, o link e qualquer incerteza relevante.

### 5. Implementar com segurança

- Preserve interfaces e invariantes documentados.
- Faça a menor alteração coerente e revisável.
- Não reduza validações, autorização, isolamento de tenant, tratamento de segredos ou trilhas de auditoria para economizar tokens.
- Mudanças em regras de negócio exigem pedido explícito e testes de regressão; TokenOps por si só não autoriza nenhuma.

### 6. Verificar por risco

Escolha o menor conjunto que ainda prova a mudança:

| Tipo de mudança | Verificação mínima | Quando ampliar |
| --- | --- | --- |
| Documentação/instruções | revisão de consistência, links e `git diff --check` | se comandos, contratos ou segurança forem alterados |
| Função pura/regra localizada | teste unitário direcionado + typecheck da área quando disponível | se o tipo ou resultado for compartilhado |
| API, autorização ou persistência | testes direcionados de sucesso e negação + typecheck | sempre considerar suíte completa por risco transversal |
| Dependência, build ou configuração | comando específico + build | executar `npm run check` antes de encerrar |
| Pré-commit ou pré-publicação | `npm run check` | acrescentar `npm run build` e auditoria quando aplicável |

Falha dirigida não justifica repetir comandos sem diagnóstico. Leia o erro relevante, formule uma hipótese e rode o próximo teste que a distingue.

### 7. Produzir resumo compacto

O encerramento deve conter somente:

1. resultado alcançado;
2. arquivos modificados;
3. verificações executadas e resultados observados;
4. riscos, limitações ou pendências reais;
5. próximo passo apenas quando necessário.

Não reproduza raciocínio interno, histórico completo de comandos nem grandes blocos de saída.

## Preservação de decisões arquiteturais

- `docs/ARCHITECTURE.md` é a fonte canônica para camadas, dependências e estado.
- `docs/CONVENTIONS.md` é a fonte canônica para padrões de código e qualidade.
- `CLAUDE.md` mantém o estado de continuidade e restrições operacionais atuais.
- `CHANGELOG.md` registra mudanças entregues, não hipóteses ou planos.

Registre uma decisão somente quando ela alterar limite de camada, contrato, dependência, persistência, segurança, operação ou estratégia de teste. Atualize a fonte canônica correspondente com: decisão, motivo, impacto e alternativa descartada relevante. Para decisões temporárias, use o plano ou contexto da tarefa e remova detalhes que não tenham valor futuro.

## Benchmark de economia

### Preparação

Monte um conjunto estável de 5 a 10 tarefas representativas, incluindo ao menos:

- consulta de arquitetura;
- correção localizada;
- alteração com teste;
- investigação de falha;
- revisão sensível a segurança.

Para cada par A/B, mantenha iguais: commit inicial, tarefa, modelo, esforço de raciocínio, ferramentas disponíveis, limite de tempo e critério de aceitação. A é o fluxo anterior; B usa TokenOps. Use sessões novas para evitar contaminação de histórico e alterne a ordem A/B quando repetir o ensaio.

### Dados a registrar

Use os campos de uso fornecidos pela plataforma quando disponíveis:

- tokens de entrada;
- tokens de entrada em cache, registrados separadamente;
- tokens de saída;
- tokens de raciocínio, quando expostos;
- tokens totais;
- número de turnos e chamadas de ferramenta;
- duração até conclusão;
- testes executados e aprovados;
- defeitos, retrabalho ou intervenção humana.

Uso ausente não vale zero. Contagens são evidência operacional, não necessariamente a fatura final.

### Cálculo e interpretação

Para cada tarefa comparável:

```text
delta_tokens = tokens_B - tokens_A
economia_relativa = (tokens_A - tokens_B) / tokens_A
```

Apresente mediana e intervalo das tarefas, não apenas a média agregada. Separe entrada, cache e saída; cache alto não prova economia total. Considere melhoria somente quando B mantiver o mesmo critério de aceitação, não introduzir falhas e não transferir custo para retrabalho humano ou execuções posteriores.

### Relatório mínimo

| Tarefa | Variante | Entrada | Cache | Saída | Total | Duração | Qualidade/evidência |
| --- | --- | ---: | ---: | ---: | ---: | ---: | --- |
| Identificador estável | A ou B | observado | observado | observado | observado | observado | testes, revisão e retrabalho |

Não publique promessa percentual antes de executar esse benchmark. Quando a amostra for pequena, rotule o resultado como preliminar e informe o tamanho da amostra.

## Referências

- [OpenAI — Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex)
- [OpenAI — Observability and usage](https://developers.openai.com/api/docs/guides/agents-api/observability)


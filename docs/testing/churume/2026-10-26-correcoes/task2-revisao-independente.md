# Revisão independente — fronteiras cadastrais, tarefas, IA e projeções

26/10/2026. Revisão solicitada após implementação Task2. Nenhum arquivo de produto revisado foi editado por esta revisão. Checkout compartilhado continua em evolução; referências correspondem à leitura entre11:00–11:05 local.

## Achados

### R1 — P1 — parâmetros operacionais cadastrais sem validação material

`src/server/registry/party-command.ts:69–85` verifica alguns números do primeiro nível, mas não `roleData.cedente.operationalOverrides`. `:139–141` chama validateParty, que só valida limite cedente não negativo para esse papel; `:147–170` protege somente limite global/tranches. Probe em handler real com sessão/repositório mockados recebeu200 e passou para persistência:

```json
{"operationalOverrides":{"dayBasis":0,"monthlyRate":-999,"maximumOperationAmount":"sem limite"}}
```

Principal tinha somente registry:edit, sem risk:decide/authorityIds. `resolveOperationalParameters` em operational-profile.ts:293 faz spread direto desses overrides, sem sanear tipos/faixas. Resultado: cadastro de condição financeira inválida entra no estado autoritativo e chega às regras seguintes. Não foi executada operação financeira/PG com esses dados.

Outro probe200: sacado.creditLimit100→0 com mesmo perfil sem alçada; zero significa ausência de limite próprio na UI. Ajuste de permissão depende contrato de governança escolhido pelo principal; o problema de validação inválida independe dessa escolha.

Recomendação: validar parâmetros efetivos completos contra defaults/versionamento e tipos/faixas; governar mudanças materiais de limite/condição, inclusive sacado, pelo comando competente. Não converter entrada inválida silenciosamente para padrão.

### R2 — P1 — adaptador UI usa versão atual da coleção para draft antigo

`src/app/strato-app.tsx:1386–1389` envia expectedUpdatedAt=savedParties.find(...).updatedAt. Esse token representa coleção atual, não a versão em que o usuário abriu/alterou a ficha. Modal guarda `party` inicial no próprio estado; coleção pode atualizar por refreshParties (`:1367`) ou após persistência do Comercial (`:340–342`).

Condição: modal aberto emA; coleção/servidor avançam paraB em carregamento paralelo; salvar draftA envia tokenB. Guard do servidor aceita e pode reverter campos deB paraA, apesar de novo expectedUpdatedAt. **Inspecionado, sem reprodução integral de navegador.**

Recomendação: transmitir token de party.updatedAt do snapshot editado (antes de savePartyRecord reescrever updatedAt), jamais copiar versão mais nova para payload antigo. Acrescentar regressão do adaptador, não só comando HTTP.

### R3 — P2 — configuração IA aceita gravação de versão obsoleta

`src/server/intelligence/repository.ts:138–164` bloqueia linha e incrementa aggregate_version, porém não compara state.persistenceVersion ao valor atual; rota state/PUT também não faz CAS. Melhorias da raiz exibem falha/retry, mas uma gravação obsoleta é tratada como sucesso.

Probe com IntelligenceDatabase e saveIntelligenceState real: adminA grava contracted=false/enabled=false; adminB reaplica snapshot antigo persistenceVersion1 com contracted=true/enabled=true; gravação aceita e reativa estado. Não houve consulta IA paga. Esse mecanismo já existia, mas viola foco explícito do plano de correções sobre concorrência de configuração.

Recomendação: comparar versão no lock e devolver409; rebater apenas alterações explícitas do editor ou exigir recarga quando outro editor alterar. Fila local não substitui controle entre navegadores.

### R4 — P2 — não-demo ainda inventa próxima ação/tela pelo departamento

`src/domain/live-operations/model.ts:53–69` mantém textos derivados do departamento para Risco/Controladoria/Financeiro/Comercial. A tabela passou a chamar coluna de “Próxima ação da operação”; drawer mantém “ATIVIDADE ATUAL”. Probe com modelo real, usuário Risco e operação etapa1/nextAction “CHURUME conferir documentos de Entrada”: retorno mantém task “Analisando elegibilidade”, screen “Operações · Risco”.

Presença unknown, tempos zero e ausência de histórico inventado foram corrigidos. Falta usar nextAction/etapa da operação no ambiente real ou marcar recomendação genérica explicitamente. Probe não usa browser.

## Cobertura e evidências

- `registry-route-integrity`, `churume-live-provenance`, `churume-portfolio-coverage` executados e aprovados durante revisão. Probes acrescentados a cópia temporária da suíte cadastral: execução conjunta4 arquivos/28 casos, todos aprovados, incluindo reproduções positivasR1/sacado. Probes config/live2 casos também aprovados.
- Fontes preservadas em `evidencias-revisao/registry-probes.test.ts.txt` e `config-live-probes.test.ts.txt`. Nomes temporários foram removidos de tests para não contaminar suíte após correções. “Passar” nesses probes significa confirmar comportamento atual indesejado, não homologar produto.
- Para reproduzir, copiar arquivo .test.ts.txt correspondente para tests/churume-review-*.test.ts e executar Vitest com DATABASE_URL/OPENAI_API_KEY removidos; remover cópia depois. registry-probes inclui testes basais copiados e dois probes finais identificados REVIEW.
- Histórico cadastral recebido da API é reconstruído pelo servidor; versão é conferida sob lock; repositório preserva prefixo de histórico; campos bankAccounts exigem outro fluxo. Testes cobrem esses caminhos. Não identifiquei novo bypass de tenant nesses arquivos.
- Raiz deixou de reconciliar tarefas automáticas no cliente autenticado e reidrata operação por snapshot autorizado. Não identifiquei novoP1/P2 comprovado nesses efeitos; atualizações otimistas/filas ainda exigem homologação de rede e usuário, sem alegar certificação por leitura.
- Carteira passa coleção inteira à grade; grade pagina100 e exporta sorted completo. Código inspecionado não apresenta mais corte200. Teste novo só verifica SSR inicial/contagem/controles; não comprova clique de página3 nem conteúdo do CSV.

## Suplemento — grade da carteira: paginação e CSV

Arquivo `tests/churume-portfolio-grid-interaction.test.ts`, dois casos com componente real, hooks controlados e execução dos handlers onClick/onChange. Sem navegador, DOM montado, rede ou escrita de arquivo; saveFile recebe mock que captura nome/conteúdo em memória. Complementa SSR inicial de `churume-portfolio-coverage.test.ts`.

- Grade recebe201 títulos filtrados entre203 sintéticos. Executa Próxima página duas vezes: páginas100/100/1, título QA-201 acessível na terceira, próxima desabilitada e anterior habilitada. Retorna à primeira e confirma seleção mantida; seleção feita na terceira também permanece no contador.
- Remove coluna Cedente, inclui Desconto, ordena Saldo decrescente por handler real e navega novamente à terceira página. Exporta201 registros, apesar de página conter só1 e seleção conter só2. Verifica BOM, nome CSV, cabeçalho escolhido e lista inteira dos201 documentos na ordem exata, sem QA-202/203 e sem mutar coleção original.
- Troca coleção recebida pela grade para filtro51 títulos: página limita-se a1/1, ordem e colunas persistem, seleção visível reduz-se a1, CSV contém51 registros e não inclui títulos fora desse filtro. Ao restaurar201, seleção2 e CSV completo são preservados.
- Limite explícito: filtro foi aplicado à coleção de entrada, equivalente ao contrato entre PortfolioModule e grade; não executa controles de filtro do módulo, download nativo, redimensionamento, detalhes ou interação em navegador. Hooks controlados recalculam useMemo; não verificam invalidação de cache pelo React.

Validação dirigida: dois arquivos / três testes aprovados; ESLint do novo arquivo aprovado. Falhas iniciais foram somente normalização de espaços no leitor de árvore do teste, ajustada antes de validar comportamento. Nenhum defeito adicional identificado; `portfolio-title-grid.tsx` não alterado neste suplemento. Suíte global não repetida.

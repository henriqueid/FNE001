# Mapa técnico de oportunidades STRATO × proScore

Documento interno de fundamentação. **Todas as linhas são hipóteses** sujeitas a validação conjunta: não há
documentação pública de endpoints, campos, contratos ou SLA da proScore. Produtos citados são os que a empresa
divulga publicamente (ver `01-pesquisa-publica-proscore.md`).

Princípios comuns a todas as hipóteses:

- **Consulta orientada a evento**, nunca em massa sem motivo: a regra do STRATO decide quando consultar.
- **Autorização explícita** (permissão + finalidade) antes de qualquer consulta paga; registro de quem pediu, quando, por quê.
- **Resultado vira atributo determinístico** (política, score, alerta); a IA só interpreta e cita a fonte.
- **Auditoria**: solicitante, momento, finalidade, resposta usada, versão das regras e decisão posterior ficam na trilha.
- **LGPD**: base legal e finalidade por consulta; retenção mínima; dados pessoais de PF só quando necessários.

| Módulo STRATO | Problema operacional | Informação externa desejada | Linha pública da proScore (potencial) | Evento que dispara | Apresentação ao usuário | Consequência pretendida | Controle de autorização | Riscos (privacidade, segurança, conformidade) | Validar com a proScore |
|---|---|---|---|---|---|---|---|---|---|
| Cadastro | Cadastro incompleto ou inconsistente de cedentes e sacados | Dados cadastrais PJ/PF, situação, endereço, contatos, vínculos | Plugins de Consulta (cadastro PF/PJ), proGestor, match | Novo cadastro; revisão periódica vencida | Campos sugeridos com fonte e data; divergências destacadas | Cadastro normalizado e qualificado | Permissão de cadastro; finalidade “onboarding” | Dados pessoais de sócios/PF; minimização | Campos, frequência de atualização, formato de API, custo por consulta |
| Onboarding | Fraude e inconsistência na entrada de um cedente | Indícios de fraude, divergências cadastrais | Fraude e Compliance | Cadastro de cedente novo | Checklist de verificação com resultado e evidência | Bloqueio ou alçada antes do primeiro limite | Compliance/gestor | Falso positivo; explicabilidade | Quais sinais existem e como são explicados |
| Crédito | Limite e elegibilidade decididos sem informação externa | Score, restrições (CCF, pendências), protestos, indicações de mercado | Plugins (credipro PF/PJ, protesto), Crédito e Risco | Comitê de limite; sacado novo; revisão de limite | Painel de crédito com atributos externos lado a lado do histórico interno | Limites e alçadas mais bem calibrados | Comitê/alçada | Uso de score de terceiros em decisão automatizada | Escalas, significado e cobertura PJ |
| Políticas | Regras não podem usar atributos externos | Atributos objetivos (ex.: protestos > N, restrição ativa) | Authority de Score (parâmetros e subcritérios) | Execução da política na operação | Regra com parâmetro externo e fonte | Elegibilidade determinística com dado externo | Gestor de políticas (versionamento) | Dependência de disponibilidade do fornecedor | Estabilidade dos atributos; fallback quando indisponível |
| Operações | Revisões tardias, depois da formalização | Sinal de risco do sacado/cedente no momento da entrada | Plugins de Consulta | Regra configurada (sacado novo, concentração, valor) | Exceção na fila com o resultado da consulta | Revisão antes de formalizar, sem consulta desnecessária | Analista autoriza (fluxo atual “Consultar bureau”) | Custo por consulta; latência | Tempo de resposta; modelo de cobrança por evento |
| Carteira | Deterioração percebida tarde | Mudança de score, novas restrições/protestos | (monitoramento não publicado) | Agenda periódica ou gatilho de atraso | Alerta no radar com variação e fonte | Ação de cobrança/recompra antecipada | Gestor de risco | Volume de consultas; dados de PF | Existência de monitoramento/notificação ativa |
| Score interno | Componentes externos previstos sem provedor | Score de bureau e protestos | Crédito e Risco, Plugins | Recalcular score do cliente | Componente “externo” do índice com data e fonte | Índice interno mais completo (metodologia a validar) | Política de qualidade versionada | Não confundir índice por regras com modelo preditivo | Licença de uso do score em índice próprio |
| Cobrança | Contatos desatualizados; priorização | Atualização de contatos, localização | proGestor, match | Título vencido sem contato efetivo | Contato sugerido com fonte | Recuperação mais eficiente | Cobrança, finalidade legítima | LGPD (localização de pessoas); uso restrito a cobrança | Bases permitidas para cobrança |
| Compliance | Verificações PEP, vínculos e grupos | PEP, grupos econômicos, vínculos societários/familiares, dossiê | Fraude e Compliance | Cadastro, revisão anual, mudança societária | Dossiê anexado à evidência da operação | Concentração por grupo econômico e KYC documentado | Compliance | Dados sensíveis; listas restritivas | Cobertura de sanções; formato do dossiê |
| Copiloto | Respostas sem contexto externo | Sínteses e indicadores externos autorizados | proAIssist (sínteses sobre consultas) | Pergunta do usuário com permissão | Resposta com fonte “externa” separada da interna | Investigação mais rápida, decisão inalterada | Mesmas permissões do dado de origem | IA externa como fonte, nunca como decisora | Formato estruturado da síntese; rastreabilidade |
| Auditoria | Provar por que uma decisão foi tomada | Metadados da consulta (protocolo, data, produto) | todas | Toda consulta | Trilha da operação | Evidência regulatória e interna | Imutável (append-only) | Retenção vs. LGPD | Protocolo/identificador por consulta |
| Comercial | Prospecção de cedentes manual | Leads B2B filtrados, perfil de mercado | proXtract, Zoomy | Planejamento comercial | Lista de prospects no funil | Originação qualificada | Comercial | Uso de dados para marketing | Licença de uso dos leads |

## Caso piloto sugerido

**Consulta de sacado novo na entrada da operação.** O STRATO já tem o ponto de encaixe: a análise do sacado possui
“Consultar bureau” com autorização explícita, o score interno reserva “Score de bureau (externo)” e “Protestos e
apontamentos”, e o catálogo de integrações tem “Bureaus de crédito” e “Protestos e cartórios” prontos para
configuração. Métricas do piloto: tempo de análise da exceção, consultas por operação, custo por decisão e taxa de
revisão antes da formalização.
